'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT) || 10000;
const MAX_PLAYERS = 5;
const MAX_MESSAGE_BYTES = 16 * 1024;
const ROOT = __dirname;
const rooms = new Map();

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function safeText(value, max = 16) {
  return String(value ?? '').replace(/[<>\u0000-\u001F]/g, '').trim().slice(0, max) || 'Pilot';
}

function safeRoom(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
}

function playerSummary(player) {
  return { id: player.id, name: player.name };
}

function broadcast(room, payload, except = null) {
  for (const player of room.players.values()) {
    if (player.ws !== except) send(player.ws, payload);
  }
}

function fail(ws, code, message) {
  send(ws, { type: 'error', code, message });
  setTimeout(() => {
    try { ws.close(4000, code.slice(0, 120)); } catch (_) {}
  }, 80);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'neon-wave-multiplayer', rooms: rooms.size }));
    return;
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    fs.readFile(path.join(ROOT, 'index.html'), (err, contents) => {
      if (err) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Game page is missing. Make sure index.html is included in the deployment.');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(contents);
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found. Try / or /healthz.');
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const roomCode = safeRoom(url.searchParams.get('room'));
  const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
  const requestedType = url.searchParams.get('type') || 'room';
  const roomType = requestedType === 'duel' ? 'duel' : 'room';
  const name = safeText(url.searchParams.get('name'));

  if (!roomCode) return fail(ws, 'BAD_ROOM_CODE', 'Enter a valid room code.');

  let room = rooms.get(roomCode);
  if (!room && role !== 'host') return fail(ws, 'ROOM_NOT_FOUND', `Room ${roomCode} was not found. Ask the host to create it first.`);
  if (!room) {
    room = { code: roomCode, type: roomType, maxPlayers: roomType === 'duel' ? 2 : MAX_PLAYERS, hostId: null, players: new Map(), createdAt: Date.now() };
    rooms.set(roomCode, room);
  }
  if (role === 'host' && room.type !== roomType) return fail(ws, 'ROOM_TYPE_MISMATCH', 'This room code is already in use.');
  if (room.players.size >= room.maxPlayers) return fail(ws, 'ROOM_FULL', `Room ${roomCode} is full (${room.maxPlayers} players maximum).`);
  if (role === 'host' && room.players.size > 0) return fail(ws, 'ROOM_EXISTS', 'That room code is already in use. Create a new room instead.');

  const player = { id: crypto.randomUUID(), name, ws, lastStateAt: 0, joinedAt: Date.now() };
  if (!room.hostId) room.hostId = player.id;
  player.role = player.id === room.hostId ? 'host' : 'guest';
  player.ws = ws;
  ws.playerId = player.id;
  ws.roomCode = roomCode;
  room.players.set(player.id, player);

  send(ws, {
    type: 'welcome',
    id: player.id,
    room: roomCode,
    hostId: room.hostId,
    players: Array.from(room.players.values(), playerSummary),
    maxPlayers: room.maxPlayers,
    roomType: room.type
  });
  broadcast(room, { type: 'player-joined', player: playerSummary(player) }, ws);

  ws.on('message', (buffer) => {
    const currentRoom = rooms.get(ws.roomCode);
    const currentPlayer = currentRoom?.players.get(ws.playerId);
    if (!currentRoom || !currentPlayer) return;

    let message;
    try { message = JSON.parse(buffer.toString()); } catch (_) { return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'heartbeat') {
      send(ws, { type: 'heartbeat', at: Date.now() });
      return;
    }

    if (message.type === 'presence') {
      currentPlayer.name = safeText(message.data?.name || currentPlayer.name);
      broadcast(currentRoom, { type: 'presence', id: currentPlayer.id, name: currentPlayer.name }, ws);
      return;
    }

    if (message.type === 'event') {
      const data = message.data;
      if (!data || typeof data.type !== 'string') return;
      // Only a short list of lobby events is accepted from the browser.
      if (!['ready', 'start-request', 'start'].includes(data.type)) return;
      const clean = { type: data.type };
      if (data.name != null) clean.name = safeText(data.name);
      if (data.deadline != null) clean.deadline = Math.max(Date.now(), Math.min(Date.now() + 20000, Number(data.deadline) || Date.now() + 15000));
      broadcast(currentRoom, { type: 'event', id: currentPlayer.id, data: clean }, ws);
      return;
    }

    if (message.type === 'state') {
      const now = Date.now();
      // Prevent a buggy tab from flooding the room more than 15 updates a second.
      if (now - currentPlayer.lastStateAt < 65) return;
      currentPlayer.lastStateAt = now;
      const state = message.state || {};
      const safeState = {
        name: currentPlayer.name,
        y: Math.max(0.04, Math.min(0.96, Number(state.y) || 0.5)),
        distance: Math.max(0, Math.min(10000000, Math.floor(Number(state.distance) || 0))),
        mode: ['levels', 'race', 'trial'].includes(state.mode) ? state.mode : 'race',
        gameState: ['ready', 'running', 'respawning', 'crashed', 'out-of-lives', 'finished'].includes(state.gameState) ? state.gameState : 'ready',
        alive: Boolean(state.alive)
      };
      broadcast(currentRoom, { type: 'state', id: currentPlayer.id, state: safeState }, ws);
    }
  });

  ws.on('close', () => {
    const currentRoom = rooms.get(ws.roomCode);
    if (!currentRoom) return;
    currentRoom.players.delete(ws.playerId);
    if (ws.playerId === currentRoom.hostId) {
      // This build keeps rooms simple and predictable: guests leave when their host disconnects.
      broadcast(currentRoom, { type: 'host-left', message: 'The room host disconnected. Return to the menu and create or join a new room.' });
      for (const p of currentRoom.players.values()) {
        try { p.ws.close(4001, 'Host left the room'); } catch (_) {}
      }
      rooms.delete(currentRoom.code);
      return;
    }
    broadcast(currentRoom, { type: 'player-left', id: ws.playerId });
    if (currentRoom.players.size === 0) rooms.delete(currentRoom.code);
  });
});

// Ping/pong detects stale sockets; the browser also sends a small heartbeat while in a room.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NEON WAVE multiplayer server listening on ${PORT}`);
});

function shutdown() {
  clearInterval(heartbeat);
  for (const ws of wss.clients) { try { ws.close(1001, 'Server shutting down'); } catch (_) {} }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

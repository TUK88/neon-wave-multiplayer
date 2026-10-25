# NEON WAVE — Render Multiplayer Build

This project contains the NEON WAVE canvas game and a Node.js WebSocket room server. Deploy the whole folder as a Render Web Service or Blueprint.

## Multiplayer and gameplay

- Standard rooms allow up to five real players. The room host starts a shared race countdown; connected players are shown as rivals with their live names, positions, and distances. AI bots are hidden in live-player rooms.
- **1 VS 1 FRIEND RACE** creates a two-player room. Share its generated code with one friend; the friend uses **JOIN ROOM** and enters that code. The room rejects a third player.
- Each browser runs its own obstacle course and reports race state to the room. This is a lightweight shared race, not server-authoritative simulation.
- Three lives let a player continue from the crash point. Once the last life is spent, the player can continue playing by restarting at the beginning of the current race or level. Other players keep their own progress.
- Solo bot races use faster, more reactive rivals. Course speed, obstacle frequency, and gap size ramp up more aggressively.
- Rooms are temporary. The host must remain connected; when the host leaves, the server closes the room for its guests.

## Deploy on Render

1. Create or open a GitHub repository and upload `index.html`, `server.js`, `package.json`, `render.yaml`, and `README.md` to the repository root.
2. In Render, choose **New → Blueprint**, select the repository, and deploy the `render.yaml` service. Alternatively, create a **Web Service** with build command `npm install` and start command `npm start`.
3. Wait for the service to report **Live**, then open its `https://…onrender.com` address. The page served from Render pre-fills the multiplayer server address.
4. To host the game elsewhere, paste the Render service URL into **MULTIPLAYER SERVER · RENDER** and press **SAVE SERVER**.
5. For multiplayer, open the service in two browser windows/devices. Create a standard room or a **1 VS 1 FRIEND RACE**, share the code, then join it from the other browser. Keep the host connected and press **START** in the lobby.

## Local run

Install Node.js 18 or newer, open a terminal in this folder, run `npm install`, then `npm start`. Visit `http://localhost:10000`. For a local multiplayer check, create/join rooms from separate browser windows.

## Render free service

Render's free service may sleep after inactivity and need time to wake. A sleeping server can delay WebSocket room connections.

## Files

- `index.html` — game, lobby, race rendering, and WebSocket client
- `server.js` — WebSocket rooms, duel capacity, lobby events, and state relay
- `package.json` — Node.js start script and `ws` dependency
- `render.yaml` — Render Blueprint configuration

# NEON WAVE — Render Multiplayer Build

This project contains the NEON WAVE HTML5 Canvas game and a Node.js WebSocket room server. Render can host both from the same repository. You can also keep the front-end on GitHub Pages and enter the Render server address in the game's **MULTIPLAYER SERVER · RENDER** field.

## What is multiplayer in this build?

- Room codes are checked by the server, with up to 5 connected players per room.
- A guest can only join an existing room; a wrong code returns a room-not-found message instead of silently creating a room.
- Live player positions, distance, names, ready events, and race-start events are sent through WebSockets.
- Players still generate obstacle patterns locally on their own browsers. This is a lightweight shared-room race, not a server-authoritative esports simulation.
- Rooms are temporary. The host must remain connected; if the host leaves, guests are disconnected and can create or join another room.
- The page still includes Normal Levels, 5,000 m Bot Race, Time Trial, browser-saved progress, and the local daily-code mechanic.

## Deploy it on Render

1. Sign in to Render and connect your GitHub account.
2. Create a **new GitHub repository** for this project, for example `neon-wave-multiplayer`.
3. Upload the files from this project folder into the **root** of that repository. The root should contain `index.html`, `server.js`, `package.json`, `render.yaml`, and `README.md`.
4. In Render, choose **New → Blueprint** and select the repository, or choose **New → Web Service** and select it.
5. For a Web Service, use these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance:** Free for testing
6. Deploy. Wait for the deployment to say **Live**.
7. Open the service's `https://…onrender.com` URL. The game page should appear. If the game is served from this Render URL, the server field will prefill with the same address.
8. Test by opening the game in two separate browser windows/devices. In the first, create a room and copy the code. In the second, enter that exact code and join. Keep the host window open.

## Keep using GitHub Pages instead

If the game page remains on GitHub Pages, copy the Render service's base URL (for example `https://your-service.onrender.com`). In the game menu, paste it into **MULTIPLAYER SERVER · RENDER**, click **SAVE SERVER**, then create/join a room. The game automatically converts that HTTPS address to a secure WebSocket (`wss://…/ws`) connection.

## Local test on Windows

1. Install Node.js 18 or newer.
2. Open PowerShell in this folder.
3. Run `npm install`, then `npm start`.
4. Visit `http://localhost:10000`.

For local multi-window testing, the page should automatically accept `http://localhost:10000` as its server address when hosted from this Node server.

## Important free-tier note

Render's free web service can sleep after 15 minutes without incoming traffic and may take around a minute to wake up. The browser shows a waiting message while it connects. A sleeping service or a failed deploy is not proof that the game file itself has an error.

## Files

- `index.html` — game page and WebSocket client
- `server.js` — WebSocket rooms, room codes, lobby events, and state relay
- `package.json` — Node.js start script and dependency
- `render.yaml` — Render Blueprint configuration

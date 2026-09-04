# Manhunt

A realtime app for playing IRL Manhunt with friends: everyone's phone GPS pings the group
at a chosen interval, positions show up live on a shared map, and there's a group chat.

## How it works

- **Create a game** — pick a game name, a GPS ping interval (5s to 10min), your name, and
  your role (Hunter / Runner / Spectator). You get a 5-letter room code.
- **Share the code** with friends — they open the app, tap "Join Game", enter the code and
  their name.
- Everyone's browser pings its GPS on the chosen interval and the server broadcasts every
  player's latest position to the room, shown on a live map.
- Hunters can mark a runner as "Caught" from the Players tab.
- The ping interval can be changed by anyone mid-game (e.g. slow it down to save battery,
  speed it up for the final chase).
- There's a group chat tab for coordinating/trash talk.
- The app is installable to your phone's home screen (PWA) for a more native feel.

No accounts, no app store install — it's a website that asks for location permission.

## Project layout

```
server/   Node.js + Express + Socket.IO + SQLite backend
client/   React (Vite) frontend, built as static files served by the backend
```

## Running it locally

Requires Node.js 18+.

```bash
npm run install:all   # installs server + client deps
npm run build          # builds the React app into client/dist
npm start               # starts the server on http://localhost:3001
```

Open `http://localhost:3001` in a browser. The server serves both the API/websocket and
the built frontend, so this is the only URL you need.

### Development mode (hot reload)

Run the backend and frontend separately:

```bash
npm run dev:server   # Express + Socket.IO on :3001
npm run dev:client   # Vite dev server on :5173 (proxies /api and /socket.io to :3001)
```

Then open `http://localhost:5173`.

## Playing with friends over the same WiFi

1. Start the server as above (`npm run build && npm start`).
2. Find your computer's local IP address (e.g. `192.168.1.42`).
3. Have friends on the same WiFi open `http://192.168.1.42:3001` on their phones.
4. Mobile browsers require HTTPS (or `localhost`) to grant GPS access on many setups — if
   location permission fails over plain `http://`, deploy the app to a host with HTTPS (see
   below) or use a tunnel like `ngrok http 3001` / `cloudflared tunnel --url http://localhost:3001`
   to get a temporary HTTPS URL.

## Deploying so friends can join from anywhere

Deploy `server/` (which serves the built `client/dist`) to any Node host with a persistent
process and HTTPS, e.g. Railway, Render, Fly.io, or a VPS behind a reverse proxy with TLS.
Steps are the same as running locally: `npm run install:all && npm run build && npm start`,
with `PORT` set by the host's environment.

Location updates only flow while a player's browser tab is open and the game is not
backgrounded on iOS Safari (mobile browsers suspend GPS/JS when the tab isn't in the
foreground) — keep the app open during the hunt.

## Data

Game rooms, players, and chat messages are stored in a local SQLite file
(`server/manhunt.db`, auto-created). There's no cross-game history UI; each room is
identified by its 5-letter code and rooms don't currently expire automatically.

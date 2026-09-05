# Manhunt

A realtime app for playing IRL Manhunt with friends: everyone's phone GPS pings the group
at a chosen interval, positions show up live on a shared map, and there's a group chat.

## How it works

- **Create a game** — pick a game name, separate GPS ping intervals for runners and for
  hunters (5s to 10min each), a tag radius (10ft to 200ft), a start countdown (no delay up
  to 5min), your name, and your role (Hunter / Runner / Spectator). You get a 5-letter room
  code. All measurements are imperial (feet).
- **Share the code** with friends — they open the app, tap "Join Game", enter the code and
  their name.
- Everyone's browser pings its GPS on their own role's interval and the server broadcasts
  every player's latest position to the room, shown on a live map. Hunters and runners can
  be given different ping rates (e.g. hunters ping every 5s for a tighter chase while
  runners ping every minute to save battery) — each player's game screen shows a live
  "next ping in Xs" countdown for their own device.
- **Map visibility** — everyone sees everyone's location, hunters and runners alike. It's
  never truly live for anyone, though: a player's marker only moves when their own device
  sends a ping at their role's interval, so what you're looking at is always a snapshot of
  where they were as of their last ping. Recently-pinging players get a pulsing "live"
  marker (judged against *their own* role's ping interval, not yours, since hunters and
  runners can ping at different rates); anyone who hasn't pinged in a while shows dimmed
  with a "last known" timestamp instead, so you can tell a fresh ping from a stale one.
- **Auto-tag by proximity** — whenever a hunter's and a runner's GPS positions come within
  the room's tag radius of each other, the runner is automatically marked "caught" (no
  button press needed) and it's announced in chat. The runner's own screen flashes red with
  an alert tone/vibration; the hunter who made the catch gets their own flash — green, with
  a distinct triumphant sound and a "You caught X!" banner. Hunters can also manually toggle
  "Caught" from the Players tab (same catch feedback applies), for overrides or when GPS is
  unreliable.
- **Randomize teams** — from the Players tab, pick how many hunters you want and hit
  "Randomize Teams" to shuffle everyone (except spectators) into hunters/runners and reset
  catch status for a new round.
- **Start countdown** — tagging (both automatic and manual) is disabled until someone hits
  "Start Game", so hunters standing right next to runners at the beginning can't tag them
  instantly. A pulsing banner counts down to go-time, adjustable anytime from the "Start
  delay" control (0 for an instant start). "Start Game" doubles as "Restart Round" once a
  round is underway — it resets everyone's catch status for a fresh round.
- **Profile pictures** — optionally add a photo when you join (or change it anytime by
  tapping your avatar in the game header); it shows up on the map marker and player list.
  No photo needed — you get a colored initial avatar instead.
- **Map**: tap the map style pill to cycle between Street (OpenStreetMap), Satellite (Esri
  World Imagery — global, but can have clouds baked into the imagery for some areas/dates),
  and USGS Aerial (real aerial photography, US-only, essentially cloud-free since it's flown
  under clear-sky conditions). Zooms up to street level.
- **Win detection** — the moment every runner has been tagged (whether by auto-tag or a
  manual "Caught"), the hunters win: a gold banner announces it and the win is posted to
  chat. It stays won until someone hits "Restart Round", which resets it for the next round.
- **Breadcrumb trails** — the map traces each visible teammate's last several minutes of
  movement as a short fading line behind their marker, so you can see which way someone's
  heading, not just where they are right now. Trails follow the same team-only visibility
  rule as the markers.
- **Match timer** — optionally cap a round with a clock (5 minutes up to 1 hour, or no limit
  by default). A live "Time remaining" countdown shows once tagging goes live; if it hits
  zero before hunters catch everyone, the runners win — announced the same way as a hunters'
  win, and cleared on the next "Restart Round".
- A red dot appears on the Chat tab whenever a new message (including system announcements
  like tags and round starts) arrives while you're looking at a different tab.
- The ping intervals, tag radius, and start delay can all be changed by anyone mid-game
  (e.g. slow the ping down to save battery, widen the tag radius if GPS is noisy).
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

## Hosting on your own Windows PC, exposed publicly (port forwarding)

For a one-off game night where you just want to forward a port on your router and play,
without a third-party tunnel service.

**Important:** phone browsers block GPS access on plain `http://` (only `https://` or
`localhost` are allowed to use the Geolocation API). So this app needs to be served over
HTTPS even for a quick local game — a self-signed certificate is enough, friends will just
see a one-time "connection not private" warning they click through.

1. **Install Node.js** (LTS) from nodejs.org if you don't have it.
2. **Get the code** onto the Windows PC (e.g. `git clone` the repo, or download it as a zip
   and extract it), then open PowerShell in that folder.
3. **Install and build:**
   ```powershell
   npm run install:all
   npm run build
   ```
4. **Find your public IP** (PowerShell):
   ```powershell
   curl.exe ifconfig.me
   ```
5. **Generate a self-signed certificate** for that IP:
   ```powershell
   cd server
   npm run generate-cert -- <your-public-ip>
   ```
   This writes `server/certs/cert.pem` and `key.pem` (valid 7 days, gitignored). When these
   files exist, the server automatically serves HTTPS on port 443 instead of plain HTTP on
   3001 — no extra config needed.
6. **Allow the port through Windows Firewall** (run PowerShell as Administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "Manhunt" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
   ```
7. **Port forward on your router:** forward external TCP port 443 to your PC's local IP
   (find it with `ipconfig`, look for "IPv4 Address") on port 443. This is in your router's
   admin page (varies by router/ISP).
8. **Start the server:**
   ```powershell
   npm start
   ```
   It should print `listening on port 443 (https)`.
9. **Share the URL** with friends: `https://<your-public-ip>/`. Each of them will get a
   browser warning about the certificate the first time — that's expected for a self-signed
   cert; they tap "Advanced" → "Proceed" (wording varies by browser) once, then the app and
   GPS permission work normally.

When the game's over: stop the server (Ctrl+C), remove the port forward on your router, and
optionally remove the firewall rule (`Remove-NetFirewallRule -DisplayName "Manhunt"`).

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

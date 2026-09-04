import express from 'express';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { Server } from 'socket.io';
import {
  createRoom,
  getRoom,
  getPlayers,
  addPlayer,
  getPlayer,
  setPlayerConnected,
  setPlayerRole,
  setPlayerCaught,
  updatePlayerLocation,
  addMessage,
  getRecentMessages,
  setPingInterval,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '..', 'certs', 'cert.pem');
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '..', 'certs', 'key.pem');
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

const PORT = process.env.PORT || (useHttps ? 443 : 3001);

const app = express();
app.use(cors());
app.use(express.json());

const server = useHttps
  ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
  : http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/rooms/:code', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ ok: false, error: 'Room not found' });
  res.json({ ok: true, room });
});

function roomSnapshot(code) {
  const room = getRoom(code);
  const players = getPlayers(code);
  return { room, players };
}

function broadcastRoom(code) {
  io.to(code).emit('room-state', roomSnapshot(code));
}

io.on('connection', (socket) => {
  socket.on('create-room', ({ roomName, pingIntervalSeconds, playerName, role }, cb) => {
    try {
      if (!playerName || !playerName.trim()) throw new Error('Name is required');
      const room = createRoom(roomName, Number(pingIntervalSeconds) || 30);
      const player = addPlayer({ roomCode: room.code, name: playerName.trim(), role: role || 'runner' });

      socket.data.playerId = player.id;
      socket.data.roomCode = room.code;
      socket.join(room.code);

      const sysMsg = addMessage({ roomCode: room.code, playerName: 'System', text: `${player.name} created the game.`, system: true });
      io.to(room.code).emit('chat-message', sysMsg);

      cb({ ok: true, room, player, messages: getRecentMessages(room.code) });
      broadcastRoom(room.code);
    } catch (err) {
      cb({ ok: false, error: err.message });
    }
  });

  socket.on('join-room', ({ code, playerName, role }, cb) => {
    try {
      const room = getRoom(code);
      if (!room) throw new Error('Room not found');
      if (!playerName || !playerName.trim()) throw new Error('Name is required');
      const player = addPlayer({ roomCode: room.code, name: playerName.trim(), role: role || 'runner' });

      socket.data.playerId = player.id;
      socket.data.roomCode = room.code;
      socket.join(room.code);

      const sysMsg = addMessage({ roomCode: room.code, playerName: 'System', text: `${player.name} joined the game.`, system: true });
      io.to(room.code).emit('chat-message', sysMsg);

      cb({ ok: true, room, player, messages: getRecentMessages(room.code) });
      broadcastRoom(room.code);
    } catch (err) {
      cb({ ok: false, error: err.message });
    }
  });

  socket.on('rejoin-room', ({ code, playerId }, cb) => {
    try {
      const room = getRoom(code);
      if (!room) throw new Error('Room not found');
      const player = getPlayer(playerId);
      if (!player || player.room_code !== room.code) throw new Error('Player not found');

      socket.data.playerId = player.id;
      socket.data.roomCode = room.code;
      socket.join(room.code);
      setPlayerConnected(player.id, true);

      cb({ ok: true, room, player, messages: getRecentMessages(room.code) });
      broadcastRoom(room.code);
    } catch (err) {
      cb({ ok: false, error: err.message });
    }
  });

  socket.on('location-update', ({ lat, lng, accuracy }) => {
    const { playerId, roomCode } = socket.data;
    if (!playerId || !roomCode) return;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    updatePlayerLocation(playerId, { lat, lng, accuracy });
    broadcastRoom(roomCode);
  });

  socket.on('set-role', ({ role }) => {
    const { playerId, roomCode } = socket.data;
    if (!playerId || !roomCode) return;
    if (!['hunter', 'runner', 'spectator'].includes(role)) return;
    setPlayerRole(playerId, role);
    broadcastRoom(roomCode);
  });

  socket.on('set-ping-interval', ({ seconds }) => {
    const { roomCode } = socket.data;
    if (!roomCode) return;
    const s = Number(seconds);
    if (!s || s < 5) return;
    setPingInterval(roomCode, s);
    broadcastRoom(roomCode);
  });

  socket.on('toggle-caught', ({ targetPlayerId, caught }) => {
    const { roomCode } = socket.data;
    if (!roomCode) return;
    const target = getPlayer(targetPlayerId);
    if (!target || target.room_code !== roomCode) return;
    setPlayerCaught(targetPlayerId, caught);
    const sysMsg = addMessage({
      roomCode,
      playerName: 'System',
      text: caught ? `${target.name} was caught!` : `${target.name} is back in the game.`,
      system: true,
    });
    io.to(roomCode).emit('chat-message', sysMsg);
    broadcastRoom(roomCode);
  });

  socket.on('chat-message', ({ text }) => {
    const { playerId, roomCode } = socket.data;
    if (!playerId || !roomCode) return;
    if (!text || !text.trim()) return;
    const player = getPlayer(playerId);
    if (!player) return;
    const msg = addMessage({ roomCode, playerName: player.name, text: text.trim().slice(0, 500), system: false });
    io.to(roomCode).emit('chat-message', msg);
  });

  socket.on('disconnect', () => {
    const { playerId, roomCode } = socket.data;
    if (!playerId || !roomCode) return;
    setPlayerConnected(playerId, false);
    broadcastRoom(roomCode);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Manhunt server listening on port ${PORT} (${useHttps ? 'https' : 'http'})`);
});

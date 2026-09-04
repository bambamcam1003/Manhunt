import { customAlphabet, nanoid } from 'nanoid';
import db from './db.js';

const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

const PLAYER_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080',
  '#e6beff', '#9a6324', '#800000', '#808000', '#000075',
];

export function createRoom(name, pingIntervalSeconds) {
  let code;
  do {
    code = roomCode();
  } while (db.prepare('SELECT 1 FROM rooms WHERE code = ?').get(code));

  db.prepare(
    'INSERT INTO rooms (code, name, ping_interval_seconds, created_at) VALUES (?, ?, ?, ?)'
  ).run(code, name || 'Manhunt', pingIntervalSeconds || 30, Date.now());

  return getRoom(code);
}

export function getRoom(code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM rooms WHERE code = ?').get(code.toUpperCase());
}

export function setPingInterval(code, seconds) {
  db.prepare('UPDATE rooms SET ping_interval_seconds = ? WHERE code = ?').run(seconds, code);
}

export function getPlayers(code) {
  return db.prepare('SELECT * FROM players WHERE room_code = ?').all(code);
}

function nextColor(code) {
  const count = db.prepare('SELECT COUNT(*) c FROM players WHERE room_code = ?').get(code).c;
  return PLAYER_COLORS[count % PLAYER_COLORS.length];
}

export function addPlayer({ roomCode, name, role }) {
  const id = nanoid(10);
  const color = nextColor(roomCode);
  db.prepare(
    `INSERT INTO players (id, room_code, name, role, color, connected, last_update)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  ).run(id, roomCode, name, role || 'runner', color, Date.now());
  return getPlayer(id);
}

export function getPlayer(id) {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id);
}

export function setPlayerConnected(id, connected) {
  db.prepare('UPDATE players SET connected = ? WHERE id = ?').run(connected ? 1 : 0, id);
}

export function setPlayerRole(id, role) {
  db.prepare('UPDATE players SET role = ? WHERE id = ?').run(role, id);
}

export function setPlayerCaught(id, caught) {
  db.prepare('UPDATE players SET caught = ? WHERE id = ?').run(caught ? 1 : 0, id);
}

export function updatePlayerLocation(id, { lat, lng, accuracy }) {
  db.prepare(
    'UPDATE players SET lat = ?, lng = ?, accuracy = ?, last_update = ? WHERE id = ?'
  ).run(lat, lng, accuracy ?? null, Date.now(), id);
  return getPlayer(id);
}

export function addMessage({ roomCode, playerName, text, system }) {
  const id = nanoid(10);
  const created = Date.now();
  db.prepare(
    'INSERT INTO messages (id, room_code, player_name, text, system, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, roomCode, playerName, text, system ? 1 : 0, created);
  return { id, roomCode, playerName, text, system: !!system, createdAt: created };
}

export function getRecentMessages(code, limit = 100) {
  const rows = db
    .prepare('SELECT * FROM messages WHERE room_code = ? ORDER BY created_at DESC LIMIT ?')
    .all(code, limit);
  return rows.reverse().map((r) => ({
    id: r.id,
    roomCode: r.room_code,
    playerName: r.player_name,
    text: r.text,
    system: !!r.system,
    createdAt: r.created_at,
  }));
}

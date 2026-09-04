import { customAlphabet, nanoid } from 'nanoid';
import db from './db.js';

const roomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

const PLAYER_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080',
  '#e6beff', '#9a6324', '#800000', '#808000', '#000075',
];

export function createRoom(name, pingIntervalSeconds, tagRadiusFeet, hunterPingIntervalSeconds, countdownSeconds, matchDurationSeconds) {
  let code;
  do {
    code = roomCode();
  } while (db.prepare('SELECT 1 FROM rooms WHERE code = ?').get(code));

  db.prepare(
    `INSERT INTO rooms (code, name, ping_interval_seconds, hunter_ping_interval_seconds, tag_radius_feet, countdown_seconds, match_duration_seconds, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    code,
    name || 'Manhunt',
    pingIntervalSeconds || 30,
    hunterPingIntervalSeconds || 30,
    tagRadiusFeet || 50,
    countdownSeconds ?? 30,
    matchDurationSeconds || 0,
    Date.now()
  );

  return getRoom(code);
}

export function getRoom(code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM rooms WHERE code = ?').get(code.toUpperCase());
}

export function setPingInterval(code, seconds) {
  db.prepare('UPDATE rooms SET ping_interval_seconds = ? WHERE code = ?').run(seconds, code);
}

export function setHunterPingInterval(code, seconds) {
  db.prepare('UPDATE rooms SET hunter_ping_interval_seconds = ? WHERE code = ?').run(seconds, code);
}

export function setTagRadius(code, feet) {
  db.prepare('UPDATE rooms SET tag_radius_feet = ? WHERE code = ?').run(feet, code);
}

export function setCountdownSeconds(code, seconds) {
  db.prepare('UPDATE rooms SET countdown_seconds = ? WHERE code = ?').run(seconds, code);
}

export function setMatchDuration(code, seconds) {
  db.prepare('UPDATE rooms SET match_duration_seconds = ? WHERE code = ?').run(seconds, code);
}

const resetCaughtForNonSpectators = db.transaction((roomCode) => {
  db.prepare("UPDATE players SET caught = 0 WHERE room_code = ? AND role != 'spectator'").run(roomCode);
});

export function startGame(code) {
  const room = getRoom(code);
  if (!room) return null;
  const startsAt = Date.now() + Math.max(0, room.countdown_seconds) * 1000;
  const endsAt = room.match_duration_seconds > 0 ? startsAt + room.match_duration_seconds * 1000 : null;
  db.prepare('UPDATE rooms SET game_starts_at = ?, game_ends_at = ?, winner = NULL WHERE code = ?').run(startsAt, endsAt, code);
  resetCaughtForNonSpectators(code);
  return getRoom(code);
}

export function isGameLive(room) {
  return !!room.game_starts_at && Date.now() >= room.game_starts_at;
}

export function setWinner(code, winner) {
  db.prepare('UPDATE rooms SET winner = ? WHERE code = ?').run(winner, code);
}

// Hunters win once every runner in the room has been tagged. Requires at
// least one runner -- a room with none (e.g. everyone's a hunter/spectator)
// has no win condition to trigger.
export function areAllRunnersCaught(code) {
  const runners = getPlayers(code).filter((p) => p.role === 'runner');
  return runners.length > 0 && runners.every((p) => p.caught);
}

export function getPlayers(code) {
  return db.prepare('SELECT * FROM players WHERE room_code = ?').all(code);
}

function nextColor(code) {
  const count = db.prepare('SELECT COUNT(*) c FROM players WHERE room_code = ?').get(code).c;
  return PLAYER_COLORS[count % PLAYER_COLORS.length];
}

export function addPlayer({ roomCode, name, role, avatar }) {
  const id = nanoid(10);
  const color = nextColor(roomCode);
  db.prepare(
    `INSERT INTO players (id, room_code, name, role, color, avatar, connected, last_update)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, roomCode, name, role || 'runner', color, avatar || null, Date.now());
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

export function setPlayerAvatar(id, avatar) {
  db.prepare('UPDATE players SET avatar = ? WHERE id = ?').run(avatar || null, id);
}

const assignRoles = db.transaction((assignments) => {
  const stmt = db.prepare('UPDATE players SET role = ?, caught = 0 WHERE id = ?');
  for (const { id, role } of assignments) stmt.run(role, id);
});

export function randomizeTeams(roomCode, hunterCount) {
  const candidates = getPlayers(roomCode).filter((p) => p.role !== 'spectator');
  if (candidates.length < 2) {
    throw new Error('Need at least 2 hunters/runners to randomize teams');
  }

  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const clampedHunterCount = Math.min(Math.max(1, hunterCount), shuffled.length - 1);
  const assignments = shuffled.map((p, idx) => ({
    id: p.id,
    role: idx < clampedHunterCount ? 'hunter' : 'runner',
  }));
  assignRoles(assignments);

  return { hunters: clampedHunterCount, runners: shuffled.length - clampedHunterCount };
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

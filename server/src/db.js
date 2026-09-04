import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'manhunt.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ping_interval_seconds INTEGER NOT NULL DEFAULT 30,
    hunter_ping_interval_seconds INTEGER NOT NULL DEFAULT 30,
    tag_radius_feet INTEGER NOT NULL DEFAULT 50,
    countdown_seconds INTEGER NOT NULL DEFAULT 30,
    game_starts_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'runner',
    color TEXT NOT NULL,
    avatar TEXT,
    lat REAL,
    lng REAL,
    accuracy REAL,
    caught INTEGER NOT NULL DEFAULT 0,
    last_update INTEGER,
    connected INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (room_code) REFERENCES rooms(code)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    player_name TEXT NOT NULL,
    text TEXT NOT NULL,
    system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_code) REFERENCES rooms(code)
  );
`);

const roomColumns = db.prepare('PRAGMA table_info(rooms)').all().map((c) => c.name);
if (!roomColumns.includes('hunter_ping_interval_seconds')) {
  db.exec('ALTER TABLE rooms ADD COLUMN hunter_ping_interval_seconds INTEGER NOT NULL DEFAULT 30');
}
if (!roomColumns.includes('tag_radius_feet')) {
  db.exec('ALTER TABLE rooms ADD COLUMN tag_radius_feet INTEGER NOT NULL DEFAULT 50');
  if (roomColumns.includes('tag_radius_meters')) {
    db.exec('UPDATE rooms SET tag_radius_feet = CAST(ROUND(tag_radius_meters * 3.28084) AS INTEGER)');
  }
}
if (!roomColumns.includes('countdown_seconds')) {
  db.exec('ALTER TABLE rooms ADD COLUMN countdown_seconds INTEGER NOT NULL DEFAULT 30');
}
if (!roomColumns.includes('game_starts_at')) {
  db.exec('ALTER TABLE rooms ADD COLUMN game_starts_at INTEGER');
}

const playerColumns = db.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
if (!playerColumns.includes('avatar')) {
  db.exec('ALTER TABLE players ADD COLUMN avatar TEXT');
}

export default db;

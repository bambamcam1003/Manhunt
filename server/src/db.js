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
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'runner',
    color TEXT NOT NULL,
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

export default db;

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'app.db');
const isNew = !fs.existsSync(dbPath);

const rawDb = new DatabaseSync(dbPath);
rawDb.exec('PRAGMA journal_mode = WAL');
rawDb.exec('PRAGMA foreign_keys = ON');

// Thin wrapper providing the same .prepare(sql).run/get/all(...) shape used throughout
// this codebase, backed by Node's built-in node:sqlite instead of a native addon
// (avoids requiring Visual Studio build tools on Windows for better-sqlite3).
export const db = {
  raw: rawDb,
  exec: (sql) => rawDb.exec(sql),
  prepare: (sql) => {
    const stmt = rawDb.prepare(sql);
    return {
      run: (...args) => stmt.run(...args),
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
    };
  },
  transaction: (fn) => {
    return (...args) => {
      rawDb.exec('BEGIN');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT');
        return result;
      } catch (err) {
        rawDb.exec('ROLLBACK');
        throw err;
      }
    };
  },
};

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kpis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  memo TEXT
);

CREATE TABLE IF NOT EXISTS capacity_design (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seg_type TEXT NOT NULL,           -- 'S' or 'L'
  segment_id TEXT NOT NULL UNIQUE,
  segment_label TEXT NOT NULL,
  design_capacity_gbps REAL NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS capacity_phase (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_label TEXT NOT NULL,
  current_tbps REAL DEFAULT 0,
  phase1_tbps REAL DEFAULT 0,
  phase2_tbps REAL DEFAULT 0,
  phase3_tbps REAL DEFAULT 0,
  phase4_tbps REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lightup_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule TEXT,                    -- e.g. '2025A'
  seg_type TEXT,                    -- 'S' or 'L'
  segment_id TEXT,
  if100g REAL DEFAULT 0,
  if400g REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  status TEXT DEFAULT '계획중',      -- 설치완료 / 구축중 / 계획중
  complete_date TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS funnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no INTEGER,
  customer TEXT,
  a_end TEXT,
  z_end TEXT,
  if100g REAL DEFAULT 0,
  if400g REAL DEFAULT 0,
  stage TEXT DEFAULT 'Prospect',    -- Prospect / Negotiation / Signed / Active
  priority TEXT DEFAULT 'Medium',
  target_date TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no TEXT,
  customer TEXT,
  contract_type TEXT,               -- Lease / IRU
  segment_s TEXT,
  segment_l TEXT,
  a_end TEXT,
  z_end TEXT,
  if100g REAL DEFAULT 0,
  if400g REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  mrc REAL DEFAULT 0,
  otc REAL DEFAULT 0,
  om_annual REAL DEFAULT 0,
  contract_year INTEGER,
  duration_months INTEGER DEFAULT 0,
  start_date TEXT,
  status TEXT DEFAULT 'Active',     -- Active / Expired / Terminated
  cc_flag TEXT,
  am TEXT
);

CREATE TABLE IF NOT EXISTS internal_demand_s (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dls_code TEXT,
  segment_label TEXT,
  h1 REAL DEFAULT 0,
  h2 REAL DEFAULT 0,
  h3 REAL DEFAULT 0,
  h4 REAL DEFAULT 0,
  h5 REAL DEFAULT 0,
  h6 REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS internal_demand_l (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pop TEXT,
  segment_label TEXT,
  h1 REAL DEFAULT 0,
  h2 REAL DEFAULT 0,
  h3 REAL DEFAULT 0,
  h4 REAL DEFAULT 0,
  h5 REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  message TEXT NOT NULL
);
`);

export const isFreshDatabase = isNew;

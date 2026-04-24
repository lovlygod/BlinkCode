import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPackaged = __dirname.includes('app.asar');
const userDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'BlinkCode');
const storageDir = isPackaged ? userDataDir : __dirname;
const DB_PATH = path.join(storageDir, 'blinkcode.db');
const LEGACY_STATE_PATH = path.join(storageDir, 'blinkcode-state.json');

fs.mkdirSync(storageDir, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS editor_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_projects (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  opened_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS command_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS file_cursor_positions (
  path TEXT PRIMARY KEY,
  line INTEGER NOT NULL,
  column INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

function columnExists(table, col) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === col);
}

function migrateSchema() {
  if (!columnExists('editor_state', 'updated_at')) {
    db.exec('ALTER TABLE editor_state ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnExists('settings', 'updated_at')) {
    db.exec('ALTER TABLE settings ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnExists('file_cursor_positions', 'updated_at')) {
    db.exec('ALTER TABLE file_cursor_positions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0');
  }
}

migrateSchema();

const schemaCount = db.prepare('SELECT COUNT(*) AS count FROM schema_version').get().count;
if (schemaCount === 0) {
  db.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
}

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, Date.now());
}

function migrateFromLegacyJsonIfNeeded() {
  const row = db.prepare('SELECT data FROM editor_state WHERE id = 1').get();
  const hasState = Boolean(row);
  const hasWorkspace = Boolean(getSetting('workspacePath', ''));
  const hasRecent = db.prepare('SELECT COUNT(*) AS count FROM recent_projects').get().count > 0;

  if (hasState || hasWorkspace || hasRecent) return;
  if (!fs.existsSync(LEGACY_STATE_PATH)) return;

  try {
    const parsed = JSON.parse(fs.readFileSync(LEGACY_STATE_PATH, 'utf-8'));
    const editorState = parsed?.editorState ?? {};
    const workspacePath = parsed?.workspacePath ?? '';
    const recentProjects = Array.isArray(parsed?.recentProjects) ? parsed.recentProjects : [];

    const tx = db.transaction(() => {
      db.prepare('INSERT OR REPLACE INTO editor_state (id, data, updated_at) VALUES (1, ?, ?)')
        .run(JSON.stringify(editorState), Date.now());

      if (workspacePath) {
        setSetting('workspacePath', workspacePath);
      }

      const insertRecent = db.prepare(`
        INSERT INTO recent_projects (path, name, opened_at)
        VALUES (?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          opened_at = excluded.opened_at
      `);

      recentProjects.slice(0, 5).forEach((project, index) => {
        if (!project?.path) return;
        insertRecent.run(
          project.path,
          project.name || path.basename(project.path) || project.path,
          Date.now() - index,
        );
      });
    });

    tx();
  } catch {
    // ignore malformed legacy state
  }
}

migrateFromLegacyJsonIfNeeded();

export function saveState(data) {
  db.prepare('INSERT OR REPLACE INTO editor_state (id, data, updated_at) VALUES (1, ?, ?)')
    .run(JSON.stringify(data ?? {}), Date.now());
}

export function loadState() {
  try {
    const row = db.prepare('SELECT data FROM editor_state WHERE id = 1').get();
    if (!row?.data) return {};
    return JSON.parse(row.data);
  } catch {
    return {};
  }
}

export function saveWorkspacePath(p) {
  setSetting('workspacePath', p || '');
}

export function loadWorkspacePath() {
  return getSetting('workspacePath', '');
}

export function addRecentProject(projectPath, name) {
  if (!projectPath) return;

  const now = Date.now();

  db.prepare(`
    INSERT INTO recent_projects (path, name, opened_at)
    VALUES (?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      opened_at = excluded.opened_at
  `).run(projectPath, name || path.basename(projectPath) || projectPath, now);

  db.prepare(`
    DELETE FROM recent_projects
    WHERE path NOT IN (
      SELECT path FROM recent_projects
      ORDER BY opened_at DESC
      LIMIT 5
    )
  `).run();
}

export function loadRecentProjects() {
  return db.prepare(`
    SELECT path, name
    FROM recent_projects
    ORDER BY opened_at DESC
    LIMIT 5
  `).all();
}

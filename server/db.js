import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isPackaged = __dirname.includes('app.asar');
const userDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'BlinkCode');
const storageDir = isPackaged ? userDataDir : __dirname;
const DB_PATH = path.join(storageDir, 'blinkcode-state.json');

function ensureStore() {
  fs.mkdirSync(storageDir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      editorState: {},
      workspacePath: '',
      recentProjects: [],
    }, null, 2), 'utf-8');
  }
}

function readStore() {
  ensureStore();

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    return {
      editorState: parsed?.editorState ?? {},
      workspacePath: parsed?.workspacePath ?? '',
      recentProjects: Array.isArray(parsed?.recentProjects) ? parsed.recentProjects : [],
    };
  } catch {
    return {
      editorState: {},
      workspacePath: '',
      recentProjects: [],
    };
  }
}

function writeStore(nextState) {
  fs.writeFileSync(DB_PATH, JSON.stringify(nextState, null, 2), 'utf-8');
}

export function saveState(data) {
  const store = readStore();
  writeStore({
    ...store,
    editorState: data ?? {},
  });
}

export function loadState() {
  return readStore().editorState;
}

export function saveWorkspacePath(p) {
  const store = readStore();
  writeStore({
    ...store,
    workspacePath: p || '',
  });
}

export function loadWorkspacePath() {
  return readStore().workspacePath || '';
}

export function addRecentProject(projectPath, name) {
  if (!projectPath) return;

  const store = readStore();
  const next = [
    { path: projectPath, name: name || path.basename(projectPath) || projectPath },
    ...store.recentProjects.filter(item => item?.path && item.path !== projectPath),
  ].slice(0, 5);

  writeStore({
    ...store,
    recentProjects: next,
  });
}

export function loadRecentProjects() {
  return readStore().recentProjects || [];
}

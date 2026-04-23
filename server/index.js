import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import chokidar from 'chokidar';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { saveState, loadState, saveWorkspacePath, loadWorkspacePath, addRecentProject, loadRecentProjects } from './db.js';
import { createPtyManager } from './pty.js';
import { attachLspBridge, parseLspUrl } from './lsp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json({ limit: '50mb' }));

const isPackaged = __dirname.includes('app.asar');
const userDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'BlinkCode');
const storageRoot = isPackaged ? userDataDir : path.join(__dirname, '..');

let workspace = path.join(storageRoot, 'workspace');

if (!fs.existsSync(workspace)) {
  fs.mkdirSync(workspace, { recursive: true });
}

const savedWorkspace = loadWorkspacePath();
if (savedWorkspace && fs.existsSync(savedWorkspace)) {
  try {
    const stat = fs.statSync(savedWorkspace);
    if (stat.isDirectory()) workspace = path.resolve(savedWorkspace);
  } catch {}
}

function safePath(p) {
  const resolved = path.resolve(workspace, p);
  if (!resolved.startsWith(path.resolve(workspace))) return null;
  return resolved;
}

function readTree(dir, depth = 0) {
  if (depth > 10) return [];
  const items = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });
  for (const entry of entries) {
    if (
      entry.name.startsWith('.') &&
      entry.name !== '.gitignore' &&
      entry.name !== '.gitmodules' &&
      entry.name !== '.dockerignore' &&
      !entry.name.startsWith('.env')
    ) continue;
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.cache') continue;
    const fullPath = path.join(dir, entry.name);
    const rel = path.relative(workspace, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      items.push({ name: entry.name, type: 'folder', path: rel, children: readTree(fullPath, depth + 1) });
    } else {
      items.push({ name: entry.name, type: 'file', path: rel });
    }
  }
  return items;
}

app.get('/api/tree', (req, res) => {
  res.json({ tree: readTree(workspace), workspace: path.basename(workspace) });
});

app.post('/api/upload-folder', (req, res) => {
  const { name, files, targetDir } = req.body;

  if (targetDir && fs.existsSync(targetDir)) {
    try {
      const stat = fs.statSync(targetDir);
      if (stat.isDirectory()) {
        workspace = path.resolve(targetDir);
        saveWorkspacePath(workspace);
        addRecentProject(workspace, path.basename(workspace));
        startFsWatcher();
        res.json({ tree: readTree(workspace), workspace: path.basename(workspace) });
        return;
      }
    } catch {}
  }

  if (!files || !Array.isArray(files)) return res.status(400).json({ error: 'No files' });

  if (fs.existsSync(workspace)) {
    for (const item of fs.readdirSync(workspace)) {
      fs.rmSync(path.join(workspace, item), { recursive: true, force: true });
    }
  }

  for (const file of files) {
    const p = safePath(file.path);
    if (!p) continue;
    if (file.type === 'folder') {
      fs.mkdirSync(p, { recursive: true });
    } else {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (typeof file.content === 'string' && file.content.startsWith('base64:')) {
        const b64 = file.content.slice(7);
        fs.writeFileSync(p, Buffer.from(b64, 'base64'));
      } else {
        fs.writeFileSync(p, file.content || '', 'utf-8');
      }
    }
  }

  startFsWatcher();
  res.json({ tree: readTree(workspace), workspace: name || path.basename(workspace) });
});

app.post('/api/open-folder', (req, res) => {
  const { dirPath } = req.body;
  if (!dirPath || !fs.existsSync(dirPath)) return res.status(400).json({ error: 'Directory not found' });
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });
  } catch { return res.status(400).json({ error: 'Cannot access directory' }); }
  workspace = path.resolve(dirPath);
  saveWorkspacePath(workspace);
  addRecentProject(workspace, path.basename(workspace));
  startFsWatcher();
  res.json({ tree: readTree(workspace), workspace: path.basename(workspace) });
});

app.get('/api/recent-projects', (req, res) => {
  res.json({ projects: loadRecentProjects() });
});

app.get('/api/git-branch', (req, res) => {
  if (!workspace) return res.json({ branch: null });
  const gitDir = path.join(workspace, '.git');
  if (!fs.existsSync(gitDir)) return res.json({ branch: null });
  execFile('git', ['branch', '--show-current'], { cwd: workspace }, (err, stdout) => {
    if (err) return res.json({ branch: null });
    const branch = stdout.trim();
    res.json({ branch: branch || null });
  });
});

app.get('/api/files', (req, res) => {
  if (!workspace) return res.json({ files: [] });
  const files = [];
  const IGNORES = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.turbo', '.svelte-kit', 'coverage', 'out']);
  const walk = (dir, prefix) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (IGNORES.has(entry.name)) continue;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), rel);
        } else {
          files.push(rel);
        }
      }
    } catch {}
  };
  walk(workspace, '');
  res.json({ files });
});

app.get('/api/file', (req, res) => {
  const p = safePath(req.query.path);
  if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'File not found' });
  try {
    const buf = fs.readFileSync(p);
    const isBinary = (buf.length > 0 && buf.some(b => b < 8 && b !== 0x09 && b !== 0x0A && b !== 0x0D));
    if (isBinary) {
      res.json({ content: 'base64:' + buf.toString('base64'), binary: true });
    } else {
      res.json({ content: buf.toString('utf-8'), binary: false });
    }
  } catch { res.status(500).json({ error: 'Cannot read file' }); }
});

app.get('/api/raw', (req, res) => {
  const rawPath = req.query.path;
  const p = safePath(rawPath);
  if (!p || !fs.existsSync(p)) return res.status(404).send('Not found');
  try {
    const ext = path.extname(p).toLowerCase().slice(1);
    const mimeMap = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
      mp4: 'video/mp4', webm: 'video/webm',
      pdf: 'application/pdf',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    fs.createReadStream(p).pipe(res);
  } catch { res.status(500).send('Cannot read file'); }
});

app.put('/api/file', (req, res) => {
  const { filePath, content } = req.body;
  const p = safePath(filePath);
  if (!p) return res.status(400).json({ error: 'Invalid path' });
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(p, content || '', 'utf-8');
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Cannot write file' }); }
});

app.post('/api/create', (req, res) => {
  const { filePath, type } = req.body;
  console.log('[create]', filePath, type, '| workspace:', workspace);
  const p = safePath(filePath);
  if (!p) { console.log('[create] INVALID PATH:', filePath); return res.status(400).json({ error: 'Invalid path' }); }
  if (fs.existsSync(p)) { console.log('[create] ALREADY EXISTS:', p); return res.status(409).json({ error: 'Already exists' }); }
  try {
    if (type === 'folder') { fs.mkdirSync(p, { recursive: true }); }
    else { const dir = path.dirname(p); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(p, '', 'utf-8'); }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Cannot create' }); }
});

app.delete('/api/delete', (req, res) => {
  const p = safePath(req.query.path);
  if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
  try {
    fs.rmSync(p, { recursive: true, force: true });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Cannot delete' }); }
});

app.post('/api/rename', (req, res) => {
  const { oldPath, newName } = req.body;
  const p = safePath(oldPath);
  if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
  const newPath = path.join(path.dirname(p), newName);
  const np = safePath(path.relative(workspace, newPath));
  if (!np) return res.status(400).json({ error: 'Invalid name' });
  if (fs.existsSync(np)) return res.status(409).json({ error: 'Already exists' });
  try {
    fs.renameSync(p, np);
    res.json({ ok: true, newPath: path.relative(workspace, np).replace(/\\/g, '/') });
  } catch { res.status(500).json({ error: 'Cannot rename' }); }
});

app.post('/api/run', (req, res) => {
  const { filePath } = req.body;
  const p = safePath(filePath);
  if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'File not found' });

  const ext = path.extname(p);
  let cmd, args;
  if (ext === '.py') { cmd = 'python'; args = [p]; }
  else if (ext === '.sh' || ext === '.bash') { cmd = 'bash'; args = [p]; }
  else { cmd = 'node'; args = [p]; }

  execFile(cmd, args, { timeout: 10000, cwd: path.dirname(p), maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    res.json({
      output: stdout || '',
      error: stderr || '',
      exitCode: err ? (err.code || 1) : 0,
      timedOut: err && err.killed,
    });
  });
});

app.post('/api/move', (req, res) => {
  const { sourcePath, targetPath, position } = req.body;
  const src = safePath(sourcePath);
  if (!src || !fs.existsSync(src)) return res.status(404).json({ error: 'Source not found' });

  const name = path.basename(src);
  let dest;

  if (position === 'inside' && targetPath) {
    const tp = safePath(targetPath);
    if (!tp) return res.status(400).json({ error: 'Invalid target' });
    dest = path.join(tp, name);
  } else if (targetPath) {
    const tp = safePath(targetPath);
    if (!tp) return res.status(400).json({ error: 'Invalid target' });
    if (position === 'before') dest = path.join(path.dirname(tp), name);
    else dest = path.join(path.dirname(tp), name);
  } else {
    dest = path.join(workspace, name);
  }

  const dp = safePath(path.relative(workspace, dest));
  if (!dp) return res.status(400).json({ error: 'Invalid destination' });
  if (fs.existsSync(dp) && src !== dp) return res.status(409).json({ error: 'Destination exists' });

  try {
    fs.renameSync(src, dp);
    res.json({ ok: true, newPath: path.relative(workspace, dp).replace(/\\/g, '/') });
  } catch { res.status(500).json({ error: 'Cannot move' }); }
});

app.get('/api/state', (req, res) => {
  res.json(loadState());
});

app.put('/api/state', (req, res) => {
  saveState(req.body);
  res.json({ ok: true });
});

app.post('/api/close-workspace', (req, res) => {
  workspace = path.join(__dirname, '..', 'workspace');
  if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });
  saveWorkspacePath('');
  stopFsWatcher();
  res.json({ ok: true });
});

const server = createServer(app);

// ---- WebSocket routing (terminal + fs watcher) ----

const wss = new WebSocketServer({ noServer: true });
const fsWss = new WebSocketServer({ noServer: true });
const lspWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/terminal') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (request.url === '/ws/fs') {
    fsWss.handleUpgrade(request, socket, head, (ws) => {
      fsWss.emit('connection', ws, request);
    });
  } else if (request.url && request.url.startsWith('/ws/lsp/')) {
    const parsed = parseLspUrl(request.url);
    if (!parsed) { socket.destroy(); return; }
    lspWss.handleUpgrade(request, socket, head, (ws) => {
      attachLspBridge(ws, parsed.lang, workspace);
    });
  } else {
    socket.destroy();
  }
});

lspWss.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') return;
  console.error('LSP WebSocket error:', error);
});

wss.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.warn(`BlinkCode terminal WebSocket is already bound on port ${process.env.PORT || 3001}`);
    return;
  }

  console.error('Terminal WebSocket error:', error);
});

fsWss.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') return;
  console.error('FS watcher WebSocket error:', error);
});

// ---- File system watcher ----

const IGNORED_DIR_NAMES = new Set([
  'node_modules', 'dist', 'build', 'coverage',
  '.git', '.cache', '.next', '.nuxt', '.svelte-kit',
  '.turbo', '.output', '.parcel-cache', '.vite', '.idea',
]);

function shouldIgnoreFsPath(absPath) {
  if (!absPath) return false;
  const name = path.basename(absPath);
  if (IGNORED_DIR_NAMES.has(name)) return true;
  if (
    name.startsWith('.') &&
    name !== '.gitignore' &&
    name !== '.gitmodules' &&
    name !== '.dockerignore' &&
    !name.startsWith('.env')
  ) return true;
  return false;
}

function broadcastFsEvent(payload) {
  const msg = JSON.stringify(payload);
  for (const client of fsWss.clients) {
    if (client.readyState === 1) {
      try { client.send(msg); } catch {}
    }
  }
}

let fsWatcher = null;
let fsWatcherRoot = null;

function stopFsWatcher() {
  if (!fsWatcher) return;
  try { fsWatcher.close(); } catch {}
  fsWatcher = null;
  fsWatcherRoot = null;
}

function startFsWatcher() {
  stopFsWatcher();
  const root = path.resolve(workspace);
  fsWatcherRoot = root;

  fsWatcher = chokidar.watch(root, {
    ignored: (p) => p !== root && shouldIgnoreFsPath(p),
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 40, pollInterval: 15 },
    depth: 20,
    followSymlinks: false,
    ignorePermissionErrors: true,
  });

  const relOf = (abs) => {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    return rel;
  };

  const emit = (type, abs, isDir) => {
    const rel = relOf(abs);
    if (!rel || rel.startsWith('..')) return;
    broadcastFsEvent({
      type,
      path: rel,
      name: path.basename(abs),
      isDir,
    });
  };

  fsWatcher.on('add', (p) => emit('add', p, false));
  fsWatcher.on('addDir', (p) => {
    if (path.resolve(p) === root) return;
    emit('addDir', p, true);
  });
  fsWatcher.on('unlink', (p) => emit('unlink', p, false));
  fsWatcher.on('unlinkDir', (p) => emit('unlinkDir', p, true));
  fsWatcher.on('change', (p) => emit('change', p, false));
  fsWatcher.on('error', (err) => console.warn('[fs watcher]', err?.message || err));
}

fsWss.on('connection', (ws) => {
  try {
    ws.send(JSON.stringify({ type: 'hello', workspace: path.basename(workspace) }));
  } catch {}
});

const ptyManager = createPtyManager({ getDefaultCwd: () => workspace });

function getShellCwd(shellId) {
  const s = ptyManager.get(shellId);
  return s ? s.cwd : workspace;
}

function resolveShellCwd(requestedCwd) {
  if (!requestedCwd || typeof requestedCwd !== 'string') return workspace;
  const normalized = path.resolve(requestedCwd);
  try {
    const stat = fs.statSync(normalized);
    if (stat.isDirectory()) return normalized;
  } catch {}
  return workspace;
}

wss.on('connection', (ws) => {
  const shellId = Math.random().toString(36).slice(2);
  let disconnect = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === 'start') {
      const session = ptyManager.create({
        id: shellId,
        cwd: resolveShellCwd(msg.cwd),
        cols: Number(msg.cols || 120),
        rows: Number(msg.rows || 30),
      });
      disconnect = ptyManager.connect(shellId, ws, msg.cursor);
      ws.send(JSON.stringify({ type: 'ready', cwd: session.cwd }));
    }

    if (msg.type === 'input') {
      ptyManager.write(shellId, ptyManager.decodeIncoming(msg.data));
    }

    if (msg.type === 'cwd') {
      const cwd = getShellCwd(shellId);
      ws.send(JSON.stringify({ type: 'ready', cwd }));
    }

    if (msg.type === 'resize') {
      ptyManager.resize(shellId, Number(msg.cols || 120), Number(msg.rows || 30));
    }

    if (msg.type === 'kill') {
      ptyManager.close(shellId);
    }

    if (msg.type === 'restart') {
      ptyManager.close(shellId);
      const session = ptyManager.create({
        id: shellId,
        cwd: resolveShellCwd(msg.cwd),
        cols: Number(msg.cols || 120),
        rows: Number(msg.rows || 30),
      });
      disconnect = ptyManager.connect(shellId, ws, msg.cursor);
      ws.send(JSON.stringify({ type: 'ready', cwd: session.cwd }));
    }
  });

  ws.on('close', () => {
    disconnect?.();
    ptyManager.close(shellId);
  });
});

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('/{*splat}', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  }
});

let startedServer = null;

export function startBlinkCodeServer(port = process.env.PORT || 3001) {
  if (startedServer) return startedServer;

  startedServer = new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('error', onError);

      if (error?.code === 'EADDRINUSE') {
        console.warn(`BlinkCode server is already running on http://localhost:${port}`);
        resolve(server);
        return;
      }

      reject(error);
    };

    server.once('error', onError);
    server.listen(port, () => {
      server.off('error', onError);
      console.log(`BlinkCode server running on http://localhost:${port}`);
      startFsWatcher();
      resolve(server);
    });
  });

  return startedServer;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startBlinkCodeServer().then(() => startFsWatcher()).catch(() => {});
}

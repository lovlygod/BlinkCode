import path from 'path';
import fs from 'fs';
import { TextDecoder } from 'util';
// @ts-expect-error runtime package narrowed by electron-vite in desktop builds
import * as pty from '@lydell/node-pty';

const BUFFER_LIMIT = 200_000;
const BUFFER_CHUNK = 16_384;

export function createPtyManager({ getDefaultCwd }) {
  const sessions = new Map();

  function resolveCwd(input) {
    const fallback = path.resolve(getDefaultCwd());
    if (!input || typeof input !== 'string') return fallback;

    const resolved = path.resolve(input);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) return resolved;
    } catch {}

    return fallback;
  }

  function get(id) {
    return sessions.get(id) || null;
  }

  function create({ id, cwd, cols = 120, rows = 30, title }) {
    const existing = sessions.get(id);
    if (existing) {
      try { existing.process.kill(); } catch {}
      sessions.delete(id);
    }

    const resolvedCwd = resolveCwd(cwd);
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : '/bin/bash';
    const args = isWin ? ['-NoLogo'] : ['-i'];
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
      BLINKCODE_TERMINAL: '1',
    };

    if (isWin) {
      env.LC_ALL = 'C.UTF-8';
      env.LC_CTYPE = 'C.UTF-8';
      env.LANG = 'C.UTF-8';
    }

    const processHandle = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: resolvedCwd,
      env,
    });

    const session = {
      id,
      title: title || `Terminal ${id.slice(-4)}`,
      cwd: resolvedCwd,
      cursor: 0,
      buffer: '',
      bufferCursor: 0,
      process: processHandle,
      subscribers: new Map(),
    };

    processHandle.onData((chunk) => {
      session.cursor += chunk.length;
      session.buffer += chunk;
      if (session.buffer.length > BUFFER_LIMIT) {
        const excess = session.buffer.length - BUFFER_LIMIT;
        session.buffer = session.buffer.slice(excess);
        session.bufferCursor += excess;
      }

      for (const [key, ws] of session.subscribers.entries()) {
        if (ws.readyState !== 1) {
          session.subscribers.delete(key);
          continue;
        }
        try {
          ws.send(JSON.stringify({ type: 'output', data: chunk }));
        } catch {
          session.subscribers.delete(key);
        }
      }
    });

    processHandle.onExit(({ exitCode }) => {
      for (const [, ws] of session.subscribers.entries()) {
        if (ws.readyState === 1) {
          try { ws.send(JSON.stringify({ type: 'exit', code: exitCode })); } catch {}
        }
      }
      sessions.delete(id);
    });

    sessions.set(id, session);
    return session;
  }

  function resize(id, cols, rows) {
    const session = sessions.get(id);
    if (!session) return;
    session.process.resize(cols, rows);
  }

  function write(id, data) {
    const session = sessions.get(id);
    if (!session) return;
    session.process.write(data);
  }

  function connect(id, ws, cursor) {
    const session = sessions.get(id);
    if (!session) {
      ws.close();
      return;
    }

    const key = Math.random().toString(36).slice(2);
    session.subscribers.set(key, ws);

    const start = session.bufferCursor;
    const end = session.cursor;
    const from = cursor === -1
      ? end
      : typeof cursor === 'number' && Number.isSafeInteger(cursor)
        ? Math.max(0, cursor)
        : 0;
    const offset = Math.max(0, from - start);
    const initial = offset >= session.buffer.length ? '' : session.buffer.slice(offset);
    if (initial) {
      for (let i = 0; i < initial.length; i += BUFFER_CHUNK) {
        ws.send(JSON.stringify({ type: 'output', data: initial.slice(i, i + BUFFER_CHUNK) }));
      }
    }
    ws.send(JSON.stringify({ type: 'ready', cwd: session.cwd }));

    return () => {
      session.subscribers.delete(key);
    };
  }

  function close(id) {
    const session = sessions.get(id);
    if (!session) return;
    try { session.process.kill(); } catch {}
    sessions.delete(id);
  }

  function closeAll() {
    for (const id of sessions.keys()) close(id);
  }

  function decodeIncoming(message) {
    if (typeof message === 'string') return message;
    return new TextDecoder().decode(message);
  }

  return { get, create, resize, write, connect, close, closeAll, decodeIncoming };
}

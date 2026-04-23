import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveNodeModule(relPath) {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', relPath),
    path.join(process.cwd(), 'node_modules', relPath),
  ];
  const asarUnpacked = __dirname.replace(/app\.asar(?:[\\/]|$)/, 'app.asar.unpacked' + path.sep);
  if (asarUnpacked !== __dirname) {
    candidates.push(path.join(asarUnpacked, '..', 'node_modules', relPath));
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', relPath));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Configuration for supported language servers.
 * Keyed by the URL segment used on the frontend (e.g. /ws/lsp/typescript).
 *
 * We launch each LSP by invoking its JS entry point directly via `node`
 * (process.execPath). This avoids Windows `.cmd` shim issues (spawn EINVAL).
 */
export function getLspServers() {
  const vscodeLs = (subdir, main) => () => {
    const entry = resolveNodeModule(`vscode-langservers-extracted/lib/${subdir}/${main}`);
    return entry ? [entry, '--stdio'] : null;
  };
  return {
    typescript: {
      resolveCmd: () => process.execPath,
      resolveArgs: () => {
        const entry = resolveNodeModule('typescript-language-server/lib/cli.mjs');
        return entry ? [entry, '--stdio'] : null;
      },
      extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    },
    html: {
      resolveCmd: () => process.execPath,
      resolveArgs: vscodeLs('html-language-server/node', 'htmlServerMain.js'),
      extensions: ['html', 'htm'],
    },
    css: {
      resolveCmd: () => process.execPath,
      resolveArgs: vscodeLs('css-language-server/node', 'cssServerMain.js'),
      extensions: ['css', 'scss', 'less'],
    },
    json: {
      resolveCmd: () => process.execPath,
      resolveArgs: vscodeLs('json-language-server/node', 'jsonServerMain.js'),
      extensions: ['json', 'jsonc'],
    },
  };
}

/**
 * Spawns the configured LSP server and wires it to the given WebSocket.
 * Messages flow both ways: JSON text on the WS ↔ Content-Length framed JSON on stdio.
 * The child is killed when the WS closes.
 */
export function attachLspBridge(ws, langId, cwd) {
  const servers = getLspServers();
  const cfg = servers[langId];
  if (!cfg) {
    try { ws.close(1008, `Unknown language server: ${langId}`); } catch {}
    return;
  }

  const cmd = cfg.resolveCmd ? cfg.resolveCmd() : cfg.cmd;
  const args = cfg.resolveArgs ? cfg.resolveArgs() : cfg.args;
  if (!cmd || !args) {
    try { ws.close(1011, 'LSP binary missing'); } catch {}
    return;
  }

  let child;
  try {
    child = spawn(cmd, args, {
      cwd: cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
  } catch {
    try { ws.close(1011, 'LSP spawn failed'); } catch {}
    return;
  }

  let stdoutBuffer = Buffer.alloc(0);

  child.stdout.on('data', (chunk) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    while (true) {
      const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = stdoutBuffer.slice(0, headerEnd).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        stdoutBuffer = stdoutBuffer.slice(headerEnd + 4);
        continue;
      }
      const len = parseInt(match[1], 10);
      const start = headerEnd + 4;
      const end = start + len;
      if (stdoutBuffer.length < end) break;
      const body = stdoutBuffer.slice(start, end).toString('utf-8');
      stdoutBuffer = stdoutBuffer.slice(end);
      if (ws.readyState === 1) {
        try { ws.send(body); } catch {}
      }
    }
  });

  child.stderr.on('data', () => {});

  child.on('exit', () => {
    try { ws.close(1011, 'LSP exited'); } catch {}
  });

  child.on('error', () => {
    try { ws.close(1011, 'LSP error'); } catch {}
  });

  ws.on('message', (data) => {
    let text;
    if (typeof data === 'string') text = data;
    else if (Buffer.isBuffer(data)) text = data.toString('utf-8');
    else text = String(data);

    const body = Buffer.from(text, 'utf-8');
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii');
    try {
      child.stdin.write(header);
      child.stdin.write(body);
    } catch {}
  });

  ws.on('close', () => {
    try { child.kill(); } catch {}
  });

  ws.on('error', () => {
    try { child.kill(); } catch {}
  });
}

export function parseLspUrl(url) {
  if (!url) return null;
  const parts = url.split('?')[0].split('/').filter(Boolean);
  if (parts.length < 3 || parts[0] !== 'ws' || parts[1] !== 'lsp') return null;
  return { lang: parts[2] };
}

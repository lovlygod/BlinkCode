# Development

<p>
  <a href="./README.md">↑ Docs home (EN)</a>
  &nbsp;·&nbsp;
  <a href="../RU/development.md">🇷🇺 На русском</a>
  &nbsp;·&nbsp;
  <a href="./building.md">→ Building & packaging</a>
</p>

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install](#install)
3. [Run in the browser](#run-in-the-browser)
4. [Run in Electron](#run-in-electron)
5. [Useful scripts](#useful-scripts)
6. [Project layout](#project-layout)
7. [Debugging](#debugging)
8. [Contributing](#contributing)

---

## Prerequisites

- **Node.js** 20.x or later (22.x recommended)
- **npm** 10.x
- **Windows 10 / 11** for desktop builds (other platforms work for dev but are not packaged yet)
- Git

## Install

```bash
git clone https://github.com/lovlygod/BlinkCode.git
cd BlinkCode
npm install
```

If you hit a peer-dep conflict during installation, retry with:

```bash
npm install --legacy-peer-deps
```

## Run in the browser

```bash
npm run dev
```

- Vite dev server: http://127.0.0.1:5173
- Backend server: http://localhost:3001 (PTY and LSP WebSockets)

This is useful for quick UI iteration. Features that depend on Electron APIs
(file dialogs, window controls) will not work in pure browser mode.

## Run in Electron

```bash
npm run electron:dev
```

This runs three processes concurrently:

1. Backend (`server/index.js`)
2. Vite dev server
3. Electron, waiting for Vite on `:5173`

DevTools open automatically in dev mode. Press `F12` or `Ctrl+Shift+I` to
toggle them at any time.

## Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start backend + Vite (browser mode) |
| `npm run server` | Backend only |
| `npm run electron:dev` | Full desktop dev loop |
| `npm run build` | `tsc -b` + production Vite build into `dist/` |
| `npm run lint` *(if present)* | ESLint |
| `npm run dist:win` | Full Windows build — see [building.md](./building.md) |
| `npm run dist:win:setup` | Windows installer only |
| `npm run dist:win:portable` | Windows portable only |

## Project layout

See [architecture.md](./architecture.md) for the full tree. Short version:

- `electron/` — main / preload
- `server/` — backend (HTTP, PTY, LSP bridge, persistence)
- `src/` — React renderer
- `src/lsp/` — LSP WebSocket client + Monaco adapter
- `src/components/` — UI
- `docs/` — this documentation

## Debugging

- **Renderer**: DevTools console, plus `F12` for Monaco's own debugging
  shortcuts inside the editor area.
- **Main process**: run Electron with `--inspect` (add to `electron:dev`
  command if needed).
- **Backend**: `node --inspect server/index.js` or add a `breakpoint` via VS
  Code's Node debugger pointed at `server/index.js`.
- **LSP**: if something feels wrong, enable ad-hoc `console.log` statements
  inside [`src/lsp/client.ts`](../../src/lsp/client.ts) and
  [`server/lsp.js`](../../server/lsp.js) — they are intentionally quiet by
  default.

## Contributing

See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) at the project root.

---

<p align="right"><a href="#table-of-contents">↑ Back to top</a> · <a href="../README.md">↑ Docs home</a></p>

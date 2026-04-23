# Architecture

<p>
  <a href="../README.md">↑ Docs home</a>
  &nbsp;·&nbsp;
  <a href="../RU/architecture.md">🇷🇺 На русском</a>
  &nbsp;·&nbsp;
  <a href="./lsp.md">→ LSP deep dive</a>
</p>

---

## Table of Contents

1. [High-level picture](#high-level-picture)
2. [Processes](#processes)
3. [Frontend layers](#frontend-layers)
4. [Backend layers](#backend-layers)
5. [IPC & transports](#ipc--transports)
6. [State & persistence](#state--persistence)
7. [Source tree](#source-tree)

---

## High-level picture

BlinkCode is an Electron app with three moving parts:

```mermaid
flowchart LR
    subgraph Electron["Electron main process<br/>(electron/main.mjs)"]
        direction TB
        M[windows · menus · titlebar<br/>file-system dialogs]
    end

    subgraph Backend["Local Node backend<br/>(server/index.js)"]
        direction TB
        B[HTTP + WebSocket on :3001<br/>PTY manager · LSP bridge]
    end

    subgraph Renderer["Renderer (React + Vite)<br/>src/App.tsx"]
        direction TB
        R[Monaco · Terminal (xterm)<br/>Sidebar · Tabs · AI<br/>LSP client (src/lsp/)]
    end

    Electron <-- IPC --> Backend
    Electron -- loads --> Renderer
    Renderer <-- WS + HTTP --> Backend
```

In development the renderer is served by Vite (port `5173`), in production it
is loaded from the bundled `dist/` via a `file://` URL.

## Processes

- **Electron main** ([`electron/main.mjs`](../../electron/main.mjs)) creates the
  window, manages the custom titlebar, and spawns the local backend when the
  app is packaged. It also registers DevTools hotkeys (`F12`, `Ctrl+Shift+I`)
  and auto-opens DevTools in dev.
- **Preload** ([`electron/preload.cjs`](../../electron/preload.cjs)) exposes a
  minimal, typed API to the renderer through `contextBridge`.
- **Backend** ([`server/index.js`](../../server/index.js)) is a small Express +
  `ws` server that handles terminal PTYs and LSP WebSocket bridges.
- **Renderer** is the React app rendered in the Electron window.

## Frontend layers

```
src/
├── App.tsx               — top-level layout
├── store/EditorContext   — global editor state (tabs, settings, workspace)
├── components/
│   ├── CodeEditor        — Monaco wrapper + LSP attach
│   ├── Sidebar           — file tree
│   ├── TabsHeader        — open files
│   ├── Breadcrumb        — path crumbs
│   ├── ActivityBar       — left-side icon rail
│   ├── StatusBar         — bottom info bar
│   ├── CommandPalette    — Ctrl+Shift+P
│   ├── QuickOpen         — Ctrl+P
│   ├── Terminal          — xterm UI
│   ├── BrowserPreview    — embedded webview
│   ├── AIPanel           — AI chat
│   ├── SettingsPanel     — preferences
│   ├── Toast             — notifications
│   ├── TopHeader         — custom titlebar
│   ├── Landing           — onboarding
│   └── common/           — DotGrid, BlinkLogo, ColorPicker
├── hooks/                — custom React hooks (useShell, etc.)
├── lsp/                  — LSP client + Monaco adapter
├── utils/                — shared helpers (file support, paths, etc.)
└── types/                — shared TypeScript types
```

## Backend layers

```
server/
├── index.js   — HTTP + WebSocket server on :3001
├── pty.js     — PTY spawn/resize/write/close over WS /ws/pty
├── lsp.js     — child_process spawn + stdio framing over WS /ws/lsp/:lang
└── db.js      — local state persistence
```

## IPC & transports

| Transport | Used for |
|---|---|
| `contextBridge` (preload) | Renderer ↔ Electron main for file dialogs and window control |
| HTTP `:3001` | File-system API consumed by the file tree |
| WS `/ws/pty` | Interactive terminal sessions |
| WS `/ws/lsp/:lang` | LSP JSON-RPC bridge (one socket per language) |

All WS traffic uses plain text frames. LSP traffic follows the classic
`Content-Length:` + body protocol, serialized on both ends.

## State & persistence

- Runtime state lives in [`EditorContext`](../../src/store/EditorContext.tsx)
  (tabs, active file, cursor, settings, workspace).
- Long-term state is persisted by [`server/db.js`](../../server/db.js) to
  `server/blinkcode-state.json`.
- Legacy SQLite sidecar files (`blinkcode.db*`) are ignored by the editor as
  binary and can be removed safely — persistence uses JSON.

## Source tree

See [features.md](./features.md) for a description of what each component
does, and [lsp.md](./lsp.md) for a deep dive into the language-server layer.

---

<p align="right"><a href="#table-of-contents">↑ Back to top</a> · <a href="../README.md">↑ Docs home</a></p>

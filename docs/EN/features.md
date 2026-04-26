# Features

<p>
  <a href="../README.md">↑ Docs home</a>
  &nbsp;·&nbsp;
  <a href="../RU/features.md">🇷🇺 На русском</a>
  &nbsp;·&nbsp;
  <a href="../../README.md">Project README</a>
</p>

---

## Table of Contents

1. [Welcome & branding](#welcome--branding)
2. [Editor core](#editor-core)
3. [Language intelligence (LSP)](#language-intelligence-lsp)
4. [Navigation & productivity](#navigation--productivity)
5. [Terminal](#terminal)
6. [Browser preview](#browser-preview)
7. [AI assistant](#ai-assistant)
8. [Project workflow](#project-workflow)
9. [File handling](#file-handling)
10. [Appearance & settings](#appearance--settings)
11. [Desktop integration](#desktop-integration)
12. [Stability & safety](#stability--safety)
13. [Developer experience](#developer-experience)

See also: [keyboard shortcuts](./shortcuts.md), [architecture](./architecture.md), [LSP](./lsp.md).

---

## Welcome & branding

- Animated `Blink` welcome logo with a typewriter effect — see [`BlinkLogo.tsx`](../../src/components/common/BlinkLogo.tsx)
- Interactive dot-grid welcome background — [`DotGrid.tsx`](../../src/components/common/DotGrid.tsx)
- Configurable dot-grid color stored in [`EditorContext`](../../src/store/EditorContext.tsx)
- Themed custom color picker — [`ColorPicker.tsx`](../../src/components/common/ColorPicker.tsx) — instead of the OS color dialog
- Landing onboarding component — [`Landing/`](../../src/components/Landing)

## Editor core

- [`Monaco Editor`](../../src/components/CodeEditor/CodeEditor.tsx) as the editing surface
- Autosave + state restore across launches via [`EditorContext`](../../src/store/EditorContext.tsx)
- Tabs with dirty-state indicators — [`TabsHeader`](../../src/components/TabsHeader/TabsHeader.tsx)
- Breadcrumbs — [`Breadcrumb`](../../src/components/Breadcrumb/Breadcrumb.tsx)
- Bracket pair colorization and indent guides (configurable in the settings panel)
- Monaco's word-based suggestions are disabled in favor of real LSP completions
- Trim trailing whitespace / insert final newline (configurable)

## Language intelligence (LSP)

Real language servers are bridged into Monaco over WebSocket. Deep-dive in
[lsp.md](./lsp.md).

- **TypeScript / JavaScript / TSX / JSX** via `typescript-language-server`
- **HTML**, **CSS / SCSS / LESS**, **JSON / JSONC** via `vscode-langservers-extracted`
- Project-aware IntelliSense backed by workspace `tsconfig.json` / `jsconfig.json`
- **Auto-import** on completion — picking `useState` adds `import { useState } from 'react'`
- Hover with type signatures and documentation
- Go to definition (`F12`, `Ctrl+Click`)
- Signature help inside calls
- Rename symbol (`F2`) with cross-file edits
- Find all references (`Shift+F12`)
- Document outline / symbols (`Ctrl+Shift+O`)
- Format document (`Shift+Alt+F`) and format selection (`Ctrl+K Ctrl+F`)
- Code actions / quick fixes (`Ctrl+.`) — add missing import, organize imports, etc.
- Inline diagnostics (errors, warnings, hints)
- Problems panel with workspace-wide diagnostics grouped by file, severity badges, All / Errors / Warnings filters, and click-to-navigate to the exact location
- Monaco's bundled TS / JS / HTML / CSS / JSON services are disabled, so the real LSP is the single source of truth

Implementation files:
- [`server/lsp.js`](../../server/lsp.js) — WebSocket ↔ child-process bridge
- [`src/lsp/client.ts`](../../src/lsp/client.ts) — JSON-RPC WebSocket client
- [`src/lsp/monacoAdapter.ts`](../../src/lsp/monacoAdapter.ts) — Monaco providers
- [`src/lsp/session.ts`](../../src/lsp/session.ts) — session cache + URI resolver

## Navigation & productivity

- **Command Palette** (`Ctrl+Shift+P`) — [`CommandPalette`](../../src/components/CommandPalette/CommandPalette.tsx)
- **Quick Open** fuzzy file picker (`Ctrl+P`) — [`QuickOpen`](../../src/components/QuickOpen/QuickOpen.tsx)
- Go to line (`Ctrl+G`) via Monaco
- Multi-cursor and column selection via Monaco
- Status bar — [`StatusBar`](../../src/components/StatusBar/StatusBar.tsx) — cursor position, indentation mode, encoding, language, Git branch, and live error / warning counts with a Problems panel toggle
- Toast notifications — [`Toast`](../../src/components/Toast/Toast.tsx)

Problems UI implementation:
- [`ProblemsPanel`](../../src/components/ProblemsPanel/ProblemsPanel.tsx)
- [`StatusBar`](../../src/components/StatusBar/StatusBar.tsx)
- [`EditorContext`](../../src/store/EditorContext.tsx)

## Terminal

- `xterm`-based UI — [`Terminal`](../../src/components/Terminal/Terminal.tsx)
- Shell session transport hook — [`useShell`](../../src/hooks/useShell.ts)
- Backend PTY manager — [`server/pty.js`](../../server/pty.js)
- WebSocket lifecycle in [`server/index.js`](../../server/index.js)
- Terminal focus does not steal keys from the editor when the editor is focused
- URLs printed by the terminal (e.g. `http://localhost:5173`) can be opened inside BlinkCode preview instead of the OS browser

## Browser preview

- Embedded `<webview>`-based preview — [`BrowserPreview`](../../src/components/BrowserPreview/BrowserPreview.tsx)
- Opens local dev servers and terminal links inside the app

## AI assistant

- Integrated AI panel for chat-style prompts — [`AIPanel`](../../src/components/AIPanel/AIPanel.tsx)

## Project workflow

- Open local project folders
- File tree with rename / create / delete / drag-and-drop — [`Sidebar`](../../src/components/Sidebar/Sidebar.tsx)
- Recent projects in the empty explorer state
- Centralized file-support rules in [`supportedWebFiles.ts`](../../src/utils/supportedWebFiles.ts)

## File handling

- Supported files open in Monaco
- Unsupported text files can fall back to read-only mode
- Separate handling for binary / preview / generated / large files in [`CodeEditor`](../../src/components/CodeEditor/CodeEditor.tsx)
- Extended format support — `mdx`, `xml`, `ini`, `conf`, `graphql`, `ps1`, `csv`, and more (see [`supportedWebFiles.ts`](../../src/utils/supportedWebFiles.ts))
- SQLite sidecar files (`*.db-shm`, `*.db-wal`) are treated as binary

## Appearance & settings

- Language switching between English and Russian
- Multiple editor themes and color schemes
- Welcome-screen dot-grid color in [`SettingsPanel`](../../src/components/SettingsPanel/SettingsPanel.tsx)
- Custom themed color picker that opens upward inside the settings panel
- Compact mode, animations, file icons and other desktop UI preferences

## Desktop integration

- Custom Electron shell — [`electron/main.mjs`](../../electron/main.mjs)
- Custom titlebar and window controls — [`TopHeader`](../../src/components/TopHeader/TopHeader.tsx)
- Activity bar — [`ActivityBar`](../../src/components/ActivityBar/ActivityBar.tsx)
- Windows installer and portable packaging through `electron-builder` — see [building.md](./building.md)
- LSP binaries shipped via `asarUnpack`, so IntelliSense works in both dev and packaged builds

## Stability & safety

- Safer handling for binary and unsupported files
- Protection against accidental corruption when switching between unsupported and normal source files
- Terminal focus behavior improved so editor typing is not redirected into the terminal

## Developer experience

- DevTools open automatically in dev mode (`npm run electron:dev`)
- `F12` and `Ctrl+Shift+I` toggle DevTools
- Logs in production are kept quiet on purpose — see [development.md](./development.md)

---

<p align="right"><a href="#table-of-contents">↑ Back to top</a> · <a href="../README.md">↑ Docs home</a></p>

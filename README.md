# BlinkCode

Open source code editor for the browser.

No login. No install. Open the site and start coding. If security matters — clone from GitHub and run on localhost.

## Features

- **Monaco Editor** — the same engine as VS Code, syntax highlighting for 100+ languages, IntelliSense, multi-cursor
- **Built-in Terminal** — full shell access, multiple instances, working directory tracking
- **11 Themes** — Tokyo Night, Catppuccin, Gruvbox, Kanagawa, Nord, Matrix, One Dark, AMOLED and more (dark + light for each)
- **Zero Setup** — no account, no install, no config
- **Project Folders** — upload entire directories, file tree, drag-and-drop, rename, create, delete
- **Settings** — fonts, cursor, brackets, auto-save, compact mode (no JSON editing)
- **Auto-Save** — editor state, tabs and settings saved automatically every 5 seconds
- **WebSocket Terminal** — real-time shell I/O with full cd support
- **Privacy** — all data transmitted over secure connection, no cloud, no tracking, no analytics

## Quick Start

```bash
git clone https://github.com/lovlygod/BlinkCode.git
cd BlinkCode
npm install
npm run dev
```

Open `http://localhost:3001` in your browser.

## Tech Stack

- **Frontend**: React + TypeScript + Monaco Editor + Vite
- **Backend**: Express.js + WebSocket
- **Persistence**: SQLite (better-sqlite3)

## Project Structure

```
BlinkCode/
├── server/           # Express backend + WebSocket terminal
│   ├── index.js      # REST API + WebSocket server
│   └── db.js         # SQLite persistence
├── src/
│   ├── components/
│   │   ├── Landing/      # Landing page (/en, /ru)
│   │   ├── CodeEditor/   # Monaco editor with 22 themes
│   │   ├── Sidebar/      # File tree with drag-and-drop
│   │   ├── Terminal/      # WebSocket terminal
│   │   ├── SettingsPanel/ # Settings (Editor, Files, Appearance)
│   │   ├── TopHeader/     # Header bar
│   │   ├── TabsHeader/    # Tab bar with dirty indicator
│   │   ├── AIPanel/       # AI assistant panel
│   │   └── Toast/         # Toast notifications
│   ├── store/             # React context + reducer
│   ├── utils/             # API, i18n, file icons
│   ├── hooks/             # useT, useShell, useResizable
│   └── types/             # TypeScript types
├── public/
└── vite.config.ts
```

## License

MIT

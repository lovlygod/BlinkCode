<p align="center">
  <img src="./src/assets/BlinkCode-logo.svg" alt="BlinkCode logo" width="120" />
</p>

<h1 align="center">BlinkCode</h1>

<p align="center">
  Desktop-first редактор кода для web и app workflow.
</p>

<p align="center">
  Electron · React · TypeScript · Monaco · Настоящий LSP IntelliSense · PTY-терминал · Windows-сборки
</p>

<p align="center">
  <a href="./README.md">English</a>
  &nbsp;·&nbsp;
  <a href="./README.ru.md"><strong>Русская версия</strong></a>
  &nbsp;·&nbsp;
  <a href="./docs/RU/README.md">📖 Документация</a>
</p>

---

## Оглавление

1. [О проекте](#о-проекте)
2. [Скриншоты](#скриншоты)
3. [Возможности](#возможности)
4. [Быстрый старт](#быстрый-старт)
5. [Desktop-сборка](#desktop-сборка)
6. [Документация](#документация)
7. [Технологии](#технологии)
8. [Структура проекта](#структура-проекта)
9. [Контрибьютинг](#контрибьютинг)
10. [Лицензия](#лицензия)

---

## О проекте

**BlinkCode** — это desktop-first редактор кода для локальной разработки,
ориентированный на быстрый keyboard-driven workflow внутри одного проекта.
Он встраивает настоящие language-серверы (TypeScript, HTML, CSS, JSON) в
Monaco, поэтому вы получаете полноценный IntelliSense — auto-import,
rename, references, форматирование, quick fixes — вместе со встроенным
терминалом, файловым деревом и web preview.

## Скриншоты

### Welcome-экран

<p align="center">
  <img src="./screenshots/welcome-screen-ru.gif" alt="BlinkCode welcome screen RU" width="78%" />
</p>

### Monaco Editor

<p align="center">
  <img src="./screenshots/editor-screen-ru.png" alt="BlinkCode editor screen RU" width="78%" />
</p>

### Настройки

<p align="center">
  <img src="./screenshots/settings-screen-ru.png" alt="BlinkCode settings screen RU" width="78%" />
</p>

## Возможности

Короткий список — подробно в [`docs/RU/features.md`](./docs/RU/features.md),
все горячие клавиши — в [`docs/RU/shortcuts.md`](./docs/RU/shortcuts.md).

- **Настоящий IntelliSense через LSP** — TypeScript / JavaScript / TSX / JSX,
  HTML, CSS / SCSS / LESS, JSON, с auto-import, rename, references, go to
  definition, форматированием, code actions и inline-диагностикой
- **Command Palette** (`Ctrl+Shift+P`) и **Quick Open** (`Ctrl+P`)
- **Встроенный терминал** на `xterm` с настоящими PTY-сессиями
- **Встроенный browser preview** для локальных dev-серверов и ссылок из терминала
- **AI-панель** для чат-style запросов рядом с редактором
- **Кастомная Electron-оболочка** — titlebar, activity bar, статус-бар, тосты, онбординг
- **Темы**, bracket colorization, indent guides, анимированный welcome
- **Windows installer и portable** через `electron-builder`

## Быстрый старт

```bash
git clone https://github.com/lovlygod/BlinkCode.git
cd BlinkCode
npm install
npm run dev
```

Открыть в браузере: http://127.0.0.1:5173

Для полноценного Electron-режима (рекомендуется):

```bash
npm run electron:dev
```

Подробная инструкция и траблшутинг — в
[`docs/RU/development.md`](./docs/RU/development.md).

## Desktop-сборка

```bash
npm run dist:win
```

Артефакты попадают в [`release/`](release):

- installer: `BlinkCode-Setup-0.3.0-x64.exe`
- portable: `BlinkCode-Portable-0.3.0-x64.exe`

Детали упаковки, `asarUnpack`, auto-update и публикация GitHub-релиза —
в [`docs/RU/building.md`](./docs/RU/building.md).

## Документация

Полная документация живёт в [`docs/`](./docs/README.md):

| English | Русский |
|---|---|
| [Documentation home](./docs/README.md) | [Главная документации](./docs/README.md) |
| [Features](./docs/EN/features.md) | [Возможности](./docs/RU/features.md) |
| [Keyboard shortcuts](./docs/EN/shortcuts.md) | [Горячие клавиши](./docs/RU/shortcuts.md) |
| [Architecture](./docs/EN/architecture.md) | [Архитектура](./docs/RU/architecture.md) |
| [Language servers (LSP)](./docs/EN/lsp.md) | [Language-серверы (LSP)](./docs/RU/lsp.md) |
| [Development](./docs/EN/development.md) | [Разработка](./docs/RU/development.md) |
| [Building & packaging](./docs/EN/building.md) | [Сборка и упаковка](./docs/RU/building.md) |

## Технологии

- **Frontend:** React + TypeScript + Vite
- **Редактор:** Monaco через `@monaco-editor/react`
- **Language-серверы:** `typescript-language-server` и
  `vscode-langservers-extracted`, проброшенные через WebSocket
- **Desktop shell:** Electron
- **Упаковка:** `electron-builder`
- **Терминал:** `xterm`
- **Backend:** Express + WebSocket
- **Персистентность:** локальное JSON-состояние в [`server/db.js`](./server/db.js)

## Структура проекта

```text
BlinkCode/
├── electron/            # main process + preload
├── server/              # HTTP / WebSocket backend
│   ├── index.js
│   ├── lsp.js           # WebSocket-мост LSP
│   ├── pty.js
│   └── db.js
├── src/
│   ├── components/      # UI (editor, sidebar, panels, …)
│   ├── lsp/             # LSP-клиент + Monaco-адаптер
│   ├── hooks/
│   ├── store/
│   └── utils/
├── docs/
│   ├── EN/
│   └── RU/
├── build/
├── release/
└── package.json
```

Детально — в [`docs/RU/architecture.md`](./docs/RU/architecture.md).

## Контрибьютинг

См. [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Лицензия

[Apache 2.0](./LICENSE)

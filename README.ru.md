<p align="center">
  <img src="./src/assets/BlinkCode-logo.svg" alt="BlinkCode logo" width="120" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.ru.md">Русская версия</a>
</p>

<h1 align="center">BlinkCode</h1>

<p align="center">
  Desktop-first редактор кода для web и app workflow.
</p>

<p align="center">
  Electron • React • TypeScript • Monaco • PTY Terminal • Windows Builds
</p>

## О проекте

[`BlinkCode`](README.ru.md) — это desktop-first редактор для локальной разработки, ориентированный на быстрый рабочий процесс внутри одного проекта.

Он подходит для:
- открытия локальных папок проекта
- редактирования кода и конфигов
- восстановления рабочего состояния между запусками
- использования встроенного терминала
- открытия локальных dev-server и web-ссылок прямо внутри приложения через встроенный web preview
- упаковки в Windows desktop-приложение

## Скриншоты

### 1. Приветственный экран

Приветственный экран теперь включает анимированный логотип Blink, интерактивную сетку точек и более чистое empty-state оформление.

<p align="center">
  <img src="./screenshots/welcome-screen-ru.png" alt="BlinkCode welcome screen RU" width="78%" />
</p>

### 2. Monaco Editor

<p align="center">
  <img src="./screenshots/editor-screen-ru.png" alt="BlinkCode editor screen RU" width="78%" />
</p>

### 3. Настройки

Панель настроек оптимизирована для desktop-использования и теперь включает настройку цвета сетки точек.

<p align="center">
  <img src="./screenshots/settings-screen-ru.png" alt="BlinkCode settings screen RU" width="78%" />
</p>

## Основные возможности

### Welcome Screen и оформление
- анимированный welcome-логотип Blink с восстановленным typewriter-таймингом
- синий `Blink` в логотипе в соответствии с визуальным стилем проекта
- интерактивная сетка точек на экране приветствия на [`DotGrid`](src/components/common/DotGrid.tsx)
- настройка цвета сетки точек с сохранением в [`EditorContext`](src/store/EditorContext.tsx)
- тёмный кастомный color picker в [`ColorPicker`](src/components/common/ColorPicker.tsx) вместо системного диалога выбора цвета

### Стабильность и безопасность
- более безопасная обработка бинарных и неподдерживаемых файлов
- SQLite sidecar-файлы вроде `*.db-shm` и `*.db-wal` обрабатываются как binary-файлы
- добавлена защита от случайной порчи файлов при переключении между неподдерживаемыми и обычными исходниками
- улучшено поведение фокуса терминала, чтобы ввод в редактор не уходил в терминал, когда панель терминала открыта

### Редактор
- [`Monaco Editor`](src/components/CodeEditor/CodeEditor.tsx) как основа редактора
- autosave и восстановление состояния через [`EditorContext`](src/store/EditorContext.tsx)
- вкладки с dirty-state в [`TabsHeader`](src/components/TabsHeader/TabsHeader.tsx)
- breadcrumbs в [`Breadcrumb`](src/components/Breadcrumb/Breadcrumb.tsx)
- подсветка парных скобок и indent guides, настраиваемые в панели настроек
- словарные подсказки Monaco отключены в пользу настоящих LSP-автокомплитов

### Языковая поддержка (LSP)

BlinkCode запускает настоящие language-серверы и соединяет их с Monaco через WebSocket, поэтому автокомплит, диагностика и рефакторинги работают как в VS Code.

- TypeScript / JavaScript / TSX / JSX через [`typescript-language-server`](package.json)
- HTML, CSS / SCSS / LESS, JSON / JSONC через [`vscode-langservers-extracted`](package.json)
- проектный IntelliSense с учётом `tsconfig.json` / `jsconfig.json` в workspace
- auto-import при выборе из автокомплита (выбрав `useState`, сам добавляет `import { useState } from 'react'`)
- hover с типами и документацией
- переход к определению (`F12`, `Ctrl+Click`)
- подсказки сигнатур внутри вызовов
- переименование символа (`F2`) с правками во всех файлах
- поиск всех использований (`Shift+F12`)
- outline / символы документа (`Ctrl+Shift+O`)
- форматирование документа (`Shift+Alt+F`) и выделения (`Ctrl+K Ctrl+F`)
- code actions / quick fix (`Ctrl+.`), включая add missing import и organize imports
- inline-диагностика (ошибки, предупреждения, подсказки) с безопасным рендером hover
- встроенные Monaco-сервисы для TS/JS/HTML/CSS/JSON отключены, так что единственный источник правды — реальный LSP
- WebSocket-мост в [`server/lsp.js`](server/lsp.js) с поддержкой `ELECTRON_RUN_AS_NODE` для упакованных сборок
- Monaco-адаптер, JSON-RPC клиент и кэш сессий в [`src/lsp/`](src/lsp)
- LSP-бинари попадают в `asarUnpack`, поэтому IntelliSense работает и в dev, и в installer/portable

### Навигация и продуктивность
- Command Palette (`Ctrl+Shift+P`) в [`CommandPalette`](src/components/CommandPalette/CommandPalette.tsx)
- Quick Open — нечёткий поиск файлов (`Ctrl+P`) в [`QuickOpen`](src/components/QuickOpen/QuickOpen.tsx)
- Go to line (`Ctrl+G`) через Monaco
- мульти-курсор и column-selection через Monaco
- статус-бар в [`StatusBar`](src/components/StatusBar/StatusBar.tsx)
- тост-уведомления в [`Toast`](src/components/Toast/Toast.tsx)

### AI-ассистент
- встроенная AI-панель в [`AIPanel`](src/components/AIPanel/AIPanel.tsx) для чат-style запросов рядом с редактором

### Developer Experience
- DevTools открываются автоматически в dev-режиме (`npm run electron:dev`)
- `F12` и `Ctrl+Shift+I` переключают DevTools в окне Electron
- онбординг в [`Landing`](src/components/Landing)

### Desktop-функции
- кастомная оболочка Electron через [`electron/main.mjs`](electron/main.mjs)
- кастомный titlebar и window controls в [`TopHeader`](src/components/TopHeader/TopHeader.tsx)
- activity bar в [`ActivityBar`](src/components/ActivityBar/ActivityBar.tsx)
- встроенный browser preview в [`BrowserPreview`](src/components/BrowserPreview/BrowserPreview.tsx) для локальных сайтов и ссылок из терминала
- Windows packaging через [`electron-builder`](package.json)

### Внешний вид и настройки
- переключение языка интерфейса между English и Russian
- несколько тем оформления и цветовых схем
- настройка цвета сетки точек в [`SettingsPanel`](src/components/SettingsPanel/SettingsPanel.tsx)
- кастомный тематический color picker, который открывается внутри панели настроек
- компактный режим, анимации, иконки файлов и другие desktop-настройки

### Работа с проектами
- открытие локальных папок
- дерево файлов с rename / create / delete / drag-and-drop в [`Sidebar`](src/components/Sidebar/Sidebar.tsx)
- recent projects в пустом состоянии проводника
- централизованные правила поддержки файлов в [`supportedWebFiles.ts`](src/utils/supportedWebFiles.ts)

### Работа с файлами
- поддерживаемые файлы открываются в Monaco
- неподдерживаемые текстовые файлы могут открываться в режиме только для чтения
- отдельная логика для binary / preview / generated / large files в [`CodeEditor`](src/components/CodeEditor/CodeEditor.tsx)
- расширенная поддержка форматов:
  - [`mdx`](src/utils/supportedWebFiles.ts)
  - [`xml`](src/utils/supportedWebFiles.ts)
  - [`ini`](src/utils/supportedWebFiles.ts)
  - [`conf`](src/utils/supportedWebFiles.ts)
  - [`graphql`](src/utils/supportedWebFiles.ts)
  - [`ps1`](src/utils/supportedWebFiles.ts)
  - [`csv`](src/utils/supportedWebFiles.ts)

### Терминал
- UI терминала на базе [`xterm`](src/components/Terminal/Terminal.tsx)
- транспорт shell-сессий в [`useShell`](src/hooks/useShell.ts)
- PTY manager в [`server/pty.js`](server/pty.js)
- WebSocket lifecycle в [`server/index.js`](server/index.js)
- улучшено управление фокусом терминала, чтобы редактор сохранял ввод с клавиатуры, когда выбран именно он
- ссылки из терминала можно открывать прямо внутри BlinkCode через встроенный preview, а не только во внешнем браузере

## Быстрый старт

```bash
git clone https://github.com/lovlygod/BlinkCode.git
cd BlinkCode
npm install
npm run dev
```

Открыть в браузере: `http://127.0.0.1:5173`

## Запуск desktop-версии в деве

```bash
npm run electron:dev
```

## Desktop-сборка

```bash
npm run dist:win
```

Готовые файлы появятся в папке [`release/`](release).

## Release-файлы

Текущие Windows-артефакты:
- installer: [`release/BlinkCode-Setup-0.3.0-x64.exe`](release/BlinkCode-Setup-0.3.0-x64.exe)
- portable: [`release/BlinkCode-Portable-0.3.0-x64.exe`](release/BlinkCode-Portable-0.3.0-x64.exe)

## Технологии

- frontend: React + TypeScript + Vite
- editor: Monaco через [`@monaco-editor/react`](package.json)
- language servers: [`typescript-language-server`](package.json) и [`vscode-langservers-extracted`](package.json), проброшенные через WebSocket
- desktop shell: Electron
- packaging: [`electron-builder`](package.json)
- terminal rendering: [`xterm`](package.json)
- backend: Express + WebSocket
- persistence: локальное JSON-состояние в [`server/db.js`](server/db.js)

## Структура проекта

```text
BlinkCode/
├── electron/
│   ├── main.mjs
│   └── preload.cjs
├── server/
│   ├── db.js
│   ├── index.js
│   ├── lsp.js
│   └── pty.js
├── screenshots/
├── src/
│   ├── components/
│   │   ├── ActivityBar/
│   │   ├── AIPanel/
│   │   ├── CodeEditor/
│   │   ├── CommandPalette/
│   │   ├── QuickOpen/
│   │   ├── Sidebar/
│   │   ├── StatusBar/
│   │   ├── TabsHeader/
│   │   ├── Terminal/
│   │   ├── Toast/
│   │   ├── TopHeader/
│   │   └── ...
│   ├── hooks/
│   ├── lsp/
│   ├── store/
│   ├── types/
│   └── utils/
├── build/
├── release/
└── package.json
```

## Важные файлы

- app shell: [`src/App.tsx`](src/App.tsx)
- глобальные стили: [`src/index.css`](src/index.css)
- состояние редактора: [`src/store/EditorContext.tsx`](src/store/EditorContext.tsx)
- правила поддержки файлов: [`src/utils/supportedWebFiles.ts`](src/utils/supportedWebFiles.ts)
- welcome-сетка точек: [`src/components/common/DotGrid.tsx`](src/components/common/DotGrid.tsx)
- тематический color picker: [`src/components/common/ColorPicker.tsx`](src/components/common/ColorPicker.tsx)
- Electron main process: [`electron/main.mjs`](electron/main.mjs)
- backend API и terminal server: [`server/index.js`](server/index.js)
- PTY manager: [`server/pty.js`](server/pty.js)
- LSP WebSocket-мост: [`server/lsp.js`](server/lsp.js)
- Monaco LSP-адаптер: [`src/lsp/monacoAdapter.ts`](src/lsp/monacoAdapter.ts)
- кэш LSP-сессий и URI-резолвер: [`src/lsp/session.ts`](src/lsp/session.ts)

## Лицензия

[`MIT`](LICENSE)

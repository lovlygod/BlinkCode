# BlinkCode — Roadmap идей и улучшений

> Документ для планирования развития BlinkCode из десктопного редактора
> в полноценный web‑ориентированный IDE.
>
> Формат: каждая идея → зачем нужна → как реализовать (тех.заметка) →
> приоритет (P0 / P1 / P2 / P3).
>
> В самом конце — сводная таблица статусов (сделано / не сделано / в работе).

---

## Легенда приоритетов

- **P0** — без этого BlinkCode не воспринимается как IDE. Делать в первую очередь.
- **P1** — ключевая дифференциация под нишу «IDE для веб‑разработки».
- **P2** — качество жизни, сильно повышает удовольствие от использования.
- **P3** — «wow»‑фичи, стратегические, требуют много работы.

---

# 1. Ядро IDE (P0)

## 1.1 Language Server Protocol (LSP)

**Зачем:** Monaco из коробки знает только базовый TS/JS. Настоящий
IntelliSense (автокомплит по проектному `tsconfig`, go‑to‑definition,
rename‑symbol, find‑references, hover‑типы, диагностика) даёт только LSP.
Это причина №1, почему разработчики любят VS Code.

**Как:**
- Фронт: `monaco-languageclient` + `vscode-ws-jsonrpc`.
- Бэк (`server/`): запускать LSP‑процессы по требованию и проксировать
  их через WebSocket (`/ws/lsp/<lang>`).
- Минимум серверов:
  - `typescript-language-server` — TS/JS/JSX/TSX
  - `vscode-html-language-server`
  - `vscode-css-language-server` (+ SCSS/LESS)
  - `vscode-json-language-server` (с JSON Schema)
  - `tailwindcss-language-server`
  - `emmet-ls`
  - `@vue/language-server`
  - `svelte-language-server`
  - `@astrojs/language-server`
  - `vscode-eslint-language-server`
- Форматирование: `prettier` как отдельный сервис + format‑on‑save.

**Приоритет:** P0.

---

## 1.2 Global search / replace (`Ctrl+Shift+F`)

**Зачем:** невозможно работать в проекте без поиска по всем файлам.

**Как:**
- Запуск `ripgrep` (`rg --json ...`) через `child_process`, стрим
  результатов по WS, рендер деревом «файл → совпадения».
- Опции: regex, case, whole word, include/exclude globs.
- Replace‑across‑files с preview диффа перед применением.
- Бинарь `ripgrep` кладётся в `build/bin/` и подписывается в
  `electron-builder` как `extraResources`.

**Приоритет:** P0.

---

## 1.3 Quick Open (`Ctrl+P`) — fuzzy file picker

**Зачем:** мгновенный прыжок к файлу без лазанья по дереву.

**Как:**
- Индекс файлов строится по `chokidar` в памяти.
- Fuzzy‑матч через `fzf`‑подобный алгоритм (есть JS‑порт) или `fuse.js`.
- Поддержка: `file.tsx:42` — сразу на строку, `@symbol` — по символам
  (через LSP `workspace/symbol`), `>command` — проброс в Command Palette.

**Приоритет:** P0.

---

## 1.4 Command Palette (`Ctrl+Shift+P`)

**Зачем:** единая точка входа ко всем командам IDE. Без неё редактор
не ощущается «взрослым».

**Как:**
- Центральный `CommandRegistry`: `register(id, title, handler, keybinding)`.
- Все фичи (открыть файл, переключить тему, запустить npm‑скрипт, git
  commit, toggle terminal…) регистрируются в нём.
- UI — модалка с поиском, группировкой и отображением шорткатов.

**Приоритет:** P0.

---

## 1.5 Problems panel

**Зачем:** видеть все ошибки/варнинги проекта в одном месте, прыгать
по ним `F8` / `Shift+F8`.

**Как:**
- Агрегатор диагностики от всех LSP + ESLint + TS compiler.
- Нижняя панель рядом с терминалом: группировка по файлу, фильтры
  по severity.

**Приоритет:** P0.

---

## 1.6 File watcher (chokidar)

**Зачем:** сейчас дерево перечитывается по запросу. Внешние изменения
(git checkout, webpack, rename из проводника) не видны.

**Как:**
- `chokidar` на `workspace` с игнор‑листом (`node_modules`, `.git`,
  `dist`, `.next`, `.cache`).
- Пуш событий `add/change/unlink/addDir/unlinkDir` через WS `/ws/fs`.
- Фронт инкрементально обновляет дерево и инвалидирует кэш открытых файлов
  («файл изменён на диске, перезагрузить?»).

**Приоритет:** P0.

---

## 1.7 Split editor + drag‑drop вкладок

**Зачем:** базовая IDE‑функция — держать два файла рядом.

**Как:**
- Рефакторинг `EditorContext`: сейчас одна коллекция вкладок, нужно
  «группы редакторов» (как в VS Code).
- UI: drag‑drop вкладки в правый/нижний край → создаётся новый pane.
- Monaco умеет несколько инстансов, ограничений нет.

**Приоритет:** P0.

---

## 1.8 Настоящая персистентность

**Зачем:** в репо лежат `blinkcode.db*` (SQLite‑sidecar), но реально
используется `blinkcode-state.json`. Либо удалить мусор, либо
перейти на `better-sqlite3`.

**Как:**
- `better-sqlite3` (синхронный, быстрый) → таблицы: `editor_state`,
  `recent_projects`, `settings`, `search_history`, `command_history`,
  `file_cursor_positions`.
- Миграции через версионирование схемы.

**Приоритет:** P0 (технический долг).

---

# 2. Git и source control (P0)

## 2.1 Source Control panel

**Зачем:** без Git IDE не IDE.

**Как:**
- Бэк: `simple-git` или прямые вызовы `git`.
- Sidebar‑вкладка: staged / unstaged / untracked, чекбоксы, кнопки
  stage / unstage / discard.
- Commit message textarea, `amend`, `sign‑off`.
- Push / Pull / Fetch с прогрессом.
- Branch picker (создание, чекаут, удаление, merge).

**Приоритет:** P0.

---

## 2.2 Inline diff + gutter‑индикаторы

**Зачем:** видеть, что изменил, прямо в редакторе.

**Как:**
- Monaco `DiffEditor` для «сравнить с HEAD / веткой / файлом».
- Gutter decorations через `deltaDecorations`: зелёный/синий/красный
  маркер рядом со строкой.
- Hover по маркеру → revert hunk / stage hunk.

**Приоритет:** P0.

---

## 2.3 Git blame inline

**Зачем:** быстро понять «кто и когда» написал строку.

**Как:**
- `git blame --porcelain` по открытому файлу, кэш в памяти.
- Inline decoration справа от строки `· <author>, <relative date>`
  (как GitLens).

**Приоритет:** P1.

---

## 2.4 GitHub / GitLab интеграция

**Зачем:** создавать PR/MR и смотреть ревью, не выходя из IDE.

**Как:**
- OAuth device flow для GitHub / GitLab.
- Панель «Pull Requests»: список, чеклист, комменты, approve/merge.
- Действия: «Create PR from current branch», «Checkout PR».

**Приоритет:** P2.

---

# 3. Web‑специфика (P1) — это твоя ниша

## 3.1 NPM Scripts panel

**Зачем:** WebStorm‑style запуск `dev / build / test / lint` в один клик.

**Как:**
- Автодетект `package.json` в корне и подпапках (моно‑репо).
- Панель в Sidebar: список скриптов, запуск → новый именованный
  терминал `▶ npm run dev`.
- Детект package manager по lock‑файлу (`npm` / `pnpm` / `yarn` / `bun`).
- Кнопки «Stop», «Restart», статус (running / exited).

**Приоритет:** P1.

---

## 3.2 Dependencies manager

**Зачем:** управление зависимостями без ухода в терминал.

**Как:**
- Парсинг `package.json` + `npm outdated --json`.
- UI: список deps/devDeps, версия в проекте, последняя, ссылка на npm.
- Кнопки `update`, `remove`, `install new` (autocomplete по npm registry).
- Security: показ `npm audit` уязвимостей inline.

**Приоритет:** P1.

---

## 3.3 Smart BrowserPreview

**Зачем:** у тебя уже есть `<webview>` — довести до Chrome‑уровня.

**Как:**
- **Auto‑attach**: парсить stdout именованных терминалов (`dev`‑скриптов),
  ловить `http://localhost:PORT` → автоматически открывать preview.
- **Device presets**: iPhone 15, iPad, Desktop 1440, кастом; rotate.
- **Network throttling**: Fast 3G / Slow 3G / Offline (через CDP).
- **DevTools**: `webview.openDevTools()` кнопкой.
- **Inspect → Jump to code**: клик на элемент в preview → попытка
  прыгнуть в JSX/HTML‑источник (через source maps / React DevTools
  protocol).
- **Split view**: код + preview бок о бок (почти уже есть по layout).
- **Screenshot / record**: кнопки для быстрого демо.

**Приоритет:** P1.

---

## 3.4 JS / Node Debugger (CDP)

**Зачем:** breakpoints, step‑over, variables — всё, что есть в Chrome DevTools,
только внутри IDE.

**Как:**
- Chrome DevTools Protocol клиент на бэке.
- Для Node: запуск `node --inspect-brk=<port>` + атач.
- Для браузера: атач к `<webview>` через его CDP.
- Фронт: breakpoints в Monaco gutter, call stack, variables, watch,
  console, step‑controls toolbar.
- Launch configs в `.blinkcode/launch.json` (совместимый формат с VS Code).

**Приоритет:** P1. Большая задача, но это **game‑changer**.

---

## 3.5 Tailwind / CSS tooling

**Зачем:** Tailwind сейчас де‑факто стандарт, нормальная поддержка = must.

**Как:**
- `tailwindcss-language-server` (см. 1.1) — автокомплит и hover.
- Inline color swatches рядом с `bg-red-500`, `text-[#abc]` и т.п.
- Цветовой пикер в HEX/RGB/HSL через Monaco colorProvider.
- Подсветка неизвестных классов (ESLint `eslint-plugin-tailwindcss`).

**Приоритет:** P1.

---

## 3.6 REST Client (`.http`)

**Зачем:** вместо Postman — прямо в редакторе, как VS Code REST Client.

**Как:**
- Парсер `.http`/`.rest` формата (`GET http://... \n Header: value \n\n body`).
- Кнопка «Send» → запрос через `undici`/`fetch`, результат в соседней
  панели (headers, body с подсветкой, таймингами).
- Environment‑переменные из `http-client.env.json`.
- История запросов (в SQLite, см. 1.8).

**Приоритет:** P1.

---

## 3.7 Markdown / MDX live preview

**Зачем:** писать доки и блог‑посты удобнее с preview.

**Как:**
- `react-markdown` + `remark-gfm` + `rehype-highlight`.
- Split‑view: исходник слева, рендер справа, синхронный скролл.
- MDX: `@mdx-js/mdx` — компилировать и рендерить JSX‑компоненты
  (с sandboxing через `iframe`/`webview`).

**Приоритет:** P2.

---

## 3.8 Schema‑aware editing

**Зачем:** валидировать `package.json`, `tsconfig.json`, `.eslintrc`,
`vercel.json`, `netlify.toml` и т.д. на лету.

**Как:**
- Monaco JSON: `languages.json.jsonDefaults.setDiagnosticsOptions({ schemas })`.
- Преднастроенный набор схем с SchemaStore.org.
- Для YAML — `monaco-yaml`.

**Приоритет:** P2.

---

## 3.9 `.env` editor

**Зачем:** красивый редактор секретов, с маской значений.

**Как:**
- Кастомный editor view для `.env*`: таблица key/value, иконка «глаз»
  для показа значения.
- Защита: предупреждение при попытке закоммитить `.env` в git.

**Приоритет:** P2.

---

## 3.10 Шаблоны / scaffolding

**Зачем:** создавать новый проект в пару кликов.

**Как:**
- Wizard: выбор стека (Vite+React/Vue/Svelte, Next, Nuxt, Astro, Remix,
  SvelteKit), опций (TS, Tailwind, ESLint/Prettier, Vitest/Playwright).
- Под капотом — вызов соответствующего `create‑*` CLI в выбранной
  папке, потом `openFolder`.

**Приоритет:** P2.

---

# 4. AI‑возможности (P1/P3)

У тебя уже есть `AIPanel` — надо дожать.

## 4.1 Inline ghost‑completions (Copilot‑like)

**Зачем:** главный AI‑фичер современного IDE.

**Как:**
- Monaco `registerInlineCompletionsProvider` → запрос к LLM (OpenAI /
  Anthropic / локальный Ollama) с контекстом вокруг курсора.
- Дебаунс 300–500мс, кеш, отмена по вводу.

**Приоритет:** P1.

---

## 4.2 Chat с контекстом проекта

**Зачем:** «объясни этот файл», «почему тут баг», «сгенерируй тест».

**Как:**
- Mentions: `@file`, `@folder`, `@symbol`, `@terminal`, `@problems`.
- RAG: эмбеддинги файлов проекта в SQLite (`sqlite-vss` или отдельный
  файл с cosine‑поиском), индекс при изменениях через watcher.
- Соблюдение `.gitignore` и `.blinkcodeignore`.

**Приоритет:** P1.

---

## 4.3 AI‑агент с инструментами

**Зачем:** самая «горячая» фича 2025–2026 (Cursor / Windsurf / Cline).
Это и может быть главным USP.

**Как:**
- Tool‑calling API: `read_file`, `edit_file`, `search`, `run_terminal`,
  `open_browser_preview`.
- UI диффов перед применением («одобрить / отклонить»).
- Plan mode vs Act mode.
- BYO‑key: OpenAI, Anthropic, Groq, локальный Ollama.

**Приоритет:** P1 (это дифференциация).

---

## 4.4 Quick actions

**Зачем:** быстрые преобразования выделения.

**Как:**
- Context menu: «Explain», «Refactor», «Generate tests», «Add JSDoc»,
  «Convert to TypeScript», «Translate strings».
- Lightbulb (`Ctrl+.`) над выделением.

**Приоритет:** P2.

---

# 5. Качество жизни (P2)

## 5.1 Snippets (пользовательские)

- UI менеджера сниппетов по языкам.
- Формат совместимый с VS Code (`.code-snippets`), импорт.

## 5.2 Keybindings editor

- Таблица всех команд + назначенных шорткатов, поиск, redefine,
  конфликты, экспорт/импорт.

## 5.3 Settings как JSON + UI

- `settings.json` в `userData` + UI с поиском (как в VS Code).
- Переопределение по воркспейсу (`.blinkcode/settings.json`).

## 5.4 Импорт тем VS Code

- Парсер `.json` тем из VS Code marketplace → конвертация токенов
  в Monaco‑токены.
- Экосистема тысяч тем «бесплатно».

## 5.5 Мульти‑рут workspace

- `workspace` сейчас — один путь. Для pnpm‑workspaces / Nx / Turborepo
  нужно несколько корней.
- Файл `.blinkcode/workspace.json` со списком folders.

## 5.6 Zen mode / Focus mode

- F11 или кастомный шорткат → скрыть ActivityBar / Sidebar / Terminal,
  максимум редактора.

## 5.7 Minimap / sticky scroll / breadcrumbs

- У Monaco всё это есть «из коробки», включить и вытащить в Settings.

## 5.8 Bracket pair colorization / indent guides

- Monaco поддерживает: `"editor.bracketPairColorization.enabled": true`.

## 5.9 Спелчекер

- `cspell` или `nspell` для комментов и markdown.

## 5.10 Trash (soft delete)

- Сейчас `/api/delete` делает `fs.rmSync` без возврата.
- Через `trash` npm‑пакет → отправка в корзину ОС.

---

# 6. Большие стратегические (P3)

## 6.1 Система плагинов

**Зачем:** экосистема = живой продукт.

**Как:**
- API `window.blinkcode.*`: `registerCommand`, `registerPanel`,
  `onDidChangeActiveEditor`, `onWillSaveDocument`, `terminal.create`.
- Плагины как npm‑пакеты в `userData/plugins/`.
- Изоляция: каждый плагин в отдельном iframe или WebWorker.
- Marketplace (минимум — GitHub‑based листинг).

---

## 6.2 Remote / WSL / SSH / Dev Containers

- WSL‑режим для Windows (твоя аудитория): запуск `server/` внутри WSL,
  UI остаётся на хосте.
- SSH‑режим: VS Code Remote‑SSH style, один config, открываешь папку на
  удалённой машине как локальную.
- Dev Containers (`devcontainer.json`): автозапуск Docker‑контейнера.

---

## 6.3 Live Share (co‑editing)

- Yjs + WebRTC → совместное редактирование в реальном времени, курсоры,
  выделения, общий терминал (read‑only).

---

## 6.4 Deploy в один клик

- Интеграция с Vercel / Netlify / Cloudflare Pages / GitHub Pages.
- OAuth, список проектов, кнопка «Deploy», лог билда inline.
- Это прямо соответствует слогану «IDE for web».

---

## 6.5 Cross‑platform билды

- Сейчас — только Windows (NSIS + portable).
- Добавить `.dmg` (macOS), `.AppImage` / `.deb` (Linux). `electron-builder`
  умеет, основная работа — тестирование и подписывание.

---

## 6.6 Auto‑update

- `electron-updater` + GitHub Releases как канал.
- Delta‑updates, silent‑install.

---

## 6.7 Телеметрия (opt‑in)

- Anonymous usage metrics (какие фичи юзают, где падает).
- Jitsu / PostHog / self‑hosted.
- Чётко opt‑in с переключателем в Settings.

---

# 7. Мелкие, но приятные улучшения

## 7.1 Trailing whitespace / final newline

- Настройка «trim on save», «insert final newline», «ensure LF».

## 7.2 EditorConfig

- Парсер `.editorconfig` → применять indent/charset/eol автоматически.

## 7.3 Auto‑save

- Уже есть по таймеру; добавить опции «onFocusChange» и «onWindowChange».

## 7.4 Recent files (`Ctrl+Tab`)

- Переключение по MRU‑списку вкладок.

## 7.5 Go to line (`Ctrl+G`)

- Отдельная команда, открывается мини‑инпут.

## 7.6 Multi‑cursor / column selection

- Monaco умеет, нужны доки/подсказки.

## 7.7 Drag‑drop файлов из ОС в редактор

- Обработать drop в дерево и вкладки.

## 7.8 Right‑click «Reveal in Explorer / Finder»

- `shell.showItemInFolder(path)`.

## 7.9 Right‑click «Copy relative path» / «Copy absolute path»

- Мелочь, но часто нужно.

## 7.10 Last cursor position

- При открытии файла восстанавливать позицию курсора и скролл.

---

# 8. Безопасность и надёжность

## 8.1 Path traversal audit

- `safePath` в `server/index.js` уже есть, но стоит покрыть тестами
  (случаи символьных ссылок, UNC‑путей на Windows).

## 8.2 CSP для renderer

- Жёсткий Content‑Security‑Policy на фронте.

## 8.3 Хранение секретов

- OAuth‑токены GitHub, API‑ключи LLM — через `keytar` (OS keychain),
  не в JSON‑файле.

## 8.4 Sandboxing для AI‑агента

- Запуск предложенных команд — через явный confirm, allow‑list путей.

## 8.5 Большие файлы

- Лимиты на открытие (>5MB — warning, >50MB — read‑only hex view).

## 8.6 Recovery / краш‑ресторы

- Несохранённые изменения каждые N секунд дампить в
  `userData/recovery/`, при падении предлагать восстановить.

---

# 9. Тесты и DX самого BlinkCode

- **Unit‑тесты**: `vitest` для `utils/`, `store/`.
- **E2E**: Playwright + Electron для сценариев (открыть папку,
  создать файл, редактировать, сохранить, ребут).
- **CI**: GitHub Actions — lint, typecheck, unit, E2E, билд под Win/Mac/Linux.
- **Storybook** для компонентов UI (Sidebar, TabsHeader и т.п.).

---

# 10. Позиционирование и маркетинг (не код, но важно)

Сильная честная позиция:

> **Fast, offline‑first, AI‑native IDE for web developers.**

Отличия от VS Code/Cursor/WebStorm, которые можно подчёркивать:

- быстрее стартует (маленький bundle, нет магазина расширений),
- встроенные web‑инструменты (REST client, smart preview, Tailwind,
  deploy‑buttons) — не нужно ставить 10 плагинов,
- AI с BYO‑key и локальным режимом (Ollama) — privacy‑first,
- одна подписка не нужна — opensource / freemium,
- родной для Windows (WSL‑режим из коробки).

---

# 11. Сводная таблица статусов

| #    | Идея                                    | Приоритет | Статус            | Примечание                                        |
|------|-----------------------------------------|-----------|-------------------|---------------------------------------------------|
| 1.1  | LSP (TS/JS/HTML/CSS/Tailwind/ESLint…)   | P0        | ❌ не сделано     | Monaco только с базовым TS                        |
| 1.2  | Global search / replace (`Ctrl+Shift+F`)| P0        | ❌ не сделано     | Нужен ripgrep                                     |
| 1.3  | Quick Open (`Ctrl+P`)                   | P0        | ❌ не сделано     |                                                   |
| 1.4  | Command Palette (`Ctrl+Shift+P`)        | P0        | ✅ сделано        | `CommandPalette.tsx`; Ctrl+Shift+P, fuzzy, категории|
| 1.5  | Problems panel                          | P0        | ❌ не сделано     | Зависит от LSP                                    |
| 1.6  | File watcher (chokidar)                 | P0        | ✅ сделано        | `server/index.js` chokidar + `/ws/fs` + frontend    |
| 1.7  | Split editor + drag‑drop вкладок        | P0        | ❌ не сделано     | В `App.tsx` один CodeEditor                       |
| 1.8  | Персистентность: SQLite вместо JSON     | P0        | ⚠️ частично       | Файлы `blinkcode.db*` лежат, но не используются   |
| 2.1  | Git Source Control panel                | P0        | ❌ не сделано     |                                                   |
| 2.2  | Inline diff + gutter‑индикаторы         | P0        | ❌ не сделано     |                                                   |
| 2.3  | Git blame inline                        | P1        | ❌ не сделано     |                                                   |
| 2.4  | GitHub / GitLab интеграция              | P2        | ❌ не сделано     |                                                   |
| 3.1  | NPM Scripts panel                       | P1        | ❌ не сделано     |                                                   |
| 3.2  | Dependencies manager                    | P1        | ❌ не сделано     |                                                   |
| 3.3  | Smart BrowserPreview (auto‑attach, DevTools, devices) | P1 | ⚠️ частично | Базовый `<webview>` есть                    |
| 3.4  | JS / Node Debugger (CDP)                | P1        | ❌ не сделано     |                                                   |
| 3.5  | Tailwind / CSS tooling                  | P1        | ❌ не сделано     |                                                   |
| 3.6  | REST Client (`.http`)                   | P1        | ❌ не сделано     |                                                   |
| 3.7  | Markdown / MDX live preview             | P2        | ❌ не сделано     | MDX поддерживается как текст                      |
| 3.8  | Schema‑aware JSON/YAML                  | P2        | ❌ не сделано     |                                                   |
| 3.9  | `.env` editor                           | P2        | ❌ не сделано     |                                                   |
| 3.10 | Шаблоны / scaffolding                   | P2        | ❌ не сделано     |                                                   |
| 4.1  | AI inline completions                   | P1        | ❌ не сделано     | Панель AI есть, completions нет                   |
| 4.2  | AI chat с контекстом + RAG              | P1        | ⚠️ частично       | Есть `AIPanel`, глубина неизвестна                |
| 4.3  | AI‑агент с инструментами                | P1        | ❌ не сделано     | Главный USP                                       |
| 4.4  | AI quick actions                        | P2        | ❌ не сделано     |                                                   |
| 5.1  | Snippets                                | P2        | ❌ не сделано     |                                                   |
| 5.2  | Keybindings editor                      | P2        | ❌ не сделано     |                                                   |
| 5.3  | Settings JSON + UI                      | P2        | ⚠️ частично       | `SettingsPanel` есть, JSON режим — нет            |
| 5.4  | Импорт тем VS Code                      | P2        | ❌ не сделано     |                                                   |
| 5.5  | Мульти‑рут workspace                    | P2        | ❌ не сделано     | Один workspace path                               |
| 5.6  | Zen / Focus mode                        | P2        | ❌ не сделано     |                                                   |
| 5.7  | Minimap / sticky scroll / breadcrumbs   | P2        | ⚠️ частично       | Breadcrumb есть, остальное — опция Monaco         |
| 5.8  | Bracket colorization / indent guides    | P2        | ✅ сделано        | Включено в `CodeEditor.tsx` + опции в `SettingsPanel`|
| 5.9  | Спелчекер                               | P2        | ❌ не сделано     |                                                   |
| 5.10 | Trash (soft delete)                     | P2        | ❌ не сделано     | Сейчас `fs.rmSync`                                |
| 6.1  | Plugin system                           | P3        | ❌ не сделано     |                                                   |
| 6.2  | Remote / WSL / SSH / Dev Containers     | P3        | ❌ не сделано     |                                                   |
| 6.3  | Live Share                              | P3        | ❌ не сделано     |                                                   |
| 6.4  | Deploy в один клик                      | P3        | ❌ не сделано     |                                                   |
| 6.5  | macOS / Linux билды                     | P3        | ❌ не сделано     | Только Windows                                    |
| 6.6  | Auto‑update                             | P3        | ❌ не сделано     |                                                   |
| 6.7  | Телеметрия (opt‑in)                     | P3        | ❌ не сделано     |                                                   |
| 7.1  | Trim whitespace / final newline         | —         | ✅ сделано        | Есть настройки в `EditorContext` / `SettingsPanel`|
| 7.2  | EditorConfig                            | —         | ❌ не сделано     |                                                   |
| 7.3  | Auto‑save (onFocusChange)               | —         | ⚠️ частично       | Autosave по таймеру есть                          |
| 7.4  | Recent files (`Ctrl+Tab`)               | —         | ❌ не сделано     |                                                   |
| 7.5  | Go to line (`Ctrl+G`)                   | —         | ✅ сделано        | Встроено в Monaco (`editor.action.gotoLine`)      |
| 7.6  | Multi‑cursor / column selection         | —         | ✅ (Monaco)       | Встроено                                          |
| 7.7  | Drag‑drop файлов из ОС                  | —         | ❌ не сделано     |                                                   |
| 7.8  | Reveal in Explorer                      | —         | ❌ не сделано     |                                                   |
| 7.9  | Copy path                               | —         | ❌ не сделано     |                                                   |
| 7.10 | Last cursor position                    | —         | ❌ не сделано     | `viewState` / `revealLine` в коде не найдены      |
| 8.1  | Path traversal тесты                    | —         | ⚠️ частично       | `safePath` есть, тестов нет                       |
| 8.2  | CSP                                     | —         | ❌ не сделано     | Ни в `index.html`, ни в Electron нет CSP           |
| 8.3  | Secret storage (keytar)                 | —         | ❌ не сделано     |                                                   |
| 8.4  | AI sandbox / confirm                    | —         | ❌ не сделано     |                                                   |
| 8.5  | Large file limits                       | —         | ⚠️ частично       | Бинарный детект есть                              |
| 8.6  | Recovery / краш‑сторадж                 | —         | ❌ не сделано     |                                                   |
| 9    | Unit / E2E тесты, CI                    | —         | ❌ не сделано     |                                                   |

Легенда:
- ✅ сделано
- ⚠️ частично / есть каркас
- ❌ не сделано

---

# 12. Предлагаемый порядок работы

**Спринт 1 — ядро IDE (P0):**
1.1 LSP (TypeScript первым) → 1.6 watcher → 1.4 Command Palette →
1.3 Quick Open → 1.2 Global search → 1.5 Problems panel → 1.7 Split editor → 1.8 SQLite.

**Спринт 2 — Git + Web (P0/P1):**
2.1 Source Control → 2.2 Diff/gutter → 3.1 NPM scripts panel →
3.3 Smart BrowserPreview (auto‑attach) → 3.5 Tailwind LSP + Prettier/ESLint.

**Спринт 3 — дифференциация (P1):**
3.4 Debugger → 3.6 REST Client → 4.1 AI inline completions →
4.3 AI‑агент с инструментами.

**Спринт 4 — стратегия (P2/P3):**
6.4 Deploy‑buttons → 6.1 Plugin system → 6.2 WSL режим →
6.5 macOS/Linux билды → 6.6 Auto‑update.

---

_Документ живой. Обновляй статусы в таблице §11 по мере продвижения._

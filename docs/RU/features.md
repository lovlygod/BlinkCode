# Возможности

<p>
  <a href="./README.md">↑ Главная документации (RU)</a>
  &nbsp;·&nbsp;
  <a href="../EN/features.md">🇬🇧 In English</a>
  &nbsp;·&nbsp;
  <a href="../../README.ru.md">README проекта</a>
</p>

---

## Оглавление

1. [Welcome-экран и брендинг](#welcome-экран-и-брендинг)
2. [Ядро редактора](#ядро-редактора)
3. [Языковая поддержка (LSP)](#языковая-поддержка-lsp)
4. [Навигация и продуктивность](#навигация-и-продуктивность)
5. [Терминал](#терминал)
6. [Browser preview](#browser-preview)
7. [AI-ассистент](#ai-ассистент)
8. [Работа с проектом](#работа-с-проектом)
9. [Работа с файлами](#работа-с-файлами)
10. [Внешний вид и настройки](#внешний-вид-и-настройки)
11. [Desktop-интеграция](#desktop-интеграция)
12. [Стабильность и безопасность](#стабильность-и-безопасность)
13. [Developer experience](#developer-experience)

См. также: [горячие клавиши](./shortcuts.md), [архитектура](./architecture.md), [LSP](./lsp.md).

---

## Welcome-экран и брендинг

- Анимированный логотип `Blink` с typewriter-эффектом — [`BlinkLogo.tsx`](../../src/components/common/BlinkLogo.tsx)
- Интерактивная сетка точек на welcome-экране — [`DotGrid.tsx`](../../src/components/common/DotGrid.tsx)
- Настройка цвета сетки, сохраняемая в [`EditorContext`](../../src/store/EditorContext.tsx)
- Тематический color picker — [`ColorPicker.tsx`](../../src/components/common/ColorPicker.tsx) — вместо системного диалога
- Онбординг — [`Landing/`](../../src/components/Landing)

## Ядро редактора

- [`Monaco Editor`](../../src/components/CodeEditor/CodeEditor.tsx) как основа редактирования
- Autosave + восстановление состояния между запусками через [`EditorContext`](../../src/store/EditorContext.tsx)
- Вкладки с индикатором dirty — [`TabsHeader`](../../src/components/TabsHeader/TabsHeader.tsx)
- Breadcrumbs — [`Breadcrumb`](../../src/components/Breadcrumb/Breadcrumb.tsx)
- Подсветка парных скобок и indent guides (настраиваются в панели настроек)
- Словарные подсказки Monaco отключены в пользу настоящих LSP-автокомплитов
- Trim trailing whitespace / insert final newline (настраивается)

## Языковая поддержка (LSP)

Настоящие language-серверы соединены с Monaco через WebSocket. Подробно —
в [lsp.md](./lsp.md).

- **TypeScript / JavaScript / TSX / JSX** через `typescript-language-server`
- **HTML**, **CSS / SCSS / LESS**, **JSON / JSONC** через `vscode-langservers-extracted`
- Проектный IntelliSense с учётом `tsconfig.json` / `jsconfig.json` в workspace
- **Auto-import** при выборе из автокомплита — выбрав `useState`, добавляется `import { useState } from 'react'`
- Hover с типами и документацией
- Переход к определению (`F12`, `Ctrl+Click`)
- Подсказки сигнатур внутри вызовов
- Переименование символа (`F2`) с правками во всех файлах
- Поиск всех использований (`Shift+F12`)
- Outline / символы документа (`Ctrl+Shift+O`)
- Форматирование документа (`Shift+Alt+F`) и выделения (`Ctrl+K Ctrl+F`)
- Code actions / quick fix (`Ctrl+.`) — add missing import, organize imports и т.д.
- Inline-диагностика (ошибки, предупреждения, подсказки)
- Панель Problems с диагностикой по всему workspace: группировка по файлам, severity-badges, фильтры All / Errors / Warnings и переход к точной строке по клику
- Встроенные Monaco-сервисы для TS / JS / HTML / CSS / JSON отключены — единственный источник правды это реальный LSP

Файлы реализации:
- [`server/lsp.js`](../../server/lsp.js) — WebSocket ↔ child-process мост
- [`src/lsp/client.ts`](../../src/lsp/client.ts) — JSON-RPC клиент поверх WS
- [`src/lsp/monacoAdapter.ts`](../../src/lsp/monacoAdapter.ts) — Monaco-провайдеры
- [`src/lsp/session.ts`](../../src/lsp/session.ts) — кэш сессий и URI-резолвер

## Навигация и продуктивность

- **Command Palette** (`Ctrl+Shift+P`) — [`CommandPalette`](../../src/components/CommandPalette/CommandPalette.tsx)
- **Quick Open** — нечёткий поиск файлов (`Ctrl+P`) — [`QuickOpen`](../../src/components/QuickOpen/QuickOpen.tsx)
- Go to line (`Ctrl+G`) через Monaco
- Мульти-курсор и column-selection через Monaco
- Статус-бар — [`StatusBar`](../../src/components/StatusBar/StatusBar.tsx) — позиция курсора, тип отступов, кодировка, язык, Git-ветка и live-счётчики ошибок / предупреждений с кнопкой открытия Problems panel
- Тост-уведомления — [`Toast`](../../src/components/Toast/Toast.tsx)

Реализация UI для проблем:
- [`ProblemsPanel`](../../src/components/ProblemsPanel/ProblemsPanel.tsx)
- [`StatusBar`](../../src/components/StatusBar/StatusBar.tsx)
- [`EditorContext`](../../src/store/EditorContext.tsx)

## Терминал

- UI на базе `xterm` — [`Terminal`](../../src/components/Terminal/Terminal.tsx)
- Хук транспорта shell-сессий — [`useShell`](../../src/hooks/useShell.ts)
- PTY manager на бэкенде — [`server/pty.js`](../../server/pty.js)
- Lifecycle WebSocket-ов в [`server/index.js`](../../server/index.js)
- Фокус терминала не перехватывает ввод редактора, если выбран сам редактор
- Ссылки из терминала (например `http://localhost:5173`) открываются внутри встроенного [`BrowserPreview`](../../src/components/BrowserPreview/BrowserPreview.tsx)

## Browser preview

- Встроенный preview на `<webview>` — [`BrowserPreview`](../../src/components/BrowserPreview/BrowserPreview.tsx)
- Показывает локальные dev-сервера и ссылки из терминала прямо внутри приложения

## AI-ассистент

- Встроенная AI-панель для чат-style запросов — [`AIPanel`](../../src/components/AIPanel/AIPanel.tsx)

## Работа с проектом

- Открытие локальных папок
- Дерево файлов с rename / create / delete / drag-and-drop — [`Sidebar`](../../src/components/Sidebar/Sidebar.tsx)
- Recent projects в пустом состоянии проводника
- Централизованные правила поддержки файлов — [`supportedWebFiles.ts`](../../src/utils/supportedWebFiles.ts)

## Работа с файлами

- Поддерживаемые файлы открываются в Monaco
- Неподдерживаемые текстовые — в режиме только для чтения
- Отдельная логика для binary / preview / generated / large в [`CodeEditor`](../../src/components/CodeEditor/CodeEditor.tsx)
- Расширенная поддержка форматов — `mdx`, `xml`, `ini`, `conf`, `graphql`, `ps1`, `csv` и т.д. (см. [`supportedWebFiles.ts`](../../src/utils/supportedWebFiles.ts))
- SQLite sidecar-файлы (`*.db-shm`, `*.db-wal`) обрабатываются как binary

## Внешний вид и настройки

- Переключение языка UI между English и Russian
- Несколько тем оформления и цветовых схем
- Настройка цвета сетки точек в [`SettingsPanel`](../../src/components/SettingsPanel/SettingsPanel.tsx)
- Тематический color picker, который открывается внутри панели настроек
- Компактный режим, анимации, иконки файлов и другие desktop-настройки

## Desktop-интеграция

- Кастомная оболочка Electron — [`electron/main.mjs`](../../electron/main.mjs)
- Кастомный titlebar и window controls — [`TopHeader`](../../src/components/TopHeader/TopHeader.tsx)
- Activity bar — [`ActivityBar`](../../src/components/ActivityBar/ActivityBar.tsx)
- Windows installer и portable через `electron-builder` — см. [building.md](./building.md)
- LSP-бинари попадают в `asarUnpack`, поэтому IntelliSense работает и в dev, и в упакованных сборках

## Стабильность и безопасность

- Безопасная обработка бинарных и неподдерживаемых файлов
- Защита от случайной порчи файлов при переключении между неподдерживаемыми и обычными
- Фокус терминала не «крадёт» ввод у редактора

## Developer experience

- DevTools автоматически открываются в dev-режиме (`npm run electron:dev`)
- `F12` и `Ctrl+Shift+I` переключают DevTools
- В проде логи намеренно тихие — см. [development.md](./development.md)

---

<p align="right"><a href="#оглавление">↑ Наверх</a> · <a href="../README.md">↑ Главная документации</a></p>

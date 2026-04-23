# Разработка

<p>
  <a href="./README.md">↑ Главная документации (RU)</a>
  &nbsp;·&nbsp;
  <a href="../EN/development.md">🇬🇧 In English</a>
  &nbsp;·&nbsp;
  <a href="./building.md">→ Сборка и упаковка</a>
</p>

---

## Оглавление

1. [Требования](#требования)
2. [Установка](#установка)
3. [Запуск в браузере](#запуск-в-браузере)
4. [Запуск в Electron](#запуск-в-electron)
5. [Полезные скрипты](#полезные-скрипты)
6. [Структура проекта](#структура-проекта)
7. [Отладка](#отладка)
8. [Контрибьютинг](#контрибьютинг)

---

## Требования

- **Node.js** 20.x или новее (рекомендуется 22.x)
- **npm** 10.x
- **Windows 10 / 11** для desktop-сборок (другие ОС работают в dev, но пока не упаковываются)
- Git

## Установка

```bash
git clone https://github.com/lovlygod/BlinkCode.git
cd BlinkCode
npm install
```

Если при установке получаете конфликт peer-зависимостей — попробуйте:

```bash
npm install --legacy-peer-deps
```

## Запуск в браузере

```bash
npm run dev
```

- Vite dev server: http://127.0.0.1:5173
- Backend: http://localhost:3001 (PTY и LSP WebSocket-ы)

Удобно для быстрой UI-итерации. Фичи, завязанные на Electron API (файловые
диалоги, window controls) в чисто браузерном режиме не работают.

## Запуск в Electron

```bash
npm run electron:dev
```

Запускает три процесса параллельно:

1. Backend (`server/index.js`)
2. Vite dev server
3. Electron, ждущий Vite на `:5173`

В dev-режиме DevTools открываются автоматически. `F12` и `Ctrl+Shift+I`
переключают их в любой момент.

## Полезные скрипты

| Скрипт | Что делает |
|---|---|
| `npm run dev` | Backend + Vite (браузерный режим) |
| `npm run server` | Только backend |
| `npm run electron:dev` | Полный desktop-цикл разработки |
| `npm run build` | `tsc -b` + production-сборка Vite в `dist/` |
| `npm run lint` *(если есть)* | ESLint |
| `npm run dist:win` | Полная Windows-сборка — см. [building.md](./building.md) |
| `npm run dist:win:setup` | Только installer |
| `npm run dist:win:portable` | Только portable |

## Структура проекта

Полное дерево — в [architecture.md](./architecture.md). Вкратце:

- `electron/` — main / preload
- `server/` — backend (HTTP, PTY, LSP bridge, персистентность)
- `src/` — React renderer
- `src/lsp/` — LSP WebSocket-клиент + Monaco-адаптер
- `src/components/` — UI
- `docs/` — эта документация

## Отладка

- **Renderer**: консоль DevTools + `F12` как стандартный хоткей Monaco внутри редактора.
- **Main process**: запустите Electron с `--inspect` (добавьте в скрипт `electron:dev` если надо).
- **Backend**: `node --inspect server/index.js` или брейкпоинты через Node
  debugger в VS Code, нацеленный на `server/index.js`.
- **LSP**: если что-то подозрительное — временно добавьте `console.log`
  в [`src/lsp/client.ts`](../../src/lsp/client.ts) и
  [`server/lsp.js`](../../server/lsp.js). По умолчанию они намеренно тихие.

## Контрибьютинг

См. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) в корне репозитория.

---

<p align="right"><a href="#оглавление">↑ Наверх</a> · <a href="../README.md">↑ Главная документации</a></p>

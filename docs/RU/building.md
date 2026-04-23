# Сборка и упаковка

<p>
  <a href="./README.md">↑ Главная документации (RU)</a>
  &nbsp;·&nbsp;
  <a href="../EN/building.md">🇬🇧 In English</a>
  &nbsp;·&nbsp;
  <a href="./development.md">→ Разработка</a>
  &nbsp;·&nbsp;
  <a href="./lsp.md">→ LSP</a>
</p>

---

## Оглавление

1. [Требования](#требования)
2. [Windows-сборка](#windows-сборка)
3. [Артефакты](#артефакты)
4. [asarUnpack и LSP](#asarunpack-и-lsp)
5. [Манифест auto-update](#манифест-auto-update)
6. [Публикация GitHub-релиза](#публикация-github-релиза)

---

## Требования

- Всё из [development.md → Требования](./development.md#требования)
- Windows 10 / 11
- Сертификат для code-signing — опционально; без него SmartScreen может
  ругнуться при первом запуске

## Windows-сборка

```bash
npm run dist:win
```

Это шорткат для:

```bash
npm run build              # tsc + Vite
npm run dist:win:setup     # installer
npm run dist:win:portable  # portable
```

Артефакты попадают в `release/`. Имена файлов зависят от текущей версии в
[`package.json`](../../package.json), например:

- `release/BlinkCode-Setup-0.3.0-x64.exe`
- `release/BlinkCode-Portable-0.3.0-x64.exe`
- `release/latest.yml` — метаданные auto-update

## Артефакты

| Файл | Назначение |
|---|---|
| `BlinkCode-Setup-<version>-x64.exe` | NSIS-installer |
| `BlinkCode-Portable-<version>-x64.exe` | Portable, один файл |
| `latest.yml` | Метаданные для `electron-updater`, которые приложение читает при старте |
| `win-unpacked/` | Распакованное дерево сборки (удобно для отладки) |

## asarUnpack и LSP

Бинари language-серверов нельзя запускать изнутри `app.asar` —
`child_process.spawn()` не умеет исполнять файлы из asar-архива. Они
добавлены в `build.asarUnpack` в [`package.json`](../../package.json):

- `node_modules/typescript-language-server/**/*`
- `node_modules/typescript/**/*`
- `node_modules/vscode-langservers-extracted/**/*`

В рантайме [`server/lsp.js`](../../server/lsp.js) ищет эти пакеты и в
dev-раскладке, и в `process.resourcesPath/app.asar.unpacked/node_modules/...`,
и запускает child с `ELECTRON_RUN_AS_NODE=1` — чтобы встроенный Electron
вёл себя как обычный Node.

Если добавляете новый language-сервер — расширьте и `asarUnpack`, **и**
кандидатов в `resolveNodeModule`.

## Манифест auto-update

`latest.yml` пересоздаётся при каждом `npm run dist:win`. Если поднять
версию в `package.json`, но не пересобрать — закоммиченный `latest.yml`
будет ссылаться на **старые** хэши, и auto-update отклонит обновление.
Правило: **всегда пересобирай перед публикацией релиза**.

## Публикация GitHub-релиза

1. Поднять `version` в [`package.json`](../../package.json) (и `package-lock.json`)
2. Обновить документацию / ссылки на release-файлы, если нужно
3. Закоммитить и запушить
4. Запустить `npm run dist:win`
5. На GitHub → **Releases → Draft a new release**
6. Создать тег `v<version>`, например `v0.3.0`, `Target: main`
7. Прикрепить эти файлы из `release/`:
   - `BlinkCode-Setup-<version>-x64.exe`
   - `BlinkCode-Portable-<version>-x64.exe`
   - `latest.yml`
8. Вставить changelog в описание
9. Опубликовать

---

<p align="right"><a href="#оглавление">↑ Наверх</a> · <a href="../README.md">↑ Главная документации</a></p>

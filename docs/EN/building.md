# Building & packaging

<p>
  <a href="./README.md">↑ Docs home (EN)</a>
  &nbsp;·&nbsp;
  <a href="../RU/building.md">🇷🇺 На русском</a>
  &nbsp;·&nbsp;
  <a href="./development.md">→ Development</a>
  &nbsp;·&nbsp;
  <a href="./lsp.md">→ LSP</a>
</p>

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Producing a Windows build](#producing-a-windows-build)
3. [Artifacts](#artifacts)
4. [asarUnpack and LSP](#asarunpack-and-lsp)
5. [Auto-update manifest](#auto-update-manifest)
6. [Publishing a GitHub release](#publishing-a-github-release)

---

## Prerequisites

- Everything from [development.md → Prerequisites](./development.md#prerequisites)
- Windows 10 / 11
- A code-signing certificate is optional; without it, SmartScreen may warn on first launch

## Producing a Windows build

```bash
npm run dist:win
```

This is a shortcut for:

```bash
npm run build              # tsc + Vite
npm run dist:win:setup     # installer
npm run dist:win:portable  # portable
```

Artifacts are written into `release/`. The exact filenames depend on the
current version in [`package.json`](../../package.json), for example:

- `release/BlinkCode-Setup-0.3.0-x64.exe`
- `release/BlinkCode-Portable-0.3.0-x64.exe`
- `release/latest.yml` — auto-update metadata

## Artifacts

| File | Purpose |
|---|---|
| `BlinkCode-Setup-<version>-x64.exe` | NSIS installer |
| `BlinkCode-Portable-<version>-x64.exe` | Single-file portable build |
| `latest.yml` | `electron-updater` metadata consumed by the app on startup |
| `win-unpacked/` | Un-packaged build tree (useful for debugging) |

## asarUnpack and LSP

Language-server binaries cannot run from inside `app.asar` because
`child_process.spawn()` cannot execute files inside an asar archive. They are
whitelisted in `build.asarUnpack` in [`package.json`](../../package.json):

- `node_modules/typescript-language-server/**/*`
- `node_modules/typescript/**/*`
- `node_modules/vscode-langservers-extracted/**/*`

At runtime, [`server/lsp.js`](../../server/lsp.js) resolves these packages
from `process.resourcesPath/app.asar.unpacked/node_modules/...` in addition
to the dev layout, and spawns the child process with
`ELECTRON_RUN_AS_NODE=1` so the bundled Electron executable behaves like
plain Node.

If you add a new language server later, extend both the `asarUnpack` list
**and** the `resolveNodeModule` candidates.

## Auto-update manifest

`latest.yml` is re-generated on every `npm run dist:win`. If you bump the
version in `package.json` but don't rebuild, the checked-in `latest.yml`
will still reference the **previous** binary hashes, and auto-update will
reject them. Rule of thumb: **always rebuild before publishing a release**.

## Publishing a GitHub release

1. Bump `version` in [`package.json`](../../package.json) (and `package-lock.json`)
2. Update the docs / release-file references if needed
3. Commit and push
4. Run `npm run dist:win`
5. Go to GitHub → **Releases → Draft a new release**
6. Create a tag `v<version>`, e.g. `v0.3.0`, targeting `main`
7. Upload these files from `release/`:
   - `BlinkCode-Setup-<version>-x64.exe`
   - `BlinkCode-Portable-<version>-x64.exe`
   - `latest.yml`
8. Paste the changelog into the description
9. Publish

---

<p align="right"><a href="#table-of-contents">↑ Back to top</a> · <a href="../README.md">↑ Docs home</a></p>

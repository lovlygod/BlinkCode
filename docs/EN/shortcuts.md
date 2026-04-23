# Keyboard shortcuts

<p>
  <a href="../README.md">↑ Docs home</a>
  &nbsp;·&nbsp;
  <a href="../RU/shortcuts.md">🇷🇺 На русском</a>
  &nbsp;·&nbsp;
  <a href="./features.md">→ Features</a>
</p>

All bindings below work on Windows and Linux. On macOS, `Ctrl` becomes `Cmd`
and `Alt` becomes `Option` unless noted otherwise.

---

## Table of Contents

1. [Editor basics](#editor-basics)
2. [Navigation](#navigation)
3. [Selection & multi-cursor](#selection--multi-cursor)
4. [Search & replace (inside file)](#search--replace-inside-file)
5. [Language intelligence (LSP)](#language-intelligence-lsp)
6. [Refactoring](#refactoring)
7. [Formatting](#formatting)
8. [Terminal & panels](#terminal--panels)
9. [Windows & application](#windows--application)
10. [DevTools](#devtools)

---

## Editor basics

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save current file |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+X` | Cut line (when no selection) / Cut selection |
| `Ctrl+C` | Copy line (when no selection) / Copy selection |
| `Ctrl+V` | Paste |
| `Ctrl+A` | Select all |
| `Tab` / `Shift+Tab` | Indent / outdent |
| `Ctrl+/` | Toggle line comment |
| `Shift+Alt+A` | Toggle block comment |
| `Alt+↑` / `Alt+↓` | Move line up / down |
| `Shift+Alt+↑` / `Shift+Alt+↓` | Copy line up / down |
| `Ctrl+Enter` | Insert line below |
| `Ctrl+Shift+Enter` | Insert line above |
| `Ctrl+Shift+K` | Delete line |

## Navigation

| Shortcut | Action |
|---|---|
| `Ctrl+P` | **Quick Open** — fuzzy file picker |
| `Ctrl+Shift+P` | **Command Palette** |
| `Ctrl+G` | Go to line |
| `Ctrl+Shift+O` | Go to symbol in file (document outline) |
| `F12` | Go to definition |
| `Ctrl+Click` | Go to definition |
| `Alt+F12` | Peek definition |
| `Shift+F12` | Find all references |
| `Ctrl+Home` / `Ctrl+End` | Top / bottom of file |
| `Ctrl+←` / `Ctrl+→` | Move by word |
| `Ctrl+↑` / `Ctrl+↓` | Scroll without moving cursor |

## Selection & multi-cursor

| Shortcut | Action |
|---|---|
| `Alt+Click` | Add cursor at click position |
| `Ctrl+Alt+↑` / `Ctrl+Alt+↓` | Add cursor above / below |
| `Ctrl+D` | Add next occurrence of selection to selection |
| `Ctrl+Shift+L` | Select all occurrences of current selection |
| `Shift+Alt+drag` | Column (box) selection |
| `Ctrl+L` | Select current line |
| `Ctrl+Shift+\` | Jump to matching bracket |

## Search & replace (inside file)

| Shortcut | Action |
|---|---|
| `Ctrl+F` | Find |
| `Ctrl+H` | Replace |
| `F3` / `Shift+F3` | Find next / previous |
| `Alt+Enter` | Select all find matches |
| `Esc` | Close find widget |

## Language intelligence (LSP)

See [lsp.md](./lsp.md) for what each command does under the hood.

| Shortcut | Action |
|---|---|
| `Ctrl+Space` | Trigger suggestions (autocomplete) |
| `Ctrl+Shift+Space` | Trigger parameter hints (signature help) |
| Hover | Show types and docs |
| `F12` | Go to definition |
| `Shift+F12` | Find all references |
| `Ctrl+Shift+O` | Document symbols / outline |
| `Ctrl+.` | Quick fix / code actions (add missing import, organize imports, etc.) |

## Refactoring

| Shortcut | Action |
|---|---|
| `F2` | Rename symbol (cross-file) |
| `Ctrl+.` | Code actions menu |

## Formatting

| Shortcut | Action |
|---|---|
| `Shift+Alt+F` | Format document |
| `Ctrl+K Ctrl+F` | Format selection |

## Terminal & panels

| Shortcut | Action |
|---|---|
| Click on activity bar icon | Switch sidebar panel (files / search / AI / settings) |
| `` Ctrl+` `` *(if bound)* | Toggle terminal — see [`Terminal`](../../src/components/Terminal/Terminal.tsx) |
| Click a URL in terminal | Open it in the embedded [`BrowserPreview`](../../src/components/BrowserPreview/BrowserPreview.tsx) |

## Windows & application

| Shortcut | Action |
|---|---|
| `Alt+F4` | Close window |
| Window controls | Custom titlebar — [`TopHeader`](../../src/components/TopHeader/TopHeader.tsx) |

## DevTools

| Shortcut | Action |
|---|---|
| `F12` (Electron chrome) | Toggle DevTools *(also `Ctrl+Shift+I`)* |
| `Ctrl+Shift+I` | Toggle DevTools |
| Auto-open in dev | DevTools open automatically when you run `npm run electron:dev` |

> ⚠️ `F12` is used by **both** Monaco (go to definition) and Electron DevTools.
> Inside the editor area it goes to definition; outside the editor (sidebar,
> terminal, panels) it toggles DevTools.

---

<p align="right"><a href="#table-of-contents">↑ Back to top</a> · <a href="../README.md">↑ Docs home</a></p>

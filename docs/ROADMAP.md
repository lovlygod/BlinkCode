# BlinkCode Roadmap

BlinkCode is a desktop-first code editor focused on fast local development, modern web workflows, real language tooling, and AI-assisted productivity. This roadmap describes what is implemented, what is planned, and why each feature matters.

The goal of this document is to be readable on GitHub. Detailed implementation notes should live in issues, pull requests, or dedicated technical documents.

## Status legend

| Status | Meaning |
| --- | --- |
| [x] Done | Implemented and usable in the app. |
| [ ] In progress | Partially implemented or actively being improved. |
| [ ] Planned | Planned feature that has not been implemented yet. |
| [ ] Future | Long-term idea that needs product and technical validation. |

## Priority legend

| Priority | Meaning |
| --- | --- |
| P0 | Core IDE functionality. |
| P1 | Important feature for daily development. |
| P2 | Quality-of-life or customization improvement. |
| P3 | Long-term platform or ecosystem work. |

---

## 1. Core editor and workspace

These features define BlinkCode as an actual IDE rather than a simple text editor.

### 1.1 Language Server Protocol

- **Priority:** P0
- [x] **Status:** Done
- **Description:** BlinkCode should provide real editor intelligence through language servers instead of only Monaco's basic browser features.
- **Current state:** TypeScript, JavaScript, JSX, TSX, HTML, CSS, SCSS, LESS and JSON language tooling is wired through the backend and Monaco integration.
- **Why it matters:** Developers expect go to definition, references, rename, formatting, diagnostics, hover information and code actions to work consistently.
- **Next improvements:** Make diagnostics easier to inspect, improve server restart handling, and expose language-server status in the UI.

### 1.2 Global search and replace

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Add workspace-wide text search and replace with file filters, result previews and safe batch replacement.
- **Current state:** Implemented with a backend recursive search/replace service, `/api/search` and `/api/search/replace` endpoints, a dedicated Search panel, regex/case/whole-word options, include/exclude filters, grouped file results, preview highlighting, click-to-open matches, and replace-all flow.
- **Why it matters:** Local projects quickly become hard to navigate without fast search across all files.
- **Next improvements:** Add single-match replace, streamed search results for very large workspaces, and optional `ripgrep` acceleration when available.

### 1.3 Quick Open

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Open files quickly with `Ctrl+P` using fuzzy matching and keyboard navigation.
- **Current state:** The app has a Quick Open UI with file search and Enter-to-open behavior.
- **Why it matters:** Keyboard-first navigation is essential for a productive IDE workflow.
- **Next improvements:** Rank recently opened files higher and support symbol navigation later.

### 1.4 Command Palette

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Provide a central command launcher with `Ctrl+Shift+P`.
- **Current state:** Commands are searchable and grouped into categories.
- **Why it matters:** A command palette keeps advanced features discoverable without adding too many visible buttons.
- **Next improvements:** Add command history, recently used commands and extension/plugin contribution points.

### 1.5 Problems panel

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Show all diagnostics from the current workspace in one panel.
- **Current state:** Reads Monaco/LSP markers every 2 seconds, groups by file, shows errors/warnings/info with severity icons. Filter by All/Errors/Warnings. Click to navigate to exact line. Error and warning counts shown in StatusBar with toggle button.
- **Why it matters:** Inline diagnostics are useful, but large projects need a dedicated list of errors and warnings.
- **Next improvements:** Add resizable panel height, keyboard navigation, and problem quick-fix integration.

### 1.6 File watcher

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Watch workspace file changes and update the UI when files are created, renamed, changed or deleted outside the app.
- **Current state:** Backend file watching is implemented with `chokidar` and frontend updates are delivered over a websocket channel.
- **Why it matters:** The editor must stay in sync with external tools like Git, package managers and terminals.
- **Next improvements:** Improve event batching and conflict handling when a file is modified both inside and outside the editor.

### 1.7 Split editor and tab workflow

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Support multiple editor panes and a stronger tab workflow.
- **Current state:** BlinkCode has a split editor mode and tab management features.
- **Why it matters:** Developers often compare files, edit related files side by side, or keep tests and source open together.
- **Next improvements:** Add drag-and-drop tab movement between panes and better restoration of split layout.

### 1.8 SQLite persistence

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Persist IDE state in SQLite instead of relying on a JSON state file.
- **Current state:** `better-sqlite3` is used for local persistence. The database stores editor state, settings, recent projects, search history, command history and file cursor positions.
- **Why it matters:** SQLite gives safer writes, structured storage and room for future state like request history, AI context indexes and workspace metadata.
- **Next improvements:** Add schema migrations with explicit version numbers and restore cursor/view state per file from the database.

### 1.9 Status bar

- **Priority:** P1
- [x] **Status:** Done
- **Description:** Show useful editor and workspace metadata at the bottom of the app.
- **Current state:** The status bar displays editor-related information such as cursor details, indentation, language and Git branch.
- **Why it matters:** A status bar gives important context without interrupting the workflow.
- **Next improvements:** Add language-server status, formatting mode and current workspace status.

---

## 2. Git and source control

Git integration should make BlinkCode useful as a daily development environment without constantly switching to a terminal.

### 2.1 Source Control panel

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Add a dedicated Git panel for changed files, staged files and commits.
- **Why it matters:** Source control is a core IDE feature. Users should be able to review and commit changes visually.
- **Current state:** Source Control panel is implemented end-to-end with backend Git API (`/api/git/status`, `/api/git/stage`, `/api/git/unstage`, `/api/git/discard`, `/api/git/commit`, `/api/git/file-diff`, `/api/git/pull`, `/api/git/push`), staged/unstaged/untracked sections, stage/unstage/discard actions, custom discard confirmation modal, commit input with `Ctrl+Enter`, pull/push actions in header, branch display, auto-refresh, and shared resizable sidebar width.
- **Completed in this cycle:** Added diff preview on file click with reliable side-by-side view, hidden virtual diff nodes from Explorer and Breadcrumb, improved Git error reporting with actionable messages, and pull/push fallback handling for missing upstream/tracking branches.
- **Next improvements:** Inline diff gutter decorations in Monaco, merge conflict handling UX, and amend commit support.

### 2.2 Inline diff and gutter indicators

- **Priority:** P0
- [x] **Status:** Done
- **Description:** Display changed lines directly in the editor gutter and provide file diff views.
- **Why it matters:** Developers need to see what changed without opening an external Git tool.
- **Expected behavior:** Added, modified and deleted lines should be highlighted. Users should be able to open a diff against `HEAD`.
- **Current state:** Inline Git decorations are rendered directly in Monaco for added/modified/deleted hunks, including gutter stripes and whole-line highlighting. Untracked files receive immediate local "added" highlighting on open, with cache-assisted re-render when switching between files.
- **Completed in this cycle:** Added backend inline diff API integration, client-side hunk mapping, stable side-by-side diff preview, extracted diff UI into a dedicated component (`DiffPreview`), synchronized pane scrolling, syntax highlighting in diff preview, and improved visual gutter placement.
- **Notes:** Diff preview is opened from Source Control file entries and uses virtual diff tabs with cleaned display paths.

### 2.3 Git blame inline

- **Priority:** P1
- [ ] **Status:** In progress
- **Description:** Show who last changed a line and when.
- **Why it matters:** Blame information helps understand ownership and history while reading code.
- **Expected behavior:** Show blame details for the current line by default, with optional expanded information on hover.
- **Current state:** Backend endpoint `/api/git/blame-line` is implemented with short-lived cache keyed by workspace + `HEAD` + file + line. Frontend API client is added and editor-side inline blame label renders author, summary and short SHA for the active cursor line.
- **Completed in this cycle:** Added debounce + lazy-load fetching strategy for cursor movement, plus client-side caching for fast repeated lookups while switching between lines/files.
- **Next improvements:** Show relative time, add hover details, and make blame visibility configurable in settings.

### 2.4 GitHub and GitLab integration

- **Priority:** P2
- [ ] **Status:** Future
- **Description:** Connect repository hosting features directly into BlinkCode.
- **Why it matters:** Pull requests, issues and reviews are part of modern development workflows.
- **Expected behavior:** Users could create pull requests, checkout branches, view review comments and open remote repository links.
- **Implementation direction:** Start with GitHub device authentication and read-only repository metadata before adding write actions.

---

## 3. Web development workflow

BlinkCode is focused on web and app projects, so common frontend tooling should feel native.

### 3.1 NPM scripts panel

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Detect `package.json` scripts and run them from a dedicated panel.
- **Why it matters:** Developers frequently run `dev`, `build`, `test`, `lint` and formatting scripts.
- **Expected behavior:** Show scripts from the current project, run them in integrated terminals and display running state.
- **Implementation direction:** Parse root and nested `package.json` files, then launch scripts through the existing terminal backend.

### 3.2 Dependency manager

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Show project dependencies and common package actions.
- **Why it matters:** Dependency updates and package inspection are common in web projects.
- **Expected behavior:** Show installed dependencies, versions, outdated packages and quick actions for install/update/remove.
- **Implementation direction:** Parse package manager lockfiles and optionally call package manager commands with user confirmation.

### 3.3 Smart Browser Preview

- **Priority:** P1
- [ ] **Status:** In progress
- **Description:** Improve the embedded browser preview for local web apps.
- **Current state:** A basic webview/browser preview exists.
- **Why it matters:** Web developers need to run and preview applications without leaving the IDE.
- **Next improvements:** Auto-detect local dev server URLs, attach preview automatically, add reload controls, device sizes and better error states.

### 3.4 JavaScript and Node debugger

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Add debugging for Node and browser JavaScript workflows.
- **Why it matters:** Breakpoints, step debugging and variable inspection are expected in serious development tools.
- **Expected behavior:** Users should be able to start debug sessions, attach to running processes and inspect call stacks.
- **Implementation direction:** Use Chrome DevTools Protocol or a debug adapter integration.

### 3.5 Tailwind and CSS tooling

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Improve Tailwind and CSS developer experience.
- **Why it matters:** Tailwind is common in modern web projects and needs class suggestions, diagnostics and formatting support.
- **Expected behavior:** Tailwind class autocomplete, hover previews, invalid class warnings and optional class sorting.
- **Implementation direction:** Integrate Tailwind language tooling and expose settings for project-specific configuration.

### 3.6 REST Client

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Run HTTP requests from `.http` files inside the editor.
- **Why it matters:** API testing is part of web development and should not require a separate app for simple workflows.
- **Expected behavior:** Send requests, show responses, support variables and keep request history.
- **Implementation direction:** Parse `.http` files and store request history in SQLite.

### 3.7 Markdown preview

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Add live preview for Markdown and MDX files.
- **Why it matters:** Documentation is part of most repositories, and previewing docs improves writing flow.
- **Expected behavior:** Split preview, synchronized scrolling and GitHub-like rendering.
- **Implementation direction:** Use a safe Markdown renderer and restrict unsafe HTML by default.

### 3.8 Schema-aware JSON and YAML

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Validate common configuration files using schemas.
- **Why it matters:** Many project files are JSON or YAML and benefit from completion and validation.
- **Expected behavior:** Provide schemas for `package.json`, `tsconfig.json`, ESLint configs, deployment configs and other common files.
- **Implementation direction:** Configure Monaco JSON defaults and add YAML language tooling later.

### 3.9 `.env` editor

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Provide safer editing for environment files.
- **Why it matters:** `.env` files often contain secrets and should be handled carefully.
- **Expected behavior:** Syntax highlighting, duplicate key detection, optional masking and warnings before accidental exposure.
- **Implementation direction:** Add a lightweight parser and secret-aware UI behavior.

### 3.10 Project templates

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Create new projects from common templates.
- **Why it matters:** A good first-run experience helps users start quickly.
- **Expected behavior:** Choose a template, target folder and package manager, then scaffold the project.
- **Implementation direction:** Start with local templates and later support framework CLIs with confirmation.

---

## 4. AI features

AI should be useful, transparent and safe. The user must remain in control of file changes and commands.

### 4.1 AI inline completions

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Show AI suggestions as ghost text inside the editor.
- **Why it matters:** Inline completions speed up repetitive code writing without interrupting flow.
- **Expected behavior:** Suggestions should be cancellable, accepted with a shortcut and aware of the current file context.
- **Implementation direction:** Use Monaco inline completions provider and keep requests debounced.

### 4.2 Context-aware AI chat

- **Priority:** P1
- [ ] **Status:** In progress
- **Description:** Improve the AI panel with better project context.
- **Current state:** An AI panel exists.
- **Why it matters:** AI is more useful when it understands the current file, selected code and project structure.
- **Next improvements:** Add selected-code context, open-file context, workspace search context and optional retrieval over indexed files.

### 4.3 AI agent with tools

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Let AI perform multi-step coding tasks with controlled tools.
- **Why it matters:** This is a major differentiator for a modern IDE.
- **Expected behavior:** The agent should propose file edits, run safe checks and ask for confirmation before destructive actions.
- **Implementation direction:** Build a tool layer for file reads, edits, terminal commands and project search with strict permission handling.

### 4.4 AI quick actions

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Add one-click actions for selected code.
- **Why it matters:** Common AI tasks should be available without writing prompts every time.
- **Expected behavior:** Explain, refactor, fix, document, generate tests and optimize selected code.
- **Implementation direction:** Add command palette actions and context menu entries that pass structured prompts to the AI panel.

---

## 5. Productivity and customization

These features make BlinkCode more comfortable for long daily sessions.

### 5.1 Snippets

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Support reusable code snippets.
- **Why it matters:** Snippets reduce repetitive typing and help teams standardize patterns.
- **Expected behavior:** User-defined snippets, language-specific snippets and tab stops.
- **Implementation direction:** Store snippets in user settings and connect them to Monaco completion providers.

### 5.2 Keybindings editor

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Add a UI for viewing and customizing shortcuts.
- **Why it matters:** Keyboard-first users need control over their workflow.
- **Expected behavior:** Search shortcuts, detect conflicts and reset bindings to defaults.
- **Implementation direction:** Store keybindings in settings and route commands through a central command registry.

### 5.3 Settings JSON and UI

- **Priority:** P2
- [x] **Status:** Done
- **Description:** Support both visual settings and JSON-based configuration.
- **Current state:** Fully implemented. Global settings are stored in `%APPDATA%/BlinkCode/settings.json`, workspace overrides in `<project>/.blinkcode/settings.json`. Settings merge with priority: defaults → global → workspace. The SettingsPanel includes "User JSON" and "Workspace JSON" buttons that open the respective files as editable tabs in Monaco. Auto-save and Ctrl+S apply changes immediately. REST API endpoints expose settings for external tooling.
- **Why it matters:** Beginners prefer UI controls, while advanced users expect precise JSON configuration.
- **Commit:** `3bc882d` — feat: add JSON-based settings with global/workspace support

### 5.4 VS Code theme import

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Import VS Code theme files and apply them to BlinkCode.
- **Why it matters:** Themes are personal, and VS Code has a large theme ecosystem.
- **Expected behavior:** Import a theme JSON file and map editor colors, token colors and UI colors where possible.
- **Implementation direction:** Start with token colors and gradually map workbench colors to BlinkCode CSS variables.

### 5.5 Multi-root workspace

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Support multiple folders in a single workspace.
- **Why it matters:** Many projects are monorepos or depend on multiple local folders.
- **Expected behavior:** Show multiple roots in the explorer and keep per-root search, Git and settings behavior clear.
- **Implementation direction:** Introduce a workspace model instead of a single workspace path.

### 5.6 Zen / Focus mode

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Hide non-essential UI for focused editing.
- **Why it matters:** Some tasks benefit from a distraction-free interface.
- **Expected behavior:** Toggle sidebars, panels and extra UI while keeping the editor centered.
- **Implementation direction:** Add a command and persist the preference in settings.

### 5.7 Minimap, sticky scroll and breadcrumbs

- **Priority:** P2
- [ ] **Status:** In progress
- **Description:** Improve navigation inside large files.
- **Current state:** Breadcrumbs exist; Monaco supports related editor options.
- **Why it matters:** Large files are easier to navigate with structural context.
- **Next improvements:** Add settings toggles for minimap and sticky scroll.

### 5.8 Bracket colorization and indent guides

- **Priority:** P2
- [x] **Status:** Done
- **Description:** Improve code readability with bracket pair colorization and indentation guides.
- **Current state:** Monaco options are wired through the editor settings.
- **Why it matters:** These small visual aids reduce mistakes in nested code.
- **Next improvements:** Add per-language defaults if needed.

### 5.9 Spell checker

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Add spell checking for Markdown, comments and documentation.
- **Why it matters:** Developers write documentation and user-facing text inside the editor.
- **Expected behavior:** Highlight spelling issues and provide suggestions.
- **Implementation direction:** Keep it optional and avoid checking code identifiers by default.

### 5.10 Trash / soft delete

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Move deleted files to the system trash instead of permanently deleting them.
- **Why it matters:** Permanent deletion is risky in a file explorer.
- **Expected behavior:** Deleting a file should be reversible through OS trash where possible.
- **Implementation direction:** Use Electron shell trash APIs or platform-specific safe delete behavior.

---

## 6. Platform and distribution

These features expand BlinkCode from a local Windows-focused app into a broader development platform.

### 6.1 Plugin system

- **Priority:** P3
- [ ] **Status:** Future
- **Description:** Allow external extensions to contribute commands, UI and language features.
- **Why it matters:** A plugin ecosystem can grow BlinkCode beyond built-in features.
- **Expected behavior:** Plugins should be sandboxed and have explicit permissions.
- **Implementation direction:** Start with command and menu contributions before exposing deeper APIs.

### 6.2 Remote development

- **Priority:** P3
- [ ] **Status:** Future
- **Description:** Support WSL, SSH and Dev Containers workflows.
- **Why it matters:** Many developers work in remote or containerized environments.
- **Expected behavior:** Open remote folders, run terminals remotely and keep editor operations consistent.
- **Implementation direction:** Start with WSL detection and remote filesystem abstraction.

### 6.3 Live Share

- **Priority:** P3
- [ ] **Status:** Future
- **Description:** Add collaborative editing sessions.
- **Why it matters:** Pair programming and live debugging are valuable for teams.
- **Expected behavior:** Share workspace, editor location and selected files with collaborators.
- **Implementation direction:** Requires networking, identity and security design before implementation.

### 6.4 One-click deploy

- **Priority:** P3
- [ ] **Status:** Future
- **Description:** Deploy common web projects directly from BlinkCode.
- **Why it matters:** Deployment is part of the web development lifecycle.
- **Expected behavior:** Detect supported frameworks and provide guided deployment actions.
- **Implementation direction:** Start with generated terminal commands and later integrate provider APIs.

### 6.5 macOS and Linux builds

- **Priority:** P3
- [ ] **Status:** Planned
- **Description:** Publish BlinkCode builds for macOS and Linux.
- **Why it matters:** Cross-platform support makes the project usable by more developers.
- **Current state:** Windows is the primary distribution target.
- **Implementation direction:** Validate native dependencies, packaging scripts, icons and update flow per platform.

### 6.6 Auto-update

- **Priority:** P3
- [ ] **Status:** Planned
- **Description:** Add automatic updates for packaged desktop releases.
- **Why it matters:** Users should receive fixes and improvements without manually downloading every release.
- **Expected behavior:** Check for updates, show release notes and install safely.
- **Implementation direction:** Integrate Electron updater flow with GitHub Releases.

### 6.7 Opt-in telemetry

- **Priority:** P3
- [ ] **Status:** Future
- **Description:** Collect privacy-first usage metrics only if the user explicitly enables it.
- **Why it matters:** Anonymous product insights can help prioritize work, but user trust is more important.
- **Expected behavior:** Disabled by default, transparent data list and one-click opt out.
- **Implementation direction:** Define policy before writing any telemetry code.

---

## 7. Reliability and polish

These tasks reduce friction and make the editor feel stable.

### 7.1 Trim whitespace and final newline

- **Priority:** P2
- [x] **Status:** Done
- **Description:** Automatically clean trailing whitespace and ensure final newlines based on settings.
- **Why it matters:** Keeps files clean and avoids noisy diffs.
- **Current state:** Settings exist in the editor configuration.

### 7.2 EditorConfig support

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Respect `.editorconfig` files in workspaces.
- **Why it matters:** Many teams define indentation, line endings and newline behavior through EditorConfig.
- **Expected behavior:** Apply settings per file based on the closest matching `.editorconfig`.

### 7.3 Auto-save on focus change

- **Priority:** P2
- [ ] **Status:** In progress
- **Description:** Add focus-change autosave mode in addition to timer-based autosave.
- **Why it matters:** Users expect flexible autosave modes similar to other editors.
- **Current state:** Timer-based autosave exists.
- **Next improvements:** Save when editor loses focus or when the app window loses focus.

### 7.4 Recent files

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Add fast switching between recently used files.
- **Why it matters:** Developers often jump between a small set of files repeatedly.
- **Expected behavior:** `Ctrl+Tab` should cycle through recent files and show a quick picker.

### 7.5 Go to line

- **Priority:** P2
- [x] **Status:** Done
- **Description:** Jump to a specific line with `Ctrl+G`.
- **Current state:** Monaco provides this action.
- **Why it matters:** Useful for stack traces, logs and diagnostics.

### 7.6 Multi-cursor and column selection

- **Priority:** P2
- [x] **Status:** Done
- **Description:** Support advanced editing with multiple cursors and column selection.
- **Current state:** Monaco provides these capabilities.
- **Why it matters:** Multi-cursor editing is essential for fast repetitive changes.

### 7.7 OS drag and drop

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Allow users to drag files or folders from the operating system into BlinkCode.
- **Why it matters:** Drag-and-drop is a natural desktop workflow.
- **Expected behavior:** Dropping a folder opens it; dropping files opens them as tabs.

### 7.8 Reveal in Explorer

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Reveal the selected file in the system file manager.
- **Why it matters:** Users often need to interact with files outside the IDE.
- **Expected behavior:** Context menu action on files and tabs.

### 7.9 Copy path

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Copy absolute or relative file paths from the explorer and tabs.
- **Why it matters:** File paths are often needed in terminals, docs and issue reports.
- **Expected behavior:** Context menu options for absolute path, relative path and file name.

### 7.10 Last cursor position

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Restore cursor and scroll position when reopening files.
- **Why it matters:** Returning to the exact editing location saves time.
- **Implementation direction:** Store Monaco view state or line/column data in SQLite.

---

## 8. Security and data handling

Security work should be explicit because BlinkCode runs local commands and reads local files.

### 8.1 Path traversal tests

- **Priority:** P1
- [ ] **Status:** In progress
- **Description:** Test path validation for file APIs.
- **Current state:** Backend path safety helpers exist.
- **Why it matters:** File APIs must not allow access outside the intended workspace.
- **Next improvements:** Add automated tests for invalid paths, symlinks and encoded traversal attempts.

### 8.2 Content Security Policy

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Add a strict CSP for the Electron and web entry points.
- **Why it matters:** CSP reduces the risk of script injection and unsafe resource loading.
- **Expected behavior:** Development and production builds should have appropriate policies.

### 8.3 Secret storage

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Store tokens and sensitive credentials through OS-backed secure storage.
- **Why it matters:** API keys and auth tokens must not be stored in plain text project files.
- **Implementation direction:** Evaluate keytar or Electron-safe alternatives.

### 8.4 AI sandbox and confirmations

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Guard AI actions that modify files or run commands.
- **Why it matters:** AI automation must be safe and reviewable.
- **Expected behavior:** The user approves destructive actions and can inspect diffs before applying edits.

### 8.5 Large file limits

- **Priority:** P2
- [ ] **Status:** In progress
- **Description:** Protect the editor from loading huge or binary files accidentally.
- **Current state:** Binary detection exists.
- **Why it matters:** Large files can freeze the UI or consume too much memory.
- **Next improvements:** Add explicit size thresholds, warnings and read-only preview modes.

### 8.6 Recovery storage

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Recover unsaved edits after crashes or forced exits.
- **Why it matters:** Data loss is one of the worst editor experiences.
- **Implementation direction:** Store temporary dirty buffer snapshots in SQLite with cleanup rules.

---

## 9. Tests and automation

Testing and CI are required before BlinkCode can grow safely.

### 9.1 Unit tests

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Add unit tests for reducers, utilities and backend helpers.
- **Why it matters:** Core behavior should stay stable during refactors.
- **Expected coverage:** State restoration, safe path handling, file operations and settings logic.

### 9.2 End-to-end tests

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Test the app as a user would use it.
- **Why it matters:** IDE features often break through integration issues rather than isolated functions.
- **Expected coverage:** Startup, open folder, open file, edit/save, terminal creation and settings changes.

### 9.3 CI pipeline

- **Priority:** P1
- [ ] **Status:** Planned
- **Description:** Run checks automatically on pull requests.
- **Why it matters:** CI prevents broken builds from landing in `main`.
- **Expected behavior:** Lint, typecheck, build and selected tests should run on every pull request.

### 9.4 Release checklist

- **Priority:** P2
- [ ] **Status:** Planned
- **Description:** Document and automate release steps.
- **Why it matters:** Releases should be repeatable and less error-prone.
- **Expected behavior:** Version bump, changelog, build artifacts and GitHub release notes are handled consistently.

---

## Roadmap status overview

This table is the quick checklist for tracking what is already implemented and what still needs work.

| ID | Feature | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Language Server Protocol | P0 | [x] Done | TypeScript, JavaScript, HTML, CSS and JSON tooling is wired through Monaco/LSP. |
| 1.2 | Global search and replace | P0 | [x] Done | Search panel with filters, previews, click-to-open results and replace-all flow. |
| 1.3 | Quick Open | P0 | [x] Done | Fuzzy file picker is available through `Ctrl+P`. |
| 1.4 | Command Palette | P0 | [x] Done | Command launcher is available through `Ctrl+Shift+P`. |
| 1.5 | Problems panel | P0 | [x] Done | Diagnostics panel with severity filter, click-to-navigate and StatusBar counts. |
| 1.6 | File watcher | P0 | [x] Done | Workspace changes are watched through the backend and pushed to the UI. |
| 1.7 | Split editor and tab workflow | P0 | [x] Done | Split mode and tab management are implemented. |
| 1.8 | SQLite persistence | P0 | [x] Done | `better-sqlite3` stores editor state, settings, recent projects and histories. |
| 1.9 | Status bar | P1 | [x] Done | Shows editor and workspace metadata. |
| 2.1 | Source Control panel | P0 | [x] Done | Full panel with stage/unstage/discard/commit, pull/push, diff preview, error handling and resizable layout. |
| 2.2 | Inline diff and gutter indicators | P0 | [x] Done | Monaco gutter/line decorations, inline diff hunks, extracted diff preview component with synced panes and syntax coloring. |
| 2.3 | Git blame inline | P1 | [ ] In progress | Blame-line endpoint + editor inline label + debounce/caching implemented; UX polish and settings toggle pending. |
| 2.4 | GitHub and GitLab integration | P2 | [ ] Future | Requires authentication and provider API design. |
| 3.1 | NPM scripts panel | P1 | [ ] Planned | Needs script detection from `package.json` and terminal integration. |
| 3.2 | Dependency manager | P1 | [ ] Planned | Needs dependency list, outdated checks and package actions. |
| 3.3 | Smart Browser Preview | P1 | [ ] In progress | Basic preview exists; auto-detection and device tools are planned. |
| 3.4 | JavaScript and Node debugger | P1 | [ ] Planned | Needs CDP or debug-adapter integration. |
| 3.5 | Tailwind and CSS tooling | P1 | [ ] Planned | Needs Tailwind IntelliSense and better CSS diagnostics. |
| 3.6 | REST Client | P1 | [ ] Planned | Needs `.http` parser, response UI and history storage. |
| 3.7 | Markdown preview | P2 | [ ] Planned | Needs safe live preview and synchronized scrolling. |
| 3.8 | Schema-aware JSON and YAML | P2 | [ ] Planned | Needs built-in schemas and YAML tooling. |
| 3.9 | `.env` editor | P2 | [ ] Planned | Needs syntax support, validation and secret-aware behavior. |
| 3.10 | Project templates | P2 | [ ] Planned | Needs template picker and scaffold flow. |
| 4.1 | AI inline completions | P1 | [ ] Planned | Needs Monaco inline completion provider. |
| 4.2 | Context-aware AI chat | P1 | [ ] In progress | AI panel exists; richer file/project context is planned. |
| 4.3 | AI agent with tools | P1 | [ ] Planned | Needs controlled file, search and terminal tools. |
| 4.4 | AI quick actions | P2 | [ ] Planned | Needs explain, refactor, fix and test-generation actions. |
| 5.1 | Snippets | P2 | [ ] Planned | Needs user-defined and language-specific snippets. |
| 5.2 | Keybindings editor | P2 | [ ] Planned | Needs searchable shortcut editor and conflict detection. |
| 5.3 | Settings JSON and UI | P2 | [x] Done | Global/workspace JSON settings with merge priority and editable virtual tabs. |
| 5.4 | VS Code theme import | P2 | [ ] Planned | Needs theme JSON mapping to Monaco and app CSS variables. |
| 5.5 | Multi-root workspace | P2 | [ ] Planned | Needs workspace model with multiple roots. |
| 5.6 | Zen / Focus mode | P2 | [ ] Planned | Needs UI visibility toggles and persisted preference. |
| 5.7 | Minimap, sticky scroll and breadcrumbs | P2 | [ ] In progress | Breadcrumbs exist; minimap and sticky scroll need settings. |
| 5.8 | Bracket colorization and indent guides | P2 | [x] Done | Monaco options are wired through settings. |
| 5.9 | Spell checker | P2 | [ ] Planned | Needs optional checks for Markdown, comments and docs. |
| 5.10 | Trash / soft delete | P2 | [ ] Planned | Needs system trash integration instead of permanent delete. |
| 6.1 | Plugin system | P3 | [ ] Future | Requires extension API and sandbox design. |
| 6.2 | Remote development | P3 | [ ] Future | Needs WSL, SSH or container filesystem abstraction. |
| 6.3 | Live Share | P3 | [ ] Future | Requires collaboration, identity and security design. |
| 6.4 | One-click deploy | P3 | [ ] Future | Needs framework detection and provider integrations. |
| 6.5 | macOS and Linux builds | P3 | [ ] Planned | Needs packaging validation beyond Windows. |
| 6.6 | Auto-update | P3 | [ ] Planned | Needs desktop update flow and release integration. |
| 6.7 | Opt-in telemetry | P3 | [ ] Future | Must be disabled by default and privacy-first. |
| 7.1 | Trim whitespace and final newline | P2 | [x] Done | Formatting hygiene settings are available. |
| 7.2 | EditorConfig support | P2 | [ ] Planned | Needs `.editorconfig` parser and per-file application. |
| 7.3 | Auto-save on focus change | P2 | [ ] In progress | Timer autosave exists; focus-change mode is planned. |
| 7.4 | Recent files | P2 | [ ] Planned | Needs `Ctrl+Tab` picker and recent-file tracking. |
| 7.5 | Go to line | P2 | [x] Done | Provided by Monaco. |
| 7.6 | Multi-cursor and column selection | P2 | [x] Done | Provided by Monaco. |
| 7.7 | OS drag and drop | P2 | [ ] Planned | Needs folder/file drop handling. |
| 7.8 | Reveal in Explorer | P2 | [ ] Planned | Needs context menu action and Electron shell integration. |
| 7.9 | Copy path | P2 | [ ] Planned | Needs absolute and relative path copy actions. |
| 7.10 | Last cursor position | P2 | [ ] Planned | Needs Monaco view-state persistence in SQLite. |
| 8.1 | Path traversal tests | P1 | [ ] In progress | Safe path helpers exist; automated tests are needed. |
| 8.2 | Content Security Policy | P1 | [ ] Planned | Needs CSP for Electron and web entry points. |
| 8.3 | Secret storage | P2 | [ ] Planned | Needs OS-backed secure storage for tokens. |
| 8.4 | AI sandbox and confirmations | P2 | [ ] Planned | Needs approvals for file mutations and command execution. |
| 8.5 | Large file limits | P2 | [ ] In progress | Binary detection exists; explicit size limits are planned. |
| 8.6 | Recovery storage | P2 | [ ] Planned | Needs dirty-buffer snapshots and crash recovery. |
| 9.1 | Unit tests | P1 | [ ] Planned | Needs coverage for reducers, utilities and server helpers. |
| 9.2 | End-to-end tests | P1 | [ ] Planned | Needs startup, file, terminal and settings flow tests. |
| 9.3 | CI pipeline | P1 | [ ] Planned | Needs lint, typecheck, build and test checks on pull requests. |
| 9.4 | Release checklist | P2 | [ ] Planned | Needs repeatable versioning, changelog and artifact process. |

---

## Suggested order of work

### Sprint 1 — finish core IDE foundation

- [x] Global search and replace.
- [x] Problems panel.
- [ ] Last cursor/view-state persistence.
- [ ] SQLite schema migration cleanup.

### Sprint 2 — Git workflow

- [x] Git status API
- [x] Source Control panel
- [x] Stage, unstage and commit actions
- [x] Inline diff and gutter indicators.

### Sprint 3 — web workflow

- [ ] NPM scripts panel.
- [ ] Browser Preview auto-detection.
- [ ] Tailwind and CSS tooling.
- [ ] REST Client basics.

### Sprint 4 — AI workflow

- [ ] Selected-code context in AI chat.
- [ ] Inline completions.
- [ ] Quick actions.
- [ ] Tool-using AI agent with confirmations.

### Sprint 5 — distribution and reliability

- [ ] CI pipeline.
- [ ] Auto-update.
- [ ] macOS and Linux build validation.
- [ ] Recovery storage.

---

## Maintenance rules

- Keep roadmap items clear and user-facing.
- Keep implementation details short; move deep technical notes into dedicated docs or issues.
- Update statuses after every completed feature.
- Prefer small, shippable milestones over broad vague goals.
- Do not include private notes, broken text, temporary experiments or duplicated lists in this file.

import { createLspSession, type LspSession } from './monacoAdapter';

type Monaco = any;
type MonacoModel = any;

const MONACO_LANG_TO_LSP_LANG: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'javascript',
  typescriptreact: 'typescriptreact',
  javascriptreact: 'javascriptreact',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  jsonc: 'jsonc',
};

type ServerKey = 'typescript' | 'html' | 'css' | 'json';

const MONACO_LANG_TO_SERVER_KEY: Record<string, ServerKey> = {
  typescript: 'typescript',
  javascript: 'typescript',
  typescriptreact: 'typescript',
  javascriptreact: 'typescript',
  html: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  json: 'json',
  jsonc: 'json',
};

const SERVER_KEY_TO_LANGS: Record<ServerKey, string[]> = {
  typescript: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
  html: ['html'],
  css: ['css', 'scss', 'less'],
  json: ['json', 'jsonc'],
};

interface CachedSession {
  session: LspSession;
  serverKey: string;
  workspacePath: string;
}

const cache = new Map<string, CachedSession>();
const wiredModels = new WeakSet<object>();
const builtinDisabledForServer = new Set<ServerKey>();

function disableMonacoBuiltin(monaco: Monaco, serverKey: ServerKey) {
  if (builtinDisabledForServer.has(serverKey)) return;
  builtinDisabledForServer.add(serverKey);
  try {
    if (serverKey === 'typescript') {
      const ts = monaco.languages?.typescript;
      if (ts) {
        const opts = {
          noSemanticValidation: true,
          noSyntaxValidation: true,
          noSuggestionDiagnostics: true,
          onlyVisible: true,
        };
        ts.typescriptDefaults?.setDiagnosticsOptions?.(opts);
        ts.javascriptDefaults?.setDiagnosticsOptions?.(opts);
        ts.typescriptDefaults?.setEagerModelSync?.(false);
        ts.javascriptDefaults?.setEagerModelSync?.(false);
        ts.typescriptDefaults?.setModeConfiguration?.({
          completionItems: false, hovers: false, documentSymbols: false,
          definitions: false, references: false, documentHighlights: false,
          rename: false, diagnostics: false, documentRangeFormattingEdits: false,
          signatureHelp: false, onTypeFormattingEdits: false, codeActions: false,
          inlayHints: false,
        });
        ts.javascriptDefaults?.setModeConfiguration?.({
          completionItems: false, hovers: false, documentSymbols: false,
          definitions: false, references: false, documentHighlights: false,
          rename: false, diagnostics: false, documentRangeFormattingEdits: false,
          signatureHelp: false, onTypeFormattingEdits: false, codeActions: false,
          inlayHints: false,
        });
      }
    } else if (serverKey === 'html') {
      monaco.languages?.html?.htmlDefaults?.setModeConfiguration?.({
        completionItems: false, hovers: false, documentSymbols: false,
        documentFormattingEdits: false, documentRangeFormattingEdits: false,
        documentHighlights: false, documentLinks: false, linkedEditingRanges: false,
        foldingRanges: false, selectionRanges: false, diagnostics: false, colors: false,
        renames: false,
      });
    } else if (serverKey === 'css') {
      const setCfg = {
        completionItems: false, hovers: false, documentSymbols: false,
        documentFormattingEdits: false, documentRangeFormattingEdits: false,
        documentHighlights: false, documentLinks: false, foldingRanges: false,
        selectionRanges: false, diagnostics: false, colors: false, renames: false,
      };
      monaco.languages?.css?.cssDefaults?.setModeConfiguration?.(setCfg);
      monaco.languages?.css?.scssDefaults?.setModeConfiguration?.(setCfg);
      monaco.languages?.css?.lessDefaults?.setModeConfiguration?.(setCfg);
    } else if (serverKey === 'json') {
      monaco.languages?.json?.jsonDefaults?.setModeConfiguration?.({
        completionItems: false, hovers: false, documentSymbols: false,
        documentFormattingEdits: false, documentRangeFormattingEdits: false,
        tokens: false, colors: false, foldingRanges: false, diagnostics: false,
        selectionRanges: false,
      });
    }
  } catch {}
}

function workspaceBase(): string {
  return '';
}

function buildLspUrl(serverKey: string): string {
  const loc = window.location;
  const host = loc.hostname;
  const port = loc.port === '5173' || loc.port === '5174' ? '3001' : loc.port;
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${host}:${port}/ws/lsp/${serverKey}`;
}

function modelToFileUri(model: MonacoModel, workspacePath: string): string {
  const raw = model.uri.toString();
  const rawPath = (model.uri.path || '').replace(/^\/+/, '');
  const looksAbsolute = /^[a-zA-Z]:/.test(rawPath) || rawPath.startsWith('/');
  if (raw.startsWith('file://') && looksAbsolute) return raw;
  if (!rawPath || !workspacePath) return raw;
  const base = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const full = `${base}/${rawPath}`;
  if (/^[a-zA-Z]:/.test(full)) return 'file:///' + encodeURI(full);
  return 'file://' + encodeURI(full);
}

function getLspLanguageForModel(model: MonacoModel, monacoLang: string): string {
  try {
    const path = String(model?.uri?.path || '').toLowerCase();
    if (path.endsWith('.tsx')) return 'typescriptreact';
    if (path.endsWith('.jsx')) return 'javascriptreact';
  } catch {}
  return MONACO_LANG_TO_LSP_LANG[monacoLang] || monacoLang;
}

function getSession(monaco: Monaco, workspacePath: string, serverKey: ServerKey): LspSession {
  const key = `${workspacePath}::${serverKey}`;
  const hit = cache.get(key);
  if (hit) return hit.session;
  disableMonacoBuiltin(monaco, serverKey);
  const session = createLspSession(monaco, {
    url: buildLspUrl(serverKey),
    workspacePath: workspacePath || workspaceBase(),
    languages: SERVER_KEY_TO_LANGS[serverKey],
    resolveUri: (model: MonacoModel) => modelToFileUri(model, workspacePath),
  });
  cache.set(key, { session, serverKey, workspacePath });
  return session;
}

/**
 * Attach LSP to a Monaco editor instance. Safe to call on every onMount;
 * already-wired models are skipped.
 */
export function attachLspToEditor(monaco: Monaco, editor: any, workspacePath: string) {
  const hook = (model: MonacoModel) => {
    if (!model || wiredModels.has(model)) return;
    const lang: string = model.getLanguageId?.() || '';
    const serverKey = MONACO_LANG_TO_SERVER_KEY[lang];
    if (!serverKey) return;
    if (!workspacePath) return;
    const lspLang = getLspLanguageForModel(model, lang);
    const session = getSession(monaco, workspacePath, serverKey);
    const uri = modelToFileUri(model, workspacePath);
    wiredModels.add(model);
    let version = 1;

    session.openDocument(uri, lspLang, model.getValue(), version);

    const sub = model.onDidChangeContent(() => {
      version += 1;
      session.updateDocument(uri, model.getValue(), version);
    });

    const disposeSub = model.onWillDispose(() => {
      try { sub.dispose(); } catch {}
      try { disposeSub.dispose(); } catch {}
      session.closeDocument(uri);
    });
  };

  const m = editor.getModel?.();
  if (m) hook(m);

  editor.onDidChangeModel?.((e: any) => {
    if (!e?.newModelUrl) return;
    const next = monaco.editor.getModel(e.newModelUrl);
    if (next) hook(next);
  });
}

/** For debugging/testing: teardown all sessions. */
export function shutdownAllLspSessions() {
  for (const { session } of cache.values()) {
    try { session.dispose(); } catch {}
  }
  cache.clear();
}

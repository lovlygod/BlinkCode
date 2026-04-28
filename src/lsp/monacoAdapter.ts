import { LspClient } from './client';

type Monaco = any;

export interface LspSessionConfig {
  /** Monaco language id(s) to register for (e.g. 'typescript','javascript','typescriptreact'). */
  languages: string[];
  /** LSP URL, e.g. ws://localhost:3001/ws/lsp/typescript */
  url: string;
  /** Absolute workspace path on server (used as rootUri / rootPath). */
  workspacePath: string;
  /** Resolves a Monaco model to the file URI used with the LSP. */
  resolveUri: (model: any) => string;
}

export interface LspSession {
  client: LspClient;
  dispose: () => void;
  /** Notify the LSP that a file has been opened (once per unique URI). */
  openDocument: (uri: string, languageId: string, text: string, version: number) => void;
  updateDocument: (uri: string, text: string, version: number) => void;
  closeDocument: (uri: string) => void;
}

function pathToUri(p: string): string {
  if (!p) return '';
  const norm = p.replace(/\\/g, '/');
  if (/^[a-zA-Z]:/.test(norm)) return 'file:///' + encodeURI(norm);
  if (norm.startsWith('/')) return 'file://' + encodeURI(norm);
  return 'file:///' + encodeURI(norm);
}

function monacoPositionToLsp(pos: { lineNumber: number; column: number }) {
  return { line: pos.lineNumber - 1, character: pos.column - 1 };
}

function lspRangeToMonaco(range: { start: any; end: any }, monaco: Monaco) {
  return new monaco.Range(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1,
  );
}

function lspTextEditsToMonaco(edits: any[] | undefined, monaco: Monaco): any[] | undefined {
  if (!edits || !Array.isArray(edits) || edits.length === 0) return undefined;
  return edits.map((e: any) => ({
    range: lspRangeToMonaco(e.range, monaco),
    text: e.newText ?? '',
  }));
}

function lspWorkspaceEditToMonaco(edit: any, monaco: Monaco): any | null {
  if (!edit) return null;
  const edits: any[] = [];
  if (edit.changes && typeof edit.changes === 'object') {
    for (const uri of Object.keys(edit.changes)) {
      for (const e of edit.changes[uri] || []) {
        edits.push({
          resource: monaco.Uri.parse(uri),
          textEdit: { range: lspRangeToMonaco(e.range, monaco), text: e.newText ?? '' },
          versionId: undefined,
        });
      }
    }
  }
  if (edit.documentChanges && Array.isArray(edit.documentChanges)) {
    for (const dc of edit.documentChanges) {
      if (!dc || !dc.textDocument || !Array.isArray(dc.edits)) continue;
      const uri = dc.textDocument.uri;
      for (const e of dc.edits) {
        edits.push({
          resource: monaco.Uri.parse(uri),
          textEdit: { range: lspRangeToMonaco(e.range, monaco), text: e.newText ?? '' },
          versionId: undefined,
        });
      }
    }
  }
  return { edits };
}

function lspSeverityToMarker(sev: number | undefined, monaco: Monaco) {
  switch (sev) {
    case 1: return monaco.MarkerSeverity.Error;
    case 2: return monaco.MarkerSeverity.Warning;
    case 3: return monaco.MarkerSeverity.Info;
    case 4: return monaco.MarkerSeverity.Hint;
    default: return monaco.MarkerSeverity.Info;
  }
}

function lspCompletionKindToMonaco(kind: number | undefined, monaco: Monaco) {
  const K = monaco.languages.CompletionItemKind;
  switch (kind) {
    case 1: return K.Text;
    case 2: return K.Method;
    case 3: return K.Function;
    case 4: return K.Constructor;
    case 5: return K.Field;
    case 6: return K.Variable;
    case 7: return K.Class;
    case 8: return K.Interface;
    case 9: return K.Module;
    case 10: return K.Property;
    case 11: return K.Unit;
    case 12: return K.Value;
    case 13: return K.Enum;
    case 14: return K.Keyword;
    case 15: return K.Snippet;
    case 16: return K.Color;
    case 17: return K.File;
    case 18: return K.Reference;
    case 19: return K.Folder;
    case 20: return K.EnumMember;
    case 21: return K.Constant;
    case 22: return K.Struct;
    case 23: return K.Event;
    case 24: return K.Operator;
    case 25: return K.TypeParameter;
    default: return K.Text;
  }
}

export function createLspSession(monaco: Monaco, cfg: LspSessionConfig): LspSession {
  const rootUri = pathToUri(cfg.workspacePath);
  const initializeParams = {
    processId: null,
    clientInfo: { name: 'BlinkCode', version: '0.4.0' },
    rootUri,
    rootPath: cfg.workspacePath,
    workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
    capabilities: {
      textDocument: {
        synchronization: { didSave: true, willSave: false, willSaveWaitUntil: false, dynamicRegistration: false },
        completion: {
          completionItem: {
            snippetSupport: true,
            insertReplaceSupport: true,
            resolveSupport: { properties: ['documentation', 'detail'] },
          },
          contextSupport: true,
        },
        hover: { contentFormat: ['markdown', 'plaintext'] },
        signatureHelp: { signatureInformation: { documentationFormat: ['markdown', 'plaintext'], parameterInformation: { labelOffsetSupport: true } } },
        definition: { linkSupport: true },
        references: {},
        rename: { prepareSupport: true },
        formatting: {},
        rangeFormatting: {},
        documentSymbol: { hierarchicalDocumentSymbolSupport: true },
        codeAction: {
          codeActionLiteralSupport: {
            codeActionKind: {
              valueSet: ['', 'quickfix', 'refactor', 'refactor.extract', 'refactor.inline', 'refactor.rewrite', 'source', 'source.organizeImports', 'source.fixAll'],
            },
          },
          resolveSupport: { properties: ['edit'] },
          dataSupport: true,
        },
        publishDiagnostics: { relatedInformation: true },
      },
      workspace: {
        workspaceFolders: true,
        configuration: true,
      },
    },
    initializationOptions: {
      preferences: {
        includeCompletionsForModuleExports: true,
        includeCompletionsForImportStatements: true,
        includeCompletionsWithSnippetText: true,
        includeAutomaticOptionalChainCompletions: true,
        importModuleSpecifierPreference: 'shortest',
        allowIncompleteCompletions: true,
      },
    },
  };

  const client = new LspClient(cfg.url, initializeParams);

  const openedDocs = new Set<string>();
  const disposables: Array<() => void> = [];

  const offDiag = client.on('textDocument/publishDiagnostics', (params: any) => {
    if (!params?.uri) return;
    let model = monaco.editor.getModel(monaco.Uri.parse(params.uri));
    if (!model) {
      for (const m of monaco.editor.getModels()) {
        try {
          if (cfg.resolveUri(m) === params.uri) { model = m; break; }
        } catch {}
      }
    }
    const markers = (params.diagnostics || []).map((d: any) => {
      const marker: any = {
        severity: lspSeverityToMarker(d.severity, monaco),
        message: d.message || '',
        startLineNumber: d.range.start.line + 1,
        startColumn: d.range.start.character + 1,
        endLineNumber: d.range.end.line + 1,
        endColumn: d.range.end.character + 1,
        source: d.source || 'lsp',
      };
      if (d.code !== undefined && d.code !== null) {
        if (typeof d.code === 'object') {
          const value = d.code.value != null ? String(d.code.value) : '';
          if (value) {
            marker.code = d.code.target
              ? { value, target: monaco.Uri.parse(String(d.code.target)) }
              : value;
          }
        } else {
          marker.code = String(d.code);
        }
      }
      return marker;
    });
    window.dispatchEvent(new CustomEvent('blinkcode:lspDiagnostics', {
      detail: { uri: params.uri, diagnostics: markers },
    }));
    if (!model) return;
    monaco.editor.setModelMarkers(model, 'lsp', markers);
  });
  disposables.push(offDiag);

  for (const lang of cfg.languages) {
    const d1 = monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['.', '"', "'", '`', '/', '@', '<', '#', ' '],
      provideCompletionItems: async (model: any, position: any) => {
        if (!client.isReady()) return { suggestions: [] };
        try {
          const res = await client.request<any>('textDocument/completion', {
            textDocument: { uri: cfg.resolveUri(model) },
            position: monacoPositionToLsp(position),
            context: { triggerKind: 1 },
          });
          const items = Array.isArray(res) ? res : (res?.items || []);
          const word = model.getWordUntilPosition(position);
          const defaultRange = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
          const suggestions: any[] = items.map((it: any) => {
            const textEdit = it.textEdit;
            let range: any = defaultRange;
            let insertText = it.insertText ?? it.label;
            if (textEdit) {
              const r = textEdit.range || textEdit.insert;
              if (r) range = lspRangeToMonaco(r, monaco);
              insertText = textEdit.newText ?? insertText;
            }
            const isSnippet = it.insertTextFormat === 2;
            return {
              label: typeof it.label === 'string' ? it.label : it.label?.label || '',
              kind: lspCompletionKindToMonaco(it.kind, monaco),
              insertText,
              insertTextRules: isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
              detail: it.detail,
              documentation: typeof it.documentation === 'string' ? it.documentation : it.documentation?.value,
              sortText: it.sortText,
              filterText: it.filterText,
              preselect: it.preselect,
              range,
              commitCharacters: it.commitCharacters,
              additionalTextEdits: lspTextEditsToMonaco(it.additionalTextEdits, monaco),
              _lspItem: it,
              _lspModel: model,
            };
          });
          return { suggestions, incomplete: !!(res && res.isIncomplete) };
        } catch {
          return { suggestions: [] };
        }
      },
      resolveCompletionItem: async (item: any) => {
        if (!client.isReady()) return item;
        const raw = item._lspItem;
        if (!raw) return item;
        try {
          const resolved = await client.request<any>('completionItem/resolve', raw);
          if (!resolved) return item;
          if (resolved.detail && !item.detail) item.detail = resolved.detail;
          if (resolved.documentation && !item.documentation) {
            item.documentation = typeof resolved.documentation === 'string'
              ? resolved.documentation
              : resolved.documentation?.value;
          }
          const edits = lspTextEditsToMonaco(resolved.additionalTextEdits, monaco);
          if (edits && edits.length) item.additionalTextEdits = edits;
          if (resolved.command && resolved.command.command) {
            item.command = {
              id: resolved.command.command,
              title: resolved.command.title || '',
              arguments: resolved.command.arguments,
            };
          }
        } catch {}
        return item;
      },
    });
    disposables.push(() => d1.dispose());

    const d2 = monaco.languages.registerHoverProvider(lang, {
      provideHover: async (model: any, position: any) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/hover', {
            textDocument: { uri: cfg.resolveUri(model) },
            position: monacoPositionToLsp(position),
          });
          if (!res || !res.contents) return null;
          const contents = Array.isArray(res.contents) ? res.contents : [res.contents];
          const parts = contents.map((c: any) => {
            if (typeof c === 'string') return { value: c };
            if (c && typeof c === 'object') {
              if ('value' in c) return { value: c.value };
              if ('language' in c && 'value' in c) return { value: '```' + c.language + '\n' + c.value + '\n```' };
            }
            return { value: String(c) };
          });
          return {
            range: res.range ? lspRangeToMonaco(res.range, monaco) : undefined,
            contents: parts,
          };
        } catch {
          return null;
        }
      },
    });
    disposables.push(() => d2.dispose());

    const d3 = monaco.languages.registerDefinitionProvider(lang, {
      provideDefinition: async (model: any, position: any) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/definition', {
            textDocument: { uri: cfg.resolveUri(model) },
            position: monacoPositionToLsp(position),
          });
          if (!res) return null;
          const arr = Array.isArray(res) ? res : [res];
          return arr.map((loc: any) => {
            const uri = loc.targetUri || loc.uri;
            const range = loc.targetSelectionRange || loc.targetRange || loc.range;
            return {
              uri: monaco.Uri.parse(uri),
              range: lspRangeToMonaco(range, monaco),
            };
          });
        } catch {
          return null;
        }
      },
    });
    disposables.push(() => d3.dispose());

    const d4 = monaco.languages.registerSignatureHelpProvider(lang, {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp: async (model: any, position: any) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/signatureHelp', {
            textDocument: { uri: cfg.resolveUri(model) },
            position: monacoPositionToLsp(position),
          });
          if (!res || !res.signatures) return null;
          return {
            value: {
              signatures: res.signatures.map((s: any) => ({
                label: s.label,
                documentation: typeof s.documentation === 'string' ? s.documentation : s.documentation?.value,
                parameters: (s.parameters || []).map((p: any) => ({
                  label: p.label,
                  documentation: typeof p.documentation === 'string' ? p.documentation : p.documentation?.value,
                })),
              })),
              activeSignature: res.activeSignature || 0,
              activeParameter: res.activeParameter || 0,
            },
            dispose: () => {},
          };
        } catch {
          return null;
        }
      },
    });
    disposables.push(() => d4.dispose());

    const d5 = monaco.languages.registerRenameProvider(lang, {
      provideRenameEdits: async (model: any, position: any, newName: string) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/rename', {
            textDocument: { uri: cfg.resolveUri(model) },
            position: monacoPositionToLsp(position),
            newName,
          });
          return lspWorkspaceEditToMonaco(res, monaco);
        } catch { return null; }
      },
      resolveRenameLocation: async (model: any, position: any) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/prepareRename', {
            textDocument: { uri: cfg.resolveUri(model) },
            position: monacoPositionToLsp(position),
          });
          if (!res) return null;
          if (res.range && res.placeholder) {
            return { range: lspRangeToMonaco(res.range, monaco), text: res.placeholder };
          }
          if (res.start && res.end) {
            const range = lspRangeToMonaco(res, monaco);
            return { range, text: model.getValueInRange(range) };
          }
          return null;
        } catch { return null; }
      },
    });
    disposables.push(() => d5.dispose());

    const d6 = monaco.languages.registerReferenceProvider(lang, {
      provideReferences: async (model: any, position: any, context: any) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/references', {
            textDocument: { uri: cfg.resolveUri(model) },
            position: monacoPositionToLsp(position),
            context: { includeDeclaration: !!context?.includeDeclaration },
          });
          if (!Array.isArray(res)) return null;
          return res.map((loc: any) => ({
            uri: monaco.Uri.parse(loc.uri),
            range: lspRangeToMonaco(loc.range, monaco),
          }));
        } catch { return null; }
      },
    });
    disposables.push(() => d6.dispose());

    const d7 = monaco.languages.registerDocumentSymbolProvider(lang, {
      provideDocumentSymbols: async (model: any) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/documentSymbol', {
            textDocument: { uri: cfg.resolveUri(model) },
          });
          if (!Array.isArray(res)) return null;
          const toMonaco = (s: any): any => {
            const range = s.range ? lspRangeToMonaco(s.range, monaco)
              : (s.location?.range ? lspRangeToMonaco(s.location.range, monaco) : undefined);
            const selectionRange = s.selectionRange ? lspRangeToMonaco(s.selectionRange, monaco) : range;
            return {
              name: s.name || '',
              detail: s.detail || '',
              kind: (s.kind ?? 1) - 1,
              tags: s.tags || [],
              range,
              selectionRange,
              children: Array.isArray(s.children) ? s.children.map(toMonaco) : [],
            };
          };
          return res.map(toMonaco);
        } catch { return null; }
      },
    });
    disposables.push(() => d7.dispose());

    const formatOptions = (options: any) => ({
      tabSize: options?.tabSize ?? 2,
      insertSpaces: options?.insertSpaces ?? true,
      trimTrailingWhitespace: true,
      insertFinalNewline: true,
      trimFinalNewlines: true,
    });

    const d8 = monaco.languages.registerDocumentFormattingEditProvider(lang, {
      provideDocumentFormattingEdits: async (model: any, options: any) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/formatting', {
            textDocument: { uri: cfg.resolveUri(model) },
            options: formatOptions(options),
          });
          return lspTextEditsToMonaco(res, monaco) || [];
        } catch { return null; }
      },
    });
    disposables.push(() => d8.dispose());

    const d9 = monaco.languages.registerDocumentRangeFormattingEditProvider(lang, {
      provideDocumentRangeFormattingEdits: async (model: any, range: any, options: any) => {
        if (!client.isReady()) return null;
        try {
          const res = await client.request<any>('textDocument/rangeFormatting', {
            textDocument: { uri: cfg.resolveUri(model) },
            range: {
              start: monacoPositionToLsp({ lineNumber: range.startLineNumber, column: range.startColumn }),
              end: monacoPositionToLsp({ lineNumber: range.endLineNumber, column: range.endColumn }),
            },
            options: formatOptions(options),
          });
          return lspTextEditsToMonaco(res, monaco) || [];
        } catch { return null; }
      },
    });
    disposables.push(() => d9.dispose());

    const d10 = monaco.languages.registerCodeActionProvider(lang, {
      provideCodeActions: async (model: any, range: any, context: any) => {
        if (!client.isReady()) return { actions: [], dispose: () => {} };
        try {
          const diagnostics = (context?.markers || []).map((m: any) => ({
            range: {
              start: { line: m.startLineNumber - 1, character: m.startColumn - 1 },
              end: { line: m.endLineNumber - 1, character: m.endColumn - 1 },
            },
            message: m.message,
            severity: m.severity,
            source: m.source,
            code: m.code,
          }));
          const res = await client.request<any>('textDocument/codeAction', {
            textDocument: { uri: cfg.resolveUri(model) },
            range: {
              start: monacoPositionToLsp({ lineNumber: range.startLineNumber, column: range.startColumn }),
              end: monacoPositionToLsp({ lineNumber: range.endLineNumber, column: range.endColumn }),
            },
            context: { diagnostics, only: context?.only ? [context.only] : undefined },
          });
          if (!Array.isArray(res)) return { actions: [], dispose: () => {} };
          const actions = res.map((a: any) => {
            if (a.command && !a.edit && !a.title) {
              return { title: a.title || a.command, command: { id: a.command, title: a.title || '', arguments: a.arguments } };
            }
            const action: any = {
              title: a.title || '',
              kind: a.kind,
              isPreferred: a.isPreferred,
              diagnostics: [],
            };
            if (a.edit) action.edit = lspWorkspaceEditToMonaco(a.edit, monaco);
            if (a.command && typeof a.command === 'object') {
              action.command = { id: a.command.command, title: a.command.title || '', arguments: a.command.arguments };
            }
            return action;
          });
          return { actions, dispose: () => {} };
        } catch {
          return { actions: [], dispose: () => {} };
        }
      },
    });
    disposables.push(() => d10.dispose());
  }

  client.connect().catch(() => {});

  function openDocument(uri: string, languageId: string, text: string, version: number) {
    if (openedDocs.has(uri)) return;
    openedDocs.add(uri);
    const send = () => client.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version, text },
    });
    client.whenReady(send);
  }

  function updateDocument(uri: string, text: string, version: number) {
    if (!openedDocs.has(uri)) return;
    client.whenReady(() => client.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    }));
  }

  function closeDocument(uri: string) {
    if (!openedDocs.has(uri)) return;
    openedDocs.delete(uri);
    client.whenReady(() => client.notify('textDocument/didClose', {
      textDocument: { uri },
    }));
  }

  const dispose = () => {
    for (const d of disposables) { try { d(); } catch {} }
    disposables.length = 0;
    client.shutdown().catch(() => {});
  };

  return { client, dispose, openDocument, updateDocument, closeDocument };
}

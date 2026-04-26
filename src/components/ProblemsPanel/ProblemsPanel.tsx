import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, CircleAlert, FileText, Info, X } from 'lucide-react';
import { loader } from '@monaco-editor/react';
import { useEditor } from '../../store/EditorContext';
import type { FileNode } from '../../types';
import { useT } from '../../hooks/useT';
import './ProblemsPanel.css';

interface DiagnosticItem {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  source: string;
  code?: string;
  resource: string;
  relPath: string;
}

interface FileGroup {
  relPath: string;
  resource: string;
  items: DiagnosticItem[];
  errors: number;
  warnings: number;
  infos: number;
}

function findNodeByPath(nodes: FileNode[], serverPath: string): FileNode | null {
  for (const node of nodes) {
    if (node.serverPath === serverPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, serverPath);
      if (found) return found;
    }
  }
  return null;
}

function getRelPath(uri: string, workspacePath: string): string {
  try {
    let decoded = decodeURIComponent(uri.replace(/^file:\/\/\/?/, ''));
    decoded = decoded.replace(/\\/g, '/');
    const wsNorm = workspacePath.replace(/\\/g, '/');
    if (decoded.startsWith(wsNorm)) {
      let rel = decoded.slice(wsNorm.length);
      if (rel.startsWith('/')) rel = rel.slice(1);
      return rel;
    }
    const parts = decoded.split('/');
    return parts[parts.length - 1] || decoded;
  } catch {
    return uri;
  }
}

function severityIcon(severity: number) {
  switch (severity) {
    case 8: return <CircleAlert size={13} className="problem-icon-error" />;
    case 4: return <AlertTriangle size={13} className="problem-icon-warning" />;
    default: return <Info size={13} className="problem-icon-info" />;
  }
}

export default function ProblemsPanel() {
  const { state, openFile, dispatch } = useEditor();
  const tt = useT();
  const [groups, setGroups] = useState<FileGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState({ errors: 0, warnings: 0, infos: 0 });
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings'>('all');
  const diagnosticsRef = useRef<Map<string, any[]>>(new Map());
  const monacoRef = useRef<any>(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const collectDiagnostics = useCallback(() => {
    const allMarkers: any[] = monacoRef.current?.editor?.getModelMarkers?.({}) || [];
    for (const [uri, diagnostics] of diagnosticsRef.current) {
      for (const diagnostic of diagnostics) {
        allMarkers.push({ ...diagnostic, resource: { toString: () => uri } });
      }
    }
    const wsPath = state.workspaceDir;
    const fileMap = new Map<string, DiagnosticItem[]>();

    for (const m of allMarkers) {
      const uri = m.resource?.toString?.() || '';
      const relPath = getRelPath(uri, wsPath);
      const item: DiagnosticItem = {
        severity: m.severity,
        message: m.message,
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
        endLineNumber: m.endLineNumber,
        endColumn: m.endColumn,
        source: m.source || '',
        code: typeof m.code === 'object' ? m.code?.value : m.code != null ? String(m.code) : undefined,
        resource: uri,
        relPath,
      };
      if (!fileMap.has(relPath)) fileMap.set(relPath, []);
      fileMap.get(relPath)!.push(item);
    }

    const sorted: FileGroup[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfos = 0;

    for (const [relPath, items] of fileMap) {
      items.sort((a, b) => a.startLineNumber - b.startLineNumber);
      const errors = items.filter(i => i.severity === 8).length;
      const warnings = items.filter(i => i.severity === 4).length;
      const infos = items.length - errors - warnings;
      totalErrors += errors;
      totalWarnings += warnings;
      totalInfos += infos;
      sorted.push({ relPath, resource: items[0].resource, items, errors, warnings, infos });
    }

    sorted.sort((a, b) => {
      if (a.errors !== b.errors) return b.errors - a.errors;
      if (a.warnings !== b.warnings) return b.warnings - a.warnings;
      return a.relPath.localeCompare(b.relPath);
    });

    setGroups(sorted);
    setCounts({ errors: totalErrors, warnings: totalWarnings, infos: totalInfos });

    if (expandedRef.current.size === 0 && sorted.length > 0) {
      setExpanded(new Set(sorted.map(g => g.relPath)));
    }
  }, [state.workspaceDir]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.uri) return;
      diagnosticsRef.current.set(detail.uri, detail.diagnostics || []);
      collectDiagnostics();
    };
    window.addEventListener('blinkcode:lspDiagnostics', handler);
    collectDiagnostics();
    return () => window.removeEventListener('blinkcode:lspDiagnostics', handler);
  }, [collectDiagnostics]);

  useEffect(() => {
    let disposed = false;
    let disposable: any = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    loader.init().then(monaco => {
      if (disposed) return;
      monacoRef.current = monaco;
      collectDiagnostics();
      try {
        disposable = monaco.editor.onDidChangeMarkers(() => collectDiagnostics());
      } catch {}
      timer = setInterval(collectDiagnostics, 1000);
    });
    return () => {
      disposed = true;
      try { disposable?.dispose?.(); } catch {}
      if (timer) clearInterval(timer);
    };
  }, [collectDiagnostics]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('blinkcode:problemCounts', { detail: counts }));
  }, [counts]);

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const goToProblem = useCallback((item: DiagnosticItem) => {
    const node = findNodeByPath(state.files, item.relPath);
    if (node) openFile(node);
    setTimeout(() => {
      const editor = (window as any).__blinkcodeEditor;
      if (!editor) return;
      editor.focus();
      editor.setPosition({ lineNumber: item.startLineNumber, column: item.startColumn });
      editor.revealLineInCenter(item.startLineNumber);
    }, 150);
  }, [openFile, state.files]);

  const filteredGroups = filter === 'all' ? groups : groups.map(g => ({
    ...g,
    items: g.items.filter(i =>
      filter === 'errors' ? i.severity === 8 : i.severity === 4,
    ),
  })).filter(g => g.items.length > 0);

  const close = () => dispatch({ type: 'TOGGLE_PROBLEMS_PANEL' });

  if (!state.showProblemsPanel) return null;

  return (
    <div className="problems-panel" style={{ height: state.terminalHeight }}>
      <div className="problems-header">
        <div className="problems-header-left">
          <span className="problems-title">{tt('problems.title')}</span>
          <span className="problems-badge problems-badge-error">{counts.errors}</span>
          <span className="problems-badge problems-badge-warning">{counts.warnings}</span>
          <span className="problems-badge problems-badge-info">{counts.infos}</span>
        </div>
        <div className="problems-header-right">
          <button className={`problems-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{tt('problems.all')}</button>
          <button className={`problems-filter-btn ${filter === 'errors' ? 'active' : ''}`} onClick={() => setFilter('errors')}>{tt('problems.errors')}</button>
          <button className={`problems-filter-btn ${filter === 'warnings' ? 'active' : ''}`} onClick={() => setFilter('warnings')}>{tt('problems.warnings')}</button>
          <button className="problems-close" onClick={close}><X size={13} /></button>
        </div>
      </div>
      <div className="problems-body">
        {filteredGroups.length === 0 ? (
          <div className="problems-empty">{tt('problems.noProblems')}</div>
        ) : filteredGroups.map(group => {
          const isOpen = expanded.has(group.relPath);
          return (
            <div key={group.relPath} className="problems-file-group">
              <button className="problems-file-head" onClick={() => toggleExpand(group.relPath)}>
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <FileText size={13} />
                <span className="problems-file-path">{group.relPath}</span>
                <span className="problems-file-counts">
                  {group.errors > 0 && <span className="problems-cnt-error">{group.errors}</span>}
                  {group.warnings > 0 && <span className="problems-cnt-warning">{group.warnings}</span>}
                </span>
              </button>
              {isOpen && group.items.map((item, idx) => (
                <button
                  key={`${group.relPath}:${item.startLineNumber}:${item.startColumn}:${idx}`}
                  className="problems-item"
                  onClick={() => goToProblem(item)}
                >
                  {severityIcon(item.severity)}
                  <span className="problems-msg">{item.message}</span>
                  {item.code && <span className="problems-code">{item.source ? `${item.source}(${item.code})` : item.code}</span>}
                  <span className="problems-loc">[Ln {item.startLineNumber}, Col {item.startColumn}]</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

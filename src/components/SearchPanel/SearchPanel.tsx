import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Replace, Search, X } from 'lucide-react';
import { useEditor } from '../../store/EditorContext';
import type { FileNode } from '../../types';
import { replaceWorkspace, searchWorkspace, type WorkspaceSearchFileResult } from '../../utils/api';
import { useT } from '../../hooks/useT';
import { useHorizontalResize } from '../../hooks/useHorizontalResize';
import './SearchPanel.css';

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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}

function highlightedPreview(preview: string, column: number, length: number): string {
  const start = Math.max(0, column - 1);
  const end = Math.max(start, start + length);
  return `${escapeHtml(preview.slice(0, start))}<mark>${escapeHtml(preview.slice(start, end))}</mark>${escapeHtml(preview.slice(end))}`;
}

export default function SearchPanel() {
  const { state, openFile, toggleSearchPanel, addToast, loadFromServer, setSidebarWidth } = useEditor();
  const tt = useT();
  const resizerRef = useHorizontalResize(state.sidebarWidth, setSidebarWidth);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [regex, setRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [results, setResults] = useState<WorkspaceSearchFileResult[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const searchOptions = useMemo(() => ({
    query,
    regex,
    matchCase,
    wholeWord,
    include,
    exclude,
  }), [query, regex, matchCase, wholeWord, include, exclude]);

  const runSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setTruncated(false);
      return;
    }
    setLoading(true);
    try {
      const response = await searchWorkspace(searchOptions);
      setResults(response.results);
      setTotal(response.totalMatches);
      setTruncated(response.truncated);
      setExpanded(new Set(response.results.map(item => item.path)));
    } catch (err: any) {
      addToast(err?.message || tt('search.failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, query, searchOptions, tt]);

  const openMatch = useCallback((path: string, line: number, column: number) => {
    const node = findNodeByPath(state.files, path);
    if (!node) {
      addToast(tt('search.fileNotFound'), 'error');
      return;
    }
    openFile(node);
    setTimeout(() => {
      const editor = (window as any).__blinkcodeEditor;
      if (!editor) return;
      editor.focus();
      editor.setPosition({ lineNumber: line, column });
      editor.revealLineInCenter(line);
    }, 150);
  }, [addToast, openFile, state.files, tt]);

  const toggleExpanded = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const runReplaceAll = async () => {
    if (!query.trim()) return;
    if (!window.confirm(tt('search.replaceAllConfirm'))) return;
    setLoading(true);
    try {
      const response = await replaceWorkspace({ ...searchOptions, replacement });
      addToast(tt('search.replaced', { '0': response.totalReplacements }), 'success');
      await loadFromServer();
      await runSearch();
    } catch (err: any) {
      addToast(err?.message || tt('search.replaceFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!state.showSearchPanel) return null;

  return (
    <aside className="search-panel" style={{ width: state.sidebarWidth }}>
      <div className="search-panel-head">
        <div className="search-panel-title"><Search size={14} /> {tt('search.title')}</div>
        <button className="search-panel-close" onClick={toggleSearchPanel} title={tt('common.close')}><X size={14} /></button>
      </div>

      <div className="search-panel-controls">
        <div className="search-input-row">
          <input
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
            placeholder={tt('search.placeholder')}
            spellCheck={false}
          />
          <button className={regex ? 'search-option active' : 'search-option'} onClick={() => setRegex(v => !v)} title={tt('search.regex')}>.*</button>
          <button className={matchCase ? 'search-option active' : 'search-option'} onClick={() => setMatchCase(v => !v)} title={tt('search.matchCase')}>Aa</button>
          <button className={wholeWord ? 'search-option active' : 'search-option'} onClick={() => setWholeWord(v => !v)} title={tt('search.wholeWord')}>ab</button>
          <button className="search-run-btn" onClick={runSearch} disabled={!query.trim() || loading} title={tt('search.run')}><Search size={14} /></button>
        </div>
        <div className="search-input-row">
          <input
            className="search-input"
            value={replacement}
            onChange={e => setReplacement(e.target.value)}
            placeholder={tt('search.replacePlaceholder')}
            spellCheck={false}
          />
          <button className="search-replace-btn" onClick={runReplaceAll} disabled={!query.trim() || loading} title={tt('search.replaceAll')}><Replace size={14} /></button>
        </div>
        <input className="search-filter-input" value={include} onChange={e => setInclude(e.target.value)} placeholder={tt('search.include')} spellCheck={false} />
        <input className="search-filter-input" value={exclude} onChange={e => setExclude(e.target.value)} placeholder={tt('search.exclude')} spellCheck={false} />
      </div>

      <div className="search-summary">
        {loading ? tt('search.searching') : query.trim() ? tt('search.matches', { '0': total }) : tt('search.empty')}
        {truncated && <span className="search-truncated"> {tt('search.truncated')}</span>}
      </div>

      <div className="search-results">
        {results.map(file => {
          const isOpen = expanded.has(file.path);
          return (
            <div className="search-result-file" key={file.path}>
              <button className="search-result-file-head" onClick={() => toggleExpanded(file.path)}>
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <FileText size={13} />
                <span className="search-result-file-path">{file.path}</span>
                <span className="search-result-count">{file.matches.length}</span>
              </button>
              {isOpen && file.matches.map((match, index) => (
                <button
                  className="search-result-match"
                  key={`${file.path}:${match.line}:${match.column}:${index}`}
                  onClick={() => openMatch(file.path, match.line, match.column)}
                >
                  <span className="search-result-line">{match.line}</span>
                  <span className="search-result-preview" dangerouslySetInnerHTML={{ __html: highlightedPreview(match.preview, match.column, match.length) }} />
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="search-panel-resizer" ref={resizerRef} />
    </aside>
  );
}

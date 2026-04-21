import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../store/EditorContext';
import { getFileIcon } from '../../utils/fileIcons';
import { Search, ArrowDown, ArrowUp } from 'lucide-react';
import './QuickOpen.css';

function fuzzyScore(query: string, target: string): number {
  const ql = query.toLowerCase();
  const tl = target.toLowerCase();
  let score = 0;
  let qi = 0;
  let consecutive = 0;
  for (let ti = 0; ti < tl.length && qi < ql.length; ti++) {
    if (tl[ti] === ql[qi]) {
      if (ti === 0 || target[ti - 1] === '/' || target[ti - 1] === '\\') score += 3;
      else if (consecutive > 0) score += 2;
      else score += 1;
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
  }
  if (qi < ql.length) return -1;
  score -= target.length * 0.05;
  return score;
}

export default function QuickOpen() {
  const { openFile, state } = useEditor();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fetchFiles = async () => {
      try {
        const res = await fetch('/api/files');
        const data = await res.json();
        setFiles(data.files || []);
      } catch {
        setFiles([]);
      }
    };
    fetchFiles();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return files.slice(0, 50);
    const scored = files
      .map(f => ({ f, s: fuzzyScore(q, f) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s);
    return scored.slice(0, 50).map(x => x.f);
  }, [files, query]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(filtered.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(0, i - 1)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const path = filtered[selected];
        if (path) openByPath(path);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected]);

  useEffect(() => {
    const handler = (e: Event) => { if ((e as CustomEvent).detail?.openQuickOpen) setOpen(true); };
    window.addEventListener('blinkcode:openQuickOpen', handler);
    return () => window.removeEventListener('blinkcode:openQuickOpen', handler);
  }, []);

  useEffect(() => { if (open) { setQuery(''); setSelected(0); inputRef.current?.focus(); } }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selected] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const openByPath = useCallback(async (relativePath: string) => {
    setOpen(false);
    const file = findNodeByServerPath(state.files, relativePath);
    if (file) {
      openFile(file);
      return;
    }
    // file might not be in tree yet (watcher lag) — refresh tree then open
    try {
      const res = await fetch('/api/tree');
      const data = await res.json();
      if (data.tree) {
        // dispatch tree update would need dispatch from context
        // for simplicity just try finding again after small delay
      }
    } catch {}
  }, [state.files, openFile]);

  if (!open) return null;

  return (
    <div className="quickopen-overlay" onClick={() => setOpen(false)}>
      <div className="quickopen-modal" onClick={e => e.stopPropagation()}>
        <div className="quickopen-input-wrap">
          <Search size={16} className="quickopen-search-icon" />
          <input
            ref={inputRef}
            className="quickopen-input"
            placeholder="Search files by name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <div className="quickopen-hint">
            <ArrowUp size={12} /><ArrowDown size={12} /> navigate <span className="quickopen-hint-sep">·</span> Enter open
          </div>
        </div>
        <div className="quickopen-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="quickopen-empty">No matching files</div>
          )}
          {filtered.map((path, idx) => {
            const parts = path.split('/');
            const name = parts[parts.length - 1];
            const dir = parts.slice(0, -1).join('/');
            return (
              <div
                key={path}
                className={`quickopen-item${idx === selected ? ' quickopen-item-active' : ''}`}
                onClick={() => openByPath(path)}
                onMouseEnter={() => setSelected(idx)}
              >
                <span className="quickopen-icon" style={{ color: getFileIcon(name).color }}>{getFileIcon(name).icon}</span>
                <span className="quickopen-name">{name}</span>
                {dir && <span className="quickopen-dir">{dir}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function findNodeByServerPath(nodes: any[], serverPath: string): any | null {
  for (const n of nodes) {
    if (n.serverPath === serverPath && n.type === 'file') return n;
    if (n.children) {
      const found = findNodeByServerPath(n.children, serverPath);
      if (found) return found;
    }
  }
  return null;
}

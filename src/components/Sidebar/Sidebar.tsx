import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor } from '../../store/EditorContext';
import type { FileNode } from '../../types';
import { getFileIcon } from '../../utils/fileIcons';
import { useT } from '../../hooks/useT';
import { useResizable } from '../../hooks/useResizable';
import { isSupportedWebFile } from '../../utils/supportedWebFiles';
import { collectForUpload, uploadFolder } from '../../utils/fileSystem';
import { createFileOnServer, saveFile, closeWorkspace, fetchRecentProjects } from '../../utils/api';
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  FilePlus, FolderPlus, Trash2, Pencil, Search,
  RefreshCw, FolderX
} from 'lucide-react';
import './Sidebar.css';

interface CtxMenu {
  x: number; y: number; nodeId: string | null; nodeType: 'file' | 'folder' | null;
}

interface InlineInput {
  parentId: string | null; type: 'file' | 'folder'; value: string;
}

type DropPos = 'before' | 'after' | 'inside' | null;
interface DragState { overId: string | null; position: DropPos; }

function findNode(nodes: FileNode[], id: string): FileNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
}

function allIds(nodes: FileNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) { ids.push(n.id); if (n.children) ids.push(...allIds(n.children)); }
  return ids;
}

function isAncestorOf(nodes: FileNode[], ancestorId: string, searchId: string): boolean {
  if (ancestorId === searchId) return true;
  const a = findNode(nodes, ancestorId);
  if (!a?.children) return false;
  return allIds(a.children).includes(searchId);
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export default function Sidebar() {
  const { state, openFile, toggleFolder, addFile, deleteNode, renameNode, moveNode, setSidebarWidth, loadFromServer, addToast, dispatch, openFolderFromServer } = useEditor();
  const tt = useT();
  const [recentProjects, setRecentProjects] = useState<Array<{ path: string; name: string }>>([]);

  useEffect(() => {
    fetchRecentProjects().then(setRecentProjects).catch(() => {});
  }, [state.workspaceDir, state.files.length]);
  const handleOpenFolder = useCallback(async () => {
    const api = (window as any).electronAPI || (window as any).electron || (window as any).desktop;

    try {
      const picker = api?.openFolder || api?.pickFolder || api?.selectFolder;
      if (typeof picker === 'function') {
        const result = await picker();
        const folderPath = typeof result === 'string'
          ? result
          : result?.path || result?.paths?.[0] || null;

        if (folderPath) {
          addToast(tt('toast.reading'), 'info');
          await openFolderFromServer(folderPath);
          return;
        }
      }

      if (!('showDirectoryPicker' in window)) {
        addToast(tt('toast.openFolder'), 'error');
        return;
      }

      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      addToast(tt('toast.reading'), 'info');
      const items = await collectForUpload(dirHandle, '', 0);
      if (items.length === 0) {
        addToast(tt('toast.empty'), 'error');
        return;
      }
      const result = await uploadFolder(dirHandle.name, items);
      dispatch({ type: 'SET_FILES', payload: result.files });
      dispatch({ type: 'SET_WORKSPACE_DIR', payload: '' });
      addToast(tt('toast.opened', { '0': items.filter(i => i.type === 'file').length }), 'success');
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        addToast(tt('toast.openFail') + (err?.message || ''), 'error');
      }
    }
  }, [addToast, dispatch, openFolderFromServer, tt]);
  const handleCloseFolder = useCallback(async () => {
    dispatch({ type: 'CLOSE_FOLDER' });
    try { await closeWorkspace(); } catch {}
  }, [dispatch]);
  const [ctx, setCtx] = useState<CtxMenu | null>(null);
  const [inline, setInline] = useState<InlineInput | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [drag, setDrag] = useState<DragState>({ overId: null, position: null });
  const [filter, setFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragSrc = useRef<string | null>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const inlineRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const itemEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const activeFileId = state.activeTabId ? state.openTabs.find(t => t.id === state.activeTabId)?.fileId : null;

  useEffect(() => { if (inline) inlineRef.current?.focus(); }, [inline]);
  useEffect(() => {
    if (state.pendingCreate) {
      setInline({ parentId: null, type: state.pendingCreate, value: '' });
      dispatch({ type: 'CLEAR_PENDING_CREATE' });
    }
  }, [state.pendingCreate]);
  useEffect(() => { if (renamingId) { renameRef.current?.focus(); renameRef.current?.select(); } }, [renamingId]);
  useEffect(() => { if (showFilter) filterRef.current?.focus(); }, [showFilter]);
  useEffect(() => { const h = () => setCtx(null); window.addEventListener('click', h); return () => window.removeEventListener('click', h); }, []);

  const handleResize = useCallback((e: MouseEvent) => {
    const rect = resizeRef.current?.parentElement?.getBoundingClientRect();
    if (rect) setSidebarWidth(e.clientX - rect.left);
  }, [setSidebarWidth]);

  useResizable(resizeRef, handleResize, 'col');

  const submitInline = () => {
    if (!inline) return;
    const v = inline.value.trim();
    if (v) addFile(inline.parentId, v, inline.type);
    setInline(null);
  };

  const submitRename = () => {
    if (renamingId && renameVal.trim()) renameNode(renamingId, renameVal.trim());
    setRenamingId(null);
    setRenameVal('');
  };

  const onCtx = (e: React.MouseEvent, nodeId: string | null, nodeType: 'file' | 'folder' | null) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, nodeId, nodeType });
  };

  const computePos = (nodeId: string, e: React.DragEvent): DropPos => {
    const el = itemEls.current.get(nodeId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const ratio = relY / rect.height;
    const node = findNode(state.files, nodeId);
    if (node?.type === 'folder') {
      if (ratio < 0.2) return 'before';
      if (ratio > 0.8) return 'after';
      return 'inside';
    }
    if (ratio < 0.4) return 'before';
    return 'after';
  };

  const onDragStart = (id: string) => {
    dragSrc.current = id;
    setDraggingId(id);
  };

  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!dragSrc.current || dragSrc.current === id) return;
    e.stopPropagation();
    if (isAncestorOf(state.files, dragSrc.current, id)) return;
    setDrag({ overId: id, position: computePos(id, e) });
  };

  const onDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    const src = dragSrc.current;
    if (!src || src === id || isAncestorOf(state.files, src, id)) return;
    e.stopPropagation();
    const pos = computePos(id, e);
    if (pos) moveNode(src, id, pos);
    setDrag({ overId: null, position: null });
    dragSrc.current = null;
    setDraggingId(null);
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (dragSrc.current) e.stopPropagation();
    setDrag({ overId: null, position: null });
  };

  const onDragEnd = () => {
    setDrag({ overId: null, position: null });
    dragSrc.current = null;
    setDraggingId(null);
  };

  const handleCtxOpen = () => { if (ctx?.nodeId) { const n = findNode(state.files, ctx.nodeId); if (n) openFile(n); } setCtx(null); };
  const handleCtxRename = () => { if (ctx?.nodeId) { const n = findNode(state.files, ctx.nodeId); if (n) { setRenamingId(n.id); setRenameVal(n.name); } } setCtx(null); };
  const handleCtxDelete = () => { if (ctx?.nodeId) deleteNode(ctx.nodeId); setCtx(null); };
  const handleCtxNewFile = () => { setInline({ parentId: ctx?.nodeId ?? null, type: 'file', value: '' }); setCtx(null); };
  const handleCtxNewFolder = () => { setInline({ parentId: ctx?.nodeId ?? null, type: 'folder', value: '' }); setCtx(null); };

  const filterMatches = (node: FileNode): boolean => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.children) return node.children.some(c => filterMatches(c));
    return false;
  };

  const renderTree = (nodes: FileNode[], depth: number): React.ReactNode => {
    const sorted = sortNodes(nodes.filter(filterMatches));
    return sorted.map((node) => {
      const icon = node.type === 'file' ? getFileIcon(node.name) : null;
      const isActive = node.id === activeFileId;
      const isDragOver = drag.overId === node.id;
      const dropPos = isDragOver ? drag.position : null;
      const isDragging = draggingId === node.id;
      const isUnsupported = node.type === 'file' && !node.binary && !isSupportedWebFile(node.name);
      const indent = depth * 8;
      const showGuides = depth > 0;
      const hasVisibleChildren = node.type === 'folder' && node.isExpanded && (node.children || []).some(c => filterMatches(c));

      return (
        <div key={node.id} className={`tree-row-wrapper ${isDragging ? 'dragging' : ''}`}>
          {dropPos === 'before' && (
            <div className="drop-indicator">
              <div className="drop-line-h" style={{ left: 8 + indent }} />
            </div>
          )}
          <div
            ref={el => { if (el) itemEls.current.set(node.id, el); }}
            className={`tree-row ${isActive ? 'tree-row-active' : ''} ${isDragOver && dropPos === 'inside' ? 'tree-row-drop-inside' : ''} ${isDragging ? 'tree-row-dragging' : ''} ${isUnsupported ? 'tree-row-unsupported' : ''}`}
            onClick={() => node.type === 'folder' ? toggleFolder(node.id) : openFile(node)}
            onContextMenu={e => onCtx(e, node.id, node.type)}
            title={isUnsupported ? tt('explorer.unsupportedFileHint') : node.name}
            draggable={renamingId !== node.id}
            onDragStart={() => onDragStart(node.id)}
            onDragOver={e => onDragOver(e, node.id)}
            onDrop={e => onDrop(e, node.id)}
            onDragLeave={onDragLeave}
            onDragEnd={onDragEnd}
          >
            {showGuides && <span className="tree-indent" style={{ width: indent }}><span className="indent-guide" /></span>}
            <span className="tree-twistie">
              {node.type === 'folder' ? (
                node.isExpanded ? <ChevronDown size={14} className="twistie-expanded" /> : <ChevronRight size={14} />
              ) : null}
            </span>
            <span className="tree-icon">
              {node.type === 'folder' ? (
                node.isExpanded ? <FolderOpen size={15} className="icon-folder-open" /> : <Folder size={15} className="icon-folder" />
              ) : (
                <span className="icon-file-svg" style={{ color: icon?.color }}>{icon?.icon}</span>
              )}
            </span>
            {renamingId === node.id ? (
              <input ref={renameRef} className="tree-rename-input" value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setRenamingId(null); setRenameVal(''); } }}
                onBlur={submitRename} onClick={e => e.stopPropagation()}
                onDragStart={e => e.preventDefault()} onMouseDown={e => e.stopPropagation()} />
            ) : (
              <span className="tree-label" title={isUnsupported ? tt('explorer.unsupportedFileHint') : node.name}>{node.name}</span>
            )}
          </div>
          {node.type === 'folder' && node.isExpanded && (
            <div className="tree-children-block">
              {renderTree(node.children || [], depth + 1)}
              {inline && inline.parentId === node.id && (
                <div className="tree-row inline-row" style={{ paddingLeft: 8 + (depth + 1) * 8 }}>
                  <span className="tree-twistie" />
                  <span className="tree-icon">
                    {inline.type === 'folder' ? <Folder size={15} className="icon-folder" /> : <File size={15} style={{ color: '#6b7280' }} />}
                  </span>
                  <input ref={inlineRef} className="tree-rename-input" value={inline.value}
                    placeholder={inline.type === 'folder' ? tt('inline.folder') : tt('inline.file')}
                    onChange={e => setInline({ ...inline, value: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') submitInline(); if (e.key === 'Escape') setInline(null); }}
                    onBlur={submitInline}
                    onDragStart={e => e.preventDefault()} onMouseDown={e => e.stopPropagation()} />
                </div>
              )}
            </div>
          )}
          {dropPos === 'after' && !hasVisibleChildren && (            <div className="drop-indicator">
              <div className="drop-line-h" style={{ left: 8 + indent }} />
            </div>
          )}
        </div>
      );
    });
  };

  const [dropActive, setDropActive] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setDropActive(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    for (const f of files) {
      const path = f.webkitRelativePath || f.name;
      const isBinary = (() => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return ['png','jpg','jpeg','gif','svg','webp','bmp','ico','mp3','wav','ogg','mp4','zip','rar','gz','pdf','exe','dll','woff','woff2','ttf','eot','otf','sqlite','db'].includes(ext);
      })();
      try {
        if (isBinary) {
          const buf = await f.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          await saveFile(path, 'base64:' + b64);
        } else {
          const text = await f.text();
          await saveFile(path, text);
        }
        await createFileOnServer(path, 'file');
      } catch {}
    }
    loadFromServer();
    addToast(files.length === 1 ? `Dropped ${files[0].name}` : `Dropped ${files.length} files`, 'success');
  }, [loadFromServer, addToast]);

  if (!state.sidebarVisible) return null;

  return (
    <div className={`sidebar${dropActive ? ' drop-active' : ''}`} style={{ width: state.sidebarWidth }} onContextMenu={e => onCtx(e, null, null)} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className="sidebar-section-head">
        <span className="sidebar-section-title">{tt('explorer.title')}</span>
        <div className="sidebar-section-actions">
          <button className="sec-btn" onClick={() => setShowFilter(!showFilter)} title="Filter">
            <Search size={13} />
          </button>
          <button className="sec-btn" onClick={() => setInline({ parentId: null, type: 'file', value: '' })} title="New File">
            <FilePlus size={13} />
          </button>
          <button className="sec-btn" onClick={() => setInline({ parentId: null, type: 'folder', value: '' })} title="New Folder">
            <FolderPlus size={13} />
          </button>
          <button className="sec-btn" onClick={loadFromServer} title="Refresh">
            <RefreshCw size={13} />
          </button>
          {state.files.length > 0 && (
            <button className="sec-btn" onClick={handleCloseFolder} title={tt('explorer.closeFolder')}>
              <FolderX size={13} />
            </button>
          )}
        </div>
      </div>
      {showFilter && (
        <div className="sidebar-filter">
          <Search size={12} className="filter-icon" />
          <input ref={filterRef} className="filter-input" placeholder={tt('explorer.filter')}
            value={filter} onChange={e => setFilter(e.target.value)} />
          {filter && <button className="filter-clear" onClick={() => setFilter('')}>×</button>}
        </div>
      )}
      <div className="sidebar-tree" onDragOver={e => { e.preventDefault(); }} onDrop={e => {
        e.preventDefault();
        if (dragSrc.current) {
          moveNode(dragSrc.current, null, 'after');
          setDrag({ overId: null, position: null });
          dragSrc.current = null;
          setDraggingId(null);
        }
      }}>
        {state.files.length === 0 && !inline ? (
          <div className="sidebar-empty">
            <div className="sidebar-empty-text">{tt('empty.hint')}</div>
            {recentProjects.length > 0 && (
              <div className="sidebar-recent-projects">
                <div className="sidebar-recent-title">{tt('sidebar.recentProjects')}</div>
                <div className="sidebar-recent-list">
                  {recentProjects.map(project => (
                    <button
                      key={project.path}
                      className="sidebar-recent-item"
                      onClick={() => openFolderFromServer(project.path)}
                      title={project.path}
                    >
                      <span className="sidebar-recent-name">{project.name}</span>
                      <span className="sidebar-recent-path">{project.path}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button className="sidebar-empty-open-btn" onClick={handleOpenFolder}>
              {tt('openFolder')}
            </button>
          </div>
        ) : (
          <>
            {renderTree(state.files, 0)}
        {inline && inline.parentId === null && (
          <div className="tree-row inline-row" style={{ paddingLeft: 8 }}>
            <span className="tree-twistie" />
            <span className="tree-icon">
              {inline.type === 'folder' ? <Folder size={15} className="icon-folder" /> : <File size={15} style={{ color: '#6b7280' }} />}
            </span>
            <input ref={inlineRef} className="tree-rename-input" value={inline.value}
              placeholder={inline.type === 'folder' ? tt('inline.folder') : tt('inline.file')}
              onChange={e => setInline({ ...inline, value: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') submitInline(); if (e.key === 'Escape') setInline(null); }}
              onBlur={submitInline} />
          </div>
        )}
          </>
        )}
      </div>
      <div className="sidebar-resizer" ref={resizeRef} />

      {ctx && (
        <div className="ctx-menu" style={{ left: ctx.x, top: ctx.y }} onClick={e => e.stopPropagation()}>
          {ctx.nodeType === 'file' && (
            <div>
              <button className="ctx-item" onClick={handleCtxOpen}><File size={13} /> {tt('ctx.open')}</button>
              <button className="ctx-item" onClick={handleCtxRename}><Pencil size={13} /> {tt('ctx.rename')}</button>
              <div className="ctx-sep" />
              <button className="ctx-item danger" onClick={handleCtxDelete}><Trash2 size={13} /> {tt('ctx.delete')}</button>
            </div>
          )}
          {ctx.nodeType === 'folder' && (
            <div>
              <button className="ctx-item" onClick={handleCtxNewFile}><FilePlus size={13} /> {tt('ctx.newFile')}</button>
              <button className="ctx-item" onClick={handleCtxNewFolder}><FolderPlus size={13} /> {tt('ctx.newFolder')}</button>
              <button className="ctx-item" onClick={handleCtxRename}><Pencil size={13} /> {tt('ctx.rename')}</button>
              <div className="ctx-sep" />
              <button className="ctx-item danger" onClick={handleCtxDelete}><Trash2 size={13} /> {tt('ctx.delete')}</button>
            </div>
          )}
          {!ctx.nodeType && (
            <div>
              <button className="ctx-item" onClick={handleCtxNewFile}><FilePlus size={13} /> {tt('ctx.newFile')}</button>
              <button className="ctx-item" onClick={handleCtxNewFolder}><FolderPlus size={13} /> {tt('ctx.newFolder')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

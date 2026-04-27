import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '../../store/EditorContext';
import { getFileIcon } from '../../utils/fileIcons';
import { X, Split } from 'lucide-react';
import type { FileNode } from '../../types';
import { useT } from '../../hooks/useT';
import { saveFile as saveFileApi } from '../../utils/api';
import './TabsHeader.css';

function isFileDirty(files: FileNode[], fileId: string): boolean {
  for (const f of files) {
    if (f.id === fileId) return !!f.dirty;
    if (f.children) { if (isFileDirty(f.children, fileId)) return true; }
  }
  return false;
}

function findFileNode(files: FileNode[], fileId: string): FileNode | null {
  for (const f of files) {
    if (f.id === fileId) return f;
    if (f.children) { const r = findFileNode(f.children, fileId); if (r) return r; }
  }
  return null;
}

interface TabMenu {
  tabId: string;
  rect: DOMRect;
}

export default function TabsHeader() {
  const { state, setActiveTab, closeTab, reorderTabs, dispatch, splitTab } = useEditor();
  const tt = useT();
  const dragTab = useRef<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<TabMenu | null>(null);

  useEffect(() => {
    if (!menu) return;

    const handleGlobalPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.save-prompt')) return;
      if (target?.closest('.tab')) return;
      setMenu(null);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };

    window.addEventListener('mousedown', handleGlobalPointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleGlobalPointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [menu]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = tabsRef.current;
    if (!el) return;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta === 0) return;

    el.scrollLeft += delta;
    e.preventDefault();
  };

  const handleDragStart = (tabId: string) => { dragTab.current = tabId; };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragTab.current || dragTab.current === targetId) return;
    const fromIdx = state.openTabs.findIndex(t => t.id === dragTab.current);
    const toIdx = state.openTabs.findIndex(t => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const tabs = [...state.openTabs];
    const [moved] = tabs.splice(fromIdx, 1);
    tabs.splice(toIdx, 0, moved);
    reorderTabs(tabs);
  };

  const handleSave = async () => {
    if (!menu) return;
    const tabId = menu.tabId;
    const tab = state.openTabs.find(t => t.id === tabId);
    if (tab) {
      const file = findFileNode(state.files, tab.fileId);
      if (file?.serverPath && file.content !== undefined) {
        try {
          await saveFileApi(file.serverPath, file.content);
          dispatch({ type: 'MARK_FILE_SAVED', payload: { fileId: file.id } });
        } catch {}
      }
    }
    closeTab(tabId);
    setMenu(null);
  };

  const handleDontSave = () => {
    if (!menu) return;
    const tabId = menu.tabId;
    closeTab(tabId);
    setMenu(null);
  };

  const handleCopyPath = async () => {
    if (!menu) return;
    const tab = state.openTabs.find(t => t.id === menu.tabId);
    if (!tab) return;
    const file = findFileNode(state.files, tab.fileId);
    if (!file?.serverPath) return;
    try {
      const normalizedRelative = file.serverPath.replace(/\//g, '\\');
      const absolutePath = state.workspaceDir
        ? `${state.workspaceDir.replace(/\//g, '\\').replace(/\\$/, '')}\\${normalizedRelative}`
        : normalizedRelative;
      await navigator.clipboard.writeText(absolutePath);
    } catch {}
    setMenu(null);
  };

  const handleCloseOnly = () => {
    if (!menu) return;
    closeTab(menu.tabId);
    setMenu(null);
  };

  const handleSplit = () => {
    if (!menu) return;
    splitTab(menu.tabId);
    setMenu(null);
  };

  const handleCloseAll = () => {
    state.openTabs.forEach(tab => closeTab(tab.id));
    setMenu(null);
  };

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string, target: HTMLDivElement) => {
    e.preventDefault();
    const rect = target.getBoundingClientRect();
    setMenu({ tabId, rect });
  };

  if (state.openTabs.length === 0) return null;

  return (
    <div className="tabs-header" ref={tabsRef} onWheel={handleWheel}>
      {state.openTabs.map(tab => {
        const icon = getFileIcon(tab.name);
        const isActive = tab.id === state.activeTabId;
        const dirty = isFileDirty(state.files, tab.fileId);
        return (
          <div
            key={tab.id}
            className={`tab ${isActive ? 'tab-active' : ''}`}
            onClick={() => { setMenu(null); setActiveTab(tab.id); }}
            onContextMenu={e => handleTabContextMenu(e, tab.id, e.currentTarget)}
            draggable
            onDragStart={() => handleDragStart(tab.id)}
            onDragOver={e => handleDragOver(e, tab.id)}
            onDragEnd={() => { dragTab.current = null; }}
          >
            <span className="tab-icon" style={{ color: icon.color }}>{icon.icon}</span>
            <span className="tab-name">{tab.name}</span>
            <button
              className={`tab-close ${dirty ? 'tab-dirty' : ''}`}
              onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
            >
              {dirty ? <span className="tab-dot" /> : <X size={12} />}
            </button>
          </div>
        );
      })}
      {menu && createPortal(
        <div
          className="save-prompt save-prompt-floating"
          style={{ left: menu.rect.left + menu.rect.width / 2, top: menu.rect.bottom + 6, transform: 'translateX(-50%)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="save-prompt-actions save-prompt-actions-vertical">
            <button className="save-prompt-btn save-prompt-plain" onClick={handleSave}>{tt('tab.save')}</button>
            <button className="save-prompt-btn save-prompt-plain" onClick={handleDontSave}>{tt('tab.dontSave')}</button>
            <button className="save-prompt-btn save-prompt-plain" onClick={handleCopyPath}>{tt('tab.copyPath')}</button>
            <button className="save-prompt-btn save-prompt-plain" onClick={handleSplit}>
              <Split size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Split Right
            </button>
            <button className="save-prompt-btn save-prompt-plain" onClick={handleCloseOnly}>{tt('tab.close')}</button>
            <button className="save-prompt-btn save-prompt-plain" onClick={handleCloseAll}>{tt('tab.closeAll')}</button>
            <button className="save-prompt-btn save-prompt-plain" onClick={() => setMenu(null)}>{tt('tab.cancel')}</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

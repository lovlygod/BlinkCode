import { useRef, useState } from 'react';
import { useEditor } from '../../store/EditorContext';
import { getFileIcon } from '../../utils/fileIcons';
import { X } from 'lucide-react';
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

interface SavePrompt { tabId: string; rect: DOMRect }

export default function TabsHeader() {
  const { state, setActiveTab, closeTab, reorderTabs, dispatch } = useEditor();
  const tt = useT();
  const dragTab = useRef<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState<SavePrompt | null>(null);

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

  const tryClose = (tabId: string, btnEl: HTMLElement) => {
    const tab = state.openTabs.find(t => t.id === tabId);
    if (!tab) return;
    if (isFileDirty(state.files, tab.fileId)) {
      const rect = btnEl.getBoundingClientRect();
      setPrompt({ tabId, rect });
    } else {
      closeTab(tabId);
    }
  };

  const handleSave = async () => {
    if (!prompt) return;
    const tab = state.openTabs.find(t => t.id === prompt.tabId);
    if (tab) {
      const file = findFileNode(state.files, tab.fileId);
      if (file?.serverPath && file.content !== undefined) {
        try {
          await saveFileApi(file.serverPath, file.content);
          dispatch({ type: 'MARK_FILE_SAVED', payload: { fileId: file.id } });
        } catch {}
      }
    }
    closeTab(prompt.tabId);
    setPrompt(null);
  };

  const handleDontSave = () => {
    if (!prompt) return;
    closeTab(prompt.tabId);
    setPrompt(null);
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
            onClick={() => setActiveTab(tab.id)}
            draggable
            onDragStart={() => handleDragStart(tab.id)}
            onDragOver={e => handleDragOver(e, tab.id)}
            onDragEnd={() => { dragTab.current = null; }}
          >
            <span className="tab-icon" style={{ color: icon.color }}>{icon.icon}</span>
            <span className="tab-name">{tab.name}</span>
            <button
              className={`tab-close ${dirty ? 'tab-dirty' : ''}`}
              onClick={e => { e.stopPropagation(); tryClose(tab.id, e.currentTarget); }}
            >
              {dirty ? <span className="tab-dot" /> : <X size={12} />}
            </button>
          </div>
        );
      })}
      {prompt && (
        <div
          className="save-prompt"
          style={{ left: prompt.rect.left, top: prompt.rect.bottom + 4 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="save-prompt-text">{tt('tab.savePrompt')}</div>
          <div className="save-prompt-actions">
            <button className="save-prompt-btn save-prompt-save" onClick={handleSave}>{tt('tab.save')}</button>
            <button className="save-prompt-btn save-prompt-discard" onClick={handleDontSave}>{tt('tab.dontSave')}</button>
            <button className="save-prompt-btn save-prompt-cancel" onClick={() => setPrompt(null)}>{tt('tab.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

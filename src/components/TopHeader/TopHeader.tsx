import { useEditor } from '../../store/EditorContext';
import { collectForUpload, uploadFolder } from '../../utils/fileSystem';
import {
  Bot, PanelLeftClose, PanelLeft,
  Terminal,
  FolderOpen, Undo2, Redo2, Minus, Square, X
} from 'lucide-react';
import { useT } from '../../hooks/useT';
import { useEffect, useState } from 'react';
import BlinkLogoIcon from '../common/BlinkLogoIcon';
import './TopHeader.css';

export default function TopHeader() {
  const { state, dispatch, toggleAIPanel, toggleSidebar, toggleTerminal, addToast, triggerEditorAction, openFolderFromServer } = useEditor();
  const tt = useT();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const sync = async () => {
      const api = (window as any).electronAPI;
      if (!api?.isWindowMaximized) return;
      try {
        setIsMaximized(await api.isWindowMaximized());
      } catch {}
    };

    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const getNativeFolderPath = async (): Promise<string | null> => {
    const api = (window as any).electronAPI || (window as any).electron || (window as any).desktop;
    if (!api) return null;

    const picker = api.openFolder || api.pickFolder || api.selectFolder;
    if (typeof picker !== 'function') return null;

    try {
      const result = await picker();
      if (typeof result === 'string') return result;
      if (result && typeof result.path === 'string') return result.path;
      if (result && Array.isArray(result.paths) && typeof result.paths[0] === 'string') return result.paths[0];
    } catch {}

    return null;
  };

  const handleOpenFolder = async () => {
    try {
      const nativePath = await getNativeFolderPath();

      if (nativePath) {
        addToast(tt('toast.reading'), 'info');
        await openFolderFromServer(nativePath);
        return;
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
      if (err.name !== 'AbortError') {
        console.error('Open folder error:', err);
        addToast(tt('toast.openFail') + (err.message || ''), 'error');
      }
    }
  };

  const electronApi = (window as any).electronAPI;

  const handleMinimize = async () => {
    try { await electronApi?.minimizeWindow?.(); } catch {}
  };

  const handleMaximize = async () => {
    try {
      const next = await electronApi?.maximizeWindow?.();
      if (typeof next === 'boolean') setIsMaximized(next);
    } catch {}
  };

  const handleClose = async () => {
    try { await electronApi?.closeWindow?.(); } catch {}
  };

  return (
    <header className="top-header">
      <div className="top-left">
        <div className="top-logo-wrap">
          <BlinkLogoIcon className="top-logo" />
        </div>
        <button className="icon-btn" onClick={toggleSidebar} title="Toggle Sidebar">
          {state.sidebarVisible ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
        <button className="icon-btn" onClick={() => triggerEditorAction('undo')} title="Undo">
          <Undo2 size={15} />
        </button>
        <button className="icon-btn" onClick={() => triggerEditorAction('redo')} title="Redo">
          <Redo2 size={15} />
        </button>
      </div>

      <div className="top-center" />

      <div className="top-right">
        <button className="header-btn folder-btn" onClick={handleOpenFolder} title={tt('openFolder')}>
          <FolderOpen size={14} />
          <span>{tt('top.open')}</span>
        </button>
        <div className="header-divider" />
        <button className={`header-btn terminal-btn ${state.terminalOpen ? 'active' : ''}`} onClick={toggleTerminal} title={tt('top.terminal')}>
          <Terminal size={14} />
          <span>{tt('top.terminal')}</span>
        </button>
        <button className="header-btn ai-btn" onClick={toggleAIPanel} title={tt('top.ai')}>
          <Bot size={14} />
          <span>{tt('top.ai')}</span>
        </button>
        {electronApi && (
          <div className="window-controls">
            <button className="window-control-btn" onClick={handleMinimize} title="Minimize">
              <Minus size={14} />
            </button>
            <button className="window-control-btn" onClick={handleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
              <Square size={12} />
            </button>
            <button className="window-control-btn window-control-close" onClick={handleClose} title="Close">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

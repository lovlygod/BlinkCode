import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Terminal,
  Sidebar as SidebarIcon,
  Bot,
  Settings as SettingsIcon,
  FilePlus,
  FolderPlus,
  Save,
  X,
  FolderOpen,
  FolderX,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  WrapText,
  ChevronsLeftRight,
  Moon,
  Sun,
  Monitor,
  Palette,
  ArrowRight,
  CornerDownLeft,
  ArrowDown,
  ArrowUp,
  Search,
  ChevronsDownUp,
  Globe,
  Split,
  PanelLeftClose,
} from 'lucide-react';
import { useEditor } from '../../store/EditorContext';
import type { EditorSettings } from '../../types';
import './CommandPalette.css';

type Category =
  | 'View'
  | 'File'
  | 'Edit'
  | 'Navigation'
  | 'Appearance'
  | 'Browser'
  | 'Workspace';

interface Command {
  id: string;
  title: string;
  category: Category;
  icon?: React.ReactNode;
  shortcut?: string;
  description?: string;
  when?: () => boolean;
  run: () => void | Promise<void>;
}

function fuzzyScore(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) {
    const starts = t.startsWith(q) ? 1000 : 0;
    return 500 + starts - t.indexOf(q);
  }
  let qi = 0;
  let score = 0;
  let lastMatch = -2;
  for (let i = 0; i < t.length && qi < q.length; i += 1) {
    if (t[i] === q[qi]) {
      score += i - lastMatch === 1 ? 5 : 1;
      lastMatch = i;
      qi += 1;
    }
  }
  return qi === q.length ? score : 0;
}

const THEMES: Array<{ id: EditorSettings['theme']; label: string }> = [
  { id: 'tokyonight', label: 'Tokyo Night' },
  { id: 'everforest', label: 'Everforest' },
  { id: 'ayu', label: 'Ayu' },
  { id: 'catppuccin', label: 'Catppuccin' },
  { id: 'catppuccin-macchiato', label: 'Catppuccin Macchiato' },
  { id: 'gruvbox', label: 'Gruvbox' },
  { id: 'kanagawa', label: 'Kanagawa' },
  { id: 'nord', label: 'Nord' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'one-dark', label: 'One Dark' },
  { id: 'amoled', label: 'AMOLED' },
];

export default function CommandPalette() {
  const {
    state,
    dispatch,
    toggleSidebar,
    toggleTerminal,
    toggleAIPanel,
    toggleSettings,
    updateSettings,
    closeTab,
    triggerEditorAction,
    openFolderFromServer,
    closeBrowserPreview,
    collapseAll,
    addToast,
    splitTab,
    closeSplitTab,
  } = useEditor();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelected(0);
  }, []);

  const runMonacoAction = useCallback((actionId: string) => {
    const ed = (window as any).__blinkcodeEditor;
    if (ed) {
      ed.focus();
      ed.trigger('command-palette', actionId, null);
    }
  }, []);

  const commands = useMemo<Command[]>(() => {
    const s = state;
    const settings = s.settings;
    const activeTab = s.openTabs.find(t => t.id === s.activeTabId);

    const list: Command[] = [
      {
        id: 'view.toggleSidebar',
        title: 'View: Toggle Sidebar',
        category: 'View',
        icon: <SidebarIcon size={14} />,
        shortcut: 'Ctrl+B',
        run: () => toggleSidebar(),
      },
      {
        id: 'view.toggleTerminal',
        title: 'View: Toggle Terminal Panel',
        category: 'View',
        icon: <Terminal size={14} />,
        shortcut: 'Ctrl+`',
        run: () => toggleTerminal(),
      },
      {
        id: 'view.toggleAI',
        title: 'View: Toggle AI Panel',
        category: 'View',
        icon: <Bot size={14} />,
        shortcut: 'Ctrl+I',
        run: () => toggleAIPanel(),
      },
      {
        id: 'view.toggleSettings',
        title: 'View: Toggle Settings',
        category: 'View',
        icon: <SettingsIcon size={14} />,
        shortcut: 'Ctrl+,',
        run: () => toggleSettings(),
      },
      {
        id: 'view.toggleWordWrap',
        title: `View: ${settings.wordWrap ? 'Disable' : 'Enable'} Word Wrap`,
        category: 'View',
        icon: <WrapText size={14} />,
        run: () => updateSettings({ wordWrap: !settings.wordWrap }),
      },
      {
        id: 'view.zoomIn',
        title: 'View: Zoom In (increase font size)',
        category: 'View',
        icon: <ZoomIn size={14} />,
        shortcut: 'Ctrl+=',
        run: () => updateSettings({ fontSize: Math.min(30, settings.fontSize + 1) }),
      },
      {
        id: 'view.zoomOut',
        title: 'View: Zoom Out (decrease font size)',
        category: 'View',
        icon: <ZoomOut size={14} />,
        shortcut: 'Ctrl+-',
        run: () => updateSettings({ fontSize: Math.max(8, settings.fontSize - 1) }),
      },
      {
        id: 'view.splitEditor',
        title: 'View: Split Editor Right',
        category: 'View',
        icon: <Split size={14} />,
        shortcut: 'Ctrl+\\',
        when: () => !!activeTab && !s.splitActiveTabId,
        run: () => { if (activeTab) splitTab(activeTab.id); },
      },
      {
        id: 'view.closeSplit',
        title: 'View: Close Split Editor',
        category: 'View',
        icon: <PanelLeftClose size={14} />,
        when: () => !!s.splitActiveTabId,
        run: () => closeSplitTab(),
      },
      {
        id: 'view.collapseAllFolders',
        title: 'View: Collapse All Folders in Explorer',
        category: 'View',
        icon: <ChevronsDownUp size={14} />,
        run: () => collapseAll(),
      },

      {
        id: 'file.newFile',
        title: 'File: New File',
        category: 'File',
        icon: <FilePlus size={14} />,
        shortcut: 'Ctrl+N',
        run: () => {
          dispatch({ type: 'SHOW_NEW_FILE', payload: { type: 'file' } });
          if (!s.sidebarVisible) dispatch({ type: 'TOGGLE_SIDEBAR' });
        },
      },
      {
        id: 'file.newFolder',
        title: 'File: New Folder',
        category: 'File',
        icon: <FolderPlus size={14} />,
        run: () => {
          dispatch({ type: 'SHOW_NEW_FILE', payload: { type: 'folder' } });
          if (!s.sidebarVisible) dispatch({ type: 'TOGGLE_SIDEBAR' });
        },
      },
      {
        id: 'file.save',
        title: 'File: Save',
        category: 'File',
        icon: <Save size={14} />,
        shortcut: 'Ctrl+S',
        when: () => Boolean(activeTab),
        run: () => {
          // Forward to existing global keybinding logic via synthetic event.
          // Simpler: just dispatch a save keydown on window.
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true })
          );
        },
      },
      {
        id: 'file.closeTab',
        title: 'File: Close Active Tab',
        category: 'File',
        icon: <X size={14} />,
        shortcut: 'Ctrl+W',
        when: () => Boolean(activeTab),
        run: () => {
          if (activeTab) closeTab(activeTab.id);
        },
      },
      {
        id: 'workspace.openFolder',
        title: 'Workspace: Open Folder…',
        category: 'Workspace',
        icon: <FolderOpen size={14} />,
        run: async () => {
          const api = (window as any).electronAPI;
          if (!api?.openFolder) {
            addToast('Folder picker is available only in the desktop app', 'info');
            return;
          }
          try {
            const folder = await api.openFolder();
            if (folder) {
              addToast('Loading folder…', 'info');
              await openFolderFromServer(folder);
            }
          } catch (err: any) {
            addToast('Open folder failed: ' + (err?.message || ''), 'error');
          }
        },
      },
      {
        id: 'workspace.closeFolder',
        title: 'Workspace: Close Folder',
        category: 'Workspace',
        icon: <FolderX size={14} />,
        when: () => s.files.length > 0,
        run: () => {
          dispatch({ type: 'CLOSE_FOLDER' });
          fetch('/api/close-workspace', { method: 'POST' }).catch(() => {});
        },
      },

      {
        id: 'edit.undo',
        title: 'Edit: Undo',
        category: 'Edit',
        icon: <Undo2 size={14} />,
        shortcut: 'Ctrl+Z',
        run: () => triggerEditorAction('undo'),
      },
      {
        id: 'edit.redo',
        title: 'Edit: Redo',
        category: 'Edit',
        icon: <Redo2 size={14} />,
        shortcut: 'Ctrl+Shift+Z',
        run: () => triggerEditorAction('redo'),
      },

      {
        id: 'nav.gotoLine',
        title: 'Go to Line…',
        category: 'Navigation',
        icon: <ArrowRight size={14} />,
        shortcut: 'Ctrl+G',
        when: () => Boolean(activeTab),
        run: () => runMonacoAction('editor.action.gotoLine'),
      },
      {
        id: 'nav.find',
        title: 'Find in File',
        category: 'Navigation',
        icon: <Search size={14} />,
        shortcut: 'Ctrl+F',
        when: () => Boolean(activeTab),
        run: () => runMonacoAction('actions.find'),
      },
      {
        id: 'nav.replace',
        title: 'Replace in File',
        category: 'Navigation',
        icon: <Search size={14} />,
        shortcut: 'Ctrl+H',
        when: () => Boolean(activeTab),
        run: () => runMonacoAction('editor.action.startFindReplaceAction'),
      },

      {
        id: 'appearance.colorSchemeDark',
        title: 'Appearance: Use Dark Color Scheme',
        category: 'Appearance',
        icon: <Moon size={14} />,
        when: () => settings.colorScheme !== 'dark',
        run: () => updateSettings({ colorScheme: 'dark' }),
      },
      {
        id: 'appearance.colorSchemeLight',
        title: 'Appearance: Use Light Color Scheme',
        category: 'Appearance',
        icon: <Sun size={14} />,
        when: () => settings.colorScheme !== 'light',
        run: () => updateSettings({ colorScheme: 'light' }),
      },
      {
        id: 'appearance.colorSchemeSystem',
        title: 'Appearance: Follow System Color Scheme',
        category: 'Appearance',
        icon: <Monitor size={14} />,
        when: () => settings.colorScheme !== 'system',
        run: () => updateSettings({ colorScheme: 'system' }),
      },

      ...THEMES.filter(t => t.id !== settings.theme).map<Command>(t => ({
        id: `appearance.theme.${t.id}`,
        title: `Appearance: Theme — ${t.label}`,
        category: 'Appearance',
        icon: <Palette size={14} />,
        run: () => updateSettings({ theme: t.id }),
      })),

      {
        id: 'browser.close',
        title: 'Browser Preview: Close',
        category: 'Browser',
        icon: <Globe size={14} />,
        when: () => s.browserOpen,
        run: () => closeBrowserPreview(),
      },
      {
        id: 'view.toggleCompactMode',
        title: `View: ${settings.compactMode ? 'Disable' : 'Enable'} Compact Mode`,
        category: 'View',
        icon: <ChevronsLeftRight size={14} />,
        run: () => updateSettings({ compactMode: !settings.compactMode }),
      },
    ];

    return list.filter(c => (c.when ? c.when() : true));
  }, [
    state,
    dispatch,
    toggleSidebar,
    toggleTerminal,
    toggleAIPanel,
    toggleSettings,
    updateSettings,
    closeTab,
    triggerEditorAction,
    openFolderFromServer,
    closeBrowserPreview,
    collapseAll,
    addToast,
    runMonacoAction,
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const scored = commands
      .map(cmd => {
        const hay = `${cmd.category} ${cmd.title}`;
        const score = fuzzyScore(query.trim(), hay);
        return { cmd, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(s => s.cmd);
  }, [commands, query]);

  useEffect(() => {
    const toggle = () => setOpen(prev => !prev);
    window.addEventListener('blinkcode:toggleCommandPalette', toggle);
    return () => window.removeEventListener('blinkcode:toggleCommandPalette', toggle);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (selected >= filtered.length) setSelected(0);
  }, [filtered.length, selected]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(filtered.length - 1, s + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(0, s - 1));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setSelected(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setSelected(Math.max(0, filtered.length - 1));
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      setSelected(s => Math.min(filtered.length - 1, s + 8));
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      setSelected(s => Math.max(0, s - 8));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selected];
      if (cmd) {
        close();
        // Defer run so the palette unmounts and focus returns to editor cleanly.
        setTimeout(() => {
          try { cmd.run(); } catch (err) { console.error('[CommandPalette] run failed', err); }
        }, 0);
      }
    }
  };

  return (
    <div className="cmdp-backdrop" onMouseDown={close}>
      <div
        className="cmdp-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="cmdp-input-row">
          <Search size={14} className="cmdp-input-icon" />
          <input
            ref={inputRef}
            className="cmdp-input"
            placeholder="Type a command…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
          <span className="cmdp-hint">
            <kbd>Esc</kbd> to close
          </span>
        </div>
        <div className="cmdp-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="cmdp-empty">No commands match “{query}”</div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                type="button"
                key={cmd.id}
                data-index={idx}
                className={`cmdp-item${idx === selected ? ' is-selected' : ''}`}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => {
                  close();
                  setTimeout(() => {
                    try { cmd.run(); } catch (err) { console.error('[CommandPalette] run failed', err); }
                  }, 0);
                }}
              >
                <span className="cmdp-item-icon">{cmd.icon}</span>
                <span className="cmdp-item-body">
                  <span className="cmdp-item-title">{cmd.title}</span>
                  {cmd.description && <span className="cmdp-item-desc">{cmd.description}</span>}
                </span>
                <span className="cmdp-item-meta">
                  <span className="cmdp-item-category">{cmd.category}</span>
                  {cmd.shortcut && <kbd className="cmdp-item-kbd">{cmd.shortcut}</kbd>}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="cmdp-footer">
          <span><kbd><ArrowUp size={10} /></kbd><kbd><ArrowDown size={10} /></kbd> navigate</span>
          <span><kbd><CornerDownLeft size={10} /></kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
          <span className="cmdp-count">{filtered.length} / {commands.length}</span>
        </div>
      </div>
    </div>
  );
}

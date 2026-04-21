import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { EditorState, EditorAction, FileNode, Tab, ToastItem, TerminalLine, TerminalInstance, EditorSettings, Keybinding, SavedEditorState } from '../types';
import { getMonacoLanguage, isSupportedWebFile } from '../utils/supportedWebFiles';
import {
  fetchTree, fetchFileContent, saveFile, createFileOnServer,
  deleteOnServer, renameOnServer, moveOnServer,
  openFolderOnServer, fetchState, saveStateToServer,
  getFsWsUrl,
} from '../utils/api';
import { v4 as uuid } from 'uuid';

const defaultKeybindings: Keybinding[] = [
  { id: 'commandPalette', label: 'Command Palette', keys: 'Ctrl+Shift+P' },
  { id: 'save', label: 'Save File', keys: 'Ctrl+S' },
  { id: 'toggleSidebar', label: 'Toggle Sidebar', keys: 'Ctrl+B' },
  { id: 'toggleTerminal', label: 'Toggle Terminal', keys: 'Ctrl+`' },
  { id: 'toggleAI', label: 'Toggle AI Panel', keys: 'Ctrl+I' },
  { id: 'toggleSettings', label: 'Toggle Settings', keys: 'Ctrl+,' },
  { id: 'newFile', label: 'New File', keys: 'Alt+N' },
  { id: 'closeTab', label: 'Close Tab', keys: 'Alt+W' },
  { id: 'zoomIn', label: 'Zoom In', keys: 'Ctrl+=' },
  { id: 'zoomOut', label: 'Zoom Out', keys: 'Ctrl+-' },
  { id: 'find', label: 'Find', keys: 'Ctrl+F' },
  { id: 'replace', label: 'Find and Replace', keys: 'Ctrl+H' },
  { id: 'undo', label: 'Undo', keys: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', keys: 'Ctrl+Shift+Z' },
  { id: 'goToLine', label: 'Go to Line', keys: 'Ctrl+G' },
  { id: 'toggleWordWrap', label: 'Toggle Word Wrap', keys: 'Alt+Z' },
  { id: 'comment', label: 'Toggle Comment', keys: 'Ctrl+/' },
];

const defaultSettings: EditorSettings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  autoSaveDelay: 1000,
  fontLigatures: true,
  lineNumbers: true,
  cursorBlinking: 'smooth',
  fontFamily: 'JetBrains Mono',
  cursorStyle: 'line',
  renderWhitespace: 'none',
  bracketPairColorization: true,
  autoClosingBrackets: true,
  smoothScrolling: true,
  trimTrailingWhitespace: false,
  insertSpaces: true,
  animations: true,
  showFileIcons: true,
  compactMode: false,
  keybindings: defaultKeybindings,
  language: 'en',
  colorScheme: 'dark',
  theme: 'one-dark',
};

function loadSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem('blinkcode-settings');
    if (raw) {
      const saved = JSON.parse(raw);
      const settings = { ...defaultSettings, ...saved };
      if (saved.keybindings) {
        const merged = defaultKeybindings.map(dk => {
          const sk = saved.keybindings.find((k: Keybinding) => k.id === dk.id);
          return sk ? { ...dk, keys: sk.keys } : dk;
        });
        settings.keybindings = merged;
      }
      return settings;
    }
  } catch {}
  return { ...defaultSettings };
}

export type ThemeName = EditorSettings['theme'];

export const THEME_LIST: { id: ThemeName; desc: string; url: string }[] = [
  { id: 'tokyonight', desc: 'Based on the tokyonight theme', url: 'https://github.com/folke/tokyonight.nvim' },
  { id: 'everforest', desc: 'Based on the Everforest theme', url: 'https://github.com/sainnhe/everforest' },
  { id: 'ayu', desc: 'Based on the Ayu dark theme', url: 'https://github.com/ayu-theme' },
  { id: 'catppuccin', desc: 'Based on the Catppuccin theme', url: 'https://github.com/catppuccin' },
  { id: 'catppuccin-macchiato', desc: 'Based on the Catppuccin theme', url: 'https://github.com/catppuccin' },
  { id: 'gruvbox', desc: 'Based on the Gruvbox theme', url: 'https://github.com/morhetz/gruvbox' },
  { id: 'kanagawa', desc: 'Based on the Kanagawa theme', url: 'https://github.com/rebelot/kanagawa.nvim' },
  { id: 'nord', desc: 'Based on the Nord theme', url: 'https://github.com/nordtheme/nord' },
  { id: 'matrix', desc: 'Хакерская тема: зеленый на черном', url: '' },
  { id: 'one-dark', desc: 'Based on the Atom One Dark theme', url: 'https://github.com/Th3Whit3Wolf/one-nvim' },
  { id: 'amoled', desc: 'Pure black AMOLED theme', url: '' },
];

const MIGRATE_KEYS: Record<string, string> = {
  'Ctrl+N': 'Alt+N',
  'Ctrl+W': 'Alt+W',
};

function migrateKeybindings(kbs: Keybinding[]): Keybinding[] {
  return kbs.map(kb => MIGRATE_KEYS[kb.keys] ? { ...kb, keys: MIGRATE_KEYS[kb.keys] } : kb);
}

const loadedSettings = loadSettings();
loadedSettings.keybindings = migrateKeybindings(loadedSettings.keybindings);

const initialState: EditorState = {
  files: [],
  openTabs: [],
  activeTabId: null,
  viewMode: 'editor',
  browserOpen: false,
  browserUrl: null,
  browserLoading: false,
  browserCanGoBack: false,
  browserCanGoForward: false,
  browserError: null,
  showAIPanel: false,
  showSettings: false,
  sidebarWidth: 250,
  sidebarVisible: true,
  toasts: [],
  terminalOpen: false,
  terminalHeight: 220,
  terminalInstances: [],
  activeTerminalId: null,
  settings: loadedSettings,
  pendingCreate: null,
  workspaceDir: '',
};

function findNodeById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) { const found = findNodeById(node.children, id); if (found) return found; }
  }
  return null;
}

function findNodeByPath(nodes: FileNode[], serverPath: string): FileNode | null {
  for (const node of nodes) {
    if (node.serverPath === serverPath) return node;
    if (node.children) { const found = findNodeByPath(node.children, serverPath); if (found) return found; }
  }
  return null;
}

function updateNode(nodes: FileNode[], id: string, updater: (n: FileNode) => FileNode): FileNode[] {
  return nodes.map(n => {
    if (n.id === id) return updater(n);
    if (n.children) return { ...n, children: updateNode(n.children, id, updater) };
    return n;
  });
}

function removeNode(nodes: FileNode[], id: string): FileNode[] {
  return nodes.filter(n => n.id !== id).map(n => {
    if (n.children) return { ...n, children: removeNode(n.children, id) };
    return n;
  });
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function sortTree(nodes: FileNode[]): FileNode[] {
  return sortNodes(nodes).map(n => ({
    ...n,
    children: n.children ? sortTree(n.children) : undefined,
  }));
}

function addNodeByPath(nodes: FileNode[], segments: string[], type: 'file' | 'folder', name: string, fullPath: string): FileNode[] {
  if (segments.length === 0) {
    if (nodes.some(n => n.name === name && n.type === type)) return nodes;
    const newNode: FileNode = {
      id: uuid(),
      name,
      type,
      serverPath: fullPath,
      ...(type === 'folder' ? { children: [] } : { language: getMonacoLanguage(name), dirty: false }),
    };
    return sortNodes([...nodes, newNode]);
  }

  const [head, ...tail] = segments;
  let idx = nodes.findIndex(n => n.type === 'folder' && n.name === head);

  if (idx === -1) {
    const parentPath = segments.join('/');
    const parent: FileNode = {
      id: uuid(),
      name: head,
      type: 'folder',
      serverPath: parentPath,
      isExpanded: true,
      children: [],
    };
    const updated = sortNodes([...nodes, parent]);
    idx = updated.findIndex(n => n.type === 'folder' && n.name === head);
    nodes = updated;
  }

  return nodes.map((n, i) => {
    if (i !== idx) return n;
    return {
      ...n,
      isExpanded: true,
      children: addNodeByPath(n.children || [], tail, type, name, fullPath),
    };
  });
}

function insertNodeAt(nodes: FileNode[], targetId: string | null, newNode: FileNode, position: 'before' | 'after' | 'inside'): FileNode[] {
  if (position === 'inside' && targetId) {
    const result = nodes.map(n => {
      if (n.id === targetId && n.type === 'folder') {
        const children = sortNodes([...(n.children || []), newNode]);
        return { ...n, children, isExpanded: true };
      }
      if (n.children) return { ...n, children: insertNodeAt(n.children, targetId, newNode, position) };
      return n;
    });
    return result;
  }
  if (position === 'before' || position === 'after') {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) {
        const result = [...nodes];
        result.splice(position === 'before' ? i : i + 1, 0, newNode);
        return sortNodes(result);
      }
      if (nodes[i].children) {
        const newChildren = insertNodeAt(nodes[i].children!, targetId, newNode, position);
        if (newChildren !== nodes[i].children!) {
          return nodes.map(n => n.id === nodes[i].id ? { ...n, children: sortNodes(newChildren) } : n);
        }
      }
    }
  }
  return sortNodes([...nodes, newNode]);
}

function getAllFileIds(nodes: FileNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) { if (n.type === 'file') ids.push(n.id); if (n.children) ids.push(...getAllFileIds(n.children)); }
  return ids;
}

function getExpandedFolders(nodes: FileNode[]): string[] {
  const result: string[] = [];
  for (const n of nodes) {
    if (n.type === 'folder' && n.isExpanded && n.serverPath) result.push(n.serverPath);
    if (n.children) result.push(...getExpandedFolders(n.children));
  }
  return result;
}

function getSaveableState(state: EditorState): SavedEditorState {
  const activeTab = state.openTabs.find(t => t.id === state.activeTabId);
  const activeFile = activeTab ? findNodeById(state.files, activeTab.fileId) : null;

  return {
    openTabs: state.openTabs.map(t => {
      const file = findNodeById(state.files, t.fileId);
      return {
        serverPath: file?.serverPath || '',
        name: t.name,
        language: t.language || '',
        isBinary: file?.binary || false,
      };
    }).filter(t => t.serverPath),
    activeTabServerPath: activeFile?.serverPath || null,
    sidebarWidth: state.sidebarWidth,
    sidebarVisible: state.sidebarVisible,
    terminalOpen: state.terminalOpen,
    terminalHeight: state.terminalHeight,
    viewMode: state.viewMode,
    showAIPanel: state.showAIPanel,
    settings: state.settings,
    expandedFolders: getExpandedFolders(state.files),
    folderClosed: state.files.length === 0,
    workspaceDir: state.workspaceDir,
  };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_FILES': return { ...state, files: sortTree(action.payload) };
    case 'CLOSE_FOLDER': return { ...state, files: [], openTabs: [], activeTabId: null, workspaceDir: '' };

    case 'OPEN_FILE': {
      const { file } = action.payload;
      const existing = state.openTabs.find(t => t.fileId === file.id);
      if (existing) return { ...state, activeTabId: existing.id };
      const tab: Tab = { id: uuid(), fileId: file.id, name: file.name, language: file.language || getMonacoLanguage(file.name) };
      return { ...state, openTabs: [...state.openTabs, tab], activeTabId: tab.id };
    }

    case 'CLOSE_TAB': {
      const { tabId } = action.payload;
      const idx = state.openTabs.findIndex(t => t.id === tabId);
      const tabs = state.openTabs.filter(t => t.id !== tabId);
      let activeId = state.activeTabId;
      if (state.activeTabId === tabId) {
        if (tabs.length === 0) activeId = null;
        else if (idx >= tabs.length) activeId = tabs[tabs.length - 1].id;
        else activeId = tabs[idx]?.id || null;
      }
      return { ...state, openTabs: tabs, activeTabId: activeId };
    }

    case 'SET_ACTIVE_TAB': return { ...state, activeTabId: action.payload.tabId };

    case 'UPDATE_FILE_CONTENT': {
      const { fileId, content } = action.payload;
      return { ...state, files: updateNode(state.files, fileId, n => ({ ...n, content, dirty: true })) };
    }

    case 'SET_FILE_CONTENT': {
      const { fileId, content } = action.payload;
      return { ...state, files: updateNode(state.files, fileId, n => ({ ...n, content, dirty: false })) };
    }

    case 'MARK_FILE_SAVED': {
      const { fileId } = action.payload;
      return { ...state, files: updateNode(state.files, fileId, n => ({ ...n, dirty: false })), pendingCreate: null };
    }

    case 'SHOW_NEW_FILE': return { ...state, pendingCreate: action.payload.type };

    case 'CLEAR_PENDING_CREATE': return { ...state, pendingCreate: null };

    case 'TOGGLE_FOLDER': return { ...state, files: updateNode(state.files, action.payload.folderId, n => ({ ...n, isExpanded: !n.isExpanded })) };

    case 'ADD_FILE': {
      const { parentId, name, type, serverPath } = action.payload;
      const newNode: FileNode = {
        id: uuid(), name, type, isExpanded: type === 'folder',
        content: type === 'file' ? '' : undefined,
        language: type === 'file' ? getMonacoLanguage(name) : undefined,
        children: type === 'folder' ? [] : undefined,
        serverPath,
      };
      if (parentId) {
        return { ...state, files: insertNodeAt(state.files, parentId, newNode, 'inside') };
      }
      return { ...state, files: sortNodes([...state.files, newNode]) };
    }

    case 'DELETE_NODE': {
      const { nodeId } = action.payload;
      const node = findNodeById(state.files, nodeId);
      if (!node) return state;
      const fids = node.type === 'folder' ? getAllFileIds(node.children || []) : [node.id];
      const tabs = state.openTabs.filter(t => !fids.includes(t.fileId));
      let activeId = state.activeTabId;
      if (fids.some(fid => state.openTabs.find(t => t.fileId === fid && t.id === state.activeTabId))) {
        activeId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
      }
      return { ...state, files: removeNode(state.files, nodeId), openTabs: tabs, activeTabId: activeId };
    }

    case 'RENAME_NODE': {
      const { nodeId, newName } = action.payload;
      const files = updateNode(state.files, nodeId, n => ({ ...n, name: newName, language: n.type === 'file' ? getMonacoLanguage(newName) : n.language }));
      const tabs = state.openTabs.map(t => t.fileId === nodeId ? { ...t, name: newName, language: getMonacoLanguage(newName) } : t);
      return { ...state, files, openTabs: tabs };
    }

    case 'MOVE_NODE': {
      const { nodeId, targetId, position } = action.payload;
      if (nodeId === targetId) return state;
      const node = findNodeById(state.files, nodeId);
      if (!node) return state;
      if (position === 'inside' && targetId && findNodeById(state.files, targetId)?.type !== 'folder') return state;
      const filesWithout = removeNode(state.files, nodeId);
      return { ...state, files: insertNodeAt(filesWithout, targetId, node, position) };
    }

    case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload.mode };

    case 'OPEN_BROWSER_PREVIEW': {
      return {
        ...state,
        browserOpen: true,
        browserUrl: action.payload.url,
        browserLoading: true,
        browserCanGoBack: false,
        browserCanGoForward: false,
        browserError: null,
      };
    }

    case 'CLOSE_BROWSER_PREVIEW': {
      return {
        ...state,
        browserOpen: false,
        browserLoading: false,
        browserCanGoBack: false,
        browserCanGoForward: false,
        browserError: null,
      };
    }

    case 'SET_BROWSER_URL': {
      return {
        ...state,
        browserUrl: action.payload.url,
      };
    }

    case 'SET_BROWSER_LOADING': {
      return {
        ...state,
        browserLoading: action.payload.loading,
      };
    }

    case 'SET_BROWSER_NAV_STATE': {
      return {
        ...state,
        browserCanGoBack: action.payload.canGoBack,
        browserCanGoForward: action.payload.canGoForward,
      };
    }

    case 'SET_BROWSER_ERROR': {
      return {
        ...state,
        browserError: action.payload.error,
      };
    }

    case 'TOGGLE_AI_PANEL': return { ...state, showAIPanel: !state.showAIPanel };

    case 'SET_SIDEBAR_WIDTH': return { ...state, sidebarWidth: Math.max(180, Math.min(420, action.payload.width)) };

    case 'ADD_TOAST': return { ...state, toasts: [...state.toasts, action.payload] };

    case 'REMOVE_TOAST': return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload.id) };

    case 'TOGGLE_SIDEBAR': return { ...state, sidebarVisible: !state.sidebarVisible };

    case 'REORDER_TABS': return { ...state, openTabs: action.payload.tabs };

    case 'TOGGLE_TERMINAL': return { ...state, terminalOpen: !state.terminalOpen };

    case 'SET_TERMINAL_HEIGHT': return { ...state, terminalHeight: Math.max(120, Math.min(500, action.payload.height)) };

    case 'ADD_TERMINAL_INSTANCE': {
      const inst = {
        ...action.payload,
        cwd: action.payload.cwd || '',
        title: action.payload.title || action.payload.name,
        cursor: action.payload.cursor || 0,
      };
      return {
        ...state,
        terminalInstances: [...state.terminalInstances, inst],
        activeTerminalId: inst.id,
        terminalOpen: true,
      };
    }

    case 'REMOVE_TERMINAL_INSTANCE': {
      const { id } = action.payload;
      const instances = state.terminalInstances.filter(t => t.id !== id);
      let activeId = state.activeTerminalId;
      if (activeId === id) {
        activeId = instances.length > 0 ? instances[instances.length - 1].id : null;
      }
      return {
        ...state,
        terminalInstances: instances,
        activeTerminalId: activeId,
        terminalOpen: instances.length > 0,
      };
    }

    case 'SET_ACTIVE_TERMINAL': return { ...state, activeTerminalId: action.payload.id };

    case 'ADD_TERMINAL_LINE': {
      return {
        ...state,
        terminalInstances: state.terminalInstances,
      };
    }

    case 'UPDATE_TERMINAL_CWD': {
      const { instanceId, cwd } = action.payload;
      return {
        ...state,
        terminalInstances: state.terminalInstances.map(t =>
          t.id === instanceId ? { ...t, cwd } : t
        ),
      };
    }

    case 'ADD_TERMINAL_LINE': {
      return state;
    }

    case 'CLEAR_TERMINAL': {
      return {
        ...state,
        terminalInstances: state.terminalInstances,
      };
    }

    case 'COLLAPSE_ALL': {
      const collapse = (nodes: FileNode[]): FileNode[] => nodes.map(n => ({ ...n, isExpanded: false, children: n.children ? collapse(n.children) : undefined }));
      return { ...state, files: collapse(state.files) };
    }

    case 'TOGGLE_SETTINGS': return { ...state, showSettings: !state.showSettings };

    case 'UPDATE_SETTINGS': {
      const settings = { ...state.settings, ...action.payload };
      try { localStorage.setItem('blinkcode-settings', JSON.stringify(settings)); } catch {}
      return { ...state, settings };
    }

    case 'RESTORE_STATE': {
      const p = action.payload;
      let s = { ...state };

      if (p.settings) {
        s.settings = { ...s.settings, ...p.settings };
        if (p.settings.keybindings) {
          const merged = defaultKeybindings.map(dk => {
            const sk = p.settings!.keybindings!.find((k: Keybinding) => k.id === dk.id);
            return sk ? { ...dk, keys: sk.keys } : dk;
          });
          s.settings.keybindings = migrateKeybindings(merged);
        }
      }
      if (p.sidebarWidth !== undefined) s.sidebarWidth = p.sidebarWidth;
      if (p.sidebarVisible !== undefined) s.sidebarVisible = p.sidebarVisible;
      if (p.terminalOpen !== undefined) s.terminalOpen = p.terminalOpen;
      if (p.terminalHeight !== undefined) s.terminalHeight = p.terminalHeight;
      if (p.viewMode !== undefined) s.viewMode = p.viewMode;
      if (p.showAIPanel !== undefined) s.showAIPanel = p.showAIPanel;
      if (p.workspaceDir !== undefined) s.workspaceDir = p.workspaceDir;

      if (p.expandedFolders) {
        const expandByPath = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(n => ({
            ...n,
            isExpanded: n.type === 'folder' && n.serverPath ? p.expandedFolders!.includes(n.serverPath) : n.isExpanded,
            children: n.children ? expandByPath(n.children) : undefined,
          }));
        };
        s.files = expandByPath(s.files);
      }

      if (p.openTabs && p.openTabs.length > 0) {
        const tabs: Tab[] = [];
        for (const tabInfo of p.openTabs) {
          const file = findNodeByPath(s.files, tabInfo.serverPath);
          if (file) {
            tabs.push({
              id: uuid(),
              fileId: file.id,
              name: file.name,
              language: file.language || tabInfo.language,
            });
          }
        }
        s.openTabs = tabs;

        if (p.activeTabServerPath) {
          const activeFile = findNodeByPath(s.files, p.activeTabServerPath);
          if (activeFile) {
            const activeTab = tabs.find(t => t.fileId === activeFile.id);
            if (activeTab) s.activeTabId = activeTab.id;
          }
        }
        if (!s.activeTabId && tabs.length > 0) {
          s.activeTabId = tabs[0].id;
        }
      }

      return s;
    }

    case 'SET_WORKSPACE_DIR': return { ...state, workspaceDir: action.payload };

    case 'FS_ADD_NODE': {
      const { serverPath, name, type } = action.payload;
      if (findNodeByPath(state.files, serverPath)) return state;
      const segments = serverPath.split('/').slice(0, -1);
      return { ...state, files: addNodeByPath(state.files, segments, type, name, serverPath) };
    }

    case 'FS_REMOVE_NODE': {
      const { serverPath } = action.payload;
      const target = findNodeByPath(state.files, serverPath);
      if (!target) return state;
      const toCloseIds = target.type === 'folder' ? getAllFileIds([target]) : [target.id];
      const tabs = state.openTabs.filter(t => !toCloseIds.includes(t.fileId));
      let activeId = state.activeTabId;
      if (activeId && !tabs.find(t => t.id === activeId)) {
        activeId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
      }
      return {
        ...state,
        files: removeNode(state.files, target.id),
        openTabs: tabs,
        activeTabId: activeId,
      };
    }

    default: return state;
  }
}

function matchKeyCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+');
  const keyPart = parts[parts.length - 1];
  const hasCtrl = parts.includes('Ctrl');
  const hasShift = parts.includes('Shift');
  const hasAlt = parts.includes('Alt');
  if (e.ctrlKey !== hasCtrl || e.shiftKey !== hasShift || e.altKey !== hasAlt) return false;
  const codeMap: Record<string, string> = {
    a: 'KeyA', b: 'KeyB', c: 'KeyC', d: 'KeyD', e: 'KeyE', f: 'KeyF',
    g: 'KeyG', h: 'KeyH', i: 'KeyI', j: 'KeyJ', k: 'KeyK', l: 'KeyL',
    m: 'KeyM', n: 'KeyN', o: 'KeyO', p: 'KeyP', q: 'KeyQ', r: 'KeyR',
    s: 'KeyS', t: 'KeyT', u: 'KeyU', v: 'KeyV', w: 'KeyW', x: 'KeyX',
    y: 'KeyY', z: 'KeyZ',
    '0': 'Digit0', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3', '4': 'Digit4',
    '5': 'Digit5', '6': 'Digit6', '7': 'Digit7', '8': 'Digit8', '9': 'Digit9',
    ',': 'Comma', '.': 'Period', '/': 'Slash', '\\': 'Backslash',
    ';': 'Semicolon', "'": 'Quote', '[': 'BracketLeft', ']': 'BracketRight',
    '=': 'Equal', '-': 'Minus', '`': 'Backquote',
  };
  const code = codeMap[keyPart.toLowerCase()];
  if (code && e.code === code) return true;
  if (!code && e.key.toLowerCase() === keyPart.toLowerCase()) return true;
  return false;
}

interface Ctx {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  openFile: (file: FileNode) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  toggleFolder: (folderId: string) => void;
  addFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
  deleteNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newName: string) => void;
  moveNode: (nodeId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  setViewMode: (mode: 'editor' | 'split') => void;
  openBrowserPreview: (url: string) => void;
  closeBrowserPreview: () => void;
  setBrowserUrl: (url: string | null) => void;
  setBrowserLoading: (loading: boolean) => void;
  setBrowserNavState: (canGoBack: boolean, canGoForward: boolean) => void;
  setBrowserError: (error: string | null) => void;
  toggleAIPanel: () => void;
  setSidebarWidth: (width: number) => void;
  addToast: (message: string, type: ToastItem['type']) => void;
  removeToast: (id: string) => void;
  toggleSidebar: () => void;
  getActiveFile: () => FileNode | null;
  reorderTabs: (tabs: Tab[]) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (h: number) => void;
  addTerminalInstance: (inst: TerminalInstance) => void;
  removeTerminalInstance: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  addTerminalLine: (instanceId: string, text: string, type: TerminalLine['type']) => void;
  updateTerminalCwd: (instanceId: string, cwd: string) => void;
  clearTerminal: (instanceId: string) => void;
  collapseAll: () => void;
  loadFromServer: () => Promise<void>;
  openFolderFromServer: (dirPath: string) => Promise<void>;
  toggleSettings: () => void;
  updateSettings: (s: Partial<EditorSettings>) => void;
  registerEditor: (editor: any) => void;
  triggerEditorAction: (action: 'undo' | 'redo') => void;
}

const EditorContext = createContext<Ctx | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ...initialState, files: [] });
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const editorRef = useRef<any>(null);
  const registerEditor = useCallback((editor: any) => {
    editorRef.current = editor;
    (window as any).__blinkcodeEditor = editor;
  }, []);
  const triggerEditorAction = useCallback((action: 'undo' | 'redo') => {
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.trigger('keyboard', action);
    }
  }, []);

  const openFile = useCallback(async (file: FileNode) => {
    if (file.type === 'file' && !file.binary && file.content === undefined && file.serverPath) {
      try {
        const content = await fetchFileContent(file.serverPath);
        dispatch({ type: 'SET_FILE_CONTENT', payload: { fileId: file.id, content } });
      } catch {}
    }
    if (file.type === 'file' && file.binary) {
      dispatch({ type: 'SET_FILE_CONTENT', payload: { fileId: file.id, content: '' } });
    }
    dispatch({ type: 'OPEN_FILE', payload: { file } });
  }, []);

  const closeTab = useCallback((id: string) => dispatch({ type: 'CLOSE_TAB', payload: { tabId: id } }), []);
  const setActiveTab = useCallback((id: string) => dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: id } }), []);

  const updateFileContent = useCallback((fid: string, c: string) => {
    dispatch({ type: 'UPDATE_FILE_CONTENT', payload: { fileId: fid, content: c } });
    const file = findNodeById(state.files, fid);
    if (file?.serverPath && isSupportedWebFile(file.name) && state.settings.autoSaveDelay > 0) {
      if (saveTimers.current.has(fid)) clearTimeout(saveTimers.current.get(fid)!);
      saveTimers.current.set(fid, setTimeout(async () => {
        try {
          let contentToSave = c;
          if (state.settings.trimTrailingWhitespace) {
            contentToSave = contentToSave.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
          }
          await saveFile(file.serverPath!, contentToSave);
          if (state.settings.trimTrailingWhitespace && contentToSave !== c) {
            dispatch({ type: 'SET_FILE_CONTENT', payload: { fileId: fid, content: contentToSave } });
          }
          dispatch({ type: 'MARK_FILE_SAVED', payload: { fileId: fid } });
        } catch {}
        saveTimers.current.delete(fid);
      }, state.settings.autoSaveDelay));
    }
  }, [state.files, state.settings.autoSaveDelay, state.settings.trimTrailingWhitespace]);

  const toggleFolder = useCallback((id: string) => dispatch({ type: 'TOGGLE_FOLDER', payload: { folderId: id } }), []);

  const addFile = useCallback(async (parentId: string | null, n: string, t: 'file' | 'folder') => {
    const parent = parentId ? findNodeById(state.files, parentId) : null;
    const parentPath = parent?.serverPath || '';
    const sp = parentPath ? `${parentPath}/${n}` : n;

    try {
      await createFileOnServer(sp, t);
      dispatch({ type: 'ADD_FILE', payload: { parentId, name: n, type: t, serverPath: sp } });
    } catch (err) { console.error('[addFile] failed:', sp, err); }
  }, [state.files]);

  const deleteNode = useCallback(async (nodeId: string) => {
    const node = findNodeById(state.files, nodeId);
    dispatch({ type: 'DELETE_NODE', payload: { nodeId } });
    if (node?.serverPath) {
      try { await deleteOnServer(node.serverPath); } catch {}
    }
  }, [state.files]);

  const renameNode = useCallback(async (nodeId: string, newName: string) => {
    const node = findNodeById(state.files, nodeId);
    dispatch({ type: 'RENAME_NODE', payload: { nodeId, newName } });
    if (node?.serverPath) {
      try {
        await renameOnServer(node.serverPath, newName);
      } catch {}
    }
  }, [state.files]);

  const moveNode = useCallback(async (nodeId: string, tid: string | null, pos: 'before' | 'after' | 'inside') => {
    const node = findNodeById(state.files, nodeId);
    const target = tid ? findNodeById(state.files, tid) : null;
    dispatch({ type: 'MOVE_NODE', payload: { nodeId, targetId: tid, position: pos } });
    if (node?.serverPath) {
      try {
        await moveOnServer(node.serverPath, target?.serverPath || null, pos);
      } catch {}
    }
  }, [state.files]);

  const setViewMode = useCallback((m: 'editor' | 'split') => dispatch({ type: 'SET_VIEW_MODE', payload: { mode: m } }), []);
  const openBrowserPreview = useCallback((url: string) => dispatch({ type: 'OPEN_BROWSER_PREVIEW', payload: { url } }), []);
  const closeBrowserPreview = useCallback(() => dispatch({ type: 'CLOSE_BROWSER_PREVIEW' }), []);
  const setBrowserUrl = useCallback((url: string | null) => dispatch({ type: 'SET_BROWSER_URL', payload: { url } }), []);
  const setBrowserLoading = useCallback((loading: boolean) => dispatch({ type: 'SET_BROWSER_LOADING', payload: { loading } }), []);
  const setBrowserNavState = useCallback((canGoBack: boolean, canGoForward: boolean) => dispatch({ type: 'SET_BROWSER_NAV_STATE', payload: { canGoBack, canGoForward } }), []);
  const setBrowserError = useCallback((error: string | null) => dispatch({ type: 'SET_BROWSER_ERROR', payload: { error } }), []);
  const toggleAIPanel = useCallback(() => dispatch({ type: 'TOGGLE_AI_PANEL' }), []);
  const setSidebarWidth = useCallback((w: number) => dispatch({ type: 'SET_SIDEBAR_WIDTH', payload: { width: w } }), []);
  const addToast = useCallback((msg: string, type: ToastItem['type']) => {
    const id = uuid();
    dispatch({ type: 'ADD_TOAST', payload: { id, message: msg, type } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: { id } }), 3000);
  }, []);
  const removeToast = useCallback((id: string) => dispatch({ type: 'REMOVE_TOAST', payload: { id } }), []);
  const toggleSidebar = useCallback(() => dispatch({ type: 'TOGGLE_SIDEBAR' }), []);
  const getActiveFile = useCallback(() => {
    if (!state.activeTabId) return null;
    const tab = state.openTabs.find(t => t.id === state.activeTabId);
    if (!tab) return null;
    return findNodeById(state.files, tab.fileId);
  }, [state.activeTabId, state.openTabs, state.files]);
  const reorderTabs = useCallback((tabs: Tab[]) => dispatch({ type: 'REORDER_TABS', payload: { tabs } }), []);
  const toggleTerminal = useCallback(() => dispatch({ type: 'TOGGLE_TERMINAL' }), []);
  const setTerminalHeight = useCallback((h: number) => dispatch({ type: 'SET_TERMINAL_HEIGHT', payload: { height: h } }), []);
  const addTerminalInstance = useCallback((inst: TerminalInstance) => dispatch({ type: 'ADD_TERMINAL_INSTANCE', payload: inst }), []);
  const removeTerminalInstance = useCallback((id: string) => dispatch({ type: 'REMOVE_TERMINAL_INSTANCE', payload: { id } }), []);
  const setActiveTerminal = useCallback((id: string) => dispatch({ type: 'SET_ACTIVE_TERMINAL', payload: { id } }), []);
  const addTerminalLine = useCallback((_instanceId: string, _text: string, _type: TerminalLine['type']) => {
    // terminal output is now rendered directly by xterm session instances
  }, []);
  const updateTerminalCwd = useCallback((instanceId: string, cwd: string) => dispatch({ type: 'UPDATE_TERMINAL_CWD', payload: { instanceId, cwd } }), []);
  const clearTerminal = useCallback((instanceId: string) => dispatch({ type: 'CLEAR_TERMINAL', payload: { instanceId } }), []);
  const collapseAll = useCallback(() => dispatch({ type: 'COLLAPSE_ALL' }), []);
  const toggleSettings = useCallback(() => dispatch({ type: 'TOGGLE_SETTINGS' }), []);
  const updateSettings = useCallback((s: Partial<EditorSettings>) => dispatch({ type: 'UPDATE_SETTINGS', payload: s }), []);

  const loadFromServer = useCallback(async () => {
    try {
      let saved: SavedEditorState | null = null;
      try {
        saved = await fetchState();
      } catch {}

      if (saved && saved.folderClosed) {
        if (saved.settings) {
          dispatch({ type: 'RESTORE_STATE', payload: { settings: saved.settings } });
        }
        return;
      }

      if (saved?.workspaceDir) {
        try { await openFolderOnServer(saved.workspaceDir); } catch {}
        dispatch({ type: 'SET_WORKSPACE_DIR', payload: saved.workspaceDir });
      }

      const { files } = await fetchTree();
      dispatch({ type: 'SET_FILES', payload: files });

      if (saved && Object.keys(saved).length > 0) {
        dispatch({ type: 'RESTORE_STATE', payload: saved });

        if (saved.openTabs && saved.openTabs.length > 0) {
          for (const tabInfo of saved.openTabs) {
            if (!tabInfo.isBinary && tabInfo.serverPath) {
              const file = findNodeByPath(files, tabInfo.serverPath);
              if (file && file.type === 'file') {
                try {
                  const content = await fetchFileContent(file.serverPath!);
                  dispatch({ type: 'SET_FILE_CONTENT', payload: { fileId: file.id, content } });
                } catch {}
              }
            }
          }
        }
      }
    } catch {}
  }, []);

  const openFolderFromServer = useCallback(async (dirPath: string) => {
    try {
      const { files } = await openFolderOnServer(dirPath);
      dispatch({ type: 'SET_FILES', payload: files });
      dispatch({ type: 'SET_WORKSPACE_DIR', payload: dirPath });
    } catch {}
  }, []);

  React.useEffect(() => {
    loadFromServer();
  }, [loadFromServer]);

  React.useEffect(() => {
    const applyScheme = () => {
      let scheme = state.settings.colorScheme;
      if (scheme === 'system') {
        scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-color-scheme', scheme);
    };
    applyScheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (state.settings.colorScheme === 'system') applyScheme(); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [state.settings.colorScheme, state.settings.theme]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    document.documentElement.setAttribute('data-animations', state.settings.animations ? '1' : '0');
    document.documentElement.setAttribute('data-file-icons', state.settings.showFileIcons ? '1' : '0');
    document.documentElement.setAttribute('data-compact', state.settings.compactMode ? '1' : '0');
  }, [state.settings.theme, state.settings.animations, state.settings.showFileIcons, state.settings.compactMode]);

  const stateRef = useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    const interval = setInterval(() => {
      const saveable = getSaveableState(stateRef.current);
      saveStateToServer(saveable).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const handleBeforeUnload = () => {
      const saveable = getSaveableState(stateRef.current);
      fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveable),
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  React.useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      try {
        ws = new WebSocket(getFsWsUrl());
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'add') {
              dispatch({ type: 'FS_ADD_NODE', payload: { serverPath: msg.path, name: msg.name, type: 'file' } });
            } else if (msg.type === 'addDir') {
              dispatch({ type: 'FS_ADD_NODE', payload: { serverPath: msg.path, name: msg.name, type: 'folder' } });
            } else if (msg.type === 'unlink') {
              dispatch({ type: 'FS_REMOVE_NODE', payload: { serverPath: msg.path } });
            } else if (msg.type === 'unlinkDir') {
              dispatch({ type: 'FS_REMOVE_NODE', payload: { serverPath: msg.path } });
            } else if (msg.type === 'change') {
              const file = findNodeByPath(stateRef.current.files, msg.path);
              if (file && file.type === 'file') {
                const tab = stateRef.current.openTabs.find(t => {
                  const f = findNodeById(stateRef.current.files, t.fileId);
                  return f?.serverPath === msg.path;
                });
                if (tab && !file.dirty) {
                  fetchFileContent(msg.path).then(content => {
                    dispatch({ type: 'SET_FILE_CONTENT', payload: { fileId: tab.fileId, content } });
                  }).catch(() => {});
                } else if (tab && file.dirty) {
                  // external change while we have unsaved edits — just show a toast
                  const id = uuid();
                  dispatch({ type: 'ADD_TOAST', payload: { id, message: `File modified externally: ${msg.name}`, type: 'info' } });
                  setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: { id } }), 5000);
                }
              }
            }
          } catch {}
        };
        ws.onclose = () => {
          ws = null;
          reconnectTimer = setTimeout(connect, 2000);
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch {}
    };
    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey) {
        const preventKeys = ['KeyS', 'KeyW', 'KeyN', 'KeyF', 'KeyG', 'KeyH', 'KeyB', 'KeyI', 'Comma', 'Equal', 'Minus', 'Slash'];
        if (preventKeys.includes(e.code)) {
          e.preventDefault();
        }
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyZ') {
          e.preventDefault();
        }
      }
      if (e.altKey && !e.ctrlKey) {
        const altPrevent = ['KeyZ', 'KeyN', 'KeyW'];
        if (altPrevent.includes(e.code)) {
          e.preventDefault();
        }
      }
      const kbs = stateRef.current.settings.keybindings;
      for (const kb of kbs) {
        if (!matchKeyCombo(e, kb.keys)) continue;
        const monacoAction = ['find', 'replace', 'goToLine'].includes(kb.id);
        if (monacoAction) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        const s = stateRef.current;

        switch (kb.id) {
          case 'commandPalette': window.dispatchEvent(new CustomEvent('blinkcode:toggleCommandPalette')); break;
          case 'toggleSidebar': dispatch({ type: 'TOGGLE_SIDEBAR' }); break;
          case 'toggleTerminal': dispatch({ type: 'TOGGLE_TERMINAL' }); break;
          case 'toggleAI': dispatch({ type: 'TOGGLE_AI_PANEL' }); break;
          case 'toggleSettings': dispatch({ type: 'TOGGLE_SETTINGS' }); break;
          case 'toggleWordWrap': dispatch({ type: 'UPDATE_SETTINGS', payload: { wordWrap: !s.settings.wordWrap } }); break;
          case 'zoomIn': dispatch({ type: 'UPDATE_SETTINGS', payload: { fontSize: Math.min(30, s.settings.fontSize + 1) } }); break;
          case 'zoomOut': dispatch({ type: 'UPDATE_SETTINGS', payload: { fontSize: Math.max(8, s.settings.fontSize - 1) } }); break;
          case 'closeTab': { if (s.activeTabId) dispatch({ type: 'CLOSE_TAB', payload: { tabId: s.activeTabId } }); break; }
          case 'newFile': {
            dispatch({ type: 'SHOW_NEW_FILE', payload: { type: 'file' } });
            if (!s.sidebarVisible) dispatch({ type: 'TOGGLE_SIDEBAR' });
            break;
          }
          case 'save': {
            const tab = s.openTabs.find(t => t.id === s.activeTabId);
            if (tab) {
              const file = findNodeById(s.files, tab.fileId);
              if (file?.serverPath && file.content !== undefined && isSupportedWebFile(file.name)) {
                let content = file.content;
                if (s.settings.trimTrailingWhitespace) {
                  content = content.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
                }
                saveFile(file.serverPath, content).then(() => {
                  if (s.settings.trimTrailingWhitespace && content !== file.content) {
                    dispatch({ type: 'SET_FILE_CONTENT', payload: { fileId: file.id, content } });
                  }
                  dispatch({ type: 'MARK_FILE_SAVED', payload: { fileId: file.id } });
                }).catch(() => {});
              }
            }
            break;
          }
          case 'undo': editorRef.current?.focus(); editorRef.current?.trigger('keyboard', 'undo'); break;
          case 'redo': editorRef.current?.focus(); editorRef.current?.trigger('keyboard', 'redo'); break;
          default: break;
        }
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <EditorContext.Provider value={{
      state, dispatch, openFile, closeTab, setActiveTab, updateFileContent,
      toggleFolder, addFile, deleteNode, renameNode, moveNode,
      setViewMode, openBrowserPreview, closeBrowserPreview, setBrowserUrl,
      setBrowserLoading, setBrowserNavState, setBrowserError,
      toggleAIPanel, setSidebarWidth, addToast, removeToast,
      toggleSidebar, getActiveFile, reorderTabs, toggleTerminal, setTerminalHeight,
      addTerminalInstance, removeTerminalInstance, setActiveTerminal,
      addTerminalLine, updateTerminalCwd, clearTerminal, collapseAll,
      loadFromServer, openFolderFromServer,
      toggleSettings, updateSettings, registerEditor, triggerEditorAction,
    }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be within EditorProvider');
  return ctx;
}

import { useCallback, useRef, useEffect, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditor } from '../../store/EditorContext';
import { isImageFile, getRawFileUrl, fetchGitStatus, fetchGitInlineDiff, fetchGitBlameLine, type GitFileEntry, type GitBlameLineInfo } from '../../utils/api';
import { FileWarning, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useT } from '../../hooks/useT';
import { getDetailedFileSupportInfo, getFileSupportInfo, getMonacoLanguage } from '../../utils/supportedWebFiles';
import BlinkLogo from '../common/BlinkLogo';
import DotGrid from '../common/DotGrid';
import DiffPreview from './DiffPreview';
import { attachLspToEditor } from '../../lsp/session';
import './CodeEditor.css';

function getMonacoTheme(theme: string, colorScheme: string): string {
  const isLight = colorScheme === 'light' || (colorScheme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
  return isLight ? `blinkcode-${theme}-light` : `blinkcode-${theme}`;
}

const BRACKET_COLORS_DARK = {
  'editorBracketHighlight.foreground1': '#4f8cff',
  'editorBracketHighlight.foreground2': '#ffd700',
  'editorBracketHighlight.foreground3': '#ff6b6b',
  'editorBracketHighlight.foreground4': '#c792ea',
  'editorBracketHighlight.foreground5': '#c3e88d',
  'editorBracketHighlight.foreground6': '#89ddff',
  'editorBracketGuide.background1': '#4f8cff25',
  'editorBracketGuide.background2': '#ffd70025',
  'editorBracketGuide.background3': '#ff6b6b25',
  'editorBracketGuide.activeBackground1': '#4f8cff50',
  'editorBracketGuide.activeBackground2': '#ffd70050',
  'editorBracketGuide.activeBackground3': '#ff6b6b50',
};

const BRACKET_COLORS_LIGHT = {
  'editorBracketHighlight.foreground1': '#1a5cff',
  'editorBracketHighlight.foreground2': '#b8860b',
  'editorBracketHighlight.foreground3': '#cc0000',
  'editorBracketHighlight.foreground4': '#7c4dff',
  'editorBracketHighlight.foreground5': '#008800',
  'editorBracketHighlight.foreground6': '#0184bc',
  'editorBracketGuide.background1': '#1a5cff20',
  'editorBracketGuide.background2': '#b8860b20',
  'editorBracketGuide.background3': '#cc000020',
  'editorBracketGuide.activeBackground1': '#1a5cff40',
  'editorBracketGuide.activeBackground2': '#b8860b40',
  'editorBracketGuide.activeBackground3': '#cc000040',
};

function defineBlinkTheme(monaco: any, name: string, theme: { base: string; inherit: boolean; rules: any[]; colors: Record<string, string> }) {
  monaco.editor.defineTheme(name, {
    ...theme,
    colors: {
      ...theme.colors,
      ...(theme.base === 'vs-dark' ? BRACKET_COLORS_DARK : BRACKET_COLORS_LIGHT),
    },
  });
}

function formatRelativeTime(unixSeconds: number): string {
  if (!unixSeconds) return 'just now';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return 'just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h}h ago`;
  }
  if (diff < 2592000) {
    const d = Math.floor(diff / 86400);
    return `${d}d ago`;
  }
  const dt = new Date(unixSeconds * 1000);
  return dt.toLocaleDateString();
}

export default function CodeEditor({ group = 'primary' }: { group?: 'primary' | 'secondary' }) {
  const { state, updateFileContent, getActiveFile, getSplitActiveFile, registerEditor, dispatch } = useEditor();
  const getFileForGroup = group === 'primary' ? getActiveFile : getSplitActiveFile;
  const tt = useT();
  const activeFile = getFileForGroup();
  const supportInfo = activeFile
    ? getFileSupportInfo(activeFile.name)
    : { supported: true };
  const detailedSupport = activeFile
    ? getDetailedFileSupportInfo(activeFile.name, { binary: activeFile.binary, size: activeFile.size })
    : null;
  const isSettingsJson = Boolean(activeFile?.serverPath?.startsWith('__settings__/'));
  const isUnsupportedTextFile = Boolean(activeFile && !activeFile.binary && !supportInfo.supported && !isSettingsJson);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showOnboardingDismiss, setShowOnboardingDismiss] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const gitDecorationsRef = useRef<string[]>([]);
  const gitStatusCacheRef = useRef<GitFileEntry[] | null>(null);
  const gitInlineCacheRef = useRef<Map<string, { hunks: Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number; type: 'added' | 'deleted' | 'modified' }>; ts: number }>>(new Map());
  const gitBlameCacheRef = useRef<Map<string, GitBlameLineInfo | null>>(new Map());
  const blameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [blameInfo, setBlameInfo] = useState<GitBlameLineInfo | null>(null);
  const settingsRef = useRef(state.settings);
  settingsRef.current = state.settings;
  const [imgError, setImgError] = useState(false);
  const [zoomIdx, setZoomIdx] = useState(5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const previewRef = useRef<HTMLDivElement>(null);
  const prevZoomRef = useRef(1);

  const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 8, 10];
  const blameRelativeTime = blameInfo ? formatRelativeTime(blameInfo.authorTime) : '';
  const blameTitle = blameInfo
    ? `${blameInfo.author}\n${blameInfo.summary}\n${blameInfo.commit}\n${new Date((blameInfo.authorTime || 0) * 1000).toLocaleString()}`
    : '';

  useEffect(() => { setImgError(false); setZoomIdx(4); setPan({ x: 0, y: 0 }); prevZoomRef.current = 1; }, [activeFile?.id]);

  useEffect(() => {
    if (!activeFile) {
      try {
        const raw = localStorage.getItem('blinkcode-onboarding-dismissed');
        setShowOnboarding(raw !== 'true');
      } catch {
        setShowOnboarding(true);
      }
    } else {
      setShowOnboarding(false);
    }
  }, [activeFile?.id]);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('blinkcode-onboarding-dismissed', 'true');
      } catch {}
    }

    dispatch({
      type: 'RESTORE_STATE',
      payload: { onboardingDismissed: dontShowAgain },
    });
    setShowOnboardingDismiss(false);
    setShowOnboarding(false);
  };

  const handleRequestDismissOnboarding = () => {
    setShowOnboardingDismiss(true);
  };

  const adjustPanForZoom = (oldZoom: number, newZoom: number) => {
    const el = previewRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setPan(p => ({
      x: cx - (cx - p.x) * (newZoom / oldZoom),
      y: cy - (cy - p.y) * (newZoom / oldZoom),
    }));
  };

  const changeZoom = (dir: 1 | -1) => {
    const oldZoom = ZOOM_LEVELS[zoomIdx];
    const nextIdx = dir > 0 ? Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1) : Math.max(0, zoomIdx - 1);
    const newZoom = ZOOM_LEVELS[nextIdx];
    setZoomIdx(nextIdx);
    adjustPanForZoom(oldZoom, newZoom);
  };

  const resetView = () => {
    setZoomIdx(4);
    setPan({ x: 0, y: 0 });
    prevZoomRef.current = 1;
  };

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        changeZoom(e.deltaY > 0 ? -1 : 1);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomIdx, pan]);

  const handleChange = useCallback((value: string | undefined) => {
    if (!activeFile || value === undefined || isUnsupportedTextFile) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => updateFileContent(activeFile.id, value), 300);
  }, [activeFile, isUnsupportedTextFile, updateFileContent]);

  useEffect(() => () => { if (saveRef.current) clearTimeout(saveRef.current); }, []);

  useEffect(() => {
    setBlameInfo(null);
    if (blameTimerRef.current) {
      clearTimeout(blameTimerRef.current);
      blameTimerRef.current = null;
    }
  }, [activeFile?.id]);

  useEffect(() => {
    if (!state.settings.gitInlineBlame) {
      setBlameInfo(null);
      return;
    }
    const isNormalFile = Boolean(activeFile?.serverPath && !activeFile.serverPath.startsWith('__'));
    if (!isNormalFile) {
      setBlameInfo(null);
      return;
    }

    const onCursor = (ev: Event) => {
      const line = Number((ev as CustomEvent)?.detail?.line || 0);
      if (!line || !activeFile?.serverPath) return;

      const key = `${activeFile.serverPath}:${line}`;
      if (gitBlameCacheRef.current.has(key)) {
        setBlameInfo(gitBlameCacheRef.current.get(key) || null);
        return;
      }

      if (blameTimerRef.current) clearTimeout(blameTimerRef.current);
      blameTimerRef.current = setTimeout(async () => {
        try {
          const data = await fetchGitBlameLine(activeFile.serverPath!, line);
          gitBlameCacheRef.current.set(key, data.blame || null);
          setBlameInfo(data.blame || null);
        } catch {
          setBlameInfo(null);
        }
      }, 220);
    };

    window.addEventListener('blinkcode:cursorPosition', onCursor as EventListener);
    return () => {
      window.removeEventListener('blinkcode:cursorPosition', onCursor as EventListener);
      if (blameTimerRef.current) {
        clearTimeout(blameTimerRef.current);
        blameTimerRef.current = null;
      }
    };
  }, [activeFile?.id, activeFile?.serverPath, state.settings.gitInlineBlame]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel?.();
      if (model && activeFile?.name) {
        monacoRef.current.editor.setModelLanguage(model, getMonacoLanguage(activeFile.name));
      }
      const s = state.settings;
      editorRef.current.updateOptions({
        fontSize: s.fontSize,
        tabSize: s.tabSize,
        wordWrap: s.wordWrap ? 'on' : 'off',
        minimap: { enabled: s.minimap },
        fontLigatures: s.fontLigatures,
        lineNumbers: s.lineNumbers ? 'on' : 'off',
        cursorBlinking: s.cursorBlinking,
        fontFamily: `'${s.fontFamily}', 'JetBrains Mono', Consolas, monospace`,
        cursorStyle: s.cursorStyle,
        renderWhitespace: s.renderWhitespace,
        bracketPairColorization: { enabled: s.bracketPairColorization },
        autoClosingBrackets: s.autoClosingBrackets ? 'always' : 'never',
        smoothScrolling: s.smoothScrolling,
        cursorSmoothCaretAnimation: s.smoothScrolling ? 'on' : 'off',
        insertSpaces: s.insertSpaces,
      });
      const themeName = getMonacoTheme(s.theme, s.colorScheme);
      monacoRef.current.editor.setTheme(themeName);
    }
  }, [state.settings, activeFile?.id]);

  useEffect(() => {
    let cancelled = false;

    const clearDecorations = () => {
      const editor = editorRef.current;
      if (!editor) return;
      gitDecorationsRef.current = editor.deltaDecorations(gitDecorationsRef.current, []);
    };

    const applyGitDecorations = async () => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) return;
      if (!activeFile?.serverPath || activeFile.serverPath.startsWith('__')) {
        clearDecorations();
        return;
      }

      const applyFromHunks = (hunks: Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number; type: 'added' | 'deleted' | 'modified' }>) => {
        const decorations: any[] = [];
        for (const h of hunks || []) {
          const className = h.type === 'added'
            ? 'git-inline-added'
            : h.type === 'deleted'
              ? 'git-inline-deleted'
              : 'git-inline-modified';

          const linesClassName = h.type === 'added'
            ? 'git-inline-gutter-added'
            : h.type === 'deleted'
              ? 'git-inline-gutter-deleted'
              : 'git-inline-gutter-modified';

          const start = Math.max(1, h.newStart || 1);
          const len = Math.max(1, h.newLines || 1);
          const end = start + len - 1;

          decorations.push({
            range: new monaco.Range(start, 1, end, 1),
            options: {
              isWholeLine: true,
              className,
              linesDecorationsClassName: linesClassName,
            },
          });
        }
        gitDecorationsRef.current = editor.deltaDecorations(gitDecorationsRef.current, decorations);
      };

      const cacheKey = activeFile.serverPath;
      const cached = gitInlineCacheRef.current.get(cacheKey);
      if (cached) {
        applyFromHunks(cached.hunks);
      }

      try {
        const status = await fetchGitStatus();
        if (cancelled) return;
        if (!status?.isRepo) {
          clearDecorations();
          return;
        }

        gitStatusCacheRef.current = [...status.unstaged, ...status.staged, ...status.untracked];

        const find = (items: GitFileEntry[]) => items.find(i => i.path === activeFile.serverPath) || null;
        const unstaged = find(status.unstaged);
        const staged = find(status.staged);
        const untracked = find(status.untracked);
        const target = unstaged || staged || untracked;

        if (!target && gitStatusCacheRef.current) {
          const cachedTarget = gitStatusCacheRef.current.find(i => i.path === activeFile.serverPath) || null;
          if (cachedTarget?.status === 'untracked') {
            const lineCount = Math.max(1, (activeFile.content || '').split('\n').length);
            const localHunks = [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: lineCount, type: 'added' as const }];
            applyFromHunks(localHunks);
            gitInlineCacheRef.current.set(cacheKey, { hunks: localHunks, ts: Date.now() });
            return;
          }
        }

        if (!target) {
          clearDecorations();
          return;
        }

        if (target.status === 'untracked') {
          const lineCount = Math.max(1, (activeFile.content || '').split('\n').length);
          const localHunks = [{ oldStart: 1, oldLines: 0, newStart: 1, newLines: lineCount, type: 'added' as const }];
          applyFromHunks(localHunks);
          gitInlineCacheRef.current.set(cacheKey, { hunks: localHunks, ts: Date.now() });
          return;
        }

        const diff = await fetchGitInlineDiff(activeFile.serverPath, Boolean(staged && !unstaged), target.status);
        if (cancelled) return;
        applyFromHunks(diff.hunks || []);
        gitInlineCacheRef.current.set(cacheKey, { hunks: diff.hunks || [], ts: Date.now() });
      } catch {
        clearDecorations();
      }
    };

    applyGitDecorations();
    const timer = setInterval(applyGitDecorations, 1200);

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearDecorations();
    };
  }, [activeFile?.id, activeFile?.serverPath, activeFile?.content]);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    (window as any).monaco = monaco;
    const mountedModel = editor.getModel?.();
    if (mountedModel && activeFile?.name) {
      monaco.editor.setModelLanguage(mountedModel, getMonacoLanguage(activeFile.name));
    }
    if (group === 'primary') registerEditor(editor);

    defineBlinkTheme(monaco, 'blinkcode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '546e7a', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c792ea' },
        { token: 'string', foreground: 'c3e88d' },
        { token: 'number', foreground: 'f78c6c' },
        { token: 'type', foreground: 'ffcb6b' },
        { token: 'function', foreground: '82aaff' },
        { token: 'variable', foreground: 'eeffff' },
        { token: 'operator', foreground: '89ddff' },
        { token: 'delimiter', foreground: '89ddff' },
        { token: 'tag', foreground: 'f07178' },
        { token: 'attribute.name', foreground: 'c792ea' },
        { token: 'attribute.value', foreground: 'c3e88d' },
      ],
      colors: {
        'editor.background': '#0e1017',
        'editor.foreground': '#eeffff',
        'editor.lineHighlightBackground': '#141620',
        'editor.selectionBackground': '#4f8cff28',
        'editorCursor.foreground': '#4f8cff',
        'editorLineNumber.foreground': '#2a2e3a',
        'editorLineNumber.activeForeground': '#4a5060',
        'editor.inactiveSelectionBackground': '#4f8cff12',
        'editorIndentGuide.background': '#1a1e28',
        'editorIndentGuide.activeBackground': '#282d38',
        'editorBracketMatch.background': '#4f8cff18',
        'editorBracketMatch.border': '#4f8cff33',
        'editorGutter.background': '#0e1017',
        'scrollbar.shadow': '#0000',
        'scrollbarSlider.background': '#ffffff08',
        'scrollbarSlider.hoverBackground': '#ffffff14',
        'scrollbarSlider.activeBackground': '#ffffff20',
        'editorWidget.background': '#181b24',
        'editorSuggestWidget.background': '#181b24',
        'editorSuggestWidget.border': '#ffffff08',
        'editorSuggestWidget.selectedBackground': '#4f8cff18',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'd73a49' },
        { token: 'string', foreground: '032f62' },
        { token: 'number', foreground: '005cc5' },
        { token: 'type', foreground: 'e36209' },
        { token: 'function', foreground: '6f42c1' },
        { token: 'variable', foreground: '24292e' },
        { token: 'operator', foreground: 'd73a49' },
        { token: 'delimiter', foreground: '24292e' },
        { token: 'tag', foreground: '22863a' },
        { token: 'attribute.name', foreground: '6f42c1' },
        { token: 'attribute.value', foreground: '032f62' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#24292e',
        'editor.lineHighlightBackground': '#f6f8fa',
        'editor.selectionBackground': '#4f8cff28',
        'editorCursor.foreground': '#3b82f6',
        'editorLineNumber.foreground': '#babbbd',
        'editorLineNumber.activeForeground': '#24292e',
        'editor.inactiveSelectionBackground': '#4f8cff12',
        'editorIndentGuide.background': '#eff2f5',
        'editorIndentGuide.activeBackground': '#d1d5da',
        'editorBracketMatch.background': '#4f8cff18',
        'editorBracketMatch.border': '#4f8cff33',
        'editorGutter.background': '#ffffff',
        'scrollbar.shadow': '#0000',
        'scrollbarSlider.background': '#00000012',
        'scrollbarSlider.hoverBackground': '#00000020',
        'scrollbarSlider.activeBackground': '#00000030',
        'editorWidget.background': '#f6f8fa',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#e1e4e8',
        'editorSuggestWidget.selectedBackground': '#4f8cff18',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-tokyonight', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '565f89', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'bb9af7' },
        { token: 'string', foreground: '9ece6a' },
        { token: 'number', foreground: 'ff9e64' },
        { token: 'type', foreground: '2ac3de' },
        { token: 'function', foreground: '7aa2f7' },
        { token: 'variable', foreground: 'c0caf5' },
        { token: 'operator', foreground: '89ddff' },
        { token: 'delimiter', foreground: '89ddff' },
        { token: 'tag', foreground: 'f7768e' },
        { token: 'attribute.name', foreground: 'bb9af7' },
        { token: 'attribute.value', foreground: '9ece6a' },
      ],
      colors: {
        'editor.background': '#1a1b26',
        'editor.foreground': '#c0caf5',
        'editor.lineHighlightBackground': '#1e2030',
        'editorCursor.foreground': '#7aa2f7',
        'editorLineNumber.foreground': '#3b4261',
        'editorLineNumber.activeForeground': '#737aa2',
        'editor.selectionBackground': '#283454',
        'editorIndentGuide.background': '#1e2030',
        'editorIndentGuide.activeBackground': '#2d3549',
        'editorWidget.background': '#24283b',
        'editorSuggestWidget.background': '#24283b',
        'editorSuggestWidget.border': '#3b4261',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-tokyonight-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '68709a', fontStyle: 'italic' },
        { token: 'keyword', foreground: '9854f1' },
        { token: 'string', foreground: '587539' },
        { token: 'number', foreground: 'e0584e' },
        { token: 'type', foreground: '2e7de9' },
        { token: 'function', foreground: '2e7de9' },
        { token: 'variable', foreground: '3760bf' },
        { token: 'operator', foreground: '587539' },
        { token: 'delimiter', foreground: '587539' },
        { token: 'tag', foreground: 'f52a65' },
        { token: 'attribute.name', foreground: '9854f1' },
        { token: 'attribute.value', foreground: '587539' },
      ],
      colors: {
        'editor.background': '#e1e2e7',
        'editor.foreground': '#3760bf',
        'editor.lineHighlightBackground': '#e9e9ed',
        'editorCursor.foreground': '#2e7de9',
        'editorLineNumber.foreground': '#a8aecb',
        'editorLineNumber.activeForeground': '#68709a',
        'editor.selectionBackground': '#b6c8f5',
        'editorIndentGuide.background': '#c4c8d4',
        'editorIndentGuide.activeBackground': '#b4bcbd',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#a8aecb',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-everforest', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '859289', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'd699b6' },
        { token: 'string', foreground: 'a7c080' },
        { token: 'number', foreground: 'e67e80' },
        { token: 'type', foreground: 'dbbc7f' },
        { token: 'function', foreground: 'a7c080' },
        { token: 'variable', foreground: 'd3c6aa' },
        { token: 'operator', foreground: 'e69875' },
        { token: 'delimiter', foreground: 'e69875' },
        { token: 'tag', foreground: 'e67e80' },
        { token: 'attribute.name', foreground: 'd699b6' },
        { token: 'attribute.value', foreground: 'a7c080' },
      ],
      colors: {
        'editor.background': '#2b3339',
        'editor.foreground': '#d3c6aa',
        'editor.lineHighlightBackground': '#374145',
        'editorCursor.foreground': '#a7c080',
        'editorLineNumber.foreground': '#5c6a64',
        'editorLineNumber.activeForeground': '#859289',
        'editor.selectionBackground': '#425047',
        'editorIndentGuide.background': '#374145',
        'editorIndentGuide.activeBackground': '#475050',
        'editorWidget.background': '#374145',
        'editorSuggestWidget.background': '#374145',
        'editorSuggestWidget.border': '#475050',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-everforest-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8d9ba5', fontStyle: 'italic' },
        { token: 'keyword', foreground: '9c6cc2' },
        { token: 'string', foreground: '93b259' },
        { token: 'number', foreground: 'c34043' },
        { token: 'type', foreground: 'b0863e' },
        { token: 'function', foreground: '93b259' },
        { token: 'variable', foreground: '5c6a72' },
        { token: 'operator', foreground: 'c34043' },
        { token: 'delimiter', foreground: 'c34043' },
        { token: 'tag', foreground: 'c34043' },
        { token: 'attribute.name', foreground: '9c6cc2' },
        { token: 'attribute.value', foreground: '93b259' },
      ],
      colors: {
        'editor.background': '#f3ead3',
        'editor.foreground': '#5c6a72',
        'editor.lineHighlightBackground': '#eae0c8',
        'editorCursor.foreground': '#93b259',
        'editorLineNumber.foreground': '#adb5b9',
        'editorLineNumber.activeForeground': '#8d9ba5',
        'editor.selectionBackground': '#d4d9c8',
        'editorIndentGuide.background': '#eae0c8',
        'editorIndentGuide.activeBackground': '#ddd8c0',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#adb5b9',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-ayu', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '626a73', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff8f40' },
        { token: 'string', foreground: 'aad94c' },
        { token: 'number', foreground: 'e6b450' },
        { token: 'type', foreground: '59c2ff' },
        { token: 'function', foreground: 'ffb454' },
        { token: 'variable', foreground: 'e6e1cf' },
        { token: 'operator', foreground: 'f29668' },
        { token: 'delimiter', foreground: 'f29668' },
        { token: 'tag', foreground: '39bae6' },
        { token: 'attribute.name', foreground: 'ff8f40' },
        { token: 'attribute.value', foreground: 'aad94c' },
      ],
      colors: {
        'editor.background': '#0a0e14',
        'editor.foreground': '#e6e1cf',
        'editor.lineHighlightBackground': '#0f1419',
        'editorCursor.foreground': '#39bae6',
        'editorLineNumber.foreground': '#343f4b',
        'editorLineNumber.activeForeground': '#475866',
        'editor.selectionBackground': '#1a3a4a',
        'editorIndentGuide.background': '#0f1419',
        'editorIndentGuide.activeBackground': '#182028',
        'editorWidget.background': '#1a1f29',
        'editorSuggestWidget.background': '#1a1f29',
        'editorSuggestWidget.border': '#343f4b',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-ayu-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8994a6', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff6906' },
        { token: 'string', foreground: '6c9a4e' },
        { token: 'number', foreground: 'e6892e' },
        { token: 'type', foreground: '41a6c2' },
        { token: 'function', foreground: '55b5db' },
        { token: 'variable', foreground: '5c6773' },
        { token: 'operator', foreground: 'f29668' },
        { token: 'delimiter', foreground: 'f29668' },
        { token: 'tag', foreground: '41a6c2' },
        { token: 'attribute.name', foreground: 'ff6906' },
        { token: 'attribute.value', foreground: '6c9a4e' },
      ],
      colors: {
        'editor.background': '#fafafa',
        'editor.foreground': '#5c6773',
        'editor.lineHighlightBackground': '#f0f0f0',
        'editorCursor.foreground': '#41a6c2',
        'editorLineNumber.foreground': '#b0b8c4',
        'editorLineNumber.activeForeground': '#8994a6',
        'editor.selectionBackground': '#e0e8ec',
        'editorIndentGuide.background': '#f0f0f0',
        'editorIndentGuide.activeBackground': '#e6e6e6',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#b0b8c4',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-catppuccin', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'cba6f7' },
        { token: 'string', foreground: 'a6e3a1' },
        { token: 'number', foreground: 'fab387' },
        { token: 'type', foreground: 'f9e2af' },
        { token: 'function', foreground: '89b4fa' },
        { token: 'variable', foreground: 'cdd6f4' },
        { token: 'operator', foreground: '89dceb' },
        { token: 'delimiter', foreground: '89dceb' },
        { token: 'tag', foreground: 'f38ba8' },
        { token: 'attribute.name', foreground: 'cba6f7' },
        { token: 'attribute.value', foreground: 'a6e3a1' },
      ],
      colors: {
        'editor.background': '#1e1e2e',
        'editor.foreground': '#cdd6f4',
        'editor.lineHighlightBackground': '#2a2a3c',
        'editorCursor.foreground': '#89b4fa',
        'editorLineNumber.foreground': '#45475a',
        'editorLineNumber.activeForeground': '#585b70',
        'editor.selectionBackground': '#313244',
        'editorIndentGuide.background': '#2a2a3c',
        'editorIndentGuide.activeBackground': '#363648',
        'editorWidget.background': '#313244',
        'editorSuggestWidget.background': '#313244',
        'editorSuggestWidget.border': '#45475a',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-catppuccin-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '7c7f93', fontStyle: 'italic' },
        { token: 'keyword', foreground: '8839ef' },
        { token: 'string', foreground: '40a02b' },
        { token: 'number', foreground: 'fe640b' },
        { token: 'type', foreground: 'df8e1d' },
        { token: 'function', foreground: '1e66f5' },
        { token: 'variable', foreground: '4c4f69' },
        { token: 'operator', foreground: '179299' },
        { token: 'delimiter', foreground: '179299' },
        { token: 'tag', foreground: 'd20f39' },
        { token: 'attribute.name', foreground: '8839ef' },
        { token: 'attribute.value', foreground: '40a02b' },
      ],
      colors: {
        'editor.background': '#eff1f5',
        'editor.foreground': '#4c4f69',
        'editor.lineHighlightBackground': '#e6e9ef',
        'editorCursor.foreground': '#1e66f5',
        'editorLineNumber.foreground': '#9ca0b0',
        'editorLineNumber.activeForeground': '#7c7f93',
        'editor.selectionBackground': '#ccd0da',
        'editorIndentGuide.background': '#e6e9ef',
        'editorIndentGuide.activeBackground': '#d0d3db',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#9ca0b0',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-catppuccin-macchiato', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6e738d', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c6a0f6' },
        { token: 'string', foreground: 'a6da95' },
        { token: 'number', foreground: 'f4a8b8' },
        { token: 'type', foreground: 'eed49f' },
        { token: 'function', foreground: '8aadf4' },
        { token: 'variable', foreground: 'cad3f8' },
        { token: 'operator', foreground: '8bd5ca' },
        { token: 'delimiter', foreground: '8bd5ca' },
        { token: 'tag', foreground: 'ed8796' },
        { token: 'attribute.name', foreground: 'c6a0f6' },
        { token: 'attribute.value', foreground: 'a6da95' },
      ],
      colors: {
        'editor.background': '#24273a',
        'editor.foreground': '#cad3f8',
        'editor.lineHighlightBackground': '#303347',
        'editorCursor.foreground': '#8aadf4',
        'editorLineNumber.foreground': '#494d64',
        'editorLineNumber.activeForeground': '#5b6078',
        'editor.selectionBackground': '#363a4f',
        'editorIndentGuide.background': '#303347',
        'editorIndentGuide.activeBackground': '#3b3f54',
        'editorWidget.background': '#363a4f',
        'editorSuggestWidget.background': '#363a4f',
        'editorSuggestWidget.border': '#494d64',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-catppuccin-macchiato-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '7c7f93', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7c4dff' },
        { token: 'string', foreground: '40a02b' },
        { token: 'number', foreground: 'fe640b' },
        { token: 'type', foreground: 'df8e1d' },
        { token: 'function', foreground: '2a6ef5' },
        { token: 'variable', foreground: '494d64' },
        { token: 'operator', foreground: '179299' },
        { token: 'delimiter', foreground: '179299' },
        { token: 'tag', foreground: 'd20f39' },
        { token: 'attribute.name', foreground: '7c4dff' },
        { token: 'attribute.value', foreground: '40a02b' },
      ],
      colors: {
        'editor.background': '#f0f1f5',
        'editor.foreground': '#494d64',
        'editor.lineHighlightBackground': '#e8e9ed',
        'editorCursor.foreground': '#2a6ef5',
        'editorLineNumber.foreground': '#9ca0b0',
        'editorLineNumber.activeForeground': '#7c7f93',
        'editor.selectionBackground': '#ced4da',
        'editorIndentGuide.background': '#e8e9ed',
        'editorIndentGuide.activeBackground': '#d0d3db',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#9ca0b0',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-gruvbox', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '665c54', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'fb4934' },
        { token: 'string', foreground: 'b8bb26' },
        { token: 'number', foreground: 'fe8019' },
        { token: 'type', foreground: 'fabd2f' },
        { token: 'function', foreground: 'fabd2f' },
        { token: 'variable', foreground: 'ebdbb2' },
        { token: 'operator', foreground: 'fe8019' },
        { token: 'delimiter', foreground: 'fe8019' },
        { token: 'tag', foreground: 'fb4934' },
        { token: 'attribute.name', foreground: 'fb4934' },
        { token: 'attribute.value', foreground: 'b8bb26' },
      ],
      colors: {
        'editor.background': '#282828',
        'editor.foreground': '#ebdbb2',
        'editor.lineHighlightBackground': '#32302f',
        'editorCursor.foreground': '#fe8019',
        'editorLineNumber.foreground': '#504945',
        'editorLineNumber.activeForeground': '#665c54',
        'editor.selectionBackground': '#3c3836',
        'editorIndentGuide.background': '#32302f',
        'editorIndentGuide.activeBackground': '#3c3836',
        'editorWidget.background': '#3c3836',
        'editorSuggestWidget.background': '#3c3836',
        'editorSuggestWidget.border': '#504945',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-gruvbox-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '928374', fontStyle: 'italic' },
        { token: 'keyword', foreground: '8f3f71' },
        { token: 'string', foreground: '79740e' },
        { token: 'number', foreground: 'af3a03' },
        { token: 'type', foreground: 'b57614' },
        { token: 'function', foreground: 'af3a03' },
        { token: 'variable', foreground: '3c3836' },
        { token: 'operator', foreground: 'af3a03' },
        { token: 'delimiter', foreground: 'af3a03' },
        { token: 'tag', foreground: '9d0006' },
        { token: 'attribute.name', foreground: '8f3f71' },
        { token: 'attribute.value', foreground: '79740e' },
      ],
      colors: {
        'editor.background': '#fbf1c7',
        'editor.foreground': '#3c3836',
        'editor.lineHighlightBackground': '#f2e5bc',
        'editorCursor.foreground': '#af3a03',
        'editorLineNumber.foreground': '#928374',
        'editorLineNumber.activeForeground': '#665c54',
        'editor.selectionBackground': '#e8d5a3',
        'editorIndentGuide.background': '#f2e5bc',
        'editorIndentGuide.activeBackground': '#ebd6a0',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#928374',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-kanagawa', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '727169', fontStyle: 'italic' },
        { token: 'keyword', foreground: '957fb8' },
        { token: 'string', foreground: '76946a' },
        { token: 'number', foreground: 'e6c384' },
        { token: 'type', foreground: '7e9cd8' },
        { token: 'function', foreground: '7e9cd8' },
        { token: 'variable', foreground: 'dcd7ba' },
        { token: 'operator', foreground: 'c0a36e' },
        { token: 'delimiter', foreground: 'c0a36e' },
        { token: 'tag', foreground: 'c34043' },
        { token: 'attribute.name', foreground: '957fb8' },
        { token: 'attribute.value', foreground: '76946a' },
      ],
      colors: {
        'editor.background': '#1f1f28',
        'editor.foreground': '#dcd7ba',
        'editor.lineHighlightBackground': '#2a2a37',
        'editorCursor.foreground': '#7e9cd8',
        'editorLineNumber.foreground': '#2a2a37',
        'editorLineNumber.activeForeground': '#54546d',
        'editor.selectionBackground': '#2a2a37',
        'editorIndentGuide.background': '#2a2a37',
        'editorIndentGuide.activeBackground': '#363646',
        'editorWidget.background': '#2a2a37',
        'editorSuggestWidget.background': '#2a2a37',
        'editorSuggestWidget.border': '#363646',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-kanagawa-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '727169', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7e6cd8' },
        { token: 'string', foreground: '6f894e' },
        { token: 'number', foreground: 'b98e3e' },
        { token: 'type', foreground: '7e6cd8' },
        { token: 'function', foreground: '7e6cd8' },
        { token: 'variable', foreground: '43433c' },
        { token: 'operator', foreground: '8a7b62' },
        { token: 'delimiter', foreground: '8a7b62' },
        { token: 'tag', foreground: 'c34043' },
        { token: 'attribute.name', foreground: '7e6cd8' },
        { token: 'attribute.value', foreground: '6f894e' },
      ],
      colors: {
        'editor.background': '#e8e3d5',
        'editor.foreground': '#43433c',
        'editor.lineHighlightBackground': '#ddd8c8',
        'editorCursor.foreground': '#7e6cd8',
        'editorLineNumber.foreground': '#9d9d93',
        'editorLineNumber.activeForeground': '#727169',
        'editor.selectionBackground': '#c8c3b5',
        'editorIndentGuide.background': '#ddd8c8',
        'editorIndentGuide.activeBackground': '#d0ccb8',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#9d9d93',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-nord', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
        { token: 'keyword', foreground: '81a1c1' },
        { token: 'string', foreground: 'a3be8c' },
        { token: 'number', foreground: 'b48ead' },
        { token: 'type', foreground: '8fbcbb' },
        { token: 'function', foreground: '88c0d0' },
        { token: 'variable', foreground: 'd8dee9' },
        { token: 'operator', foreground: '81a1c1' },
        { token: 'delimiter', foreground: '81a1c1' },
        { token: 'tag', foreground: '81a1c1' },
        { token: 'attribute.name', foreground: 'b48ead' },
        { token: 'attribute.value', foreground: 'a3be8c' },
      ],
      colors: {
        'editor.background': '#2e3440',
        'editor.foreground': '#d8dee9',
        'editor.lineHighlightBackground': '#3b4252',
        'editorCursor.foreground': '#88c0d0',
        'editorLineNumber.foreground': '#4c566a',
        'editorLineNumber.activeForeground': '#616e88',
        'editor.selectionBackground': '#3b4252',
        'editorIndentGuide.background': '#3b4252',
        'editorIndentGuide.activeBackground': '#434c5e',
        'editorWidget.background': '#3b4252',
        'editorSuggestWidget.background': '#3b4252',
        'editorSuggestWidget.border': '#4c566a',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-nord-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '81a1c1', fontStyle: 'italic' },
        { token: 'keyword', foreground: '5e81ac' },
        { token: 'string', foreground: 'a3be8c' },
        { token: 'number', foreground: 'b48ead' },
        { token: 'type', foreground: '8fbcbb' },
        { token: 'function', foreground: '5e81ac' },
        { token: 'variable', foreground: '2e3440' },
        { token: 'operator', foreground: '81a1c1' },
        { token: 'delimiter', foreground: '81a1c1' },
        { token: 'tag', foreground: 'bf616a' },
        { token: 'attribute.name', foreground: 'b48ead' },
        { token: 'attribute.value', foreground: 'a3be8c' },
      ],
      colors: {
        'editor.background': '#eceff4',
        'editor.foreground': '#2e3440',
        'editor.lineHighlightBackground': '#e5e9f0',
        'editorCursor.foreground': '#5e81ac',
        'editorLineNumber.foreground': '#b0b8c4',
        'editorLineNumber.activeForeground': '#81a1c1',
        'editor.selectionBackground': '#d8dee9',
        'editorIndentGuide.background': '#e5e9f0',
        'editorIndentGuide.activeBackground': '#d8dee9',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#b0b8c4',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-matrix', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '006619', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00ff41' },
        { token: 'string', foreground: '33ff66' },
        { token: 'number', foreground: '00ff41' },
        { token: 'type', foreground: '00cc33' },
        { token: 'function', foreground: '00ff41' },
        { token: 'variable', foreground: '00ff41' },
        { token: 'operator', foreground: '00ff41' },
        { token: 'delimiter', foreground: '00ff41' },
        { token: 'tag', foreground: '00ff41' },
        { token: 'attribute.name', foreground: '00cc33' },
        { token: 'attribute.value', foreground: '33ff66' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#00ff41',
        'editor.lineHighlightBackground': '#0d0d0d',
        'editorCursor.foreground': '#00ff41',
        'editorLineNumber.foreground': '#00330d',
        'editorLineNumber.activeForeground': '#006619',
        'editor.selectionBackground': '#00330d',
        'editorIndentGuide.background': '#0d0d0d',
        'editorIndentGuide.activeBackground': '#141414',
        'editorWidget.background': '#141414',
        'editorSuggestWidget.background': '#141414',
        'editorSuggestWidget.border': '#00330d',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-matrix-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '3d8a3d', fontStyle: 'italic' },
        { token: 'keyword', foreground: '1a6b1a' },
        { token: 'string', foreground: '2d6b2d' },
        { token: 'number', foreground: '1a8b1a' },
        { token: 'type', foreground: '2d7a2d' },
        { token: 'function', foreground: '1a8b1a' },
        { token: 'variable', foreground: '1a4a1a' },
        { token: 'operator', foreground: '1a8b1a' },
        { token: 'delimiter', foreground: '1a8b1a' },
        { token: 'tag', foreground: '1a6b1a' },
        { token: 'attribute.name', foreground: '2d7a2d' },
        { token: 'attribute.value', foreground: '2d6b2d' },
      ],
      colors: {
        'editor.background': '#e8efe8',
        'editor.foreground': '#1a4a1a',
        'editor.lineHighlightBackground': '#dce5dc',
        'editorCursor.foreground': '#1a8b1a',
        'editorLineNumber.foreground': '#6aad6a',
        'editorLineNumber.activeForeground': '#3d8a3d',
        'editor.selectionBackground': '#b0ddb0',
        'editorIndentGuide.background': '#dce5dc',
        'editorIndentGuide.activeBackground': '#d0d8d0',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#6aad6a',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-one-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c678dd' },
        { token: 'string', foreground: '98c379' },
        { token: 'number', foreground: 'd19a66' },
        { token: 'type', foreground: 'e5c07b' },
        { token: 'function', foreground: '61afef' },
        { token: 'variable', foreground: 'e06c75' },
        { token: 'operator', foreground: '56b6c2' },
        { token: 'delimiter', foreground: '56b6c2' },
        { token: 'tag', foreground: 'e06c75' },
        { token: 'attribute.name', foreground: 'd19a66' },
        { token: 'attribute.value', foreground: '98c379' },
      ],
      colors: {
        'editor.background': '#282c34',
        'editor.foreground': '#abb2bf',
        'editor.lineHighlightBackground': '#2c313c',
        'editorCursor.foreground': '#528bff',
        'editorLineNumber.foreground': '#4b5263',
        'editorLineNumber.activeForeground': '#636d83',
        'editor.selectionBackground': '#3e4451',
        'editorIndentGuide.background': '#2c313c',
        'editorIndentGuide.activeBackground': '#3e4451',
        'editorWidget.background': '#2c313c',
        'editorSuggestWidget.background': '#2c313c',
        'editorSuggestWidget.border': '#4b5263',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-one-dark-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a6b78', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'a626a4' },
        { token: 'string', foreground: '50a14f' },
        { token: 'number', foreground: '986801' },
        { token: 'type', foreground: 'c18401' },
        { token: 'function', foreground: '4078f2' },
        { token: 'variable', foreground: 'e45649' },
        { token: 'operator', foreground: '0184bc' },
        { token: 'delimiter', foreground: '0184bc' },
        { token: 'tag', foreground: 'e45649' },
        { token: 'attribute.name', foreground: '986801' },
        { token: 'attribute.value', foreground: '50a14f' },
      ],
      colors: {
        'editor.background': '#fafafa',
        'editor.foreground': '#383a42',
        'editor.lineHighlightBackground': '#f0f0f0',
        'editorCursor.foreground': '#4078f2',
        'editorLineNumber.foreground': '#9da5b4',
        'editorLineNumber.activeForeground': '#6a6b78',
        'editor.selectionBackground': '#e5e8ec',
        'editorIndentGuide.background': '#f0f0f0',
        'editorIndentGuide.activeBackground': '#e6e6e6',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#9da5b4',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-amoled', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '505050', fontStyle: 'italic' },
        { token: 'keyword', foreground: '4f8cff' },
        { token: 'string', foreground: '44ff44' },
        { token: 'number', foreground: 'ff8844' },
        { token: 'type', foreground: 'ffcc44' },
        { token: 'function', foreground: '4f8cff' },
        { token: 'variable', foreground: 'e0e0e0' },
        { token: 'operator', foreground: '808080' },
        { token: 'delimiter', foreground: '808080' },
        { token: 'tag', foreground: 'ff4444' },
        { token: 'attribute.name', foreground: 'a78bfa' },
        { token: 'attribute.value', foreground: '44ff44' },
      ],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#e0e0e0',
        'editor.lineHighlightBackground': '#050505',
        'editor.selectionBackground': '#4f8cff28',
        'editorCursor.foreground': '#4f8cff',
        'editorLineNumber.foreground': '#303030',
        'editorLineNumber.activeForeground': '#505050',
        'editor.inactiveSelectionBackground': '#4f8cff12',
        'editorIndentGuide.background': '#0a0a0a',
        'editorIndentGuide.activeBackground': '#151515',
        'editorBracketMatch.background': '#4f8cff18',
        'editorBracketMatch.border': '#4f8cff33',
        'editorGutter.background': '#000000',
        'scrollbar.shadow': '#0000',
        'scrollbarSlider.background': '#ffffff06',
        'scrollbarSlider.hoverBackground': '#ffffff0a',
        'scrollbarSlider.activeBackground': '#ffffff14',
        'editorWidget.background': '#0a0a0a',
        'editorSuggestWidget.background': '#0a0a0a',
        'editorSuggestWidget.border': '#ffffff08',
        'editorSuggestWidget.selectedBackground': '#4f8cff18',
      },
    });

    defineBlinkTheme(monaco, 'blinkcode-amoled-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '909090', fontStyle: 'italic' },
        { token: 'keyword', foreground: '1a5cff' },
        { token: 'string', foreground: '008800' },
        { token: 'number', foreground: '906020' },
        { token: 'type', foreground: '7040c0' },
        { token: 'function', foreground: '1a5cff' },
        { token: 'variable', foreground: '1a1a1a' },
        { token: 'operator', foreground: '606060' },
        { token: 'delimiter', foreground: '606060' },
        { token: 'tag', foreground: 'cc0000' },
        { token: 'attribute.name', foreground: '7040c0' },
        { token: 'attribute.value', foreground: '008800' },
      ],
      colors: {
        'editor.background': '#f5f5f5',
        'editor.foreground': '#1a1a1a',
        'editor.lineHighlightBackground': '#eeeeee',
        'editor.selectionBackground': '#1a5cff28',
        'editorCursor.foreground': '#1a5cff',
        'editorLineNumber.foreground': '#b0b0b0',
        'editorLineNumber.activeForeground': '#606060',
        'editor.inactiveSelectionBackground': '#1a5cff12',
        'editorIndentGuide.background': '#e8e8e8',
        'editorIndentGuide.activeBackground': '#d0d0d0',
        'editorBracketMatch.background': '#1a5cff18',
        'editorBracketMatch.border': '#1a5cff33',
        'editorGutter.background': '#f5f5f5',
        'scrollbar.shadow': '#0000',
        'scrollbarSlider.background': '#00000012',
        'scrollbarSlider.hoverBackground': '#00000020',
        'scrollbarSlider.activeBackground': '#00000030',
        'editorWidget.background': '#ffffff',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#d0d0d0',
        'editorSuggestWidget.selectedBackground': '#1a5cff18',
      },
    });

    const s = settingsRef.current;
    const themeName = getMonacoTheme(s.theme, s.colorScheme);
    monaco.editor.setTheme(themeName);

    editor.updateOptions({
      fontFamily: `'${s.fontFamily}', 'JetBrains Mono', Consolas, monospace`,
      fontSize: s.fontSize,
      lineHeight: Math.round(s.fontSize * 1.7),
      tabSize: s.tabSize,
      wordWrap: s.wordWrap ? 'on' : 'off',
      fontLigatures: s.fontLigatures,
      minimap: { enabled: s.minimap },
      lineNumbers: s.lineNumbers ? 'on' : 'off',
      cursorBlinking: s.cursorBlinking,
      cursorStyle: s.cursorStyle,
      renderWhitespace: s.renderWhitespace,
      bracketPairColorization: { enabled: s.bracketPairColorization },
      autoClosingBrackets: s.autoClosingBrackets ? 'always' : 'never',
      smoothScrolling: s.smoothScrolling,
      insertSpaces: s.insertSpaces,
      scrollBeyondLastLine: false,
      cursorSmoothCaretAnimation: s.smoothScrolling ? 'on' : 'off',
      renderLineHighlight: 'all',
      padding: { top: 16 },
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      overviewRulerLanes: 0,
      scrollbar: { verticalScrollbarSize: 5, horizontalScrollbarSize: 5, vertical: 'auto', horizontal: 'auto' },
      wordBasedSuggestions: 'off',
      suggest: { showWords: false },
    });

    editor.onDidChangeCursorPosition((e: any) => {
      window.dispatchEvent(new CustomEvent('blinkcode:cursorPosition', {
        detail: { line: e.position.lineNumber, column: e.position.column },
      }));
    });

    try { attachLspToEditor(monaco, editor, state.workspaceDir || ''); } catch {}
  }, [activeFile?.name, state.workspaceDir]);

  const isSolid = state.settings.backgroundStyle === 'solid';

  const mainShortcuts = [
    { keys: 'Ctrl+S', label: tt('kb.save') },
    { keys: 'Ctrl+Shift+P', label: tt('kb.commandPalette') },
    { keys: 'Ctrl+P', label: tt('kb.quickOpen') },
    { keys: 'Ctrl+Shift+F', label: tt('kb.workspaceSearch') },
    { keys: 'Ctrl+W', label: tt('kb.closeTab') },
    { keys: 'Ctrl+`', label: tt('kb.toggleTerminal') },
  ];

  if (!activeFile) {
    return (
      <div className={`editor-empty${isSolid ? ' editor-empty-solid' : ''}`}>
        {isSolid ? (
          <div className="shortcuts-overlay">
            <div className="shortcuts-grid">
              {mainShortcuts.map(s => (
                <div key={s.keys} className="shortcut-item">
                  <kbd className="shortcut-keys">{s.keys}</kbd>
                  <span className="shortcut-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DotGrid color={state.settings.dotGridColor} />
        )}
        {!isSolid && !showOnboarding && (
          <div className="empty-inner">
            <div className="empty-icon">
              <BlinkLogo className="empty-logo" />
            </div>
            <p className="empty-welcome">{tt('empty.welcome').replace('BlinkCode', '').replace('blinkcode', '')}<span className="blink-blue">Blink</span>Code</p>
          </div>
        )}
        {showOnboarding && (
          <div className="onboarding-overlay">
            <button className="onboarding-close" onClick={handleRequestDismissOnboarding} title={tt('tab.close')}>×</button>
            <div className="onboarding-inline">
              <div className="onboarding-logo-wrap">
                <BlinkLogo className="onboarding-logo" />
              </div>
              <h2 className="onboarding-title">{tt('onboarding.title')}</h2>
              <p className="onboarding-text">{tt('onboarding.description')}</p>
              <div className="onboarding-sections">
                <div className="onboarding-section">
                  <h3>{tt('onboarding.section.start')}</h3>
                  <p><strong>1.</strong> {tt('onboarding.item.startIntro')}</p>
                  <p><strong>1.1</strong> {tt('onboarding.item.openFolder')}</p>
                  <p><strong>1.2</strong> {tt('onboarding.item.projectTree')}</p>
                  <p><strong>1.3</strong> {tt('onboarding.item.editFiles')}</p>
                </div>
                <div className="onboarding-section">
                  <h3>{tt('onboarding.section.files')}</h3>
                  <p><strong>2.</strong> {tt('onboarding.item.filesIntro')}</p>
                  <p><strong>2.1</strong> {tt('onboarding.item.supportedFiles')}</p>
                  <p><strong>2.2</strong> {tt('onboarding.item.unsupported')}</p>
                  <p><strong>2.3</strong> {tt('onboarding.item.logs')}</p>
                  <p><strong>2.4</strong> {tt('onboarding.item.tabs')}</p>
                </div>
                <div className="onboarding-section">
                  <h3>{tt('onboarding.section.interface')}</h3>
                  <p><strong>3.</strong> {tt('onboarding.item.interfaceIntro')}</p>
                  <p><strong>3.1</strong> {tt('onboarding.item.sidebar')}</p>
                  <p><strong>3.2</strong> {tt('onboarding.item.activityBar')}</p>
                  <p><strong>3.3</strong> {tt('onboarding.item.settings')}</p>
                  <p><strong>3.4</strong> {tt('onboarding.item.ai')}</p>
                </div>
                <div className="onboarding-section">
                  <h3>{tt('onboarding.section.workflow')}</h3>
                  <p><strong>4.</strong> {tt('onboarding.item.workflowIntro')}</p>
                  <p><strong>4.1</strong> {tt('onboarding.item.autosave')}</p>
                  <p><strong>4.2</strong> {tt('onboarding.item.restore')}</p>
                  <p><strong>4.3</strong> {tt('onboarding.item.shortcuts')}</p>
                  <p><strong>4.4</strong> {tt('onboarding.item.themes')}</p>
                </div>
              </div>
            </div>
            {showOnboardingDismiss && (
              <div className="onboarding-dismiss-modal">
                <div className="onboarding-dismiss-card">
                  <div className="onboarding-dismiss-title">{tt('onboarding.dismissTitle')}</div>
                  <label className="onboarding-checkbox">
                    <input
                      type="checkbox"
                      checked={dontShowAgain}
                      onChange={e => setDontShowAgain(e.target.checked)}
                    />
                    <span className="onboarding-checkbox-mark" aria-hidden="true" />
                    <span>{tt('onboarding.dontShowAgain')}</span>
                  </label>
                  <div className="onboarding-dismiss-actions">
                    <button className="onboarding-dismiss-btn onboarding-dismiss-cancel" onClick={() => setShowOnboardingDismiss(false)}>
                      {tt('tab.cancel')}
                    </button>
                    <button className="onboarding-dismiss-btn onboarding-dismiss-confirm" onClick={handleDismissOnboarding}>
                      {tt('tab.close')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (activeFile.binary && isImageFile(activeFile.name) && activeFile.serverPath) {
    const src = getRawFileUrl(activeFile.serverPath);
    const zoom = ZOOM_LEVELS[zoomIdx];
    const onMouseDown = (e: React.MouseEvent) => {
      if (e.button === 0) {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        e.preventDefault();
      }
    };
    const onMouseMove = (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x),
        y: panStart.current.py + (e.clientY - panStart.current.y),
      });
    };
    const onMouseUp = () => setIsPanning(false);
    const zoomIn = () => changeZoom(1);
    const zoomOut = () => changeZoom(-1);

    return (
      <div className="editor-preview" ref={previewRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {imgError ? (
          <div className="preview-error">
            <FileWarning size={32} />
            <span>{tt('preview.cannotDisplay')}</span>
          </div>
        ) : (
          <img
            src={src}
            alt=""
            className="preview-image"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
            onError={() => setImgError(true)}
            draggable={false}
          />
        )}
        <div className="preview-toolbar">
          <button className="preview-zoom-btn" onClick={zoomOut} title="Zoom out"><ZoomOut size={14} /></button>
          <span className="preview-zoom-val">{Math.round(zoom * 100)}%</span>
          <button className="preview-zoom-btn" onClick={zoomIn} title="Zoom in"><ZoomIn size={14} /></button>
          <button className="preview-zoom-btn" onClick={resetView} title="Reset"><RotateCcw size={13} /></button>
        </div>
      </div>
    );
  }

  if (activeFile.binary) {
    return (
      <div className="editor-preview">
        <div className="preview-error">
          <FileWarning size={32} />
          <span>{tt(detailedSupport?.messageKey || 'preview.binaryFile')}</span>
          {detailedSupport?.badge && <span className="preview-badge">{detailedSupport.badge}</span>}
        </div>
      </div>
    );
  }

  if (activeFile.diffOriginalContent !== undefined && activeFile.diffModifiedContent !== undefined) {
    return (
      <DiffPreview
        title={tt('sc.diffPreview')}
        serverPath={activeFile.serverPath}
        fallbackName={activeFile.name}
        original={activeFile.diffOriginalContent}
        modified={activeFile.diffModifiedContent}
        hunks={activeFile.diffHunks}
        fontSize={state.settings.fontSize}
        fontFamily={state.settings.fontFamily}
        theme={getMonacoTheme(state.settings.theme, state.settings.colorScheme)}
      />
    );
  }

  return (
    <div className="code-editor">
      {state.settings.gitInlineBlame && blameInfo && (
        <div className="editor-blame" role="note" title={blameTitle}>
          <span className="editor-blame-author">{blameInfo.author}</span>
          <span className="editor-blame-sep">·</span>
          <span className="editor-blame-time">{blameRelativeTime}</span>
          <span className="editor-blame-sep">·</span>
          <span className="editor-blame-summary">{blameInfo.summary}</span>
          <span className="editor-blame-sha">{blameInfo.shortCommit}</span>
        </div>
      )}
      {isUnsupportedTextFile && activeFile && (
        <div className="editor-notice" role="note">
          <div className="editor-notice-icon">
            <FileWarning size={18} />
          </div>
          <div className="editor-notice-body">
            <div className="editor-notice-title">{tt('preview.webOnlyTitle')}</div>
            <div className="editor-notice-text">
              {tt(detailedSupport?.messageKey || 'preview.webOnlyMessage', { file: activeFile.name })}
            </div>
            <div className="editor-notice-text editor-notice-text-muted">
              {tt('preview.webOnlyDescription')}
            </div>
            <div className="editor-notice-meta">
              <span className="editor-notice-badge">{detailedSupport?.badge || tt('preview.readOnlyBadge')}</span>
            </div>
          </div>
        </div>
      )}
      <Editor
        height="100%"
        language={getMonacoLanguage(activeFile.name) || activeFile.language}
        path={activeFile.serverPath || activeFile.id}
        value={activeFile.content || ''}
        onChange={handleChange}
        onMount={handleMount}
        theme={getMonacoTheme(state.settings.theme, state.settings.colorScheme)}
        loading={<div className="editor-loader-wrap"><div className="editor-loader" /></div>}
        options={{ readOnly: isUnsupportedTextFile }}
      />
    </div>
  );
}

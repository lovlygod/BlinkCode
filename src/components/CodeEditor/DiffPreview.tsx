import { useMemo, useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { getMonacoLanguage } from '../../utils/supportedWebFiles';
import './DiffPreview.css';

type DiffHunk = { oldStart: number; oldLines: number; newStart: number; newLines: number; type: 'added' | 'deleted' | 'modified' };

function getDiffDisplayPath(serverPath: string | undefined, fallback: string): string {
  if (!serverPath) return fallback;
  return serverPath.replace(/^__git_diff__\/(staged|unstaged)\//, '');
}

function renderDiffText(content: string): string[] {
  return content.split('\n');
}

function alignByHunks(
  originalLines: string[],
  modifiedLines: string[],
  hunks: DiffHunk[] | undefined,
): Array<{ left: string; right: string; kind: '' | 'added' | 'removed' | 'modified' }> {
  const out: Array<{ left: string; right: string; kind: '' | 'added' | 'removed' | 'modified' }> = [];
  const hs = [...(hunks || [])].sort((a, b) => (a.oldStart || 0) - (b.oldStart || 0));

  let oldPos = 1;
  let newPos = 1;

  const pushUnchanged = (count: number) => {
    for (let i = 0; i < count; i++) {
      out.push({ left: originalLines[oldPos - 1] ?? '', right: modifiedLines[newPos - 1] ?? '', kind: '' });
      oldPos++;
      newPos++;
    }
  };

  for (const h of hs) {
    const unchanged = Math.max(0, Math.min(h.oldStart - oldPos, h.newStart - newPos));
    pushUnchanged(unchanged);

    if (h.type === 'added') {
      for (let i = 0; i < Math.max(1, h.newLines); i++) {
        out.push({ left: '', right: modifiedLines[newPos - 1] ?? '', kind: 'added' });
        newPos++;
      }
      continue;
    }

    if (h.type === 'deleted') {
      for (let i = 0; i < Math.max(1, h.oldLines); i++) {
        out.push({ left: originalLines[oldPos - 1] ?? '', right: '', kind: 'removed' });
        oldPos++;
      }
      continue;
    }

    const span = Math.max(Math.max(1, h.newLines), Math.max(1, h.oldLines));
    for (let i = 0; i < span; i++) {
      out.push({
        left: originalLines[oldPos - 1] ?? '',
        right: modifiedLines[newPos - 1] ?? '',
        kind: 'modified',
      });
      if (i < h.oldLines) oldPos++;
      if (i < h.newLines) newPos++;
    }
  }

  while (oldPos <= originalLines.length || newPos <= modifiedLines.length) {
    out.push({ left: originalLines[oldPos - 1] ?? '', right: modifiedLines[newPos - 1] ?? '', kind: '' });
    oldPos++;
    newPos++;
  }

  return out;
}

export default function DiffPreview({
  title,
  serverPath,
  fallbackName,
  original,
  modified,
  hunks,
  fontSize,
  fontFamily,
  theme,
}: {
  title: string;
  serverPath?: string;
  fallbackName: string;
  original: string;
  modified: string;
  hunks?: DiffHunk[];
  fontSize: number;
  fontFamily: string;
  theme: string;
}) {
  const leftEditorRef = useRef<any>(null);
  const rightEditorRef = useRef<any>(null);
  const leftDecoRef = useRef<string[]>([]);
  const rightDecoRef = useRef<string[]>([]);
  const syncingRef = useRef(false);

  const originalLines = useMemo(() => renderDiffText(original), [original]);
  const modifiedLines = useMemo(() => renderDiffText(modified), [modified]);
  const aligned = useMemo(() => alignByHunks(originalLines, modifiedLines, hunks), [originalLines, modifiedLines, hunks]);

  const syncScroll = useCallback((source: 'left' | 'right') => {
    if (syncingRef.current) return;
    const fromEditor = source === 'left' ? leftEditorRef.current : rightEditorRef.current;
    const toEditor = source === 'left' ? rightEditorRef.current : leftEditorRef.current;
    if (!fromEditor || !toEditor) return;
    const from = fromEditor.getScrollTop();
    const fromLeft = fromEditor.getScrollLeft();
    syncingRef.current = true;
    toEditor.setScrollTop(from);
    toEditor.setScrollLeft(fromLeft);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const applyLineDecorations = useCallback((editor: any, monaco: any, side: 'left' | 'right') => {
    const next: any[] = [];
    aligned.forEach((line, i) => {
      const lineNo = i + 1;
      if (side === 'left') {
        if (line.kind === 'removed' || line.kind === 'modified') {
          next.push({
            range: new monaco.Range(lineNo, 1, lineNo, 1),
            options: { isWholeLine: true, className: line.kind === 'removed' ? 'simple-diff-line-removed-bg' : 'simple-diff-line-modified-bg' },
          });
        }
      } else if (line.kind === 'added' || line.kind === 'modified') {
        next.push({
          range: new monaco.Range(lineNo, 1, lineNo, 1),
          options: { isWholeLine: true, className: line.kind === 'added' ? 'simple-diff-line-added-bg' : 'simple-diff-line-modified-bg' },
        });
      }
    });

    if (side === 'left') {
      leftDecoRef.current = editor.deltaDecorations(leftDecoRef.current, next);
    } else {
      rightDecoRef.current = editor.deltaDecorations(rightDecoRef.current, next);
    }
  }, [aligned]);

  const onLeftMount: OnMount = useCallback((editor, monaco) => {
    leftEditorRef.current = editor;
    editor.onDidScrollChange(() => syncScroll('left'));
    applyLineDecorations(editor, monaco, 'left');
  }, [applyLineDecorations, syncScroll]);

  const onRightMount: OnMount = useCallback((editor, monaco) => {
    rightEditorRef.current = editor;
    editor.onDidScrollChange(() => syncScroll('right'));
    applyLineDecorations(editor, monaco, 'right');
  }, [applyLineDecorations, syncScroll]);

  const leftText = useMemo(() => aligned.map(line => line.left || ' ').join('\n'), [aligned]);
  const rightText = useMemo(() => aligned.map(line => line.right || ' ').join('\n'), [aligned]);
  const displayPath = getDiffDisplayPath(serverPath, fallbackName);
  const fileNameForLanguage = displayPath.split('/').pop() || fallbackName;
  const language = getMonacoLanguage(fileNameForLanguage) || 'plaintext';

  return (
    <div className="code-editor">
      <div className="diff-notice" role="note">
        <span className="diff-notice-title">{title}</span>
        <span className="diff-notice-path">{displayPath}</span>
      </div>
      <div className="simple-diff" style={{ fontSize, fontFamily: `'${fontFamily}', 'JetBrains Mono', Consolas, monospace` }}>
        <div className="simple-diff-pane">
          <div className="simple-diff-pane-title">Original</div>
          <div className="simple-diff-code monaco-host">
            <Editor
              height="100%"
              language={language}
              theme={theme}
              value={leftText}
              onMount={onLeftMount}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                folding: false,
                renderLineHighlight: 'none',
              }}
            />
          </div>
        </div>
        <div className="simple-diff-pane">
          <div className="simple-diff-pane-title">Current</div>
          <div className="simple-diff-code monaco-host">
            <Editor
              height="100%"
              language={language}
              theme={theme}
              value={rightText}
              onMount={onRightMount}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                folding: false,
                renderLineHighlight: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


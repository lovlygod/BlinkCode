import { useEffect, useState } from 'react';
import { useEditor } from '../../store/EditorContext';
import { GitBranch } from 'lucide-react';
import './StatusBar.css';

export default function StatusBar() {
  const { state, getActiveFile } = useEditor();
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.line && d?.column) setCursor({ line: d.line, column: d.column });
    };
    window.addEventListener('blinkcode:cursorPosition', handler);
    return () => window.removeEventListener('blinkcode:cursorPosition', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchBranch = async () => {
      try {
        const res = await fetch('/api/git-branch');
        const data = await res.json();
        if (!cancelled) setBranch(data.branch || null);
      } catch {
        if (!cancelled) setBranch(null);
      }
    };
    fetchBranch();
    const id = setInterval(fetchBranch, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [state.workspaceDir]);

  const activeFile = getActiveFile();
  const language = activeFile?.language || 'plaintext';
  const indent = state.settings.insertSpaces
    ? `Spaces: ${state.settings.tabSize}`
    : 'Tabs';

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {branch && (
          <span className="status-item status-branch">
            <GitBranch size={12} />
            {branch}
          </span>
        )}
      </div>
      <div className="status-bar-right">
        <span className="status-item">Ln {cursor.line}, Col {cursor.column}</span>
        <span className="status-item">{indent}</span>
        <span className="status-item">UTF-8</span>
        <span className="status-item status-lang">{language}</span>
      </div>
    </div>
  );
}

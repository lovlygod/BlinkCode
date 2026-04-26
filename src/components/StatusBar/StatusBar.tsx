import { useEffect, useState } from 'react';
import { useEditor } from '../../store/EditorContext';
import { AlertTriangle, CircleAlert, GitBranch } from 'lucide-react';
import './StatusBar.css';

export default function StatusBar() {
  const { state, getActiveFile, toggleProblemsPanel } = useEditor();
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [branch, setBranch] = useState<string | null>(null);
  const [problemCounts, setProblemCounts] = useState({ errors: 0, warnings: 0 });

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.line && d?.column) setCursor({ line: d.line, column: d.column });
    };
    window.addEventListener('blinkcode:cursorPosition', handler);
    return () => window.removeEventListener('blinkcode:cursorPosition', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d) setProblemCounts({ errors: d.errors || 0, warnings: d.warnings || 0 });
    };
    window.addEventListener('blinkcode:problemCounts', handler);
    return () => window.removeEventListener('blinkcode:problemCounts', handler);
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
        <button className="status-item status-problems-btn" onClick={toggleProblemsPanel} title="Toggle Problems">
          <CircleAlert size={12} /> {problemCounts.errors}
          <AlertTriangle size={12} /> {problemCounts.warnings}
        </button>
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

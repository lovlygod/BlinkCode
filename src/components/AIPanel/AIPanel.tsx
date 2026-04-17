import { useState } from 'react';
import { useEditor } from '../../store/EditorContext';
import { X, Lightbulb, Wrench, Sparkles, Bot } from 'lucide-react';
import { useT } from '../../hooks/useT';
import './AIPanel.css';

interface AIResp { action: string; result: string; }

export default function AIPanel() {
  const { state, toggleAIPanel, getActiveFile, addToast } = useEditor();
  const tt = useT();
  const [responses, setResponses] = useState<AIResp[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  if (!state.showAIPanel) return null;

  const activeFile = getActiveFile();

  const actions = [
    { id: 'explain', label: tt('ai.explain'), icon: <Lightbulb size={14} /> },
    { id: 'fix', label: tt('ai.fix'), icon: <Wrench size={14} /> },
    { id: 'improve', label: tt('ai.improve'), icon: <Sparkles size={14} /> },
  ];

  const handleAction = (actionId: string) => {
    if (!activeFile) { addToast(tt('toast.openFileFirst'), 'info'); return; }
    setLoading(actionId);
    setTimeout(() => {
      const code = activeFile.content || '';
      let result = '';
      switch (actionId) {
        case 'explain':
          const lines = code.split('\n').filter(l => l.trim());
          const fns = (code.match(/function\s|=>\s|class\s/g) || []).length;
          result = `📄 ${activeFile.name}\n\nLines: ${lines.length}\nFunctions/classes: ${fns}\n\nThis code ${fns > 0 ? `defines ${fns} function(s)/class(es)` : 'is a simple script'}. ${code.includes('console.log') ? 'Outputs to console.' : 'Processes data internally.'}`;
          break;
        case 'fix': {
          const issues: string[] = [];
          if (code.includes('var ')) issues.push('• Replace "var" with "const"/"let"');
          if (code.includes('== ') && !code.includes('=== ')) issues.push('• Use "===" for strict equality');
          if (!code.includes('try') && code.includes('JSON.parse')) issues.push('• Wrap JSON.parse in try-catch');
          result = issues.length > 0 ? `Issues found:\n${issues.join('\n')}` : 'No obvious issues found. Code looks clean!';
          break;
        }
        case 'improve': {
          const tips: string[] = [];
          if (!code.includes('export')) tips.push('• Add exports for reusability');
          if (!code.includes('const') && code.includes('let')) tips.push('• Prefer "const" over "let"');
          if (!code.includes('Type')) tips.push('• Consider TypeScript for safety');
          result = tips.length > 0 ? `Suggestions:\n${tips.join('\n')}` : 'Code looks well-structured!';
          break;
        }
      }
      const label = actions.find(a => a.id === actionId)?.label || actionId;
      setResponses(prev => [{ action: label, result }, ...prev]);
      setLoading(null);
      addToast(`${tt('toast.ai')} ${label}`, 'success');
    }, 600 + Math.random() * 400);
  };

  return (
    <div className="ai-panel">
      <div className="ai-head">
        <div className="ai-head-left">
          <Bot size={14} className="ai-icon" />
          <span className="ai-title">{tt('ai.title')}</span>
        </div>
        <button className="ai-close" onClick={toggleAIPanel}><X size={14} /></button>
      </div>
      <div className="ai-actions">
        {actions.map(a => (
          <button
            key={a.id}
            className={`ai-action ${loading === a.id ? 'loading' : ''}`}
            onClick={() => handleAction(a.id)}
            disabled={!!loading}
          >
            {a.icon}
            <span>{a.label}</span>
            {loading === a.id && <div className="ai-spinner" />}
          </button>
        ))}
      </div>
      {!activeFile && <div className="ai-hint">{tt('ai.hint')}</div>}
      <div className="ai-responses">
        {responses.map((r, i) => (
          <div key={i} className="ai-response">
            <div className="ai-res-action">{r.action}</div>
            <pre className="ai-res-text">{r.result}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

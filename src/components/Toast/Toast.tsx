import { useEditor } from '../../store/EditorContext';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import './Toast.css';

export default function Toast() {
  const { state, removeToast } = useEditor();

  if (state.toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {state.toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            {t.type === 'success' && <CheckCircle size={14} />}
            {t.type === 'error' && <XCircle size={14} />}
            {t.type === 'info' && <Info size={14} />}
          </span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => removeToast(t.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

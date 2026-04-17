import { useEditor } from '../../store/EditorContext';
import { ChevronRight } from 'lucide-react';
import './Breadcrumb.css';

export default function Breadcrumb() {
  const { getActiveFile } = useEditor();
  const file = getActiveFile();

  if (!file?.serverPath) return null;

  const parts = file.serverPath.split('/');

  return (
    <div className="breadcrumb">
      {parts.map((part, i) => (
        <span key={i} className="breadcrumb-part">
          {i > 0 && <ChevronRight size={11} className="breadcrumb-sep" />}
          <span className={i === parts.length - 1 ? 'breadcrumb-active' : ''}>{part}</span>
        </span>
      ))}
    </div>
  );
}

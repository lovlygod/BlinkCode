import { Files, Search, Settings } from 'lucide-react';
import { useEditor } from '../../store/EditorContext';
import { useT } from '../../hooks/useT';
import './ActivityBar.css';

export default function ActivityBar() {
  const { state, toggleSidebar, toggleSearchPanel, toggleSettings } = useEditor();
  const tt = useT();

  return (
    <aside className="activity-bar">
      <div className="activity-bar-top">
        <button
          className={`activity-btn ${state.sidebarVisible ? 'active' : ''}`}
          onClick={toggleSidebar}
          title={tt('explorer.title')}
        >
          <Files size={22} />
        </button>
        <button
          className={`activity-btn ${state.showSearchPanel ? 'active' : ''}`}
          onClick={toggleSearchPanel}
          title={tt('search.title')}
        >
          <Search size={22} />
        </button>
      </div>

      <div className="activity-bar-bottom">
        <button
          className={`activity-btn activity-settings-btn ${state.showSettings ? 'active' : ''}`}
          onClick={toggleSettings}
          title={tt('top.settings')}
        >
          <Settings size={24} />
        </button>
      </div>
    </aside>
  );
}

import { EditorProvider } from './store/EditorContext';
import TopHeader from './components/TopHeader/TopHeader';
import ActivityBar from './components/ActivityBar/ActivityBar';
import TabsHeader from './components/TabsHeader/TabsHeader';
import Sidebar from './components/Sidebar/Sidebar';
import CodeEditor from './components/CodeEditor/CodeEditor';
import TerminalPanel from './components/Terminal/Terminal';
import AIPanel from './components/AIPanel/AIPanel';
import SettingsPanel from './components/SettingsPanel/SettingsPanel';
import Toast from './components/Toast/Toast';
import Breadcrumb from './components/Breadcrumb/Breadcrumb';
import BrowserPreview from './components/BrowserPreview/BrowserPreview';
import CommandPalette from './components/CommandPalette/CommandPalette';
import StatusBar from './components/StatusBar/StatusBar';
import { useEditor } from './store/EditorContext';
import './App.css';

function EditorLayout() {
  const { state } = useEditor();
  const isSplit = !!state.splitActiveTabId && !state.browserOpen;

  return (
    <div className="app">
      <TopHeader />
      <div className="main-area">
        <ActivityBar />
        <Sidebar />
        <div className="editor-area">
          {!state.browserOpen && (
            <>
              <TabsHeader />
              <Breadcrumb />
            </>
          )}
          <div className={`editor-content${isSplit ? ' editor-split' : ''}`}>
            {state.browserOpen ? (
              <BrowserPreview />
            ) : isSplit ? (
              <>
                <div className="editor-pane editor-pane-primary">
                  <CodeEditor group="primary" />
                </div>
                <div className="editor-split-divider" />
                <div className="editor-pane editor-pane-secondary">
                  <CodeEditor group="secondary" />
                </div>
              </>
            ) : (
              <CodeEditor group="primary" />
            )}
          </div>
          <TerminalPanel />
          <StatusBar />
        </div>
        <AIPanel />
      </div>
      <Toast />
      <SettingsPanel />
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <EditorProvider>
      <EditorLayout />
    </EditorProvider>
  );
}

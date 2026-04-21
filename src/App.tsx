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
import { useEditor } from './store/EditorContext';
import './App.css';

function EditorLayout() {
  const { state } = useEditor();

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
          <div className="editor-content">
            {state.browserOpen ? <BrowserPreview /> : <CodeEditor />}
          </div>
          <TerminalPanel />
        </div>
        <AIPanel />
      </div>
      <Toast />
      <SettingsPanel />
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

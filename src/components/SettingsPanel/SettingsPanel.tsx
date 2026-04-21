import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../../store/EditorContext';
import type { EditorSettings } from '../../types';
import { THEME_LIST, type ThemeName } from '../../store/EditorContext';
import { X, Settings, Keyboard, RotateCcw, ChevronDown } from 'lucide-react';
import { useT } from '../../hooks/useT';
import './SettingsPanel.css';

type Tab = 'general' | 'keybindings';

interface SelectOption { value: string | number; label: string }

function SettingsSelect({ options, value, onChange }: { options: SelectOption[]; value: string | number; onChange: (v: string | number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="settings-select" ref={ref}>
      <button className="settings-select-btn" onClick={() => setOpen(!open)}>
        <span>{current?.label || String(value)}</span>
        <ChevronDown size={13} className={`settings-select-arrow ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="settings-select-dropdown">
          {options.map(o => (
            <button
              key={String(o.value)}
              className={`settings-select-option ${o.value === value ? 'active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const { state, toggleSettings, updateSettings } = useEditor();
  const tt = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [recordingId, setRecordingId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (recordingId) { setRecordingId(null); return; }
        if (state.showSettings) toggleSettings();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.showSettings, toggleSettings, recordingId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) toggleSettings();
    };
    if (state.showSettings) {
      setTimeout(() => document.addEventListener('mousedown', onClick), 0);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [state.showSettings, toggleSettings]);

  if (!state.showSettings) return null;

  const s = state.settings;

  const recordKey = (e: React.KeyboardEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    const key = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      let k = key;
      if (k === ' ') k = 'Space';
      else k = key.length === 1 ? key.toUpperCase() : key;
      parts.push(k);
    }
    if (parts.length === 0 || (parts.length === 1 && ['Ctrl', 'Shift', 'Alt'].includes(parts[0]))) return;
    const combo = parts.join('+');
    const newBindings = s.keybindings.map(b => b.id === id ? { ...b, keys: combo } : b);
    updateSettings({ keybindings: newBindings });
    setRecordingId(null);
  };

  const resetKeybindings = () => {
    const defaultBinds = [
      { id: 'commandPalette', label: 'Command Palette', keys: 'Ctrl+Shift+P' },
      { id: 'splitEditor', label: 'Split Editor Right', keys: 'Ctrl+\\' },
      { id: 'save', label: 'Save File', keys: 'Ctrl+S' },
      { id: 'toggleSidebar', label: 'Toggle Sidebar', keys: 'Ctrl+B' },
      { id: 'toggleTerminal', label: 'Toggle Terminal', keys: 'Ctrl+`' },
      { id: 'toggleAI', label: 'Toggle AI Panel', keys: 'Ctrl+I' },
      { id: 'toggleSettings', label: 'Toggle Settings', keys: 'Ctrl+,' },
      { id: 'newFile', label: 'New File', keys: 'Alt+N' },
      { id: 'closeTab', label: 'Close Tab', keys: 'Alt+W' },
      { id: 'zoomIn', label: 'Zoom In', keys: 'Ctrl+=' },
      { id: 'zoomOut', label: 'Zoom Out', keys: 'Ctrl+-' },
      { id: 'find', label: 'Find', keys: 'Ctrl+F' },
      { id: 'replace', label: 'Find and Replace', keys: 'Ctrl+H' },
      { id: 'undo', label: 'Undo', keys: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', keys: 'Ctrl+Shift+Z' },
      { id: 'goToLine', label: 'Go to Line', keys: 'Ctrl+G' },
      { id: 'toggleWordWrap', label: 'Toggle Word Wrap', keys: 'Alt+Z' },
      { id: 'comment', label: 'Toggle Comment', keys: 'Ctrl+/' },
    ];
    updateSettings({ keybindings: defaultBinds });
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel" ref={panelRef}>
        <div className="settings-head">
          <div className="settings-head-left">
            <Settings size={15} className="settings-icon" />
            <span className="settings-title">{tt('settings.title')}</span>
          </div>
          <button className="settings-close" onClick={toggleSettings}><X size={15} /></button>
        </div>

        <div className="settings-content">
          <div className="settings-sidebar">
            <button
              className={`settings-menu-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <Settings size={14} />
              <span>{tt('settings.general')}</span>
            </button>
            <button
              className={`settings-menu-item ${activeTab === 'keybindings' ? 'active' : ''}`}
              onClick={() => setActiveTab('keybindings')}
            >
              <Keyboard size={14} />
              <span>{tt('settings.keybindings')}</span>
            </button>
          </div>

          <div className="settings-main">
            {activeTab === 'general' && (
              <>
                <div className="settings-section">
                  <div className="settings-section-title">{tt('settings.editor')}</div>
                  <div className="settings-section-desc">{tt('settings.editor.desc')}</div>

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.fontSize')}</div>
                        <div className="settings-row-desc">{tt('settings.fontSize.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className="settings-num-btn" onClick={() => updateSettings({ fontSize: Math.max(10, s.fontSize - 1) })}>−</button>
                      <span className="settings-num-val">{s.fontSize}</span>
                      <button className="settings-num-btn" onClick={() => updateSettings({ fontSize: Math.min(28, s.fontSize + 1) })}>+</button>
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.tabSize')}</div>
                        <div className="settings-row-desc">{tt('settings.tabSize.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={[2, 4, 8].map(v => ({ value: v, label: String(v) }))}
                        value={s.tabSize}
                        onChange={v => updateSettings({ tabSize: v as number })}
                      />
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.wordWrap')}</div>
                        <div className="settings-row-desc">{tt('settings.wordWrap.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.wordWrap ? 'on' : ''}`} onClick={() => updateSettings({ wordWrap: !s.wordWrap })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.wordWrap ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.minimap')}</div>
                        <div className="settings-row-desc">{tt('settings.minimap.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.minimap ? 'on' : ''}`} onClick={() => updateSettings({ minimap: !s.minimap })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.minimap ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.fontLigatures')}</div>
                        <div className="settings-row-desc">{tt('settings.fontLigatures.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.fontLigatures ? 'on' : ''}`} onClick={() => updateSettings({ fontLigatures: !s.fontLigatures })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.fontLigatures ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.lineNumbers')}</div>
                        <div className="settings-row-desc">{tt('settings.lineNumbers.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.lineNumbers ? 'on' : ''}`} onClick={() => updateSettings({ lineNumbers: !s.lineNumbers })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.lineNumbers ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.cursorBlinking')}</div>
                        <div className="settings-row-desc">{tt('settings.cursorBlinking.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={['smooth', 'blink', 'phase', 'expand', 'solid'].map(v => ({ value: v, label: v }))}
                        value={s.cursorBlinking}
                        onChange={v => updateSettings({ cursorBlinking: v as EditorSettings['cursorBlinking'] })}
                      />
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.fontFamily')}</div>
                        <div className="settings-row-desc">{tt('settings.fontFamily.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Source Code Pro', 'monospace'].map(v => ({ value: v, label: tt('fontFamily.' + v.toLowerCase().replace(/ /g, '-')) }))}
                        value={s.fontFamily}
                        onChange={v => updateSettings({ fontFamily: v as string })}
                      />
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.cursorStyle')}</div>
                        <div className="settings-row-desc">{tt('settings.cursorStyle.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={['line', 'block', 'underline', 'line-thin', 'block-outline'].map(v => ({ value: v, label: tt('cursorStyle.' + v) }))}
                        value={s.cursorStyle}
                        onChange={v => updateSettings({ cursorStyle: v as EditorSettings['cursorStyle'] })}
                      />
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.renderWhitespace')}</div>
                        <div className="settings-row-desc">{tt('settings.renderWhitespace.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={['none', 'boundary', 'all'].map(v => ({ value: v, label: tt('renderWhitespace.' + v) }))}
                        value={s.renderWhitespace}
                        onChange={v => updateSettings({ renderWhitespace: v as EditorSettings['renderWhitespace'] })}
                      />
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.autoClosingBrackets')}</div>
                        <div className="settings-row-desc">{tt('settings.autoClosingBrackets.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.autoClosingBrackets ? 'on' : ''}`} onClick={() => updateSettings({ autoClosingBrackets: !s.autoClosingBrackets })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.autoClosingBrackets ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title">{tt('settings.files')}</div>
                  <div className="settings-section-desc">{tt('settings.files.desc')}</div>

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.autoSaveDelay')}</div>
                        <div className="settings-row-desc">{tt('settings.autoSaveDelay.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={[
                          { value: 0, label: tt('settings.off') },
                          { value: 300, label: '300ms' },
                          { value: 1000, label: '1s' },
                          { value: 2000, label: '2s' },
                        ]}
                        value={s.autoSaveDelay}
                        onChange={v => updateSettings({ autoSaveDelay: v as number })}
                      />
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.trimTrailingWhitespace')}</div>
                        <div className="settings-row-desc">{tt('settings.trimTrailingWhitespace.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.trimTrailingWhitespace ? 'on' : ''}`} onClick={() => updateSettings({ trimTrailingWhitespace: !s.trimTrailingWhitespace })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.trimTrailingWhitespace ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.insertSpaces')}</div>
                        <div className="settings-row-desc">{tt('settings.insertSpaces.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.insertSpaces ? 'on' : ''}`} onClick={() => updateSettings({ insertSpaces: !s.insertSpaces })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.insertSpaces ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title">{tt('settings.appearance')}</div>
                  <div className="settings-section-desc">{tt('settings.appearance.desc')}</div>

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.colorScheme')}</div>
                        <div className="settings-row-desc">{tt('settings.colorScheme.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={[
                          { value: 'dark', label: tt('colorScheme.dark') },
                          { value: 'light', label: tt('colorScheme.light') },
                          { value: 'system', label: tt('colorScheme.system') },
                        ]}
                        value={s.colorScheme}
                        onChange={v => updateSettings({ colorScheme: v as 'dark' | 'light' | 'system' })}
                      />
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.theme')}</div>
                        <div className="settings-row-desc">{tt('settings.theme.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={THEME_LIST.map(t => ({ value: t.id, label: tt('theme.' + t.id) }))}
                        value={s.theme}
                        onChange={v => updateSettings({ theme: v as ThemeName })}
                      />
                    </div>
                  </div>
                  <div className="settings-theme-desc">
                    {THEME_LIST.find(t => t.id === s.theme)?.url ? (
                      <>{tt('theme.' + s.theme + '.desc')} <a href={THEME_LIST.find(t => t.id === s.theme)?.url} target="_blank" rel="noopener noreferrer" className="theme-link">{THEME_LIST.find(t => t.id === s.theme)?.url?.replace('https://github.com/', '')}</a></>
                    ) : (
                      tt('theme.' + s.theme + '.desc')
                    )}
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.language')}</div>
                        <div className="settings-row-desc">{tt('settings.language.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <SettingsSelect
                        options={[
                          { value: 'en', label: 'English' },
                          { value: 'ru', label: 'Русский' },
                        ]}
                        value={s.language}
                        onChange={v => updateSettings({ language: v as 'en' | 'ru' })}
                      />
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.animations')}</div>
                        <div className="settings-row-desc">{tt('settings.animations.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.animations ? 'on' : ''}`} onClick={() => updateSettings({ animations: !s.animations })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.animations ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.showFileIcons')}</div>
                        <div className="settings-row-desc">{tt('settings.showFileIcons.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.showFileIcons ? 'on' : ''}`} onClick={() => updateSettings({ showFileIcons: !s.showFileIcons })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.showFileIcons ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                  <hr className="settings-divider" />

                  <div className="settings-row">
                    <div className="settings-row-label">
                      <div>
                        <div className="settings-row-name">{tt('settings.compactMode')}</div>
                        <div className="settings-row-desc">{tt('settings.compactMode.desc')}</div>
                      </div>
                    </div>
                    <div className="settings-row-control">
                      <button className={`settings-toggle ${s.compactMode ? 'on' : ''}`} onClick={() => updateSettings({ compactMode: !s.compactMode })}>
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{s.compactMode ? tt('on') : tt('off')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'keybindings' && (
              <div className="settings-section">
                <div className="keybindings-header">
                  <div>
                    <div className="settings-section-title">{tt('settings.keyboard')}</div>
                  </div>
                  <button className="keybindings-reset" onClick={resetKeybindings} title="Reset to defaults">
                    <RotateCcw size={12} />
                    <span>{tt('settings.reset')}</span>
                  </button>
                </div>
                {s.keybindings.map(kb => (
                  <div key={kb.id} className="settings-row kb-row">
                    <div className="settings-row-label">
                      <span>{tt('kb.' + kb.id)}</span>
                    </div>
                    <div className="settings-row-control">
                      {recordingId === kb.id ? (
                        <button
                          className="kb-record active"
                          onKeyDown={e => recordKey(e, kb.id)}
                          autoFocus
                        >
                          {tt('settings.pressKeys')}
                        </button>
                      ) : (
                        <button
                          className="kb-record"
                          onClick={() => setRecordingId(kb.id)}
                        >
                          <kbd>{kb.keys}</kbd>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="settings-footer">
          <span className="settings-footer-blink">Blink</span><span className="settings-footer-code">Code</span>
          <span className="settings-footer-version">v0.2.0</span>
        </div>
      </div>
    </div>
  );
}

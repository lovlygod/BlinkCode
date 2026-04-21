import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditor } from '../../store/EditorContext';
import { v4 as uuid } from 'uuid';
import { Terminal } from 'xterm';
import type { IDisposable, ILink, ILinkProvider } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import {
  X, Terminal as TermIcon,
  Plus
} from 'lucide-react';
import type { TerminalInstance } from '../../types';
import { useT } from '../../hooks/useT';
import { useShell } from '../../hooks/useShell';
import { useResizable } from '../../hooks/useResizable';
import './Terminal.css';

const URL_REGEX = /https?:\/\/[^\s"'<>`]+/gi;
const ANSI_ESCAPE_REGEX = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, '');
}

function extractUrls(value: string): string[] {
  URL_REGEX.lastIndex = 0;
  const cleanValue = stripAnsi(value);
  return Array.from(cleanValue.matchAll(URL_REGEX), match => match[0].replace(/[\])\]}>,;:!?]+$/g, ''));
}

function createTerminalLinkProvider(
  term: Terminal,
  openBrowserPreview: (url: string) => void,
): ILinkProvider {
  return {
    provideLinks(bufferLineNumber, callback) {
      const line = stripAnsi(term.buffer.active.getLine(bufferLineNumber - 1)?.translateToString(true) || '');
      const links: ILink[] = [];

      URL_REGEX.lastIndex = 0;
      for (const match of line.matchAll(URL_REGEX)) {
        const url = match[0];
        const startIndex = match.index ?? -1;
        if (startIndex < 0) continue;

        const endIndex = startIndex + url.length;
        links.push({
          range: {
            start: { x: startIndex + 1, y: bufferLineNumber },
            end: { x: endIndex, y: bufferLineNumber },
          },
          text: url,
          decorations: {
            underline: true,
            pointerCursor: true,
          },
          activate(event) {
            const electronApi = (window as any).electronAPI;
            if (event.ctrlKey || event.metaKey) {
              if (electronApi?.openExternal) {
                electronApi.openExternal(url).catch(() => {});
              } else {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
              return;
            }

            openBrowserPreview(url);
          },
        });
      }

      callback(links.length > 0 ? links : undefined);
    },
  };
}

export default function TerminalPanel() {
  const {
    state, toggleTerminal, setTerminalHeight,
    addTerminalInstance, removeTerminalInstance, setActiveTerminal,
    updateTerminalCwd, openBrowserPreview
  } = useEditor();
  const tt = useT();
  const resizeRef = useRef<HTMLDivElement>(null);
  const hostRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const terminalsRef = useRef<Map<string, Terminal>>(new Map());
  const fitAddonsRef = useRef<Map<string, FitAddon>>(new Map());
  const linkProvidersRef = useRef<Map<string, IDisposable>>(new Map());
  const [detectedLinks, setDetectedLinks] = useState<Record<string, string[]>>({});

  const shell = useShell({
    updateTerminalCwd,
    onData: (instanceId, data) => {
      const matches = extractUrls(data);
      if (matches.length > 0) {
        setDetectedLinks(prev => {
          const existing = prev[instanceId] || [];
          const merged = [...existing];

          for (const match of matches) {
            if (!merged.includes(match)) merged.push(match);
          }

          return {
            ...prev,
            [instanceId]: merged.slice(-6),
          };
        });
      }

      terminalsRef.current.get(instanceId)?.write(data);
    },
    onExit: (instanceId, code) => {
      terminalsRef.current.get(instanceId)?.writeln(`\r\nProcess exited with code ${code}`);
    },
    onError: (instanceId, message) => {
      terminalsRef.current.get(instanceId)?.writeln(`\r\n${message}`);
    },
  });

  const activeInst = state.terminalInstances.find(inst => inst.id === state.activeTerminalId) || null;

  useEffect(() => {
    if (state.terminalOpen && state.terminalInstances.length === 0) {
      addNewTerminal();
    }
  }, [state.terminalOpen]);

  useEffect(() => {
    if (state.terminalOpen && activeInst) {
      if (!shell.isConnected(activeInst.id)) {
        shell.connectShell(activeInst.id, state.workspaceDir);
      }
    }
  }, [state.terminalOpen, state.activeTerminalId, state.workspaceDir]);

  useEffect(() => {
    if (!state.terminalOpen) shell.closeAll();
  }, [state.terminalOpen]);

  useEffect(() => {
    return () => {
      terminalsRef.current.forEach(term => term.dispose());
      terminalsRef.current.clear();
      fitAddonsRef.current.clear();
      linkProvidersRef.current.forEach(provider => provider.dispose());
      linkProvidersRef.current.clear();
      setDetectedLinks({});
      shell.closeAll();
    };
  }, []);

  const addNewTerminal = () => {
    const id = uuid();
    const num = state.terminalInstances.length + 1;
    const inst: TerminalInstance = { id, name: `${tt('term.tab')} ${num}`, cwd: '' };
    addTerminalInstance(inst);
  };

  const handleResize = (e: MouseEvent) => {
    const parent = resizeRef.current?.parentElement?.getBoundingClientRect();
    if (parent) setTerminalHeight(parent.bottom - e.clientY);
  };

  useResizable(resizeRef, handleResize, 'row');

  useLayoutEffect(() => {
    if (!state.terminalOpen) return;

    const handleWindowResize = () => {
      for (const inst of state.terminalInstances) {
        const currentTerm = terminalsRef.current.get(inst.id);
        const currentFit = fitAddonsRef.current.get(inst.id);
        const host = hostRefs.current.get(inst.id);
        if (!currentTerm || !currentFit || !host || host.offsetParent === null) continue;
        currentFit.fit();
        shell.resizeShell(inst.id, currentTerm.cols, currentTerm.rows);
      }
    };

    state.terminalInstances.forEach((inst) => {
      const host = hostRefs.current.get(inst.id);
      if (!host) return;

      let term = terminalsRef.current.get(inst.id);
      let fitAddon = fitAddonsRef.current.get(inst.id);

      if (!term || !fitAddon) {
        term = new Terminal({
          convertEol: true,
          cursorBlink: true,
          fontFamily: `'JetBrains Mono', monospace`,
          fontSize: 12,
          theme: {
            background: '#0d0f14',
            foreground: '#c8d0dc',
            cursor: '#4f8cff',
            selectionBackground: 'rgba(79, 140, 255, 0.25)',
            black: '#0d0f14',
            red: '#ef4444',
            green: '#22c55e',
            yellow: '#f59e0b',
            blue: '#4f8cff',
            magenta: '#a78bfa',
            cyan: '#67e8f9',
            white: '#e5e7eb',
            brightBlack: '#6b7280',
            brightRed: '#f87171',
            brightGreen: '#4ade80',
            brightYellow: '#fbbf24',
            brightBlue: '#60a5fa',
            brightMagenta: '#c4b5fd',
            brightCyan: '#a5f3fc',
            brightWhite: '#f9fafb',
          },
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        const linkProvider = term.registerLinkProvider(createTerminalLinkProvider(term, openBrowserPreview));
        terminalsRef.current.set(inst.id, term);
        fitAddonsRef.current.set(inst.id, fitAddon);
        linkProvidersRef.current.set(inst.id, linkProvider);

        const createdTerm = term;
        createdTerm.attachCustomKeyEventHandler((event) => {
          const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c';
          if (isCopy && createdTerm.hasSelection()) {
            const selection = createdTerm.getSelection();
            if (selection) navigator.clipboard?.writeText(selection).catch(() => {});
            return false;
          }
          return true;
        });

        term.onData((data) => {
          shell.sendData(inst.id, data);
        });
      }

      if (!host.hasChildNodes()) {
        term.open(host);
      }

      if (inst.id === activeInst?.id) {
        fitAddon.fit();
        shell.resizeShell(inst.id, term.cols, term.rows);
        shell.requestCwd(inst.id);
      }
    });

    window.addEventListener('resize', handleWindowResize);
    handleWindowResize();

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [activeInst?.id, state.terminalOpen, state.terminalHeight, state.terminalInstances]);

  const closeTerminal = (id: string) => {
    shell.closeShell(id);
    terminalsRef.current.get(id)?.dispose();
    terminalsRef.current.delete(id);
    fitAddonsRef.current.delete(id);
    linkProvidersRef.current.get(id)?.dispose();
    linkProvidersRef.current.delete(id);
    setDetectedLinks(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    removeTerminalInstance(id);
  };

  const openExternalUrl = (url: string) => {
    const electronApi = (window as any).electronAPI;
    if (electronApi?.openExternal) {
      electronApi.openExternal(url).catch(() => {});
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shortCwd = (cwd: string) => cwd;

  if (!state.terminalOpen || state.terminalInstances.length === 0) return null;

  return (
    <div className="terminal-panel" style={{ height: state.terminalHeight }}>
      <div className="terminal-resizer" ref={resizeRef} />
      <div className="terminal-header">
        <div className="terminal-header-left">
          <TermIcon size={13} className="term-icon" />
          <div className="terminal-tabs">
            {state.terminalInstances.map(inst => (
              <div
                key={inst.id}
                className={`term-tab ${inst.id === state.activeTerminalId ? 'active' : ''}`}
                onClick={() => setActiveTerminal(inst.id)}
              >
                <span className="term-tab-name">{inst.name}</span>
                <button className="term-tab-close" onClick={e => { e.stopPropagation(); closeTerminal(inst.id); }} title="Close terminal">
                  <X size={12} />
                </button>
              </div>
            ))}
            <button className="term-tab-add" onClick={addNewTerminal} title="New terminal">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="terminal-header-right">
          {activeInst && (
            <>
              <button className="term-action" onClick={() => shell.connectShell(activeInst.id, state.workspaceDir)} title="Reconnect">
                <TermIcon size={13} />
              </button>
            </>
          )}
          <button className="term-action" onClick={toggleTerminal} title="Close panel">
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="terminal-body">
        {state.terminalInstances.map(inst => (
          <div
            key={inst.id}
            className={`terminal-instance ${inst.id === state.activeTerminalId ? 'terminal-instance-active' : ''}`}
          >
            <div className="term-status-row">
              <span className="term-cwd">{shortCwd(inst.cwd || tt('term.placeholder'))}</span>
              {(detectedLinks[inst.id]?.length ?? 0) > 0 && (
                <div className="term-links-list">
                  {detectedLinks[inst.id].map(url => (
                    <button
                      key={url}
                      type="button"
                      className="term-link-chip"
                      onClick={() => openBrowserPreview(url)}
                      onAuxClick={(event) => {
                        if (event.button === 1) openExternalUrl(url);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openExternalUrl(url);
                      }}
                      title={url}
                    >
                      {url}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div
              ref={(el) => {
                if (el) hostRefs.current.set(inst.id, el);
                else hostRefs.current.delete(inst.id);
              }}
              className="xterm-host"
            />
          </div>
        ))}
      </div>
    </div>
  );
}


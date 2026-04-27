import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch, Minus, Plus, RefreshCw, RotateCcw, X } from 'lucide-react';
import { useEditor } from '../../store/EditorContext';
import type { FileNode } from '../../types';
import { fetchGitStatus, gitStage, gitUnstage, gitDiscard, gitCommit, type GitStatusResponse, type GitFileEntry } from '../../utils/api';
import { useT } from '../../hooks/useT';
import { useHorizontalResize } from '../../hooks/useHorizontalResize';
import './SourceControl.css';

function statusLabel(status: GitFileEntry['status']): string {
  switch (status) {
    case 'added': return 'A';
    case 'modified': return 'M';
    case 'deleted': return 'D';
    case 'untracked': return 'U';
  }
}

export default function SourceControl() {
  const { state, openFile, toggleSourceControl, addToast, setSidebarWidth } = useEditor();
  const tt = useT();
  const resizerRef = useHorizontalResize(state.sidebarWidth, setSidebarWidth);
  const [status, setStatus] = useState<GitStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!state.workspaceDir) return;
    setLoading(true);
    try {
      const data = await fetchGitStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }, [state.workspaceDir]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleStage = useCallback(async (paths?: string[]) => {
    try {
      await gitStage(paths);
      await refresh();
    } catch (err: any) {
      addToast(tt('sc.stageFailed') + (err?.message || ''), 'error');
    }
  }, [refresh, addToast, tt]);

  const handleUnstage = useCallback(async (paths?: string[]) => {
    try {
      await gitUnstage(paths);
      await refresh();
    } catch (err: any) {
      addToast(tt('sc.unstageFailed') + (err?.message || ''), 'error');
    }
  }, [refresh, addToast, tt]);

  const handleDiscard = useCallback(async (paths: string[]) => {
    try {
      await gitDiscard(paths);
      await refresh();
    } catch (err: any) {
      addToast(tt('sc.discardFailed') + (err?.message || ''), 'error');
    }
  }, [refresh, addToast, tt]);

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    try {
      await gitCommit(commitMsg.trim());
      setCommitMsg('');
      addToast(tt('sc.committed'), 'success');
      await refresh();
    } catch (err: any) {
      addToast(tt('sc.commitFailed') + (err?.message || ''), 'error');
    }
    setCommitting(false);
  }, [commitMsg, refresh, addToast, tt]);

  const handleFileClick = useCallback((filePath: string) => {
    const node = findNodeByPath(state.files, filePath);
    if (node) openFile(node);
  }, [state.files, openFile]);

  if (!state.showSourceControl) return null;

  const totalChanges = (status?.staged.length || 0) + (status?.unstaged.length || 0) + (status?.untracked.length || 0);

  const renderSection = (
    key: string,
    title: string,
    items: GitFileEntry[],
    actions: (item: GitFileEntry) => React.ReactNode,
    bulkAction?: () => void,
    bulkIcon?: React.ReactNode,
  ) => {
    if (items.length === 0) return null;
    const collapsed = collapsedSections.has(key);
    return (
      <div className="sc-section">
        <div className="sc-section-head" onClick={() => toggleSection(key)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            {title}
            <span className="sc-section-count">{items.length}</span>
          </span>
          <div className="sc-section-actions">
            {bulkAction && (
              <button className="sc-icon-btn" title={tt('sc.stageAll')} onClick={(e) => { e.stopPropagation(); bulkAction(); }}>
                {bulkIcon || <Plus size={14} />}
              </button>
            )}
          </div>
        </div>
        {!collapsed && items.map(item => (
          <div key={item.path} className="sc-file-item" onClick={() => handleFileClick(item.path)}>
            <span className={`sc-file-status ${item.status}`}>{statusLabel(item.status)}</span>
            <span className="sc-file-name">{item.path}</span>
            <div className="sc-file-actions">{actions(item)}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="source-control-panel" style={{ width: state.sidebarWidth }}>
      <div className="sc-head">
        <span className="sc-title">
          <GitBranch size={14} />
          {tt('sc.title')}
          {totalChanges > 0 && <span className="sc-badge">{totalChanges}</span>}
        </span>
        <div className="sc-head-actions">
          <button className="sc-icon-btn" title={tt('sc.refresh')} onClick={refresh} disabled={loading}>
            <RefreshCw size={14} />
          </button>
          <button className="sc-close-btn" onClick={toggleSourceControl}>
            <X size={14} />
          </button>
        </div>
      </div>

      {!status?.isRepo ? (
        <div className="sc-no-repo">{tt('sc.noRepo')}</div>
      ) : (
        <>
          {status.branch && (
            <div className="sc-branch-label">
              <GitBranch size={12} />
              {status.branch}
            </div>
          )}
          <div className="sc-commit-area">
            <textarea
              className="sc-commit-input"
              placeholder={tt('sc.commitPlaceholder')}
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleCommit();
              }}
              rows={1}
            />
            <button
              className="sc-commit-btn"
              onClick={handleCommit}
              disabled={committing || !commitMsg.trim() || status.staged.length === 0}
            >
              {tt('sc.commit')}
            </button>
          </div>
          <div className="sc-body">
            {renderSection(
              'staged',
              tt('sc.stagedChanges'),
              status.staged,
              (item) => (
                <>
                  <button className="sc-icon-btn" title={tt('sc.unstage')} onClick={(e) => { e.stopPropagation(); handleUnstage([item.path]); }}>
                    <Minus size={14} />
                  </button>
                </>
              ),
              () => handleUnstage(),
              <Minus size={14} />,
            )}
            {renderSection(
              'unstaged',
              tt('sc.changes'),
              status.unstaged,
              (item) => (
                <>
                  <button className="sc-icon-btn" title={tt('sc.discard')} onClick={(e) => { e.stopPropagation(); handleDiscard([item.path]); }}>
                    <RotateCcw size={14} />
                  </button>
                  <button className="sc-icon-btn" title={tt('sc.stage')} onClick={(e) => { e.stopPropagation(); handleStage([item.path]); }}>
                    <Plus size={14} />
                  </button>
                </>
              ),
              () => handleStage(status.unstaged.map(i => i.path)),
              <Plus size={14} />,
            )}
            {renderSection(
              'untracked',
              tt('sc.untracked'),
              status.untracked,
              (item) => (
                <button className="sc-icon-btn" title={tt('sc.stage')} onClick={(e) => { e.stopPropagation(); handleStage([item.path]); }}>
                  <Plus size={14} />
                </button>
              ),
              () => handleStage(status.untracked.map(i => i.path)),
              <Plus size={14} />,
            )}
            {totalChanges === 0 && (
              <div className="sc-empty">{tt('sc.noChanges')}</div>
            )}
          </div>
        </>
      )}
      <div className="source-control-resizer" ref={resizerRef} />
    </div>
  );
}

function findNodeByPath(nodes: FileNode[], serverPath: string): FileNode | null {
  for (const node of nodes) {
    if (node.serverPath === serverPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, serverPath);
      if (found) return found;
    }
  }
  return null;
}

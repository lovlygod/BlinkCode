import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Download, GitBranch, Minus, Plus, RefreshCw, RotateCcw, Upload, X } from 'lucide-react';
import { useEditor } from '../../store/EditorContext';
import type { FileNode } from '../../types';
import { fetchGitStatus, fetchGitFileDiff, fetchGitInlineDiff, gitStage, gitUnstage, gitDiscard, gitCommit, gitPull, gitPush, type GitStatusResponse, type GitFileEntry } from '../../utils/api';
import { useT } from '../../hooks/useT';
import { useHorizontalResize } from '../../hooks/useHorizontalResize';
import { getMonacoLanguage } from '../../utils/supportedWebFiles';
import './SourceControl.css';

function statusLabel(status: GitFileEntry['status']): string {
  switch (status) {
    case 'added': return 'A';
    case 'modified': return 'M';
    case 'deleted': return 'D';
    case 'untracked': return 'U';
  }
}

function formatDiscardConfirmMessage(paths: string[], tt: (key: string, args?: Record<string, string | number>) => string): string {
  if (paths.length === 1) {
    return tt('sc.discardConfirmOne', { path: paths[0] });
  }

  return tt('sc.discardConfirmMany', { count: paths.length });
}

function formatGitActionError(action: 'commit' | 'pull' | 'push', err: unknown, tt: (key: string, args?: Record<string, string | number>) => string): string {
  const raw = String((err as any)?.message || '').toLowerCase();

  if (action === 'commit' && raw.includes('author identity unknown')) {
    return tt('sc.commitIdentityHint');
  }
  if (action === 'pull' && raw.includes('couldn\'t find remote ref')) {
    return tt('sc.pullRemoteBranchMissing');
  }
  if (action === 'pull' && raw.includes('there is no tracking information')) {
    return tt('sc.pullTrackingMissing');
  }
  if (action === 'push' && raw.includes('has no upstream branch')) {
    return tt('sc.pushUpstreamMissing');
  }
  if (action === 'push' && raw.includes('non-fast-forward')) {
    return tt('sc.pushNonFastForward');
  }
  if (raw.includes('authentication failed') || raw.includes('permission denied') || raw.includes('could not read username')) {
    return tt('sc.authFailed');
  }

  return (err as any)?.message || tt('sc.unknownGitError');
}

export default function SourceControl() {
  const { state, openDiffPreview, toggleSourceControl, addToast, setSidebarWidth } = useEditor();
  const tt = useT();
  const resizerRef = useHorizontalResize(state.sidebarWidth, setSidebarWidth);
  const [status, setStatus] = useState<GitStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [remoteAction, setRemoteAction] = useState<'pull' | 'push' | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [discardPaths, setDiscardPaths] = useState<string[] | null>(null);

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
    if (paths.length === 0) return;

    setDiscardPaths(paths);
  }, []);

  const confirmDiscard = useCallback(async () => {
    if (!discardPaths || discardPaths.length === 0) return;

    try {
      await gitDiscard(discardPaths);
      setDiscardPaths(null);
      await refresh();
    } catch (err: any) {
      addToast(tt('sc.discardFailed') + (err?.message || ''), 'error');
    }
  }, [discardPaths, refresh, addToast, tt]);

  const cancelDiscard = useCallback(() => {
    setDiscardPaths(null);
  }, []);

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    try {
      await gitCommit(commitMsg.trim());
      setCommitMsg('');
      addToast(tt('sc.committed'), 'success');
      await refresh();
    } catch (err: any) {
      addToast(tt('sc.commitFailed') + formatGitActionError('commit', err, tt), 'error');
    }
    setCommitting(false);
  }, [commitMsg, refresh, addToast, tt]);

  const handlePull = useCallback(async () => {
    setRemoteAction('pull');
    try {
      await gitPull();
      addToast(tt('sc.pullSuccess'), 'success');
      await refresh();
    } catch (err: any) {
      addToast(tt('sc.pullFailed') + formatGitActionError('pull', err, tt), 'error');
    } finally {
      setRemoteAction(null);
    }
  }, [refresh, addToast, tt]);

  const handlePush = useCallback(async () => {
    setRemoteAction('push');
    try {
      await gitPush();
      addToast(tt('sc.pushSuccess'), 'success');
      await refresh();
    } catch (err: any) {
      addToast(tt('sc.pushFailed') + formatGitActionError('push', err, tt), 'error');
    } finally {
      setRemoteAction(null);
    }
  }, [refresh, addToast, tt]);

  const handleFileClick = useCallback(async (item: GitFileEntry, staged: boolean) => {
    try {
      const diff = await fetchGitFileDiff(item.path, staged, item.status);
      const inline = await fetchGitInlineDiff(item.path, staged, item.status);
      const name = item.path.split('/').pop() || item.path;
      const node: FileNode = {
        id: `git-diff:${staged ? 'staged' : 'unstaged'}:${item.path}`,
        name: `${name} (diff)`,
        type: 'file',
        serverPath: `__git_diff__/${staged ? 'staged' : 'unstaged'}/${item.path}`,
        language: getMonacoLanguage(name),
        content: diff.modified,
        dirty: false,
        diffOriginalContent: diff.original,
        diffModifiedContent: diff.modified,
        diffHunks: inline.hunks,
      };
      openDiffPreview(node);
    } catch (err: any) {
      addToast(tt('sc.diffFailed') + (err?.message || ''), 'error');
    }
  }, [openDiffPreview, addToast, tt]);

  if (!state.showSourceControl) return null;

  const totalChanges = (status?.staged.length || 0) + (status?.unstaged.length || 0) + (status?.untracked.length || 0);

  const renderSection = (
    key: string,
    title: string,
    items: GitFileEntry[],
    actions: (item: GitFileEntry) => React.ReactNode,
    staged: boolean,
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
          <div key={item.path} className="sc-file-item" onClick={() => handleFileClick(item, staged)}>
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
      {discardPaths && (
        <div className="sc-modal-backdrop" role="presentation" onMouseDown={cancelDiscard}>
          <div className="sc-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="sc-discard-title" onMouseDown={e => e.stopPropagation()}>
            <div className="sc-confirm-content">
              <div className="sc-confirm-heading">
                <span className="sc-confirm-icon">
                  <AlertTriangle size={14} />
                </span>
                <div id="sc-discard-title" className="sc-confirm-title">{tt('sc.discardConfirmTitle')}</div>
              </div>
              <div className="sc-confirm-message">{formatDiscardConfirmMessage(discardPaths, tt)}</div>
              {discardPaths.length === 1 && <div className="sc-confirm-path">{discardPaths[0]}</div>}
              <div className="sc-confirm-actions">
                <button className="sc-confirm-cancel" onClick={cancelDiscard}>{tt('common.cancel')}</button>
                <button className="sc-confirm-danger" onClick={confirmDiscard}>{tt('sc.discardConfirmAction')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="sc-head">
        <span className="sc-title">
          <GitBranch size={14} />
          {tt('sc.title')}
          {totalChanges > 0 && <span className="sc-badge">{totalChanges}</span>}
        </span>
        <div className="sc-head-actions">
          <button className="sc-icon-btn" title={tt('sc.pull')} onClick={handlePull} disabled={loading || remoteAction !== null}>
            <Download size={14} />
          </button>
          <button className="sc-icon-btn" title={tt('sc.push')} onClick={handlePush} disabled={loading || remoteAction !== null}>
            <Upload size={14} />
          </button>
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
              true,
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
              false,
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
              false,
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

import type { FileNode, SavedEditorState, EditorSettings } from '../types';
import { getLanguageFromFileName } from './fileIcons';
import { v4 as uuid } from 'uuid';

const API = '/api';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);
const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico',
  'mp3', 'wav', 'ogg', 'flac', 'aac',
  'mp4', 'avi', 'mkv', 'mov', 'webm',
  'zip', 'rar', 'gz', 'tar', '7z', 'bz2',
  'wasm', 'bin', 'exe', 'dll', 'so', 'dylib',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'sqlite', 'db',
]);

function isBinary(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith('.db-shm') || lower.endsWith('.db-wal') || lower.endsWith('.sqlite-shm') || lower.endsWith('.sqlite-wal')) {
    return true;
  }
  const ext = lower.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTS.has(ext);
}

export function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTS.has(ext);
}

export function getRawFileUrl(serverPath: string): string {
  return `${API}/raw?path=${encodeURIComponent(serverPath)}`;
}

async function request(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {}

  if (!res.ok) {
    const serverMessage = data?.error || data?.message || raw;
    const suffix = serverMessage ? ` - ${String(serverMessage).trim()}` : '';
    throw new Error(`API error: ${res.status}${suffix}`);
  }

  return data ?? {};
}

interface ServerTreeItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  children?: ServerTreeItem[];
}

function serverTreeToLocal(items: ServerTreeItem[], depth = 0): FileNode[] {
  return items.map(item => {
    const node: FileNode = {
      id: uuid(),
      name: item.name,
      type: item.type,
      language: item.type === 'file' ? getLanguageFromFileName(item.name) : undefined,
      isExpanded: false,
      children: item.children ? serverTreeToLocal(item.children, depth + 1) : undefined,
      content: undefined,
      serverPath: item.path,
      binary: item.type === 'file' ? isBinary(item.name) : undefined,
      size: item.type === 'file' ? item.size : undefined,
    };
    return node;
  });
}

export async function fetchTree(): Promise<{ files: FileNode[]; workspaceName: string }> {
  const data = await request(`${API}/tree`);
  return {
    files: serverTreeToLocal(data.tree || []),
    workspaceName: data.workspace || 'workspace',
  };
}

export async function fetchFileContent(serverPath: string, binary?: boolean): Promise<string> {
  if (binary) return '';
  const data = await request(`${API}/file?path=${encodeURIComponent(serverPath)}`);
  return data.content || '';
}

export async function saveFile(serverPath: string, content: string): Promise<void> {
  await request(`${API}/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: serverPath, content }),
  });
}

export async function createFileOnServer(serverPath: string, type: 'file' | 'folder'): Promise<void> {
  await request(`${API}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: serverPath, type }),
  });
}

export async function deleteOnServer(serverPath: string): Promise<void> {
  await request(`${API}/delete?path=${encodeURIComponent(serverPath)}`, { method: 'DELETE' });
}

export async function renameOnServer(oldPath: string, newName: string): Promise<{ newPath: string }> {
  const data = await request(`${API}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newName }),
  });
  return { newPath: data.newPath };
}

export async function moveOnServer(sourcePath: string, targetPath: string | null, position: string): Promise<{ newPath: string }> {
  const data = await request(`${API}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, targetPath, position }),
  });
  return { newPath: data.newPath };
}

export async function uploadFolder(name: string, files: { path: string; type: string; content?: string }[]): Promise<{ files: FileNode[]; workspaceName: string }> {
  const data = await request(`${API}/upload-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, files }),
  });
  return {
    files: serverTreeToLocal(data.tree || []),
    workspaceName: data.workspace || name,
  };
}

export async function openFolderOnServer(dirPath: string): Promise<{ files: FileNode[]; workspaceName: string }> {
  const data = await request(`${API}/open-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dirPath }),
  });
  return {
    files: serverTreeToLocal(data.tree || []),
    workspaceName: data.workspace || pathBasename(dirPath),
  };
}

function pathBasename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'workspace';
}

export function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/terminal`;
}

export function getFsWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/fs`;
}

export async function fetchState(): Promise<SavedEditorState> {
  return request(`${API}/state`);
}

export async function saveStateToServer(data: SavedEditorState): Promise<void> {
  await request(`${API}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function closeWorkspace(): Promise<void> {
  await request(`${API}/close-workspace`, { method: 'POST' });
}

export async function fetchRecentProjects(): Promise<Array<{ path: string; name: string }>> {
  const data = await request(`${API}/recent-projects`);
  return Array.isArray(data.projects) ? data.projects : [];
}

export interface WorkspaceSearchOptions {
  query: string;
  replacement?: string;
  regex?: boolean;
  matchCase?: boolean;
  wholeWord?: boolean;
  include?: string;
  exclude?: string;
}

export interface WorkspaceSearchMatch {
  line: number;
  column: number;
  length: number;
  preview: string;
}

export interface WorkspaceSearchFileResult {
  path: string;
  matches: WorkspaceSearchMatch[];
}

export interface WorkspaceSearchResponse {
  results: WorkspaceSearchFileResult[];
  totalMatches: number;
  truncated: boolean;
}

export async function searchWorkspace(options: WorkspaceSearchOptions): Promise<WorkspaceSearchResponse> {
  return request(`${API}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
}

export async function replaceWorkspace(options: WorkspaceSearchOptions): Promise<{ changedFiles: Array<{ path: string; replacements: number }>; totalReplacements: number }> {
  return request(`${API}/search/replace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
}

export interface SettingsResponse {
  defaults: EditorSettings;
  global: Partial<EditorSettings>;
  workspace: Partial<EditorSettings>;
  merged: EditorSettings;
  globalPath: string;
  workspacePath: string | null;
}

export async function fetchSettings(): Promise<SettingsResponse> {
  return request(`${API}/settings`);
}

export async function saveSettingsToServer(
  settings: Partial<EditorSettings>,
  scope: 'global' | 'workspace' = 'global',
): Promise<void> {
  await request(`${API}/settings?scope=${scope}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export async function fetchSettingsRaw(
  scope: 'global' | 'workspace' = 'global',
): Promise<{ content: string; path: string }> {
  return request(`${API}/settings/raw?scope=${scope}`);
}

export async function saveSettingsRaw(
  content: string,
  scope: 'global' | 'workspace' = 'global',
): Promise<void> {
  await request(`${API}/settings/raw?scope=${scope}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export interface GitFileEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'untracked';
}

export interface GitStatusResponse {
  isRepo: boolean;
  branch: string | null;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
}

export interface GitFileDiffResponse {
  path: string;
  original: string;
  modified: string;
  staged: boolean;
  status: GitFileEntry['status'];
}

export async function fetchGitStatus(): Promise<GitStatusResponse> {
  return request(`${API}/git/status`);
}

export async function gitStage(paths?: string[]): Promise<void> {
  await request(`${API}/git/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths: paths || null }),
  });
}

export async function gitUnstage(paths?: string[]): Promise<void> {
  await request(`${API}/git/unstage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths: paths || null }),
  });
}

export async function gitDiscard(paths: string[]): Promise<void> {
  await request(`${API}/git/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  });
}

export async function fetchGitFileDiff(path: string, staged: boolean, status: GitFileEntry['status']): Promise<GitFileDiffResponse> {
  const params = new URLSearchParams({ path, staged: String(staged), status });
  return request(`${API}/git/file-diff?${params.toString()}`);
}

export async function gitCommit(message: string): Promise<{ output: string }> {
  return request(`${API}/git/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
}

export async function gitPull(): Promise<{ output: string }> {
  return request(`${API}/git/pull`, { method: 'POST' });
}

export async function gitPush(): Promise<{ output: string }> {
  return request(`${API}/git/push`, { method: 'POST' });
}

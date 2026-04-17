import type { FileNode, SavedEditorState } from '../types';
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
  const ext = name.split('.').pop()?.toLowerCase() || '';
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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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

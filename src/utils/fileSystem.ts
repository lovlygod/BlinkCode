import { uploadFolder } from './api';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.nuxt', '__pycache__', '.cache', '.vs', '.idea', 'venv', '.venv']);
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db']);
const MAX_DEPTH = 8;

const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'bmp', 'svg',
  'mp3', 'wav', 'ogg', 'flac', 'aac',
  'mp4', 'avi', 'mkv', 'mov', 'webm',
  'zip', 'rar', 'gz', 'tar', '7z', 'bz2',
  'wasm', 'bin', 'exe', 'dll', 'so', 'dylib',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'sqlite', 'db',
]);

function isBinaryFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTS.has(ext);
}

async function readFileContent(handle: FileSystemFileHandle, name: string): Promise<string | undefined> {
  try {
    const file = await handle.getFile();
    if (isBinaryFile(name)) {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return `base64:${b64}`;
    }
    const text = await file.text();
    if (text.length > 500000) return text.slice(0, 500000) + '\n// ... file truncated';
    return text;
  } catch {
    return undefined;
  }
}

export interface UploadItem {
  path: string;
  type: 'file' | 'folder';
  content?: string;
}

export async function collectForUpload(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  depth: number
): Promise<UploadItem[]> {
  if (depth >= MAX_DEPTH) return [];
  const items: UploadItem[] = [];

  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    if (name.startsWith('.') && name !== '.env' && name !== '.gitignore') continue;

    const itemPath = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === 'directory') {
      items.push({ path: itemPath, type: 'folder' });
      const childItems = await collectForUpload(handle, itemPath, depth + 1);
      items.push(...childItems);
    } else {
      const content = await readFileContent(handle, name);
      items.push({ path: itemPath, type: 'file', content });
    }
  }

  return items;
}

export { uploadFolder };

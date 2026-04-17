const SUPPORTED_EXTENSIONS = new Set([
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'mjs',
  'cjs',
  'ts',
  'jsx',
  'tsx',
  'vue',
  'json',
  'jsonc',
  'yaml',
  'yml',
  'toml',
  'md',
  'mdx',
  'mdown',
  'markdown',
  'txt',
  'xml',
  'ini',
  'conf',
  'log',
  'svg',
  'sql',
  'graphql',
  'gql',
  'sh',
  'ps1',
  'csv',
]);

const SUPPORTED_FILE_NAMES = new Set([
  '.gitignore',
  '.gitmodules',
  '.npmignore',
  '.dockerignore',
  '.editorconfig',
  '.prettierignore',
  '.prettierrc',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js',
  'webpack.config.ts',
  'postcss.config.js',
  'postcss.config.cjs',
  'tailwind.config.js',
  'tailwind.config.ts',
  'next.config.js',
  'next.config.mjs',
  'nuxt.config.ts',
  'svelte.config.js',
  'astro.config.mjs',
  'tsconfig.json',
  'jsconfig.json',
  'license',
  'dockerfile',
]);

const MONACO_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  mdx: 'markdown',
  mdown: 'markdown',
  markdown: 'markdown',
  txt: 'plaintext',
  xml: 'xml',
  ini: 'ini',
  conf: 'ini',
  log: 'plaintext',
  svg: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  vue: 'html',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  sh: 'shell',
  ps1: 'powershell',
  csv: 'plaintext',
};

function normalizeFileName(fileName: string): string {
  return fileName.trim().split('/').pop()?.split('\\').pop()?.toLowerCase() || '';
}

function getExtension(fileName: string): string {
  const normalized = normalizeFileName(fileName);
  if (!normalized || !normalized.includes('.') || normalized.startsWith('.')) return '';
  return normalized.split('.').pop() || '';
}

function isEnvFile(fileName: string): boolean {
  const normalized = normalizeFileName(fileName);
  return normalized === '.env' || normalized.startsWith('.env.') || normalized === '.env.example' || normalized.endsWith('.env.example');
}

export function isSupportedWebFile(fileName: string): boolean {
  const normalized = normalizeFileName(fileName);

  if (!normalized) return false;
  if (SUPPORTED_FILE_NAMES.has(normalized)) return true;
  if (isEnvFile(normalized)) return true;

  const extension = getExtension(normalized);
  return SUPPORTED_EXTENSIONS.has(extension);
}

export function getFileSupportInfo(fileName: string): { supported: boolean; reason?: string } {
  if (isSupportedWebFile(fileName)) {
    return { supported: true };
  }

  const normalized = normalizeFileName(fileName);
  const extension = getExtension(normalized);

  if (!extension) {
    return {
      supported: false,
      reason: 'unsupported-name',
    };
  }

  return {
    supported: false,
    reason: 'unsupported-extension',
  };
}

export type FileSupportMode = 'editable' | 'readonly' | 'preview' | 'blocked';
export type FileSupportKind = 'code' | 'config' | 'document' | 'image' | 'binary' | 'font' | 'archive' | 'media' | 'generated' | 'large' | 'unknown';

export function getDetailedFileSupportInfo(fileName: string, options?: { binary?: boolean; size?: number }) {
  const normalized = normalizeFileName(fileName);
  const extension = getExtension(normalized);
  const size = options?.size ?? 0;
  const binary = !!options?.binary;

  const generatedNames = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
  const archiveExts = new Set(['zip', 'rar', 'gz', 'tar', '7z', 'bz2']);
  const fontExts = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot']);
  const mediaExts = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'mp4', 'avi', 'mkv', 'mov', 'webm']);
  const documentExts = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
  const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);
  const LARGE_FILE_LIMIT = 1024 * 1024 * 2;

  if (size > LARGE_FILE_LIMIT) {
    return {
      supported: false,
      mode: 'readonly' as FileSupportMode,
      kind: 'large' as FileSupportKind,
      badge: 'large file',
      messageKey: 'preview.largeFile',
    };
  }

  if (generatedNames.has(normalized)) {
    return {
      supported: true,
      mode: 'readonly' as FileSupportMode,
      kind: 'generated' as FileSupportKind,
      badge: 'generated',
      messageKey: 'preview.generatedFile',
    };
  }

  if (isSupportedWebFile(fileName)) {
    return {
      supported: true,
      mode: 'editable' as FileSupportMode,
      kind: extension === 'json' || extension === 'yaml' || extension === 'yml' || extension === 'toml' ? 'config' as FileSupportKind : 'code' as FileSupportKind,
      badge: undefined,
      messageKey: undefined,
    };
  }

  if (imageExts.has(extension)) {
    return {
      supported: false,
      mode: extension === 'svg' ? 'readonly' as FileSupportMode : 'preview' as FileSupportMode,
      kind: 'image' as FileSupportKind,
      badge: extension === 'svg' ? 'read-only' : 'preview',
      messageKey: extension === 'svg' ? 'preview.readOnlyTextFile' : 'preview.imagePreview',
    };
  }

  if (archiveExts.has(extension)) {
    return {
      supported: false,
      mode: 'blocked' as FileSupportMode,
      kind: 'archive' as FileSupportKind,
      badge: 'archive',
      messageKey: 'preview.archiveFile',
    };
  }

  if (fontExts.has(extension)) {
    return {
      supported: false,
      mode: 'blocked' as FileSupportMode,
      kind: 'font' as FileSupportKind,
      badge: 'font',
      messageKey: 'preview.fontFile',
    };
  }

  if (documentExts.has(extension)) {
    return {
      supported: false,
      mode: 'blocked' as FileSupportMode,
      kind: 'document' as FileSupportKind,
      badge: 'document',
      messageKey: 'preview.documentFile',
    };
  }

  if (mediaExts.has(extension)) {
    return {
      supported: false,
      mode: 'blocked' as FileSupportMode,
      kind: 'media' as FileSupportKind,
      badge: 'media',
      messageKey: 'preview.mediaFile',
    };
  }

  if (binary) {
    return {
      supported: false,
      mode: 'blocked' as FileSupportMode,
      kind: 'binary' as FileSupportKind,
      badge: 'binary',
      messageKey: 'preview.binaryBlocked',
    };
  }

  return {
    supported: false,
    mode: 'readonly' as FileSupportMode,
    kind: 'unknown' as FileSupportKind,
    badge: 'read-only',
    messageKey: 'preview.readOnlyTextFile',
  };
}

export function getMonacoLanguage(fileName: string): string {
  const normalized = normalizeFileName(fileName);

  if (isEnvFile(normalized)) return 'shell';
  if (normalized === '.gitignore' || normalized === '.gitmodules' || normalized === '.npmignore' || normalized === '.prettierignore' || normalized === '.dockerignore') return 'plaintext';
  if (normalized === '.editorconfig') return 'ini';
  if (normalized === '.prettierrc' || normalized === '.eslintrc') return 'json';
  if (normalized === 'dockerfile') return 'dockerfile';

  const extension = getExtension(normalized);
  return MONACO_LANGUAGE_BY_EXTENSION[extension] || 'plaintext';
}

export const SUPPORTED_WEB_FILE_EXAMPLES = [
  'HTML',
  'CSS',
  'JavaScript',
  'TypeScript',
  'JSX',
  'TSX',
  'Vue',
  'JSON',
  'Markdown',
  'web config files',
];

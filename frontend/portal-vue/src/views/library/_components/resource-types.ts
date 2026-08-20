// 资源类型元数据（对齐原 React 版 lib/resource-type-constants）。
// Vue 门户无 Tailwind/lucide，改用十六进制色值与 Element Plus 样式。

export const TYPE_COLORS: Record<string, string> = {
  document: '#f97316',
  spreadsheet: '#22c55e',
  image: '#a855f7',
  link: '#06b6d4',
  audio: '#ec4899',
  video: '#3b82f6',
  archive: '#64748b',
  venue: '#ef4444',
  facility: '#6366f1',
  software: '#14b8a6',
  other: '#78716c'
};

// 对应 React 的 tailwind bg-*-50 浅色底（统计卡片/图标底色用）
export const TYPE_BG: Record<string, string> = {
  document: '#fff7ed',
  spreadsheet: '#ecfdf5',
  image: '#faf5ff',
  link: '#ecfeff',
  audio: '#fdf2f8',
  video: '#eff6ff',
  archive: '#f8fafc',
  venue: '#fef2f2',
  facility: '#eef2ff',
  software: '#f0fdfa',
  other: '#fafaf9'
};

/** 支持本地上传文件的资源类型（其余类型仅 URL/描述） */
export const fileTypesWithUpload = [
  'document',
  'spreadsheet',
  'image',
  'audio',
  'video',
  'archive',
  'software',
  'other'
];

export const RESOURCE_MAX_FILE_SIZE = 10 * 1024 * 1024; // 对齐后端单文件 ≤10MB

// 与 kkFileView 4.4.0 支持格式对齐（后端 /uploads 直出白名单同源）
const DOCUMENT_EXTS = [
  'pdf', 'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'wps', 'wpt', 'rtf',
  'odt', 'ott', 'fodt', 'pages', 'ppt', 'pptx', 'dps', 'odp', 'otp', 'sxi',
  'vsd', 'vsdx', 'txt', 'md', 'log', 'json', 'properties', 'yaml', 'yml',
  'gitignore', 'xml', 'xbrl', 'html', 'htm', 'java', 'py', 'c', 'cpp', 'h',
  'php', 'go', 'js', 'css', 'lua', 'sh', 'rb', 'sql', 'bat', 'm', 'bas',
  'prg', 'cmd', 'cs', 'ftl', 'asp', 'jsp', 'aspx', 'ofd', 'epub', 'eml',
  'xmind', 'drawio', 'bpmn', 'dcm', 'dwg', 'dxf', 'dwf', 'dwfx', 'dwt',
  'dng', 'cf2', 'plt', 'stl', 'obj', '3ds', 'ply', 'off', '3dm', 'fbx',
  'dae', 'wrl', '3mf', 'glb', 'gltf', 'o3dv', 'stp', 'step', 'iges', 'igs',
  'brep', 'bim', 'fcstd', 'ifc'
];

const SPREADSHEET_EXTS = [
  'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'xlam', 'xla', 'et', 'ett',
  'ods', 'ots', 'csv', 'tsv'
];

const IMAGE_EXTS = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'jfif', 'svg', 'tif',
  'tiff', 'tga', 'psd', 'eps', 'wmf', 'emf'
];

const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'];

const VIDEO_EXTS = [
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'mpeg', '3gp', 'rm',
  'mpd', 'm3u8', 'ts'
];

const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'jar', 'gzip'];

const SOFTWARE_EXTS = ['exe', 'dmg', 'pkg', 'deb', 'rpm', 'zip', 'msi', 'apk'];

export const resourceTypeExtensionMap: Record<string, string[]> = {
  document: DOCUMENT_EXTS,
  spreadsheet: SPREADSHEET_EXTS,
  image: IMAGE_EXTS,
  audio: AUDIO_EXTS,
  video: VIDEO_EXTS,
  archive: ARCHIVE_EXTS,
  software: SOFTWARE_EXTS,
  other: [],
  link: [],
  venue: [],
  facility: []
};

export const resourceTypeAccept: Record<string, string> = {
  document: DOCUMENT_EXTS.map((e) => `.${e}`).join(','),
  spreadsheet: SPREADSHEET_EXTS.map((e) => `.${e}`).join(','),
  image: IMAGE_EXTS.map((e) => `.${e}`).join(','),
  audio: AUDIO_EXTS.map((e) => `.${e}`).join(','),
  video: VIDEO_EXTS.map((e) => `.${e}`).join(','),
  archive: ARCHIVE_EXTS.map((e) => `.${e}`).join(','),
  software: SOFTWARE_EXTS.map((e) => `.${e}`).join(','),
  other: '',
  link: '',
  venue: '',
  facility: ''
};

/** 校验资源文件（大小 + 扩展名），返回错误文案或 null（对齐 React validateResourceFile） */
export function validateResourceFile(file: File, type: string): string | null {
  if (file.size > RESOURCE_MAX_FILE_SIZE) return '文件大小超过 10MB';
  const allowed = resourceTypeExtensionMap[type] || [];
  if (allowed.length === 0) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowed.includes(ext)) {
    return `不支持的文件格式，请上传 ${allowed.map((e) => `.${e}`).join('、')} 文件`;
  }
  return null;
}

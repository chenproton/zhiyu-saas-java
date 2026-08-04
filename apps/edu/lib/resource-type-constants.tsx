import type React from 'react'
import {
  FileText,
  Table,
  Image,
  Link,
  Music,
  Video,
  Archive,
  Building,
  Wrench,
  AppWindow,
  HelpCircle,
} from 'lucide-react'

export const TYPE_ICONS: Record<string, React.ReactNode> = {
  document: <FileText className="size-4" />,
  spreadsheet: <Table className="size-4" />,
  image: <Image className="size-4" aria-label="图片" />,
  link: <Link className="size-4" />,
  audio: <Music className="size-4" />,
  video: <Video className="size-4" />,
  archive: <Archive className="size-4" />,
  venue: <Building className="size-4" />,
  facility: <Wrench className="size-4" />,
  software: <AppWindow className="size-4" />,
  other: <HelpCircle className="size-4" />,
}

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
  other: '#78716c',
}

export const TYPE_BG: Record<string, string> = {
  document: 'bg-orange-50',
  spreadsheet: 'bg-emerald-50',
  image: 'bg-purple-50',
  link: 'bg-cyan-50',
  audio: 'bg-pink-50',
  video: 'bg-blue-50',
  archive: 'bg-slate-50',
  venue: 'bg-red-50',
  facility: 'bg-indigo-50',
  software: 'bg-teal-50',
  other: 'bg-stone-50',
}

// 与 kkFileView 4.4.0 支持的全部格式对齐（后端 /uploads 直出白名单同源）
// document 含文字/演示/文本代码/PDF/电子书及 CAD/3D 工程文件
export const DOCUMENT_EXTS = [
  'pdf', 'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'wps', 'wpt',
  'rtf', 'odt', 'ott', 'fodt', 'pages',
  'ppt', 'pptx', 'dps', 'odp', 'otp', 'sxi', 'vsd', 'vsdx',
  'txt', 'md', 'log', 'json', 'properties', 'yaml', 'yml', 'gitignore',
  'xml', 'xbrl', 'html', 'htm',
  'java', 'py', 'c', 'cpp', 'h', 'php', 'go', 'js', 'css', 'lua', 'sh',
  'rb', 'sql', 'bat', 'm', 'bas', 'prg', 'cmd', 'cs', 'ftl', 'asp', 'jsp', 'aspx',
  'ofd', 'epub', 'eml', 'xmind', 'drawio', 'bpmn', 'dcm',
  'dwg', 'dxf', 'dwf', 'dwfx', 'dwt', 'dng', 'cf2', 'plt',
  'stl', 'obj', '3ds', 'ply', 'off', '3dm', 'fbx', 'dae', 'wrl', '3mf',
  'glb', 'gltf', 'o3dv', 'stp', 'step', 'iges', 'igs', 'brep', 'bim', 'fcstd', 'ifc',
]

export const SPREADSHEET_EXTS = [
  'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'xlam', 'xla',
  'et', 'ett', 'ods', 'ots', 'csv', 'tsv',
]

export const IMAGE_EXTS = [
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'jfif',
  'svg', 'tif', 'tiff', 'tga', 'psd', 'eps', 'wmf', 'emf',
]

export const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg']

export const VIDEO_EXTS = [
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'mpeg', '3gp', 'rm',
  'mpd', 'm3u8', 'ts',
]

export const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'jar', 'gzip']

export const SOFTWARE_EXTS = ['exe', 'dmg', 'pkg', 'deb', 'rpm', 'zip', 'msi', 'apk']

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
  facility: '',
}

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
  facility: [],
}

export const fileTypesWithUpload = [
  'document',
  'spreadsheet',
  'image',
  'audio',
  'video',
  'archive',
  'software',
  'other',
]

export const RESOURCE_MAX_FILE_SIZE = 100 * 1024 * 1024

export function validateResourceFile(file: File, type: string): string | null {
  if (file.size > RESOURCE_MAX_FILE_SIZE) return '文件大小超过 100MB'
  const allowed = resourceTypeExtensionMap[type] || []
  if (allowed.length === 0) return null
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!allowed.includes(ext)) {
    return `不支持的文件格式，请上传 ${allowed.map((e) => `.${e}`).join('、')} 文件`
  }
  return null
}

export function formatSize(bytes?: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

// 资源类型元数据（单一权威源）：每个 type 的 icon/color/bg/badge 集中一处，
// 下方 TYPE_* 导出由它派生，新增 type 漏配任意一栏会编译报错。
const RESOURCE_TYPE_META = {
  document: {
    icon: <FileText className="size-4" />,
    color: '#f97316',
    bg: 'bg-orange-50',
    badge: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  spreadsheet: {
    icon: <Table className="size-4" />,
    color: '#22c55e',
    bg: 'bg-emerald-50',
    badge: 'bg-green-50 text-green-600 border-green-200',
  },
  image: {
    icon: <Image className="size-4" aria-label="图片" />,
    color: '#a855f7',
    bg: 'bg-purple-50',
    badge: 'bg-purple-50 text-purple-600 border-purple-200',
  },
  link: {
    icon: <Link className="size-4" />,
    color: '#06b6d4',
    bg: 'bg-cyan-50',
    badge: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  },
  audio: {
    icon: <Music className="size-4" />,
    color: '#ec4899',
    bg: 'bg-pink-50',
    badge: 'bg-pink-50 text-pink-600 border-pink-200',
  },
  video: {
    icon: <Video className="size-4" />,
    color: '#3b82f6',
    bg: 'bg-blue-50',
    badge: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  archive: {
    icon: <Archive className="size-4" />,
    color: '#64748b',
    bg: 'bg-slate-50',
    badge: 'bg-slate-50 text-slate-600 border-slate-200',
  },
  venue: {
    icon: <Building className="size-4" />,
    color: '#ef4444',
    bg: 'bg-red-50',
    badge: 'bg-red-50 text-red-600 border-red-200',
  },
  facility: {
    icon: <Wrench className="size-4" />,
    color: '#6366f1',
    bg: 'bg-indigo-50',
    badge: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  },
  software: {
    icon: <AppWindow className="size-4" />,
    color: '#14b8a6',
    bg: 'bg-teal-50',
    badge: 'bg-teal-50 text-teal-600 border-teal-200',
  },
  other: {
    icon: <HelpCircle className="size-4" />,
    color: '#78716c',
    bg: 'bg-stone-50',
    badge: 'bg-stone-50 text-stone-600 border-stone-200',
  },
}

export const TYPE_ICONS: Record<string, React.ReactNode> = Object.fromEntries(
  Object.entries(RESOURCE_TYPE_META).map(([k, v]) => [k, v.icon]),
)

export const TYPE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(RESOURCE_TYPE_META).map(([k, v]) => [k, v.color]),
)

export const TYPE_BG: Record<string, string> = Object.fromEntries(
  Object.entries(RESOURCE_TYPE_META).map(([k, v]) => [k, v.bg]),
)

export const TYPE_BADGE: Record<string, string> = Object.fromEntries(
  Object.entries(RESOURCE_TYPE_META).map(([k, v]) => [k, v.badge]),
)

export const LIBRARY_LANDING_TYPE_COLORS: Record<string, string> = {
  video: '#3b82f6',
  document: '#f97316',
  spreadsheet: '#22c55e',
  image: '#a855f7',
  link: '#06b6d4',
  audio: '#ec4899',
  venue: '#ef4444',
  facility: '#64748b',
  software: '#6366f1',
  archive: '#14b8a6',
  other: '#78716c',
}

export const LIBRARY_LANDING_TYPE_ICONS: Record<string, typeof FileText> = {
  video: Video,
  document: FileText,
  spreadsheet: Table,
  image: Image,
  link: Link,
  audio: Music,
  archive: Archive,
  venue: Building,
  facility: Wrench,
  software: AppWindow,
  other: HelpCircle,
}

/** 课程学习页（lesson）资源类型图标配色 */
export const LESSON_RESOURCE_TYPE_ICONS: Record<string, string> = {
  document: 'text-primary bg-primary/5',
  video: 'text-[#f59e0b] bg-primary/5',
  link: 'text-[#8b5cf6] bg-purple-50',
  file: 'text-[#10b981] bg-emerald-50',
  spreadsheet: 'text-[#16a34a] bg-green-50',
  presentation: 'text-[#f97316] bg-orange-50',
  image: 'text-[#ec4899] bg-pink-50',
  audio: 'text-[#06b6d4] bg-cyan-50',
  pdf: 'text-[#ef4444] bg-red-50',
}

/** 场景学习页（scene）资源类型图标配色 */
export const SCENE_RESOURCE_TYPE_ICONS: Record<string, string> = {
  document: 'text-primary bg-primary/5',
  video: 'text-[#f59e0b] bg-amber-50',
  link: 'text-[#8b5cf6] bg-purple-50',
  file: 'text-[#10b981] bg-emerald-50',
  spreadsheet: 'text-[#16a34a] bg-green-50',
  presentation: 'text-[#f97316] bg-orange-50',
  image: 'text-[#ec4899] bg-pink-50',
  audio: 'text-[#06b6d4] bg-cyan-50',
  pdf: 'text-[#ef4444] bg-red-50',
}

// 与 kkFileView 4.4.0 支持的全部格式对齐（后端 /uploads 直出白名单同源）
// document 含文字/演示/文本代码/PDF/电子书及 CAD/3D 工程文件
export const DOCUMENT_EXTS = [
  'pdf',
  'doc',
  'docx',
  'docm',
  'dot',
  'dotx',
  'dotm',
  'wps',
  'wpt',
  'rtf',
  'odt',
  'ott',
  'fodt',
  'pages',
  'ppt',
  'pptx',
  'dps',
  'odp',
  'otp',
  'sxi',
  'vsd',
  'vsdx',
  'txt',
  'md',
  'log',
  'json',
  'properties',
  'yaml',
  'yml',
  'gitignore',
  'xml',
  'xbrl',
  'html',
  'htm',
  'java',
  'py',
  'c',
  'cpp',
  'h',
  'php',
  'go',
  'js',
  'css',
  'lua',
  'sh',
  'rb',
  'sql',
  'bat',
  'm',
  'bas',
  'prg',
  'cmd',
  'cs',
  'ftl',
  'asp',
  'jsp',
  'aspx',
  'ofd',
  'epub',
  'eml',
  'xmind',
  'drawio',
  'bpmn',
  'dcm',
  'dwg',
  'dxf',
  'dwf',
  'dwfx',
  'dwt',
  'dng',
  'cf2',
  'plt',
  'stl',
  'obj',
  '3ds',
  'ply',
  'off',
  '3dm',
  'fbx',
  'dae',
  'wrl',
  '3mf',
  'glb',
  'gltf',
  'o3dv',
  'stp',
  'step',
  'iges',
  'igs',
  'brep',
  'bim',
  'fcstd',
  'ifc',
]

export const SPREADSHEET_EXTS = [
  'xls',
  'xlsx',
  'xlsm',
  'xlt',
  'xltx',
  'xltm',
  'xlam',
  'xla',
  'et',
  'ett',
  'ods',
  'ots',
  'csv',
  'tsv',
]

export const IMAGE_EXTS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'ico',
  'jfif',
  'svg',
  'tif',
  'tiff',
  'tga',
  'psd',
  'eps',
  'wmf',
  'emf',
]

export const AUDIO_EXTS = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg']

export const VIDEO_EXTS = [
  'mp4',
  'webm',
  'mov',
  'avi',
  'mkv',
  'flv',
  'wmv',
  'mpeg',
  '3gp',
  'rm',
  'mpd',
  'm3u8',
  'ts',
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

export const RESOURCE_MAX_FILE_SIZE = 10 * 1024 * 1024 // 对齐 security-standards §5 单文件 ≤10MB（后端 MaxUploadSize=10MB+1MB 头部余量）

export function validateResourceFile(file: File, type: string): string | null {
  if (file.size > RESOURCE_MAX_FILE_SIZE) return '文件大小超过 10MB'
  const allowed = resourceTypeExtensionMap[type] || []
  if (allowed.length === 0) return null
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!allowed.includes(ext)) {
    return `不支持的文件格式，请上传 ${allowed.map((e) => `.${e}`).join('、')} 文件`
  }
  return null
}

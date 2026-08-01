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

export const resourceTypeAccept: Record<string, string> = {
  document: '.pdf,.doc,.docx,.txt,.ppt,.pptx,.md',
  spreadsheet: '.xls,.xlsx,.csv',
  image: '.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp',
  audio: '.mp3,.wav,.ogg,.m4a,.flac,.aac',
  video: '.mp4,.webm,.mov,.avi,.mkv,.flv',
  archive: '.zip,.rar,.7z,.tar,.gz,.bz2',
  software: '.exe,.dmg,.pkg,.deb,.rpm,.zip,.msi,.apk',
  other: '',
  link: '',
  venue: '',
  facility: '',
}

export const resourceTypeExtensionMap: Record<string, string[]> = {
  document: ['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'md'],
  spreadsheet: ['xls', 'xlsx', 'csv'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
  video: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
  software: ['exe', 'dmg', 'pkg', 'deb', 'rpm', 'zip', 'msi', 'apk'],
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

export function formatSize(bytes?: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

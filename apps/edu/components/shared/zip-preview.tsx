'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { unzipSync, strFromU8 } from 'fflate'
import { FileText, Folder, Download, Loader2, AlertTriangle, FileArchive } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_ZIP_SIZE = 50 * 1024 * 1024

interface ZipEntry {
  name: string
  size: number
  data: Uint8Array
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'jfif', 'svg'])
const TEXT_EXTS = new Set([
  'txt',
  'md',
  'json',
  'yaml',
  'yml',
  'log',
  'csv',
  'tsv',
  'properties',
  'xml',
  'java',
  'py',
  'c',
  'cpp',
  'h',
  'php',
  'go',
  'js',
  'ts',
  'css',
  'lua',
  'sh',
  'rb',
  'sql',
  'bat',
  'cmd',
  'cs',
  'html',
  'htm',
])

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function isZipUrl(url: string | undefined | null): boolean {
  return !!url && url.toLowerCase().endsWith('.zip')
}

// macOS 生成的 zip 文件名是 UTF-8 字节但不置位 UTF-8 标志，fflate 会按 latin1
// 逐字节解码成乱码（如 "æµ\x8Bè¯.txt"）。对全 latin1 域的名称做字节还原，
// 再按 UTF-8 → GBK 依次尝试解码兜底。
export function fixName(name: string): string {
  if ([...name].some((c) => c.charCodeAt(0) > 0xff)) return name
  const bytes = new Uint8Array(name.split('').map((c) => c.charCodeAt(0) & 0xff))
  const asUtf8 = new TextDecoder('utf-8').decode(bytes)
  if (!asUtf8.includes('\uFFFD')) return asUtf8
  try {
    const asGbk = new TextDecoder('gbk').decode(bytes)
    if (!asGbk.includes('\uFFFD')) return asGbk
  } catch {
    /* 保持原名 */
  }
  return name
}

// 由调用方以 key={url} 挂载，保证换包时组件整体重建
export default function ZipPreview({ url, name }: { url: string; name?: string }) {
  const [entries, setEntries] = useState<ZipEntry[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ZipEntry | null>(null)
  const [selectedBlobUrl, setSelectedBlobUrl] = useState('')
  const blobUrlRef = useRef('')

  useEffect(() => {
    const run = async () => {
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`下载失败（${resp.status}）`)
        const size = Number(resp.headers.get('content-length') || 0)
        if (size > MAX_ZIP_SIZE) {
          setError(`压缩包过大（${(size / 1024 / 1024).toFixed(1)}MB），请下载后本地解压查看`)
          return
        }
        const buf = new Uint8Array(await resp.arrayBuffer())
        if (buf.byteLength > MAX_ZIP_SIZE) {
          setError('压缩包过大（超过 50MB），请下载后本地解压查看')
          return
        }
        const unzipped = unzipSync(buf)
        const list = Object.entries(unzipped)
          .map(([n, data]) => ({ name: fixName(n), size: data.length, data }))
          .filter(
            (e) =>
              !e.name.endsWith('/') &&
              !e.name.startsWith('__MACOSX') &&
              !e.name.endsWith('.DS_Store'),
          )
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
        setEntries(list)
      } catch (e: any) {
        setError(
          e?.message?.includes('encrypted')
            ? '压缩包已加密，无法在线预览'
            : '解压失败，文件可能损坏或不是标准 zip',
        )
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [url])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  const selectEntry = (entry: ZipEntry) => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const url = URL.createObjectURL(new Blob([entry.data]))
    blobUrlRef.current = url
    setSelected(entry)
    setSelectedBlobUrl(url)
  }

  const selectedType = useMemo(() => {
    if (!selected) return 'unknown'
    const ext = extOf(selected.name)
    if (IMAGE_EXTS.has(ext)) return 'image'
    if (TEXT_EXTS.has(ext)) return 'text'
    if (ext === 'pdf') return 'pdf'
    return 'unknown'
  }, [selected])

  const downloadEntry = (entry: ZipEntry) => {
    const url = URL.createObjectURL(new Blob([entry.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = entry.name.split('/').pop() || entry.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 text-sm">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-white">
        <FileArchive className="size-4 text-gray-500" />
        <span className="font-medium truncate">{name || '压缩包预览'}</span>
        <span className="text-xs text-gray-400">{entries ? `${entries.length} 个文件` : ''}</span>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className="w-64 shrink-0 border-r bg-white overflow-auto">
          {loading && (
            <div className="flex items-center gap-2 p-4 text-gray-400">
              <Loader2 className="size-4 animate-spin" />
              正在解压...
            </div>
          )}
          {error && (
            <div className="p-4 text-amber-600 flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                {error}
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block mt-1 text-blue-600 underline"
                >
                  下载原文件
                </a>
              </div>
            </div>
          )}
          {!loading && !error && entries?.length === 0 && (
            <div className="p-4 text-gray-400">压缩包为空</div>
          )}
          {!loading && !error && entries && entries.length > 0 && (
            <ul>
              {entries.map((e) => {
                const dir = e.name.includes('/') ? e.name.slice(0, e.name.lastIndexOf('/') + 1) : ''
                const isSelected = selected?.name === e.name
                return (
                  <li key={e.name}>
                    <button
                      type="button"
                      onClick={() => selectEntry(e)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-100',
                        isSelected && 'bg-blue-50 text-blue-700',
                      )}
                    >
                      {dir ? (
                        <Folder className="size-3.5 shrink-0 text-gray-400" />
                      ) : (
                        <FileText className="size-3.5 shrink-0 text-gray-400" />
                      )}
                      <span className="truncate">{e.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col bg-white m-2 rounded border overflow-hidden">
          {!selected && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
              <FileText className="size-8 opacity-40" />
              <span>点击左侧文件查看内容</span>
            </div>
          )}
          {selected && selectedType === 'image' && (
            <div className="flex-1 min-h-0 flex items-center justify-center p-2 overflow-auto bg-gray-100">
              <img
                src={selectedBlobUrl}
                alt={selected.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
          {selected && selectedType === 'text' && (
            <pre className="flex-1 min-h-0 overflow-auto p-4 whitespace-pre-wrap break-all">
              {strFromU8(selected.data)}
            </pre>
          )}
          {selected && selectedType === 'pdf' && (
            <iframe
              src={selectedBlobUrl}
              title={selected.name}
              className="flex-1 min-h-0 w-full border-0"
            />
          )}
          {selected && selectedType === 'unknown' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
              <FileText className="size-8 opacity-40" />
              <span>{selected.name} 暂不支持在线预览</span>
              <button
                type="button"
                onClick={() => downloadEntry(selected)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <Download className="size-4" />
                下载该文件
              </button>
            </div>
          )}
          {selected && (
            <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-t bg-gray-50 text-xs text-gray-500">
              <span className="truncate">{selected.name}</span>
              <button
                type="button"
                onClick={() => downloadEntry(selected)}
                className="text-blue-600 hover:underline shrink-0 ml-2"
              >
                下载
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

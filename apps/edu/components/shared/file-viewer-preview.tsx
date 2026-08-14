'use client'

import { useEffect, useState, memo } from 'react'
import { FileText } from 'lucide-react'
import { DEFAULT_SUPPORTED_EXTENSIONS } from '@file-viewer/core'
import { useT } from '@/lib/i18n/locale-provider'

// flyfish-dev/file-viewer：浏览器原生（无服务端转换）的文件预览渲染器。
// 与 kkfileview（服务端转换 + iframe）不同，它在浏览器内 fetch 文件并直接渲染，
// 无需独立预览服务容器。
//
// @file-viewer/preset-all 一次性注册全部 25 条预览链路（office/pdf/压缩包/邮件/CAD/3D/
// 地理/脑图/绘图/电子书/图片/音视频/代码文本/字体/设计/数据等），覆盖 DEFAULT_SUPPORTED_EXTENSIONS
// 的 208 个扩展名。组件懒加载 preset-all + react，autoRenderers 默认开启时自动注入 renderer registry
// （见 core createViewer 的 ensureRendererPluginsInstalled）。
interface FileViewerPreviewProps {
  url: string
  name?: string
}

type FileViewerModule = typeof import('@file-viewer/react')

function FileViewerPreviewInner({ url, name }: FileViewerPreviewProps) {
  const t = useT()
  const [mod, setMod] = useState<FileViewerModule | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    // preset-all 必须先于 FileViewer 挂载加载，注册全部渲染器
    Promise.all([import('@file-viewer/preset-all'), import('@file-viewer/react')])
      .then(([, reactMod]) => {
        if (!cancelled) setMod(reactMod)
      })
      .catch(() => {
        if (!cancelled) setError(t('预览组件加载失败'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full text-gray-400">
        <FileText className="h-10 w-10 opacity-40" />
        <span className="text-sm">{error}</span>
      </div>
    )
  }

  if (!mod) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        {t('加载中…')}
      </div>
    )
  }

  const FileViewer = mod.FileViewer
  return (
    <FileViewer
      url={url}
      filename={name}
      className="w-full h-full"
      style={{ width: '100%', height: '100%', minHeight: 0 }}
    />
  )
}

export const FileViewerPreview = memo(FileViewerPreviewInner)
export default FileViewerPreview

// file-viewer 支持扩展名的唯一事实源：DEFAULT_SUPPORTED_EXTENSIONS 由
// core 的 registry/formats.ts（DEFAULT_RENDERER_DEFINITIONS 展开去重）派生，
// v2.2.9 共 208 个不重复扩展名。用 Set 加速判定。
const SUPPORTED_EXTS = new Set<string>(
  (DEFAULT_SUPPORTED_EXTENSIONS as readonly string[]).map((e) => e.toLowerCase()),
)

function extOf(url: string): string {
  // 去掉查询串/片段，取路径最后一段的扩展名
  const path = url.split(/[?#]/)[0]
  const i = path.lastIndexOf('.')
  return i < 0 ? '' : path.slice(i + 1).toLowerCase()
}

/**
 * 判断某 URL 的扩展名是否属于 file-viewer 支持范围。
 * file-viewer 优先：支持的格式一律走 FileViewerPreview；不支持的才回退 kkfileview。
 */
export function isFileViewerUrl(url: string | undefined | null): boolean {
  if (!url) return false
  const ext = extOf(url)
  return ext !== '' && SUPPORTED_EXTS.has(ext)
}

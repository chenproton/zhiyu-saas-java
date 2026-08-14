'use client'

import { useEffect, useState, memo } from 'react'
import { FileText } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

// flyfish-dev/file-viewer：浏览器原生（无服务端转换）的文件预览渲染器。
// 与 kkfileview（服务端转换 + iframe）不同，它在浏览器内 fetch 文件并直接渲染
// office/pdf 等格式，无需独立预览服务容器。
//
// 组件懒加载 + import('@file-viewer/preset-office') 会触发 registerFileViewerAutoRendererPreset
// 副作用，使 office/pdf 渲染器自动注册到 FileViewer 的 renderer registry
// （autoRenderers 默认开启，见 createViewer 的 ensureRendererPluginsInstalled）。
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
    // preset-office 必须先于 FileViewer 挂载加载，注册 office/pdf 渲染器
    Promise.all([
      import('@file-viewer/preset-office'),
      import('@file-viewer/react'),
    ])
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

/**
 * 判断某 URL 是否应交给 file-viewer 渲染。
 * zip 走自研 ZipPreview（解压列举），其余非图片/音视频的 office/pdf/文本交 file-viewer。
 * 图片与音视频浏览器原生支持，继续保留在原有 iframe 分支内。
 */
const OFFICE_EXT_RE =
  /\.(doc|docx|docm|dot|dotx|dotm|ppt|pptx|pptm|potx|potm|ppsx|ppsm|xls|xlsx|xlsm|xlsb|xlt|xltx|xltm|csv|tsv|ods|fods|numbers|pdf|ofd|rtf|odt|odp|txt|md|json|yaml|yml|xml|log|typ|typst)(\?|$)/i

export function isFileViewerUrl(url: string | undefined | null): boolean {
  return !!url && OFFICE_EXT_RE.test(url)
}

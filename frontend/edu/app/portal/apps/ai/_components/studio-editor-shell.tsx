'use client'

// 创作页共享骨架（v2.6，对齐 zhiyu-ai builder 模式）：studio 编辑器全宽直出，
// 自带 sticky 顶栏（返回 + 图标 + 标题 + 状态徽标 + 操作区），内容区统一容器。
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useT } from '@/lib/i18n/locale-provider'

export function StudioEditorShell({
  icon,
  title,
  badge,
  actions,
  children,
  wide = false,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  /** 双栏 builder（智能体编辑器）用更宽容器 */
  wide?: boolean
}) {
  const t = useT()
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa]">
      {/* 顶栏：sticky，毛玻璃白 */}
      <div className="sticky top-14 z-30 border-b border-[#e7e5e4] bg-white/85 backdrop-blur-md">
        <div
          className={`${wide ? 'max-w-[1400px]' : 'max-w-5xl'} mx-auto px-4 sm:px-8 h-14 flex items-center gap-3`}
        >
          <Link
            href="/portal/apps/ai/landing#studio"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('返回工坊')}
          </Link>
          <span className="w-px h-5 bg-border shrink-0" />
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {icon}
            <h1 className="text-[15px] font-semibold truncate">{title}</h1>
            {badge}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>

      <div className={`${wide ? 'max-w-[1400px]' : 'max-w-5xl'} mx-auto px-4 sm:px-8 py-6`}>
        {children}
      </div>
    </div>
  )
}

/** 编辑器卡片：对齐 landing/大厅的白色圆角面板语言 */
export function EditorCard({
  title,
  desc,
  children,
  className = '',
  contentClassName,
}: {
  title?: React.ReactNode
  desc?: string
  children: React.ReactNode
  className?: string
  /** 内容区内边距覆盖（文档/协作者等整卡列表用 px-0） */
  contentClassName?: string
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#e7e5e4] shadow-[0_2px_6px_rgba(0,0,0,0.04)] ${className}`}
    >
      {title && (
        <div className="px-5 pt-4 pb-3 border-b border-dashed border-[#e7e5e4]">
          <div className="text-sm font-semibold text-[#0f172a]">{title}</div>
          {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
        </div>
      )}
      <div className={contentClassName ?? 'p-5'}>{children}</div>
    </div>
  )
}

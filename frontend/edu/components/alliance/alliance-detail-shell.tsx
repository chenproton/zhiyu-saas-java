'use client'

// 联盟「企业视角」详情壳：breadcrumbs/stats/cover 渐变视觉（企业/品牌详情类页面用）。
// 与 components/shared/alliance-detail-shell.tsx（「门户视角」壳：notFound/loading/URL Tab 同步）并存，
// 两者 props 形态刻意不同（视觉 vs 行为），改动前先确认目标页面组归属，避免双向漂移。

import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

export interface DetailStat {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  /** tailwind 渐变类，如 'from-blue-500 to-blue-600' */
  gradient: string
}

export interface DetailTab {
  value: string
  label: string
  count?: number
  content: React.ReactNode
}

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface AllianceDetailShellProps {
  /** 面包屑导航（如：联盟首页 > 列表 > 当前对象）；提供时优先于 backHref 按钮 */
  breadcrumbs?: BreadcrumbItem[]
  backHref: string
  backLabel?: string
  /** 隐藏返回按钮/面包屑（如企业端预览 Dialog 内，无导航语境） */
  showBack?: boolean
  /** 无 logo/图片时的渐变图标头像 */
  icon?: LucideIcon
  iconImage?: { src: string; alt: string }
  iconGradient?: string
  title: string
  subtitle?: React.ReactNode
  badges?: React.ReactNode[]
  stats?: DetailStat[]
  tabs: DetailTab[]
  /** 页面背景渐变（默认蓝紫调） */
  pageGradient?: string
  /** 头图：存在时标题区以封面模糊图 + 白色遮罩为背景 */
  coverImage?: string
}

/** 信息块：原型统一样式（label 上、value 下，灰底圆角） */
export function DetailInfoBlock({
  label,
  value,
}: {
  label: string
  value?: React.ReactNode
}) {
  return (
    <div className="p-4 rounded-2xl bg-slate-50">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value ?? '-'}</p>
    </div>
  )
}

/** 空态：原型统一样式（居中图标 + 文案） */
export function DetailEmpty({ icon: Icon, title }: { icon?: LucideIcon; title: string }) {
  return (
    <EmptyState
      icon={Icon ? <Icon className="h-10 w-10 opacity-50" /> : undefined}
      title={title}
      titleClassName="text-slate-500"
      className="py-16"
    />
  )
}

/** 详情卡片：渐变竖条标题 + 白卡（原型详情页统一样式） */
export function DetailSectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`border-0 shadow-sm rounded-3xl ${className ?? ''}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="h-6 w-1.5 rounded-full bg-gradient-to-b from-primary/80 to-primary/60" />
          {Icon ? <Icon className="h-4 w-4" /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}

/**
 * 联盟前台详情页公共壳：浅渐变全屏背景（无边框/无分区）+ 面包屑 + 头像/标题/徽章 + 统计卡 + 圆角 Tabs。
 * 合作企业/合作项目/合作成果/专家详情页复用；企业端「预览展示页」同步复用。
 */
export function AllianceDetailShell({
  breadcrumbs,
  backHref,
  backLabel,
  showBack = true,
  icon: Icon,
  iconImage,
  iconGradient = 'from-blue-500 to-blue-600',
  title,
  subtitle,
  badges,
  stats,
  tabs,
  pageGradient = 'from-slate-50 via-white to-blue-50/40',
  coverImage,
}: AllianceDetailShellProps) {
  const t = useT()
  const crumbs = breadcrumbs ?? (showBack ? [{ label: backLabel || t('返回列表'), href: backHref }] : [])
  return (
    <div className={`min-h-screen bg-gradient-to-b ${pageGradient}`}>
      {/* 标题区：无独立背景块，直接铺在页面渐变上，顶部紧凑；有封面时叠加模糊封面背景 */}
      <section className="relative pt-3 lg:pt-6 pb-8 overflow-hidden">
        {coverImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50 pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/75 to-white/95 pointer-events-none" />
          </>
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {showBack && crumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-[13px] text-slate-400 mb-4 flex-wrap">
              {crumbs.map((crumb, idx) => {
                const last = idx === crumbs.length - 1
                return (
                  <span key={idx} className="flex items-center gap-1 min-w-0">
                    {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />}
                    {crumb.href && !last ? (
                      <Link
                        to={crumb.href}
                        className="hover:text-primary transition-colors whitespace-nowrap"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className={`whitespace-nowrap ${
                          last ? 'text-slate-700 font-medium truncate max-w-[260px]' : ''
                        }`}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </span>
                )
              })}
            </nav>
          )}

          <div className="flex flex-col md:flex-row md:items-start gap-5">
            {iconImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconImage.src}
                alt={iconImage.alt}
                className={`h-20 w-20 rounded-3xl object-cover shadow-xl shrink-0 bg-white border border-white/40 ${iconGradient}`}
              />
            ) : Icon ? (
              <div
                className={`h-24 w-24 rounded-3xl bg-gradient-to-br ${iconGradient} flex items-center justify-center text-white shadow-xl shrink-0`}
              >
                <Icon className="w-12 h-12" />
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-2 break-words">
                {title}
              </h1>
              {subtitle && <p className="text-slate-500 text-base md:text-lg">{subtitle}</p>}
              {badges && badges.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3">{badges}</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {stats && stats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              {stats.map((stat) => (
                <Card key={stat.label} className="border-0 shadow-sm rounded-3xl bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${stat.gradient} text-white flex items-center justify-center shadow-lg shrink-0`}
                      >
                        <stat.icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-extrabold text-slate-900 truncate">{stat.value}</p>
                        <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Tabs defaultValue={tabs[0]?.value} className="space-y-6">
            <TabsList className="rounded-2xl p-1 bg-white shadow-sm border border-slate-100">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="group rounded-xl">
                  {tab.label}
                  {typeof tab.count === 'number' && (
                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-slate-500 group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>
    </div>
  )
}

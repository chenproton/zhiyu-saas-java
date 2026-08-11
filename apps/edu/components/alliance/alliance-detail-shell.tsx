'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
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

interface AllianceDetailShellProps {
  backHref: string
  backLabel?: string
  /** 隐藏返回按钮（如企业端预览 Dialog 内，无返回列表语境） */
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
  /** hero 装饰光斑色调（默认蓝紫） */
  glowClass?: string
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
    <div className="text-center py-16 text-slate-500">
      {Icon && <Icon className="h-10 w-10 mx-auto mb-3 opacity-50" />}
      <p>{title}</p>
    </div>
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
          <div className="h-6 w-1.5 rounded-full bg-gradient-to-b from-blue-500 to-violet-500" />
          {Icon ? <Icon className="h-4 w-4" /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}

/**
 * 联盟前台详情页公共壳：渐变 hero（返回/头像/标题/徽章）+ 统计卡 + 圆角 Tabs。
 * 合作企业/合作项目/合作成果三个详情页复用；企业端「预览展示页」同步复用。
 */
export function AllianceDetailShell({
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
  pageGradient = 'from-slate-50/80 via-white to-blue-50/30',
  glowClass = 'from-blue-600/5 via-transparent to-violet-600/5',
}: AllianceDetailShellProps) {
  const t = useT()
  return (
    <div className={`min-h-screen bg-gradient-to-b ${pageGradient}`}>
      <section className="relative overflow-hidden py-10 lg:py-16">
        <div className={`absolute inset-0 bg-gradient-to-br ${glowClass}`} />
        <div className={`absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] ${glowClass.split(' ')[0]?.replace('/5', '/10')}`} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {showBack && (
            <div className="mb-8">
              <Link href={backHref}>
                <Button variant="ghost" size="sm" className="rounded-full hover:bg-white/50">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {backLabel || t('返回列表')}
                </Button>
              </Link>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-start gap-6">
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
            <div className="flex-1">
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
                <TabsTrigger key={tab.value} value={tab.value} className="rounded-xl">
                  {tab.label}
                  {typeof tab.count === 'number' && ` (${tab.count})`}
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

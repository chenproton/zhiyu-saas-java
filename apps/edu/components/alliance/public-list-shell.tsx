'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MobileTabDropdown } from '@/components/shared/mobile-tab-dropdown'
import { Footer } from '@/components/portal/footer'
import { useT } from '@/lib/i18n/locale-provider'

export interface PublicListTab {
  value: string
  label: string
  count: number
}

export interface PublicListShellProps {
  title: string
  subtitle: string
  icon: ReactNode
  backHref?: string
  backLabel?: string
  tabs: PublicListTab[]
  activeTab: string
  onTabChange: (value: string) => void
  keyword: string
  onKeywordChange: (value: string) => void
  placeholder?: string
  loading?: boolean
  gridClassName?: string
  children: ReactNode
}

export function PublicListShell({
  title,
  subtitle,
  icon,
  backHref = '/portal/alliance/landing',
  backLabel = '返回校企合作联盟首页',
  tabs,
  activeTab,
  onTabChange,
  keyword,
  onKeywordChange,
  placeholder = '搜索...',
  loading = false,
  gridClassName = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5',
  children,
}: PublicListShellProps) {
  const t = useT()
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8ff]">
      {/* 页头 */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/75 to-primary/40">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)`,
            backgroundSize: '52px 52px',
          }}
        />
        <div className="absolute top-[-80px] right-[-5%] w-[360px] h-[360px] rounded-full bg-white/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[10%] w-[300px] h-[300px] rounded-full bg-black/10 blur-[100px] pointer-events-none" />
        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t(backLabel)}
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{title}</h1>
              <p className="text-sm text-white/80 mt-1">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 w-full flex-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="w-full md:w-auto">
            <MobileTabDropdown
              items={tabs.map((tab) => ({ value: tab.value, label: `${tab.label} (${tab.count})` }))}
              value={activeTab}
              onValueChange={onTabChange}
              className="md:hidden w-full"
            />
            <Tabs value={activeTab} onValueChange={onTabChange} className="hidden md:block">
              <TabsList className="bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm h-11">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="group px-3 sm:px-5 rounded-[10px] text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    {tab.label}
                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-slate-500 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">
                      {tab.count}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder={t(placeholder)}
              className="pl-10 h-11 bg-white border-[#e7e5e4] rounded-xl text-sm shadow-sm focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className={gridClassName}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#e7e5e4] h-[220px] animate-pulse shadow-sm"
              />
            ))}
          </div>
        ) : (
          children
        )}
      </main>
      <Footer className="mt-auto" />
    </div>
  )
}

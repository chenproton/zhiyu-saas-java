'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Footer } from '@/components/portal/footer'

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
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8ff]">
      {/* 页头 */}
      <div className="bg-gradient-to-br from-primary via-primary/75 to-primary/40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
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
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm h-11">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="px-3 sm:px-5 rounded-[10px] text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  {tab.label} ({tab.count})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <Input
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder={placeholder}
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

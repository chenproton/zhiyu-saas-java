'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ClipboardList,
} from 'lucide-react'
import { SearchInput } from '@/components/shared/search-input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { examUsageApi, examApi } from '@/lib/api'
import type { ExamCenterItem, Exam } from '@/lib/types'
import { ExamCenterCard } from '@/components/evaluation/exam-center-card'
import { Footer } from '@/components/portal/footer'
import { useT } from '@/lib/i18n/locale-provider'

export default function ExamCenterPage() {
  const t = useT()
  const [items, setItems] = useState<ExamCenterItem[]>([])
  const [examCovers, setExamCovers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    examUsageApi
      .center()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
    examApi
      .list({ status: 'published', limit: 1000 })
      .then((res) => {
        const map: Record<string, string> = {}
        ;(res.items || []).forEach((e: Exam) => {
          if (e.coverImage) map[e.id] = e.coverImage
        })
        setExamCovers(map)
      })
      .catch(() => {})
  }, [])

  const isStudent = items.length > 0 ? items[0]?.studentView : true

  const filtered = useMemo(() => {
    let list = items
    if (tab === 'mine') list = list.filter((i) => i.participatable)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter(
        (i) =>
          i.usageName.toLowerCase().includes(q) || i.examName.toLowerCase().includes(q),
      )
    }
    return list
  }, [items, tab, keyword])

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8ff]">
      {/* 页头 */}
      <div className="bg-gradient-to-br from-primary via-primary/75 to-primary/40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <Link
            href="/evaluation/landing"
            className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('返回测评资源平台')}
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t('考试中心')}</h1>
              <p className="text-sm text-white/80 mt-1">
                {t('查看全部考试与你可参加的考试，按班级开放')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 w-full flex-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'mine')}>
            <TabsList className="bg-white p-1 rounded-xl border border-[#e7e5e4] shadow-sm h-11">
              <TabsTrigger
                value="all"
                className="px-5 rounded-[10px] text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                {t('全部考试 ({n})', { n: items.length })}
              </TabsTrigger>
              {isStudent && (
                <TabsTrigger
                  value="mine"
                  className="px-5 rounded-[10px] text-[13px] data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  {t('我可参加 ({n})', { n: items.filter((i) => i.participatable).length })}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          <SearchInput
            wrapperClassName="w-full sm:w-[320px]"
            iconClassName="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]"
            value={keyword}
            onChange={setKeyword}
            placeholder={t('搜索考试名称...')}
            inputClassName="pl-10 h-11 bg-white border-[#e7e5e4] rounded-xl text-sm shadow-sm focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#e7e5e4] h-[220px] animate-pulse shadow-sm"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#94a3b8] bg-white rounded-2xl border border-[#e7e5e4] shadow-sm">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <div className="text-[15px] font-medium text-[#475569]">{t('暂无考试')}</div>
            <div className="text-[13px] mt-1">{t('发布后的考试安排会展示在这里')}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((item) => (
              <ExamCenterCard key={item.id} item={item} coverImage={examCovers[item.examId]} />
            ))}
          </div>
        )}
      </main>
      <Footer className="mt-auto" />
    </div>
  )
}

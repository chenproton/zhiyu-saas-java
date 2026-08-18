'use client'

import { Link } from 'react-router'
import { Layers, MapPin } from 'lucide-react'
import type { Scenario } from '@/lib/types'
import { formatDate } from '@/lib/format-utils'
import { coverGradientFor } from '@/lib/cover-gradients'
import { useT } from '@/lib/i18n/locale-provider'

interface SceneCardProps {
  scenario: Scenario
  index?: number
  taskCount?: number
  knowledgePointCount?: number
}

const industryTag: { bg: string; text: string; border: string } = {
  bg: '#fff7ed',
  text: '#c2410c',
  border: '#ffedd5',
}

const professionTag: { bg: string; text: string; border: string } = {
  bg: 'color-mix(in srgb, var(--primary) 8%, white)',
  text: 'var(--primary)',
  border: 'color-mix(in srgb, var(--primary) 15%, white)',
}

export function SceneCard({
  scenario,
  taskCount = 0,
  knowledgePointCount = 0,
}: SceneCardProps) {
  const t = useT()
  const displayTitle = scenario.name
  const coverStyle = scenario.coverImage
    ? { backgroundImage: `url('${scenario.coverImage}')` }
    : { background: coverGradientFor(scenario.id) }

  const industryName =
    scenario.industryNames?.[0] || (scenario.industryIds?.length ? t('已关联') : t('未分类'))
  const professionName =
    scenario.professionNames?.[0] || (scenario.professionIds?.length ? t('已关联') : t('未分类'))
  const viewCount = scenario.viewCount ?? 0
  const creatorName = scenario.creatorName || scenario.creatorId?.slice(0, 8) || '-'

  return (
    <Link to={`/scene/landing/${scenario.id}`}>
      <div className="group bg-white rounded-2xl overflow-hidden border border-[#e7e5e4] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 cursor-pointer h-full flex flex-col">
        <div
          className="h-44 relative bg-cover bg-center flex flex-col justify-end p-4"
          style={coverStyle}
        >
          {!scenario.coverImage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Layers
                className="w-12 h-12 text-white/85 drop-shadow-md"
                strokeWidth={1.5}
              />
            </div>
          )}
          <div className="absolute top-3 left-3 right-3 z-10 flex justify-between">
            <div className="flex gap-1.5">
              <span className="bg-[#0f172a]/40 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white font-medium border border-white/20">
                {scenario.version || 'V1.0'}
              </span>
              <span className="bg-[#0f172a]/40 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-white font-medium border border-white/20">
                {t('创建人：{name}', { name: creatorName })}
              </span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-base font-bold leading-snug mb-1 line-clamp-2 text-white text-shadow-md group-hover:text-white/90 transition-colors">
              {displayTitle}
            </div>
            <div className="text-xs text-white/85 text-shadow-sm">
              {t('场景编码：{code}', { code: scenario.code || scenario.id.slice(0, 8) })}
            </div>
          </div>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{viewCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{t('浏览次数')}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{taskCount || '-'}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{t('关联任务')}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-800">{knowledgePointCount || '-'}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{t('关联知识点')}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 font-medium border"
              style={{
                backgroundColor: industryTag.bg,
                color: industryTag.text,
                borderColor: industryTag.border,
              }}
            >
              <MapPin className="w-3 h-3" /> {t('面向行业：{name}', { name: industryName })}
            </span>
            <span
              className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 font-medium border"
              style={{
                backgroundColor: professionTag.bg,
                color: professionTag.text,
                borderColor: professionTag.border,
              }}
            >
              <MapPin className="w-3 h-3" /> {t('适用专业：{name}', { name: professionName })}
            </span>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2.5">
            <span className="text-xs text-slate-500">
              {t('收录：{date}', { date: formatDate(scenario.createdAt) })}
            </span>
            <span className="text-xs text-slate-500">
              {t('更新：{date}', { date: formatDate(scenario.updatedAt) })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

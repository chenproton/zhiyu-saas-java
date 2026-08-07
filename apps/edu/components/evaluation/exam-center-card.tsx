'use client'

import Link from 'next/link'
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Lock,
  PlayCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ExamCenterItem } from '@/lib/types'
import { formatDate } from '@/lib/format-utils'
import { cn } from '@/lib/utils'
import { coverGradientFor } from '@/lib/cover-gradients'
import { useT } from '@/lib/i18n/locale-provider'

const STATUS_META: Record<string, { label: string; text: string; dot: string }> = {
  published: { label: '待考', text: 'text-amber-600', dot: 'bg-amber-500' },
  in_progress: { label: '进行中', text: 'text-green-600', dot: 'bg-green-500' },
  finished: { label: '已结束', text: 'text-gray-500', dot: 'bg-gray-400' },
}

export function ExamCenterCard({
  item,
  coverImage,
}: {
  item: ExamCenterItem
  coverImage?: string
}) {
  const t = useT()
  const status = STATUS_META[item.status] || {
    label: item.status,
    text: 'text-gray-500',
    dot: 'bg-gray-400',
  }
  const finished = item.status === 'finished'
  const canEnter = item.participatable && !item.submitted && !finished
  const entryHref = `/evaluation/landing/exams/${item.examId}?usage=${item.id}`

  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <div
        className="h-24 flex items-center justify-center shrink-0 relative"
        style={
          coverImage
            ? {
                backgroundImage: `url('${coverImage}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { background: coverGradientFor(item.id) }
        }
      >
        {!coverImage && <ClipboardList className="w-10 h-10 text-white/80" />}
        <Badge
          variant="outline"
          className={cn(
            'absolute top-3 right-3 h-5 px-2 text-[11px] rounded-full bg-white/90 backdrop-blur-sm border-white/40 shadow-sm gap-1',
            status.text,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          {t(status.label)}
        </Badge>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-[15px] font-semibold text-slate-800 truncate">{item.usageName}</h3>
        <p className="text-xs text-slate-400 mt-1 truncate">{t('试卷：{name}', { name: item.examName })}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 py-2.5 mt-1.5 border-b border-slate-50">
          <span className="flex items-center gap-1 shrink-0">
            <FileText className="w-3 h-3" /> {t('{n} 题', { n: item.questionCount })}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />{' '}
            {item.duration ? t('{n} 分钟', { n: item.duration }) : t('不限时')}
          </span>
          <span className="flex items-center gap-1 min-w-0">
            <CalendarClock className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {item.startTime
                ? `${formatDate(item.startTime)}${item.endTime ? ` ~ ${formatDate(item.endTime)}` : ''}`
                : t('不限时间')}
            </span>
          </span>
        </div>
        <div className="pt-2.5 flex-1 flex flex-col justify-between gap-2">
          {item.submitted && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">{t('已交卷')}</span>
              {item.score != null && (
                <span className="font-semibold text-green-600">
                  {t('{score}/{total} 分', { score: item.score, total: item.totalScore })}
                </span>
              )}
            </div>
          )}
          <div>
            {canEnter ? (
              <Button
                asChild
                className="w-full rounded-[10px] h-9 text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-md shadow-primary/20"
              >
                <Link href={entryHref}>
                  <PlayCircle className="w-3.5 h-3.5 mr-1" /> {t('开始考试')}
                </Link>
              </Button>
            ) : item.submitted ? (
              <Button
                asChild
                variant="outline"
                className="w-full rounded-[10px] h-9 text-xs text-green-600 border-green-200 hover:bg-green-50"
              >
                <Link href={entryHref}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t('查看结果')}
                </Link>
              </Button>
            ) : (
              <Button
                disabled
                className="w-full rounded-[10px] h-9 text-xs bg-slate-100 text-slate-400 cursor-not-allowed"
              >
                <Lock className="w-3 h-3 mr-1" />
                {finished
                  ? t('考试已结束')
                  : !item.participatable && item.studentView
                    ? t('仅指定班级可参加')
                    : !item.participatable && !item.studentView
                      ? t('仅学生可参加')
                      : t('不可参加')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  PlayCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ExamCenterItem } from '@/lib/types'
import { formatDateTime } from '@/lib/format-utils'
import { cn } from '@/lib/utils'

export const EXAM_CENTER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  published: { label: '待考', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  in_progress: { label: '进行中', className: 'bg-green-50 text-green-600 border-green-200' },
  finished: { label: '已结束', className: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export function ExamCenterCard({ item }: { item: ExamCenterItem }) {
  const status = EXAM_CENTER_STATUS_LABELS[item.status] || {
    label: item.status,
    className: 'bg-gray-100 text-gray-500 border-gray-200',
  }
  const finished = item.status === 'finished'
  const canEnter = item.participatable && !item.submitted && !finished
  const entryHref = `/evaluation/landing/exams/${item.examId}?usage=${item.id}`

  return (
    <div className="bg-white rounded-2xl border border-[#e7e5e4] overflow-hidden hover:shadow-[0_8px_28px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all flex flex-col shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-slate-800 truncate">{item.usageName}</h3>
          <Badge variant="outline" className={cn('text-[11px] h-5 px-2 shrink-0', status.className)}>
            {status.label}
          </Badge>
        </div>
        <p className="text-xs text-slate-400 mt-1 truncate">试卷：{item.examName}</p>
      </div>
      <div className="px-5 py-3 flex items-center gap-4 text-[11px] text-slate-400 border-b border-slate-50">
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" /> {item.questionCount} 题
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {item.duration ? `${item.duration} 分钟` : '不限时'}
        </span>
        <span className="flex items-center gap-1">
          <CalendarClock className="w-3 h-3" />
          {item.startTime
            ? `${formatDateTime(item.startTime)}${item.endTime ? ` ~ ${formatDateTime(item.endTime)}` : ''}`
            : '不限时间'}
        </span>
      </div>
      <div className="px-5 pb-5 pt-3 flex-1 flex flex-col justify-between gap-3">
        {item.submitted && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">已交卷</span>
            {item.score != null && (
              <span className="font-semibold text-green-600">
                {item.score}/{item.totalScore} 分
              </span>
            )}
          </div>
        )}
        {!item.participatable && item.studentView && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3 h-3" />
            仅限指定班级参加
          </div>
        )}
        {!item.participatable && !item.studentView && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3 h-3" />
            仅学生可参加
          </div>
        )}
        <div>
          {canEnter ? (
            <Button
              asChild
              className="w-full rounded-[10px] h-9 text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-md shadow-primary/20"
            >
              <Link href={entryHref}>
                <PlayCircle className="w-3.5 h-3.5 mr-1" /> 开始考试
              </Link>
            </Button>
          ) : item.submitted ? (
            <Button
              asChild
              variant="outline"
              className="w-full rounded-[10px] h-9 text-xs text-green-600 border-green-200 hover:bg-green-50"
            >
              <Link href={entryHref}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 查看结果
              </Link>
            </Button>
          ) : (
            <Button
              disabled
              className="w-full rounded-[10px] h-9 text-xs bg-slate-100 text-slate-400 cursor-not-allowed"
            >
              {finished ? '考试已结束' : '不可参加'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

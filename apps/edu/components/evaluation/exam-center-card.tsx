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

const coverGradients = [
  'linear-gradient(135deg,#7c3aed,#8b5cf6)',
  'linear-gradient(135deg,#a855f7,#c084fc)',
  'linear-gradient(135deg,#6366f1,#818cf8)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#f43f5e,#fb7185)',
  'linear-gradient(135deg,#8b5cf6,#a78bfa)',
]

function gradientFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return coverGradients[h % coverGradients.length]
}

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
        className="h-[110px] flex items-center justify-center shrink-0 relative"
        style={
          coverImage
            ? {
                backgroundImage: `url('${coverImage}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { background: gradientFor(item.id) }
        }
      >
        {!coverImage && <ClipboardList className="w-12 h-12 text-white/80" />}
        <Badge
          variant="outline"
          className={cn(
            'absolute top-3 right-3 h-5 px-2 text-[11px] rounded-full bg-white/90 backdrop-blur-sm border-white/40 shadow-sm gap-1',
            status.text,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
          {status.label}
        </Badge>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-[15px] font-semibold text-slate-800 truncate">{item.usageName}</h3>
        <p className="text-xs text-slate-400 mt-1 truncate">试卷：{item.examName}</p>
        <div className="flex items-center gap-4 text-[11px] text-slate-400 py-3 mt-2 border-b border-slate-50 whitespace-nowrap">
          <span className="flex items-center gap-1 shrink-0">
            <FileText className="w-3 h-3" /> {item.questionCount} 题
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" /> {item.duration ? `${item.duration} 分钟` : '不限时'}
          </span>
          <span className="flex items-center gap-1 min-w-0 shrink">
            <CalendarClock className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {item.startTime
                ? `${formatDate(item.startTime)}${item.endTime ? ` ~ ${formatDate(item.endTime)}` : ''}`
                : '不限时间'}
            </span>
          </span>
        </div>
        <div className="pt-3 flex-1 flex flex-col justify-between gap-3">
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
    </div>
  )
}

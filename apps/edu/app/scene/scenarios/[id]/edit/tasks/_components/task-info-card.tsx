'use client'

import { Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface TaskInfoCardProps {
  name: string
  onNameChange: (v: string) => void
  type: string
  onTypeChange: (v: string) => void
  difficulty: number
  onDifficultyChange: (v: number) => void
  hours: number | string
  onHoursChange: (v: number) => void
  background?: string
  onBackgroundChange?: (v: string) => void
  hoursLabel?: string
  showBackground?: boolean
  showName?: boolean
  showType?: boolean
}

export function TaskInfoCard({
  name,
  onNameChange,
  type,
  onTypeChange,
  difficulty,
  onDifficultyChange,
  hours,
  onHoursChange,
  background,
  onBackgroundChange,
  hoursLabel = '学生完成任务的预估时长',
  showBackground = true,
  showName = true,
  showType = true,
}: TaskInfoCardProps) {
  return (
    <div className="space-y-4">
      {showName && (
        <div>
          <Label>任务名称</Label>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} className="mt-1.5" />
        </div>
      )}
      {showType && (
        <div>
          <Label>任务类型</Label>
          <Select value={type} onValueChange={onTypeChange}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="training">训练任务</SelectItem>
              <SelectItem value="assessment">考核任务</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <Label>预估学时</Label>
          <span className="text-xs text-gray-400">{hoursLabel}</span>
        </div>
        <Input
          type="number"
          value={hours || ''}
          onChange={(e) => onHoursChange(+e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label>难度</Label>
        <div className="flex gap-1 mt-1.5">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button key={n} onClick={() => onDifficultyChange(n)}>
              <Star
                className={cn(
                  'h-6 w-6',
                  n <= difficulty ? 'fill-amber-400 text-amber-400' : 'text-gray-200',
                )}
              />
            </button>
          ))}
        </div>
      </div>
      {showBackground && (
        <div>
          <Label>背景介绍</Label>
          <Textarea
            value={background || ''}
            onChange={(e) => onBackgroundChange?.(e.target.value)}
            className="mt-1.5"
            rows={3}
          />
        </div>
      )}
    </div>
  )
}

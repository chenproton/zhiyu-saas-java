"use client"

import { Star } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface LocalTask {
  name: string
  type: string
  difficulty: number
  hours: number
  background: string
}

interface TaskInfoCardProps {
  localTask: LocalTask
  onUpdate: (u: Partial<LocalTask>) => void
}

export function TaskInfoCard({ localTask, onUpdate }: TaskInfoCardProps) {
  return (
    <div className="space-y-4">
      <div><Label>任务名称</Label><Input value={localTask.name} onChange={e => onUpdate({ name: e.target.value })} className="mt-1.5" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>任务类型</Label><Select value={localTask.type} onValueChange={v => onUpdate({ type: v as "assessment" | "training" })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="training">训练</SelectItem><SelectItem value="assessment">考核</SelectItem></SelectContent></Select></div>
        <div>
          <div className="flex items-center gap-2">
            <Label>预估学时</Label>
            <span className="text-xs text-gray-400">学生完成任务的预估时长</span>
          </div>
          <Input type="number" value={localTask.hours} onChange={e => onUpdate({ hours: +e.target.value })} className="mt-1.5" />
        </div>
      </div>
      <div><Label>难度</Label><div className="flex gap-1 mt-1.5">{([1, 2, 3, 4, 5] as const).map(n => <button key={n} onClick={() => onUpdate({ difficulty: n })}><Star className={cn("h-6 w-6", n <= localTask.difficulty ? "fill-amber-400 text-amber-400" : "text-gray-200")} /></button>)}</div></div>
      <div><Label>背景</Label><Textarea value={localTask.background} onChange={e => onUpdate({ background: e.target.value })} className="mt-1.5" rows={3} /></div>
    </div>
  )
}

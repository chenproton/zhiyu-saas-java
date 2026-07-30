"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useToast } from "@zhiyu/ui"
import { scheduleApi, ScheduleConflictError } from "@/lib/api"
import type { TeachingPlanEntry, Venue, ScheduleConflict } from "@/lib/types"

const DAY_LABELS_SHORT = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

interface QuickAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: TeachingPlanEntry | null
  termId: string
  venues: Venue[]
  /** 预选信息来自 grid 点击 */
  prefillDay?: number
  periodSlotNames: string[]
  onSaved: () => void
}

export function QuickAssignDialog({
  open, onOpenChange, entry, termId, venues,
  prefillDay, periodSlotNames, onSaved,
}: QuickAssignDialogProps) {
  const { toast } = useToast()
  const [dayOfWeek, setDayOfWeek] = useState("1")
  const [periods, setPeriods] = useState<string[]>([])
  const [venueId, setVenueId] = useState("")
  const [saving, setSaving] = useState(false)
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])

  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open && entry) {
      setDayOfWeek(prefillDay ? String(prefillDay) : "1")
      setPeriods([])
      setVenueId("")
      setConflicts([])
    }
  }

  const togglePeriod = (name: string) => {
    setPeriods((prev) => prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name])
  }

  const handleSave = async () => {
    if (!entry) return
    if (periods.length === 0) { toast({ variant: "destructive", title: "请选择节次" }); return }
    setSaving(true)
    setConflicts([])
    try {
      await scheduleApi.create({
        termId,
        planEntryId: entry.id,
        courseName: entry.courseName || "",
        courseCode: entry.courseCode || undefined,
        courseId: entry.courseId || undefined,
        type: entry.type || "traditional",
        classNodeId: entry.classNodeId || "",
        teacherId: entry.teacherId || undefined,
        dayOfWeek: Number(dayOfWeek),
        periods,
        startWeek: entry.startWeek || 1,
        endWeek: entry.endWeek || 1,
        weekPattern: entry.weekPattern || "all",
        venueId: venueId || undefined,
        scenarioId: entry.scenarioId || undefined,
      })
      toast({ title: "排课成功", description: `${entry.courseName} 已排入 ${DAY_LABELS_SHORT[Number(dayOfWeek) - 1]} ${periods.join("、")}` })
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      if (err instanceof ScheduleConflictError && err.conflicts) {
        setConflicts(err.conflicts)
      } else {
        toast({ variant: "destructive", title: "排课失败", description: err.message || "请稍后重试" })
      }
    } finally { setSaving(false) }
  }

  if (!entry) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>快速排课</DialogTitle>
          <DialogDescription>
            {entry.courseName} · 第 {entry.startWeek}-{entry.endWeek} 周 · {entry.teacherName || "未指定教师"}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-4">
          <Field>
            <FieldLabel>上课日</FieldLabel>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_LABELS_SHORT.map((d, i) => <SelectItem key={i + 1} value={String(i + 1)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>节次（可多选）</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {periodSlotNames.map((name) => (
                <label key={name} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={periods.includes(name)} onCheckedChange={() => togglePeriod(name)} />
                  <span className="text-sm">{name}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field>
            <FieldLabel>场地</FieldLabel>
            <Select value={venueId || "none"} onValueChange={(v) => setVenueId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="选择场地" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不指定</SelectItem>
                {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}（{v.type}）</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {conflicts.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium mb-1">排课冲突：</p>
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs">· {c.kind === "teacher" ? "教师" : c.kind === "class" ? "班级" : "场地"}冲突：{c.courseName}（{c.dayOfWeek > 0 ? DAY_LABELS_SHORT[c.dayOfWeek - 1] : ""} {Array.isArray(c.periods) ? c.periods.join("、") : ""}）</p>
              ))}
            </div>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={saving || periods.length === 0}>{saving ? "保存中..." : "确认排课"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

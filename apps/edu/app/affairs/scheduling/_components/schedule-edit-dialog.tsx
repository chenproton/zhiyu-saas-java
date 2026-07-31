"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@zhiyu/ui"
import { UserSelector } from "@/components/shared/user-selector"
import { MultiOrgNodePicker } from "@/components/shared/multi-org-node-picker"
import { scheduleApi, teachingPlanApi } from "@/lib/api"
import type { ScheduleEntry, Venue } from "@/lib/types"
import { usePortalAuth } from "@/contexts/portal-auth-context"

interface ScheduleEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: ScheduleEntry | null
  venues: Venue[]
  onSaved: () => void
}

export function ScheduleEditDialog({ open, onOpenChange, entry, venues, onSaved }: ScheduleEditDialogProps) {
  const { toast } = useToast()
  const { tenantId } = usePortalAuth()
  const [venueId, setVenueId] = useState("")
  const [classNodeIds, setClassNodeIds] = useState<string[]>([])
  const [teacherId, setTeacherId] = useState("")
  const [saving, setSaving] = useState(false)

  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open && entry) {
      setVenueId(entry.venueId || "")
      setClassNodeIds(entry.classNodeId ? [entry.classNodeId] : [])
      setTeacherId(entry.teacherId || "")
    }
  }

  const handleSave = async () => {
    if (!entry) return
    setSaving(true)
    try {
      const updated = await scheduleApi.update(entry.id, {
        termId: entry.termId,
        planEntryId: entry.planEntryId,
        courseName: entry.courseName,
        courseCode: entry.courseCode || undefined,
        courseId: entry.courseId || undefined,
        type: entry.type,
        classNodeId: classNodeIds[0] || "",
        teacherId: teacherId || undefined,
        dayOfWeek: entry.dayOfWeek,
        periods: entry.periods,
        startWeek: entry.startWeek,
        endWeek: entry.endWeek,
        weekPattern: entry.weekPattern,
        venueId: venueId || undefined,
        scenarioId: entry.scenarioId || undefined,
      })
      if (classNodeIds.length > 0 && entry.planEntryId) {
        await teachingPlanApi.updateEntry(entry.planEntryId, { classNodeIds }).catch(() => {})
      }
      toast({ title: "已更新" })
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      toast({ variant: "destructive", title: "更新失败", description: err.message || "请稍后重试" })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑排课 · {entry?.courseName}</DialogTitle>
          <DialogDescription>仅可修改班级、教师、场地</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">授课班级</label>
            <MultiOrgNodePicker tenantId={tenantId} value={classNodeIds} onChange={setClassNodeIds}
              selectableTypes={["班级"]} placeholder="选择班级" title="选择授课班级" maxVisible={3} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">授课教师</label>
            <UserSelector value={teacherId ? [teacherId] : []}
              onChange={(ids) => setTeacherId(ids[0] || "")}
              multiple={false} placeholder={entry?.teacherName || "选择教师"} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">场地</label>
            <Select value={venueId || "none"} onValueChange={(v) => setVenueId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="选择场地" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不指定</SelectItem>
                {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}（{v.type}）</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

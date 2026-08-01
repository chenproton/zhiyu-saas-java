'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { useToast } from '@zhiyu/ui'
import { teachingPlanApi } from '@/lib/api'
import type { TeachingPlanEntry } from '@/lib/types'
import { usePortalUsers } from '@/hooks/use-portal-users'

const TEACHER_TYPE_OPTIONS = ['校本师资', '企业导师']

interface AssignTeacherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: TeachingPlanEntry | null
  onSaved: (entry: TeachingPlanEntry) => void
}

export function AssignTeacherDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
}: AssignTeacherDialogProps) {
  const { toast } = useToast()
  const { users, loading: usersLoading } = usePortalUsers({ roleCode: 'teacher', pageSize: 100 })
  const [teacherType, setTeacherType] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [saving, setSaving] = useState(false)

  // 弹窗重新打开时在渲染期间回填当前条目信息（adjust-state-during-render 模式）
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open && entry) {
      setTeacherType(entry.teacherType || '')
      setTeacherId(entry.teacherId || '')
    }
  }

  const handleSave = async () => {
    if (!entry) return
    setSaving(true)
    try {
      const updated = await teachingPlanApi.updateEntry(entry.id, {
        teacherType: teacherType || '',
        teacherId: teacherId || '',
      })
      toast({ title: '教师已指定' })
      onOpenChange(false)
      onSaved(updated)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err.message || '指定教师失败',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>指定教师</DialogTitle>
          <DialogDescription>为「{entry?.courseName || ''}」指定授课教师</DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-4">
          <Field>
            <FieldLabel>师资类型</FieldLabel>
            <Select
              value={teacherType || 'none'}
              onValueChange={(v) => setTeacherType(v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择师资类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未设置</SelectItem>
                {TEACHER_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>授课教师</FieldLabel>
            <Select
              value={teacherId || 'none'}
              onValueChange={(v) => setTeacherId(v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={usersLoading ? '加载中...' : '请选择教师'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未指定</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                    {u.workId ? `（${u.workId}）` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

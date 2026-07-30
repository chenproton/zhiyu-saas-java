"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useToast } from "@zhiyu/ui"
import { programApi, termApi, teachingPlanApi } from "@/lib/api"
import type { AffairsTerm, TeachingPlanDetail, TrainingProgram } from "@/lib/types"

interface GeneratePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (plan: TeachingPlanDetail) => void
}

export function GeneratePlanDialog({ open, onOpenChange, onGenerated }: GeneratePlanDialogProps) {
  const { toast } = useToast()
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [terms, setTerms] = useState<AffairsTerm[]>([])
  const [programId, setProgramId] = useState("")
  const [termId, setTermId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // 弹窗重新打开时在渲染期间重置选项（React 推荐的 adjust-state-during-render 模式）
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setProgramId("")
      setTermId("")
    }
  }

  const loadOptions = useCallback(async () => {
    try {
      const [programRes, termRes] = await Promise.all([
        programApi.list({ status: "published", limit: 200 }),
        termApi.list({ limit: 100 }),
      ])
      setPrograms(programRes.items)
      setTerms(termRes.items)
    } catch (err: any) {
      toast({ variant: "destructive", title: "加载失败", description: err.message || "加载方案或学期失败" })
    }
  }, [toast])

  useEffect(() => {
    if (!open) return
    // async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadOptions()
    })()
  }, [open, loadOptions])

  const handleGenerate = async () => {
    if (!programId || !termId) return
    setSubmitting(true)
    try {
      const plan = await teachingPlanApi.generate({ programId, termId })
      toast({ title: "教学计划已生成", description: `共 ${plan.entries.length} 个教学条目` })
      onOpenChange(false)
      onGenerated(plan)
    } catch (err: any) {
      // 后端 409：该方案在此学期已生成教学计划
      toast({ variant: "destructive", title: "生成失败", description: err.message || "生成教学计划失败" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>从人培方案生成教学计划</DialogTitle>
          <DialogDescription>选择已发布的人培方案与目标学期，系统将按方案课程自动生成教学条目</DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-4">
          <Field>
            <FieldLabel>人培方案（已发布）*</FieldLabel>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择人培方案" />
              </SelectTrigger>
              <SelectContent>
                {programs.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    暂无已发布的人培方案
                  </SelectItem>
                ) : (
                  programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}（{p.entryYear} 级）
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>目标学期 *</FieldLabel>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择学期" />
              </SelectTrigger>
              <SelectContent>
                {terms.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    暂无学期数据
                  </SelectItem>
                ) : (
                  terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isCurrent ? "（当前学期）" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleGenerate} disabled={!programId || !termId || submitting}>
            {submitting ? "生成中..." : "生成教学计划"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

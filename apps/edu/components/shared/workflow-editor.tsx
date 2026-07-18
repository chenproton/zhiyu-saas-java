"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelectSearch } from "@/components/ui/multi-select-search"
import { UserSelector } from "@/components/shared/user-selector"

export interface WorkflowStepEditor {
  name: string
  approverIds: string[]
  approvalMode: "any" | "all"
}

export function buildWorkflowSteps(steps: WorkflowStepEditor[]) {
  return steps
    .filter((s) => s.name.trim())
    .map((s, index) => ({
      name: s.name.trim(),
      order: index,
      approverIds: s.approverIds,
      approvalMode: s.approvalMode,
    }))
}

interface WorkflowEditorProps {
  majors: { id: string; name: string }[]
  majorIds: string[]
  onMajorIdsChange: (value: string[]) => void
  name: string
  onNameChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  steps: WorkflowStepEditor[]
  onStepsChange: (steps: WorkflowStepEditor[]) => void
  error?: string | null
}

export function WorkflowEditor({
  error,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  steps,
  onStepsChange,
  majorIds,
  onMajorIdsChange,
  majors,
}: WorkflowEditorProps) {
  const handleAddStep = () => {
    onStepsChange([...steps, { name: "", approverIds: [], approvalMode: "any" }])
  }

  const handleRemoveStep = (index: number) => {
    onStepsChange(steps.filter((_, i) => i !== index))
  }

  const handleStepChange = (index: number, field: keyof WorkflowStepEditor, value: string | "any" | "all" | string[]) => {
    onStepsChange(
      steps.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="workflowName">流程名称</Label>
        <Input
          id="workflowName"
          placeholder="例如：校级审批流程"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">流程说明</Label>
        <Textarea
          id="description"
          placeholder="描述该流程的适用场景和审批规则..."
          rows={2}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
      {majors.length > 0 && (
        <div className="grid gap-2">
          <Label>适用专业</Label>
          <MultiSelectSearch
            options={majors.map((m) => ({ label: m.name, value: m.id }))}
            selected={majorIds}
            onChange={onMajorIdsChange}
            placeholder="选择适用专业"
            searchPlaceholder="搜索专业名称..."
            emptyText="暂无专业"
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          审批步骤
        </Label>
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
          {steps.map((step, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="w-6 h-6 p-0 flex items-center justify-center shrink-0">
                  {index + 1}
                </Badge>
                <Input
                  placeholder="步骤名称（如：教研组长审批）"
                  className="flex-1"
                  value={step.name}
                  onChange={(e) => handleStepChange(index, "name", e.target.value)}
                />
                {steps.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleRemoveStep(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
              <div className="flex items-start gap-2 pl-8">
                <div className="flex-1">
                  <UserSelector
                    value={step.approverIds}
                    onChange={(ids) => handleStepChange(index, "approverIds", ids as any)}
                    multiple
                    placeholder="选择审批人"
                    excludeStudent
                    usePortalApi={false}
                  />
                </div>
                <Select
                  value={step.approvalMode}
                  onValueChange={(v) => handleStepChange(index, "approvalMode", v)}
                >
                  <SelectTrigger className="w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">任一通过</SelectItem>
                    <SelectItem value="all">全员通过</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={handleAddStep}>
            <Plus className="mr-2 h-4 w-4" />
            添加步骤
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

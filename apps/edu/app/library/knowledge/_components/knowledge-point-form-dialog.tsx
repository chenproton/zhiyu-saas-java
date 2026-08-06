'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  GranularLessonSelectDialog,
  type GranularLessonOption,
} from './granular-lesson-select-dialog'
import { TagPicker } from '@/components/shared/tag-picker'

export interface KnowledgePointFormValues {
  name: string
  description: string
  code: string
  granularLessonIds: string[]
  tagIds: string[]
}

interface KnowledgePointFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit' | 'clone'
  initialValues?: Partial<KnowledgePointFormValues>
  granularCourses: GranularLessonOption[]
  onSave: (values: KnowledgePointFormValues) => void
  onCreateGranularLesson?: () => string | Promise<string | undefined> | undefined
}

function generateKpCode() {
  return `KP-${Date.now().toString().slice(-6)}`
}

export function KnowledgePointFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  granularCourses,
  onSave,
  onCreateGranularLesson,
}: KnowledgePointFormDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [granularLessonIds, setGranularLessonIds] = useState<string[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [glSelectOpen, setGlSelectOpen] = useState(false)

  useEffect(() => {
    ;(async () => {
      if (open) {
        setName(initialValues?.name ?? '')
        setDescription(initialValues?.description ?? '')
        setCode(initialValues?.code ?? (mode === 'edit' ? '' : generateKpCode()))
        setGranularLessonIds(initialValues?.granularLessonIds ?? [])
        setTagIds(initialValues?.tagIds ?? [])
      }
    })()
  }, [open, initialValues, mode])

  const title = mode === 'add' ? '新增知识点' : mode === 'clone' ? '克隆知识点' : '编辑知识点'
  const desc =
    mode === 'add'
      ? '创建一个新的知识点'
      : mode === 'clone'
        ? `基于「${initialValues?.name ?? ''}」创建副本`
        : '修改知识点信息'

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      description: description.trim(),
      code: code.trim(),
      granularLessonIds,
      tagIds,
    })
  }

  const selectedGranularLessons = granularCourses.filter((g) => granularLessonIds.includes(g.id))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{desc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>知识点名称</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入知识点名称"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入知识点描述"
                className="mt-1.5 max-h-[120px] overflow-y-auto resize-none"
                rows={3}
              />
            </div>
            <div>
              <Label>编码</Label>
              <Input
                value={code}
                disabled={mode !== 'edit'}
                onChange={(e) => setCode(e.target.value)}
                className={cn('mt-1.5', mode !== 'edit' && 'bg-gray-50')}
              />
              <p className="text-xs text-gray-400 mt-1">
                {mode === 'edit' ? '可修改编码' : '系统自动生成，不可修改'}
              </p>
            </div>
            <div>
              <Label>标签</Label>
              <div className="mt-1.5">
                <TagPicker value={tagIds} onChange={setTagIds} className="w-full" />
              </div>
            </div>
            <div>
              <Label>关联颗粒课</Label>
              <div className="mt-1.5">
                {selectedGranularLessons.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedGranularLessons.map((gl) => (
                      <Badge key={gl.id} variant="secondary" className="text-xs gap-1">
                        {gl.name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() =>
                            setGranularLessonIds((prev) => prev.filter((x) => x !== gl.id))
                          }
                        />
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setGlSelectOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    选择颗粒课
                  </Button>
                  {onCreateGranularLesson && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        const newId = await onCreateGranularLesson()
                        if (newId) {
                          setGranularLessonIds((prev) =>
                            prev.includes(newId) ? prev : [...prev, newId],
                          )
                        }
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      新建颗粒课
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {mode === 'add' ? '新增并选中' : mode === 'clone' ? '克隆并选中' : '保存修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GranularLessonSelectDialog
        open={glSelectOpen}
        onOpenChange={setGlSelectOpen}
        title="选择颗粒课"
        granularCourses={granularCourses}
        selectedIds={granularLessonIds}
        onChange={setGranularLessonIds}
      />
    </>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { useToast } from '@zhiyu/ui'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { MajorSelect } from '@/components/shared/major-select'
import { programApi } from '@/lib/api'
import type { TrainingProgram, TrainingProgramPayload } from '@/lib/types'
import { ProgramCoursesTab } from './_components/courses-tab'

const LEVEL_OPTIONS = ['中专', '大专', '本科']

export default function ProgramEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id
  const isNew = id === 'new'
  const coursesRef = useRef<any>(null)

  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('basic')
  const [coursesBusy, setCoursesBusy] = useState({ saving: false, loading: true })

  // 基本信息表单
  const [name, setName] = useState('')
  const [majorId, setMajorId] = useState<string | undefined>(undefined)
  const [entryYear, setEntryYear] = useState('')
  const [level, setLevel] = useState('')
  const [duration, setDuration] = useState('')
  const [description, setDescription] = useState('')

  const loadProgram = useCallback(async () => {
    if (isNew) return
    try {
      const p = await programApi.get(id)
      setProgram(p)
      setName(p.name)
      setMajorId(p.majorId || undefined)
      setEntryYear(String(p.entryYear))
      setLevel(p.level || '')
      setDuration(p.duration != null ? String(p.duration) : '')
      setDescription(p.description || '')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '加载失败',
        description: err.message || '查询人培方案失败',
      })
    } finally {
      setLoading(false)
    }
  }, [id, isNew, toast])

  useEffect(() => {
    // 首屏加载：async IIFE 包裹，避免在 effect 体内同步触发 setState
    ;(async () => {
      await loadProgram()
    })()
  }, [loadProgram])

  const isFormValid = name.trim() !== '' && Number(entryYear) > 0

  const handleSaveBasic = async () => {
    if (!isFormValid) return
    setSaving(true)
    const payload: TrainingProgramPayload = {
      name: name.trim(),
      entryYear: Number(entryYear),
      majorId: majorId || undefined,
      level: level || undefined,
      duration: duration ? Number(duration) : undefined,
      description: description.trim() || undefined,
    }
    try {
      if (isNew) {
        const created = await programApi.create(payload)
        toast({ title: '方案已创建', description: '可继续维护课程设置' })
        router.replace(`/affairs/programs/${created.id}`)
      } else {
        const updated = await programApi.update(id, payload)
        setProgram(updated)
        toast({ title: '基本信息已保存' })
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '保存失败', description: err.message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title={isNew ? '新建人培方案' : program?.name || '方案编辑'}
        description="维护方案基本信息与课程设置，发布后可用于生成教学计划"
        actions={
          <div className="flex items-center gap-2">
            {program && <StatusBadge status={program.status} />}
            <Button variant="outline" onClick={() => router.push('/affairs/programs')}>
              <ArrowLeft className="mr-2 size-4" />
              返回列表
            </Button>
            {!isNew && tab === 'courses' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => coursesRef.current?.openImport()}
                >
                  <Upload className="mr-1 size-4" />
                  导入
                </Button>
                <Button variant="outline" size="sm" onClick={() => coursesRef.current?.addRow()}>
                  <Plus className="mr-1 size-4" />
                  添加岗位/课程
                </Button>
                <Button
                  size="sm"
                  onClick={() => coursesRef.current?.handleSave()}
                  disabled={coursesBusy.saving || coursesBusy.loading}
                >
                  <Save className="mr-1 size-4" />
                  {coursesBusy.saving ? '保存中...' : '保存'}
                </Button>
              </>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">
          加载中...
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="courses" disabled={isNew}>
              课程设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <div className="rounded-lg border bg-white p-6">
              <FieldGroup>
                <Field>
                  <FieldLabel>方案名称 *</FieldLabel>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="如：计算机应用技术人才培养方案（2025 级）"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>所属专业</FieldLabel>
                    <MajorSelect value={majorId} onChange={setMajorId} placeholder="请选择专业" />
                  </Field>
                  <Field>
                    <FieldLabel>入学年份 *</FieldLabel>
                    <Input
                      type="number"
                      value={entryYear}
                      onChange={(e) => setEntryYear(e.target.value)}
                      placeholder="如：2025"
                      min={2000}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>层次</FieldLabel>
                    <Select
                      value={level || 'none'}
                      onValueChange={(v) => setLevel(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择层次" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">未设置</SelectItem>
                        {LEVEL_OPTIONS.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>学制（年）</FieldLabel>
                    <Input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="如：3"
                      min={0}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>方案描述</FieldLabel>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="培养目标、规格要求等（可选）"
                    rows={4}
                  />
                </Field>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/affairs/programs')}
                    disabled={saving}
                  >
                    取消
                  </Button>
                  <Button onClick={handleSaveBasic} disabled={!isFormValid || saving}>
                    <Save className="mr-2 size-4" />
                    {saving ? '保存中...' : isNew ? '创建方案' : '保存基本信息'}
                  </Button>
                </div>
              </FieldGroup>
            </div>
          </TabsContent>

          <TabsContent value="courses">
            {!isNew && (
              <ProgramCoursesTab programId={id} ref={coursesRef} onBusyChange={setCoursesBusy} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

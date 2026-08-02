'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { MultiSelect } from '@/components/ui/multi-select'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { portalRequest } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import type { AllianceEnterprise, AllianceProject, AllianceListResponse } from '@/lib/types'

const SECONDARY_COLLEGES = [
  '智能制造学院',
  '信息技术学院',
  '经济管理学院',
  '艺术设计学院',
  '新能源工程学院',
  '生物医药学院',
  '现代服务学院',
  '国际教育学院',
  '创新创业学院',
  '继续教育学院',
  '基础教育学院',
  '马克思主义学院',
]

export default function AllianceAchievementNewPage() {  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([])
  const [item, setItem] = useState({
    title: '',
    type: 'custom',
    description: '',
    achievementDate: '',
    isPublic: false,
    enterpriseIds: [] as string[],
    projectIds: [] as string[],
    secondaryColleges: [] as string[],
  })

  useEffect(() => {
    Promise.all([
      portalRequest<AllianceListResponse<AllianceEnterprise>>('/alliance/enterprises?limit=1000'),
      portalRequest<AllianceListResponse<AllianceProject>>('/alliance/projects?limit=1000'),
    ])
      .then(([ents, projs]) => {
        setEnterprises((ents.items || []).map((e) => ({ label: e.name, value: e.id })))
        setProjects((projs.items || []).map((p) => ({ label: p.name, value: p.id })))
      })
      .catch(() => {})
  }, [])

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await portalRequest<{ id: string }>('/alliance/achievements', {
        method: 'POST',
        body: JSON.stringify(item),
      })
      toast({ title: '成果已创建' })
      router.push(`/portal/apps/alliance/achievements/${data.id}`)
    } catch (e: any) {
      toast({ title: '保存失败', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <h1 className="text-xl font-bold">新建合作成果</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <FormFieldGrid>
              <FormFieldRow label="成果名称" required>
                <Input
                  value={item.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="请输入成果名称"
                />
              </FormFieldRow>
              <FormFieldRow label="成果类型">
                <Select value={item.type} onValueChange={(v) => setField('type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job">岗位</SelectItem>
                    <SelectItem value="scene">场景</SelectItem>
                    <SelectItem value="course">课程</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </FormFieldRow>
              <FormFieldRow label="成果日期">
                <Input
                  value={item.achievementDate}
                  onChange={(e) => setField('achievementDate', e.target.value)}
                  type="date"
                />
              </FormFieldRow>
            </FormFieldGrid>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>成果描述</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={item.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={5}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>归属项目</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={item.projectIds?.[0] || '__none'}
                onValueChange={(v) => setField('projectIds', v === '__none' ? [] : [v])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择归属项目（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">不关联项目</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>合作企业</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={enterprises}
                value={item.enterpriseIds}
                onChange={(v) => setField('enterpriseIds', v)}
                placeholder="选择合作企业"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>二级学院</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={SECONDARY_COLLEGES}
                value={item.secondaryColleges}
                onChange={(v) => setField('secondaryColleges', v)}
                placeholder="选择归属学院"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>公开显示</Label>
                <Switch checked={item.isPublic} onCheckedChange={(v) => setField('isPublic', v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}创建
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.back()}>
                取消
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

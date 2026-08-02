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
import { SingleImageUpload } from '@/components/shared/image-list-upload'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'

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

const PROJECT_TYPES = [
  '人才培养项目',
  '技术研发项目',
  '基地建设项目',
  '技能竞赛项目',
  '创新创业项目',
  '师资培训项目',
  '课程开发项目',
  '专业共建项目',
]

export default function AllianceProjectNewPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [item, setItem] = useState({
    name: '',
    type: '人才培养项目',
    phase: 'initiation',
    startDate: '',
    endDate: '',
    budget: '',
    description: '',
    isPublic: false,
    coverImage: '',
    enterpriseIds: [] as string[],
    secondaryColleges: [] as string[],
  })

  useEffect(() => {
    allianceEnterpriseApi
      .list({ limit: 1000 })
      .then((res) => setEnterprises((res.items || []).map((e) => ({ label: e.name, value: e.id }))))
      .catch(() => {})
  }, [])

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await allianceProjectApi.create(item)
      toast({ title: '项目已创建' })
      router.push(`/portal/apps/alliance/projects/${data.id}`)
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
        <h1 className="text-xl font-semibold text-foreground">新建合作项目</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <FormFieldGrid>
              <FormFieldRow label="项目名称" required>
                <Input
                  value={item.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="请输入项目名称"
                />
              </FormFieldRow>
              <FormFieldRow label="合作类型">
                <Select value={item.type} onValueChange={(v) => setField('type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormFieldRow>
              <FormFieldRow label="项目阶段">
                <Select value={item.phase} onValueChange={(v) => setField('phase', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initiation">启动</SelectItem>
                    <SelectItem value="execution">执行中</SelectItem>
                    <SelectItem value="acceptance">验收</SelectItem>
                    <SelectItem value="closure">关闭</SelectItem>
                  </SelectContent>
                </Select>
              </FormFieldRow>
              <FormFieldRow label="预算">
                <Input
                  value={item.budget}
                  onChange={(e) => setField('budget', e.target.value)}
                  placeholder="如：50万"
                />
              </FormFieldRow>
              <FormFieldRow label="开始日期">
                <Input
                  value={item.startDate}
                  onChange={(e) => setField('startDate', e.target.value)}
                  type="date"
                />
              </FormFieldRow>
              <FormFieldRow label="结束日期">
                <Input
                  value={item.endDate}
                  onChange={(e) => setField('endDate', e.target.value)}
                  type="date"
                />
              </FormFieldRow>
            </FormFieldGrid>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>项目描述</CardTitle>
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
              <CardTitle>项目封面</CardTitle>
            </CardHeader>
            <CardContent>
              <SingleImageUpload
                label="项目封面"
                value={item.coverImage}
                onChange={(v) => setField('coverImage', v)}
              />
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

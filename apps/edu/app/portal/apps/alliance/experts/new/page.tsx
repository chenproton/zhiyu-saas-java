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
import { SingleImageUpload, ImageListUpload } from '@/components/shared/image-list-upload'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { ArrowLeft, Loader2, X, Plus } from 'lucide-react'
import { allianceExpertApi, allianceEnterpriseApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
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

export default function AllianceExpertNewPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [item, setItem] = useState({
    name: '',
    gender: 'male',
    age: undefined as number | undefined,
    city: '',
    title: '',
    position: '',
    experienceYears: undefined as number | undefined,
    education: '',
    industry: '',
    specialties: [] as string[],
    introduction: '',
    workExperience: '',
    avatarUrl: '',
    coverImage: '',
    attachments: [] as string[],
    partnerSource: 'cooperation',
    enterpriseId: '',
    organization: '',
    secondaryColleges: [] as string[],
    status: 'active',
    isPublic: false,
  })
  const [specialtyInput, setSpecialtyInput] = useState('')

  useEffect(() => {
    allianceEnterpriseApi.list({ limit: 1000 })
      .then((res) => setEnterprises((res.items || []).map((e) => ({ label: e.name, value: e.id }))))
      .catch((err) => {
        reportError(err, '加载企业下拉数据')
        toast({
          title: '企业列表加载失败',
          description: '可稍后重试，或选择第三方机构来源',
          variant: 'destructive',
        })
      })
  }, [toast])

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const addSpecialty = () => {
    const v = specialtyInput.trim()
    if (v && !item.specialties.includes(v)) setField('specialties', [...item.specialties, v])
    setSpecialtyInput('')
  }

  const handleSave = async () => {
    if (!item.name) {
      toast({ title: '请填写姓名', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = { ...item }
      if (item.partnerSource === 'cooperation') {
        const ent = enterprises.find((e) => e.value === item.enterpriseId)
        payload.organization = ent?.label || ''
      } else {
        payload.enterpriseId = ''
      }
      const data = await allianceExpertApi.create(payload)
      toast({ title: '专家已创建' })
      router.push(`/portal/apps/alliance/experts/${data.id}`)
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
        <h1 className="text-xl font-semibold text-foreground">新建专家</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基础信息</CardTitle>
            </CardHeader>
            <FormFieldGrid>
              <FormFieldRow label="姓名" required>
                <Input value={item.name} onChange={(e) => setField('name', e.target.value)} />
              </FormFieldRow>
              <FormFieldRow label="性别">
                <Select value={item.gender} onValueChange={(v) => setField('gender', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">男</SelectItem>
                    <SelectItem value="female">女</SelectItem>
                  </SelectContent>
                </Select>
              </FormFieldRow>
              <FormFieldRow label="年龄">
                <Input
                  type="number"
                  value={item.age ?? ''}
                  onChange={(e) =>
                    setField('age', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="所在城市">
                <Input value={item.city} onChange={(e) => setField('city', e.target.value)} />
              </FormFieldRow>
              <FormFieldRow label="职称/职位">
                <Input
                  value={item.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="如：高级工程师"
                />
              </FormFieldRow>
              <FormFieldRow label="任职岗位">
                <Input
                  value={item.position}
                  onChange={(e) => setField('position', e.target.value)}
                />
              </FormFieldRow>
              <FormFieldRow label="从业年限">
                <Input
                  type="number"
                  value={item.experienceYears ?? ''}
                  onChange={(e) =>
                    setField('experienceYears', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </FormFieldRow>
              <FormFieldRow label="教育背景">
                <Input
                  value={item.education}
                  onChange={(e) => setField('education', e.target.value)}
                  placeholder="如：XX大学 硕士"
                />
              </FormFieldRow>
              <FormFieldRow label="行业方向">
                <Input
                  value={item.industry}
                  onChange={(e) => setField('industry', e.target.value)}
                  placeholder="如：智能制造"
                />
              </FormFieldRow>
            </FormFieldGrid>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>专家形象</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SingleImageUpload
                label="专家头像"
                value={item.avatarUrl}
                onChange={(v) => setField('avatarUrl', v)}
              />
              <SingleImageUpload
                label="专家主页封面"
                value={item.coverImage}
                onChange={(v) => setField('coverImage', v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>擅长领域</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {item.specialties.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-600 px-2 py-0.5 text-xs"
                  >
                    {s}
                    <button
                      onClick={() =>
                        setField(
                          'specialties',
                          item.specialties.filter((x) => x !== s),
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={specialtyInput}
                  onChange={(e) => setSpecialtyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialty())}
                  placeholder="输入擅长领域后回车添加"
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSpecialty}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  添加
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>专家简介</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={item.introduction}
                onChange={(e) => setField('introduction', e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>从业经历</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={item.workExperience}
                onChange={(e) => setField('workExperience', e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>资质荣誉（佐证材料）</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageListUpload
                label="佐证材料"
                value={item.attachments}
                onChange={(v) => setField('attachments', v)}
                multiple
                placeholder="上传附件或输入 URL"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>所属机构来源</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FormFieldRow label="来源">
                <Select
                  value={item.partnerSource}
                  onValueChange={(v) => setField('partnerSource', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cooperation">合作企业库</SelectItem>
                    <SelectItem value="third-party">第三方机构</SelectItem>
                  </SelectContent>
                </Select>
              </FormFieldRow>
              {item.partnerSource === 'cooperation' ? (
                <FormFieldRow label="选择企业">
                  <Select
                    value={item.enterpriseId}
                    onValueChange={(v) => setField('enterpriseId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择合作企业" />
                    </SelectTrigger>
                    <SelectContent>
                      {enterprises.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormFieldRow>
              ) : (
                <FormFieldRow label="机构名称">
                  <Input
                    value={item.organization}
                    onChange={(e) => setField('organization', e.target.value)}
                    placeholder="输入第三方机构名称"
                  />
                </FormFieldRow>
              )}
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
              <FormFieldRow label="状态">
                <Select value={item.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">启用</SelectItem>
                    <SelectItem value="inactive">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </FormFieldRow>
              <div className="flex items-center justify-between">
                <Label>前台展示</Label>
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

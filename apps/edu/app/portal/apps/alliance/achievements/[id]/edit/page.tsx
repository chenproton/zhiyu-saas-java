'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/shared/date-input'
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
import { SingleImageUpload } from '@/components/shared/image-list-upload'
import { TagInput } from '@/components/shared/tag-input'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceAchievementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { useToast, LoadingView } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { useSecondaryColleges } from '@/hooks/use-secondary-colleges'
import type { AllianceAchievement } from '@/lib/types'

export default function AllianceAchievementEditPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const { colleges: secondaryCollegeOptions } = useSecondaryColleges(tenantId)
  const [item, setItem] = useState<AllianceAchievement | null>(null)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([
      allianceAchievementApi.get(id),
      allianceEnterpriseApi.list({ limit: 200 }),
      allianceProjectApi.list({ limit: 200 }),
    ])
      .then(([a, ents, projs]) => {
        setItem(a)
        // 已终止合作的企业不再出现在下拉选项中
        setEnterprises(
          (ents.items || [])
            .filter((e) => e.status !== 'terminated')
            .map((e) => ({ label: e.name, value: e.id })),
        )
        setProjects((projs.items || []).map((p) => ({ label: p.name, value: p.id })))
      })
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast, t])

  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    try {
      await allianceAchievementApi.update(id, item)
      toast({ title: t('成果已更新') })
      router.push(`/portal/apps/alliance/achievements/${id}`)
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingView />
  if (!item) return <div className="text-center py-12 text-muted-foreground">{t('成果不存在')}</div>

  const setField = (field: string, value: any) =>
    setItem({ ...item, [field]: value } as AllianceAchievement)
  const enterpriseIds: string[] = (item as any).enterpriseIds || []
  const projectIds: string[] = (item as any).projectIds || []
  const secondaryColleges: string[] = (item as any).secondaryColleges || []
  const attachments: string[] = (item as any).attachments || []
  const ownerPersons: string[] = (item as any).ownerPersons || []
  const coBuilders: string[] = (item as any).coBuilders || []
  const relatedScenes: string[] = (item as any).relatedScenes || []
  const relatedCourses: string[] = (item as any).relatedCourses || []
  const relatedPositions: string[] = (item as any).relatedPositions || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('返回')}
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{t('编辑合作成果')}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('基本信息')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormFieldGrid>
                <FormFieldRow label={t('成果名称')} required>
                  <Input value={item.title} onChange={(e) => setField('title', e.target.value)} />
                </FormFieldRow>
                <FormFieldRow label={t('成果类型')}>
                  <Select value={item.type} onValueChange={(v) => setField('type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="job">{t('岗位')}</SelectItem>
                      <SelectItem value="scene">{t('场景')}</SelectItem>
                      <SelectItem value="course">{t('课程')}</SelectItem>
                      <SelectItem value="custom">{t('自定义')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormFieldRow>
                <FormFieldRow label={t('成果日期')}>
                  <DateInput
                    value={item.achievementDate || ''}
                    onChange={(e) => setField('achievementDate', e.target.value)}
                    type="date"
                  />
                </FormFieldRow>
              </FormFieldGrid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('成果描述')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={item.description || ''}
                onChange={(e) => setField('description', e.target.value)}
                rows={5}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('展示设置')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormFieldRow label={t('成果封面')}>
                <SingleImageUpload
                  label={t('成果封面')}
                  value={(item as any).coverImage || ''}
                  onChange={(v) => setField('coverImage', v)}
                />
              </FormFieldRow>
              <FormFieldRow label={t('引用原因 / 核心亮点')}>
                <Textarea
                  value={(item as any).citationReason || ''}
                  onChange={(e) => setField('citationReason', e.target.value)}
                  rows={4}
                />
              </FormFieldRow>
              <FormFieldGrid>
                <FormFieldRow label={t('成果归属人')}>
                  <TagInput value={ownerPersons} onChange={(v) => setField('ownerPersons', v)} />
                </FormFieldRow>
                <FormFieldRow label={t('成果共建人')}>
                  <TagInput value={coBuilders} onChange={(v) => setField('coBuilders', v)} />
                </FormFieldRow>
              </FormFieldGrid>
              <FormFieldRow label={t('成果佐证材料')}>
                <TagInput
                  value={attachments}
                  onChange={(v) => setField('attachments', v)}
                  placeholder={t('输入文件名后回车添加')}
                />
              </FormFieldRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('关联资源')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormFieldRow label={t('关联实践场景')}>
                <TagInput
                  value={relatedScenes}
                  onChange={(v) => setField('relatedScenes', v)}
                  placeholder={t('输入场景名称后回车添加')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('关联数字课程')}>
                <TagInput
                  value={relatedCourses}
                  onChange={(v) => setField('relatedCourses', v)}
                  placeholder={t('输入课程名称后回车添加')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('关联职业岗位')}>
                <TagInput
                  value={relatedPositions}
                  onChange={(v) => setField('relatedPositions', v)}
                  placeholder={t('输入岗位名称后回车添加')}
                />
              </FormFieldRow>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('归属项目')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={projectIds?.[0] || '__none'}
                onValueChange={(v) => setField('projectIds', v === '__none' ? [] : [v])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('选择归属项目（可选）')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t('不关联项目')}</SelectItem>
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
              <CardTitle>{t('合作企业')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={enterprises}
                value={enterpriseIds}
                onChange={(v) => setField('enterpriseIds', v)}
                placeholder={t('选择合作企业')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('二级学院')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={secondaryCollegeOptions}
                value={secondaryColleges}
                onChange={(v) => setField('secondaryColleges', v)}
                placeholder={t('选择归属学院')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('设置')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t('公开显示')}</Label>
                <Switch
                  checked={item.isPublic || false}
                  onCheckedChange={(v) => setField('isPublic', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t('保存')}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => router.back()}>
                {t('取消')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

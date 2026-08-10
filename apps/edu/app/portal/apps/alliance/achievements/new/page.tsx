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
import { allianceAchievementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useSecondaryColleges } from '@/hooks/use-secondary-colleges'

export default function AllianceAchievementNewPage() {
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const { tenantId } = usePortalAuth()
  const { colleges: secondaryCollegeOptions } = useSecondaryColleges(tenantId)
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
      allianceEnterpriseApi.list({ limit: 200 }),
      allianceProjectApi.list({ limit: 200 }),
    ])
      .then(([ents, projs]) => {
        // 已终止合作的企业不再出现在下拉选项中
        setEnterprises(
          (ents.items || [])
            .filter((e) => e.status !== 'terminated')
            .map((e) => ({ label: e.name, value: e.id })),
        )
        setProjects((projs.items || []).map((p) => ({ label: p.name, value: p.id })))
      })
      .catch((err) => {
        reportError(err, '加载企业/项目下拉数据')
        toast({
          title: t('部分数据加载失败'),
          description: t('企业或项目列表加载失败，可稍后重试'),
          variant: 'destructive',
        })
      })
  }, [toast, t])

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await allianceAchievementApi.create(item)
      toast({ title: t('成果已创建') })
      router.push(`/portal/apps/alliance/achievements/${data.id}`)
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('返回')}
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{t('新建合作成果')}</h1>
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
                  <Input
                    value={item.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder={t('请输入成果名称')}
                  />
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
                  <Input
                    value={item.achievementDate}
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
              <CardTitle>{t('归属项目')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={item.projectIds?.[0] || '__none'}
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
                value={item.enterpriseIds}
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
                value={item.secondaryColleges}
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
                <Switch checked={item.isPublic} onCheckedChange={(v) => setField('isPublic', v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t('创建')}
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

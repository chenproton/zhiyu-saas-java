'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/shared/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SingleImageUpload } from '@/components/shared/image-list-upload'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { Loader2 } from 'lucide-react'
import { allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import { useToast, ComboboxSelect } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { FormPageShell } from '@/components/shared/form-page-shell'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useSecondaryColleges } from '@/hooks/use-secondary-colleges'
import { useAllianceDictionary, mergeDictOptions } from '@/lib/alliance-dicts'

export default function AllianceProjectNewPage() {
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const linkEnterpriseId = searchParams.get('enterpriseId')
  const { tenantId } = usePortalAuth()
  const { colleges: secondaryCollegeOptions } = useSecondaryColleges(tenantId)
  const { items: projectTypeItems } = useAllianceDictionary('project_type', tenantId)
  const [saving, setSaving] = useState(false)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [item, setItem] = useState({
    name: '',
    type: 'talent_training',
    phase: 'initiation',
    startDate: '',
    endDate: '',
    budget: '',
    description: '',
    isPublic: false,
    coverImage: '',
    enterpriseIds: linkEnterpriseId ? [linkEnterpriseId] : [] as string[],
    secondaryColleges: [] as string[],
  })

  useEffect(() => {
    allianceEnterpriseApi
      .list({ limit: 200 })
      .then((res) =>
        setEnterprises(
          // 已终止合作的企业不再出现在下拉选项中
          (res.items || [])
            .filter((e) => e.status !== 'terminated')
            .map((e) => ({ label: e.name, value: e.id })),
        ),
      )
      .catch((err) => {
        reportError(err, '加载企业下拉数据')
        toast({
          title: t('企业列表加载失败'),
          description: t('可稍后重试'),
          variant: 'destructive',
        })
      })
  }, [toast, t])

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const handleSave = async () => {
    if (!item.name.trim()) {
      toast({ title: t('项目名称不能为空'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const data = await allianceProjectApi.create(item)
      toast({ title: t('项目已创建') })
      router.push(`/portal/apps/alliance/projects/${data.id}`)
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPageShell title={t('新建合作项目')} sidebar={<div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('合作企业')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ComboboxSelect
                multiple
                className="w-full"
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
              <ComboboxSelect
                multiple
                className="w-full"
                options={secondaryCollegeOptions.map((name) => ({ label: name, value: name }))}
                value={item.secondaryColleges}
                onChange={(v) => setField('secondaryColleges', v)}
                placeholder={t('选择归属学院')}
              />
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
      }>
          <Card>
            <CardHeader>
              <CardTitle>{t('基本信息')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormFieldGrid>
                <FormFieldRow label={t('项目名称')} required>
                  <Input
                    value={item.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder={t('请输入项目名称')}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('合作类型')}>
                  <Select value={item.type} onValueChange={(v) => setField('type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mergeDictOptions(projectTypeItems, item.type).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormFieldRow>
                <FormFieldRow label={t('项目阶段')}>
                  <Select value={item.phase} onValueChange={(v) => setField('phase', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initiation">{t('启动')}</SelectItem>
                      <SelectItem value="execution">{t('执行中')}</SelectItem>
                      <SelectItem value="acceptance">{t('验收')}</SelectItem>
                      <SelectItem value="closure">{t('关闭')}</SelectItem>
                      <SelectItem value="archived">{t('已归档')}</SelectItem>
                      <SelectItem value="terminated">{t('已终止')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormFieldRow>
                <FormFieldRow label={t('预算')}>
                  <Input
                    value={item.budget}
                    onChange={(e) => setField('budget', e.target.value)}
                    placeholder={t('如：50万')}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('开始日期')}>
                  <DateInput
                    value={item.startDate}
                    onChange={(e) => setField('startDate', e.target.value)}
                    type="date"
                  />
                </FormFieldRow>
                <FormFieldRow label={t('结束日期')}>
                  <DateInput
                    value={item.endDate}
                    onChange={(e) => setField('endDate', e.target.value)}
                    type="date"
                  />
                </FormFieldRow>
              </FormFieldGrid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('项目描述')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={item.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={5}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('项目封面')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SingleImageUpload
                label={t('项目封面')}
                value={item.coverImage}
                onChange={(v) => setField('coverImage', v)}
                allowUrlInput={false}
              />
            </CardContent>
          </Card>    </FormPageShell>
  )
}

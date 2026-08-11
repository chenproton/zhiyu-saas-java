'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { MultiSelect } from '@/components/ui/multi-select'
import { ImageListUpload } from '@/components/shared/image-list-upload'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { allianceAgreementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { syncAgreementProjectLinks } from '@/lib/alliance-links'
import { reportError } from '@/lib/error-handling'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useAllianceDictionary, mergeDictOptions } from '@/lib/alliance-dicts'

export default function AllianceAgreementNewPage() {
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const { tenantId } = usePortalAuth()
  const { items: typeItems } = useAllianceDictionary('agreement_type', tenantId)
  const { items: statusItems } = useAllianceDictionary('agreement_status', tenantId)
  const [saving, setSaving] = useState(false)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([])
  const [item, setItem] = useState({
    name: '',
    type: '战略合作协议',
    status: 'draft',
    startDate: '',
    endDate: '',
    content: '',
    enterpriseIds: [] as string[],
    projectIds: [] as string[],
    attachments: [] as string[],
    isPublic: false,
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
    if (!item.name) {
      toast({ title: t('请填写协议名称'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const data = await allianceAgreementApi.create(item)
      // 双向同步：协议.project_ids ↔ 项目.agreement_ids
      await syncAgreementProjectLinks(data.id, item.projectIds)
      toast({ title: t('协议已创建') })
      router.push(`/portal/apps/alliance/agreements/${data.id}`)
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
        <h1 className="text-xl font-semibold text-foreground">{t('新建合作协议')}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('基本信息')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormFieldGrid>
                <FormFieldRow label={t('协议名称')} required>
                  <Input
                    value={item.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder={t('请输入协议名称')}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('协议类型')}>
                  <Select value={item.type} onValueChange={(v) => setField('type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mergeDictOptions(typeItems, item.type).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormFieldRow>
                <FormFieldRow label={t('协议状态')}>
                  <Select value={item.status} onValueChange={(v) => setField('status', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mergeDictOptions(statusItems, item.status).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormFieldRow>
                <FormFieldRow label={t('生效日期')} required>
                  <DateInput
                    type="date"
                    value={item.startDate}
                    onChange={(e) => setField('startDate', e.target.value)}
                  />
                </FormFieldRow>
                <FormFieldRow label={t('到期日期')} required>
                  <DateInput
                    type="date"
                    value={item.endDate}
                    onChange={(e) => setField('endDate', e.target.value)}
                  />
                </FormFieldRow>
              </FormFieldGrid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('协议概要')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={item.content}
                onChange={(e) => setField('content', e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('协议附件')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageListUpload
                label={t('附件')}
                value={item.attachments}
                onChange={(v) => setField('attachments', v)}
                multiple
                placeholder={t('上传附件或输入 URL')}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
              <CardTitle>{t('关联项目')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={projects}
                value={item.projectIds}
                onChange={(v) => setField('projectIds', v)}
                placeholder={t('选择关联项目（可选）')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('设置')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label>{t('公开显示')}</Label>
                <Switch
                  checked={item.isPublic}
                  onCheckedChange={(v) => setField('isPublic', v)}
                />
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

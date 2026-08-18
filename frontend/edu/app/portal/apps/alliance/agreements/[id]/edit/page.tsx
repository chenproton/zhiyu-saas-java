'use client'

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
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
import { ImageListUpload } from '@/components/shared/image-list-upload'
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { Loader2 } from 'lucide-react'
import { allianceAgreementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { listAll } from '@zhiyu/api-client'
import { syncAgreementProjectLinks } from '@/lib/alliance-links'
import { useToast, LoadingView, EmptyState, ComboboxSelect } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { reportError } from '@/lib/error-handling'
import { FormPageShell } from '@/components/shared/form-page-shell'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useAllianceDictionary, mergeDictOptions } from '@/lib/alliance-dicts'

interface AgreementFormState {
  name: string
  type: string
  status: string
  startDate: string
  endDate: string
  content: string
  isPublic: boolean
  enterpriseIds: string[]
  projectIds: string[]
  attachments: string[]
}

export default function AllianceAgreementEditPage() {
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const { id } = useParams() as { id: string }
  const { tenantId } = usePortalAuth()
  const { items: typeItems } = useAllianceDictionary('agreement_type', tenantId)
  const { items: statusItems } = useAllianceDictionary('agreement_status', tenantId)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([])
  // 初始为 null：加载失败时保持 null 并渲染 EmptyState，禁止以默认值进入可保存状态
  // （否则用户填写保存会用默认值整条覆盖真实协议，造成数据丢失）
  const [item, setItem] = useState<AgreementFormState | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      allianceAgreementApi.get(id),
      // 下拉选项全量拉取，避免 limit 截断导致超限企业/项目无法选中
      listAll((page, pageSize) =>
        allianceEnterpriseApi.list({ limit: pageSize, offset: page * pageSize }),
      ),
      listAll((page, pageSize) =>
        allianceProjectApi.list({ limit: pageSize, offset: page * pageSize }),
      ),
    ])
      .then(([a, ents, projs]) => {
        setItem({
          name: a.name || '',
          type: a.type || 'strategic',
          status: a.status || 'draft',
          startDate: a.startDate || '',
          endDate: a.endDate || '',
          content: a.content || '',
          isPublic: !!a.isPublic,
          enterpriseIds: a.enterpriseIds || [],
          projectIds: a.projectIds || [],
          attachments: a.attachments || [],
        })
        // 已终止合作的企业不再出现在下拉选项中
        setEnterprises(
          ents.filter((e) => e.status !== 'terminated').map((e) => ({ label: e.name, value: e.id })),
        )
        setProjects(projs.map((p) => ({ label: p.name, value: p.id })))
      })
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [id, toast, t])

  const handleSave = async () => {
    if (!item) return
    if (!item.name) {
      toast({ title: t('请填写协议名称'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await allianceAgreementApi.update(id, item)
      try {
        // 双向同步：协议.project_ids ↔ 项目.agreement_ids
        await syncAgreementProjectLinks(id, item.projectIds)
      } catch (syncErr) {
        // 协议已更新成功，仅关联同步失败：单独提示，避免误报"保存失败"诱导重复提交
        reportError(syncErr, '同步协议-项目关联')
        toast({ title: t('协议已保存，但项目关联同步失败'), variant: 'destructive' })
        navigate(`/portal/apps/alliance/agreements/${id}`)
        return
      }
      toast({ title: t('协议已更新') })
      navigate(`/portal/apps/alliance/agreements/${id}`)
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingView />
  // 加载失败时禁止以默认值渲染可保存表单（参照 achievements/[id]/edit 的做法）
  if (!item) return <EmptyState title={t('协议不存在')} />

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  return (
    <FormPageShell title={t('编辑合作协议')} sidebar={<div className="space-y-6">
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
              <CardTitle>{t('关联项目')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ComboboxSelect
                multiple
                className="w-full"
                options={projects}
                value={item.projectIds}
                onChange={(v) => setField('projectIds', v)}
                placeholder={t('选择关联项目（可选）')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t('保存')}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
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
              <div className="mt-4 flex items-center gap-2">
                <Switch
                  checked={!!item.isPublic}
                  onCheckedChange={(v) => setField('isPublic', v)}
                />
                <Label>{t('前台展示')}</Label>
              </div>
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
                allowUrlInput={false}
                placeholder={t('上传附件图片（可多选）')}
              />
            </CardContent>
          </Card>    </FormPageShell>
  )
}

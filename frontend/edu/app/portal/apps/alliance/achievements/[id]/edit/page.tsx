'use client'

import { useEffect, useState } from 'react'
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
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { SingleImageUpload, ImageListUpload } from '@/components/shared/image-list-upload'
import { TagInput } from './_components/tag-input'
import { Loader2 } from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { allianceAchievementApi, allianceEnterpriseApi, allianceProjectApi } from '@/lib/api'
import { listAll } from '@zhiyu/api-client'
import { useToast, LoadingView, EmptyState, ComboboxSelect } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { FormPageShell } from '@/components/shared/form-page-shell'
import { useSecondaryColleges } from '@/hooks/use-secondary-colleges'
import { useAllianceDictionary, mergeDictOptions } from '@/lib/alliance-dicts'
import type { AllianceAchievement } from '@/lib/types'

export default function AllianceAchievementEditPage() {
  const { id } = useParams() as { id: string }
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const { colleges: secondaryCollegeOptions } = useSecondaryColleges(tenantId)
  const { items: typeItems } = useAllianceDictionary('achievement_type', tenantId)
  const [item, setItem] = useState<AllianceAchievement | null>(null)
  const [enterprises, setEnterprises] = useState<{ label: string; value: string }[]>([])
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([
      allianceAchievementApi.get(id),
      // 下拉选项全量拉取，避免 limit 截断导致超限企业/项目无法选中或保留
      listAll((page, pageSize) =>
        allianceEnterpriseApi.list({ limit: pageSize, offset: page * pageSize }),
      ),
      listAll((page, pageSize) =>
        allianceProjectApi.list({ limit: pageSize, offset: page * pageSize }),
      ),
    ])
      .then(([a, ents, projs]) => {
        setItem(a)
        // 已终止合作的企业不再出现在下拉选项中
        setEnterprises(
          ents.filter((e) => e.status !== 'terminated').map((e) => ({ label: e.name, value: e.id })),
        )
        setProjects(projs.map((p) => ({ label: p.name, value: p.id })))
      })
      .catch((e) => toast({ title: t('加载失败'), description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [tenantId, id, toast, t])

  const handleSave = async () => {
    if (!item) return
    if (!item.title.trim()) {
      toast({ title: t('成果标题不能为空'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await allianceAchievementApi.update(id, item)
      toast({ title: t('成果已更新') })
      navigate(`/portal/apps/alliance/achievements/${id}`)
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingView />
  if (!item) return <EmptyState title={t('成果不存在')} />

  const setField = (field: string, value: any) =>
    setItem({ ...item, [field]: value } as AllianceAchievement)
  const enterpriseIds: string[] = item.enterpriseIds || []
  const projectIds: string[] = item.projectIds || []
  const secondaryColleges: string[] = item.secondaryColleges || []
  const attachments: string[] = item.attachments || []
  const ownerPersons: string[] = item.ownerPersons || []
  const coBuilders: string[] = item.coBuilders || []

  return (
    <FormPageShell title={t('编辑合作成果')} sidebar={<div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('归属项目')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ComboboxSelect
                multiple
                className="w-full"
                options={projects}
                value={projectIds}
                onChange={(v) => setField('projectIds', v)}
                placeholder={t('选择归属项目（可多选）')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('合作企业')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ComboboxSelect
                multiple
                className="w-full"
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
              <ComboboxSelect
                multiple
                className="w-full"
                options={secondaryCollegeOptions.map((name) => ({ label: name, value: name }))}
                value={secondaryColleges}
                onChange={(v) => setField('secondaryColleges', v)}
                placeholder={t('选择归属学院')}
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
                <FormFieldRow label={t('成果名称')} required>
                  <Input value={item.title} onChange={(e) => setField('title', e.target.value)} />
                </FormFieldRow>
                <FormFieldRow label={t('成果类型')}>
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
              <SingleImageUpload
                label={t('成果封面')}
                value={item?.coverImage || ''}
                onChange={(v) => setField('coverImage', v)}
                allowUrlInput={false}
              />
              <FormFieldRow label={t('引用原因 / 核心亮点')}>
                <Textarea
                  value={item?.citationReason || ''}
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
              <ImageListUpload
                label={t('成果佐证材料')}
                value={attachments}
                onChange={(v) => setField('attachments', v)}
                multiple
                allowUrlInput={false}
                placeholder={t('上传佐证图片（可多选）')}
              />
            </CardContent>
          </Card>    </FormPageShell>
  )
}

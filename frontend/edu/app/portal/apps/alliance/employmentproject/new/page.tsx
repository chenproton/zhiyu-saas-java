'use client'

import { useState } from 'react'
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
import { FormFieldRow, FormFieldGrid } from '@/components/shared/form-field-row'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { allianceEmploymentProjectApi, allianceEnterpriseApi, fileApi } from '@/lib/api'
import { CoverImageUpload } from '@/components/shared/cover-image-upload'
import { useToast, useAsync, ComboboxSelect } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { FormPageShell } from '@/components/shared/form-page-shell'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useOrgTree } from '@/hooks/use-org-tree'
import { OrgNodePicker } from '@/components/shared/org-node-picker'
import { MajorSelect } from '@/components/shared/major-select'
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  type EmploymentTargetGroup,
} from '@/lib/types'

const PROJECT_TYPES = ['spring', 'autumn', 'directed', 'order']

export default function EmploymentProjectNewPage() {
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const { tenantId } = usePortalAuth()
  const { orgMap } = useOrgTree(tenantId)

  const [saving, setSaving] = useState(false)
  const [item, setItem] = useState({
    name: '',
    type: 'spring',
    customType: '',
    organizer: '',
    enterpriseIds: [] as string[],
    targetGroups: [] as EmploymentTargetGroup[],
    startDate: '',
    endDate: '',
    publishStatus: 'draft' as 'draft' | 'published',
    description: '',
    coverImage: '',
  })
  const [coverUploading, setCoverUploading] = useState(false)

  const handleCoverUpload = async (file: File) => {
    setCoverUploading(true)
    try {
      const res = await fileApi.upload(file)
      setItem((prev) => ({ ...prev, coverImage: res.url }))
      toast({ title: t('封面上传成功') })
    } catch (e: any) {
      toast({ title: t('上传失败'), description: e.message, variant: 'destructive' })
    } finally {
      setCoverUploading(false)
    }
  }

  const { data: enterprises } = useAsync(
    async () => {
      if (!tenantId) return []
      const res = await allianceEnterpriseApi.list({ limit: 200 })
      return (res.items || [])
        .filter((e) => e.status !== 'terminated')
        .map((e) => ({ label: e.name, value: e.id }))
    },
    { deps: [tenantId], onError: () => true },
  )

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const addTargetGroup = () =>
    setItem({ ...item, targetGroups: [...item.targetGroups, {}] })
  const removeTargetGroup = (idx: number) =>
    setItem({ ...item, targetGroups: item.targetGroups.filter((_, i) => i !== idx) })
  const updateTargetGroup = (idx: number, patch: Partial<EmploymentTargetGroup>) =>
    setItem({
      ...item,
      targetGroups: item.targetGroups.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    })

  const handleSave = async () => {
    if (!item.name.trim()) {
      toast({ title: t('项目名称不能为空'), variant: 'destructive' })
      return
    }
    if (item.type === 'custom' && !item.customType.trim()) {
      toast({ title: t('请填写自定义项目类型'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: item.name.trim(),
        type: item.type === 'custom' ? `custom:${item.customType.trim()}` : item.type,
        organizer: item.organizer.trim() || undefined,
        description: item.description || undefined,
        coverImage: item.coverImage || undefined,
        startDate: item.startDate || undefined,
        endDate: item.endDate || undefined,
        publishStatus: item.publishStatus,
        enterpriseIds: item.enterpriseIds,
        targetGroups: item.targetGroups.filter(
          (g) => g.orgNodeId || g.majorId || g.graduateYear,
        ),
      }
      const data = await allianceEmploymentProjectApi.create(payload)
      toast({ title: t('项目已创建') })
      router.push(`/portal/apps/alliance/employmentproject/${data.id}`)
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPageShell
      title={t('新建就业项目')}
      backHref="/portal/apps/alliance/employmentproject"
      sidebar={
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('参与企业')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ComboboxSelect
                multiple
                className="w-full"
                options={enterprises ?? []}
                value={item.enterpriseIds}
                onChange={(v) => setField('enterpriseIds', v)}
                placeholder={t('选择参与企业')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('发布设置')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('发布到服务大厅')}</span>
                <Switch
                  checked={item.publishStatus === 'published'}
                  onCheckedChange={(v) => setField('publishStatus', v ? 'published' : 'draft')}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.publishStatus === 'published' ? t('已发布，学生可在服务大厅查看') : t('草稿，暂不对外展示')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t('创建')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/portal/apps/alliance/employmentproject')}
              >
                {t('取消')}
              </Button>
            </CardContent>
          </Card>
        </div>
      }
    >
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
            <FormFieldRow label={t('项目类型')} required>
              <Select value={item.type} onValueChange={(v) => setField('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {EMPLOYMENT_PROJECT_TYPE_LABELS[v]}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">{t('自定义')}</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldRow>
            {item.type === 'custom' && (
              <FormFieldRow label={t('自定义类型')} required>
                <Input
                  value={item.customType}
                  onChange={(e) => setField('customType', e.target.value)}
                  placeholder={t('如：寒暑假实习专场')}
                />
              </FormFieldRow>
            )}
            <FormFieldRow label={t('发起单位')}>
              <Input
                value={item.organizer}
                onChange={(e) => setField('organizer', e.target.value)}
                placeholder={t('如：招生就业处')}
              />
            </FormFieldRow>
            <FormFieldRow label={t('开始日期')}>
              <DateInput
                type="date"
                value={item.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
              />
            </FormFieldRow>
            <FormFieldRow label={t('结束日期')}>
              <DateInput
                type="date"
                value={item.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
              />
            </FormFieldRow>
          </FormFieldGrid>
          <div className="mt-4">
            <CoverImageUpload
              imageUrl={item.coverImage}
              uploading={coverUploading}
              label={t('项目封面（展示在服务大厅与联盟首页，建议 16:9 横图）')}
              alt={t('项目封面')}
              onUpload={handleCoverUpload}
              onRemove={() => setField('coverImage', '')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('面向学生群体')}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('每组内条件同时满足，多组之间任一满足；留空表示不限制')}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addTargetGroup}>
            <Plus className="h-4 w-4 mr-1" />
            {t('添加条件组')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {item.targetGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('未添加条件组，面向全校')}</p>
          )}
          {item.targetGroups.map((g, idx) => (
            <div
              key={idx}
              className="rounded-md border p-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_auto] gap-3 items-end"
            >
              <FormFieldRow label={t('组织节点')}>
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <OrgNodePicker
                      tenantId={tenantId}
                      value={g.orgNodeId}
                      onChange={(v) =>
                        updateTargetGroup(idx, {
                          orgNodeId: v,
                          orgNodeName: v ? orgMap.get(v)?.name : undefined,
                        })
                      }
                      placeholder={t('不限制')}
                    />
                  </div>
                  {g.orgNodeId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground shrink-0"
                      onClick={() =>
                        updateTargetGroup(idx, { orgNodeId: undefined, orgNodeName: undefined })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </FormFieldRow>
              <FormFieldRow label={t('专业')}>
                <div className="flex items-center gap-1">
                  <MajorSelect
                    tenantId={tenantId}
                    value={g.majorId}
                    onChange={(v, major) =>
                      updateTargetGroup(idx, { majorId: v, majorName: major?.name })
                    }
                    placeholder={t('不限制')}
                    className="w-full"
                  />
                  {g.majorId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground shrink-0"
                      onClick={() => updateTargetGroup(idx, { majorId: undefined, majorName: undefined })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </FormFieldRow>
              <FormFieldRow label={t('毕业年份')}>
                <Input
                  type="number"
                  value={g.graduateYear ?? ''}
                  onChange={(e) =>
                    updateTargetGroup(idx, {
                      graduateYear: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder={t('如 2025')}
                />
              </FormFieldRow>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={() => removeTargetGroup(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('项目简介')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={item.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </FormPageShell>
  )
}

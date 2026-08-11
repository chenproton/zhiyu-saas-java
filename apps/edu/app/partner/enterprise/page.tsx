'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { SingleImageUpload, ImageListUpload } from '@/components/shared/image-list-upload'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { Loader2, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  partnerEnterpriseApi,
  partnerExpertApi,
  type PartnerEnterprise,
  type PartnerExpert,
} from '@/lib/api'
import { useToast, LoadingView, ErrorState } from '@zhiyu/ui'
import { usePartnerAuth } from '@/components/partner-auth-provider'
import { useT } from '@/lib/i18n/locale-provider'
import { getEnterpriseMissingFields } from '@/lib/partner-enterprise-completeness'
import {
  EnterpriseShowcase,
  type ShowcaseEnterprise,
} from '@/components/alliance/enterprise-showcase'

type FormState = {
  name: string
  unifiedSocialCreditCode: string
  industry: string
  region: string
  description: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  logoUrl: string
  coverImage: string
  establishedYear?: number
  employeeCount?: number
  businessLicensePhotos: string[]
  intellectualPropertyPhotos: string[]
  qualificationPhotos: string[]
  coverPhotos: string[]
  enablePublic: boolean
}

function toForm(e: PartnerEnterprise): FormState {
  return {
    name: e.name || '',
    unifiedSocialCreditCode: e.unifiedSocialCreditCode || '',
    industry: e.industry || '',
    region: e.region || '',
    description: e.description || '',
    contactPerson: e.contactPerson || '',
    contactPhone: e.contactPhone || '',
    contactEmail: e.contactEmail || '',
    address: e.address || '',
    logoUrl: e.logoUrl || '',
    coverImage: e.coverImage || '',
    establishedYear: e.establishedYear,
    employeeCount: e.employeeCount,
    businessLicensePhotos: e.businessLicensePhotos || [],
    intellectualPropertyPhotos: e.intellectualPropertyPhotos || [],
    qualificationPhotos: e.qualificationPhotos || [],
    coverPhotos: e.coverPhotos || [],
    enablePublic: e.enablePublic || false,
  }
}

export default function PartnerEnterprisePage() {
  const { toast } = useToast()
  const t = useT()
  const { user, loading: authLoading, refresh } = usePartnerAuth()
  const [item, setItem] = useState<FormState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewExperts, setPreviewExperts] = useState<PartnerExpert[] | null>(null)

  // 预览 Dialog 首次打开时拉取一次企业专家
  useEffect(() => {
    if (!previewOpen || previewExperts !== null) return
    partnerExpertApi
      .list({ limit: 200 })
      .then((res) => setPreviewExperts(res.items || []))
      .catch(() => setPreviewExperts([]))
  }, [previewOpen, previewExperts])

  const load = async () => {
    try {
      const e = await partnerEnterpriseApi.getProfile()
      setItem(toForm(e))
      setLoadError(null)
    } catch (e: any) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    partnerEnterpriseApi
      .getProfile()
      .then((e) => {
        if (cancelled) return
        setItem(toForm(e))
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  if (authLoading || (!item && !loadError)) return <LoadingView />
  if (loadError) return <ErrorState description={loadError} onRetry={load} />
  if (!item) return null

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  /** 资料完整度检查：任一项缺失都在页面顶部提示补全（影响对外展示效果） */
  const missingFields = getEnterpriseMissingFields(item).map((f) => t(f))

  /** 当前表单实时数据 → 展示页 props（未保存也能预览） */
  const toPreview = (f: FormState): ShowcaseEnterprise => ({
    name: f.name,
    logoUrl: f.logoUrl || undefined,
    coverImage: f.coverImage || undefined,
    industry: f.industry || undefined,
    region: f.region || undefined,
    establishedYear: f.establishedYear,
    employeeCount: f.employeeCount,
    unifiedSocialCreditCode: f.unifiedSocialCreditCode || undefined,
    description: f.description || undefined,
    coverPhotos: f.coverPhotos,
    qualificationPhotos: f.qualificationPhotos,
    intellectualPropertyPhotos: f.intellectualPropertyPhotos,
    contactPerson: f.contactPerson || undefined,
    contactPhone: f.contactPhone || undefined,
    contactEmail: f.contactEmail || undefined,
    address: f.address || undefined,
  })

  const handleSave = async () => {
    if (!item.name) {
      toast({ title: t('请填写企业名称'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await partnerEnterpriseApi.updateProfile(item)
      toast({ title: t('企业信息已保存') })
      await refresh()
    } catch (e: any) {
      toast({ title: t('保存失败'), description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  /** 展示开关即时生效：切换即保存（部分更新，不影响未保存的表单改动） */
  const handleTogglePublic = async (v: boolean) => {
    const prev = item.enablePublic
    setItem({ ...item, enablePublic: v })
    try {
      await partnerEnterpriseApi.updateProfile({ enablePublic: v })
      toast({ title: v ? t('已开启对外展示') : t('已关闭对外展示') })
    } catch (e: any) {
      setItem({ ...item, enablePublic: prev })
      toast({ title: t('操作失败'), description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('企业信息')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('维护企业主体信息，信息将共享给引入本企业的合作学校。')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-1" title={t('开启后企业才会出现在各学校的产业联盟展示页；具体是否在某学校前台出现，由该校在引入时决定。')}>
            <Label className="text-sm text-muted-foreground">{t('愿意对外展示')}</Label>
            <Switch checked={item.enablePublic} onCheckedChange={handleTogglePublic} />
          </div>
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1" />
            {t('预览展示页')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {t('保存')}
          </Button>
        </div>
      </div>

      {missingFields.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-foreground">{t('资料待补全')}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('以下资料尚未完善，将影响企业在产业联盟展示页的对外展示效果：')}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
              {missingFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('基本信息')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormFieldRow label={t('企业名称')} required>
                <Input value={item.name} onChange={(e) => setField('name', e.target.value)} />
              </FormFieldRow>
              <FormFieldRow label={t('统一社会信用代码')}>
                <Input
                  value={item.unifiedSocialCreditCode}
                  onChange={(e) => setField('unifiedSocialCreditCode', e.target.value)}
                />
              </FormFieldRow>
              <FormFieldRow label={t('所属行业')}>
                <Input
                  value={item.industry}
                  onChange={(e) => setField('industry', e.target.value)}
                  placeholder={t('如：信息技术')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('所在地区')}>
                <Input
                  value={item.region}
                  onChange={(e) => setField('region', e.target.value)}
                  placeholder={t('如：深圳')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('成立年份')}>
                <Input
                  type="number"
                  value={item.establishedYear ?? ''}
                  onChange={(e) =>
                    setField('establishedYear', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder={t('如：2010')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('企业规模（人数）')}>
                <Input
                  type="number"
                  value={item.employeeCount ?? ''}
                  onChange={(e) =>
                    setField('employeeCount', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder={t('如：500')}
                />
              </FormFieldRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('企业形象')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SingleImageUpload
                label={t('企业 Logo')}
                value={item.logoUrl}
                onChange={(v) => setField('logoUrl', v)}
              />
              <SingleImageUpload
                label={t('企业主页封面')}
                value={item.coverImage}
                onChange={(v) => setField('coverImage', v)}
              />
              <ImageListUpload
                label={t('企业风采照片')}
                value={item.coverPhotos}
                onChange={(v) => setField('coverPhotos', v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('企业证照')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageListUpload
                label={t('企业营业执照')}
                value={item.businessLicensePhotos}
                onChange={(v) => setField('businessLicensePhotos', v)}
              />
              <ImageListUpload
                label={t('企业知识产权')}
                value={item.intellectualPropertyPhotos}
                onChange={(v) => setField('intellectualPropertyPhotos', v)}
              />
              <ImageListUpload
                label={t('企业荣誉资质')}
                value={item.qualificationPhotos}
                onChange={(v) => setField('qualificationPhotos', v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('联系信息')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormFieldRow label={t('联系人')}>
                <Input
                  value={item.contactPerson}
                  onChange={(e) => setField('contactPerson', e.target.value)}
                />
              </FormFieldRow>
              <FormFieldRow label={t('联系电话')}>
                <Input
                  value={item.contactPhone}
                  onChange={(e) => setField('contactPhone', e.target.value)}
                />
              </FormFieldRow>
              <FormFieldRow label={t('联系邮箱')}>
                <Input
                  value={item.contactEmail}
                  onChange={(e) => setField('contactEmail', e.target.value)}
                />
              </FormFieldRow>
              <FormFieldRow label={t('详细地址')}>
                <Input value={item.address} onChange={(e) => setField('address', e.target.value)} />
              </FormFieldRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('企业简介')}</CardTitle>
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
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('展示页预览')}</DialogTitle>
          </DialogHeader>
          <EnterpriseShowcase
            enterprise={toPreview(item)}
            experts={previewExperts ?? []}
            schoolSectionsNote={t('合作项目、合作成果、合作协议由合作学校维护，将在学校端展示页显示')}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

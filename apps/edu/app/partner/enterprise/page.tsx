'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  SingleImageUpload,
  ImageListUpload,
} from '@/components/shared/image-list-upload'
import {
  FormFieldRow,
  FormFieldGrid,
  IconInput,
  FieldValue,
} from '@/components/shared/form-field-row'
import {
  Loader2,
  Pencil,
  Eye,
  Building,
  Hash,
  Briefcase,
  MapPin,
  Calendar,
  Users,
  User,
  Phone,
  Mail,
  FileText,
  Image as ImageIcon,
} from 'lucide-react'
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
  EnterpriseDetailView,
  type ShowcaseEnterprise,
} from '@/components/alliance/enterprise-detail-view'

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

/** 只读图片栅格（与前台展示页一致的缩略图样式） */
function PhotoGrid({ photos, alt }: { photos: string[]; alt: string }) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {photos.map((photo, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={idx}
          src={photo}
          alt={t('{name} 照片 {idx}', { name: alt, idx: idx + 1 })}
          className="w-full aspect-[4/3] object-cover rounded-2xl border border-slate-100 shadow-sm"
        />
      ))}
    </div>
  )
}

export default function PartnerEnterprisePage() {
  const { toast } = useToast()
  const t = useT()
  const { user, loading: authLoading, refresh } = usePartnerAuth()
  const [item, setItem] = useState<FormState | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
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

  const openEdit = () => {
    if (!item) return
    setForm({ ...item })
    setEditOpen(true)
  }

  const setField = (field: keyof FormState, value: any) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))

  const handleSave = async () => {
    if (!form) return
    if (!form.name) {
      toast({ title: t('请填写企业名称'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await partnerEnterpriseApi.updateProfile(form)
      setItem(form)
      setEditOpen(false)
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

  const coverPhotos = item.coverImage ? [item.coverImage, ...item.coverPhotos] : item.coverPhotos
  const licensePhotos = item.businessLicensePhotos
  const badge = [item.industry, item.region].filter(Boolean).join(' · ')

  return (
    <div className="min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('企业信息')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('维护企业主体信息，信息将共享给引入本企业的合作学校。')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 mr-1"
            title={t('开启后企业才会出现在各学校的产业联盟展示页；具体是否在某学校前台出现，由该校在引入时决定。')}
          >
            <Label className="text-sm text-muted-foreground">{t('愿意对外展示')}</Label>
            <Switch checked={item.enablePublic} onCheckedChange={handleTogglePublic} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1" />
            {t('预览展示页')}
          </Button>
          <Button size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            {t('编辑')}
          </Button>
        </div>
      </div>

      {missingFields.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 mb-6">
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

      <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {item.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.logoUrl}
                alt={item.name}
                className="w-10 h-10 rounded-lg object-cover border border-gray-100 bg-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">{item.name}</h2>
              {badge && <p className="text-sm text-muted-foreground">{badge}</p>}
            </div>
          </div>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <FieldValue icon={User} label={t('联系人')} value={item.contactPerson} />
          <FieldValue icon={Phone} label={t('联系电话')} value={item.contactPhone} />
          <FieldValue icon={Mail} label={t('联系邮箱')} value={item.contactEmail} />
          <FieldValue
            icon={Hash}
            label={t('统一社会信用代码')}
            value={item.unifiedSocialCreditCode}
          />
          <FieldValue icon={Calendar} label={t('成立年份')} value={item.establishedYear} />
          <FieldValue
            icon={Users}
            label={t('企业规模（人数）')}
            value={item.employeeCount != null ? `${item.employeeCount.toLocaleString()} 人` : undefined}
          />
          <FieldValue icon={MapPin} label={t('所在地区')} value={item.region} />
          <FieldValue icon={MapPin} label={t('详细地址')} value={item.address} />
        </div>
        {item.description && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t('企业简介')}</p>
                <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap">{item.description}</p>
              </div>
            </div>
          </div>
        )}
        <div className="px-6 py-5 border-t border-gray-100">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5" />
            {t('企业形象')}
          </p>
          {coverPhotos.length > 0 ? (
            <PhotoGrid photos={coverPhotos} alt={item.name} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('暂无形象图片')}</p>
          )}
        </div>
        <div className="px-6 py-5 border-t border-gray-100">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {t('企业证照')}
          </p>
          <div className="space-y-5">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('企业营业执照')}</p>
              {licensePhotos.length > 0 ? (
                <PhotoGrid photos={licensePhotos} alt={t('企业营业执照')} />
              ) : (
                <p className="text-sm text-muted-foreground">{t('暂无')}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('企业知识产权')}</p>
              {item.intellectualPropertyPhotos.length > 0 ? (
                <PhotoGrid photos={item.intellectualPropertyPhotos} alt={t('企业知识产权')} />
              ) : (
                <p className="text-sm text-muted-foreground">{t('暂无')}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('企业荣誉资质')}</p>
              {item.qualificationPhotos.length > 0 ? (
                <PhotoGrid photos={item.qualificationPhotos} alt={t('企业荣誉资质')} />
              ) : (
                <p className="text-sm text-muted-foreground">{t('暂无')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent size="lg" className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('编辑企业信息')}</DialogTitle>
            <DialogDescription>
              {t('修改企业主体信息，保存后共享给合作学校的产业联盟展示页')}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-5 py-4 overflow-y-auto flex-1 min-h-0">
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                  {t('基础信息')}
                </Label>
                <div className="space-y-4">
                  <FormFieldRow label={t('企业名称')} required>
                    <IconInput
                      icon={Building}
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                    />
                  </FormFieldRow>
                  <FormFieldGrid>
                    <FormFieldRow label={t('统一社会信用代码')}>
                      <IconInput
                        icon={Hash}
                        value={form.unifiedSocialCreditCode}
                        onChange={(e) => setField('unifiedSocialCreditCode', e.target.value)}
                      />
                    </FormFieldRow>
                    <FormFieldRow label={t('所属行业')}>
                      <IconInput
                        icon={Briefcase}
                        value={form.industry}
                        onChange={(e) => setField('industry', e.target.value)}
                        placeholder={t('如：信息技术')}
                      />
                    </FormFieldRow>
                  </FormFieldGrid>
                  <FormFieldGrid>
                    <FormFieldRow label={t('所在地区')}>
                      <IconInput
                        icon={MapPin}
                        value={form.region}
                        onChange={(e) => setField('region', e.target.value)}
                        placeholder={t('如：深圳')}
                      />
                    </FormFieldRow>
                    <FormFieldRow label={t('成立年份')}>
                      <IconInput
                        icon={Calendar}
                        type="number"
                        value={form.establishedYear ?? ''}
                        onChange={(e) =>
                          setField(
                            'establishedYear',
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        placeholder={t('如：2010')}
                      />
                    </FormFieldRow>
                  </FormFieldGrid>
                  <FormFieldRow label={t('企业规模（人数）')}>
                    <IconInput
                      icon={Users}
                      type="number"
                      value={form.employeeCount ?? ''}
                      onChange={(e) =>
                        setField('employeeCount', e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder={t('如：500')}
                    />
                  </FormFieldRow>
                  <FormFieldRow label={t('企业简介')}>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                      rows={4}
                    />
                  </FormFieldRow>
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                  {t('企业形象')}
                </Label>
                <div className="space-y-4">
                  <FormFieldGrid>
                    <SingleImageUpload
                      label={t('企业 Logo')}
                      value={form.logoUrl}
                      onChange={(v) => setField('logoUrl', v)}
                      allowUrlInput={false}
                    />
                    <SingleImageUpload
                      label={t('企业主页封面')}
                      value={form.coverImage}
                      onChange={(v) => setField('coverImage', v)}
                      allowUrlInput={false}
                    />
                  </FormFieldGrid>
                  <ImageListUpload
                    label={t('企业风采照片')}
                    value={form.coverPhotos}
                    onChange={(v) => setField('coverPhotos', v)}
                    allowUrlInput={false}
                  />
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                  {t('企业证照')}
                </Label>
                <div className="space-y-4">
                  <ImageListUpload
                    label={t('企业营业执照')}
                    value={form.businessLicensePhotos}
                    onChange={(v) => setField('businessLicensePhotos', v)}
                    allowUrlInput={false}
                  />
                  <ImageListUpload
                    label={t('企业知识产权')}
                    value={form.intellectualPropertyPhotos}
                    onChange={(v) => setField('intellectualPropertyPhotos', v)}
                    allowUrlInput={false}
                  />
                  <ImageListUpload
                    label={t('企业荣誉资质')}
                    value={form.qualificationPhotos}
                    onChange={(v) => setField('qualificationPhotos', v)}
                    allowUrlInput={false}
                  />
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                  {t('联系信息')}
                </Label>
                <div className="space-y-4">
                  <FormFieldGrid>
                    <FormFieldRow label={t('联系人')}>
                      <IconInput
                        icon={User}
                        value={form.contactPerson}
                        onChange={(e) => setField('contactPerson', e.target.value)}
                      />
                    </FormFieldRow>
                    <FormFieldRow label={t('联系电话')}>
                      <IconInput
                        icon={Phone}
                        value={form.contactPhone}
                        onChange={(e) => setField('contactPhone', e.target.value)}
                      />
                    </FormFieldRow>
                  </FormFieldGrid>
                  <FormFieldGrid>
                    <FormFieldRow label={t('联系邮箱')}>
                      <IconInput
                        icon={Mail}
                        type="email"
                        value={form.contactEmail}
                        onChange={(e) => setField('contactEmail', e.target.value)}
                      />
                    </FormFieldRow>
                    <FormFieldRow label={t('详细地址')}>
                      <IconInput
                        icon={MapPin}
                        value={form.address}
                        onChange={(e) => setField('address', e.target.value)}
                      />
                    </FormFieldRow>
                  </FormFieldGrid>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              {t('取消')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('展示页预览')}</DialogTitle>
          </DialogHeader>
          <EnterpriseDetailView
            enterprise={toPreview(item)}
            experts={previewExperts ?? []}
            projects={[]}
            achievements={[]}
            agreements={[]}
            showBack={false}
            schoolSectionsNote={t(
              '合作项目、合作成果、合作协议由合作学校维护，将在学校端展示页显示',
            )}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

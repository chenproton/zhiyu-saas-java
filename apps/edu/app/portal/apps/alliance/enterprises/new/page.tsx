'use client'

import { useState } from 'react'
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
import { FormFieldRow } from '@/components/shared/form-field-row'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { allianceEnterpriseApi } from '@/lib/api'
import { useToast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

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

export default function AllianceEnterpriseNewPage() {
  const { toast } = useToast()
  const t = useT()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [item, setItem] = useState({
    name: '',
    enterpriseType: 'cooperation',
    status: 'negotiating',
    rating: 'general',
    isPublic: false,
    industry: '',
    region: '',
    description: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    logoUrl: '',
    coverImage: '',
    address: '',
    unifiedSocialCreditCode: '',
    establishedYear: undefined as number | undefined,
    employeeCount: undefined as number | undefined,
    businessLicensePhotos: [] as string[],
    intellectualPropertyPhotos: [] as string[],
    qualificationPhotos: [] as string[],
    secondaryColleges: [] as string[],
  })

  const setField = (field: string, value: any) => setItem({ ...item, [field]: value })

  const handleSave = async () => {
    if (!item.name) {
      toast({ title: t('请填写企业名称'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const data = await allianceEnterpriseApi.create(item)
      toast({ title: t('企业已创建') })
      router.push(`/portal/apps/alliance/enterprises/${data.id}`)
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
        <h1 className="text-xl font-semibold text-foreground">{t('新建合作企业')}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('基本信息')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormFieldRow label={t('企业名称')} required>
                <Input
                  value={item.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder={t('请输入企业名称')}
                />
              </FormFieldRow>
              <FormFieldRow label={t('统一社会信用代码')}>
                <Input
                  value={item.unifiedSocialCreditCode}
                  onChange={(e) => setField('unifiedSocialCreditCode', e.target.value)}
                  placeholder="如：91320594MA1P7XXXX1"
                />
              </FormFieldRow>
              <FormFieldRow label={t('企业类型')}>
                <Select
                  value={item.enterpriseType}
                  onValueChange={(v) => setField('enterpriseType', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cooperation">{t('合作企业')}</SelectItem>
                    <SelectItem value="third-party">{t('第三方雇主企业')}</SelectItem>
                  </SelectContent>
                </Select>
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
              <FormFieldRow label={t('合作状态')}>
                <Select value={item.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="negotiating">{t('洽谈中')}</SelectItem>
                    <SelectItem value="active">{t('合作中')}</SelectItem>
                    <SelectItem value="paused">{t('已暂停')}</SelectItem>
                    <SelectItem value="terminated">{t('已终止')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormFieldRow>
              <FormFieldRow label={t('合作评级')}>
                <Select value={item.rating} onValueChange={(v) => setField('rating', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strategic">{t('战略合作')}</SelectItem>
                    <SelectItem value="deep">{t('深度合作')}</SelectItem>
                    <SelectItem value="general">{t('一般合作')}</SelectItem>
                  </SelectContent>
                </Select>
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('二级学院')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MultiSelect
                options={SECONDARY_COLLEGES}
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
                <Label>{t('前台展示')}</Label>
                <Switch checked={item.isPublic} onCheckedChange={(v) => setField('isPublic', v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}{t('创建')}
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

'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { FormFieldRow, FormFieldGrid, IconInput } from '@/components/shared/form-field-row'
import { SingleImageUpload, ImageListUpload } from '@/components/shared/image-list-upload'
import {
  Building,
  Hash,
  Briefcase,
  MapPin,
  Calendar,
  Users,
  User,
  Phone,
  Mail,
} from 'lucide-react'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useSecondaryColleges } from '@/hooks/use-secondary-colleges'
import { useT } from '@/lib/i18n/locale-provider'
import type { EnterpriseInfo } from '@/components/alliance/independent-enterprise-form'

const num = (v: string): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) && v !== '' ? n : undefined
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
      {children}
    </Label>
  )
}

/**
 * 企业资料表单（独立雇主企业/合作企业主体字段一致，样式对齐 /partner/enterprise 编辑弹窗）：
 * 基础信息 / 企业形象 / 企业证照 / 联系信息 分区布局。
 * 受控组件：value/onChange 持有 EnterpriseInfo。
 */
export function EnterpriseProfileForm({
  value,
  onChange,
}: {
  value: EnterpriseInfo
  onChange: (v: EnterpriseInfo) => void
}) {
  const t = useT()
  const { tenantId } = usePortalAuth()
  const { colleges } = useSecondaryColleges(tenantId)

  const set = (patch: Partial<EnterpriseInfo>) => onChange({ ...value, ...patch })

  return (
    <div className="grid gap-5">
      <Separator />
      <div>
        <SectionLabel>{t('基础信息')}</SectionLabel>
        <div className="space-y-4">
          <FormFieldRow label={t('企业名称')} required>
            <IconInput
              icon={Building}
              value={value.name || ''}
              onChange={(e) => set({ name: e.target.value })}
            />
          </FormFieldRow>
          <FormFieldGrid>
            <FormFieldRow label={t('统一社会信用代码')}>
              <IconInput
                icon={Hash}
                value={value.unifiedSocialCreditCode || ''}
                onChange={(e) => set({ unifiedSocialCreditCode: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('企业类型')}>
              <Select
                value={value.enterpriseType || 'third-party'}
                onValueChange={(v) => set({ enterpriseType: v })}
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
          </FormFieldGrid>
          <FormFieldGrid>
            <FormFieldRow label={t('所属行业')}>
              <IconInput
                icon={Briefcase}
                value={value.industry || ''}
                onChange={(e) => set({ industry: e.target.value })}
                placeholder={t('如：信息技术')}
              />
            </FormFieldRow>
            <FormFieldRow label={t('所在地区')}>
              <IconInput
                icon={MapPin}
                value={value.region || ''}
                onChange={(e) => set({ region: e.target.value })}
                placeholder={t('如：深圳')}
              />
            </FormFieldRow>
          </FormFieldGrid>
          <FormFieldGrid>
            <FormFieldRow label={t('成立年份')}>
              <IconInput
                icon={Calendar}
                type="number"
                min={1900}
                max={2100}
                value={value.establishedYear ?? ''}
                onChange={(e) => set({ establishedYear: num(e.target.value) })}
                placeholder={t('如：2010')}
              />
            </FormFieldRow>
            <FormFieldRow label={t('企业规模（人数）')}>
              <IconInput
                icon={Users}
                type="number"
                min={0}
                value={value.employeeCount ?? ''}
                onChange={(e) => set({ employeeCount: num(e.target.value) })}
                placeholder={t('如：500')}
              />
            </FormFieldRow>
          </FormFieldGrid>
          <FormFieldRow label={t('关联二级学院')}>
            <MultiSelect
              options={colleges.map((name) => ({ label: name, value: name }))}
              value={value.secondaryColleges || []}
              onChange={(v: string[]) => set({ secondaryColleges: v })}
              placeholder={t('选择归属学院')}
            />
          </FormFieldRow>
          <FormFieldRow label={t('企业简介')}>
            <Textarea
              value={value.description || ''}
              onChange={(e) => set({ description: e.target.value })}
              rows={4}
            />
          </FormFieldRow>
        </div>
      </div>
      <Separator />
      <div>
        <SectionLabel>{t('企业形象')}</SectionLabel>
        <div className="space-y-4">
          <FormFieldGrid>
            <SingleImageUpload
              label={t('企业 Logo')}
              value={value.logoUrl || ''}
              onChange={(v) => set({ logoUrl: v })}
              allowUrlInput={false}
            />
            <SingleImageUpload
              label={t('企业主页封面')}
              value={value.coverImage || ''}
              onChange={(v) => set({ coverImage: v })}
              allowUrlInput={false}
            />
          </FormFieldGrid>
          <ImageListUpload
            label={t('企业风采照片')}
            value={value.coverPhotos || []}
            onChange={(v) => set({ coverPhotos: v })}
            multiple
            allowUrlInput={false}
          />
        </div>
      </div>
      <Separator />
      <div>
        <SectionLabel>{t('企业证照')}</SectionLabel>
        <div className="space-y-4">
          <ImageListUpload
            label={t('企业营业执照')}
            value={value.businessLicensePhotos || []}
            onChange={(v) => set({ businessLicensePhotos: v })}
            multiple
            allowUrlInput={false}
          />
          <ImageListUpload
            label={t('企业知识产权')}
            value={value.intellectualPropertyPhotos || []}
            onChange={(v) => set({ intellectualPropertyPhotos: v })}
            multiple
            allowUrlInput={false}
          />
          <ImageListUpload
            label={t('企业荣誉资质')}
            value={value.qualificationPhotos || []}
            onChange={(v) => set({ qualificationPhotos: v })}
            multiple
            allowUrlInput={false}
          />
        </div>
      </div>
      <Separator />
      <div>
        <SectionLabel>{t('联系信息')}</SectionLabel>
        <div className="space-y-4">
          <FormFieldGrid>
            <FormFieldRow label={t('联系人')}>
              <IconInput
                icon={User}
                value={value.contactPerson || ''}
                onChange={(e) => set({ contactPerson: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('联系电话')}>
              <IconInput
                icon={Phone}
                value={value.contactPhone || ''}
                onChange={(e) => set({ contactPhone: e.target.value })}
              />
            </FormFieldRow>
          </FormFieldGrid>
          <FormFieldGrid>
            <FormFieldRow label={t('联系邮箱')}>
              <IconInput
                icon={Mail}
                type="email"
                value={value.contactEmail || ''}
                onChange={(e) => set({ contactEmail: e.target.value })}
              />
            </FormFieldRow>
            <FormFieldRow label={t('详细地址')}>
              <IconInput
                icon={MapPin}
                value={value.address || ''}
                onChange={(e) => set({ address: e.target.value })}
              />
            </FormFieldRow>
          </FormFieldGrid>
        </div>
      </div>
    </div>
  )
}

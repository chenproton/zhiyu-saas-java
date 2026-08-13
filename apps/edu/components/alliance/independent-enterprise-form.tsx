'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormFieldRow } from '@/components/shared/form-field-row'
import { SingleImageUpload, ImageListUpload } from '@/components/shared/image-list-upload'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useSecondaryColleges } from '@/hooks/use-secondary-colleges'
import { useT } from '@/lib/i18n/locale-provider'
import { ComboboxSelect } from '@zhiyu/ui'

/**
 * 独立雇主企业资料（学校登记，仅品牌模块可见）。
 * 字段与引用合作企业（partner_enterprises）主体字段一致；
 * 不含账号类字段（独立企业不创建企业账号），不含学校侧 link 管理字段（合作状态/评级/合作方式）。
 */
export interface EnterpriseInfo {
  name?: string
  enterpriseType?: string
  unifiedSocialCreditCode?: string
  industry?: string
  region?: string
  establishedYear?: number
  employeeCount?: number
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  description?: string
  logoUrl?: string
  coverImage?: string
  coverPhotos?: string[]
  businessLicensePhotos?: string[]
  qualificationPhotos?: string[]
  intellectualPropertyPhotos?: string[]
  secondaryColleges?: string[]
}

/** 兼容旧数据字段（logo/creditCode → logoUrl/unifiedSocialCreditCode） */
export function normalizeEnterpriseInfo(raw?: Record<string, any> | null): EnterpriseInfo {
  if (!raw) return {}
  return {
    ...raw,
    logoUrl: raw.logoUrl || raw.logo || undefined,
    unifiedSocialCreditCode: raw.unifiedSocialCreditCode || raw.creditCode || undefined,
  }
}

const num = (v: string): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) && v !== '' ? n : undefined
}

/**
 * 独立雇主企业资料表单（新建/编辑共用，字段与引用合作企业主体字段一致）。
 * 受控组件：value/onChange 持有 EnterpriseInfo。
 */
export function IndependentEnterpriseForm({
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
    <div className="space-y-4">
      <FormFieldRow label={t('企业名称')} required>
        <Input
          value={value.name || ''}
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormFieldRow>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormFieldRow label={t('统一社会信用代码')}>
          <Input
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
        <FormFieldRow label={t('所属行业')}>
          <Input
            value={value.industry || ''}
            onChange={(e) => set({ industry: e.target.value })}
          />
        </FormFieldRow>
        <FormFieldRow label={t('所在地区')}>
          <Input
            value={value.region || ''}
            onChange={(e) => set({ region: e.target.value })}
            placeholder={t('如：江苏省苏州市')}
          />
        </FormFieldRow>
        <FormFieldRow label={t('成立年份')}>
          <Input
            type="number"
            min={1900}
            max={2100}
            value={value.establishedYear ?? ''}
            onChange={(e) => set({ establishedYear: num(e.target.value) })}
          />
        </FormFieldRow>
        <FormFieldRow label={t('企业规模（人数）')}>
          <Input
            type="number"
            min={0}
            value={value.employeeCount ?? ''}
            onChange={(e) => set({ employeeCount: num(e.target.value) })}
          />
        </FormFieldRow>
        <FormFieldRow label={t('联系人')}>
          <Input
            value={value.contactPerson || ''}
            onChange={(e) => set({ contactPerson: e.target.value })}
          />
        </FormFieldRow>
        <FormFieldRow label={t('联系电话')}>
          <Input
            value={value.contactPhone || ''}
            onChange={(e) => set({ contactPhone: e.target.value })}
          />
        </FormFieldRow>
        <FormFieldRow label={t('联系邮箱')}>
          <Input
            value={value.contactEmail || ''}
            onChange={(e) => set({ contactEmail: e.target.value })}
          />
        </FormFieldRow>
        <FormFieldRow label={t('详细地址')}>
          <Input
            value={value.address || ''}
            onChange={(e) => set({ address: e.target.value })}
          />
        </FormFieldRow>
      </div>
      <FormFieldRow label={t('Logo')}>
        <SingleImageUpload
          label={t('Logo')}
          value={value.logoUrl || ''}
          onChange={(v) => set({ logoUrl: v })}
          allowUrlInput={false}
        />
      </FormFieldRow>
      <FormFieldRow label={t('封面图')}>
        <SingleImageUpload
          label={t('封面图')}
          value={value.coverImage || ''}
          onChange={(v) => set({ coverImage: v })}
          allowUrlInput={false}
        />
      </FormFieldRow>
      <FormFieldRow label={t('企业展示封面图')}>
        <ImageListUpload
          label={t('企业展示封面图')}
          value={value.coverPhotos || []}
          onChange={(v) => set({ coverPhotos: v })}
          multiple
          allowUrlInput={false}
        />
      </FormFieldRow>
      <FormFieldRow label={t('营业执照图')}>
        <ImageListUpload
          label={t('营业执照图')}
          value={value.businessLicensePhotos || []}
          onChange={(v) => set({ businessLicensePhotos: v })}
          multiple
          allowUrlInput={false}
        />
      </FormFieldRow>
      <FormFieldRow label={t('企业荣誉资质图')}>
        <ImageListUpload
          label={t('企业荣誉资质图')}
          value={value.qualificationPhotos || []}
          onChange={(v) => set({ qualificationPhotos: v })}
          multiple
          allowUrlInput={false}
        />
      </FormFieldRow>
      <FormFieldRow label={t('知识产权图')}>
        <ImageListUpload
          label={t('知识产权图')}
          value={value.intellectualPropertyPhotos || []}
          onChange={(v) => set({ intellectualPropertyPhotos: v })}
          multiple
          allowUrlInput={false}
        />
      </FormFieldRow>
      <FormFieldRow label={t('关联二级学院')}>
        <ComboboxSelect
          multiple
          className="w-full"
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
          rows={3}
        />
      </FormFieldRow>
    </div>
  )
}

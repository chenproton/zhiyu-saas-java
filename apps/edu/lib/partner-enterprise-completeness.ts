// 企业资料完整度检查：企业信息页与 workspace 待办卡共用。
// 返回未完善的资料项 key（调用方用 t() 转文案）。
import type { PartnerEnterprise } from '@/lib/api'

type CompletenessInput = Partial<
  Pick<
    PartnerEnterprise,
    | 'logoUrl'
    | 'description'
    | 'contactPerson'
    | 'contactPhone'
    | 'coverImage'
    | 'businessLicensePhotos'
    | 'intellectualPropertyPhotos'
    | 'qualificationPhotos'
  >
>

export function getEnterpriseMissingFields(e: CompletenessInput): string[] {
  const missing: string[] = []
  if (!e.logoUrl) missing.push('企业 Logo')
  if (!e.description) missing.push('企业简介')
  if (!e.contactPerson || !e.contactPhone) missing.push('联系人和联系电话')
  if (!e.coverImage) missing.push('企业主页封面')
  if (
    (e.businessLicensePhotos?.length ?? 0) === 0 &&
    (e.intellectualPropertyPhotos?.length ?? 0) === 0 &&
    (e.qualificationPhotos?.length ?? 0) === 0
  ) {
    missing.push('资质/证照图片')
  }
  return missing
}

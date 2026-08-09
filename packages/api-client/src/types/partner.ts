// 企业平台（Partner）类型定义，API 契约见 docs/spec/partner-enterprise-platform.md §5
import type { User } from '../../../shared-types/src/shared-models'
import type { AllianceExpert } from '../../../shared-types/src/alliance'
import type { Role } from './backend'

/** 企业主体（partner_enterprises，全局唯一，企业侧自维护） */
export interface PartnerEnterprise {
  id: string
  tenantId: string
  name: string
  unifiedSocialCreditCode?: string
  industry?: string
  region?: string
  description?: string
  logoUrl?: string
  coverImage?: string
  cooperationTypes?: string[]
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  establishedYear?: number
  employeeCount?: number
  businessLicensePhotos?: string[]
  qualificationPhotos?: string[]
  intellectualPropertyPhotos?: string[]
  coverPhotos?: string[]
  /** 企业侧"愿意对外展示"开关（联盟前台展示双控之一） */
  enablePublic: boolean
  createdAt: string
  updatedAt: string
}

/** 企业主体信息更新请求（PUT /partner/enterprise/profile） */
export type PartnerEnterpriseUpdateRequest = Partial<
  Omit<PartnerEnterprise, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
>

/** 企业专家档案（alliance_experts，归属企业租户；userId 绑定企业成员账号） */
export interface PartnerExpert extends AllianceExpert {
  userId?: string
}

/** 企业成员账号（users，platform=partner；后端返回 domain.User，角色在 roleCodes 数组） */
export interface PartnerMember {
  id: string
  username: string
  name: string
  phone?: string
  email?: string
  roleCode: 'enterprise_admin' | 'enterprise_member'
  /** 后端实际返回的角色字段（domain.User.roleCodes）；roleCode 仅供前端表单/请求使用 */
  roleCodes?: string[]
  status: string
  lastLoginAt?: string
  createdAt: string
}

export interface PartnerMemberCreateRequest {
  username: string
  password: string
  name: string
  phone?: string
  email?: string
  roleCode?: 'enterprise_admin' | 'enterprise_member'
}

export interface PartnerMemberUpdateRequest {
  name?: string
  phone?: string
  email?: string
  roleCode?: 'enterprise_admin' | 'enterprise_member'
  status?: string
  password?: string
}

/** 企业自助注册请求（POST /auth/partner/register，注册即生效并签发 token） */
export interface PartnerRegisterRequest {
  enterpriseName: string
  unifiedSocialCreditCode: string
  contactPerson: string
  contactPhone: string
  contactEmail?: string
  username: string
  password: string
}

/** GET /auth/partner/me：用户信息 + 企业主体合并返回 */
export interface PartnerMeResponse {
  user: User
  enterprise?: PartnerEnterprise
  roles?: Role[]
}

/** GET /partner/workspace/dashboard：服务台统计 */
export interface PartnerDashboard {
  expertCount: number
  schoolCount: number
  memberCount: number
  publicExpertCount?: number
}

/** GET /partner/schools：合作学校（link 反向视图，对应后端 domain.AlliancePartnerSchool） */
export interface PartnerSchool {
  linkId: string
  tenantId: string
  schoolName: string
  relationType: string
  /** link 管理字段（学校侧维护，企业只读） */
  status: string
  rating?: string
  enterpriseType?: string
  isPublic: boolean
  createdAt: string
}

/** PUT /partner/me/password */
export interface PartnerChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

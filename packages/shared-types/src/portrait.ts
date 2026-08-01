import type { EvaluationGrade } from './graduation'

// ==================== 学生能力画像管理相关 ====================

export type ArchiveMaterialType =
  'certificate' | 'competition' | 'activity' | 'internship' | 'skill'
export type ArchiveAuditStatus = 'pending' | 'approved' | 'rejected'
export type ArchiveDirection = 'positive' | 'negative'

export interface StudentAbilityArchive {
  id: string
  studentName: string
  studentId: string
  className: string
  materialType: ArchiveMaterialType
  materialName: string
  issuingOrg: string
  obtainDate: Date
  auditStatus: ArchiveAuditStatus
  auditRemark?: string
  convertedCredit: number
  direction: ArchiveDirection
  isEnabled: boolean
  createdAt: Date
  level?: string
}

export type EvalAbilityDomain = 'industry' | 'professional' | 'skill' | 'general' | 'quality'

export interface AbilityDomainScore {
  domain: EvalAbilityDomain
  domainLabel: string
  score: number
  level: string
}

export interface CourseRecord {
  courseName: string
  credit: number
  grade: EvaluationGrade
  finalScore: number
}

export interface StudentAbilityPortrait {
  id: string
  studentName: string
  studentId: string
  className: string
  majorName: string
  positionName: string
  overallGrade: EvaluationGrade
  domainScores: AbilityDomainScore[]
  classRank: number
  classTotal: number
  majorRank: number
  majorTotal: number
  recommendPositions: { positionName: string; matchRate: number }[]
  updatedAt: Date
  gender: string
  gradeYear: string
  avatarUrl?: string
  courses: string[]
  scenes: string[]
  completedCourses: number
  completedScenes: number
  totalCredits: number
  archiveCount: number
  courseRecords: CourseRecord[]
  graduationQualified: boolean
  attendanceRate: number
  diplomaBadge: string
  yearRank: number
  yearTotal: number
  dualBadge: string
}

// ==================== 画像表单数据类型 ====================

export interface StudentAbilityArchiveFormData {
  studentName: string
  studentId: string
  className: string
  materialType: ArchiveMaterialType
  materialName: string
  issuingOrg: string
  obtainDate: string
  direction: ArchiveDirection
}

export interface ArchiveAuditFormData {
  auditStatus: ArchiveAuditStatus
  auditRemark?: string
  convertedCredit: number
}

// ==================== 画像演示用扩展类型 ====================

export interface AppealRecord {
  id: string
  studentId: string
  studentName: string
  type: 'grade' | 'graduation' | 'ability'
  reason: string
  status: 'pending' | 'processing' | 'resolved' | 'rejected'
  createdAt: Date
}

export interface CreditConversionRule {
  id: string
  materialType: ArchiveMaterialType
  level: string
  credit: number
}

export interface ArchiveVersion {
  id: string
  archiveId: string
  version: number
  changedBy: string
  changeSummary: string
  createdAt: Date
}

export interface EvaluationStandard {
  id: string
  positionId: string
  positionName: string
  dimensions: { name: string; weight: number; maxScore: number }[]
}

export interface PortraitUpdateConfig {
  updateCycle: 'realtime' | 'daily' | 'weekly'
  queryLimit: number
  queryTimeStart: string
  queryTimeEnd: string
}

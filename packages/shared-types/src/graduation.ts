// ==================== 毕业设计管理相关 ====================

export type TopicSource = 'scene' | 'enterprise'
export type TopicStatus = 'draft' | 'pending' | 'published' | 'locked'

export interface GraduationProjectTopic {
  id: string
  name: string
  positionId: string
  positionName: string
  college: string
  source: TopicSource
  status: TopicStatus
  capacity: number
  appliedCount: number
  advisorName: string
  enterpriseMentorName?: string
  startDate: Date
  endDate: Date
  description?: string
  createdAt: Date
}

export type ArchivePhase = 'proposal' | 'midterm' | 'process' | 'final'
export type ArchiveDocStatus = 'making' | 'reviewing' | 'returned' | 'passed'

export interface GraduationProjectArchive {
  id: string
  topicId: string
  topicName: string
  studentName: string
  studentId: string
  advisorName: string
  enterpriseMentorName?: string
  positionName: string
  phase: ArchivePhase
  docStatus: ArchiveDocStatus
  docCount: number
  lastUpdated: Date
  hasRectification: boolean
}

export type EvaluationGrade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface GraduationProjectEvaluation {
  id: string
  topicId: string
  topicName: string
  studentName: string
  studentId: string
  advisorScore: number
  enterpriseScore?: number
  defenseScore?: number
  comprehensiveGrade: EvaluationGrade
  isExcellent: boolean
  evaluationTime: Date
  status: 'pending' | 'completed'
}

export interface GraduationQueryResult {
  id: string
  studentName: string
  studentId: string
  className: string
  majorName: string
  creditCompleted: number
  creditRequired: number
  scenePassed: number
  sceneRequired: number
  projectGrade: EvaluationGrade | null
  graduationStatus: 'qualified' | 'unqualified' | 'pending'
  abilityCertStatus: 'certified' | 'uncertified' | 'pending'
  rectificationCount: number
}

export interface TopicApplication {
  id: string
  topicId: string
  topicName: string
  studentId: string
  studentName: string
  className: string
  status: 'pending' | 'approved' | 'rejected' | 'allocated'
  applyReason: string
  appliedAt: Date
  allocatedAdvisorId?: string
  allocatedAdvisorName?: string
}

// ==================== 毕业设计表单数据类型 ====================

export interface GraduationProjectTopicFormData {
  name: string
  positionId: string
  college: string
  source: TopicSource
  capacity: number
  advisorName: string
  enterpriseMentorName?: string
  startDate: string
  endDate: string
  description?: string
}

export interface GraduationProjectEvaluationFormData {
  advisorScore: number
  enterpriseScore?: number
  defenseScore?: number
  comprehensiveGrade: EvaluationGrade
  isExcellent: boolean
}

// ==================== 毕业设计演示用扩展类型 ====================

export interface ProcessEvaluation {
  id: string
  archiveId: string
  studentName: string
  topicName: string
  phase: 'proposal' | 'midterm' | 'process'
  advisorScore: number
  comment: string
  evaluatedAt: Date
}

export interface RectificationDetail {
  id: string
  archiveId: string
  studentId: string
  studentName: string
  topicName: string
  requirement: string
  deadline: Date
  status: 'pending' | 'submitted' | 'approved'
  studentResponse?: string
  submittedAt?: Date
}

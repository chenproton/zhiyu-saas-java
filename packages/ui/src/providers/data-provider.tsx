"use client"

import React, { createContext, useContext } from 'react'
import type {
  QuestionBank,
  Question,
  Exam,
  ExamQuestion,
  QuestionBankFormData,
  QuestionFormData,
  ExamFormData,
  StatusAction,
  EvaluationMethodCategory,
  EvaluationMethod,
  SceneTask,
  SceneEvaluationResult,
  JobAbilityResult,
  Position,
  ApprovalItem,
  GraduationProjectTopic,
  GraduationProjectArchive,
  GraduationProjectEvaluation,
  GraduationQueryResult,
  StudentAbilityArchive,
  StudentAbilityPortrait,
  ProcessEvaluation,
  RectificationDetail,
  AppealRecord,
  CreditConversionRule,
  EvaluationStandard,
  EvalAbilityItem,
  CertIssuanceRecord,
} from '@zhiyu/shared-types'
import type { ApprovalRecord } from '@zhiyu/shared-types'
// ==================== Date parsing helpers ====================

export const parseDate = (v: string | Date | undefined): Date => (v ? new Date(v) : new Date())
export const parseOptDate = (v: string | Date | undefined): Date | undefined => (v ? new Date(v) : undefined)

export const parseQuestionBank = (bank: QuestionBank): QuestionBank => ({
  ...bank,
  createdAt: parseDate(bank.createdAt as unknown as string | Date),
  updatedAt: parseDate(bank.updatedAt as unknown as string | Date),
})

export const parseQuestion = (q: Question): Question => ({
  ...q,
  createdAt: parseDate(q.createdAt as unknown as string | Date),
})

export const parseExam = (exam: Exam): Exam => ({
  ...exam,
  questions: exam.questions || [],
  createdAt: parseDate(exam.createdAt as unknown as string | Date),
  updatedAt: parseDate(exam.updatedAt as unknown as string | Date),
})

export const parseSceneResult = (r: SceneEvaluationResult): SceneEvaluationResult => ({
  ...r,
  gradedAt: parseOptDate(r.gradedAt as unknown as string | Date),
  createdAt: parseOptDate(r.createdAt as unknown as string | Date),
  updatedAt: parseOptDate(r.updatedAt as unknown as string | Date),
})

export const parseTopic = (t: GraduationProjectTopic): GraduationProjectTopic => ({
  ...t,
  startDate: parseDate(t.startDate as unknown as string | Date),
  endDate: parseDate(t.endDate as unknown as string | Date),
  createdAt: parseDate(t.createdAt as unknown as string | Date),
})

export const parseArchive = (a: GraduationProjectArchive): GraduationProjectArchive => ({
  ...a,
  lastUpdated: parseDate(a.lastUpdated as unknown as string | Date),
})

export const parseEvaluation = (e: GraduationProjectEvaluation): GraduationProjectEvaluation => ({
  ...e,
  evaluationTime: parseDate(e.evaluationTime as unknown as string | Date),
})

export const parseStudentArchive = (a: StudentAbilityArchive): StudentAbilityArchive => ({
  ...a,
  obtainDate: parseDate(a.obtainDate as unknown as string | Date),
  createdAt: parseDate(a.createdAt as unknown as string | Date),
})

export const parsePortrait = (p: StudentAbilityPortrait): StudentAbilityPortrait => ({
  ...p,
  updatedAt: parseDate(p.updatedAt as unknown as string | Date),
})

export const parseCertRecord = (r: CertIssuanceRecord): CertIssuanceRecord => ({
  ...r,
  issueDate: parseDate(r.issueDate as unknown as string | Date),
  expireDate: parseOptDate(r.expireDate as unknown as string | Date | undefined),
  revokedAt: parseOptDate(r.revokedAt as unknown as string | Date | undefined),
})

// ==================== Approval helpers ====================

export const APPROVAL_TYPE_MAP: Record<string, ApprovalItem['type']> = {
  question: 'question',
  question_bank: 'questionBank',
  questionBank: 'questionBank',
  exam: 'exam',
  online_exam: 'onlineExam',
  onlineExam: 'onlineExam',
}

export const mapApprovalRecord = (record: ApprovalRecord): ApprovalItem => {
  const type = APPROVAL_TYPE_MAP[record.targetType] || 'question'
  const lastHistory = record.history?.[record.history.length - 1]
  return {
    id: record.id,
    type,
    title: `${type}审批 - ${record.targetId}`,
    description: undefined,
    submitterName: lastHistory?.reviewerName || record.submitterId,
    submitTime: parseDate(record.createdAt),
    status: record.status,
    remark: lastHistory?.comment,
  }
}

// ==================== DataContextValue type ====================

export interface DataContextValue {
  // 题库相关
  questionBanks: QuestionBank[]
  getQuestionBank: (id: string) => QuestionBank | undefined
  createQuestionBank: (data: QuestionBankFormData) => Promise<QuestionBank>
  updateQuestionBank: (id: string, data: QuestionBankFormData) => Promise<void>
  deleteQuestionBank: (id: string) => Promise<void>
  updateQuestionBankStatus: (id: string, action: StatusAction) => Promise<void>

  // 题目相关
  questions: Question[]
  getQuestionsByBank: (bankId: string) => Question[]
  getQuestion: (id: string) => Question | undefined
  createQuestion: (bankId: string, data: QuestionFormData) => Promise<Question>
  updateQuestion: (id: string, data: QuestionFormData) => Promise<void>
  deleteQuestion: (id: string) => Promise<void>
  updateQuestionStatus: (id: string, action: StatusAction) => Promise<void>
  moveQuestions: (questionIds: string[], targetBankId: string) => Promise<void>
  loadBankQuestions?: (bankId: string) => Promise<void>

  // 试卷相关
  exams: Exam[]
  loadExams?: () => Promise<void>
  getExam: (id: string) => Exam | undefined
  createExam: (data: ExamFormData) => Promise<Exam>
  updateExam: (id: string, data: Partial<Exam>) => Promise<void>
  deleteExam: (id: string) => Promise<void>
  updateExamStatus: (id: string, action: StatusAction) => Promise<void>
  addQuestionToExam: (examId: string, question: Question, score?: number) => Promise<void>
  removeQuestionFromExam: (examId: string, examQuestionId: string) => Promise<void>
  updateExamQuestionScore: (examId: string, examQuestionId: string, score: number) => Promise<void>
  updateExamQuestionScores?: (examId: string, scores: Record<string, number>) => Promise<void>
  reorderExamQuestions: (examId: string, questions: ExamQuestion[]) => Promise<void>

  // 场景任务测评相关
  evaluationCategories: EvaluationMethodCategory[]
  evaluationMethods: EvaluationMethod[]
  sceneTasks: SceneTask[]
  sceneEvaluationResults: SceneEvaluationResult[]

  // 岗位能力测评结果
  jobAbilityResults: JobAbilityResult[]
  positionsList: Position[]
  getPositionAbilityItems: (positionId: string) => EvalAbilityItem[]

  // 审批中心
  approvalItems: ApprovalItem[]
  approveItem: (id: string, remark?: string) => Promise<void>
  rejectItem: (id: string, remark?: string) => Promise<void>

  // 毕业设计管理
  graduationProjectTopics: GraduationProjectTopic[]
  graduationProjectArchives: GraduationProjectArchive[]
  graduationProjectEvaluations: GraduationProjectEvaluation[]
  graduationQueryResults: GraduationQueryResult[]
  processEvaluations: ProcessEvaluation[]
  rectificationDetails: RectificationDetail[]
  appealRecords: AppealRecord[]
  evaluationStandards: EvaluationStandard[]
  createProcessEvaluation: (data: Record<string, unknown>) => ProcessEvaluation
  createRectificationDetail: (data: Record<string, unknown>) => RectificationDetail
  updateRectificationDetail: (id: string, data: Partial<RectificationDetail>) => void
  createAppealRecord: (data: Record<string, unknown>) => AppealRecord
  updateAppealRecord: (id: string, data: Partial<AppealRecord>) => void
  updateEvaluationStandard: (id: string, data: Partial<EvaluationStandard>) => void

  // 学生能力画像管理
  studentAbilityArchives: StudentAbilityArchive[]
  studentAbilityPortraits: StudentAbilityPortrait[]
  creditConversionRules: CreditConversionRule[]
  archiveVersions: StudentAbilityArchive[]

  // 毕业设计管理操作
  updateGraduationProjectArchive: (id: string, data: Partial<GraduationProjectArchive>) => Promise<void>
  updateGraduationProjectEvaluation: (id: string, data: Partial<GraduationProjectEvaluation>) => Promise<void>

  // 学生能力画像管理操作
  createStudentAbilityArchive: (data: Record<string, unknown>) => Promise<StudentAbilityArchive>
  updateStudentAbilityArchive: (id: string, data: Partial<StudentAbilityArchive>) => Promise<void>
  deleteStudentAbilityArchive: (id: string) => Promise<void>
  updateCreditConversionRules: (rules: CreditConversionRule[]) => void

  // 微证书管理
  certIssuanceRecords: CertIssuanceRecord[]
  issueCert: (data: Omit<CertIssuanceRecord, 'id' | 'certNumber' | 'status'>) => Promise<CertIssuanceRecord>
  issueBatchCerts: (records: Omit<CertIssuanceRecord, 'id' | 'certNumber' | 'status'>[]) => Promise<CertIssuanceRecord[]>
  revokeCert: (id: string, reason: string) => Promise<void>
}

// ==================== Context + hook factory ====================

export function createDataContext() {
  return createContext<DataContextValue | null>(null)
}

export function createUseData(ctx: React.Context<DataContextValue | null>) {
  return function useData() {
    const context = useContext(ctx)
    if (!context) {
      throw new Error('useData must be used within a DataProvider')
    }
    return context
  }
}

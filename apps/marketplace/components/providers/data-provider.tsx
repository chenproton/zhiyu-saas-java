"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
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
  CertIssuanceRecord,
} from '@/lib/types'
import { getNextStatus, canPerformAction } from '@/lib/types'
import {
  questionBankApi,
  questionApi,
  examApi,
  evaluationBatchApi,
  evaluationMethodApi,
  evaluationResultApi,
  approvalApi,
  graduationApi,
  portraitApi,
  microCertApi,
  taskApi,
  scenarioApi,
} from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { DataContextValue } from '@zhiyu/ui'
import {
  parseQuestionBank,
  parseQuestion,
  parseExam,
  parseSceneResult,
  parseTopic,
  parseArchive,
  parseEvaluation,
  parseStudentArchive,
  parsePortrait,
  parseCertRecord,
  parseDate,
  mapApprovalRecord,
} from '@zhiyu/ui'

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [exams, setExams] = useState<Exam[]>([])

  // 场景任务测评状态
  const [evaluationCategories, setEvaluationCategories] = useState<EvaluationMethodCategory[]>([])
  const [evaluationMethods, setEvaluationMethods] = useState<EvaluationMethod[]>([])
  const [sceneTasks, setSceneTasks] = useState<SceneTask[]>([])
  const [sceneEvaluationResults, setSceneEvaluationResults] = useState<SceneEvaluationResult[]>([])
  const [jobAbilityResults, setJobAbilityResults] = useState<JobAbilityResult[]>([])
  const [positionsListState] = useState<Position[]>([])
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([])

  // 毕业设计管理状态
  const [graduationProjectTopics, setGraduationProjectTopics] = useState<GraduationProjectTopic[]>([])
  const [graduationProjectArchives, setGraduationProjectArchives] = useState<GraduationProjectArchive[]>([])
  const [graduationProjectEvaluations, setGraduationProjectEvaluations] = useState<GraduationProjectEvaluation[]>([])
  const [graduationQueryResults, setGraduationQueryResults] = useState<GraduationQueryResult[]>([])
  const [processEvaluations, setProcessEvaluations] = useState<ProcessEvaluation[]>([])
  const [rectificationDetails, setRectificationDetails] = useState<RectificationDetail[]>([])
  const [appealRecords, setAppealRecords] = useState<AppealRecord[]>([])
  const [evaluationStandards, setEvaluationStandards] = useState<EvaluationStandard[]>([])

  // 学生能力画像管理状态
  const [studentAbilityArchives, setStudentAbilityArchives] = useState<StudentAbilityArchive[]>([])
  const [studentAbilityPortraits, setStudentAbilityPortraits] = useState<StudentAbilityPortrait[]>([])
  const [creditConversionRules, setCreditConversionRules] = useState<CreditConversionRule[]>([])
  const [archiveVersions, setArchiveVersions] = useState<StudentAbilityArchive[]>([])

  // 微证书管理状态
  const [certIssuanceRecords, setCertIssuanceRecords] = useState<CertIssuanceRecord[]>([])

  // ==================== Data loading ====================
  const loadQuestionBanks = useCallback(async () => {
    const res = await questionBankApi.list()
    setQuestionBanks(res.items.map(parseQuestionBank))
  }, [])

  const loadQuestions = useCallback(async () => {
    const res = await questionApi.list()
    setQuestions(res.items.map(parseQuestion))
  }, [])

  const loadExams = useCallback(async () => {
    const res = await examApi.list()
    setExams(res.items.map(parseExam))
  }, [])

  const loadEvaluationMethods = useCallback(async () => {
    const [categoriesRes, methodsRes] = await Promise.all([
      evaluationMethodApi.listCategories(),
      evaluationMethodApi.listMethods(),
    ])
    setEvaluationCategories(categoriesRes.items)
    setEvaluationMethods(methodsRes.items)
  }, [])

  const loadSceneResults = useCallback(async () => {
    const res = await evaluationResultApi.list()
    setSceneEvaluationResults(res.items.map(parseSceneResult))
  }, [])

  const loadSceneTasks = useCallback(async () => {
    const [tasksRes, scenariosRes] = await Promise.all([
      taskApi.list(),
      scenarioApi.list(),
    ])
    const scenarioMap = new Map(scenariosRes.items.map((s) => [s.id, s.name]))
    setSceneTasks(
      tasksRes.items.map((t) => ({
        id: t.id,
        name: t.name,
        sceneName: scenarioMap.get(t.scenarioId) || t.scenarioId,
        methodIds: [],
      }))
    )
  }, [])

  const loadJobAbilityResults = useCallback(async () => {
    const res = await evaluationResultApi.list()
    setJobAbilityResults(
      res.items.map((r) => ({
        id: r.id,
        positionId: r.methodKey,
        positionName: r.methodKey,
        positionCode: r.methodKey,
        studentName: r.evaluateeId,
        studentId: r.evaluateeId,
        totalAbilityPoints: r.maxScore,
        achievedAbilityPoints: r.totalScore || 0,
        achievementRate:
          r.maxScore > 0 ? Math.round(((r.totalScore || 0) / r.maxScore) * 100) : 0,
        evaluationTime: parseDate((r.gradedAt || r.createdAt) as unknown as string | Date),
      }))
    )
  }, [])

  const loadApprovalItems = useCallback(async () => {
    const [banks, exams] = await Promise.all([
      approvalApi.list({ targetType: 'question_bank', limit: 1000 }),
      approvalApi.list({ targetType: 'exam', limit: 1000 }),
    ])
    setApprovalItems([...banks.items, ...exams.items].map(mapApprovalRecord))
  }, [])

  const loadGraduationTopics = useCallback(async () => {
    const res = await graduationApi.listTopics()
    setGraduationProjectTopics(res.items.map(parseTopic))
  }, [])

  const loadGraduationArchives = useCallback(async () => {
    const res = await graduationApi.listArchives()
    setGraduationProjectArchives(res.items.map(parseArchive))
  }, [])

  const loadGraduationEvaluations = useCallback(async () => {
    const res = await graduationApi.listEvaluations()
    setGraduationProjectEvaluations(res.items.map(parseEvaluation))
  }, [])

  const loadGraduationQueryResults = useCallback(async () => {
    const res = await graduationApi.queryResults()
    setGraduationQueryResults(res.items)
  }, [])

  const loadStudentAbilityArchives = useCallback(async () => {
    const res = await portraitApi.listArchives()
    const parsed = res.items.map(parseStudentArchive)
    setStudentAbilityArchives(parsed)
    setArchiveVersions(parsed)
  }, [])

  const loadStudentAbilityPortraits = useCallback(async () => {
    const res = await portraitApi.list()
    setStudentAbilityPortraits(res.items.map(parsePortrait))
  }, [])

  const loadCertIssuanceRecords = useCallback(async () => {
    const res = await microCertApi.listHistory()
    setCertIssuanceRecords(res.items.map(parseCertRecord))
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      try {
        await Promise.all([
          loadQuestionBanks(),
          loadQuestions(),
          loadExams(),
          loadApprovalItems(),
        ])
        if (cancelled) return
        await Promise.all([
          loadEvaluationMethods(),
          loadSceneTasks(),
          loadSceneResults(),
          loadJobAbilityResults(),
          loadGraduationTopics(),
          loadGraduationArchives(),
          loadGraduationEvaluations(),
          loadGraduationQueryResults(),
          loadStudentAbilityArchives(),
          loadStudentAbilityPortraits(),
        ])
      } catch (err) {
        if (!cancelled) {
        }
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [
    loadQuestionBanks,
    loadQuestions,
    loadExams,
    loadEvaluationMethods,
    loadSceneTasks,
    loadSceneResults,
    loadJobAbilityResults,
    loadApprovalItems,
    loadGraduationTopics,
    loadGraduationArchives,
    loadGraduationEvaluations,
    loadGraduationQueryResults,
    loadStudentAbilityArchives,
    loadStudentAbilityPortraits,
  ])

  // ==================== Approval actions ====================
  const approveItem = useCallback(async (id: string, remark?: string) => {
    await approvalApi.review(id, { status: 'approved', comment: remark })
    await loadApprovalItems()
  }, [loadApprovalItems])

  const rejectItem = useCallback(async (id: string, remark?: string) => {
    await approvalApi.review(id, { status: 'rejected', comment: remark })
    await loadApprovalItems()
  }, [loadApprovalItems])

  // ==================== Question bank actions ====================
  const getQuestionBank = useCallback(
    (id: string) => questionBanks.find((bank) => bank.id === id),
    [questionBanks]
  )

  const createQuestionBank = useCallback(async (data: QuestionBankFormData): Promise<QuestionBank> => {
    const created = await questionBankApi.create({
      ...data,
      status: 'draft',
      version: 'v0.1.0',
      ownerType: 'mine',
    } as Omit<QuestionBank, 'id' | 'questionCount' | 'createdAt' | 'updatedAt'>)
    await loadQuestionBanks()
    return parseQuestionBank(created)
  }, [loadQuestionBanks])

  const updateQuestionBank = useCallback(async (id: string, data: QuestionBankFormData) => {
    await questionBankApi.update(id, data)
    await loadQuestionBanks()
  }, [loadQuestionBanks])

  const deleteQuestionBank = useCallback(async (id: string) => {
    const bank = questionBanks.find((b) => b.id === id)
    if (bank?.isDraftPool) return
    await questionBankApi.delete(id)
    await Promise.all([loadQuestionBanks(), loadQuestions()])
  }, [questionBanks, loadQuestionBanks, loadQuestions])

  const updateQuestionBankStatus = useCallback(async (id: string, action: StatusAction) => {
    const bank = questionBanks.find((b) => b.id === id)
    switch (action) {
      case 'save_draft':
        await questionBankApi.saveDraft(id)
        break
      case 'submit': {
        if (!bank?.batchId) {
          toast({ variant: 'destructive', title: '无法提交', description: '该题库未关联批次，无法提交审批' })
          return
        }
        const batch = await evaluationBatchApi.get(bank.batchId)
        await questionBankApi.submit(id)
        await approvalApi.create({ targetType: 'question_bank', targetId: id, workflowId: batch.workflowId })
        break
      }
      case 'withdraw':
        await questionBankApi.withdraw(id)
        break
      case 'approve':
      case 'reject': {
        const records = await approvalApi.list({ targetType: 'question_bank', targetId: id, status: 'pending', limit: 1 })
        if (records.items.length > 0) {
          await approvalApi.review(records.items[0].id, { status: action === 'approve' ? 'approved' : 'rejected' })
        }
        break
      }
      case 'publish':
        await questionBankApi.publish(id)
        break
      case 'unpublish':
        await questionBankApi.unpublish(id)
        break
    }
    await loadQuestionBanks()
  }, [loadQuestionBanks, questionBanks, toast])

  // ==================== Question actions ====================
  const getQuestionsByBank = useCallback(
    (bankId: string) => questions.filter((q) => q.bankId === bankId),
    [questions]
  )

  const getQuestion = useCallback(
    (id: string) => questions.find((q) => q.id === id),
    [questions]
  )

  const createQuestion = useCallback(async (bankId: string, data: QuestionFormData): Promise<Question> => {
    const created = await questionApi.create({
      ...data,
      bankId,
      status: 'draft',
    } as Omit<Question, 'id' | 'createdAt'>)
    await Promise.all([loadQuestions(), loadQuestionBanks()])
    return parseQuestion(created)
  }, [loadQuestions, loadQuestionBanks])

  const updateQuestion = useCallback(async (id: string, data: QuestionFormData) => {
    await questionApi.update(id, data)
    await loadQuestions()
  }, [loadQuestions])

  const updateQuestionStatus = useCallback(async (id: string, action: StatusAction) => {
    if (!canPerformAction(getQuestion(id)?.status || 'draft', action)) return
    await questionApi.update(id, { status: getNextStatus(action) })
    await loadQuestions()
  }, [getQuestion, loadQuestions])

  const deleteQuestion = useCallback(async (id: string) => {
    await questionApi.delete(id)
    await Promise.all([loadQuestions(), loadQuestionBanks()])
  }, [loadQuestions, loadQuestionBanks])

  const moveQuestions = useCallback(async (questionIds: string[], targetBankId: string) => {
    const targetBank = questionBanks.find((b) => b.id === targetBankId)
    if (!targetBank) return
    await Promise.all(
      questionIds.map((qid) => questionApi.update(qid, { bankId: targetBankId }))
    )
    await Promise.all([loadQuestions(), loadQuestionBanks()])
  }, [questionBanks, loadQuestions, loadQuestionBanks])

  // ==================== Exam actions ====================
  const getExam = useCallback(
    (id: string) => exams.find((exam) => exam.id === id),
    [exams]
  )

  const createExam = useCallback(async (data: ExamFormData): Promise<Exam> => {
    const created = await examApi.create({
      ...data,
      status: 'draft',
      version: 'v0.1.0',
      ownerType: 'mine',
      questions: [],
    } as Omit<Exam, 'id' | 'totalScore' | 'createdAt' | 'updatedAt'>)
    await loadExams()
    return parseExam(created)
  }, [loadExams])

  const updateExam = useCallback(async (id: string, data: Partial<Exam>) => {
    await examApi.update(id, data)
    await loadExams()
  }, [loadExams])

  const deleteExam = useCallback(async (id: string) => {
    await examApi.delete(id)
    await loadExams()
  }, [loadExams])

  const updateExamStatus = useCallback(async (id: string, action: StatusAction) => {
    const exam = exams.find((e) => e.id === id)
    switch (action) {
      case 'save_draft':
        await examApi.saveDraft(id)
        break
      case 'submit': {
        if (!exam?.batchId) {
          toast({ variant: 'destructive', title: '无法提交', description: '该试卷未关联批次，无法提交审批' })
          return
        }
        const batch = await evaluationBatchApi.get(exam.batchId)
        await examApi.submit(id)
        await approvalApi.create({ targetType: 'exam', targetId: id, workflowId: batch.workflowId })
        break
      }
      case 'withdraw':
        await examApi.withdraw(id)
        break
      case 'approve':
      case 'reject': {
        const records = await approvalApi.list({ targetType: 'exam', targetId: id, status: 'pending', limit: 1 })
        if (records.items.length > 0) {
          await approvalApi.review(records.items[0].id, { status: action === 'approve' ? 'approved' : 'rejected' })
        }
        break
      }
      case 'publish':
        await examApi.publish(id)
        break
      case 'unpublish':
        await examApi.unpublish(id)
        break
    }
    await loadExams()
  }, [loadExams, exams, toast])

  const addQuestionToExam = useCallback(async (examId: string, question: Question, score?: number) => {
    const exam = exams.find((e) => e.id === examId)
    if (!exam || exam.questions.some((q) => q.questionId === question.id)) return
    await examApi.addQuestion(examId, question.id, score ?? question.score)
    await loadExams()
  }, [exams, loadExams])

  const removeQuestionFromExam = useCallback(async (examId: string, examQuestionId: string) => {
    const exam = exams.find((e) => e.id === examId)
    if (!exam) return
    const eq = exam.questions.find((q) => q.id === examQuestionId)
    if (!eq) return
    await examApi.removeQuestion(examId, eq.questionId)
    await loadExams()
  }, [exams, loadExams])

  const updateExamQuestionScore = useCallback(async (examId: string, examQuestionId: string, score: number) => {
    const exam = exams.find((e) => e.id === examId)
    if (!exam) return
    const eq = exam.questions.find((q) => q.id === examQuestionId)
    if (!eq) return
    await examApi.updateQuestionScore(examId, eq.questionId, score)
    await loadExams()
  }, [exams, loadExams])

  const reorderExamQuestions = useCallback(async (examId: string, questions: ExamQuestion[]) => {
    const exam = exams.find((e) => e.id === examId)
    if (!exam) return
    const ordered = questions.map((q, index) => ({ ...q, order: index + 1 }))
    await examApi.update(examId, {
      name: exam.name,
      description: exam.description,
      duration: exam.duration,
      coverImage: exam.coverImage,
      questions: ordered,
    })
    await loadExams()
  }, [exams, loadExams])

  const value: DataContextValue = {
    questionBanks,
    getQuestionBank,
    createQuestionBank,
    updateQuestionBank,
    deleteQuestionBank,
    updateQuestionBankStatus,
    questions,
    getQuestionsByBank,
    getQuestion,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    updateQuestionStatus,
    moveQuestions,
    exams,
    getExam,
    createExam,
    updateExam,
    deleteExam,
    updateExamStatus,
    addQuestionToExam,
    removeQuestionFromExam,
    updateExamQuestionScore,
    reorderExamQuestions,
    evaluationCategories,
    evaluationMethods,
    sceneTasks,
    sceneEvaluationResults,
    jobAbilityResults,
    positionsList: positionsListState,
    getPositionAbilityItems: () => [],
    approvalItems,
    approveItem,
    rejectItem,
    graduationProjectTopics,
    graduationProjectArchives,
    graduationProjectEvaluations,
    graduationQueryResults,
    processEvaluations,
    rectificationDetails,
    appealRecords,
    evaluationStandards,
    createProcessEvaluation: (data: any) => {
      const newEval: ProcessEvaluation = {
        id: `pe-${Date.now()}`,
        archiveId: data.archiveId,
        studentName: data.studentName,
        topicName: data.topicName,
        phase: data.phase,
        advisorScore: data.advisorScore,
        comment: data.comment,
        evaluatedAt: new Date(),
      }
      setProcessEvaluations((prev) => [...prev, newEval])
      return newEval
    },
    createRectificationDetail: (data: any) => {
      const newRect: RectificationDetail = {
        id: `rect-${Date.now()}`,
        archiveId: data.archiveId,
        studentId: data.studentId,
        studentName: data.studentName,
        topicName: data.topicName,
        requirement: data.requirement,
        deadline: new Date(data.deadline),
        status: 'pending',
        studentResponse: data.studentResponse,
        submittedAt: data.submittedAt ? new Date(data.submittedAt) : undefined,
      }
      setRectificationDetails((prev) => [...prev, newRect])
      return newRect
    },
    updateRectificationDetail: (id: string, data: Partial<RectificationDetail>) => {
      setRectificationDetails((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data } : r))
      )
    },
    createAppealRecord: (data: any) => {
      const newAppeal: AppealRecord = {
        id: `appeal-${Date.now()}`,
        studentId: data.studentId,
        studentName: data.studentName,
        type: data.type,
        reason: data.reason,
        status: 'pending',
        createdAt: new Date(),
      }
      setAppealRecords((prev) => [...prev, newAppeal])
      return newAppeal
    },
    updateAppealRecord: (id: string, data: Partial<AppealRecord>) => {
      setAppealRecords((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...data } : a))
      )
    },
    updateEvaluationStandard: (id: string, data: Partial<EvaluationStandard>) => {
      setEvaluationStandards((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data } : s))
      )
    },
    creditConversionRules,
    archiveVersions,
    studentAbilityArchives,
    studentAbilityPortraits,

    updateGraduationProjectArchive: async (id: string, data: Partial<GraduationProjectArchive>) => {
      await graduationApi.upsertArchive(data)
      await loadGraduationArchives()
    },
    updateGraduationProjectEvaluation: async (id: string, data: Partial<GraduationProjectEvaluation>) => {
      await graduationApi.upsertEvaluation({ ...data, status: 'completed' })
      await loadGraduationEvaluations()
    },

    createStudentAbilityArchive: async (data: any): Promise<StudentAbilityArchive> => {
      const created = await portraitApi.upsertArchive({
        studentName: data.studentName,
        studentId: data.studentId,
        className: data.className,
        materialType: data.materialType,
        materialName: data.materialName,
        issuingOrg: data.issuingOrg,
        obtainDate: data.obtainDate ? new Date(data.obtainDate) : new Date(),
        auditStatus: 'pending',
        convertedCredit: 0,
        direction: data.direction || 'positive',
        isEnabled: true,
      } as Partial<StudentAbilityArchive>)
      await loadStudentAbilityArchives()
      return parseStudentArchive(created)
    },
    updateStudentAbilityArchive: async (id: string, data: Partial<StudentAbilityArchive>) => {
      await portraitApi.upsertArchive({ id, ...data })
      await loadStudentAbilityArchives()
    },
    deleteStudentAbilityArchive: async (id: string) => {
      setStudentAbilityArchives((prev) => prev.filter((a) => a.id !== id))
    },
    updateCreditConversionRules: (rules: CreditConversionRule[]) => {
      setCreditConversionRules(rules)
    },

    certIssuanceRecords,
    issueCert: async (data): Promise<CertIssuanceRecord> => {
      await microCertApi.issue(data.templateId, [data.studentId])
      await loadCertIssuanceRecords()
      const record = certIssuanceRecords.find(
        (r) => r.templateId === data.templateId && r.studentId === data.studentId
      )
      if (record) return record
      return {
        id: `cir-${Date.now()}`,
        templateId: data.templateId,
        templateTitle: data.templateTitle,
        certTypeName: data.certTypeName,
        studentName: data.studentName,
        studentId: data.studentId,
        className: data.className,
        issueDate: data.issueDate,
        expireDate: data.expireDate,
        certNumber: `MC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
        status: 'issued' as const,
      }
    },
    issueBatchCerts: async (records): Promise<CertIssuanceRecord[]> => {
      const groups = new Map<string, string[]>()
      records.forEach((r) => {
        const list = groups.get(r.templateId) || []
        list.push(r.studentId)
        groups.set(r.templateId, list)
      })
      await Promise.all(
        Array.from(groups.entries()).map(([templateId, userIds]) =>
          microCertApi.issue(templateId, userIds)
        )
      )
      await loadCertIssuanceRecords()
      return certIssuanceRecords.filter((r) =>
        records.some((req) => req.templateId === r.templateId && req.studentId === r.studentId)
      )
    },
    revokeCert: async (id: string, reason: string) => {
      setCertIssuanceRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'revoked' as const, revokedAt: new Date(), revokeReason: reason }
            : r
        )
      )
    },
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

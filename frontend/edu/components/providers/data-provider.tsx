'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { useToast } from '@zhiyu/ui'
import type {
  QuestionBank,
  Question,
  Exam,
  ExamQuestion,
  QuestionBankFormData,
  QuestionFormData,
  StatusAction,
} from '@/lib/types'
import { reportError } from '@/lib/error-handling'
import { fetchAllPages } from '@zhiyu/api-client'
import { useT } from '@/lib/i18n/locale-provider'
import { questionBankApi, questionApi, examApi, evaluationBatchApi, approvalApi } from '@/lib/api'

// ==================== Date parsing helpers ====================

const parseDate = (v: string | Date | undefined): string => {
  if (!v) return new Date().toISOString()
  const d = new Date(v)
  // 非法日期回退当前时间，避免 toISOString 抛 RangeError 拖垮整页加载
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

const parseQuestionBank = (bank: QuestionBank): QuestionBank => ({
  ...bank,
  createdAt: parseDate(bank.createdAt as unknown as string | Date),
  updatedAt: parseDate(bank.updatedAt as unknown as string | Date),
})

const parseQuestion = (q: Question): Question => ({
  ...q,
  createdAt: parseDate(q.createdAt as unknown as string | Date),
})

const parseExam = (exam: Exam): Exam => ({
  ...exam,
  questions: exam.questions || [],
  createdAt: parseDate(exam.createdAt as unknown as string | Date),
  updatedAt: parseDate(exam.updatedAt as unknown as string | Date),
})

// ==================== DataContextValue type ====================

interface DataContextValue {
  evaluationLoading?: boolean

  // 题库相关
  questionBanks: QuestionBank[]
  getQuestionBank: (id: string) => QuestionBank | undefined
  updateQuestionBank: (id: string, data: QuestionBankFormData) => Promise<void>
  loadQuestionBanks?: () => Promise<void>

  // 题目相关
  questions: Question[]
  getQuestionsByBank: (bankId: string) => Question[]
  createQuestion: (bankId: string, data: QuestionFormData) => Promise<Question>
  updateQuestion: (id: string, data: QuestionFormData) => Promise<void>
  deleteQuestion: (id: string) => Promise<void>
  moveQuestions: (questionIds: string[], targetBankId: string) => Promise<void>
  loadBankQuestions?: (bankId: string) => Promise<void>

  // 试卷相关
  exams: Exam[]
  loadExams?: () => Promise<void>
  getExam: (id: string) => Exam | undefined
  updateExam: (id: string, data: Partial<Exam>) => Promise<void>
  updateExamStatus: (id: string, action: StatusAction) => Promise<void>
  addQuestionToExam: (examId: string, question: Question, score?: number) => Promise<void>
  removeQuestionFromExam: (examId: string, examQuestionId: string) => Promise<void>
  updateExamQuestionScore: (examId: string, examQuestionId: string, score: number) => Promise<void>
  updateExamQuestionScores?: (examId: string, scores: Record<string, number>) => Promise<void>
  reorderExamQuestions: (examId: string, questions: ExamQuestion[]) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const t = useT()
  const [evaluationLoading, setEvaluationLoading] = useState(false)
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [exams, setExams] = useState<Exam[]>([])

  // ==================== Data loading ====================
  const loadQuestionBanks = useCallback(async () => {
    const res = await questionBankApi.list()
    setQuestionBanks(res.items.map(parseQuestionBank))
  }, [])

  const loadBankQuestions = useCallback(async (bankId: string) => {
    const res = await fetchAllPages((page, pageSize) => questionApi.list({ bankId, limit: pageSize, offset: page * pageSize }))
    const bankQs = res.map(parseQuestion)
    setQuestions((prev) => {
      const other = prev.filter((q) => q.bankId !== bankId)
      return [...other, ...bankQs]
    })
  }, [])

  const loadExams = useCallback(async () => {
    const res = await examApi.list({ limit: 200 })
    setExams(res.items.map(parseExam))
  }, [])

  // Provider 仅挂载在 /evaluation 布局下，进入测评域即预加载题库与试卷
  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      try {
        setEvaluationLoading(true)
        await Promise.all([loadQuestionBanks(), loadExams()])
      } catch (err) {
        if (!cancelled) {
          reportError(err, '加载评测数据')
        }
      } finally {
        if (!cancelled) setEvaluationLoading(false)
      }
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [loadQuestionBanks, loadExams])

  // ==================== Question bank actions ====================
  const getQuestionBank = useCallback(
    (id: string) => questionBanks.find((bank) => bank.id === id),
    [questionBanks],
  )

  const updateQuestionBank = useCallback(
    async (id: string, data: QuestionBankFormData) => {
      await questionBankApi.update(id, data)
      await loadQuestionBanks()
    },
    [loadQuestionBanks],
  )

  // ==================== Question actions ====================
  const getQuestionsByBank = useCallback(
    (bankId: string) => questions.filter((q) => q.bankId === bankId),
    [questions],
  )

  const createQuestion = useCallback(
    async (bankId: string, data: QuestionFormData): Promise<Question> => {
      const created = await questionApi.create({
        ...data,
        bankId,
        status: 'draft',
      } as Omit<Question, 'id' | 'createdAt'>)
      await Promise.all([loadBankQuestions(bankId), loadQuestionBanks()])
      return parseQuestion(created)
    },
    [loadBankQuestions, loadQuestionBanks],
  )

  const updateQuestion = useCallback(
    async (id: string, data: QuestionFormData) => {
      const q = questions.find((item) => item.id === id)
      // 补 bankId：后端更新接口按题库归属校验（编辑表单不含该字段，缺省会 400）
      if (!q) {
        throw new Error('未找到该题目，题库可能尚未加载，请刷新后重试')
      }
      await questionApi.update(id, { ...data, bankId: q.bankId } as QuestionFormData)
      await loadBankQuestions(q.bankId)
    },
    [questions, loadBankQuestions],
  )

  const deleteQuestion = useCallback(
    async (id: string) => {
      const q = questions.find((item) => item.id === id)
      if (!q) return
      await questionApi.delete(id)
      await Promise.all([loadBankQuestions(q.bankId), loadQuestionBanks()])
    },
    [questions, loadBankQuestions, loadQuestionBanks],
  )

  const moveQuestions = useCallback(
    async (questionIds: string[], targetBankId: string) => {
      const targetBank = questionBanks.find((b) => b.id === targetBankId)
      if (!targetBank) return
      const sourceBankIds = new Set<string>()
      await Promise.all(
        questionIds.map((qid) => {
          const q = questions.find((item) => item.id === qid)
          if (!q) return Promise.resolve()
          sourceBankIds.add(q.bankId)
          return questionApi.update(qid, {
            type: q.type,
            content: q.content,
            options: q.options,
            answer: q.answer,
            analysis: q.analysis,
            score: q.score,
            difficulty: q.difficulty,
            knowledgePoints: q.knowledgePoints,
            bankId: targetBankId,
          })
        }),
      )
      const reloads = [loadBankQuestions(targetBankId)]
      for (const bankId of sourceBankIds) {
        if (bankId !== targetBankId) reloads.push(loadBankQuestions(bankId))
      }
      await Promise.all([...reloads, loadQuestionBanks()])
    },
    [questionBanks, questions, loadBankQuestions, loadQuestionBanks],
  )

  // ==================== Exam actions ====================
  const getExam = useCallback((id: string) => exams.find((exam) => exam.id === id), [exams])

  const updateExam = useCallback(
    async (id: string, data: Partial<Exam>) => {
      await examApi.update(id, data)
      await loadExams()
    },
    [loadExams],
  )

  const updateExamStatus = useCallback(
    async (id: string, action: StatusAction) => {
      const exam = exams.find((e) => e.id === id)
      switch (action) {
        case 'save_draft':
          await examApi.saveDraft(id)
          break
        case 'submit': {
          if (!exam?.batchId) {
            toast({
              variant: 'destructive',
              title: t('无法提交'),
              description: t('该试卷未关联批次，无法提交审批'),
            })
            return
          }
          const batch = await evaluationBatchApi.get(exam.batchId)
          await examApi.submit(id)
          try {
            await approvalApi.create({
              targetType: 'exam',
              targetId: id,
              workflowId: batch.workflowId,
            })
          } catch (err) {
            // 试卷已提交但审批记录创建失败：提示用户，避免状态不一致被静默忽略
            reportError(err, { source: '创建审批记录' })
            toast({
              variant: 'destructive',
              title: t('试卷已提交，但审批记录创建失败'),
              description: t('请联系管理员处理，或撤回后重新提交审批'),
            })
          }
          break
        }
        case 'withdraw':
          await examApi.withdraw(id)
          break
        case 'approve':
        case 'reject': {
          const records = await approvalApi.list({
            targetType: 'exam',
            targetId: id,
            status: 'pending',
            limit: 1,
          })
          if (records.items.length > 0) {
            await approvalApi.review(records.items[0].id, {
              status: action === 'approve' ? 'approved' : 'rejected',
            })
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
    },
    [exams, loadExams, toast, t],
  )

  const addQuestionToExam = useCallback(
    async (examId: string, question: Question, score?: number) => {
      const exam = exams.find((e) => e.id === examId)
      if (!exam || (exam.questions ?? []).some((q) => q.questionId === question.id)) return
      await examApi.addQuestion(examId, question.id, score ?? question.score)
      await loadExams()
    },
    [exams, loadExams],
  )

  const removeQuestionFromExam = useCallback(
    async (examId: string, examQuestionId: string) => {
      const exam = exams.find((e) => e.id === examId)
      if (!exam) return
      const eq = (exam.questions ?? []).find((q) => q.id === examQuestionId)
      if (!eq) return
      await examApi.removeQuestion(examId, eq.questionId)
      await loadExams()
    },
    [exams, loadExams],
  )

  const updateExamQuestionScore = useCallback(
    async (examId: string, examQuestionId: string, score: number) => {
      const exam = exams.find((e) => e.id === examId)
      if (!exam) return
      const eq = (exam.questions ?? []).find((q) => q.id === examQuestionId)
      if (!eq) return
      await examApi.updateQuestionScore(examId, eq.questionId, score)
      await loadExams()
    },
    [exams, loadExams],
  )

  const updateExamQuestionScores = useCallback(
    async (examId: string, scores: Record<string, number>) => {
      await examApi.updateQuestionScores(examId, scores)
      await loadExams()
    },
    [loadExams],
  )

  const reorderExamQuestions = useCallback(
    async (examId: string, questions: ExamQuestion[]) => {
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
    },
    [exams, loadExams],
  )

  const value = useMemo<DataContextValue>(
    () => ({
      evaluationLoading,
      questionBanks,
      getQuestionBank,
      updateQuestionBank,
      loadQuestionBanks,
      questions,
      getQuestionsByBank,
      createQuestion,
      updateQuestion,
      deleteQuestion,
      moveQuestions,
      loadBankQuestions,
      exams,
      loadExams,
      getExam,
      updateExam,
      updateExamStatus,
      addQuestionToExam,
      removeQuestionFromExam,
      updateExamQuestionScore,
      updateExamQuestionScores,
      reorderExamQuestions,
    }),
    [
      evaluationLoading,
      questionBanks,
      questions,
      exams,
      getQuestionBank,
      updateQuestionBank,
      loadQuestionBanks,
      getQuestionsByBank,
      createQuestion,
      updateQuestion,
      deleteQuestion,
      moveQuestions,
      loadBankQuestions,
      loadExams,
      getExam,
      updateExam,
      updateExamStatus,
      addQuestionToExam,
      removeQuestionFromExam,
      updateExamQuestionScore,
      updateExamQuestionScores,
      reorderExamQuestions,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

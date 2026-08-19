import { createContentApi, createCrudApi, request, buildQuery } from './http';
import type { ListResponse } from './http';
import type {
  Exam,
  QuestionBank,
  Question,
  CertificationRule,
  CertificationPositionModel,
  LevelMapping,
  JobAbilityResult,
  JobAbilitySummaryItem,
  JobAbilityAggregateStatus,
  ExamUsage,
  ExamResult,
  ExamCenterItem,
  ExamSnapshot,
  SceneEvaluationResult
} from '@/types/evaluation';

type ExamCreate = Partial<Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>>;
type ExamUpdate = Partial<Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>>;

export const examApi = {
  ...createContentApi<Exam, ExamCreate, ExamUpdate>('/evaluation/exams'),
  getSnapshot: (id: string, params?: { version?: string }) =>
    request<ExamSnapshot>(`/evaluation/exams/${id}/snapshot${buildQuery(params || {})}`),
  addQuestion: (id: string, questionId: string, score: number) =>
    request<Exam>(`/evaluation/exams/${id}/questions`, {
      method: 'POST',
      body: JSON.stringify({ questionId, score })
    }),
  removeQuestion: (id: string, questionId: string) =>
    request<Exam>(`/evaluation/exams/${id}/questions/${questionId}`, { method: 'DELETE' }),
  updateQuestionScore: (examId: string, questionId: string, score: number) =>
    request<Exam>(`/evaluation/exams/${examId}/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify({ score })
    }),
  /** 试卷批量分值（对齐 React examApi.updateQuestionScores） */
  updateQuestionScores: (examId: string, scores: Record<string, number>) =>
    request<Exam>(`/evaluation/exams/${examId}/questions/scores`, {
      method: 'PUT',
      body: JSON.stringify(scores)
    }),
  publish: (id: string) => request<Exam>(`/evaluation/exams/${id}/publish`, { method: 'POST' })
};

export const questionBankApi = createContentApi<
  QuestionBank,
  Partial<Omit<QuestionBank, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<QuestionBank, 'id' | 'createdAt' | 'updatedAt'>>
>('/evaluation/question-banks');

export const questionApi = {
  ...createCrudApi<
    Question,
    Partial<Omit<Question, 'id' | 'createdAt'>>,
    Partial<Omit<Question, 'id' | 'createdAt'>>
  >('/evaluation/questions'),
  /** 题目批量创建（对齐 React questionApi.batchCreate） */
  batchCreate: (bankId: string, items: Partial<Omit<Question, 'id' | 'bankId' | 'createdAt'>>[]) =>
    request<{ count: number }>('/evaluation/questions/batch', {
      method: 'POST',
      body: JSON.stringify({ bankId, items })
    })
};

export const evaluationBatchApi = createCrudApi<any, Record<string, unknown>, Record<string, unknown>>(
  '/evaluation/batches'
);

export const certApi = {
  listRules: (params?: { careerPositionId?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<CertificationRule>>(`/evaluation/certifications${buildQuery(params || {})}`),
  getRule: (id: string) => request<CertificationRule>(`/evaluation/certifications/${id}`),
  createRule: (req: { careerPositionId: string; ruleSource: string }) =>
    request<CertificationRule>('/evaluation/certifications', {
      method: 'POST',
      body: JSON.stringify(req)
    }),
  updateRuleStatus: (id: string, status: 'draft' | 'published') =>
    request<CertificationRule>(`/evaluation/certifications/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    }),
  deleteRule: (id: string) =>
    request<{ id: string }>(`/evaluation/certifications/${id}`, { method: 'DELETE' }),
  getPositionModel: (positionId: string) =>
    request<CertificationPositionModel>(`/evaluation/certifications/positions/${positionId}/model`),
  putPositionWeights: (
    positionId: string,
    payload: {
      pointWeights: { abilityPointId: string; weight: number }[];
      taskWeights: { abilityPointId: string; taskId: string; weight: number }[];
    }
  ) =>
    request<CertificationRule>(`/evaluation/certifications/positions/${positionId}/weights`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  putPointLevels: (positionId: string, abilityPointId: string, levelMapping: LevelMapping[]) =>
    request<{ positionId: string; abilityPointId: string }>(
      `/evaluation/certifications/positions/${positionId}/points/${abilityPointId}/levels`,
      { method: 'PUT', body: JSON.stringify({ levelMapping }) }
    ),
  putPointTaskWeights: (
    positionId: string,
    abilityPointId: string,
    taskWeights: { abilityPointId: string; taskId: string; weight: number }[]
  ) =>
    request<{ positionId: string; abilityPointId: string }>(
      `/evaluation/certifications/positions/${positionId}/points/${abilityPointId}/task-weights`,
      { method: 'PUT', body: JSON.stringify({ taskWeights }) }
    )
};

export const examUsageApi = {
  ...createCrudApi<
    ExamUsage,
    Partial<Omit<ExamUsage, 'id' | 'createdAt' | 'updatedAt'>>,
    Partial<Omit<ExamUsage, 'id' | 'createdAt' | 'updatedAt'>>
  >('/evaluation/exam-usages'),
  publish: (id: string) =>
    request<ExamUsage>(`/evaluation/exam-usages/${id}/publish`, { method: 'POST' }),
  finish: (id: string) =>
    request<ExamUsage>(`/evaluation/exam-usages/${id}/finish`, { method: 'POST' }),
  center: () => request<ExamCenterItem[]>(`/evaluation/exam-center`)
};

export const examResultApi = {
  list: (params?: { usageId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ExamResult>>(`/evaluation/exam-results${buildQuery(params || {})}`),
  get: (id: string) => request<ExamResult>(`/evaluation/exam-results/${id}`),
  submit: (req: { examUsageId: string; answers: Record<string, string | string[]>; methodKey?: string }) =>
    request<ExamResult>('/evaluation/exam-results', { method: 'POST', body: JSON.stringify(req) }),
  grade: (id: string, req: { scores: Record<string, unknown>; comment?: string }) =>
    request<ExamResult>(`/evaluation/exam-results/${id}/grade`, {
      method: 'POST',
      body: JSON.stringify(req)
    })
};

export const evaluationResultApi = {
  list: (params?: {
    taskId?: string;
    sceneId?: string;
    evaluateeId?: string;
    methodKey?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => request<ListResponse<SceneEvaluationResult>>(`/evaluation/results${buildQuery(params || {})}`),
  get: (id: string) => request<SceneEvaluationResult>(`/evaluation/results/${id}`),
  grade: (
    id: string,
    req: {
      score: number;
      evalPointScores?: Record<string, unknown>;
      comment?: string;
    }
  ) => request<SceneEvaluationResult>(`/evaluation/results/${id}/grade`, {
    method: 'POST',
    body: JSON.stringify(req)
  }),
  /** 批量评分（对齐 React evaluationResultApi.batchGrade） */
  batchGrade: (
    items: { id: string; score: number; evalPointScores?: Record<string, unknown>; comment?: string }[]
  ) =>
    request<{ count: number }>('/evaluation/results/batch-grade', {
      method: 'POST',
      body: JSON.stringify({ items })
    })
};

export const jobAbilityResultApi = {
  list: (params?: {
    careerPositionId?: string;
    userId?: string;
    search?: string;
    grade?: string;
    page?: number;
    limit?: number;
  }) => request<ListResponse<JobAbilityResult>>(`/evaluation/job-ability/results${buildQuery(params || {})}`),
  get: (id: string) => request<JobAbilityResult>(`/evaluation/job-ability/results/${id}`),
  summary: () => request<JobAbilitySummaryItem[]>('/evaluation/job-ability/results/summary'),
  aggregate: (data: { careerPositionId: string; userIds?: string[] }) =>
    request<{ logId: string; status: string }>('/evaluation/job-ability/aggregate', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  aggregateStatus: (careerPositionId?: string, logId?: string) =>
    request<JobAbilityAggregateStatus | null>(
      `/evaluation/job-ability/aggregate/status${buildQuery({ careerPositionId, logId })}`
    )
};

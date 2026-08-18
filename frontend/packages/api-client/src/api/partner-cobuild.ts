// 企业端资源共建 API，契约见后端 /partner/co-build/*（响应 DTO 对齐 portal 对应端点）
import { partnerRequest, buildQuery } from '../api-helpers'
import type { ListResponse } from '../api-helpers'
import type {
  AbilityPoint,
  PositionResponsibility,
  PositionCertificate,
  PositionAbilityBinding,
  AbilityDomain,
} from '../types/job'
import type { TaskEvaluationMethod, RubricTemplate } from '../types/scene'
import type {
  CoBuildPosition,
  CoBuildPositionCreateRequest,
  CoBuildPositionSaveFullRequest,
  CoBuildScenario,
  CoBuildScenarioCreateRequest,
  CoBuildTask,
  CoBuildUserOption,
} from '../types/partner'
import type { KnowledgePoint, Course } from '../types/lesson'
import type { QuestionBank, Question, Exam, RandomDrawQuestion } from '../types/evaluation'
import type { ScenarioWeightConfig } from '../types/scene'
import type { Major } from '../types/backend'
import type { ResourceLibraryItem } from '../types/library'

type ListParams = Record<string, string | number | boolean | undefined>

export const partnerCobuildPositionApi = {
  list: (params?: ListParams) =>
    partnerRequest<ListResponse<CoBuildPosition>>(
      `/partner/co-build/positions${buildQuery(params || {})}`,
    ),
  get: (id: string) => partnerRequest<CoBuildPosition>(`/partner/co-build/positions/${id}`),
  create: (req: CoBuildPositionCreateRequest) =>
    partnerRequest<CoBuildPosition>('/partner/co-build/positions', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: Partial<CoBuildPosition>) =>
    partnerRequest<CoBuildPosition>(`/partner/co-build/positions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/co-build/positions/${id}`, { method: 'DELETE' }),
  // 保存走 save-full：授权资源也可保存，保存后状态回写草稿，发布由学校端进行
  saveFull: (id: string, req: CoBuildPositionSaveFullRequest) =>
    partnerRequest<CoBuildPosition>(`/partner/co-build/positions/${id}/save-full`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  // 岗位详情子表（形状同 portal 对应端点：positionResponsibilityApi/positionCertificateApi/
  // abilityApi.listBindings/listDomains），供共建编辑页加载已保存的职责/证书/能力绑定/能力域
  listResponsibilities: (id: string) =>
    partnerRequest<ListResponse<PositionResponsibility>>(
      `/partner/co-build/positions/${id}/responsibilities`,
    ),
  listCertificates: (id: string) =>
    partnerRequest<ListResponse<PositionCertificate>>(
      `/partner/co-build/positions/${id}/certificates`,
    ),
  listAbilityBindings: (id: string) =>
    partnerRequest<ListResponse<PositionAbilityBinding>>(
      `/partner/co-build/positions/${id}/ability-bindings`,
    ),
  listAbilityDomains: (id: string) =>
    partnerRequest<ListResponse<AbilityDomain>>(
      `/partner/co-build/positions/${id}/ability-domains`,
    ),
}

export const partnerCobuildScenarioApi = {
  list: (params?: ListParams) =>
    partnerRequest<ListResponse<CoBuildScenario>>(
      `/partner/co-build/scenes${buildQuery(params || {})}`,
    ),
  get: (id: string) => partnerRequest<CoBuildScenario>(`/partner/co-build/scenes/${id}`),
  create: (req: CoBuildScenarioCreateRequest) =>
    partnerRequest<CoBuildScenario>('/partner/co-build/scenes', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  // 场景保存走 update：授权资源也可保存，保存后状态回写草稿，发布由学校端进行
  update: (id: string, req: Partial<CoBuildScenario>) =>
    partnerRequest<CoBuildScenario>(`/partner/co-build/scenes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    partnerRequest<{ id: string }>(`/partner/co-build/scenes/${id}`, { method: 'DELETE' }),
  listTasks: (scenarioId: string) =>
    partnerRequest<ListResponse<CoBuildTask>>(`/partner/co-build/scenes/${scenarioId}/tasks`),
  createTask: (scenarioId: string, req: Partial<CoBuildTask>) =>
    partnerRequest<CoBuildTask>(`/partner/co-build/scenes/${scenarioId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  reorderTasks: (scenarioId: string, taskIds: string[]) =>
    partnerRequest<{ ok: boolean }>(`/partner/co-build/scenes/${scenarioId}/tasks/reorder`, {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    }),
}

export const partnerCobuildTaskApi = {
  update: (taskId: string, req: Partial<CoBuildTask>) =>
    partnerRequest<CoBuildTask>(`/partner/co-build/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (taskId: string) =>
    partnerRequest<{ id: string }>(`/partner/co-build/tasks/${taskId}`, { method: 'DELETE' }),
  listEvaluationMethods: (taskId: string) =>
    partnerRequest<{ methods: TaskEvaluationMethod[] }>(
      `/partner/co-build/tasks/${taskId}/evaluation-methods`,
    ),
  saveEvaluationMethods: (taskId: string, data: { version?: number; methods: TaskEvaluationMethod[] }) =>
    partnerRequest<{ methods: TaskEvaluationMethod[] }>(
      `/partner/co-build/tasks/${taskId}/evaluation-methods`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    ),
}

/** 共建场景任务权重（读写，形状同 portal /scene/weights） */
export const partnerCobuildWeightApi = {
  list: (scenarioId: string) =>
    partnerRequest<ListResponse<ScenarioWeightConfig>>(
      `/partner/co-build/scenes/${scenarioId}/weights`,
    ),
  save: (scenarioId: string, weights: { taskId: string; weight: number }[]) =>
    partnerRequest<{ ok: boolean }>(`/partner/co-build/scenes/${scenarioId}/weights`, {
      method: 'PUT',
      body: JSON.stringify({ weights }),
    }),
}

/** 合作学校数据只读视图（任务链编辑/测评规则/克隆等编辑器数据源，响应形状同 portal 对应接口） */
export const partnerCobuildSchoolApi = {
  abilities: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<AbilityPoint>>(
      `/partner/co-build/schools/${tenantId}/abilities${buildQuery(params || {})}`,
    ),
  evaluationMethods: (tenantId: string) =>
    partnerRequest<{ items: RubricTemplate[]; total: number }>(
      `/partner/co-build/schools/${tenantId}/evaluation-methods`,
    ),
  // 共建人候选（岗位/场景编辑页选择器数据源：学校教师 + 企业专家）
  coBuilders: (tenantId: string) =>
    partnerRequest<ListResponse<CoBuildUserOption>>(
      `/partner/co-build/schools/${tenantId}/co-builders`,
    ),
  knowledgePoints: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<KnowledgePoint>>(
      `/partner/co-build/schools/${tenantId}/knowledge-points${buildQuery(params || {})}`,
    ),
  courses: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<Course>>(
      `/partner/co-build/schools/${tenantId}/courses${buildQuery(params || {})}`,
    ),
  abilityBindings: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<PositionAbilityBinding>>(
      `/partner/co-build/schools/${tenantId}/ability-bindings${buildQuery(params || {})}`,
    ),
  questionBanks: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<QuestionBank>>(
      `/partner/co-build/schools/${tenantId}/question-banks${buildQuery(params || {})}`,
    ),
  questions: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<Question>>(
      `/partner/co-build/schools/${tenantId}/questions${buildQuery(params || {})}`,
    ),
  randomDrawQuestions: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<RandomDrawQuestion>>(
      `/partner/co-build/schools/${tenantId}/random-draw-questions${buildQuery(params || {})}`,
    ),
  exams: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<Exam>>(
      `/partner/co-build/schools/${tenantId}/exams${buildQuery(params || {})}`,
    ),
  majors: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<Major>>(
      `/partner/co-build/schools/${tenantId}/majors${buildQuery(params || {})}`,
    ),
  scenarios: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<CoBuildScenario>>(
      `/partner/co-build/schools/${tenantId}/scenarios${buildQuery(params || {})}`,
    ),
  tasks: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<CoBuildTask>>(
      `/partner/co-build/schools/${tenantId}/tasks${buildQuery(params || {})}`,
    ),
  resources: (tenantId: string, params?: ListParams) =>
    partnerRequest<ListResponse<ResourceLibraryItem>>(
      `/partner/co-build/schools/${tenantId}/resources${buildQuery(params || {})}`,
    ),
}

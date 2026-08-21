/**
 * 任务评价规则编辑器专用接口层。
 *
 * 与 React 端同一后端契约（裸 JSON / {items,total} / limit-offset），路径逐字照抄
 * 原 React 版 api-client 的 {scene,alliance,evaluation}.ts：
 * - 评价标准模板：/scene/rubric-templates（taskEvaluationApi.listTemplates/createTemplate/updateTemplate）
 * - 企业导师选项：/alliance/experts/mentor-options（allianceExpertApi.mentorOptions）
 * - 现场问答题：/evaluation/random-draw-questions（randomDrawQuestionApi）
 * 其余（试卷/题库/题目/专业/知识点/能力点）复用门户既有 api 模块。
 */
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';

export interface RubricTemplate {
  id: string;
  name: string;
  mode?: 'rubric' | 'score_rule';
  types?: string[];
  description?: string;
  data?: Record<string, any>;
}

export interface RubricTemplatePayload {
  name: string;
  mode: string;
  types?: string[];
  description?: string;
  data: Record<string, any>;
}

export const rubricTemplateApi = {
  list: (params?: { limit?: number; offset?: number; keyword?: string }) =>
    request<ListResponse<RubricTemplate>>(`/scene/rubric-templates${buildQuery(params || {})}`),
  create: (data: RubricTemplatePayload) =>
    request<RubricTemplate>('/scene/rubric-templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: RubricTemplatePayload) =>
    request<RubricTemplate>(`/scene/rubric-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};

/** 企业导师（影子账号）选项：userId 为 null 表示未绑定企业账号，不可勾选 */
export interface MentorOption {
  expertId: string;
  name: string;
  title?: string;
  enterpriseId?: string;
  enterpriseName?: string;
  userId: string | null;
}

export const allianceExpertApi = {
  mentorOptions: () => request<ListResponse<MentorOption>>('/alliance/experts/mentor-options')
};

export interface RandomDrawQuestion {
  id: string;
  name: string;
  description?: string;
  answer?: string;
  majorId?: string;
  majorName?: string;
}

export interface RandomDrawQuestionPayload {
  name: string;
  description?: string;
  answer?: string;
  majorId?: string;
}

export const randomDrawQuestionApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    request<ListResponse<RandomDrawQuestion>>(`/evaluation/random-draw-questions${buildQuery(params || {})}`),
  create: (data: RandomDrawQuestionPayload) =>
    request<RandomDrawQuestion>('/evaluation/random-draw-questions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: RandomDrawQuestionPayload) =>
    request<RandomDrawQuestion>(`/evaluation/random-draw-questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  remove: (id: string) =>
    request<{ id: string }>(`/evaluation/random-draw-questions/${id}`, { method: 'DELETE' })
};

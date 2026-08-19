// 场景 AI 辅助编写契约（Vue 版）
// 逐字对齐 React：frontend/packages/api-client/src/types/ai.ts「场景 AI 辅助编写」章节
//               + frontend/packages/api-client/src/api/ai.ts scenarioAiAssist
//
// 硬约束：AI 一律走后端 POST /ai/scenario-assist（Java AiConfigController#scenarioAssist），
// 前端禁止直连 LLM；未配置（412 ai_not_configured）降级为「AI 未配置」引导弹窗。
//
// 复用说明：AbortError/未配置判定与流水线底座直接复用岗位侧 Vue 底座
// （views/job/position-builder/ai.ts 的 AiNotConfiguredError / useAiFieldWriter / useAiPipeline），
// 本文件只补「场景」这一份请求契约，不重复实现底座。

import { authedFetch } from '@/api/http';
import { AiNotConfiguredError } from '../job/position-builder/ai';

export type AIScenarioAssistField =
  | 'polish'
  | 'taskPolish'
  | 'taskDescription'
  | 'taskKnowledge'
  | 'taskAbility'
  | 'taskResource'
  | 'taskChain';

/** 场景/任务 AI 辅助请求上下文（行业/专业/岗位由前端解析为名称传入） */
export interface AIScenarioAssistContext {
  name: string;
  background: string;
  difficulty: number;
  industryNames: string[];
  professionNames: string[];
  /** taskAbility 前置条件：场景关联的岗位 ID */
  positionId: string;
  positionName: string;
  /** task* 字段使用：当前任务上下文 */
  taskName: string;
  taskBackground: string;
  taskDescription: string;
  taskDifficulty: number;
  /** taskChain 使用：现有任务清单与用户意图 */
  existingTasks: { name: string; type: 'training' | 'assessment'; difficulty: number }[];
  intention: string;
}

export interface AIScenarioAssistBody {
  field: AIScenarioAssistField;
  scenario: AIScenarioAssistContext;
}

/** 实体推荐条目：matchedId 非空表示命中现有对象（引用优先），否则需新建/引导添加 */
export interface AIScenarioSuggestion {
  name: string;
  description?: string;
  /** taskResource：资源类型枚举（document/video/software/...） */
  type?: string;
  matchedId?: string;
  matchedName?: string;
}

export interface AIScenarioPolish {
  name: string;
  background: string;
  difficulty: number;
}

export interface AIScenarioTaskPolish {
  name: string;
  background: string;
  difficulty: number;
}

export interface AIScenarioTaskChainTask {
  name: string;
  type: 'training' | 'assessment';
  difficulty: number;
  estimatedHours: number;
  description: string;
}

export interface AIScenarioTaskChain {
  taskCount: number;
  assessmentCount: number;
  trainingCount: number;
  tasks: AIScenarioTaskChainTask[];
}

export interface AIScenarioAssistResponse {
  field: AIScenarioAssistField;
  polish?: AIScenarioPolish;
  industrySuggestions?: AIScenarioSuggestion[];
  professionSuggestions?: AIScenarioSuggestion[];
  /** 目标岗位建议（polish 返回 0-1 个；命中系统已有岗位时回填 matchedId/matchedName） */
  positionSuggestion?: AIScenarioSuggestion;
  task?: AIScenarioTaskPolish;
  taskDescription?: string;
  suggestions?: AIScenarioSuggestion[];
  chain?: AIScenarioTaskChain;
}

/**
 * 场景 AI 辅助编写：POST /ai/scenario-assist（仅生成建议，不写库）。
 *
 * 用 authedFetch 而非 request()：需要同时读取 HTTP 状态码与 {code,error} 结构，
 * 才能把 412 ai_not_configured（Go 版 error=ai_not_configured / Java 版 code=ai_not_configured）
 * 稳定识别为「未配置」而不是普通错误。signal 用于取消（AbortController）。
 */
export async function scenarioAiAssist(
  body: AIScenarioAssistBody,
  signal?: AbortSignal
): Promise<AIScenarioAssistResponse> {
  const res = await authedFetch('/ai/scenario-assist', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(40_000)
  });
  const data = (await res.json().catch(() => ({}))) as {
    code?: string;
    error?: string;
  } & AIScenarioAssistResponse;
  if (!res.ok) {
    if (res.status === 412 || data.code === 'ai_not_configured' || data.error === 'ai_not_configured') {
      throw new AiNotConfiguredError();
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// 岗位 AI 辅助编写底座（Vue 版）
// 逐字对齐 React：frontend/edu/lib/ai/use-ai-assist.ts（useAiFieldWriter / useAiPipeline）
// + frontend/packages/api-client/src/api/ai.ts（positionAiAssist）
// + frontend/packages/api-client/src/types/ai.ts（AIPositionAssist* 契约）
//
// 硬约束：AI 一律走后端 /ai/position-assist（Java AiConfigController#positionAssist），
// 前端禁止直连 LLM；未配置（412 ai_not_configured）降级为「AI 未配置」提示。

import { computed, onScopeDispose, ref } from 'vue';
import type { Ref } from 'vue';
import { authedFetch } from '@/api/http';

// ===== 请求/响应契约（Vue 侧内联，避免改 types/*.ts） =====

export type AIPositionAssistField =
  | 'polish'
  | 'responsibilities'
  | 'requirements'
  | 'careerPath'
  | 'certificates'
  | 'abilities'
  | 'competency';

export interface AIPositionAbilityContext {
  name: string;
  domain?: string;
  attributes?: string[];
  description?: string;
}

export interface AIPositionAssistContext {
  name: string;
  shortName: string;
  /** 行业名称（前端由字典 ID 解析后传入） */
  industry: string;
  majors: string[];
  salaryRange: [number, number];
  description: string;
  responsibilities: string[];
  requirements: string[];
  careerPath: string;
  /** abilities 字段使用：当前待拆解的工作职责名称 */
  responsibilityName?: string;
  /** competency 字段使用：现有能力绑定清单 */
  abilities?: AIPositionAbilityContext[];
}

export interface AIPositionAssistBody {
  field: AIPositionAssistField;
  position: AIPositionAssistContext;
}

export interface AIPositionPolish {
  name: string;
  shortName: string;
  description: string;
  salaryMin: number;
  salaryMax: number;
}

export interface AISuggestedCertificate {
  name: string;
  description?: string;
  url?: string;
}

export interface AISuggestedAbility {
  name: string;
  domain: string;
  attributes: string[];
  rubricDescription: string;
}

export interface AICompetencyFill {
  name: string;
  level: string;
  rubricDescription: string;
}

export interface AIPositionAssistResponse {
  field: AIPositionAssistField;
  polish?: AIPositionPolish;
  responsibilities?: string[];
  requirements?: string[];
  careerPath?: string;
  certificates?: AISuggestedCertificate[];
  abilities?: AISuggestedAbility[];
  competencies?: AICompetencyFill[];
}

/** AI 服务未配置（后端 412 ai_not_configured）：调用方降级提示，不重试 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('ai_not_configured');
    this.name = 'AiNotConfiguredError';
  }
}

/**
 * 岗位 AI 辅助编写：POST /ai/position-assist（仅生成建议，不写库）。
 *
 * 用 authedFetch 而非 request()：需要同时读取 HTTP 状态码与 {code,error} 结构，
 * 才能把 412 ai_not_configured（Go 版 error=ai_not_configured / Java 版 code=ai_not_configured）
 * 稳定识别为「未配置」而不是普通错误。signal 用于取消（AbortController）。
 */
export async function positionAiAssist(
  body: AIPositionAssistBody,
  signal?: AbortSignal
): Promise<AIPositionAssistResponse> {
  const res = await authedFetch('/ai/position-assist', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(40_000)
  });
  const data = (await res.json().catch(() => ({}))) as {
    code?: string;
    error?: string;
  } & AIPositionAssistResponse;
  if (!res.ok) {
    if (res.status === 412 || data.code === 'ai_not_configured' || data.error === 'ai_not_configured') {
      throw new AiNotConfiguredError();
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/** 请求是否因用户取消/超时被中止 */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

export function isAiNotConfigured(err: unknown): boolean {
  if (err instanceof AiNotConfiguredError) return true;
  return err instanceof Error && err.message === 'ai_not_configured';
}

// ===== useAiFieldWriter：字段级 AI 写入（1 级快照 / 高亮 / 逐项与全部撤销） =====

export function useAiFieldWriter<TKey extends string, TValue extends object>(
  keys: TKey[],
  onUpdate: (values: TValue) => void,
  snapshotField: (key: TKey) => TValue
) {
  /** 字段被 AI 首次覆盖前的快照；多次覆盖不更新历史，恢复上版回到 AI 介入前原值 */
  // 泛型 + ref 深解包会破坏 TValue 结构，显式断言保持快照原始类型
  const aiHistories = ref({}) as Ref<Partial<Record<TKey, TValue>>>;
  /** 写入高亮字段（短暂闪烁，提示「哪里被 AI 改了」） */
  const flashKey = ref<TKey | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  const flashField = (key: TKey) => {
    flashKey.value = key;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashKey.value = null;
    }, 1400);
  };

  // 卸载后不再回写高亮状态
  onScopeDispose(() => {
    if (flashTimer) clearTimeout(flashTimer);
  });

  const aiUpdated = (key: TKey): boolean => aiHistories.value[key] !== undefined;

  const writeField = (key: TKey, values: TValue) => {
    if (aiHistories.value[key] === undefined) {
      aiHistories.value = { ...aiHistories.value, [key]: snapshotField(key) };
    }
    onUpdate(values);
    flashField(key);
  };

  const restoreField = (key: TKey) => {
    const snapshot = aiHistories.value[key];
    if (snapshot !== undefined) onUpdate(snapshot);
    const next = { ...aiHistories.value };
    delete next[key];
    aiHistories.value = next;
  };

  const restoreAll = (onDone?: () => void) => {
    const snaps = keys
      .map((k) => aiHistories.value[k])
      .filter((s): s is TValue => s !== undefined);
    if (snaps.length > 0) {
      onUpdate(Object.assign({}, ...snaps) as TValue);
    }
    aiHistories.value = {};
    onDone?.();
  };

  const updatedCount = computed(() => keys.filter((k) => aiHistories.value[k] !== undefined).length);

  return { aiHistories, flashKey, aiUpdated, writeField, restoreField, restoreAll, updatedCount };
}

// ===== useAiPipeline：串行 AI 任务流水线（进度弹窗 + 取消 + 统一错误处理） =====

export interface AiPipelineTask<TMeta, TRes> {
  /** 任务标识（一般对应后端 field，也用于 loading 指示） */
  id: string;
  meta: TMeta;
  /** 任务开始前回调（如滚动定位到目标区块） */
  onStart?: () => void;
  /** 应用结果（前一个任务完成后才执行，串行写入） */
  apply: (res: TRes) => void;
}

export interface AiPipelineRunResult {
  completedAll: boolean;
  success: number;
}

export function useAiPipeline<TMeta, TRes>(options: {
  steps: () => string[];
  request: (task: AiPipelineTask<TMeta, TRes>, signal: AbortSignal) => Promise<TRes>;
  /** 返回 true 中止后续任务，false 继续下一个任务；取消由内部处理 */
  onError: (err: unknown) => boolean;
}) {
  const { steps, request, onError } = options;
  const open = ref(false);
  const phase = ref(0);
  const progress = ref(3);
  const runningId = ref<string | null>(null);
  const isRunning = ref(false);
  let abort: AbortController | null = null;

  const cancel = () => {
    abort?.abort();
  };

  // 组件卸载（如切换步骤/离开页面）即取消进行中的请求，避免 apply 回写已离开页面的数据
  onScopeDispose(() => {
    abort?.abort();
  });

  /** 关闭进度弹窗：运行中关闭视为取消（避免「UI 关了但请求继续写字段」） */
  const handleClose = () => {
    if (isRunning.value) cancel();
    open.value = false;
  };

  const run = async (
    tasks: AiPipelineTask<TMeta, TRes>[],
    opts?: { showDialog?: boolean }
  ): Promise<AiPipelineRunResult> => {
    if (isRunning.value || tasks.length === 0) return { completedAll: false, success: 0 };
    const controller = new AbortController();
    abort = controller;
    isRunning.value = true;
    if (opts?.showDialog !== false) open.value = true;
    phase.value = 0;
    progress.value = 3;
    let i = 0;
    let success = 0;
    try {
      for (; i < tasks.length; i++) {
        if (controller.signal.aborted) break;
        const task = tasks[i];
        runningId.value = task.id;
        task.onStart?.();
        let res: TRes | null = null;
        let aborted = false;
        try {
          res = await request(task, controller.signal);
        } catch (err) {
          if (isAbortError(err) || controller.signal.aborted) {
            aborted = true;
          } else if (onError(err)) {
            aborted = true;
          }
        } finally {
          const nextPhase = i + 1;
          phase.value = nextPhase;
          progress.value = Math.round(((nextPhase + 1) / Math.max(steps().length, 1)) * 100);
        }
        if (aborted) break;
        if (res === null || controller.signal.aborted) continue;
        task.apply(res);
        success++;
      }
    } finally {
      isRunning.value = false;
      runningId.value = null;
      open.value = false;
      abort = null;
    }
    return { completedAll: i === tasks.length, success };
  };

  return { open, phase, progress, runningId, isRunning, run, cancel, handleClose };
}

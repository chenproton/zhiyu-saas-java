// 场景任务链编辑页共享 composable：scene/scenario-tasks.vue（租户侧）与
// partner/co-build-scene-tasks.vue（企业共建侧）共用同一套状态与交互逻辑。
// 两侧差异（API 端点、克隆池过滤、权重分配/持久化口径、scene 侧自定义实体落库与
// 草稿守卫等）全部经 ScenarioTasksAdapter 注入，本文件不含任何具体端点。
import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { request } from '@/api/http';
import type { KnowledgePointItem, ResourceItem, AbilityPointItem } from '@/views/lesson/lesson-edit-utils';
import {
  cardConfigs,
  evaluationMethodLabel,
  makeDefaultTaskState,
  taskStateFromMethods,
  taskStateToMethodsInput,
  DEFAULT_RANDOM_DRAW_RESOURCE_CONFIG,
  DEFAULT_REVIEW_RESOURCE_CONFIG,
  DEFAULT_OUTCOME_RESOURCE_CONFIG,
  DEFAULT_HOMEWORK_RESOURCE_CONFIG,
  type TaskState,
  type CardType
} from './tasks-logic';

/* ============ 任务模型 ============ */

export interface ScenarioTask {
  id: string;
  name: string;
  code?: string;
  order: number;
  description?: string;
  detailedDescription?: string;
  descriptionPdf?: string;
  estimatedHours: number;
  taskType: 'assessment' | 'training';
  difficulty: number;
  background?: string;
  dependencies?: string[];
  resources?: string[];
  knowledgePoints?: string[];
  knowledgePointNames?: string[];
  abilityPoints?: string[];
  abilityPointNames?: string[];
  isReferenced: boolean;
  sourceScenarioId?: string;
  sourceScenarioName?: string;
}

export interface ApiTask {
  id: string;
  name: string;
  code?: string;
  sortOrder?: number;
  description?: string;
  detailedDescription?: string;
  descriptionPdf?: string;
  estimatedHours?: number;
  taskType?: string;
  difficulty?: number;
  background?: string;
  dependencyIds?: string[];
  isReferenced?: boolean;
  sourceScenarioId?: string;
  knowledgePointIds?: string[];
  knowledgePointNames?: string[];
  abilityPointIds?: string[];
  abilityPointNames?: string[];
  resourceIds?: string[];
}

export interface CloneWeightContext {
  index: number;
  selectedCount: number;
  existingCount: number;
}

export interface ScenarioTasksAdapter<S extends { careerPositionId?: string }> {
  scenarioId: string;
  /** 场景详情（由视图持有，两侧类型不同） */
  scenario: Ref<S | null>;
  /** 返回/上一步路由 */
  routes: { list: string; prev: string };
  /** 克隆池 tab 过滤（scene 按创建者/共建者收窄；co-build 仅过滤公开库） */
  matchCloneTab: (task: any, tab: 'my' | 'collab' | 'public') => boolean;
  /** 数据集原始数据加载（上下文无数据时返回空数组，映射由 composable 统一处理） */
  fetchKnowledgePoints(): Promise<any[]>;
  fetchAbilityPoints(): Promise<any[]>;
  fetchAbilityBindings(positionId: string): Promise<any[]>;
  fetchResources(): Promise<any[]>;
  fetchClonePool(): Promise<{ scenarios: any[]; tasks: any[] }>;
  /** 已保存权重列表端点（加载时覆盖均分默认值） */
  weightsUrl(): string;
  /** 测评方式端点 */
  evalMethodsUrl(taskId: string): string;
  createTaskUrl(): string;
  updateTaskUrl(taskId: string): string;
  deleteTaskUrl(taskId: string): string;
  /** 排序持久化（各自处理错误：scene 提示用户，co-build 仅记日志） */
  reorderTasks(taskIds: string[]): void;
  /** 权重持久化，返回失败数 */
  persistWeights(tasks: ScenarioTask[], states: Record<string, TaskState>): Promise<number>;
  /** 整体保存后权重失败的提示（仅 scene 有） */
  onWeightsPersistFailed?(failed: number): void;
  /** 新增任务权重（scene 只分剩余权重；co-build 用均分默认值） */
  newTaskWeight(states: Record<string, TaskState>, taskCount: number, defaultWeight: number): number;
  /** 克隆/引用任务权重（scene 均分剩余权重；co-build 全局均分口径） */
  cloneTaskWeight(ctx: CloneWeightContext, states: Record<string, TaskState>): number;
  /** 克隆成功提示（仅 scene 有） */
  onCloned?(count: number, mode: 'clone' | 'reference'): void;
  /** 保存前处理（scene 落库自定义知识点/能力点/资源并替换临时 ID），返回处理后的状态表 */
  prepareStatesForSave?(states: Record<string, TaskState>): Promise<Record<string, TaskState>>;
  /** 评价规则卡片保存是否先乐观落内存（co-build 口径） */
  optimisticRulesUpdate?: boolean;
  /** 任务保存成功后的守卫，返回追加提示文案（scene 非草稿态退回草稿） */
  afterTasksSaved?(): Promise<string | undefined>;
  saveSuccessMessage: string;
  finishSuccessMessage: string;
}

export function useScenarioTasks<S extends { careerPositionId?: string }>(adapter: ScenarioTasksAdapter<S>) {
  const router = useRouter();
  const { scenarioId } = adapter;

  /* ============ 页面状态 ============ */

  const positionName = ref('');
  const loadFailed = ref(false);
  const isSaving = ref(false);

  const tasks = ref<ScenarioTask[]>([]);
  const taskStates = ref<Record<string, TaskState>>({});

  const positionId = computed(() => adapter.scenario.value?.careerPositionId || '');

  /* ============ 数据集 ============ */

  const knowledgePoints = ref<KnowledgePointItem[]>([]);
  const abilityPoints = ref<AbilityPointItem[]>([]);
  const learningResources = ref<ResourceItem[]>([]);
  const positionAbilityBindings = ref<any[]>([]);
  const cloneScenarios = ref<any[]>([]);

  const customKnowledgePointIds = ref<Set<string>>(new Set());
  // 已持久化的自定义知识点（保存时走 update 而非重建，避免重复创建）
  const persistedCustomKnowledgePointIds = ref<Set<string>>(new Set());
  // 自定义资源 ID（上传/新建，保存时映射临时 ID → 真实 ID）
  const customResourceIds = ref<Set<string>>(new Set());
  // 自定义能力点 ID（当前页面不直接新建能力点，保持与 React 一致的空集合）
  const customAbilityPointIds = ref<Set<string>>(new Set());

  const editingCard = ref<{ taskId: string; type: CardType } | null>(null);
  const cardDialogOpen = ref(false);
  const isSavingCard = ref(false);
  const localTask = ref({ name: '', type: 'training', difficulty: 3, hours: 4, background: '' });

  const isAddTaskOpen = ref(false);
  const newTask = ref({ name: '', hours: 4, type: 'training' as 'assessment' | 'training', difficulty: 3, background: '' });
  const draggedIdx = ref<number | null>(null);
  const deleteConfirmTask = ref<{ id: string; name: string } | null>(null);

  const isCloneOpen = ref(false);
  const cloneMode = ref<'clone' | 'reference'>('clone');
  const cloneSearch = ref('');
  const cloneTab = ref<'my' | 'collab' | 'public'>('my');
  const selectedClone = ref<string[]>([]);
  const isCloning = ref(false);

  const isWeightConfigOpen = ref(false);
  const pieColors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];

  /* ============ 计算属性 ============ */

  const currentTask = computed(() =>
    editingCard.value ? tasks.value.find((t) => t.id === editingCard.value!.taskId) || null : null
  );

  const currentState = computed<TaskState>(() =>
    editingCard.value ? getState(editingCard.value.taskId) : makeDefaultTaskState(0, 0)
  );

  const totalWeight = computed(() =>
    Object.values(taskStates.value).reduce((sum, s) => sum + (s.weight || 0), 0)
  );

  const cardDialogTitle = computed(() => {
    const t = editingCard.value?.type;
    if (!t) return '';
    return cardConfigs.find((c) => c.type === t)?.title || '';
  });

  const cardDialogWidth = computed(() => {
    const t = editingCard.value?.type;
    if (t === 'evaluationRules' || t === 'knowledge' || t === 'ability' || t === 'resources' || t === 'weight') return '95%';
    if (t === 'evaluation') return '760px';
    if (t === 'description') return '900px';
    return '650px';
  });

  const cardDialogTop = computed(() => {
    const t = editingCard.value?.type;
    if (t === 'evaluationRules' || t === 'knowledge' || t === 'ability' || t === 'resources') return '2vh';
    return '8vh';
  });

  const deleteConfirmOpen = computed({
    get: () => !!deleteConfirmTask.value,
    set: (v) => {
      if (!v) deleteConfirmTask.value = null;
    }
  });

  const knowledgePool = computed<KnowledgePointItem[]>(() =>
    knowledgePoints.value.map((kp) => ({
      id: kp.id,
      name: kp.name,
      code: kp.code,
      description: kp.description,
      linked: !customKnowledgePointIds.value.has(kp.id),
      granularLessons: kp.granularLessons || []
    }))
  );

  const resourcePool = computed<ResourceItem[]>(() => learningResources.value.map((r) => ({ ...r })));

  const relatedAbilities = computed<AbilityPointItem[]>(() => {
    const bindings = positionAbilityBindings.value.filter((b: any) => b.careerPositionId === positionId.value);
    const abilityById = new Map(abilityPoints.value.map((ab: any) => [ab.id, ab]));
    return bindings.map((b: any) => {
      const ab = abilityById.get(b.abilityPointId) || {};
      return {
        id: b.abilityPointId,
        name: b.abilityName || ab.name || '未命名能力',
        code: ab.code,
        description: b.rubricDescription || ab.description || ''
      };
    });
  });

  const allCloneTasks = computed<any[]>(() => {
    return cloneScenarios.value.flatMap((s: any) =>
      (s.tasks || []).map((t: any) => ({
        ...t,
        scenarioName: s.name,
        scenarioCreatorId: t.scenarioCreatorId || s.creatorId || '',
        scenarioCoBuilderIds: t.scenarioCoBuilderIds || s.coBuilderIds || [],
        scenarioStatus: t.scenarioStatus || s.status || ''
      }))
    );
  });

  const filteredCloneTasks = computed(() =>
    allCloneTasks.value
      .filter((t: any) => adapter.matchCloneTab(t, cloneTab.value))
      .filter(
        (t: any) =>
          !cloneSearch.value ||
          (t.name || '').includes(cloneSearch.value) ||
          (t.code || '').includes(cloneSearch.value) ||
          (t.scenarioName || '').includes(cloneSearch.value)
      )
  );

  /* ============ 状态读写 ============ */

  function getState(id: string): TaskState {
    return taskStates.value[id] || makeDefaultTaskState(0, 0);
  }

  function updateState(id: string, updates: Partial<TaskState>) {
    const base = taskStates.value[id] || makeDefaultTaskState(0, 0);
    taskStates.value = { ...taskStates.value, [id]: { ...base, ...updates } };
  }

  /* ============ 摘要 / 配置态 ============ */

  function getSummary(taskId: string, type: CardType): string {
    const task = tasks.value.find((t) => t.id === taskId);
    const state = getState(taskId);
    if (!task) return '';

    switch (type) {
      case 'info':
        return `任务名称：${task.name}\n编码：${task.code || '-'}\n任务类型：${task.taskType === 'assessment' ? '考核' : '训练'}\n难度：${task.difficulty}星\n预估学时：${task.estimatedHours}小时`;
      case 'description': {
        if (state.description) return `${state.description.replace(/<[^>]*>/g, '').slice(0, 50)}...`;
        if (state.descriptionPdf) return '已上传附件';
        return '未填写';
      }
      case 'knowledge': {
        if (state.knowledgePoints.length === 0) return '未配置';
        const apiNameById = new Map<string, string>();
        (task.knowledgePointNames || []).forEach((n, i) => {
          if (task.knowledgePoints && task.knowledgePoints[i] && n) apiNameById.set(task.knowledgePoints[i], n);
        });
        const names = state.knowledgePoints
          .map((id) => apiNameById.get(id) || knowledgePoints.value.find((k) => k.id === id)?.name)
          .filter(Boolean) as string[];
        return names.slice(0, 3).join('、') + (names.length > 3 ? ` 等${state.knowledgePoints.length}个` : '');
      }
      case 'ability': {
        if (state.abilityPoints.length === 0) return '未配置';
        const apiNameById = new Map<string, string>();
        (task.abilityPointNames || []).forEach((n, i) => {
          if (task.abilityPoints && task.abilityPoints[i] && n) apiNameById.set(task.abilityPoints[i], n);
        });
        const bindingNameById = new Map<string, string>();
        positionAbilityBindings.value.forEach((b: any) => {
          if (b.abilityPointId && b.abilityName) bindingNameById.set(b.abilityPointId, b.abilityName);
        });
        const names = state.abilityPoints
          .map(
            (id) =>
              apiNameById.get(id) ||
              (abilityPoints.value.find((a) => (a as { id: string }).id === id) as any)?.name ||
              bindingNameById.get(id)
          )
          .filter(Boolean) as string[];
        return names.slice(0, 3).join('、') + (names.length > 3 ? ` 等${state.abilityPoints.length}个` : '');
      }
      case 'resources': {
        if (state.resources.length === 0) return '未配置';
        const names = state.resources
          .map((id) => learningResources.value.find((r) => r.id === id)?.name)
          .filter(Boolean) as string[];
        return names.slice(0, 3).join('、') + (names.length > 3 ? ` 等${state.resources.length}个` : '');
      }
      case 'evaluation': {
        if (state.evaluationMethods.length === 0) return '未配置';
        return state.evaluationMethods.map((m) => evaluationMethodLabel(m)).filter(Boolean).join('、');
      }
      case 'evaluationRules': {
        if (state.evaluationMethods.length === 0) return '未配置评价方式';
        const configured = state.evaluationMethods.filter((m) => {
          if (m === 'random_draw')
            return state.randomDrawSelectedIds.length > 0 || state.randomDrawEvalPoints.length > 0 || !!state.randomDrawRubricId;
          if (m === 'review') return state.reviewEvalPoints.length > 0 || !!state.reviewRubricId;
          if (m === 'paper') return state.paperIds.length > 0;
          if (m === 'question_bank') return state.questionBankQuestions.length > 0;
          if (m === 'outcome') return state.outcomeEvalPoints.length > 0 || !!state.outcomeRubricId;
          if (m === 'homework') return state.homeworkEvalPoints.length > 0 || !!state.homeworkRubricId;
          if (m === 'quiz') return state.quizQuestions.length > 0;
          return false;
        });
        const weightTotal = state.evaluationMethods.reduce((sum, m) => sum + (state.methodWeights[m] || 0), 0);
        if (configured.length === 0) return '待配置';
        const summary = state.evaluationMethods
          .map((m) => `${evaluationMethodLabel(m)}${state.methodWeights[m] || 0}%`)
          .join('、');
        return `${summary}\n权重合计 ${weightTotal}%${weightTotal !== 100 ? ' (需等于100%)' : ''}`;
      }
      case 'weight':
        return `${state.weight}%`;
    }
  }

  function isConfigured(taskId: string, type: CardType): boolean {
    const state = getState(taskId);
    switch (type) {
      case 'info':
        return true;
      case 'description':
        return !!state.description || !!state.descriptionPdf;
      case 'knowledge':
        return state.knowledgePoints.length > 0;
      case 'ability':
        return state.abilityPoints.length > 0;
      case 'resources':
        return state.resources.length > 0;
      case 'evaluation':
        return state.evaluationMethods.length > 0;
      case 'evaluationRules':
        return state.evaluationMethods.length > 0;
      case 'weight':
        return state.weight > 0;
    }
  }

  /* ============ 导航 ============ */

  function goList() {
    router.push(adapter.routes.list);
  }

  function goPrev() {
    router.push(adapter.routes.prev);
  }

  function reload() {
    window.location.reload();
  }

  /* ============ 数据加载 ============ */

  async function loadDatasets(keys: string[]) {
    for (const key of keys) {
      try {
        if (key === 'knowledge') {
          const kps = await adapter.fetchKnowledgePoints();
          knowledgePoints.value = kps.map((kp: any) => ({
            id: kp.id,
            name: kp.name,
            code: kp.code,
            description: kp.description,
            linked: true,
            granularLessons: kp.granularLessonIds || kp.granularLessons || []
          }));
        } else if (key === 'ability') {
          const aps = await adapter.fetchAbilityPoints();
          abilityPoints.value = aps.map((ap: any) => ({
            id: ap.id,
            name: ap.name,
            code: ap.code,
            description: ap.description
          }));
          if (positionId.value) {
            try {
              positionAbilityBindings.value = await adapter.fetchAbilityBindings(positionId.value);
            } catch {
              positionAbilityBindings.value = [];
            }
          }
        } else if (key === 'resources') {
          const resources = await adapter.fetchResources();
          learningResources.value = resources.map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.resourceType || r.type,
            url: r.url,
            description: r.description,
            size: r.fileSize !== undefined ? String(r.fileSize) : r.size
          }));
        } else if (key === 'clone') {
          const { scenarios, tasks: cloneTaskItems } = await adapter.fetchClonePool();
          const nameMap = new Map<string, string>();
          const metaMap = new Map<string, { creatorId: string; coBuilderIds: string[]; status: string }>();
          for (const s of scenarios) {
            nameMap.set(s.id, s.name);
            metaMap.set(s.id, { creatorId: s.creatorId, coBuilderIds: s.coBuilderIds || [], status: s.status });
          }
          const tasksByScenario = new Map<string, any[]>();
          for (const item of cloneTaskItems) {
            const sMeta = metaMap.get(item.scenarioId) || { creatorId: '', coBuilderIds: [], status: '' };
            const enhanced = {
              ...item,
              scenarioName: nameMap.get(item.scenarioId) || '未知场景',
              scenarioCreatorId: sMeta.creatorId,
              scenarioCoBuilderIds: sMeta.coBuilderIds,
              scenarioStatus: sMeta.status
            };
            if (!tasksByScenario.has(item.scenarioId)) tasksByScenario.set(item.scenarioId, []);
            tasksByScenario.get(item.scenarioId)!.push(enhanced);
          }
          const nextScenarios: any[] = [];
          for (const s of scenarios) {
            const ts = tasksByScenario.get(s.id) || [];
            if (ts.length > 0) nextScenarios.push({ ...s, tasks: ts });
          }
          cloneScenarios.value = nextScenarios;
        }
      } catch (err) {
        console.error(`加载数据集 ${key} 失败`, err);
      }
    }
  }

  /** 任务列表 → 页面任务模型 + 任务状态初始化（含已保存权重覆盖）；失败抛给视图统一处理 */
  async function initTasks(apiTasks: ApiTask[]) {
    const mockTasks: ScenarioTask[] = apiTasks.map((at: ApiTask) => ({
      id: at.id,
      name: at.name,
      code: at.code,
      order: at.sortOrder ?? 0,
      description: at.description || '',
      detailedDescription: at.detailedDescription || undefined,
      descriptionPdf: at.descriptionPdf || undefined,
      estimatedHours: at.estimatedHours ?? 0,
      taskType: (at.taskType as 'assessment' | 'training') || 'training',
      difficulty: at.difficulty || 3,
      background: at.background || '',
      dependencies: at.dependencyIds || [],
      resources: at.resourceIds || [],
      knowledgePoints: at.knowledgePointIds || [],
      knowledgePointNames: at.knowledgePointNames || [],
      abilityPoints: at.abilityPointIds || [],
      abilityPointNames: at.abilityPointNames || [],
      isReferenced: at.isReferenced || false,
      sourceScenarioId: at.sourceScenarioId || undefined
    }));

    tasks.value = mockTasks;

    const allMethods = await Promise.all(
      mockTasks.map((t) =>
        request<{ methods: any[] }>(adapter.evalMethodsUrl(t.id)).catch(() => ({
          methods: []
        }))
      )
    );

    const count = mockTasks.length;
    const states: Record<string, TaskState> = {};
    mockTasks.forEach((t, i) => {
      const methods = allMethods[i]?.methods || [];
      const ts = taskStateFromMethods(methods);
      if (t.knowledgePoints) ts.knowledgePoints = t.knowledgePoints;
      if (t.abilityPoints) ts.abilityPoints = t.abilityPoints;
      if (t.resources) ts.resources = t.resources;
      if (t.detailedDescription) ts.description = t.detailedDescription;
      if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf;
      ts.weight = count > 0 ? Math.floor(100 / count) + (i < 100 % count ? 1 : 0) : 0;
      states[t.id] = ts;
    });

    // 已保存的权重优先：从后端读取覆盖均分默认值（含锁定标记）；失败则中止加载，避免后续保存覆盖真实权重
    try {
      const wres = await request<{ items?: { taskId: string; weight: number }[] }>(adapter.weightsUrl());
      const weightById = new Map((wres.items || []).map((w) => [w.taskId, w.weight]));
      Object.keys(states).forEach((tid2) => {
        if (weightById.has(tid2)) {
          states[tid2].weight = weightById.get(tid2)!;
          states[tid2].locked = true;
        }
      });
    } catch (err) {
      console.error('加载任务权重失败', err);
      throw err;
    }

    taskStates.value = states;
  }

  /* ============ 保存测评方式（409 重试一次） ============ */

  async function saveMethodsWithRetry(tid: string, version: number, methods: any[]): Promise<number> {
    if (methods.length === 0) return version;
    const doSave = async (v: number) => {
      const savedRes = await request<{ methods: any[] }>(adapter.evalMethodsUrl(tid), {
        method: 'PUT',
        body: JSON.stringify({ version: v, methods })
      });
      return (savedRes.methods || []).reduce((max, m) => Math.max(max, m.version || 0), 0);
    };
    try {
      return await doSave(version);
    } catch (err: any) {
      if (err.message === '评价规则已被其他会话修改') {
        const freshRes = await request<{ methods: any[] }>(adapter.evalMethodsUrl(tid)).catch(() => null);
        if (!freshRes) throw err;
        const freshVersion = (freshRes.methods || []).reduce((max, m) => Math.max(max, m.version || 0), 0);
        return await doSave(freshVersion);
      }
      throw err;
    }
  }

  /* ============ 任务 CRUD ============ */

  async function handleAddTask() {
    if (!newTask.value.name.trim()) return;
    try {
      const payload = {
        scenarioId,
        name: newTask.value.name.trim(),
        code: `TK-${Date.now().toString().slice(-6)}`,
        sortOrder: tasks.value.length + 1,
        estimatedHours: newTask.value.hours,
        taskType: newTask.value.type,
        difficulty: newTask.value.difficulty,
        background: newTask.value.background,
        dependencyIds: [],
        isReferenced: false,
        knowledgePointIds: [],
        abilityPointIds: [],
        resourceIds: []
      };
      const created = await request<any>(adapter.createTaskUrl(), {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const mkTask: ScenarioTask = {
        id: created.id,
        name: created.name,
        code: created.code,
        order: created.sortOrder ?? tasks.value.length + 1,
        description: created.description || '',
        detailedDescription: created.detailedDescription,
        descriptionPdf: created.descriptionPdf,
        estimatedHours: created.estimatedHours ?? newTask.value.hours,
        taskType: (created.taskType as 'assessment' | 'training') || newTask.value.type,
        difficulty: created.difficulty ?? newTask.value.difficulty,
        background: created.background || newTask.value.background,
        dependencies: [],
        resources: [],
        knowledgePoints: [],
        abilityPoints: [],
        isReferenced: false
      };
      const nextTasks = [...tasks.value, mkTask];
      tasks.value = nextTasks;
      const nextStates = { ...taskStates.value };
      const newState = makeDefaultTaskState(nextTasks.length, nextTasks.length - 1);
      newState.weight = adapter.newTaskWeight(nextStates, nextTasks.length, newState.weight);
      nextStates[created.id] = newState;
      taskStates.value = nextStates;
      isAddTaskOpen.value = false;
      newTask.value = { name: '', hours: 4, type: 'training', difficulty: 3, background: '' };
      ElMessage.success('已添加任务');
    } catch (err) {
      ElMessage.error((err as Error).message || '添加失败');
    }
  }

  function confirmDeleteTask() {
    if (!deleteConfirmTask.value) return;
    handleDeleteTask(deleteConfirmTask.value.id);
  }

  async function handleDeleteTask(id: string) {
    if (id.startsWith('task-')) {
      tasks.value = tasks.value.filter((t) => t.id !== id);
      const next = { ...taskStates.value };
      delete next[id];
      taskStates.value = next;
      deleteConfirmTask.value = null;
      ElMessage.success('已删除任务');
      return;
    }
    try {
      await request(adapter.deleteTaskUrl(id), { method: 'DELETE' });
      tasks.value = tasks.value.filter((t) => t.id !== id);
      const next = { ...taskStates.value };
      delete next[id];
      taskStates.value = next;
      deleteConfirmTask.value = null;
      ElMessage.success('已删除任务');
    } catch (err) {
      ElMessage.error((err as Error).message || '删除失败');
    }
  }

  /* ============ 拖拽排序 ============ */

  function onDrop(idx: number) {
    if (draggedIdx.value === null || draggedIdx.value === idx) {
      draggedIdx.value = null;
      return;
    }
    const newTasks = [...tasks.value];
    const [removed] = newTasks.splice(draggedIdx.value, 1);
    newTasks.splice(idx, 0, removed);
    const reordered = newTasks.map((t, i) => ({ ...t, order: i + 1 }));
    tasks.value = reordered;
    draggedIdx.value = null;
    adapter.reorderTasks(reordered.map((t) => t.id));
  }

  /* ============ 保存到后端 ============ */

  function persistWeights(taskList: ScenarioTask[], states: Record<string, TaskState>): Promise<number> {
    return adapter.persistWeights(taskList, states);
  }

  async function saveTasksToBackend() {
    // scene 侧：先落库自定义知识点/能力点/资源并替换临时 ID（co-build 无此环节）
    const updatedTaskStates: Record<string, TaskState> = adapter.prepareStatesForSave
      ? await adapter.prepareStatesForSave({ ...taskStates.value })
      : { ...taskStates.value };
    const newTasks: ScenarioTask[] = [];
    for (let i = 0; i < tasks.value.length; i++) {
      const t = tasks.value[i];
      const ts = updatedTaskStates[t.id] || makeDefaultTaskState(0, 0);
      const payload = {
        scenarioId,
        name: t.name,
        code: t.code,
        sortOrder: i,
        description: t.description,
        detailedDescription: ts.description || t.detailedDescription,
        descriptionPdf: ts.descriptionPdf || t.descriptionPdf || undefined,
        estimatedHours: t.estimatedHours,
        taskType: t.taskType,
        difficulty: t.difficulty,
        background: t.background,
        dependencyIds: t.dependencies || [],
        isReferenced: !!t.isReferenced,
        sourceScenarioId: t.sourceScenarioId || undefined,
        knowledgePointIds: ts.knowledgePoints || [],
        abilityPointIds: ts.abilityPoints || [],
        resourceIds: ts.resources || []
      };
      if (t.id.startsWith('task-')) {
        const created = await request<any>(adapter.createTaskUrl(), {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const oldId = t.id;
        const newTask: ScenarioTask = { ...t, id: created.id };
        newTasks.push(newTask);
        updatedTaskStates[newTask.id] = { ...ts, evalMethodVersion: ts.evalMethodVersion };
        delete updatedTaskStates[oldId];
        const newVersion = await saveMethodsWithRetry(newTask.id, ts.evalMethodVersion, taskStateToMethodsInput(ts));
        updatedTaskStates[newTask.id] = { ...updatedTaskStates[newTask.id], evalMethodVersion: newVersion };
      } else {
        await request(adapter.updateTaskUrl(t.id), {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        newTasks.push(t);
        const newVersion = await saveMethodsWithRetry(t.id, ts.evalMethodVersion, taskStateToMethodsInput(ts));
        updatedTaskStates[t.id] = { ...updatedTaskStates[t.id], evalMethodVersion: newVersion };
      }
    }
    tasks.value = newTasks;
    taskStates.value = updatedTaskStates;
    const weightFailures = await adapter.persistWeights(newTasks, updatedTaskStates);
    if (weightFailures > 0) adapter.onWeightsPersistFailed?.(weightFailures);
  }

  async function handleSaveDraft() {
    isSaving.value = true;
    try {
      await saveTasksToBackend();
      const notice = await adapter.afterTasksSaved?.();
      ElMessage.success(adapter.saveSuccessMessage);
      if (notice) ElMessage.info(notice);
    } catch (err) {
      ElMessage.error((err as Error).message || '保存失败');
    } finally {
      isSaving.value = false;
    }
  }

  async function handleFinish() {
    isSaving.value = true;
    try {
      await saveTasksToBackend();
      const notice = await adapter.afterTasksSaved?.();
      ElMessage.success(adapter.finishSuccessMessage);
      if (notice) ElMessage.info(notice);
      goList();
    } catch (err) {
      ElMessage.error((err as Error).message || '保存失败');
    } finally {
      isSaving.value = false;
    }
  }

  /* ============ 卡片对话框 ============ */

  function openCard(taskId: string, type: CardType) {
    editingCard.value = { taskId, type };
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) {
      localTask.value = {
        name: task.name,
        type: task.taskType,
        difficulty: task.difficulty,
        hours: task.estimatedHours,
        background: task.background || ''
      };
    }
    cardDialogOpen.value = true;
  }

  function selectedKnowledgeItems(taskId: string): KnowledgePointItem[] {
    const state = getState(taskId);
    const task = tasks.value.find((t) => t.id === taskId);
    const kpNameById = new Map<string, string>();
    (task?.knowledgePoints || []).forEach((id, i) => {
      const name = (task?.knowledgePointNames || [])[i];
      if (name) kpNameById.set(id, name);
    });
    return (state.knowledgePoints || []).map((id: string) => {
      const found = knowledgePool.value.find((p) => p.id === id);
      return found || { id, name: kpNameById.get(id) || id, linked: false };
    });
  }

  function onKnowledgeChange(taskId: string, items: KnowledgePointItem[]) {
    const ids = items.map((i) => i.id);
    knowledgePoints.value = knowledgePoints.value.map((k) => {
      const item = items.find((i) => i.id === k.id);
      if (item) {
        return {
          ...k,
          name: item.name,
          description: item.description || '',
          code: item.code || '',
          granularLessons: item.granularLessons || k.granularLessons || []
        };
      }
      return k;
    });
    updateState(taskId, { knowledgePoints: ids });
  }

  function onEvalMethodsChange(taskId: string, newMethods: string[]) {
    const state = getState(taskId);
    const newDisabled = (state.disabledEvaluationMethods || []).filter((d) => !newMethods.includes(d));
    const removed = state.evaluationMethods.filter((m) => !newMethods.includes(m));
    const newWeights = { ...state.methodWeights };
    for (const m of newMethods) {
      if (!state.evaluationMethods.includes(m)) newWeights[m] = 0;
    }
    for (const m of state.evaluationMethods.filter((sm) => !newMethods.includes(sm))) {
      newWeights[m] = 0;
    }
    updateState(taskId, {
      evaluationMethods: newMethods,
      methodWeights: newWeights,
      disabledEvaluationMethods: [...newDisabled, ...removed]
    });
  }

  async function handleCardSave() {
    if (!editingCard.value) return;
    const taskId = editingCard.value.taskId;
    const type = editingCard.value.type;
    const state = getState(taskId);

    if (type === 'info') {
      tasks.value = tasks.value.map((t) =>
        t.id === taskId
          ? {
              ...t,
              name: localTask.value.name,
              taskType: localTask.value.type as 'assessment' | 'training',
              difficulty: localTask.value.difficulty,
              estimatedHours: localTask.value.hours,
              background: localTask.value.background
            }
          : t
      );
    } else if (type === 'evaluationRules') {
      const enabledReviewSteps = (state.reviewSteps || [])
        .filter((s: any) => s.enabled)
        .map((s: any) => ({
          id: s.id,
          label: s.label,
          desc: s.desc,
          enabled: s.enabled,
          subjectType: s.subjectType,
          weight: s.weight
        }));
      const updatedRC = { ...state.methodResourceConfigs };
      state.evaluationMethods.forEach((mk) => {
        if (mk === 'random_draw') updatedRC[mk] = { ...DEFAULT_RANDOM_DRAW_RESOURCE_CONFIG, ...updatedRC[mk] };
        if (mk === 'review') updatedRC[mk] = { ...DEFAULT_REVIEW_RESOURCE_CONFIG, ...updatedRC[mk] };
        if (mk === 'outcome') updatedRC[mk] = { ...DEFAULT_OUTCOME_RESOURCE_CONFIG, ...updatedRC[mk] };
        if (mk === 'homework') updatedRC[mk] = { ...DEFAULT_HOMEWORK_RESOURCE_CONFIG, ...updatedRC[mk] };
      });
      // co-build 口径：先落内存（资源配置 + 评审步骤），保存失败时也保留本次编辑，供用户重试不丢失
      if (adapter.optimisticRulesUpdate) {
        updateState(taskId, { methodResourceConfigs: updatedRC, reviewSteps: enabledReviewSteps });
      }
      const methodsInput = taskStateToMethodsInput({ ...state, methodResourceConfigs: updatedRC });
      if (methodsInput.length > 0) {
        isSavingCard.value = true;
        try {
          const newVersion = await saveMethodsWithRetry(taskId, state.evalMethodVersion, methodsInput);
          updateState(
            taskId,
            adapter.optimisticRulesUpdate
              ? { evalMethodVersion: newVersion }
              : { methodResourceConfigs: updatedRC, reviewSteps: enabledReviewSteps, evalMethodVersion: newVersion }
          );
        } catch (err) {
          ElMessage.error((err as Error).message || '评价规则保存失败');
          return;
        } finally {
          isSavingCard.value = false;
        }
      } else if (!adapter.optimisticRulesUpdate) {
        updateState(taskId, { methodResourceConfigs: updatedRC, reviewSteps: enabledReviewSteps });
      }
    }

    cardDialogOpen.value = false;
    editingCard.value = null;
  }

  /* ============ 克隆/引用 ============ */

  function toggleCloneSelect(id: string) {
    if (selectedClone.value.includes(id)) {
      selectedClone.value = selectedClone.value.filter((x) => x !== id);
    } else {
      selectedClone.value = [...selectedClone.value, id];
    }
  }

  function openClone() {
    cloneMode.value = 'clone';
    selectedClone.value = [];
    cloneSearch.value = '';
    isCloneOpen.value = true;
  }

  async function handleClone() {
    isCloning.value = true;
    try {
      const selected = allCloneTasks.value.filter((t: any) => selectedClone.value.includes(t.id));
      const existingCount = tasks.value.length;

      const newTasks: ScenarioTask[] = selected.map((t: any, i: number) => ({
        id: `task-${cloneMode.value}-${Date.now()}-${i}`,
        name: t.name,
        code: t.code,
        order: tasks.value.length + i + 1,
        description: t.description || '',
        detailedDescription: t.detailedDescription,
        descriptionPdf: t.descriptionPdf,
        estimatedHours: t.estimatedHours ?? 0,
        taskType: (t.taskType as 'assessment' | 'training') || 'training',
        difficulty: t.difficulty || 3,
        background: t.background || '',
        dependencies: t.dependencyIds || [],
        resources: t.resourceIds || [],
        knowledgePoints: t.knowledgePointIds || [],
        knowledgePointNames: t.knowledgePointNames || [],
        abilityPoints: t.abilityPointIds || [],
        abilityPointNames: t.abilityPointNames || [],
        isReferenced: cloneMode.value === 'reference',
        sourceScenarioId: t.scenarioId,
        sourceScenarioName: cloneMode.value === 'reference' ? t.scenarioName : undefined
      }));

      const methodsResults = await Promise.all(
        selected.map((t: any) =>
          request<{ methods: any[] }>(adapter.evalMethodsUrl(t.id)).catch(() => ({
            methods: []
          }))
        )
      );

      const newStates: Record<string, TaskState> = {};
      selected.forEach((t: any, i: number) => {
        const methods = methodsResults[i]?.methods || [];
        const ts = taskStateFromMethods(methods);
        if (t.knowledgePointIds) ts.knowledgePoints = [...t.knowledgePointIds];
        if (t.abilityPointIds) ts.abilityPoints = [...t.abilityPointIds];
        if (t.resourceIds) ts.resources = [...t.resourceIds];
        if (t.detailedDescription) ts.description = t.detailedDescription;
        if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf;
        ts.weight = adapter.cloneTaskWeight(
          { index: i, selectedCount: selected.length, existingCount },
          taskStates.value
        );
        newStates[newTasks[i].id] = ts;
      });

      tasks.value = [...tasks.value, ...newTasks];
      taskStates.value = { ...taskStates.value, ...newStates };
      isCloneOpen.value = false;
      selectedClone.value = [];
      adapter.onCloned?.(newTasks.length, cloneMode.value);
    } catch (err) {
      ElMessage.error((err as Error).message || '克隆失败');
    } finally {
      isCloning.value = false;
    }
  }

  /* ============ 权重配置 ============ */

  function setWeight(taskId: string, val: number) {
    updateState(taskId, { weight: Math.max(0, Math.min(100, val)) });
  }

  function onWeightChange(taskId: string, val: number | undefined) {
    setWeight(taskId, val || 0);
  }

  function toggleLock(taskId: string) {
    const s = getState(taskId);
    updateState(taskId, { locked: !s.locked });
  }

  function distributeWeights() {
    const unlocked = tasks.value.filter((t) => !getState(t.id).locked);
    if (unlocked.length === 0) return;
    const lockedWeight = tasks.value
      .filter((t) => getState(t.id).locked)
      .reduce((s, t) => s + (getState(t.id).weight || 0), 0);
    const remaining = Math.max(0, 100 - lockedWeight);
    const each = Math.floor(remaining / unlocked.length);
    unlocked.forEach((t, i) => {
      updateState(t.id, { weight: each + (i < remaining % unlocked.length ? 1 : 0) });
    });
  }

  return {
    // 状态
    positionName,
    loadFailed,
    isSaving,
    tasks,
    taskStates,
    positionId,
    knowledgePoints,
    abilityPoints,
    learningResources,
    positionAbilityBindings,
    cloneScenarios,
    customKnowledgePointIds,
    persistedCustomKnowledgePointIds,
    customResourceIds,
    customAbilityPointIds,
    editingCard,
    cardDialogOpen,
    isSavingCard,
    localTask,
    isAddTaskOpen,
    newTask,
    draggedIdx,
    deleteConfirmTask,
    isCloneOpen,
    cloneMode,
    cloneSearch,
    cloneTab,
    selectedClone,
    isCloning,
    isWeightConfigOpen,
    pieColors,
    // 计算属性
    currentTask,
    currentState,
    totalWeight,
    cardDialogTitle,
    cardDialogWidth,
    cardDialogTop,
    deleteConfirmOpen,
    knowledgePool,
    resourcePool,
    relatedAbilities,
    allCloneTasks,
    filteredCloneTasks,
    // 方法
    getState,
    updateState,
    getSummary,
    isConfigured,
    goList,
    goPrev,
    reload,
    loadDatasets,
    initTasks,
    saveMethodsWithRetry,
    handleAddTask,
    confirmDeleteTask,
    handleDeleteTask,
    onDrop,
    persistWeights,
    saveTasksToBackend,
    handleSaveDraft,
    handleFinish,
    openCard,
    selectedKnowledgeItems,
    onKnowledgeChange,
    onEvalMethodsChange,
    handleCardSave,
    toggleCloneSelect,
    openClone,
    handleClone,
    setWeight,
    onWeightChange,
    toggleLock,
    distributeWeights
  };
}

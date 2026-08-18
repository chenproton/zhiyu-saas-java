<template>
  <div class="tasks-page">
    <!-- 加载失败 -->
    <el-alert v-if="loadFailed" type="error" title="任务数据加载失败，请重试" show-icon class="mb-16">
      <el-button size="small" @click="load">刷新重试</el-button>
    </el-alert>

    <!-- ===== 场景信息卡 ===== -->
    <el-card shadow="never" class="mb-16">
      <div class="scenario-head">
        <div class="scenario-left">
          <div class="scenario-title-row">
            <h2 class="scenario-name">{{ scenario?.name || '新建场景' }}</h2>
            <el-tag v-if="(scenario?.coBuilderIds?.length || 0) > 0" size="small">共建</el-tag>
          </div>
          <div class="scenario-meta">
            {{ positionName || '未选择岗位' }} | {{ industryName || '未选择行业' }} | {{ professionName || '未选择专业' }}
          </div>
        </div>
        <div class="scenario-right">
          <div class="scenario-stars">
            <el-icon v-for="i in 5" :key="i" :class="['star', { filled: i <= (scenario?.difficulty || 3) }]">
              <StarFilled />
            </el-icon>
          </div>
          <el-tag size="small">{{ scenario?.version }}</el-tag>
        </div>
      </div>
      <p class="scenario-background">{{ scenario?.background || '暂无介绍' }}</p>
    </el-card>

    <!-- ===== 任务工具栏 ===== -->
    <div class="tasks-toolbar">
      <div class="tasks-toolbar-left">
        <h3 class="tasks-title">任务列表</h3>
        <el-tag size="small" type="info">{{ tasks.length }} 个任务</el-tag>
        <span :class="['weight-sum', { ok: totalWeight === 100 }]">权重: {{ totalWeight }}%</span>
      </div>
      <div class="tasks-toolbar-right">
        <el-button type="primary" size="small" @click="openAddTask">
          <el-icon><Plus /></el-icon>添加任务
        </el-button>
        <el-button size="small" @click="openWeightDialog">
          <el-icon><PieChart /></el-icon>配置任务权重
        </el-button>
      </div>
    </div>

    <!-- ===== 任务列表（卡片列布局） ===== -->
    <div v-loading="loading" class="tasks-scroll">
      <!-- 列头 -->
      <div class="task-cols task-cols-head">
        <div class="col-no" />
        <div v-for="c in CARD_CONFIGS" :key="c.type" class="col-card">{{ c.title }}</div>
        <div class="col-no" />
      </div>

      <div v-if="tasks.length === 0" class="tasks-empty">
        <el-icon :size="48"><Document /></el-icon>
        <p>暂无任务，点击「添加任务」开始配置</p>
      </div>

      <div v-for="(task, idx) in tasks" :key="task.id" class="task-row">
        <div class="col-no task-order">
          <span class="order-arrows">
            <el-icon class="order-arrow" @click="moveTask(idx, -1)"><CaretTop /></el-icon>
            <el-icon class="order-arrow" @click="moveTask(idx, 1)"><CaretBottom /></el-icon>
          </span>
          <span class="order-num">{{ idx + 1 }}</span>
        </div>

        <button
          v-for="c in CARD_CONFIGS"
          :key="c.type"
          type="button"
          :class="['col-card task-card', { configured: isConfigured(task.id, c.type), readonly: c.type === 'weight' }]"
          :disabled="c.type === 'weight'"
          @click="openEditCard(task, c.type)"
        >
          <div class="task-card-head">
            <span class="task-card-title">{{ c.title }}</span>
            <el-tag v-if="task.isReferenced && c.type !== 'weight'" size="small" type="info">引用</el-tag>
          </div>
          <p class="task-card-summary">{{ summary(task.id, c.type) }}</p>
        </button>

        <div class="col-no task-del">
          <el-button size="small" text type="danger" @click="confirmDelete(task)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- ===== 底部操作 ===== -->
    <div class="tasks-footer">
      <el-button @click="router.push('/scene/scenarios')">取消</el-button>
      <el-button @click="router.push(`/scene/scenarios/${id}/edit`)">上一步</el-button>
      <el-button type="primary" :loading="saving" @click="handleSaveDraft">保存草稿</el-button>
      <el-button type="success" :loading="saving" @click="handleFinish">完成配置</el-button>
    </div>

    <!-- ===== 添加任务弹窗 ===== -->
    <el-dialog v-model="addDialogOpen" title="添加任务" width="520px">
      <el-form label-width="90px">
        <el-form-item label="任务名称"><el-input v-model="addForm.name" placeholder="输入任务名称" /></el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="addForm.taskType" style="width: 100%">
            <el-option label="训练任务" value="training" />
            <el-option label="考核任务" value="assessment" />
          </el-select>
        </el-form-item>
        <el-form-item label="预估学时"><el-input-number v-model="addForm.estimatedHours" :min="0" style="width: 100%" /></el-form-item>
        <el-form-item label="难度">
          <div class="star-picker">
            <el-icon v-for="n in 5" :key="n" :class="['star', 'star-click', { filled: n <= addForm.difficulty }]" @click="addForm.difficulty = n">
              <StarFilled />
            </el-icon>
          </div>
        </el-form-item>
        <el-form-item label="背景介绍"><el-input v-model="addForm.background" type="textarea" :rows="3" placeholder="简述任务背景" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="taskSaving" :disabled="!addForm.name.trim()" @click="handleAddTask">添加</el-button>
      </template>
    </el-dialog>

    <!-- ===== 编辑任务卡片弹窗 ===== -->
    <el-dialog v-model="editDialogOpen" :title="editCardTitle" width="680px" top="6vh">
      <el-form v-if="editTask" label-width="90px">
        <template v-if="editCardType === 'info'">
          <el-form-item label="任务名称"><el-input v-model="editForm.name" /></el-form-item>
          <el-form-item label="任务类型">
            <el-select v-model="editForm.taskType" style="width: 100%">
              <el-option label="训练任务" value="training" />
              <el-option label="考核任务" value="assessment" />
            </el-select>
          </el-form-item>
          <el-form-item label="难度">
            <div class="star-picker">
              <el-icon v-for="n in 5" :key="n" :class="['star', 'star-click', { filled: n <= editForm.difficulty }]" @click="editForm.difficulty = n">
                <StarFilled />
              </el-icon>
            </div>
          </el-form-item>
          <el-form-item label="预估学时"><el-input-number v-model="editForm.estimatedHours" :min="0" style="width: 100%" /></el-form-item>
          <el-form-item label="背景介绍"><el-input v-model="editForm.background" type="textarea" :rows="2" /></el-form-item>
        </template>

        <template v-else-if="editCardType === 'description'">
          <el-form-item label="任务说明">
            <el-input v-model="editForm.detailedDescription" type="textarea" :rows="6" placeholder="填写任务说明" />
          </el-form-item>
        </template>

        <template v-else-if="editCardType === 'knowledge'">
          <el-form-item label="知识点">
            <el-select v-model="editForm.knowledgePointIds" multiple filterable style="width: 100%" placeholder="选择知识点">
              <el-option v-for="kp in knowledgePool" :key="kp.id" :label="kp.name" :value="kp.id" />
            </el-select>
          </el-form-item>
        </template>

        <template v-else-if="editCardType === 'ability'">
          <el-form-item label="能力点">
            <el-select v-model="editForm.abilityPointIds" multiple filterable style="width: 100%" placeholder="选择能力点">
              <el-option v-for="ab in abilityPool" :key="ab.id" :label="ab.name" :value="ab.id" />
            </el-select>
          </el-form-item>
        </template>

        <template v-else-if="editCardType === 'resources'">
          <el-form-item label="资源">
            <el-select v-model="editForm.resourceIds" multiple filterable style="width: 100%" placeholder="选择学习资源">
              <el-option v-for="r in resourcePool" :key="r.id" :label="r.name" :value="r.id" />
            </el-select>
          </el-form-item>
        </template>

        <template v-else-if="editCardType === 'evaluation'">
          <div v-if="evalMethodsFor(editTask.id).length === 0" class="eval-empty">该任务暂未配置评价方式</div>
          <div v-else class="eval-method-list">
            <div v-for="m in evalMethodsFor(editTask.id)" :key="m.id" class="eval-method-row">
              <span class="eval-tag" :style="{ backgroundColor: EVAL_METHOD_COLORS[m.methodKey] || '#94a3b8' }">
                {{ EVAL_METHOD_LABELS[m.methodKey] || m.methodKey }}
              </span>
              <span class="eval-method-weight">权重 {{ Math.round(m.weight || 0) }}%</span>
            </div>
            <p class="eval-hint">评价方式在场景测评配置中维护（本页为只读展示）。</p>
          </div>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="editDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="taskSaving" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- ===== 权重配置弹窗 ===== -->
    <el-dialog v-model="weightDialogOpen" title="配置任务权重" width="560px">
      <div class="weight-list">
        <div v-for="task in tasks" :key="task.id" class="weight-row">
          <span class="weight-row-name">{{ task.name }}</span>
          <el-input-number v-model="weightInputs[task.id]" :min="0" :max="100" size="small" />
          <span class="weight-row-pct">%</span>
        </div>
      </div>
      <div :class="['weight-total', { ok: weightDialogTotal === 100 }]">合计：{{ weightDialogTotal }}%（需等于 100%）</div>
      <template #footer>
        <el-button @click="weightDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveWeights">保存权重</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  CaretBottom,
  CaretTop,
  Delete,
  Document,
  PieChart,
  Plus,
  StarFilled
} from '@element-plus/icons-vue';
import { scenarioApi, taskApi } from '@/api/scene';
import { positionApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { knowledgeApi } from '@/api/lesson';
import { abilityApi } from '@/api/job';
import { request } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { Scenario, ScenarioTask } from '@/types/scene';
import type { KnowledgePoint } from '@/types/lesson';
import type { AbilityPoint } from '@/types/job';
import { EVAL_METHOD_COLORS, EVAL_METHOD_LABELS } from '@/views/landing/scene-types';

// 本地类型：资源库条目 / 权重 / 评价方式（读展示用）
interface ResItem {
  id: string;
  name: string;
  resourceType?: string;
  type?: string;
  url?: string;
}
interface WeightItem {
  id?: string;
  scenarioId?: string;
  taskId: string;
  weight: number;
}
interface EvalMethodItem {
  id: string;
  methodKey: string;
  weight: number;
}

const CARD_CONFIGS = [
  { type: 'info', title: '基本信息' },
  { type: 'description', title: '任务说明' },
  { type: 'knowledge', title: '考查知识点' },
  { type: 'ability', title: '考查能力点' },
  { type: 'resources', title: '任务资源' },
  { type: 'evaluation', title: '评价方式' },
  { type: 'weight', title: '任务权重' }
] as const;

type CardType = (typeof CARD_CONFIGS)[number]['type'];

// ===== 路由 =====
const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id || ''));

// ===== 数据 =====
const scenario = ref<Scenario | null>(null);
const tasks = ref<ScenarioTask[]>([]);
const positionName = ref('');
const industryName = ref('');
const professionName = ref('');
const knowledgePool = ref<KnowledgePoint[]>([]);
const abilityPool = ref<AbilityPoint[]>([]);
const resourcePool = ref<ResItem[]>([]);
const weights = ref<Record<string, number>>({});
const weightInputs = ref<Record<string, number>>({});
const evalMethodsByTask = ref<Map<string, EvalMethodItem[]>>(new Map());
const loading = ref(false);
const loadFailed = ref(false);
const saving = ref(false);
const taskSaving = ref(false);

const addDialogOpen = ref(false);
const addForm = reactive({ name: '', taskType: 'training' as ScenarioTask['taskType'], difficulty: 3, estimatedHours: 4, background: '' });

const editDialogOpen = ref(false);
const editTask = ref<ScenarioTask | null>(null);
const editCardType = ref<CardType>('info');
const editForm = reactive({
  name: '',
  taskType: 'training' as ScenarioTask['taskType'],
  difficulty: 3,
  estimatedHours: 1,
  background: '',
  detailedDescription: '',
  knowledgePointIds: [] as string[],
  abilityPointIds: [] as string[],
  resourceIds: [] as string[]
});

const weightDialogOpen = ref(false);

// ===== 加载 =====
async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const scenarioId = id.value;
    const [scenarioRes, taskRes, posRes, indRes, majRes, kpRes, abRes, resRes] = await Promise.all([
      scenarioApi.get(scenarioId),
      taskApi.list({ scenarioId, limit: 1000 }),
      positionApi.list({ limit: 1000 }),
      industryApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 }),
      knowledgeApi.list({ limit: 1000 }),
      abilityApi.list({ limit: 1000 }),
      request<ListResponse<ResItem>>('/library/resources?limit=1000')
    ]);
    scenario.value = scenarioRes;
    tasks.value = (taskRes.items || []).sort((a, b) => a.sortOrder - b.sortOrder);
    positionName.value = posRes.items.find((p) => p.id === scenarioRes.careerPositionId)?.name || scenarioRes.careerPositionId || '';
    industryName.value =
      (scenarioRes.industryNames || []).join('、') ||
      (scenarioRes.industryIds || []).map((sid) => indRes.items.find((i) => i.id === sid)?.name).filter(Boolean).join('、') ||
      (scenarioRes.industryIds || []).join('、');
    professionName.value =
      (scenarioRes.professionNames || []).join('、') ||
      (scenarioRes.professionIds || []).map((mid) => majRes.items.find((m) => m.id === mid)?.name).filter(Boolean).join('、') ||
      (scenarioRes.professionIds || []).join('、');
    knowledgePool.value = kpRes.items || [];
    abilityPool.value = abRes.items || [];
    resourcePool.value = resRes.items || [];

    // 权重（后端覆盖均分默认值）
    const count = tasks.value.length;
    const wMap: Record<string, number> = {};
    tasks.value.forEach((t, i) => {
      wMap[t.id] = count > 0 ? Math.floor(100 / count) + (i < 100 % count ? 1 : 0) : 0;
    });
    try {
      const wres = await request<ListResponse<WeightItem>>(`/scene/weights?scenarioId=${encodeURIComponent(scenarioId)}`);
      (wres.items || []).forEach((w) => {
        if (wMap[w.taskId] !== undefined) wMap[w.taskId] = w.weight;
      });
    } catch {
      /* 权重拉取失败时使用均分默认值 */
    }
    weights.value = wMap;

    // 评价方式（只读展示）
    const evalMap = new Map<string, EvalMethodItem[]>();
    await Promise.all(
      tasks.value.map(async (t) => {
        try {
          const res = await request<{ methods: EvalMethodItem[] }>(`/scene/tasks/${t.id}/evaluation-methods`);
          evalMap.set(t.id, (res.methods || []).filter((m) => m.weight !== undefined));
        } catch {
          evalMap.set(t.id, []);
        }
      })
    );
    evalMethodsByTask.value = evalMap;
  } catch (e) {
    loadFailed.value = true;
    ElMessage.error((e as Error).message || '任务数据加载失败，请刷新页面重试');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// ===== 派生 =====
const totalWeight = computed(() => Object.values(weights.value).reduce((s, w) => s + (w || 0), 0));
const weightDialogTotal = computed(() => tasks.value.reduce((s, t) => s + (weightInputs.value[t.id] || 0), 0));

function evalMethodsFor(taskId: string): EvalMethodItem[] {
  return evalMethodsByTask.value.get(taskId) || [];
}

function isConfigured(taskId: string, type: CardType): boolean {
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task) return false;
  switch (type) {
    case 'info':
      return true;
    case 'description':
      return Boolean(task.detailedDescription || task.description);
    case 'knowledge':
      return (task.knowledgePointIds || []).length > 0;
    case 'ability':
      return (task.abilityPointIds || []).length > 0;
    case 'resources':
      return (task.resourceIds || []).length > 0;
    case 'evaluation':
      return evalMethodsFor(taskId).length > 0;
    case 'weight':
      return (weights.value[taskId] || 0) > 0;
  }
}

function summary(taskId: string, type: CardType): string {
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task) return '';
  const nameOf = (ids: string[] | undefined, pool: { id: string; name: string }[]): string => {
    const names = (ids || [])
      .map((id) => pool.find((x) => x.id === id)?.name)
      .filter(Boolean) as string[];
    return names.slice(0, 3).join('、') + (names.length > 3 ? ` 等${names.length}个` : '');
  };
  switch (type) {
    case 'info':
      return `任务名称：${task.name}\n编码：${task.code || '-'}\n任务类型：${task.taskType === 'assessment' ? '考核' : '训练'}\n难度：${task.difficulty}星\n预估学时：${task.estimatedHours}小时`;
    case 'description': {
      const d = task.detailedDescription || task.description;
      if (!d) return task.descriptionPdf ? '已上传附件' : '未填写';
      return `${d.replace(/<[^>]*>/g, '').slice(0, 50)}...`;
    }
    case 'knowledge':
      return (task.knowledgePointIds || []).length === 0 ? '未配置' : nameOf(task.knowledgePointIds, knowledgePool.value);
    case 'ability':
      return (task.abilityPointIds || []).length === 0 ? '未配置' : nameOf(task.abilityPointIds, abilityPool.value);
    case 'resources':
      return (task.resourceIds || []).length === 0 ? '未配置' : nameOf(task.resourceIds, resourcePool.value);
    case 'evaluation':
      return evalMethodsFor(taskId).length === 0
        ? '未配置'
        : evalMethodsFor(taskId).map((m) => EVAL_METHOD_LABELS[m.methodKey] || m.methodKey).join('、');
    case 'weight':
      return `${weights.value[taskId] || 0}%`;
  }
}

// ===== 任务增删改 =====
function openAddTask() {
  addForm.name = '';
  addForm.taskType = 'training';
  addForm.difficulty = 3;
  addForm.estimatedHours = 4;
  addForm.background = '';
  addDialogOpen.value = true;
}

async function handleAddTask() {
  if (!addForm.name.trim()) return;
  taskSaving.value = true;
  try {
    await taskApi.create({
      scenarioId: id.value,
      name: addForm.name.trim(),
      code: `TK-${Date.now().toString().slice(-6)}`,
      sortOrder: tasks.value.length + 1,
      estimatedHours: addForm.estimatedHours,
      taskType: addForm.taskType,
      difficulty: addForm.difficulty,
      background: addForm.background,
      dependencyIds: [],
      isReferenced: false,
      knowledgePointIds: [],
      abilityPointIds: [],
      resourceIds: []
    } as Partial<Omit<ScenarioTask, 'id'>>);
    addDialogOpen.value = false;
    ElMessage.success('已添加任务');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '添加失败');
  } finally {
    taskSaving.value = false;
  }
}

const editCardTitle = computed(() => {
  const c = CARD_CONFIGS.find((x) => x.type === editCardType.value);
  return `编辑任务 - ${c?.title || ''}`;
});

function openEditCard(task: ScenarioTask, type: CardType) {
  if (task.isReferenced && type !== 'weight') return;
  editTask.value = task;
  editCardType.value = type;
  editForm.name = task.name;
  editForm.taskType = task.taskType;
  editForm.difficulty = task.difficulty ?? 3;
  editForm.estimatedHours = task.estimatedHours ?? 1;
  editForm.background = task.background || '';
  editForm.detailedDescription = task.detailedDescription || task.description || '';
  editForm.knowledgePointIds = [...(task.knowledgePointIds || [])];
  editForm.abilityPointIds = [...(task.abilityPointIds || [])];
  editForm.resourceIds = [...(task.resourceIds || [])];
  editDialogOpen.value = true;
}

async function handleSaveEdit() {
  if (!editTask.value) return;
  const task = editTask.value;
  taskSaving.value = true;
  try {
    await taskApi.update(task.id, {
      name: editForm.name.trim(),
      taskType: editForm.taskType,
      difficulty: editForm.difficulty,
      estimatedHours: editForm.estimatedHours,
      background: editForm.background,
      detailedDescription: editForm.detailedDescription,
      knowledgePointIds: editForm.knowledgePointIds,
      abilityPointIds: editForm.abilityPointIds,
      resourceIds: editForm.resourceIds
    } as Partial<Omit<ScenarioTask, 'id'>>);
    editDialogOpen.value = false;
    ElMessage.success('已保存任务');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    taskSaving.value = false;
  }
}

async function confirmDelete(task: ScenarioTask) {
  try {
    await ElMessageBox.confirm(`确定要删除任务「${task.name}」吗？删除后不可恢复。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await taskApi.delete(task.id);
    ElMessage.success('已删除任务');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function moveTask(idx: number, dir: -1 | 1) {
  const target = idx + dir;
  if (target < 0 || target >= tasks.value.length) return;
  const reordered = [...tasks.value];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(target, 0, moved);
  tasks.value = reordered.map((t, i) => ({ ...t, sortOrder: i + 1 }));
  try {
    await taskApi.reorder(id.value, reordered.map((t) => t.id));
  } catch (e) {
    ElMessage.error((e as Error).message || '排序保存失败');
    load();
  }
}

// ===== 权重 =====
function openWeightDialog() {
  weightInputs.value = { ...weights.value };
  weightDialogOpen.value = true;
}

async function handleSaveWeights() {
  saving.value = true;
  let failed = 0;
  for (const task of tasks.value) {
    try {
      await request<WeightItem>('/scene/weights', {
        method: 'POST',
        body: JSON.stringify({ scenarioId: id.value, taskId: task.id, weight: weightInputs.value[task.id] || 0 })
      });
    } catch (e) {
      failed++;
      console.error('保存任务权重', e);
    }
  }
  saving.value = false;
  if (failed > 0) {
    ElMessage.error(`${failed} 个任务权重保存失败，请重试`);
  } else {
    weights.value = { ...weightInputs.value };
    weightDialogOpen.value = false;
    ElMessage.success('权重已保存');
  }
}

// ===== 保存草稿 / 完成 =====
async function saveAndGuardDraft(): Promise<boolean> {
  if (scenario.value?.status !== 'draft') {
    await scenarioApi.saveDraft(id.value);
    scenario.value = scenario.value ? { ...scenario.value, status: 'draft' } : scenario.value;
    return true;
  }
  return false;
}

async function handleSaveDraft() {
  saving.value = true;
  try {
    const reverted = await saveAndGuardDraft();
    ElMessage.success(reverted ? '草稿已保存，场景已退回草稿状态' : '草稿已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function handleFinish() {
  saving.value = true;
  try {
    await saveAndGuardDraft();
    ElMessage.success('配置已保存');
    router.push('/scene/scenarios');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.tasks-page {
  padding: 16px;
  background: #f5f7fa;
  min-height: 100vh;
  box-sizing: border-box;
}
.mb-16 {
  margin-bottom: 16px;
}

/* ===== 场景信息卡 ===== */
.scenario-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.scenario-left {
  flex: 1;
  min-width: 0;
}
.scenario-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.scenario-name {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scenario-meta {
  font-size: 13px;
  color: #64748b;
}
.scenario-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.scenario-stars {
  display: flex;
  gap: 2px;
}
.star {
  color: #e2e8f0;
}
.star.filled {
  color: #f59e0b;
}
.star-click {
  cursor: pointer;
  font-size: 22px;
}
.scenario-background {
  font-size: 13px;
  color: #475569;
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

/* ===== 工具栏 ===== */
.tasks-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tasks-toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.tasks-title {
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}
.weight-sum {
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #fffbeb;
  color: #d97706;
}
.weight-sum.ok {
  background: #ecfdf5;
  color: #059669;
}
.tasks-toolbar-right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ===== 任务列表 ===== */
.tasks-scroll {
  overflow-x: auto;
}
.task-cols {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 1080px;
}
.task-cols-head {
  margin-bottom: 8px;
}
.col-no {
  width: 40px;
  flex-shrink: 0;
}
.col-card {
  width: 150px;
  flex-shrink: 0;
  text-align: center;
  font-size: 12px;
  color: #64748b;
  padding: 8px 0;
}
.task-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
  min-width: 1080px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.task-order {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.order-arrows {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.order-arrow {
  cursor: pointer;
  color: #94a3b8;
  font-size: 14px;
}
.order-arrow:hover {
  color: var(--el-color-primary);
}
.order-num {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}
.task-card {
  width: 150px;
  height: 160px;
  border: 1px dashed #e2e8f0;
  background: #f8fafc;
  border-radius: 10px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: all 0.2s;
}
.task-card.configured {
  border: 1px solid #e2e8f0;
  background: #fff;
}
.task-card.configured:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.task-card.readonly {
  cursor: not-allowed;
  opacity: 0.7;
}
.task-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 8px;
}
.task-card-title {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.task-card-summary {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  white-space: pre-line;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
}
.task-del {
  display: flex;
  align-items: center;
  justify-content: center;
}
.tasks-empty {
  text-align: center;
  padding: 64px 0;
  color: #94a3b8;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.tasks-empty p {
  margin: 12px 0 0;
  font-size: 14px;
}

/* ===== 底部 ===== */
.tasks-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding: 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

/* ===== 星级选择 ===== */
.star-picker {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

/* ===== 评价方式只读 ===== */
.eval-empty {
  text-align: center;
  padding: 32px;
  color: #94a3b8;
  font-size: 13px;
}
.eval-method-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.eval-method-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.eval-tag {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  color: #fff;
  font-weight: 500;
}
.eval-method-weight {
  font-size: 12px;
  color: #64748b;
}
.eval-hint {
  font-size: 12px;
  color: #94a3b8;
  margin: 4px 0 0;
}

/* ===== 权重弹窗 ===== */
.weight-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
}
.weight-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
}
.weight-row-name {
  flex: 1;
  font-size: 13px;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.weight-row-pct {
  font-size: 13px;
  color: #64748b;
}
.weight-total {
  margin-top: 16px;
  text-align: right;
  font-size: 13px;
  color: #d97706;
}
.weight-total.ok {
  color: #059669;
}
</style>

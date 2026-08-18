<template>
  <div class="tasks-page">
    <!-- 顶部操作栏（对齐 React EditorShell） -->
    <div class="page-toolbar">
      <div class="toolbar-left">
        <el-button :icon="ArrowLeft" @click="goList">返回</el-button>
        <span class="step-label">步骤 2 · 任务链配置</span>
      </div>
      <div class="toolbar-right">
        <el-button @click="goPrev">上一步</el-button>
        <el-button type="primary" plain :loading="isSaving" @click="handleSaveDraft">保存</el-button>
        <el-button type="primary" :loading="isSaving" @click="handleFinish">完成配置</el-button>
      </div>
    </div>

    <!-- 加载失败提示 -->
    <el-alert v-if="loadFailed" type="error" :closable="false" class="mb-4">
      <template #title>任务数据加载失败，请重试</template>
      <el-button size="small" text type="primary" @click="reload">刷新重试</el-button>
    </el-alert>

    <!-- 场景信息 -->
    <el-card shadow="never" class="mb-4">
      <div class="scenario-head">
        <div class="scenario-main">
          <div class="scenario-title-row">
            <span class="scenario-name">{{ existingScenario?.name || '新建场景' }}</span>
            <el-tag v-if="(existingScenario?.coBuilderIds?.length || 0) > 0" size="small" type="info">共建</el-tag>
          </div>
          <div class="scenario-desc">
            {{ positionName || existingScenario?.careerPositionId || '未选择岗位' }}
            <span class="sep">|</span>
            {{ industryName || '未选择行业' }}
            <span class="sep">|</span>
            {{ professionName || '未选择专业' }}
          </div>
        </div>
        <div class="scenario-side">
          <el-rate :model-value="existingScenario?.difficulty ?? 3" disabled />
          <el-tag v-if="existingScenario" size="small">{{ existingScenario.version }}</el-tag>
        </div>
      </div>
      <div class="scenario-background">{{ existingScenario?.background || '暂无介绍' }}</div>
    </el-card>

    <!-- 任务列表头部 -->
    <div class="tasks-toolbar">
      <div class="tasks-title">
        <span class="title">任务列表</span>
        <el-tag size="small" type="info">{{ tasks.length }} 个任务</el-tag>
      </div>
      <div class="tasks-actions">
        <el-button size="small" @click="openClone">克隆/引用任务</el-button>
        <el-button size="small" @click="openWeight">配置权重</el-button>
        <el-tag size="small" :type="totalWeight === 100 ? 'info' : 'danger'">总权重 {{ totalWeight }}%</el-tag>
        <el-button size="small" type="primary" @click="isAddTaskOpen = true">添加任务</el-button>
      </div>
    </div>

    <!-- 任务矩阵（8 列卡片，拖拽排序） -->
    <div class="task-matrix">
      <!-- 列头 -->
      <div class="matrix-row matrix-header">
        <div class="col-order"></div>
        <div v-for="c in cardConfigs" :key="c.type" class="col-card">{{ c.title }}</div>
        <div class="col-delete"></div>
      </div>

      <!-- 行 -->
      <div
        v-for="(task, idx) in tasks"
        :key="task.id"
        class="matrix-row task-row"
        :class="{ dragging: draggedIdx === idx }"
        draggable="true"
        @dragstart="draggedIdx = idx"
        @dragover.prevent
        @drop="onDrop(idx)"
      >
        <div class="col-order">
          <el-icon class="grip"><Rank /></el-icon>
          <span class="order-num">{{ idx + 1 }}</span>
        </div>
        <div
          v-for="config in cardConfigs"
          :key="config.type"
          class="col-card card"
          :class="[task.isReferenced ? 'card-ref' : isConfigured(task.id, config.type) ? 'card-done' : 'card-empty']"
          @click="!task.isReferenced && openCard(task.id, config.type)"
        >
          <div class="card-head">
            <div class="card-icon">
              <el-icon><component :is="config.icon" /></el-icon>
            </div>
            <span class="card-title">{{ config.title }}</span>
            <el-tag v-if="task.isReferenced" size="small" type="info">引用</el-tag>
          </div>
          <p class="card-summary">{{ getSummary(task.id, config.type) }}</p>
        </div>
        <div class="col-delete">
          <el-button link type="danger" @click="deleteConfirmTask = { id: task.id, name: task.name }">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="tasks.length === 0" class="empty-state">
        <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
        <p>暂无任务，点击添加第一个任务</p>
        <el-button type="primary" @click="isAddTaskOpen = true">添加任务</el-button>
      </div>
    </div>

    <!-- 添加任务对话框 -->
    <el-dialog v-model="isAddTaskOpen" title="添加任务" width="480px">
      <el-form label-position="top">
        <el-form-item label="任务名称">
          <el-input v-model="newTask.name" placeholder="输入任务名称" />
        </el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="newTask.type" style="width: 100%">
            <el-option label="训练任务" value="training" />
            <el-option label="考核任务" value="assessment" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label><span>预估学时 <span class="tip">学生完成任务的预估时长</span></span></template>
          <el-input-number v-model="newTask.hours" :min="0" :max="999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="难度">
          <el-rate v-model="newTask.difficulty" :max="5" />
        </el-form-item>
        <el-form-item label="背景介绍">
          <el-input v-model="newTask.background" type="textarea" :rows="3" placeholder="简述任务背景" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="isAddTaskOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!newTask.name.trim()" @click="handleAddTask">添加</el-button>
      </template>
    </el-dialog>

    <!-- 编辑卡片对话框 -->
    <el-dialog
      v-model="cardDialogOpen"
      :title="cardDialogTitle"
      :width="cardDialogWidth"
      :top="cardDialogTop"
      destroy-on-close
    >
      <template v-if="editingCard && currentTask">
        <div class="card-dialog-sub">任务：{{ currentTask.name }}</div>
        <div class="card-dialog-body">
          <!-- info -->
          <TaskInfoCard
            v-if="editingCard.type === 'info'"
            :name="localTask.name"
            :type="localTask.type"
            :difficulty="localTask.difficulty"
            :hours="localTask.hours"
            :background="localTask.background"
            @update:name="localTask.name = $event"
            @update:type="localTask.type = $event"
            @update:difficulty="localTask.difficulty = $event"
            @update:hours="localTask.hours = $event"
            @update:background="localTask.background = $event"
          />

          <!-- description -->
          <DescriptionEditor
            v-else-if="editingCard.type === 'description'"
            :value="currentState.description"
            :pdf-url="currentState.descriptionPdf"
            rich-text-label="富文本编辑"
            pdf-tab-label="上传任务说明书"
            upload-hint="点击或拖拽上传任务说明书"
            @update:value="(v) => updateState(editingCard!.taskId, { description: v })"
            @update:pdf-url="(v) => updateState(editingCard!.taskId, { descriptionPdf: v })"
          />

          <!-- knowledge -->
          <KnowledgeSelector
            v-else-if="editingCard.type === 'knowledge'"
            :selected="selectedKnowledgeItems(editingCard.taskId)"
            :pool="knowledgePool"
            @change="onKnowledgeChange(editingCard!.taskId, $event)"
          />

          <!-- ability -->
          <div v-else-if="editingCard.type === 'ability'" class="ability-wrap">
            <div v-if="!positionId" class="ability-empty">
              <el-icon :size="48" color="#c0c4cc"><Medal /></el-icon>
              <p>请先在场景基础信息中关联岗位，再选择考察能力点</p>
            </div>
            <AbilitySelector
              v-else
              :related-abilities="relatedAbilities"
              :selected-ids="currentState.abilityPoints"
              @change="(ids) => updateState(editingCard!.taskId, { abilityPoints: ids })"
            />
          </div>

          <!-- resources -->
          <ResourceSelector
            v-else-if="editingCard.type === 'resources'"
            :pool="resourcePool"
            :selected-ids="currentState.resources"
            @change="(ids) => updateState(editingCard!.taskId, { resources: ids })"
          />

          <!-- evaluation -->
          <EvalMethodSelector
            v-else-if="editingCard.type === 'evaluation'"
            :value="currentState.evaluationMethods"
            @change="(m) => onEvalMethodsChange(editingCard!.taskId, m)"
          />

          <!-- evaluationRules -->
          <EvalMethodConfig
            v-else-if="editingCard.type === 'evaluationRules'"
            :value="taskStateToEvalRuleConfig(currentState)"
            :knowledge-points="knowledgePoints"
            :ability-points="abilityPoints"
            @change="(cfg) => updateState(editingCard!.taskId, evalRuleConfigToTaskStateUpdates(cfg))"
          />

          <!-- weight -->
          <div v-else-if="editingCard.type === 'weight'" class="weight-empty">
            <el-icon :size="48" color="#c0c4cc"><ScaleToOriginal /></el-icon>
            <p>任务权重已在全局配置</p>
            <p class="sub">请点击顶部「配置任务权重」按钮进行设置</p>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="cardDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="isSavingCard" @click="handleCardSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 克隆/引用对话框 -->
    <el-dialog v-model="isCloneOpen" title="克隆/引用任务" width="900px" top="5vh">
      <div class="clone-toolbar">
        <div class="clone-mode">
          <el-button size="small" :type="cloneMode === 'clone' ? 'primary' : 'default'" @click="cloneMode = 'clone'">克隆（可编辑）</el-button>
          <el-button size="small" :type="cloneMode === 'reference' ? 'primary' : 'default'" @click="cloneMode = 'reference'">引用（只读）</el-button>
        </div>
        <el-input v-model="cloneSearch" placeholder="搜索任务名称、编码..." clearable style="width: 260px" />
      </div>

      <el-tabs v-model="cloneTab" class="clone-tabs">
        <el-tab-pane label="我的" name="my" />
        <el-tab-pane label="共建" name="collab" />
        <el-tab-pane label="公共库" name="public" />
      </el-tabs>

      <div class="clone-list">
        <div class="clone-header">
          <div class="clone-col check"></div>
          <div class="clone-col name">任务名称</div>
          <div class="clone-col code">任务编码</div>
          <div class="clone-col scenario">关联场景</div>
          <div class="clone-col position">关联岗位</div>
        </div>
        <div
          v-for="t in filteredCloneTasks"
          :key="t.id"
          class="clone-row"
          :class="{ selected: selectedClone.includes(t.id) }"
          @click="toggleCloneSelect(t.id)"
        >
          <div class="clone-col check">
            <el-icon v-if="selectedClone.includes(t.id)" color="#409eff"><CircleCheckFilled /></el-icon>
            <el-icon v-else color="#c0c4cc"><CircleCheck /></el-icon>
          </div>
          <div class="clone-col name">{{ t.name }}</div>
          <div class="clone-col code">{{ t.code }}</div>
          <div class="clone-col scenario">{{ t.scenarioName }}</div>
          <div class="clone-col position">{{ positionName || '-' }}</div>
        </div>
        <div v-if="filteredCloneTasks.length === 0" class="clone-empty">无可克隆任务</div>
      </div>

      <template #footer>
        <el-button @click="isCloneOpen = false">取消</el-button>
        <el-button type="primary" :loading="isCloning" :disabled="selectedClone.length === 0" @click="handleClone">
          {{ cloneMode === 'clone' ? '克隆' : '引用' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 权重配置对话框 -->
    <el-dialog v-model="isWeightConfigOpen" title="配置任务权重" width="720px" top="8vh" :close-on-click-modal="false">
      <div class="weight-head">
        <span class="weight-total" :class="totalWeight === 100 ? 'ok' : 'warn'">总权重: {{ totalWeight }}%</span>
        <span v-if="totalWeight !== 100" class="weight-delta">
          {{ totalWeight > 100 ? `超出 ${totalWeight - 100}%` : `还需分配 ${100 - totalWeight}%` }}
        </span>
        <el-button size="small" @click="distributeWeights">一键平均分配</el-button>
      </div>

      <div class="weight-bar">
        <div
          v-for="(t, i) in tasks"
          :key="t.id"
          class="weight-bar-seg"
          :style="{ width: (taskStates[t.id]?.weight || 0) + '%', background: pieColors[i % pieColors.length] }"
        ></div>
      </div>

      <div class="weight-legend">
        <div v-for="(t, i) in tasks" :key="t.id" class="legend-row">
          <span class="legend-dot" :style="{ background: pieColors[i % pieColors.length] }"></span>
          <span class="legend-name">{{ t.name }}</span>
          <span class="legend-val">{{ taskStates[t.id]?.weight || 0 }}%</span>
        </div>
      </div>

      <div class="weight-list">
        <div v-for="(t, i) in tasks" :key="t.id" class="weight-row">
          <span class="weight-dot" :style="{ background: pieColors[i % pieColors.length] }"></span>
          <span class="weight-idx">{{ i + 1 }}</span>
          <span class="weight-name">{{ t.name }}</span>
          <el-input-number
            :model-value="taskStates[t.id]?.weight || 0"
            :min="0"
            :max="100"
            size="small"
            :disabled="taskStates[t.id]?.locked"
            @change="onWeightChange(t.id, $event)"
          />
          <span class="weight-percent">%</span>
          <el-button link @click="toggleLock(t.id)">
            <el-icon :color="taskStates[t.id]?.locked ? '#e6a23c' : '#c0c4cc'">
              <Lock v-if="taskStates[t.id]?.locked" />
              <Unlock v-else />
            </el-icon>
          </el-button>
        </div>
      </div>

      <template #footer>
        <el-button type="primary" :disabled="totalWeight !== 100" @click="closeWeight">保存</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog v-model="deleteConfirmOpen" title="确认删除" width="420px">
      <p>确定要删除任务「{{ deleteConfirmTask?.name }}」吗？删除后不可恢复。</p>
      <template #footer>
        <el-button @click="deleteConfirmTask = null">取消</el-button>
        <el-button type="danger" @click="confirmDeleteTask">确认删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, CircleCheck, CircleCheckFilled, Delete, Document, Lock, Medal, Rank, ScaleToOriginal, Unlock } from '@element-plus/icons-vue';
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { scenarioApi } from '@/api/scene';
import { positionApi, abilityApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { knowledgeApi } from '@/api/lesson';
import { useAuthStore } from '@/stores/auth';
import type { Scenario } from '@/types/scene';
import type { KnowledgePointItem, ResourceItem, AbilityPointItem, EvalRuleConfig } from '@/views/lesson/lesson-edit-utils';
import { fetchAllPages } from '@/views/lesson/lesson-edit-utils';
import {
  cardConfigs,
  evaluationMethodLabel,
  makeDefaultTaskState,
  taskStateFromMethods,
  taskStateToMethodsInput,
  taskStateToEvalRuleConfig,
  evalRuleConfigToTaskStateUpdates,
  DEFAULT_RANDOM_DRAW_RESOURCE_CONFIG,
  DEFAULT_REVIEW_RESOURCE_CONFIG,
  DEFAULT_OUTCOME_RESOURCE_CONFIG,
  DEFAULT_HOMEWORK_RESOURCE_CONFIG,
  type TaskState,
  type CardType
} from '../partner/co-build-scene-tasks/tasks-logic';
import TaskInfoCard from '../partner/co-build-scene-tasks/TaskInfoCard.vue';
import EvalMethodSelector from '../partner/co-build-scene-tasks/EvalMethodSelector.vue';
import KnowledgeSelector from '../partner/co-build-scene-tasks/KnowledgeSelector.vue';
import AbilitySelector from '../partner/co-build-scene-tasks/AbilitySelector.vue';
import ResourceSelector from '../partner/co-build-scene-tasks/ResourceSelector.vue';
import DescriptionEditor from '../lesson/description-editor.vue';
import EvalMethodConfig from '../lesson/eval-method-config.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const scenarioId = route.params.id as string;

/* ============ 任务模型 ============ */

interface Task {
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

interface ApiTask {
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

/* ============ 页面状态 ============ */

const existingScenario = ref<Scenario | null>(null);
const positionName = ref('');
const industryName = ref('');
const professionName = ref('');
const loadFailed = ref(false);
const isSaving = ref(false);

const tasks = ref<Task[]>([]);
const taskStates = ref<Record<string, TaskState>>({});

const positionId = computed(() => existingScenario.value?.careerPositionId || '');
const currentUserId = computed(() => authStore.user?.id || '');

/* ============ 数据集 ============ */

const knowledgePoints = ref<KnowledgePointItem[]>([]);
const abilityPoints = ref<AbilityPointItem[]>([]);
const learningResources = ref<ResourceItem[]>([]);
const positionAbilityBindings = ref<any[]>([]);
const cloneScenarios = ref<any[]>([]);

const customKnowledgePointIds = ref<Set<string>>(new Set());

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
    .filter((t: any) => {
      if (cloneTab.value === 'my') return t.scenarioCreatorId === currentUserId.value;
      if (cloneTab.value === 'collab')
        return Array.isArray(t.scenarioCoBuilderIds) && t.scenarioCoBuilderIds.includes(currentUserId.value);
      if (cloneTab.value === 'public')
        return t.scenarioStatus === 'published' && t.scenarioCreatorId !== currentUserId.value;
      return true;
    })
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
  router.push('/scene/scenarios');
}

function goPrev() {
  router.push(`/scene/scenarios/${scenarioId}/edit`);
}

function reload() {
  window.location.reload();
}

/* ============ 数据加载 ============ */

async function loadDatasets(keys: string[]) {
  for (const key of keys) {
    try {
      if (key === 'knowledge') {
        const kps = await fetchAllPages((params) => knowledgeApi.list(params));
        knowledgePoints.value = kps.map((kp: any) => ({
          id: kp.id,
          name: kp.name,
          code: kp.code,
          description: kp.description,
          linked: true,
          granularLessons: kp.granularLessonIds || kp.granularLessons || []
        }));
      } else if (key === 'ability') {
        const aps = await fetchAllPages((params) => abilityApi.list(params));
        abilityPoints.value = aps.map((ap: any) => ({
          id: ap.id,
          name: ap.name,
          code: ap.code,
          description: ap.description
        }));
        if (positionId.value) {
          try {
            const bres = await abilityApi.listBindings({ careerPositionId: positionId.value });
            positionAbilityBindings.value = bres.items || [];
          } catch {
            positionAbilityBindings.value = [];
          }
        }
      } else if (key === 'resources') {
        const resources = await fetchAllPages((params) =>
          request<ListResponse<any>>(`/library/resources${buildQuery({ limit: params.limit, offset: params.offset })}`)
        );
        learningResources.value = resources.map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.resourceType || r.type,
          url: r.url,
          description: r.description,
          size: r.fileSize !== undefined ? String(r.fileSize) : r.size
        }));
      } else if (key === 'clone') {
        const [scRes, tRes] = await Promise.all([
          request<ListResponse<any>>(`/scene/scenarios${buildQuery({ limit: 1000 })}`),
          request<ListResponse<any>>(`/scene/tasks${buildQuery({ limit: 1000 })}`)
        ]);
        const nameMap = new Map<string, string>();
        const metaMap = new Map<string, { creatorId: string; coBuilderIds: string[]; status: string }>();
        for (const s of scRes.items) {
          nameMap.set(s.id, s.name);
          metaMap.set(s.id, { creatorId: s.creatorId, coBuilderIds: s.coBuilderIds || [], status: s.status });
        }
        const tasksByScenario = new Map<string, any[]>();
        for (const item of tRes.items) {
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
        for (const s of scRes.items) {
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

async function loadAll() {
  try {
    const [scenarioData, tasksRes, posRes, indRes, majRes] = await Promise.all([
      scenarioApi.get(scenarioId),
      request<ListResponse<ApiTask>>(`/scene/tasks${buildQuery({ scenarioId, limit: 1000 })}`),
      positionApi.list({ limit: 1000 }),
      industryApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 })
    ]);

    existingScenario.value = scenarioData;
    positionName.value =
      posRes.items.find((p) => p.id === scenarioData.careerPositionId)?.name ||
      scenarioData.careerPositionId ||
      '';
    industryName.value =
      (scenarioData.industryNames || []).join('、') ||
      (scenarioData.industryIds || [])
        .map((sid) => indRes.items.find((i) => i.id === sid)?.name)
        .filter(Boolean)
        .join('、') ||
      (scenarioData.industryIds || []).join('、');
    professionName.value =
      (scenarioData.professionNames || []).join('、') ||
      (scenarioData.professionIds || [])
        .map((mid) => majRes.items.find((m) => m.id === mid)?.name)
        .filter(Boolean)
        .join('、') ||
      (scenarioData.professionIds || []).join('、');

    const mockTasks: Task[] = (tasksRes.items || []).map((at: ApiTask) => ({
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
        request<{ methods: any[] }>(`/scene/tasks/${t.id}/evaluation-methods`).catch(() => ({
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
    const wres = await request<ListResponse<{ taskId: string; weight: number }>>(
      `/scene/weights${buildQuery({ scenarioId })}`
    );
    const weightById = new Map((wres.items || []).map((w) => [w.taskId, w.weight]));
    Object.keys(states).forEach((tid2) => {
      if (weightById.has(tid2)) {
        states[tid2].weight = weightById.get(tid2)!;
        states[tid2].locked = true;
      }
    });

    taskStates.value = states;
  } catch (err) {
    loadFailed.value = true;
    ElMessage.error((err as Error).message || '任务数据加载失败，请刷新页面重试');
  }
}

onMounted(loadAll);

// 数据集随岗位变化懒加载（知识/能力/资源在选择器激活时即已加载）
watch(
  positionId,
  (pid) => {
    if (pid) loadDatasets(['ability']);
  }
);

watch(
  isCloneOpen,
  (open) => {
    if (open) loadDatasets(['clone']);
  }
);

watch(
  cardDialogOpen,
  (open) => {
    if (open && editingCard.value) {
      const type = editingCard.value.type;
      const keys: string[] = [];
      if (type === 'knowledge') keys.push('knowledge');
      else if (type === 'ability') keys.push('ability');
      else if (type === 'resources') keys.push('resources');
      if (keys.length) loadDatasets(keys);
    }
  }
);

/* ============ 保存测评方式（409 重试一次） ============ */

async function saveMethodsWithRetry(tid: string, version: number, methods: any[]): Promise<number> {
  if (methods.length === 0) return version;
  const doSave = async (v: number) => {
    const savedRes = await request<{ methods: any[] }>(`/scene/tasks/${tid}/evaluation-methods`, {
      method: 'PUT',
      body: JSON.stringify({ version: v, methods })
    });
    return (savedRes.methods || []).reduce((max, m) => Math.max(max, m.version || 0), 0);
  };
  try {
    return await doSave(version);
  } catch (err: any) {
    if (err.message === '评价规则已被其他会话修改') {
      const freshRes = await request<{ methods: any[] }>(`/scene/tasks/${tid}/evaluation-methods`).catch(
        () => null
      );
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
    const created = await request<any>(`/scene/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const mkTask: Task = {
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
    // 保留既有任务已配置的权重，仅给新任务分配剩余权重（不覆盖既有配置）
    const used = Object.values(nextStates).reduce((sum, s) => sum + (s.weight || 0), 0);
    const remaining = Math.max(0, 100 - used);
    const newState = makeDefaultTaskState(nextTasks.length, nextTasks.length - 1);
    newState.weight = nextTasks.length === 1 ? 100 : Math.min(remaining, 100);
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
    await request(`/scene/tasks/${id}`, { method: 'DELETE' });
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
  request(`/scene/tasks/reorder`, {
    method: 'POST',
    body: JSON.stringify({ scenarioId, taskIds: reordered.map((t) => t.id) })
  }).catch((err) => {
    console.error('保存任务排序失败', err);
    ElMessage.error('排序保存失败，请刷新重试');
  });
}

/* ============ 保存到后端 ============ */

async function persistWeights(taskList: Task[], states: Record<string, TaskState>): Promise<number> {
  let failedCount = 0;
  for (const t of taskList) {
    if (t.id.startsWith('task-')) continue;
    const st = states[t.id];
    if (!st) continue;
    try {
      await request('/scene/weights', {
        method: 'POST',
        body: JSON.stringify({ scenarioId, taskId: t.id, weight: st.weight ?? 0 })
      });
    } catch (err) {
      failedCount++;
      console.error('保存任务权重失败', err);
    }
  }
  return failedCount;
}

async function saveTasksToBackend() {
  const updatedTaskStates: Record<string, TaskState> = { ...taskStates.value };
  const newTasks: Task[] = [];
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
      const created = await request<any>(`/scene/tasks`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const oldId = t.id;
      const newTask: Task = { ...t, id: created.id };
      newTasks.push(newTask);
      updatedTaskStates[newTask.id] = { ...ts, evalMethodVersion: ts.evalMethodVersion };
      delete updatedTaskStates[oldId];
      const newVersion = await saveMethodsWithRetry(newTask.id, ts.evalMethodVersion, taskStateToMethodsInput(ts));
      updatedTaskStates[newTask.id] = { ...updatedTaskStates[newTask.id], evalMethodVersion: newVersion };
    } else {
      await request(`/scene/tasks/${t.id}`, {
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
  const weightFailures = await persistWeights(newTasks, updatedTaskStates);
  if (weightFailures > 0) {
    ElMessage.error(`${weightFailures} 个任务权重保存失败，请重试`);
  }
}

// 共用的「保存任务 + 非草稿态退回草稿」核心，返回是否触发了退回草稿
async function saveAndGuardDraft(): Promise<boolean> {
  await saveTasksToBackend();
  if (existingScenario.value?.status !== 'draft') {
    await scenarioApi.saveDraft(scenarioId);
    existingScenario.value = existingScenario.value
      ? { ...existingScenario.value, status: 'draft' as any }
      : existingScenario.value;
    return true;
  }
  return false;
}

async function handleSaveDraft() {
  isSaving.value = true;
  try {
    const reverted = await saveAndGuardDraft();
    if (reverted) {
      ElMessage.success('草稿已保存');
      ElMessage.info('场景已退回草稿状态');
    } else {
      ElMessage.success('草稿已保存');
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '保存失败');
  } finally {
    isSaving.value = false;
  }
}

async function handleFinish() {
  isSaving.value = true;
  try {
    const reverted = await saveAndGuardDraft();
    if (reverted) {
      ElMessage.success('配置已保存');
      ElMessage.info('场景已退回草稿状态');
    } else {
      ElMessage.success('配置已保存');
    }
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
    const methodsInput = taskStateToMethodsInput({ ...state, methodResourceConfigs: updatedRC });
    if (methodsInput.length > 0) {
      isSavingCard.value = true;
      try {
        const newVersion = await saveMethodsWithRetry(taskId, state.evalMethodVersion, methodsInput);
        updateState(taskId, {
          methodResourceConfigs: updatedRC,
          reviewSteps: enabledReviewSteps,
          evalMethodVersion: newVersion
        });
      } catch (err) {
        ElMessage.error((err as Error).message || '评价规则保存失败');
        isSavingCard.value = false;
        return;
      } finally {
        isSavingCard.value = false;
      }
    } else {
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

    const newTasks: Task[] = selected.map((t: any, i: number) => ({
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
        request<{ methods: any[] }>(`/scene/tasks/${t.id}/evaluation-methods`).catch(() => ({
          methods: []
        }))
      )
    );

    // 权重：保留既有任务已配置的权重，仅在新克隆任务间均分剩余权重（对齐 handleAddTask 口径）
    const usedWeight = Object.values(taskStates.value).reduce((sum, s) => sum + (s.weight || 0), 0);
    const remainingWeight = Math.max(0, 100 - usedWeight);

    const newStates: Record<string, TaskState> = {};
    selected.forEach((t: any, i: number) => {
      const methods = methodsResults[i]?.methods || [];
      const ts = taskStateFromMethods(methods);
      if (t.knowledgePointIds) ts.knowledgePoints = [...t.knowledgePointIds];
      if (t.abilityPointIds) ts.abilityPoints = [...t.abilityPointIds];
      if (t.resourceIds) ts.resources = [...t.resourceIds];
      if (t.detailedDescription) ts.description = t.detailedDescription;
      if (t.descriptionPdf) ts.descriptionPdf = t.descriptionPdf;
      ts.weight =
        selected.length > 0
          ? Math.floor(remainingWeight / selected.length) +
            (i < remainingWeight % selected.length ? 1 : 0)
          : 0;
      newStates[newTasks[i].id] = ts;
    });

    tasks.value = [...tasks.value, ...newTasks];
    taskStates.value = { ...taskStates.value, ...newStates };
    isCloneOpen.value = false;
    selectedClone.value = [];
    ElMessage.success(`已${cloneMode.value === 'clone' ? '克隆' : '引用'} ${newTasks.length} 个任务`);
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

function openWeight() {
  isWeightConfigOpen.value = true;
}

function closeWeight() {
  isWeightConfigOpen.value = false;
  persistWeights(tasks.value, taskStates.value).then((failed) => {
    if (failed > 0) {
      ElMessage.error(`${failed} 个任务权重保存失败，请重试`);
    }
  });
}
</script>

<style scoped>
.tasks-page {
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
}
.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-label {
  font-weight: 600;
  color: #303133;
}
.mb-4 {
  margin-bottom: 16px;
}

/* 场景信息 */
.scenario-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.scenario-main {
  flex: 1;
  min-width: 0;
}
.scenario-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.scenario-name {
  font-size: 16px;
  font-weight: 600;
}
.scenario-desc {
  color: #909399;
  font-size: 13px;
  margin-top: 4px;
}
.sep {
  margin: 0 6px;
  color: #dcdfe6;
}
.scenario-side {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.scenario-background {
  color: #606266;
  font-size: 13px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f2f5;
}

/* 任务列表头部 */
.tasks-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 20px 0 12px;
}
.tasks-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tasks-title .title {
  font-size: 16px;
  font-weight: 600;
}
.tasks-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tip {
  color: #999;
  font-size: 12px;
}

/* 任务矩阵 */
.task-matrix {
  overflow-x: auto;
  padding-bottom: 8px;
}
.matrix-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 1200px;
  padding-right: 4px;
}
.matrix-header {
  gap: 12px;
  padding: 0 4px;
}
.matrix-header .col-card {
  text-align: center;
  color: #909399;
  font-size: 12px;
  padding: 8px 0;
  white-space: pre-line;
  line-height: 1.4;
}
.task-row {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  align-items: center;
}
.task-row:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #a0cfff;
}
.task-row.dragging {
  opacity: 0.5;
  border-style: dashed;
  border-color: #409eff;
}
.col-order {
  width: 32px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: grab;
  color: #c0c4cc;
}
.order-num {
  font-size: 12px;
  color: #c0c4cc;
}
.col-card {
  width: 208px;
  flex-shrink: 0;
}
.col-delete {
  width: 32px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}
.card {
  height: 160px;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  padding: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}
.card-ref {
  background: #f5f7fa;
  border-color: #e4e7ed;
  cursor: not-allowed;
  opacity: 0.6;
}
.card-done {
  background: #fff;
  border-color: #dcdfe6;
}
.card-done:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.card-empty {
  background: #fafafa;
  border-style: dashed;
  border-color: #dcdfe6;
}
.card-empty:hover {
  border-color: #409eff;
  background: #f5f7fa;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.card-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
  color: #909399;
}
.card-done .card-icon {
  background: #ecf5ff;
  color: #409eff;
}
.card-title {
  font-size: 12px;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-summary {
  font-size: 12px;
  line-height: 1.5;
  flex: 1;
  white-space: pre-line;
  color: #606266;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
}
.card-empty .card-summary {
  color: #c0c4cc;
}
.empty-state {
  text-align: center;
  padding: 64px 0;
  color: #909399;
}

/* 卡片对话框 */
.card-dialog-sub {
  color: #909399;
  font-size: 13px;
  margin-bottom: 12px;
}
.card-dialog-body {
  max-height: calc(100vh - 260px);
  overflow-y: auto;
}
.ability-wrap {
  min-height: 240px;
}
.ability-empty,
.weight-empty {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}
.weight-empty .sub {
  font-size: 13px;
  color: #c0c4cc;
}

/* 克隆对话框 */
.clone-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.clone-mode {
  display: flex;
  gap: 8px;
}
.clone-tabs {
  margin-bottom: 12px;
}
.clone-list {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  max-height: 46vh;
  overflow: auto;
}
.clone-header,
.clone-row {
  display: grid;
  grid-template-columns: 48px 1fr 120px 160px 120px;
  gap: 12px;
  padding: 8px 12px;
  align-items: center;
  font-size: 13px;
}
.clone-header {
  background: #f5f7fa;
  color: #909399;
  position: sticky;
  top: 0;
}
.clone-row {
  border-bottom: 1px solid #f5f7fa;
  cursor: pointer;
}
.clone-row:hover {
  background: #f5f7fa;
}
.clone-row.selected {
  background: #ecf5ff;
}
.clone-col.check {
  display: flex;
  justify-content: center;
}
.clone-col.name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clone-col.code,
.clone-col.scenario,
.clone-col.position {
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clone-empty {
  padding: 32px;
  text-align: center;
  color: #909399;
}

/* 权重配置 */
.weight-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.weight-total {
  font-size: 18px;
  font-weight: 600;
}
.weight-total.ok {
  color: #67c23a;
}
.weight-total.warn {
  color: #e6a23c;
}
.weight-delta {
  color: #e6a23c;
  font-size: 13px;
}
.weight-bar {
  display: flex;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: #f0f2f5;
  margin-bottom: 12px;
}
.weight-bar-seg {
  transition: all 0.3s;
}
.weight-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  max-height: 140px;
  overflow-y: auto;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.legend-dot,
.weight-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.legend-val {
  color: #909399;
  font-weight: 500;
}
.weight-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 40vh;
  overflow-y: auto;
}
.weight-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid #f0f2f5;
  border-radius: 8px;
}
.weight-idx {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #606266;
  flex-shrink: 0;
}
.weight-name {
  flex: 1;
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.weight-percent {
  color: #909399;
}
</style>

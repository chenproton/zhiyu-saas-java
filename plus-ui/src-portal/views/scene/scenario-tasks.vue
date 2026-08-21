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

        <div class="card-dialog-body" :style="cardDialogBodyStyle">
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
            @change="(ids) => onResourcesChange(editingCard!.taskId, ids)"
            @upload="onResourceUpload"
          />

          <!-- evaluation -->
          <EvalMethodSelector
            v-else-if="editingCard.type === 'evaluation'"
            :value="currentState.evaluationMethods"
            @change="(m) => onEvalMethodsChange(editingCard!.taskId, m)"
          />

          <!-- evaluationRules -->
          <EvaluationRulesEditor
            v-else-if="editingCard.type === 'evaluationRules'"
            :value="taskStateToEvalRuleConfig(currentState)"
            :evaluation-methods="currentState.evaluationMethods"
            :knowledge-points="knowledgePoints"
            :ability-points="abilityPoints"
            :persist-standard="handlePersistStandard"
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
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, CircleCheck, CircleCheckFilled, Delete, Document, Lock, Medal, Rank, ScaleToOriginal, Unlock } from '@element-plus/icons-vue';
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { scenarioApi } from '@/api/scene';
import { positionApi, abilityApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { knowledgeApi } from '@/api/lesson';
import { resourceLibraryApi } from '@/api/library';
import { useAuthStore } from '@/stores/auth';
import type { Scenario } from '@/types/scene';
import type { KnowledgePointItem, ResourceItem, EvalRuleConfig } from '@/views/lesson/lesson-edit-utils';
import { fetchAllPages } from '@/views/lesson/lesson-edit-utils';
import {
  cardConfigs,
  taskStateToEvalRuleConfig,
  evalRuleConfigToTaskStateUpdates,
  taskStateToMethodsInput,
  type TaskState,
  type EvalPoint
} from '../partner/co-build-scene-tasks/tasks-logic';
import TaskInfoCard from '../partner/co-build-scene-tasks/TaskInfoCard.vue';
import EvalMethodSelector from '../partner/co-build-scene-tasks/EvalMethodSelector.vue';
// 知识点/资源选择器复用课程编辑侧全功能组件（支持新增/克隆/引用、上传新建），
// 对齐功能清单「从知识点库引用/克隆/新增」「任务资源 11 类差异化配置」
import KnowledgeSelector from '../lesson/knowledge-selector.vue';
import AbilitySelector from '../partner/co-build-scene-tasks/AbilitySelector.vue';
import ResourceSelector from '../lesson/resource-selector.vue';
import DescriptionEditor from '../lesson/description-editor.vue';
import EvaluationRulesEditor from './evaluation-rules/EvaluationRulesEditor.vue';
import { useScenarioTasks, type ApiTask } from '../partner/co-build-scene-tasks/use-scenario-tasks';

const route = useRoute();
const authStore = useAuthStore();
const scenarioId = route.params.id as string;

const existingScenario = ref<Scenario | null>(null);
const industryName = ref('');
const professionName = ref('');
const currentUserId = computed(() => authStore.user?.id || '');

const core = useScenarioTasks<Scenario>({
  scenarioId,
  scenario: existingScenario,
  routes: { list: '/scene/scenarios', prev: `/scene/scenarios/${scenarioId}/edit` },
  matchCloneTab: (t, tab) => {
    if (tab === 'my') return t.scenarioCreatorId === currentUserId.value;
    if (tab === 'collab')
      return Array.isArray(t.scenarioCoBuilderIds) && t.scenarioCoBuilderIds.includes(currentUserId.value);
    if (tab === 'public') return t.scenarioStatus === 'published' && t.scenarioCreatorId !== currentUserId.value;
    return true;
  },
  fetchKnowledgePoints: () => fetchAllPages((params) => knowledgeApi.list(params)),
  fetchAbilityPoints: () => fetchAllPages((params) => abilityApi.list(params)),
  fetchAbilityBindings: async (pid) => (await abilityApi.listBindings({ careerPositionId: pid })).items || [],
  fetchResources: () =>
    fetchAllPages((params) =>
      request<ListResponse<any>>(`/library/resources${buildQuery({ limit: params.limit, offset: params.offset })}`)
    ),
  fetchClonePool: async () => {
    const [scRes, tRes] = await Promise.all([
      request<ListResponse<any>>(`/scene/scenarios${buildQuery({ limit: 1000 })}`),
      request<ListResponse<any>>(`/scene/tasks${buildQuery({ limit: 1000 })}`)
    ]);
    return { scenarios: scRes.items || [], tasks: tRes.items || [] };
  },
  weightsUrl: () => `/scene/weights${buildQuery({ scenarioId })}`,
  evalMethodsUrl: (tid) => `/scene/tasks/${tid}/evaluation-methods`,
  createTaskUrl: () => `/scene/tasks`,
  updateTaskUrl: (tid) => `/scene/tasks/${tid}`,
  deleteTaskUrl: (tid) => `/scene/tasks/${tid}`,
  reorderTasks: (taskIds) => {
    request(`/scene/tasks/reorder`, {
      method: 'POST',
      body: JSON.stringify({ scenarioId, taskIds })
    }).catch((err) => {
      console.error('保存任务排序失败', err);
      ElMessage.error('排序保存失败，请刷新重试');
    });
  },
  persistWeights: async (taskList, states) => {
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
  },
  onWeightsPersistFailed: (failed) => ElMessage.error(`${failed} 个任务权重保存失败，请重试`),
  // 保留既有任务已配置的权重，仅给新任务分配剩余权重（不覆盖既有配置）
  newTaskWeight: (states, taskCount) => {
    const used = Object.values(states).reduce((sum, s) => sum + (s.weight || 0), 0);
    const remaining = Math.max(0, 100 - used);
    return taskCount === 1 ? 100 : Math.min(remaining, 100);
  },
  // 权重：保留既有任务已配置的权重，仅在新克隆任务间均分剩余权重（对齐新增任务口径）
  cloneTaskWeight: ({ index, selectedCount }, states) => {
    const usedWeight = Object.values(states).reduce((sum, s) => sum + (s.weight || 0), 0);
    const remainingWeight = Math.max(0, 100 - usedWeight);
    return selectedCount > 0
      ? Math.floor(remainingWeight / selectedCount) + (index < remainingWeight % selectedCount ? 1 : 0)
      : 0;
  },
  onCloned: (count, mode) => ElMessage.success(`已${mode === 'clone' ? '克隆' : '引用'} ${count} 个任务`),
  prepareStatesForSave,
  afterTasksSaved: async () => {
    if (existingScenario.value?.status !== 'draft') {
      await scenarioApi.saveDraft(scenarioId);
      existingScenario.value = existingScenario.value
        ? { ...existingScenario.value, status: 'draft' as any }
        : existingScenario.value;
      return '场景已退回草稿状态';
    }
    return undefined;
  },
  saveSuccessMessage: '草稿已保存',
  finishSuccessMessage: '配置已保存'
});

const {
  positionName,
  loadFailed,
  isSaving,
  tasks,
  taskStates,
  positionId,
  knowledgePoints,
  abilityPoints,
  learningResources,
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
  deleteConfirmOpen,
  isCloneOpen,
  cloneMode,
  cloneSearch,
  cloneTab,
  selectedClone,
  isCloning,
  isWeightConfigOpen,
  pieColors,
  currentTask,
  currentState,
  totalWeight,
  cardDialogTitle,
  cardDialogWidth,
  cardDialogTop,
  knowledgePool,
  resourcePool,
  relatedAbilities,
  filteredCloneTasks,
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
  onDrop,
  persistWeights,
  handleSaveDraft,
  handleFinish,
  openCard,
  selectedKnowledgeItems,
  onKnowledgeChange,
  onResourceUpload,
  onResourcesChange,
  onEvalMethodsChange,
  handleCardSave,
  toggleCloneSelect,
  openClone,
  handleClone,
  onWeightChange,
  toggleLock,
  distributeWeights
} = core;

// 评价规则编辑器与 React 一致：95vw 宽 + 内容区固定高度独立滚动，整体约 95vh
const cardDialogBodyStyle = computed(() =>
  editingCard.value?.type === 'evaluationRules'
    ? { height: 'calc(95vh - 172px)', maxHeight: 'none' }
    : undefined
);

/* ============ 保存前：落库自定义实体并替换临时 ID ============ */

async function prepareStatesForSave(states: Record<string, TaskState>): Promise<Record<string, TaskState>> {
  // ===== 兜底：409 时按名称查后端复用已有记录 =====
  const findExistingKnowledgePointByName = async (name: string): Promise<KnowledgePointItem | undefined> => {
    try {
      const res = await knowledgeApi.list({ search: name, limit: 10 });
      const found = (res.items || []).find((k) => k.name === name);
      if (found) {
        return {
          id: found.id,
          name: found.name,
          code: found.code,
          description: found.description,
          linked: found.linked ?? false,
          granularLessons: found.granularLessonIds || []
        };
      }
    } catch {
      /* ignore */
    }
    return undefined;
  };
  const findExistingAbilityByName = async (name: string) => {
    try {
      const res = await abilityApi.list({ search: name, limit: 10 } as any);
      return (res.items || []).find((a) => (a as { name: string }).name === name) as
        | { id: string; name: string }
        | undefined;
    } catch {
      return undefined;
    }
  };
  const findExistingResourceByName = async (name: string): Promise<ResourceItem | undefined> => {
    try {
      const res = await resourceLibraryApi.list({ search: name, limit: 10 });
      const found = (res.items || []).find((r) => r.name === name);
      if (found) {
        return {
          id: found.id,
          name: found.name,
          type: found.resourceType || 'other',
          url: found.url,
          description: found.description,
          size: found.fileSize !== undefined ? String(found.fileSize) : undefined
        };
      }
    } catch {
      /* ignore */
    }
    return undefined;
  };

  // ===== 持久化自定义知识点并映射临时 ID =====
  const kpIdMapping: Record<string, string> = {};
  const failedCreateIds: string[] = [];
  let nextKnowledgePoints = [...knowledgePoints.value];
  const nextCustomKnowledgePointIds = new Set(customKnowledgePointIds.value);
  for (const kpId of Array.from(customKnowledgePointIds.value)) {
    const kp = nextKnowledgePoints.find((k) => k.id === kpId);
    if (!kp) continue;
    try {
      if (persistedCustomKnowledgePointIds.value.has(kpId)) {
        // 已持久化：更新而非重建
        const updated = await knowledgeApi.update(kpId, {
          name: kp.name,
          code: kp.code,
          description: kp.description,
          linked: kp.linked ?? false,
          granularLessonIds: kp.granularLessons || []
        });
        const idx = nextKnowledgePoints.findIndex((k) => k.id === kpId);
        if (idx >= 0) {
          nextKnowledgePoints[idx] = {
            ...nextKnowledgePoints[idx],
            granularLessons: updated.granularLessonIds || nextKnowledgePoints[idx].granularLessons || []
          };
        }
      } else {
        // 租户内知识点名称唯一：同名已存在时直接复用，避免创建 409 导致任务丢失知识点
        let targetId = '';
        const nameCollision = nextKnowledgePoints.find((k) => k.id !== kpId && k.name === kp.name);
        if (nameCollision) {
          targetId = nameCollision.id;
        } else {
          try {
            const created = await knowledgeApi.create({
              name: kp.name,
              code: kp.code,
              description: kp.description,
              linked: false,
              granularLessonIds: kp.granularLessons || []
            } as any);
            targetId = created.id;
          } catch (err) {
            let existing = nextKnowledgePoints.find((k) => k.id !== kpId && k.name === kp.name);
            if (!existing && String((err as Error).message || '').includes('已存在')) {
              existing = await findExistingKnowledgePointByName(kp.name);
              if (existing) nextKnowledgePoints.push(existing);
            }
            if (existing && String((err as Error).message || '').includes('已存在')) {
              targetId = existing.id;
            }
          }
        }
        if (!targetId) {
          failedCreateIds.push(kpId);
          continue;
        }
        kpIdMapping[kpId] = targetId;
        const idx = nextKnowledgePoints.findIndex((k) => k.id === kpId);
        if (idx >= 0) {
          nextKnowledgePoints[idx] = { ...nextKnowledgePoints[idx], id: targetId };
        }
        nextCustomKnowledgePointIds.delete(kpId);
        nextCustomKnowledgePointIds.add(targetId);
        persistedCustomKnowledgePointIds.value.add(targetId);
      }
    } catch {
      failedCreateIds.push(kpId);
    }
  }
  knowledgePoints.value = nextKnowledgePoints;
  customKnowledgePointIds.value = nextCustomKnowledgePointIds;
  if (failedCreateIds.length > 0) {
    ElMessage.error(`${failedCreateIds.length} 个知识点未能创建，将从任务中移除`);
  }

  // ===== 持久化自定义能力点并映射临时 ID（当前页面不直接新建能力点，通常为空） =====
  const abIdMapping: Record<string, string> = {};
  const failedAbilityIds: string[] = [];
  let nextAbilityPoints = [...abilityPoints.value];
  for (const abId of Array.from(customAbilityPointIds.value)) {
    const ap = nextAbilityPoints.find((a) => (a as { id: string }).id === abId);
    if (!ap) continue;
    let targetId = '';
    const nameCollision = nextAbilityPoints.find(
      (a) =>
        (a as { id: string }).id !== abId &&
        (a as { name: string }).name === (ap as { name: string }).name
    );
    if (nameCollision) {
      targetId = (nameCollision as { id: string }).id;
    } else {
      try {
        const created = await abilityApi.create({
          name: (ap as { name: string }).name,
          description: (ap as { description?: string }).description
        } as any);
        targetId = created.id;
      } catch (err) {
        let existing = nextAbilityPoints.find(
          (a) =>
            (a as { id: string }).id !== abId &&
            (a as { name: string }).name === (ap as { name: string }).name
        );
        if (!existing && String((err as Error).message || '').includes('已存在')) {
          existing = await findExistingAbilityByName((ap as { name: string }).name);
          if (existing) nextAbilityPoints.push(existing);
        }
        if (existing && String((err as Error).message || '').includes('已存在')) {
          targetId = (existing as { id: string }).id;
        }
      }
    }
    if (!targetId) {
      failedAbilityIds.push(abId);
      continue;
    }
    abIdMapping[abId] = targetId;
    const idx = nextAbilityPoints.findIndex((a) => (a as { id: string }).id === abId);
    if (idx >= 0) nextAbilityPoints[idx] = { ...nextAbilityPoints[idx], id: targetId };
    customAbilityPointIds.value.delete(abId);
  }
  abilityPoints.value = nextAbilityPoints;
  if (failedAbilityIds.length > 0) {
    ElMessage.error(`${failedAbilityIds.length} 个能力点未能创建，将从任务中移除`);
  }

  // ===== 持久化自定义资源并映射临时 ID =====
  const resourceIdMapping: Record<string, string> = {};
  const failedResourceIds: string[] = [];
  let nextLearningResources = [...learningResources.value];
  const nextCustomResourceIds = new Set(customResourceIds.value);
  for (const resId of Array.from(customResourceIds.value)) {
    const res = nextLearningResources.find((r) => r.id === resId);
    if (!res) continue;
    if (!resId.startsWith('res-')) {
      // 已持久化的库资源 ID：直接映射自身，避免重复创建导致任务引用错位而丢失
      resourceIdMapping[resId] = resId;
      nextCustomResourceIds.delete(resId);
      continue;
    }
    let targetId = '';
    try {
      const created = await resourceLibraryApi.create({
        name: res.name,
        resourceType: (res.type || 'other') as any,
        url: res.url,
        description: res.description,
        fileSize: res.size != null ? Number(res.size) || undefined : undefined
      } as any);
      targetId = created.id;
    } catch (err) {
      if (String((err as Error).message || '').includes('已存在')) {
        const existing =
          nextLearningResources.find((r) => r.id !== resId && r.name === res.name) ||
          (await findExistingResourceByName(res.name));
        if (existing) {
          targetId = existing.id;
          nextLearningResources.push(existing);
        }
      }
    }
    if (!targetId) {
      failedResourceIds.push(resId);
      continue;
    }
    resourceIdMapping[resId] = targetId;
    const idx = nextLearningResources.findIndex((r) => r.id === resId);
    if (idx >= 0) nextLearningResources[idx] = { ...nextLearningResources[idx], id: targetId };
    nextCustomResourceIds.delete(resId);
  }
  learningResources.value = nextLearningResources;
  customResourceIds.value = nextCustomResourceIds;
  if (failedResourceIds.length > 0) {
    ElMessage.error(`${failedResourceIds.length} 个资源未能创建，将从任务中移除`);
  }

  // ===== 用持久化后的真实 ID 替换任务状态中的临时 ID =====
  const replaceIds = (ids: string[]) =>
    ids
      .map((id) => kpIdMapping[id] || abIdMapping[id] || resourceIdMapping[id] || id)
      .filter(
        (id) =>
          !id.startsWith('kp-custom-') &&
          !id.startsWith('ab-custom-') &&
          !failedResourceIds.includes(id)
      );
  const replaceEvalPoints = (points: EvalPoint[]) =>
    points.map((p) => ({
      ...p,
      knowledgePointIds: p.knowledgePointIds ? replaceIds(p.knowledgePointIds) : p.knowledgePointIds,
      abilityPointIds: p.abilityPointIds ? replaceIds(p.abilityPointIds) : p.abilityPointIds
    }));

  const updatedTaskStates: Record<string, TaskState> = states;
  Object.keys(updatedTaskStates).forEach((tid) => {
    const s = updatedTaskStates[tid];
    updatedTaskStates[tid] = {
      ...s,
      knowledgePoints: replaceIds(s.knowledgePoints),
      abilityPoints: replaceIds(s.abilityPoints),
      resources: replaceIds(s.resources),
      randomDrawEvalPoints: replaceEvalPoints(s.randomDrawEvalPoints),
      reviewEvalPoints: replaceEvalPoints(s.reviewEvalPoints),
      paperEvalPoints: replaceEvalPoints(s.paperEvalPoints),
      questionBankEvalPoints: replaceEvalPoints(s.questionBankEvalPoints),
      outcomeEvalPoints: replaceEvalPoints(s.outcomeEvalPoints),
      homeworkEvalPoints: replaceEvalPoints(s.homeworkEvalPoints),
      quizEvalPoints: replaceEvalPoints(s.quizEvalPoints)
    };
  });
  return updatedTaskStates;
}

/* ============ 评价标准即时保存（EvaluationRulesEditor 回调） ============ */

/**
 * 评价标准表单「保存」：把当前方法的评价标准立即落库到当前任务 × 当前测评方式。
 * 与 React tasks/page.tsx handlePersistStandard 等价（先把配置合入任务状态，再走
 * saveMethodsWithRetry 保存全量测评方式，最后回写乐观锁版本号）。
 */
async function handlePersistStandard(_methodKey: string, next: EvalRuleConfig) {
  const taskId = editingCard.value?.taskId;
  if (!taskId) return;
  const state = getState(taskId);
  const updates = evalRuleConfigToTaskStateUpdates(next);
  const methodsInput = taskStateToMethodsInput({ ...state, ...updates } as TaskState);
  if (methodsInput.length === 0) return;
  const newVersion = await saveMethodsWithRetry(taskId, state.evalMethodVersion, methodsInput);
  updateState(taskId, { ...updates, evalMethodVersion: newVersion });
}

/* ============ 数据加载 ============ */

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

    await initTasks(tasksRes.items || []);
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
      // 评价规则编辑器的量规需要知识点/能力点池（关联考查知识点/能力点、标签名展示）
      else if (type === 'evaluationRules') keys.push('knowledge', 'ability');
      if (keys.length) loadDatasets(keys);
    }
  }
);

/* ============ 权重配置 ============ */

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

<style scoped src="../partner/co-build-scene-tasks/scenario-tasks.css"></style>

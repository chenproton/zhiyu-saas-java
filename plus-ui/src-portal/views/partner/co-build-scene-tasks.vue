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
            <el-tag size="small" type="info">企业共建</el-tag>
            <el-tag v-if="existingScenario" size="small" type="info">{{ contentStatusLabel(existingScenario?.status || '') }}</el-tag>
          </div>
          <div class="scenario-desc">
            {{ positionName || existingScenario?.careerPositionId || '未选择岗位' }}
            <span class="sep">|</span>
            {{ (existingScenario?.industryNames || []).join('、') || '未选择行业' }}
            <span class="sep">|</span>
            {{ (existingScenario?.professionNames || []).join('、') || '未选择专业' }}
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
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, CircleCheck, CircleCheckFilled, Delete, Document, Lock, Medal, Rank, ScaleToOriginal, Unlock } from '@element-plus/icons-vue';
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { contentStatusLabel } from '@/types/content-status';
import {
  cardConfigs,
  taskStateToEvalRuleConfig,
  evalRuleConfigToTaskStateUpdates
} from './co-build-scene-tasks/tasks-logic';
import TaskInfoCard from './co-build-scene-tasks/TaskInfoCard.vue';
import EvalMethodSelector from './co-build-scene-tasks/EvalMethodSelector.vue';
import KnowledgeSelector from './co-build-scene-tasks/KnowledgeSelector.vue';
import AbilitySelector from './co-build-scene-tasks/AbilitySelector.vue';
import ResourceSelector from './co-build-scene-tasks/ResourceSelector.vue';
import DescriptionEditor from '../lesson/description-editor.vue';
import EvalMethodConfig from '../lesson/eval-method-config.vue';
import { useScenarioTasks, type ApiTask } from './co-build-scene-tasks/use-scenario-tasks';

const route = useRoute();
const scenarioId = route.params.id as string;

interface CoBuildScenarioDetail {
  id: string;
  name?: string;
  status?: string;
  difficulty?: number;
  version?: string;
  background?: string;
  careerPositionId?: string;
  industryNames?: string[];
  professionNames?: string[];
  schoolTenantId?: string;
  tenantId?: string;
}

const existingScenario = ref<CoBuildScenarioDetail | null>(null);

const schoolTenantId = computed(
  () => existingScenario.value?.schoolTenantId || existingScenario.value?.tenantId || ''
);

const core = useScenarioTasks<CoBuildScenarioDetail>({
  scenarioId,
  scenario: existingScenario,
  routes: { list: '/partner/co-build-scenarios', prev: `/partner/co-build/scenes/${scenarioId}/edit` },
  matchCloneTab: (t, tab) => (tab === 'public' ? t.scenarioStatus === 'published' : true),
  fetchKnowledgePoints: async () => {
    const tid = schoolTenantId.value;
    if (!tid) return [];
    const res = await request<ListResponse<any>>(
      `/partner/co-build/schools/${tid}/knowledge-points${buildQuery({ limit: 1000 })}`
    );
    return res.items || [];
  },
  fetchAbilityPoints: async () => {
    const tid = schoolTenantId.value;
    if (!tid) return [];
    const res = await request<ListResponse<any>>(
      `/partner/co-build/schools/${tid}/abilities${buildQuery({ limit: 1000 })}`
    );
    return res.items || [];
  },
  fetchAbilityBindings: async (pid) => {
    const res = await request<ListResponse<any>>(
      `/partner/co-build/schools/${schoolTenantId.value}/ability-bindings${buildQuery({ careerPositionId: pid, limit: 1000 })}`
    );
    return res.items || [];
  },
  fetchResources: async () => {
    const tid = schoolTenantId.value;
    if (!tid) return [];
    const res = await request<ListResponse<any>>(
      `/partner/co-build/schools/${tid}/resources${buildQuery({ limit: 1000 })}`
    );
    return res.items || [];
  },
  fetchClonePool: async () => {
    const tid = schoolTenantId.value;
    if (!tid) return { scenarios: [], tasks: [] };
    const [scRes, tRes] = await Promise.all([
      request<ListResponse<any>>(`/partner/co-build/schools/${tid}/scenarios${buildQuery({ limit: 1000 })}`),
      request<ListResponse<any>>(`/partner/co-build/schools/${tid}/tasks${buildQuery({ limit: 1000 })}`)
    ]);
    return { scenarios: scRes.items || [], tasks: tRes.items || [] };
  },
  weightsUrl: () => `/partner/co-build/scenes/${scenarioId}/weights`,
  evalMethodsUrl: (tid) => `/partner/co-build/tasks/${tid}/evaluation-methods`,
  createTaskUrl: () => `/partner/co-build/scenes/${scenarioId}/tasks`,
  updateTaskUrl: (tid) => `/partner/co-build/tasks/${tid}`,
  deleteTaskUrl: (tid) => `/partner/co-build/tasks/${tid}`,
  reorderTasks: (taskIds) => {
    request(`/partner/co-build/scenes/${scenarioId}/tasks/reorder`, {
      method: 'POST',
      body: JSON.stringify({ taskIds })
    }).catch((err) => console.error('保存任务排序失败', err));
  },
  persistWeights: async (taskList, states) => {
    const weights: { taskId: string; weight: number }[] = [];
    for (const t of taskList) {
      if (t.id.startsWith('task-')) continue;
      const st = states[t.id];
      if (!st) continue;
      weights.push({ taskId: t.id, weight: st.weight ?? 0 });
    }
    if (weights.length === 0) return 0;
    try {
      await request(`/partner/co-build/scenes/${scenarioId}/weights`, {
        method: 'PUT',
        body: JSON.stringify({ weights })
      });
      return 0;
    } catch (err) {
      console.error('保存任务权重失败', err);
      return weights.length;
    }
  },
  newTaskWeight: (_states, _taskCount, defaultWeight) => defaultWeight,
  cloneTaskWeight: ({ index, selectedCount, existingCount }) => {
    const count = existingCount + selectedCount;
    return count > 0 ? Math.floor(100 / count) + (existingCount + index < 100 % count ? 1 : 0) : 0;
  },
  // 对齐 React：评价规则保存先落内存（资源配置 + 评审步骤），保存失败时也保留本次编辑
  optimisticRulesUpdate: true,
  saveSuccessMessage: '已保存',
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
  updateState,
  getSummary,
  isConfigured,
  goList,
  goPrev,
  reload,
  loadDatasets,
  initTasks,
  handleAddTask,
  confirmDeleteTask,
  onDrop,
  persistWeights,
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
  onWeightChange,
  toggleLock,
  distributeWeights
} = core;

/* ============ 数据加载 ============ */

async function loadAll() {
  try {
    const scenarioData = (await request<CoBuildScenarioDetail>(
      `/partner/co-build/scenes/${scenarioId}`
    )) as CoBuildScenarioDetail;
    const tid = scenarioData.schoolTenantId || scenarioData.tenantId || '';

    const [tasksRes, posRes] = await Promise.all([
      request<ListResponse<ApiTask>>(`/partner/co-build/scenes/${scenarioId}/tasks`),
      tid
        ? request<ListResponse<{ id: string; name: string }>>(
            `/partner/co-build/positions${buildQuery({ schoolTenantId: tid, limit: 200 })}`
          )
        : Promise.resolve({ items: [] as { id: string; name: string }[], total: 0 })
    ]);

    existingScenario.value = scenarioData;
    positionName.value = posRes.items.find((p) => p.id === scenarioData.careerPositionId)?.name || '';

    await initTasks(tasksRes.items || []);
  } catch (err) {
    loadFailed.value = true;
    ElMessage.error((err as Error).message || '任务数据加载失败，请刷新页面重试');
  }
}

onMounted(loadAll);

watch(
  schoolTenantId,
  (tid) => {
    if (tid) loadDatasets(['knowledge', 'ability', 'resources']);
  },
  { immediate: true }
);

watch(
  isCloneOpen,
  (open) => {
    if (open && schoolTenantId.value) loadDatasets(['clone']);
  }
);

// 对齐 React WeightConfigDialog.onOpenChange(false)：权重弹窗关闭（保存/X/ESC 均走此）时持久化权重
watch(isWeightConfigOpen, (open) => {
  if (!open) void persistWeights(tasks.value, taskStates.value);
});

/* ============ 权重配置 ============ */

function openWeight() {
  // 对齐 React「配置权重」按钮：打开前先快照持久化当前权重，避免未保存的权重编辑被带入弹窗
  if (!isWeightConfigOpen.value) {
    void persistWeights(tasks.value, taskStates.value);
  }
  isWeightConfigOpen.value = true;
}

function closeWeight() {
  // 持久化由 watch(isWeightConfigOpen) 统一处理，避免重复提交
  isWeightConfigOpen.value = false;
}
</script>

<style scoped src="./co-build-scene-tasks/scenario-tasks.css"></style>

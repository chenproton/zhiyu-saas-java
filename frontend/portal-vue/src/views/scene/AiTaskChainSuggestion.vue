<template>
  <!-- AI 任务链结构建议（对齐 React scene/scenarios/[id]/edit/tasks/_components/ai-task-chain-suggestion.tsx）
       意图输入 → 建议面板勾选 → 采纳创建；追加/覆盖模式；未配置 412 引导 -->
  <el-button
    size="small"
    class="task-chain-btn"
    :disabled="disabled || pipeline.isRunning.value"
    @click="openSuggest"
  >
    <el-icon><MagicStick /></el-icon>
    AI 建议任务链
  </el-button>

  <!-- 生成模式选择弹窗（已有任务链时选择追加/覆盖） -->
  <el-dialog v-model="modeOpen" width="560px" top="8vh" class="ai-dialog">
    <template #header>
      <div class="dialog-header">
        <el-icon class="dialog-header-icon"><MagicStick /></el-icon>
        <span class="dialog-header-title">AI 建议任务链</span>
      </div>
    </template>
    <p class="dialog-desc">检测到当前场景已有「{{ existingTasksPreview }}」任务，请选择生成方式：</p>
    <div class="mode-options">
      <button type="button" class="mode-option recommend" @click="pickMode('append')">
        <div class="mode-option-head">
          <span class="mode-option-title">保留当前已有的任务，往后追加新的任务</span>
          <span class="mode-badge">推荐</span>
        </div>
        <p class="mode-option-desc">系统将保留当前已有的任务，往后追加新的任务（推荐）</p>
      </button>
      <button type="button" class="mode-option" @click="pickMode('overwrite')">
        <div class="mode-option-title">重新生成完整任务链，完全覆盖</div>
        <p class="mode-option-desc">系统将重新思考场景所需完整任务链，将现有任务链完全覆盖</p>
      </button>
    </div>
    <template #footer>
      <el-button @click="modeOpen = false">取消</el-button>
    </template>
  </el-dialog>

  <!-- 意图输入弹窗 -->
  <el-dialog v-model="inputOpen" width="520px" top="8vh" class="ai-dialog">
    <template #header>
      <div class="dialog-header">
        <el-icon class="dialog-header-icon"><MagicStick /></el-icon>
        <span class="dialog-header-title">AI 建议任务链</span>
      </div>
    </template>
    <p class="dialog-desc">请描述您想要的任务链方向和要求，AI 将据此生成建议</p>
    <div class="intent-context">
      <p v-if="scenario.name">场景：{{ scenario.name }}</p>
      <p v-if="scenario.positionName">目标岗位：{{ scenario.positionName }}</p>
      <p v-if="existingTasks.length > 0">现有任务：{{ existingTasks.map((x) => x.name).join('、') }}</p>
    </div>
    <el-form label-position="top">
      <el-form-item label="任务描述及方向">
        <el-input
          v-model="input"
          type="textarea"
          :rows="4"
          resize="none"
          placeholder="例如：希望任务链从基础认知开始，逐步过渡到综合实战，最后以项目答辩收尾..."
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="inputOpen = false">取消</el-button>
      <el-button type="primary" class="ai-primary-btn" :disabled="!input.trim()" @click="startGenerate">
        <el-icon><MagicStick /></el-icon>
        开始生成
      </el-button>
    </template>
  </el-dialog>

  <!-- AI 进度弹窗 -->
  <AiProgressDialog
    :open="pipeline.open.value"
    title="AI 建议任务链"
    description="大模型正在阅读场景信息并设计任务链结构"
    :steps="AI_STEPS"
    :current-step="pipeline.phase.value"
    :progress="pipeline.progress.value"
    @close="pipeline.handleClose"
  />

  <!-- AI 未配置引导弹窗 -->
  <el-dialog v-model="notConfiguredOpen" width="460px">
    <template #header>
      <div class="dialog-header">
        <el-icon class="dialog-header-icon primary"><Setting /></el-icon>
        <span class="dialog-header-title">尚未配置 AI 服务</span>
      </div>
    </template>
    <p class="dialog-desc">请先在 系统管理 &gt; 租户信息 中配置 AI 服务，再使用 AI 辅助编写</p>
    <template #footer>
      <el-button @click="notConfiguredOpen = false">取消</el-button>
    </template>
  </el-dialog>

  <!-- 建议面板：teleport 到父级全宽容器（任务列表标题行下方） -->
  <Teleport :to="panelTarget" :disabled="!panelTarget">
    <div v-if="panelOpen && panelTarget" class="task-chain-panel">
      <div class="panel-head">
        <div class="panel-head-left">
          <el-icon class="sparkle"><MagicStick /></el-icon>
          <span class="panel-title">AI 任务链结构建议</span>
          <span class="panel-hint">
            {{ mode === 'overwrite' ? `AI 重新设计了完整任务链，采纳后将完全覆盖现有 ${existingTasks.length} 个任务` : 'AI 根据场景主题和目标岗位分析了建议的任务链结构' }}
          </span>
        </div>
        <div class="panel-head-right">
          <template v-if="!pipeline.isRunning.value && result">
            <el-button size="small" @click="toggleSelectAll">{{ allSelected ? '取消全选' : '全选' }}</el-button>
            <el-button
              size="small"
              type="primary"
              class="adopt-btn"
              :disabled="selected.size === 0 || adopting"
              @click="handleAdopt"
            >
              <el-icon v-if="adopting" class="is-loading"><Loading /></el-icon>
              <el-icon v-else><Check /></el-icon>
              采纳选中 ({{ selected.size }})
            </el-button>
          </template>
          <el-button link @click="closePanel"><el-icon><Close /></el-icon></el-button>
        </div>
      </div>

      <div class="panel-body">
        <div v-if="pipeline.isRunning.value" class="panel-loading">
          <el-icon class="is-loading" :size="32"><Loading /></el-icon>
          <p>AI 正在分析最佳任务链结构...</p>
        </div>
        <div v-else-if="result" class="panel-result">
          <div class="result-stats">
            <div class="stat">
              <div class="stat-num purple">{{ result.length }}</div>
              <div class="stat-label">建议任务数</div>
            </div>
            <div class="stat-divider" />
            <div class="stat">
              <div class="stat-num blue">{{ assessCount }}</div>
              <div class="stat-label">考核任务</div>
            </div>
            <div class="stat-divider" />
            <div class="stat">
              <div class="stat-num green">{{ trainCount }}</div>
              <div class="stat-label">训练任务</div>
            </div>
          </div>
          <div class="result-cards">
            <div
              v-for="(task, i) in result"
              :key="i"
              class="result-card"
              :class="{ selected: selected.has(i) }"
              @click="toggleSelect(i)"
            >
              <div class="card-check" @click.stop="toggleSelect(i)">
                <el-icon v-if="selected.has(i)" color="#7c3aed"><CircleCheckFilled /></el-icon>
                <span v-else class="check-box" />
              </div>
              <div class="card-title-row">
                <span class="card-idx">{{ i + 1 }}</span>
                <span class="card-name">{{ task.name }}</span>
                <span class="card-type" :class="task.type === 'assessment' ? 'blue' : 'green'">
                  {{ task.type === 'assessment' ? '考核' : '训练' }}
                </span>
              </div>
              <p class="card-desc">{{ task.description }}</p>
              <div class="card-meta">
                <el-rate :model-value="task.difficulty" disabled size="small" />
                <span class="card-hours">{{ task.estimatedHours }} 小时</span>
              </div>
              <div class="card-arrow">
                <el-icon v-if="i < result.length - 1"><ArrowDown /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowDown, Check, CircleCheckFilled, Close, Loading, MagicStick, Setting } from '@element-plus/icons-vue';
import AiProgressDialog from '../job/position-builder/AiProgressDialog.vue';
import { isAiNotConfigured, useAiPipeline } from '../job/position-builder/ai';
import { scenarioAiAssist, type AIScenarioAssistResponse, type AIScenarioTaskChainTask } from './scenario-ai';

export type TaskChainMode = 'append' | 'overwrite';

const props = withDefaults(
  defineProps<{
    scenario: {
      name: string;
      background: string;
      positionName: string;
      industryNames: string[];
      professionNames: string[];
      positionId: string;
    };
    existingTasks: { name: string; type: 'training' | 'assessment'; difficulty: number }[];
    onAdopt: (payload: { tasks: AIScenarioTaskChainTask[]; mode: TaskChainMode }) => Promise<void>;
    disabled?: boolean;
    panelTarget?: HTMLElement | null;
  }>(),
  { disabled: false, panelTarget: null }
);

const AI_STEPS = ['阅读场景信息', '设计任务链结构'];

const mode = ref<TaskChainMode>('append');
const modeOpen = ref(false);
const inputOpen = ref(false);
const input = ref('');
const panelOpen = ref(false);
const result = ref<AIScenarioTaskChainTask[] | null>(null);
const selected = ref<Set<number>>(new Set());
const adopting = ref(false);
const notConfiguredOpen = ref(false);

const existingTasksPreview = computed(() => {
  const names = props.existingTasks.map((x) => x.name);
  if (names.length === 0) return '';
  return (
    names.slice(0, 3).map((n) => `“${n}”`).join('') +
    (names.length > 3 ? `等 ${names.length} 个任务` : '')
  );
});

const assessCount = computed(() => (result.value || []).filter((t) => t.type === 'assessment').length);
const trainCount = computed(() => (result.value || []).filter((t) => t.type === 'training').length);
const allSelected = computed(() => result.value !== null && selected.value.size === result.value.length);

const pipeline = useAiPipeline<undefined, AIScenarioAssistResponse>({
  steps: () => AI_STEPS,
  request: (_task, signal) =>
    scenarioAiAssist(
      {
        field: 'taskChain',
        scenario: {
          name: props.scenario.name,
          background: props.scenario.background,
          difficulty: 0,
          industryNames: props.scenario.industryNames,
          professionNames: props.scenario.professionNames,
          positionId: props.scenario.positionId,
          positionName: props.scenario.positionName,
          taskName: '',
          taskBackground: '',
          taskDescription: '',
          taskDifficulty: 0,
          // 追加模式携带现有任务供 AI 避开重复；覆盖模式不带，让 AI 重新思考完整任务链
          existingTasks: mode.value === 'append' ? props.existingTasks : [],
          intention: input.value.trim()
        }
      },
      signal
    ),
  onError: (err) => {
    if (isAiNotConfigured(err)) {
      notConfiguredOpen.value = true;
      return true;
    }
    ElMessage.error(err instanceof Error && err.message ? err.message : 'AI 生成失败');
    return true;
  }
});

function openSuggest() {
  input.value = '';
  if (props.existingTasks.length > 0) {
    modeOpen.value = true;
  } else {
    mode.value = 'append';
    inputOpen.value = true;
  }
}

function pickMode(next: TaskChainMode) {
  mode.value = next;
  modeOpen.value = false;
  inputOpen.value = true;
}

function startGenerate() {
  if (!input.value.trim()) return;
  inputOpen.value = false;
  panelOpen.value = true;
  result.value = null;
  selected.value = new Set();
  void pipeline
    .run([
      {
        id: 'taskChain',
        meta: undefined,
        apply: (res) => {
          const tasks = res.chain?.tasks || [];
          if (tasks.length === 0) return;
          result.value = tasks;
          selected.value = new Set(tasks.map((_, i) => i));
        }
      }
    ])
    .then((r) => {
      if (r.success === 0) panelOpen.value = false;
    });
}

function toggleSelect(i: number) {
  const next = new Set(selected.value);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  selected.value = next;
}

function toggleSelectAll() {
  if (!result.value) return;
  selected.value = allSelected.value ? new Set() : new Set(result.value.map((_, i) => i));
}

async function handleAdopt() {
  if (!result.value || selected.value.size === 0 || adopting.value) return;
  const chosen = result.value.filter((_, i) => selected.value.has(i));
  adopting.value = true;
  try {
    await props.onAdopt({ tasks: chosen, mode: mode.value });
    panelOpen.value = false;
    result.value = null;
    selected.value = new Set();
    input.value = '';
  } finally {
    adopting.value = false;
  }
}

function closePanel() {
  pipeline.cancel();
  panelOpen.value = false;
}
</script>

<style scoped>
.task-chain-btn {
  border-color: #e0cffc;
  color: #7e22ce;
  background: #fff;
}
.task-chain-btn:hover {
  border-color: #c4b5fd;
  color: #6b21a8;
  background: #faf5ff;
}
.dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dialog-header-icon {
  color: #7c3aed;
}
.dialog-header-icon.primary {
  color: #409eff;
}
.dialog-header-title {
  font-size: 16px;
  font-weight: 600;
}
.dialog-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
}
.ai-primary-btn {
  background: #7c3aed;
  border-color: #7c3aed;
}
.mode-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mode-option {
  width: 100%;
  text-align: left;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s;
  font-size: 13px;
  color: #303133;
}
.mode-option:hover {
  border-color: #c4b5fd;
  background: #faf5ff;
}
.mode-option.recommend {
  border-color: #e0cffc;
  background: #faf5ff;
}
.mode-option-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mode-option-title {
  font-weight: 500;
}
.mode-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #ede9fe;
  color: #7c3aed;
}
.mode-option-desc {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
}
.intent-context {
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #909399;
}
.intent-context p {
  margin: 2px 0;
}
.task-chain-panel {
  margin: 0 0 16px;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  background: #faf5ff;
}
.panel-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}
.panel-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.sparkle {
  color: #7c3aed;
}
.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.panel-hint {
  font-size: 12px;
  color: #909399;
}
.adopt-btn {
  background: #7c3aed;
  border-color: #7c3aed;
}
.panel-body {
  padding: 16px;
}
.panel-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
  color: #7c3aed;
}
.panel-loading p {
  margin: 0;
  color: #909399;
}
.result-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #faf5ff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}
.stat {
  text-align: center;
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
}
.stat-num.purple { color: #7c3aed; }
.stat-num.blue { color: #2563eb; }
.stat-num.green { color: #16a34a; }
.stat-label {
  font-size: 12px;
  color: #909399;
}
.stat-divider {
  width: 1px;
  height: 40px;
  background: #e0cffc;
}
.result-cards {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.result-card {
  position: relative;
  flex-shrink: 0;
  width: 224px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  background: #fafafa;
  transition: all 0.2s;
}
.result-card:hover {
  border-color: #c4b5fd;
}
.result-card.selected {
  border-color: #c4b5fd;
  background: #faf5ff;
}
.card-check {
  position: absolute;
  top: 8px;
  left: 8px;
}
.check-box {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
}
.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px 24px;
}
.card-idx {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.card-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-type {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}
.card-type.blue {
  background: #eff6ff;
  color: #2563eb;
}
.card-type.green {
  background: #f0fdf4;
  color: #16a34a;
}
.card-desc {
  font-size: 12px;
  color: #606266;
  margin: 0 0 8px 24px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-left: 24px;
}
.card-hours {
  font-size: 12px;
  color: #c0c4cc;
}
.card-arrow {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  color: #c4b5fd;
}
</style>
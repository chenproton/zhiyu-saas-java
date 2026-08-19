<template>
  <!-- 步骤三：能力模型汇总（逐项对齐 React components/job/position-builder/ai-assisted-2/step3-result-table.tsx） -->
  <div class="result-wrap">
    <!-- AI 填充完成后的撤销条（等价 React toast + ToastAction「10 秒内可撤销」） -->
    <div v-if="undoTip" class="undo-banner">
      <span>{{ undoTip }}，10 秒内可撤销</span>
      <el-button size="small" plain class="ai-btn" @click="undoAiFill">
        <el-icon><RefreshLeft /></el-icon>
        撤销
      </el-button>
    </div>

    <div class="stats-row">
      <div class="stats-grid">
        <el-card shadow="never" class="stat-card">
          <p class="stat-label">工作职责</p>
          <p class="stat-value">{{ position.responsibilities.length }}</p>
        </el-card>
        <el-card shadow="never" class="stat-card">
          <p class="stat-label">能力点</p>
          <p class="stat-value">{{ bindings.length }}</p>
        </el-card>
        <el-card shadow="never" class="stat-card">
          <p class="stat-label">能力域</p>
          <p class="stat-value">{{ domainCount }}</p>
        </el-card>
      </div>
      <div class="stats-action">
        <el-button
          size="small"
          plain
          class="ai-btn"
          :disabled="pipeline.isRunning.value || bindings.length === 0"
          @click="confirmAiOpen = true"
        >
          <el-icon :class="{ 'is-loading': pipeline.isRunning.value }"><MagicStick /></el-icon>
          {{ pipeline.isRunning.value ? 'AI 填充中...' : 'AI 辅助编写' }}
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="table-card">
      <template #header><span class="card-title">能力模型明细表</span></template>
      <el-empty
        v-if="bindings.length === 0"
        description="暂无能力点数据，请返回步骤二进行拆解"
        :image-size="80"
      />
      <el-table v-else :data="rows" row-key="key" border :span-method="spanMethod" class="detail-table">
        <el-table-column label="所属能力领域" width="140">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.domainLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="能力点名称" min-width="150">
          <template #default="{ row }">
            <span class="cell-name">{{ row.binding.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="能力属性" width="120">
          <template #default="{ row }">
            <span class="cell-dim">{{ (row.binding.attributes || []).join('、') || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="能力领域" width="170">
          <template #default="{ row }">
            <el-select
              :model-value="row.binding.domain || ''"
              size="small"
              clearable
              placeholder="选择领域"
              style="width: 100%"
              @update:model-value="(v: string) => updateBinding(row.binding.id, { domain: v || undefined })"
            >
              <el-option v-for="d in ABILITY_DOMAINS" :key="d.value" :label="d.value" :value="d.value">
                <span>{{ d.value }}（{{ d.hint }}）</span>
              </el-option>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="掌握程度" width="130">
          <template #default="{ row }">
            <el-select
              :model-value="row.binding.level"
              size="small"
              placeholder="请选择"
              style="width: 100%"
              @update:model-value="(v: CompetencyLevel) => updateBinding(row.binding.id, { level: v })"
            >
              <el-option v-for="l in COMPETENCY_LEVELS" :key="l.value" :label="l.label" :value="l.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="胜任标准描述" min-width="260">
          <template #default="{ row }">
            <el-input
              :model-value="row.binding.rubricDescription"
              size="small"
              placeholder="请输入胜任标准描述..."
              @update:model-value="(v: string) => updateBinding(row.binding.id, { rubricDescription: v })"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- AI 填充意图确认 -->
    <el-dialog v-model="confirmAiOpen" title="确认 AI 填充掌握标准？" width="520px">
      <p class="dialog-desc">
        AI 将为 {{ bindings.length }} 个能力点生成掌握程度与胜任标准描述并直接写入表格，可一键撤销。
      </p>
      <template #footer>
        <el-button @click="confirmAiOpen = false">取消</el-button>
        <el-button type="primary" class="ai-primary" @click="runAiFill">
          <el-icon><MagicStick /></el-icon>
          确认生成
        </el-button>
      </template>
    </el-dialog>

    <!-- AI 填充进度 -->
    <AiProgressDialog
      :open="pipeline.open.value"
      title="AI 辅助填充"
      description="大模型正在为能力点生成掌握程度与胜任标准"
      :steps="AI_STEPS"
      :current-step="pipeline.phase.value"
      :progress="pipeline.progress.value"
      @close="pipeline.handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { MagicStick, RefreshLeft } from '@element-plus/icons-vue';
import AiProgressDialog from './AiProgressDialog.vue';
import {
  isAiNotConfigured,
  positionAiAssist,
  useAiPipeline,
  type AIPositionAssistResponse
} from './ai';
import {
  ABILITY_DOMAINS,
  COMPETENCY_LEVELS,
  normalizeLevel,
  type CompetencyLevel,
  type LocalAbilityBinding,
  type LocalPosition
} from './types';

const AI_STEPS = ['分析能力点特征', '生成掌握程度与胜任标准'];

interface TableRow {
  key: string;
  domainLabel: string;
  span: number;
  binding: LocalAbilityBinding;
}

const props = defineProps<{ position: LocalPosition }>();
const emit = defineEmits<{ (e: 'update', data: Partial<LocalPosition>): void }>();

const confirmAiOpen = ref(false);
const undoTip = ref('');
let undoSnapshot: LocalAbilityBinding[] | null = null;
let undoTimer: ReturnType<typeof setTimeout> | null = null;

const bindings = computed(() => props.position.abilityBindings);

/** 按能力域分组后的扁平行（首行承载 rowSpan，对齐 React rowSpan 合并单元格） */
const rows = computed<TableRow[]>(() => {
  const groups = new Map<string, LocalAbilityBinding[]>();
  for (const b of bindings.value) {
    const key = b.domain || '未分类';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  const list: TableRow[] = [];
  for (const [domainLabel, group] of groups) {
    group.forEach((binding, idx) => {
      list.push({
        key: `${domainLabel}-${binding.id}`,
        domainLabel,
        span: idx === 0 ? group.length : 0,
        binding
      });
    });
  }
  return list;
});

const domainCount = computed(
  () =>
    new Set(bindings.value.map((b) => b.domain).filter(Boolean)).size +
    (bindings.value.some((b) => !b.domain) ? 1 : 0)
);

function spanMethod({ row, columnIndex }: { row: TableRow; columnIndex: number }) {
  if (columnIndex !== 0) return { rowspan: 1, colspan: 1 };
  return row.span > 0 ? { rowspan: row.span, colspan: 1 } : { rowspan: 0, colspan: 0 };
}

function updateBinding(bindingId: string, updates: Partial<LocalAbilityBinding>) {
  emit('update', {
    abilityBindings: props.position.abilityBindings.map((b) => (b.id === bindingId ? { ...b, ...updates } : b))
  });
}

const pipeline = useAiPipeline<undefined, AIPositionAssistResponse>({
  steps: () => AI_STEPS,
  request: (_task, signal) =>
    positionAiAssist(
      {
        field: 'competency',
        position: {
          name: props.position.name,
          shortName: props.position.shortName,
          industry: props.position.industry,
          majors: [],
          salaryRange: [props.position.salaryRange[0], props.position.salaryRange[1]],
          description: props.position.description,
          responsibilities: props.position.responsibilities.map((r) => r.name),
          requirements: props.position.requirements,
          careerPath: props.position.careerPath,
          abilities: bindings.value.map((b) => ({
            name: b.name,
            domain: b.domain,
            attributes: b.attributes || [],
            description: b.rubricDescription || ''
          }))
        }
      },
      signal
    ),
  onError: (err) => {
    if (isAiNotConfigured(err)) {
      ElMessage.warning('AI 未配置：请先在「系统管理 > 租户信息」配置 AI 服务后再使用 AI 辅助编写');
      return true;
    }
    ElMessage.error((err as Error).message || 'AI 生成失败');
    return true;
  }
});

/** AI 一键填充：为所有能力点生成掌握程度与胜任标准，直接写入表格 */
function runAiFill() {
  if (bindings.value.length === 0 || pipeline.isRunning.value) return;
  confirmAiOpen.value = false;
  void pipeline.run([
    {
      id: 'competency',
      meta: undefined,
      apply: (res) => {
        const fills = res?.competencies || [];
        if (fills.length === 0) return;
        const byName = new Map(fills.map((f) => [f.name, f]));
        const latest = props.position.abilityBindings;
        const snapshot = latest.map((b) => ({ ...b }));
        let matched = 0;
        const next = latest.map((b) => {
          const fill = byName.get(b.name);
          if (!fill) return b;
          matched++;
          return {
            ...b,
            level: normalizeLevel(fill.level),
            rubricDescription: fill.rubricDescription || b.rubricDescription
          };
        });
        if (matched === 0) return;
        emit('update', { abilityBindings: next });
        undoSnapshot = snapshot;
        showUndoTip(`AI 已填充 ${matched} 个能力点的掌握标准`);
        // AI 改写名称导致无法匹配的条目明确告知，避免静默丢失
        const unmatched = fills.length - matched;
        if (unmatched > 0) {
          ElMessage.info(`${unmatched} 项 AI 结果未匹配到能力点名称，已忽略`);
        }
      }
    }
  ]);
}

function showUndoTip(text: string) {
  undoTip.value = text;
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    undoTip.value = '';
    undoSnapshot = null;
  }, 10_000);
}

function undoAiFill() {
  if (!undoSnapshot) return;
  emit('update', { abilityBindings: undoSnapshot });
  undoSnapshot = null;
  undoTip.value = '';
  if (undoTimer) clearTimeout(undoTimer);
  ElMessage.success('已撤销');
}

onUnmounted(() => {
  if (undoTimer) clearTimeout(undoTimer);
});
</script>

<style scoped>
.result-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.undo-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  border: 1px solid #e0d0ff;
  border-radius: 8px;
  background: #f8f4ff;
  font-size: 13px;
  color: #6d3fc0;
}
.stats-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stats-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.stat-card {
  border-radius: 10px;
  text-align: center;
}
.stat-label {
  margin: 0;
  font-size: 12px;
  color: #909399;
}
.stat-value {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}
.stats-action {
  flex-shrink: 0;
}
.table-card {
  border-radius: 10px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.cell-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.cell-dim {
  font-size: 12px;
  color: #606266;
}
.dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
.ai-btn {
  border-color: #d9c8ff;
  color: #7c3aed;
}
.ai-primary {
  background: #7c3aed;
  border-color: #7c3aed;
}
</style>

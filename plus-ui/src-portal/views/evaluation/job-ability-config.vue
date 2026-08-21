<template>
  <div class="config-page">
    <div class="page-header">
      <div class="header-left">
        <el-button @click="$router.push('/evaluation/job-ability')">返回岗位列表</el-button>
        <h2 class="page-title">{{ positionName || '岗位' }}</h2>
        <el-tag v-if="model?.rule" :type="model.rule.status === 'published' ? 'success' : 'info'">
          {{ statusLabel(model.rule.status) }}
        </el-tag>
      </div>
      <div>
        <el-button :disabled="allPoints.length === 0" @click="pointDialog = true">能力点权重配置</el-button>
        <el-button type="primary" :loading="saving" :disabled="allPoints.length === 0" @click="save">保存权重</el-button>
      </div>
    </div>
    <p class="page-sub">
      能力模型与任务关联来自岗位/场景编辑页，此处仅配置汇聚权重：任务得分按权重汇聚为能力点得分（点内合计 100%），能力点得分按权重汇聚为岗位总评（岗位内合计 100%）。
    </p>

    <el-card shadow="never" v-loading="loading">
      <el-empty v-if="allPoints.length === 0 && !loading" description="该岗位尚未配置能力模型，请先在岗位编辑页配置能力模型与能力域" />
      <el-table v-else :data="allPoints" stripe>
        <el-table-column label="所属能力域" width="140">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.domainName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="能力点名称" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column label="能力点权重" width="110">
          <template #default="{ row }">{{ pointWeights[row.abilityPointId] ?? row.weight }}%</template>
        </el-table-column>
        <el-table-column label="胜任标准" width="110">
          <template #default="{ row }">
            <el-tag size="small">{{ levelLabel(row.requiredLevel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="胜任标准描述" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.rubricDescription || row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="分数来源" min-width="220">
          <template #default="{ row }">
            <template v-if="row.tasks.length === 0">暂无关联任务</template>
            <div v-else v-for="t in row.tasks" :key="t.taskId" class="task-row">
              <span class="task-name" :title="t.taskName">{{ t.taskName }}</span>
              <span class="task-meta" v-if="t.scenarioName" :title="t.scenarioName">{{ t.scenarioName }}</span>
              <span class="task-weight">{{ taskWeights[taskKey(row.abilityPointId, t.taskId)] ?? t.weight }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="right">
          <template #default="{ row }">
            <el-button size="small" @click="openConfig(row)">胜任配置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 能力点权重配置弹窗 -->
    <el-dialog v-model="pointDialog" title="能力点权重配置" width="560px">
      <p class="dialog-desc">配置各能力点得分占岗位总评的权重，岗位内全部能力点合计必须为 100%</p>
      <div v-for="p in allPoints" :key="p.abilityPointId" class="weight-row">
        <span class="weight-name">{{ p.domainName }} · {{ p.name }}</span>
        <el-input-number v-model="pointWeights[p.abilityPointId]" :min="0" :max="100" :step="1" size="small" />
        <span>%</span>
      </div>
      <div class="weight-sum">合计：{{ pointSum }}%</div>
      <template #footer>
        <el-button @click="pointDialog = false">取消</el-button>
        <el-button type="primary" @click="pointDialog = false">确定</el-button>
      </template>
    </el-dialog>

    <!-- 单个能力点胜任配置弹窗 -->
    <el-dialog v-model="configDialog" :title="`胜任配置 · ${configPoint?.name || ''}`" width="600px">
      <div v-if="configPoint">
        <h4 class="section-title">分数来源权重（点内合计 100%）</h4>
        <div v-for="t in configPoint.tasks" :key="t.taskId" class="weight-row">
          <span class="weight-name">{{ t.taskName }}</span>
          <el-input-number v-model="configTaskWeights[t.taskId]" :min="0" :max="100" :step="1" size="small" />
          <span>%</span>
        </div>
        <div v-if="configPoint.tasks.length" class="weight-sum">任务权重合计：{{ configTaskSum }}%</div>

        <h4 class="section-title">胜任标准分档（min/max 分数区间）</h4>
        <div v-for="(m, i) in configLevels" :key="i" class="weight-row">
          <span class="weight-name">{{ m.level }}</span>
          <el-input-number v-model="m.min" :min="0" :max="100" size="small" />
          <span>-</span>
          <el-input-number v-model="m.max" :min="0" :max="100" size="small" />
        </div>
      </div>
      <template #footer>
        <el-button @click="configDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { positionApi } from '@/api/job';
import { certApi } from '@/api/evaluation';
import type { CertificationPositionModel, CertificationModelPoint, LevelMapping } from '@/types/evaluation';

const route = useRoute();
const positionId = String(route.params.id || '');

interface DomainPoint extends CertificationModelPoint {
  domainName: string;
}

const loading = ref(true);
const saving = ref(false);
const positionName = ref('');
const model = ref<CertificationPositionModel | null>(null);
const pointWeights = reactive<Record<string, number>>({});
const taskWeights = reactive<Record<string, number>>({});
const pointDialog = ref(false);
const configDialog = ref(false);
const configPoint = ref<DomainPoint | null>(null);
const configTaskWeights = reactive<Record<string, number>>({});
const configLevels = ref<LevelMapping[]>([]);

const DEFAULT_LEVELS: LevelMapping[] = [
  { level: '不合格', min: 0, max: 60 },
  { level: '了解L1', min: 61, max: 70 },
  { level: '理解L2', min: 71, max: 80 },
  { level: '掌握L3', min: 81, max: 85 },
  { level: '熟练L4', min: 86, max: 95 },
  { level: '精通L5', min: 96, max: 100 }
];

const allPoints = computed<DomainPoint[]>(() =>
  (model.value?.domains ?? []).flatMap((d) => d.points.map((p) => ({ ...p, domainName: d.name })))
);
const pointSum = computed(() => allPoints.value.reduce((s, p) => s + (pointWeights[p.abilityPointId] ?? 0), 0));
const configTaskSum = computed(() =>
  (configPoint.value?.tasks ?? []).reduce((s, t) => s + (configTaskWeights[t.taskId] ?? 0), 0)
);

function taskKey(abilityPointId: string, taskId: string) {
  return `${abilityPointId}:${taskId}`;
}
function statusLabel(s: string) {
  const labels: Record<string, string> = {
    draft: '草稿', not_submitted: '未提交', reviewing: '审批中', rejected: '已驳回',
    ready: '待发布', published: '已发布', none: '无规则'
  };
  return labels[s] || s;
}
function levelLabel(s: string) {
  const labels: Record<string, string> = {
    understand: '了解', comprehend: '理解', master: '掌握', proficient: '熟练', expert: '精通'
  };
  return labels[s] || s;
}

async function load() {
  loading.value = true;
  try {
    const [position, m] = await Promise.all([
      positionApi.get(positionId),
      certApi.getPositionModel(positionId)
    ]);
    positionName.value = position.name;
    model.value = m;
    m.domains.forEach((d) => {
      d.points.forEach((p) => {
        pointWeights[p.abilityPointId] = p.weight;
        p.tasks.forEach((t) => {
          taskWeights[taskKey(p.abilityPointId, t.taskId)] = t.weight;
        });
      });
    });
  } catch (e) {
    ElMessage.error((e as Error).message || '获取岗位能力模型失败');
  } finally {
    loading.value = false;
  }
}

function validateWeights(): string[] {
  const errors: string[] = [];
  if (allPoints.value.length > 0) {
    const sum = allPoints.value.reduce((s, p) => s + (pointWeights[p.abilityPointId] ?? 0), 0);
    if (Math.abs(sum - 100) > 0.01) errors.push(`全部能力点权重合计为 ${sum}%，应为 100%`);
  }
  for (const point of allPoints.value) {
    if (point.tasks.length === 0) continue;
    const sum = point.tasks.reduce((s, t) => s + (taskWeights[taskKey(point.abilityPointId, t.taskId)] ?? 0), 0);
    if (Math.abs(sum - 100) > 0.01) errors.push(`能力点「${point.name}」下任务权重合计为 ${sum}%，应为 100%`);
  }
  return errors;
}

async function save() {
  const errors = validateWeights();
  if (errors.length > 0) {
    ElMessage.warning(errors.join('；'));
    return;
  }
  saving.value = true;
  try {
    await certApi.putPositionWeights(positionId, {
      pointWeights: allPoints.value.map((p) => ({ abilityPointId: p.abilityPointId, weight: pointWeights[p.abilityPointId] ?? p.weight })),
      taskWeights: allPoints.value.flatMap((p) =>
        p.tasks.map((t) => ({ abilityPointId: p.abilityPointId, taskId: t.taskId, weight: taskWeights[taskKey(p.abilityPointId, t.taskId)] ?? t.weight }))
      )
    });
    ElMessage.success('权重配置已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存权重配置失败');
  } finally {
    saving.value = false;
  }
}

function openConfig(point: DomainPoint) {
  configPoint.value = point;
  point.tasks.forEach((t) => {
    configTaskWeights[t.taskId] = taskWeights[taskKey(point.abilityPointId, t.taskId)] ?? t.weight;
  });
  configLevels.value = point.levelMapping && point.levelMapping.length
    ? point.levelMapping.map((m) => ({ ...m }))
    : DEFAULT_LEVELS.map((m) => ({ ...m }));
  configDialog.value = true;
}

async function saveConfig() {
  const point = configPoint.value;
  if (!point) return;
  if (point.tasks.length > 0 && Math.abs(configTaskSum.value - 100) > 0.01) {
    ElMessage.warning('任务权重合计应为 100%');
    return;
  }
  saving.value = true;
  try {
    await certApi.putPointLevels(positionId, point.abilityPointId, configLevels.value);
    point.tasks.forEach((t) => {
      taskWeights[taskKey(point.abilityPointId, t.taskId)] = configTaskWeights[t.taskId];
    });
    // 只保存当前能力点的任务权重（对齐 Go/React putPointTaskWeights 契约），
    // 不再把全部点权重+任务权重塞进 putPositionWeights，避免污染其它能力点
    await certApi.putPointTaskWeights(
      positionId,
      point.abilityPointId,
      point.tasks.map((t) => ({
        abilityPointId: point.abilityPointId,
        taskId: t.taskId,
        weight: configTaskWeights[t.taskId] ?? t.weight
      }))
    );
    configDialog.value = false;
    ElMessage.success('胜任配置已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存胜任配置失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.config-page { padding: 16px; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 0 0 16px; }
.task-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.task-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-meta { color: #909399; font-size: 12px; }
.task-weight { font-weight: 600; color: #409eff; white-space: nowrap; }
.dialog-desc { color: #909399; font-size: 13px; margin: 0 0 12px; }
.weight-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
.weight-name { flex: 1; min-width: 0; }
.weight-sum { margin-top: 8px; font-weight: 600; }
.section-title { font-size: 14px; font-weight: 600; margin: 16px 0 8px; }
</style>

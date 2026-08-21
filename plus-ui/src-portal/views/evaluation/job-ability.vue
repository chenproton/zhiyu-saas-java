<template>
  <div class="list-page">
    <div class="page-header">
      <h2 class="page-title">岗位能力认定规则</h2>
      <p class="page-sub">管理各岗位的能力认定规则配置</p>
    </div>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="6"><div class="stat"><div class="stat-value">{{ stats.total }}</div><div class="stat-label">岗位总数</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value green">{{ stats.published }}</div><div class="stat-label">已发布规则</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value amber">{{ stats.configured }}</div><div class="stat-label">配置中</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value gray">{{ stats.none }}</div><div class="stat-label">无规则</div></div></el-col>
    </el-row>

    <el-card shadow="never">
      <div class="filter-row">
        <el-input v-model="search" placeholder="搜索岗位名称或编码..." clearable style="max-width: 320px" />
      </div>
      <el-table v-loading="loading" :data="filteredPositions" stripe>
        <el-table-column label="岗位名称" min-width="160">
          <template #default="{ row }"><span class="strong">{{ row.name }}</span></template>
        </el-table-column>
        <el-table-column label="岗位编码" prop="code" width="130">
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>
        <el-table-column label="专业方向" min-width="140">
          <template #default="{ row }">{{ (row.majorNames && row.majorNames.length) ? row.majorNames.join('、') : '-' }}</template>
        </el-table-column>
        <el-table-column label="关联能力点数" width="110" align="center">
          <template #default="{ row }">
            {{ pointCountOf(row) }}
          </template>
        </el-table-column>
        <el-table-column label="规则状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(ruleOf(row)?.status)">{{ statusLabel(ruleOf(row)?.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="150">
          <template #default="{ row }">{{ fmtDate(ruleOf(row)?.updatedAt || row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" align="right">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push(`/evaluation/job-ability/config/${row.id}`)">配置认证规则</el-button>
            <el-button size="small" @click="$router.push(`/evaluation/job-ability/results?positionId=${row.id}`)">查看结果</el-button>
            <el-button v-if="ruleOf(row)" size="small" @click="confirmToggle(row)">
              {{ ruleOf(row)?.status === 'published' ? '下线' : '发布' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="toggleDialog" :title="toggleTitle" width="480px">
      <p>{{ toggleDescription }}</p>
      <template #footer>
        <el-button @click="toggleDialog = false">取消</el-button>
        <el-button type="primary" :loading="statusSaving" @click="handleToggle">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { positionApi } from '@/api/job';
import { certApi } from '@/api/evaluation';
import type { CareerPosition } from '@/types/job';
import type { CertificationRule } from '@/types/evaluation';

const positions = ref<CareerPosition[]>([]);
const rules = ref<CertificationRule[]>([]);
const pointCounts = ref<Record<string, number>>({});
const loading = ref(true);
const search = ref('');
const toggleDialog = ref(false);
const statusSaving = ref(false);
const statusTarget = ref<CertificationRule | null>(null);

const ruleMap = computed(() => {
  const m = new Map<string, CertificationRule>();
  rules.value.forEach((r) => m.set(r.careerPositionId, r));
  return m;
});
const filteredPositions = computed(() => {
  const kw = search.value.toLowerCase();
  return positions.value.filter(
    (p) => p.name.toLowerCase().includes(kw) || (p.code || '').toLowerCase().includes(kw)
  );
});
const stats = computed(() => {
  const statuses = positions.value.map((p) => ruleMap.value.get(p.id)?.status ?? 'none');
  return {
    total: positions.value.length,
    published: statuses.filter((s) => s === 'published').length,
    configured: statuses.filter((s) => s !== 'none' && s !== 'published').length,
    none: statuses.filter((s) => s === 'none').length
  };
});

function ruleOf(row: CareerPosition) {
  return ruleMap.value.get(row.id) || null;
}
// 对齐 React：能力点数按「规则 id」取（pointCounts 以 rule.id 为键，非岗位 id）
function pointCountOf(row: CareerPosition): number | string {
  const rule = ruleOf(row);
  if (!rule) return 0;
  return pointCounts.value[rule.id] ?? '-';
}
function statusLabel(s?: string) {
  const labels: Record<string, string> = {
    draft: '草稿', not_submitted: '未提交', reviewing: '审批中', rejected: '已驳回',
    ready: '待发布', published: '已发布', none: '无规则'
  };
  return labels[s || 'none'] || '无规则';
}
function statusType(s?: string) {
  if (s === 'published') return 'success';
  if (s === 'none') return 'info';
  if (s === 'rejected') return 'danger';
  if (s === 'reviewing') return 'warning';
  return 'primary';
}
function fmtDate(d?: string) {
  return d ? String(d).slice(0, 10) : '-';
}

const toggleTitle = computed(() => (statusTarget.value?.status === 'published' ? '下线认证规则' : '发布认证规则'));
const toggleDescription = computed(() =>
  statusTarget.value?.status === 'published'
    ? '下线后该岗位的认证规则不再参与能力汇聚计算，已生成的汇聚结果会保留。确认下线？'
    : '发布后该岗位的认证规则将参与每日定时能力汇聚，也可在结果页手动触发汇聚。确认发布？'
);

async function load() {
  loading.value = true;
  try {
    const [posRes, ruleRes] = await Promise.all([
      positionApi.list({ limit: 1000 }),
      certApi.listRules({ limit: 1000 })
    ]);
    positions.value = posRes.items;
    rules.value = ruleRes.items;

    const positionIds = Array.from(new Set(rules.value.map((r) => r.careerPositionId)));
    const modelResults = await Promise.all(
      positionIds.map(async (positionId) => {
        try {
          const model = await certApi.getPositionModel(positionId);
          return { positionId, count: model.domains.reduce((s, d) => s + d.points.length, 0) };
        } catch {
          return { positionId, count: 0 };
        }
      })
    );
    const counts: Record<string, number> = {};
    const countByPosition = new Map(modelResults.map((m) => [m.positionId, m.count]));
    rules.value.forEach((rule) => {
      counts[rule.id] = countByPosition.get(rule.careerPositionId) ?? 0;
    });
    pointCounts.value = counts;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function confirmToggle(row: CareerPosition) {
  const rule = ruleOf(row);
  if (!rule) return;
  statusTarget.value = rule;
  toggleDialog.value = true;
}
async function handleToggle() {
  const target = statusTarget.value;
  if (!target) return;
  const nextStatus = target.status === 'published' ? 'draft' : 'published';
  statusSaving.value = true;
  try {
    const updated = await certApi.updateRuleStatus(target.id, nextStatus);
    rules.value = rules.value.map((r) => (r.id === updated.id ? updated : r));
    toggleDialog.value = false;
    ElMessage.success(nextStatus === 'published' ? '规则已发布' : '规则已下线');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    statusSaving.value = false;
    statusTarget.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.stats-row { margin-bottom: 16px; }
.stat { background: #fff; border-radius: 8px; padding: 16px; text-align: center; }
.stat-value { font-size: 24px; font-weight: 700; color: #409eff; }
.stat-value.green { color: #67c23a; }
.stat-value.amber { color: #e6a23c; }
.stat-value.gray { color: #909399; }
.stat-label { color: #909399; font-size: 13px; margin-top: 4px; }
.filter-row { margin-bottom: 12px; }
.strong { font-weight: 600; }
</style>

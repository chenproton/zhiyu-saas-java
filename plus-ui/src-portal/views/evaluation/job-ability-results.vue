<template>
  <div class="results-page">
    <!-- 左侧岗位导航 -->
    <div class="side-nav">
      <div class="side-header">
        <div class="side-title">岗位列表</div>
        <div class="side-sub">点击岗位查看认定结果</div>
      </div>
      <div class="side-list">
        <div v-if="summaryLoading" class="side-empty">加载中...</div>
        <el-empty v-else-if="summary.length === 0" description="暂无认定结果" :image-size="60" />
        <div
          v-for="item in summary"
          :key="item.positionId"
          class="side-item"
          :class="{ active: selectedPositionId === item.positionId }"
          @click="selectPosition(item.positionId)"
        >
          <div class="side-item-row">
            <span class="side-item-name">{{ item.positionName }}</span>
            <span class="side-item-count">{{ item.studentCount }} 人</span>
          </div>
          <div class="side-item-sub">平均达标率 {{ (item.avgRate ?? 0).toFixed(1) }}%</div>
        </div>
      </div>
    </div>

    <!-- 右侧结果区 -->
    <div class="main">
      <div class="page-header">
        <div>
          <h2 class="page-title">岗位能力认定结果</h2>
          <p class="page-sub">{{ selectedPosition ? `查看「${selectedPosition.positionName}」的能力认定结果` : '查看各岗位的能力认定结果' }}</p>
        </div>
        <el-button :disabled="!selectedPositionId || aggregating" @click="handleAggregate">
          {{ aggregating ? '汇聚中...' : '手动汇聚' }}
        </el-button>
      </div>

      <div class="filter-row">
        <el-input v-model="search" placeholder="搜索姓名或学号..." clearable style="max-width: 320px" @input="onSearch" />
      </div>

      <el-card shadow="never">
        <el-table v-loading="loading" :data="results" stripe>
          <el-table-column label="姓名" prop="studentName" width="110" />
          <el-table-column label="学号" prop="studentId" width="130" />
          <el-table-column label="所属院系" prop="department" width="130">
            <template #default="{ row }">{{ row.department || '-' }}</template>
          </el-table-column>
          <el-table-column label="班级" prop="className" width="120">
            <template #default="{ row }">{{ row.className || '-' }}</template>
          </el-table-column>
          <el-table-column label="岗位能力达成率" width="130">
            <template #default="{ row }">{{ rateOf(row) }}</template>
          </el-table-column>
          <el-table-column label="岗位胜任度" width="120">
            <template #default="{ row }">{{ pct(row.positionCompetency) }}</template>
          </el-table-column>
          <el-table-column label="岗位胜任度（新）" width="140">
            <template #default="{ row }">{{ pct(row.positionCompetencyV2) }}</template>
          </el-table-column>
          <el-table-column label="能力认证得分" width="120">
            <template #default="{ row }">{{ row.abilityCognitionScore != null ? row.abilityCognitionScore.toFixed(1) : '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="right">
            <template #default="{ row }">
              <el-button size="small" @click="openDetail(row.id)">查看明细</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-if="total > 0"
          class="pager"
          layout="prev, pager, next"
          :total="total"
          :page-size="PAGE_SIZE"
          :current-page="page"
          @current-change="onPage"
        />
      </el-card>
    </div>

    <!-- 明细弹窗 -->
    <el-dialog v-model="detailDialog" title="能力点认定明细" width="720px">
      <p v-if="detail" class="detail-sub">
        {{ detail.studentName }}（{{ detail.studentId }}）· {{ detail.positionName }}
      </p>
      <div v-if="detailLoading" class="detail-empty">加载中...</div>
      <div v-else-if="detail">
        <div class="detail-meta">
          <span>能力点达成 {{ detail.achievedAbilityPoints }}/{{ detail.totalAbilityPoints }}</span>
          <span>达标率 {{ (detail.achievementRate ?? 0).toFixed(1) }}%</span>
          <span>岗位胜任度（新） {{ pct(detail.positionCompetencyV2) }}</span>
          <span>认定时间 {{ fmtDateTime(detail.evaluationTime) }}</span>
        </div>
        <el-table v-if="detail.abilityPointDetails && detail.abilityPointDetails.length" :data="detail.abilityPointDetails" stripe>
          <el-table-column label="能力点" prop="abilityPointName" min-width="140" />
          <el-table-column label="得分" width="100">
            <template #default="{ row }">{{ row.maxScore != null ? `${row.score}/${row.maxScore}` : row.score }}</template>
          </el-table-column>
          <el-table-column label="档位" width="100">
            <template #default="{ row }">{{ row.levelLabel || '-' }}</template>
          </el-table-column>
          <el-table-column label="权重" width="90">
            <template #default="{ row }">{{ row.weight != null ? `${row.weight}%` : '-' }}</template>
          </el-table-column>
          <el-table-column label="是否达成" width="100">
            <template #default="{ row }">
              <el-tag :type="row.achieved ? 'success' : 'danger'">{{ row.achieved ? '已达成' : '未达成' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="胜任度（新）" width="120">
            <template #default="{ row }">{{ pct(row.competencyV2) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无能力点明细" :image-size="60" />
      </div>
      <el-empty v-else description="未找到结果明细" :image-size="60" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { jobAbilityResultApi } from '@/api/evaluation';
import type { JobAbilityResult, JobAbilitySummaryItem } from '@/types/evaluation';

const PAGE_SIZE = 20;
const route = useRoute();

const summary = ref<JobAbilitySummaryItem[]>([]);
const summaryLoading = ref(true);
const selectedPositionId = ref(String(route.query.positionId || ''));
const results = ref<JobAbilityResult[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const search = ref('');
const aggregating = ref(false);
const detailDialog = ref(false);
const detailLoading = ref(false);
const detail = ref<JobAbilityResult | null>(null);

let searchTimer: ReturnType<typeof setTimeout> | null = null;

const selectedPosition = computed(() => summary.value.find((s) => s.positionId === selectedPositionId.value));

function rateOf(row: JobAbilityResult) {
  return row.totalAbilityPoints > 0
    ? `${((row.achievedAbilityPoints / row.totalAbilityPoints) * 100).toFixed(0)}%`
    : '-';
}
function pct(v?: number) {
  return v != null ? `${v.toFixed(1)}%` : '-';
}
function fmtDateTime(d: string | Date) {
  return d ? new Date(d).toLocaleString() : '-';
}

async function loadSummary() {
  summaryLoading.value = true;
  try {
    const items = await jobAbilityResultApi.summary();
    summary.value = items || [];
    if (!route.query.positionId && items && items.length > 0) {
      selectedPositionId.value = items[0].positionId;
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '获取岗位汇总失败');
  } finally {
    summaryLoading.value = false;
  }
}

async function loadResults() {
  if (!selectedPositionId.value) return;
  loading.value = true;
  try {
    const res = await jobAbilityResultApi.list({
      careerPositionId: selectedPositionId.value,
      search: search.value || undefined,
      page: page.value,
      limit: PAGE_SIZE
    });
    results.value = res.items || [];
    total.value = res.total || 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '获取认定结果失败');
    results.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function selectPosition(id: string) {
  selectedPositionId.value = id;
  page.value = 1;
  loadResults();
}
function onSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadResults();
  }, 300);
}
function onPage(p: number) {
  page.value = p;
  loadResults();
}

async function handleAggregate() {
  const careerPositionId = selectedPositionId.value;
  if (!careerPositionId) return;
  aggregating.value = true;
  try {
    const triggered = await jobAbilityResultApi.aggregate({ careerPositionId });
    const logId = triggered.logId;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const status = await jobAbilityResultApi.aggregateStatus(careerPositionId, logId);
        if (status?.status === 'success') {
          aggregating.value = false;
          const updatedCount = status.updatedCount ?? 0;
          ElMessage.success(updatedCount > 0 ? `汇聚完成，更新 ${updatedCount} 名学生` : '更新 0 条，请确认规则已发布且学生已有评分');
          loadResults();
          loadSummary();
          return;
        }
        if (status?.status === 'failed') {
          aggregating.value = false;
          ElMessage.error(status.errorMessage || '汇聚任务执行失败');
          return;
        }
        if (attempts >= 15) {
          aggregating.value = false;
          ElMessage.info('汇聚仍在进行，稍后请手动刷新');
          return;
        }
        setTimeout(poll, 3000);
      } catch (e) {
        aggregating.value = false;
        ElMessage.error((e as Error).message || '获取汇聚状态失败');
      }
    };
    setTimeout(poll, 3000);
  } catch (e) {
    aggregating.value = false;
    ElMessage.error((e as Error).message || '汇聚任务提交失败');
  }
}

async function openDetail(id: string) {
  detailDialog.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await jobAbilityResultApi.get(id);
  } catch (e) {
    ElMessage.error((e as Error).message || '获取结果明细失败');
  } finally {
    detailLoading.value = false;
  }
}

onMounted(async () => {
  await loadSummary();
  await loadResults();
});
</script>

<style scoped>
.results-page { display: flex; height: calc(100vh - 60px); }
.side-nav { width: 260px; flex-shrink: 0; border-right: 1px solid #e4e7ed; background: #fff; display: flex; flex-direction: column; }
.side-header { padding: 16px; border-bottom: 1px solid #e4e7ed; }
.side-title { font-size: 14px; font-weight: 600; }
.side-sub { font-size: 12px; color: #909399; margin-top: 4px; }
.side-list { flex: 1; overflow-y: auto; padding: 8px; }
.side-item { padding: 10px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; }
.side-item:hover { background: #f5f7fa; }
.side-item.active { background: #ecf5ff; color: #409eff; font-weight: 600; }
.side-item-row { display: flex; justify-content: space-between; align-items: center; }
.side-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-item-count { font-size: 12px; color: #909399; flex-shrink: 0; }
.side-item-sub { font-size: 12px; color: #909399; margin-top: 2px; }
.side-empty { padding: 32px; text-align: center; color: #909399; font-size: 12px; }
.main { flex: 1; overflow-y: auto; padding: 16px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.filter-row { margin-bottom: 12px; }
.pager { margin-top: 12px; justify-content: flex-end; }
.detail-sub { color: #909399; margin: 0 0 8px; }
.detail-meta { display: flex; flex-wrap: wrap; gap: 16px; color: #606266; font-size: 13px; margin-bottom: 12px; }
.detail-empty { padding: 40px; text-align: center; color: #909399; }
</style>

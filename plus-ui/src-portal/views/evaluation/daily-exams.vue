<template>
  <div class="daily-exams-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">日常考试评价</h2>
        <p class="page-sub">选择考试安排，查看学生提交并进行评分</p>
      </div>
    </div>

    <div v-if="loading" class="loading-full">加载中...</div>

    <div v-else class="master-detail">
      <!-- 左侧：考试安排列表 -->
      <aside class="usage-panel">
        <div class="usage-search">
          <el-input
            v-model="search"
            placeholder="搜索考试名称..."
            clearable
            :prefix-icon="Search"
          />
        </div>
        <div class="usage-list">
          <div
            v-for="u in filteredUsages"
            :key="u.id"
            class="usage-item"
            :class="{ active: selectedUsageId === u.id }"
            @click="selectUsage(u.id)"
          >
            <p class="usage-name" :class="{ active: selectedUsageId === u.id }">{{ u.name }}</p>
            <div class="usage-meta">
              <span class="usage-submitted">已提交 {{ statsOf(u.id)?.submitted || 0 }} 人</span>
              <span v-if="(statsOf(u.id)?.pending || 0) > 0" class="usage-pending">待评 {{ statsOf(u.id)?.pending || 0 }}</span>
            </div>
          </div>
          <div v-if="filteredUsages.length === 0" class="usage-empty">
            <el-icon class="empty-icon"><Tickets /></el-icon>
            <span>暂无考试安排</span>
          </div>
        </div>
      </aside>

      <!-- 右侧：选中安排的提交记录 -->
      <section class="detail-panel">
        <template v-if="selectedUsage">
          <div class="detail-head">
            <div>
              <h3 class="detail-title">{{ selectedUsage.name }}</h3>
              <div class="detail-sub">
                <el-tag size="small" :type="usageStatusTagType(selectedUsage.status)">{{ usageStatusLabel(selectedUsage.status) }}</el-tag>
                <span class="detail-stats">{{ selectedStats?.submitted || 0 }} 份提交 · 待评 {{ selectedStats?.pending || 0 }} · 已评 {{ selectedStats?.graded || 0 }}</span>
              </div>
            </div>
          </div>

          <div class="table-card">
            <el-table :data="results" stripe>
              <el-table-column label="学生" min-width="120">
                <template #default="{ row }"><span class="cell-student">{{ row.studentName }}</span></template>
              </el-table-column>
              <el-table-column label="班级" prop="className" min-width="110">
                <template #default="{ row }"><span class="cell-dim">{{ row.className }}</span></template>
              </el-table-column>
              <el-table-column label="年级" prop="grade" min-width="90">
                <template #default="{ row }"><span class="cell-dim">{{ row.grade }}</span></template>
              </el-table-column>
              <el-table-column label="得分" width="100">
                <template #default="{ row }"><span class="cell-score">{{ row.score }}/{{ row.totalScore }}</span></template>
              </el-table-column>
              <el-table-column label="评分状态" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.gradingStatus === 'evaluated'" type="success" size="small">
                    <el-icon class="tag-icon"><CircleCheck /></el-icon>已评分
                  </el-tag>
                  <el-tag v-else type="warning" size="small">待评分</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="提交时间" width="150">
                <template #default="{ row }"><span class="cell-dim">{{ formatDateTime(row.submitTime) }}</span></template>
              </el-table-column>
              <el-table-column label="操作" width="180" align="right">
                <template #default="{ row }">
                  <el-button size="small" @click="goDetail(row.id)">
                    <el-icon class="btn-icon"><View /></el-icon>查看
                  </el-button>
                  <el-button
                    v-if="row.gradingStatus === 'evaluated'"
                    size="small"
                    disabled
                    class="graded-btn"
                  >
                    <el-icon class="btn-icon"><CircleCheck /></el-icon>已评分
                  </el-button>
                  <el-button v-else size="small" type="primary" @click="goDetail(row.id)">
                    <el-icon class="btn-icon"><EditPen /></el-icon>评分
                  </el-button>
                </template>
              </el-table-column>
              <template #empty>
                <div class="table-empty">
                  <el-icon class="empty-icon-lg"><Tickets /></el-icon>
                  <span>暂无学生提交记录</span>
                </div>
              </template>
            </el-table>
          </div>
        </template>

        <div v-else class="no-selection">
          <el-icon class="empty-icon-xl"><Reading /></el-icon>
          <span>请在左侧选择一个考试安排</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Search, View, EditPen, CircleCheck, Tickets, Reading } from '@element-plus/icons-vue';
import { examUsageApi, examResultApi } from '@/api/evaluation';
import type { ExamResult, ExamUsage } from '@/types/evaluation';

interface UsageStats {
  submitted: number;
  pending: number;
  graded: number;
}

const router = useRouter();
const usages = ref<ExamUsage[]>([]);
const usageStats = ref<Record<string, UsageStats>>({});
const selectedUsageId = ref<string | null>(null);
const results = ref<ExamResult[]>([]);
const loading = ref(true);
const search = ref('');

// 分页全量拉取：后端列表接口单页上限 200，逐页合并避免静默截断（对齐 React listAll）
const PAGE_SIZE = 200;
const MAX_PAGES = 1000;
async function listAll<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[] }>
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) {
      throw new Error('fetchAllPages: 超过最大页数，疑似分页未生效，已中止');
    }
    const res = await fetcher(page, PAGE_SIZE);
    const items = res.items || [];
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return all;
}

// 统计选中项：避免对全部 usage 并发请求（N+1 打爆后端）；
// 全量分页拉取该考试安排的提交记录，避免超过 500 条时提交人数被截断低估
async function loadStats(usageId: string) {
  try {
    const list = await listAll((p, ps) => examResultApi.list({ usageId, limit: ps, offset: p * ps }));
    usageStats.value = {
      ...usageStats.value,
      [usageId]: {
        submitted: list.length,
        pending: list.filter((x) => x.gradingStatus !== 'evaluated').length,
        graded: list.filter((x) => x.gradingStatus === 'evaluated').length
      }
    };
  } catch {
    usageStats.value = {
      ...usageStats.value,
      [usageId]: { submitted: 0, pending: 0, graded: 0 }
    };
  }
}

// 已统计过的考试安排（去重，避免重复请求）
const statsDone = new Set<string>();
// 结果列表请求序号守卫：切换考试安排时丢弃过期响应，防止旧安排数据错位/乱序覆盖
let resultsSeq = 0;

async function loadUsages() {
  try {
    // scope=all：课程节点随时作答（always）的自动考试安排不在管理列表默认范围，日常考试需全量
    const items = await listAll((p, ps) =>
      examUsageApi.list({ limit: ps, offset: p * ps, scope: 'all' })
    );
    usages.value = items;
    const firstId = items[0]?.id ?? null;
    if (firstId) {
      // 登记 statsDone，避免随后选中 effect 对首个安排重复发起统计请求
      statsDone.add(firstId);
      selectedUsageId.value = firstId;
      void loadStats(firstId);
    }
  } catch {
    /* ignore */
  }
  loading.value = false;
}

watch(selectedUsageId, (id) => {
  if (!id) return;
  const seq = ++resultsSeq;
  listAll((p, ps) =>
    examResultApi.list({ usageId: id, limit: ps, offset: p * ps })
  )
    .then((items) => {
      if (seq !== resultsSeq) return;
      results.value = items;
    })
    .catch(() => {
      if (seq !== resultsSeq) return;
      results.value = [];
    });
  // 切换选中项时统计其数据（已统计过的跳过，避免重复请求）
  if (!statsDone.has(id)) {
    statsDone.add(id);
    void loadStats(id);
  }
});

function selectUsage(id: string) {
  // 切换安排时先清空旧结果，避免新安排数据返回前表格仍展示上一安排的学生/得分记录
  results.value = [];
  selectedUsageId.value = id;
}

function goDetail(resultId: string) {
  router.push(`/evaluation/lesson-results/daily-exams/${resultId}`);
}

function statsOf(id: string): UsageStats | undefined {
  return usageStats.value[id];
}

const filteredUsages = computed(() => {
  if (!search.value.trim()) return usages.value;
  const q = search.value.trim().toLowerCase();
  return usages.value.filter((u) => u.name.toLowerCase().includes(q));
});
const selectedUsage = computed(
  () => usages.value.find((u) => u.id === selectedUsageId.value) || null
);
const selectedStats = computed(() =>
  selectedUsageId.value ? usageStats.value[selectedUsageId.value] : undefined
);

function usageStatusLabel(s: string): string {
  if (s === 'finished') return '已结束';
  if (s === 'in_progress') return '进行中';
  return '待开始';
}
function usageStatusTagType(s: string): 'success' | 'info' | 'warning' {
  if (s === 'finished') return 'info';
  if (s === 'in_progress') return 'success';
  return 'warning';
}

function formatDateTime(s?: string): string {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

onMounted(loadUsages);
</script>

<style scoped>
.daily-exams-page {
  padding: 16px;
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}
.page-sub {
  color: #909399;
  margin: 8px 0 0;
  font-size: 13px;
}
.loading-full {
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}

.master-detail {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  height: calc(100vh - 210px);
  min-height: 420px;
}

/* 左侧考试安排 */
.usage-panel {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
}
.usage-search {
  padding: 12px;
  border-bottom: 1px solid #f0f2f5;
}
.usage-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.usage-item {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #ebeef5;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}
.usage-item:hover {
  border-color: #c0c4cc;
}
.usage-item.active {
  background: rgba(64, 158, 255, 0.06);
  border-color: rgba(64, 158, 255, 0.4);
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.1);
}
.usage-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.usage-name.active {
  color: #409eff;
}
.usage-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  gap: 8px;
}
.usage-submitted {
  font-size: 11px;
  color: #c0c4cc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.usage-pending {
  flex-shrink: 0;
  font-size: 10px;
  line-height: 18px;
  padding: 0 6px;
  border-radius: 9999px;
  background: #fdf6ec;
  color: #e6a23c;
  font-weight: 500;
  border: 1px solid #faecd8;
}
.usage-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 0;
  color: #c0c4cc;
  font-size: 13px;
}

/* 右侧提交记录 */
.detail-panel {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
}
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.detail-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}
.detail-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.detail-stats {
  font-size: 12px;
  color: #c0c4cc;
}
.table-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}
.cell-student {
  font-size: 14px;
  font-weight: 500;
}
.cell-dim {
  font-size: 12px;
  color: #909399;
}
.cell-score {
  font-size: 14px;
  font-weight: 600;
}
.tag-icon {
  margin-right: 2px;
  vertical-align: -2px;
}
.btn-icon {
  margin-right: 3px;
  vertical-align: -2px;
}
.graded-btn {
  color: #67c23a;
}
.table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 0;
  color: #c0c4cc;
  font-size: 14px;
}
.empty-icon {
  font-size: 20px;
}
.empty-icon-lg {
  font-size: 40px;
  opacity: 0.4;
}
.empty-icon-xl {
  font-size: 48px;
  opacity: 0.5;
}
.no-selection {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #c0c4cc;
  font-size: 14px;
}
</style>

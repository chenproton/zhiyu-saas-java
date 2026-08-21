<template>
  <div class="results-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ usage?.name || '考试结果' }}</h2>
        <p class="page-sub">在线考试 · 考试结果统计</p>
      </div>
      <div>
        <!-- 对齐 React：导出数据为占位按钮（考试结果不在通用导出白名单内） -->
        <el-button disabled title="即将上线" style="margin-right: 8px">导出数据</el-button>
        <el-button @click="$router.push('/evaluation/exam-usage')">返回考试管理</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="4"><div class="stat"><div class="stat-value">{{ stats.total }}</div><div class="stat-label">参考人数</div></div></el-col>
      <el-col :span="4"><div class="stat"><div class="stat-value green">{{ stats.avgScore }}</div><div class="stat-label">平均分</div></div></el-col>
      <el-col :span="4"><div class="stat"><div class="stat-value blue">{{ stats.maxScore }}</div><div class="stat-label">最高分</div></div></el-col>
      <el-col :span="4"><div class="stat"><div class="stat-value amber">{{ stats.minScore }}</div><div class="stat-label">最低分</div></div></el-col>
      <el-col :span="4"><div class="stat"><div class="stat-value green">{{ stats.pass }}</div><div class="stat-label">及格人数</div></div></el-col>
      <el-col :span="4"><div class="stat"><div class="stat-value red">{{ stats.fail }}</div><div class="stat-label">不及格人数</div></div></el-col>
    </el-row>

    <el-card shadow="never">
      <div class="filter-row">
        <el-input v-model="search" placeholder="搜索姓名..." clearable style="max-width: 260px" />
        <el-select v-model="passFilter" style="width: 130px">
          <el-option label="全部" value="all" />
          <el-option label="及格" value="pass" />
          <el-option label="不及格" value="fail" />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="pagedResults" stripe>
        <el-table-column label="排名" width="70">
          <template #default="{ row }">{{ row.rank }}</template>
        </el-table-column>
        <el-table-column label="姓名" prop="studentName" width="120" />
        <el-table-column label="学号" prop="studentId" width="140" />
        <el-table-column label="班级" prop="className" min-width="120" />
        <el-table-column label="专业" prop="majorName" min-width="120">
          <template #default="{ row }">{{ row.majorName || '-' }}</template>
        </el-table-column>
        <el-table-column label="得分" width="100">
          <template #default="{ row }">{{ row.score }} / {{ row.totalScore }}</template>
        </el-table-column>
        <el-table-column label="交卷时间" width="160">
          <template #default="{ row }">{{ fmt(row.submitTime) }}</template>
        </el-table-column>
        <el-table-column label="评分状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.gradingStatus === 'evaluated'" type="success">已评分</el-tag>
            <el-tag v-else type="warning">待评分</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="是否通过" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isPass ? 'success' : 'danger'">{{ row.isPass ? '及格' : '不及格' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              @click="router.push(`/evaluation/lesson-results/daily-exams/${row.id}`)"
            >查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="filteredResults.length > PAGE_SIZE"
        class="pager"
        layout="prev, pager, next"
        :total="filteredResults.length"
        :page-size="PAGE_SIZE"
        :current-page="page"
        @current-change="page = $event"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { examUsageApi, examResultApi } from '@/api/evaluation';
import type { ExamUsage, ExamResult } from '@/types/evaluation';

const PAGE_SIZE = 20;
const route = useRoute();
const router = useRouter();
const usageId = String(route.query.usageId || '');

const usage = ref<ExamUsage | null>(null);
const results = ref<ExamResult[]>([]);
const loading = ref(false);
const search = ref('');
const passFilter = ref('all');
const page = ref(1);

const filteredResults = computed(() =>
  results.value.filter((r) => {
    if (passFilter.value !== 'all') {
      if (passFilter.value === 'pass' ? !r.isPass : r.isPass) return false;
    }
    if (search.value.trim()) {
      return (r.studentName || '').toLowerCase().includes(search.value.trim().toLowerCase());
    }
    return true;
  })
);
const pagedResults = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return filteredResults.value.slice(start, start + PAGE_SIZE);
});
const stats = computed(() => {
  const rs = results.value;
  const pass = rs.filter((r) => r.isPass).length;
  return {
    total: rs.length,
    pass,
    fail: rs.length - pass,
    avgScore: rs.length ? Math.round(rs.reduce((s, r) => s + r.score, 0) / rs.length) : 0,
    maxScore: rs.length ? Math.max(...rs.map((r) => r.score)) : 0,
    minScore: rs.length ? Math.min(...rs.map((r) => r.score)) : 0
  };
});

function fmt(d: string) {
  return d ? new Date(d).toLocaleString() : '-';
}

async function load() {
  if (!usageId) return;
  loading.value = true;
  try {
    const usageRes = await examUsageApi.get(usageId);
    usage.value = usageRes;
    // 分页全量拉取（封顶 200/页，逐页合并）
    let all: ExamResult[] = [];
    let offset = 0;
    const pageSize = 200;
    for (;;) {
      const res = await examResultApi.list({ usageId, limit: pageSize, offset });
      all = all.concat(res.items);
      if (res.items.length < pageSize || offset + pageSize >= (res.total || 0)) break;
      offset += pageSize;
    }
    results.value = all;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.results-page { padding: 16px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.stats-row { margin-bottom: 16px; }
.stat { background: #fff; border-radius: 8px; padding: 14px; text-align: center; }
.stat-value { font-size: 22px; font-weight: 700; }
.stat-value.green { color: #67c23a; }
.stat-value.blue { color: #409eff; }
.stat-value.amber { color: #e6a23c; }
.stat-value.red { color: #f56c6c; }
.stat-label { color: #909399; font-size: 13px; margin-top: 4px; }
.filter-row { display: flex; gap: 12px; margin-bottom: 12px; }
.pager { margin-top: 12px; justify-content: flex-end; }
</style>

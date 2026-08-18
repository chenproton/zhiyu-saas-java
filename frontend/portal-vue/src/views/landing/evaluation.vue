<template>
  <div class="landing">
    <!-- ===== Hero ===== -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">
          <el-icon><MagicStick /></el-icon>
          海量题库 · 智能组卷 · 在线考试
        </div>
        <h1 class="hero-title">
          测评资源平台
          <span class="hero-sub">海量题库与试卷，助力教学测评</span>
        </h1>
        <p class="hero-desc">丰富题库资源与智能组卷工具，支持在线考试与自动评分，让教学测评更高效</p>
        <el-button class="hero-cta" round @click="executeSearch">
          浏览资源
          <el-icon class="hero-cta-icon"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </section>

    <!-- ===== 统计条 ===== -->
    <div class="stats-wrap">
      <div class="stats-bar">
        <div v-for="s in stats" :key="s.label" class="stat-item">
          <div class="stat-icon" :style="{ background: s.gradient }">
            <el-icon :size="22"><component :is="s.icon" /></el-icon>
          </div>
          <div class="stat-text">
            <div class="stat-value">{{ s.value.toLocaleString() }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <main class="landing-main">
      <!-- 首屏加载失败提示 -->
      <div v-if="loadError" class="error-banner">资源加载失败，请刷新重试</div>

      <!-- ===== 考试中心区块（三态，对齐 React） ===== -->
      <template v-if="loading">
        <div class="skeleton-block" />
      </template>
      <template v-else-if="centerItems.length > 0">
        <div class="center-panel">
          <div class="center-header">
            <div class="center-title-group">
              <div class="center-icon"><el-icon :size="22"><Notebook /></el-icon></div>
              <div>
                <h2 class="center-title">考试中心</h2>
                <p class="center-sub">查看全部考试与你可参加的考试，按班级开放，进入后完成在线考试</p>
              </div>
            </div>
            <router-link to="/evaluation/landing/exam-center" class="center-entry-btn">
              进入考试中心
              <el-icon><ArrowRight /></el-icon>
            </router-link>
          </div>
          <div class="center-body">
            <div class="center-stats">
              <div class="center-stats-title">
                <el-icon><DataAnalysis /></el-icon>
                状态分布
              </div>
              <DonutChart :data="statusPieData" :size="140" :thickness="18">
                <div class="donut-num">{{ centerStats.total }}</div>
                <div class="donut-label">全部考试</div>
              </DonutChart>
              <div class="center-legend">
                <div v-for="d in statusPieData" :key="d.name" class="legend-row">
                  <span class="legend-dot" :style="{ background: d.color }" />
                  <span class="legend-name">{{ d.name }}</span>
                  <span class="legend-value">{{ d.value }}</span>
                </div>
              </div>
            </div>
            <div class="center-cards">
              <ExamCenterCard
                v-for="item in centerItems.slice(0, 3)"
                :key="item.id"
                :item="item"
                :cover-image="examCoverMap[item.examId]"
              />
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="exams.length > 0">
        <div class="center-panel">
          <div class="center-header">
            <div class="center-title-group">
              <div class="center-icon"><el-icon :size="22"><Notebook /></el-icon></div>
              <div>
                <h2 class="center-title">考试中心</h2>
                <p class="center-sub">查看全部考试与你可参加的考试，按班级开放，进入后完成在线考试</p>
              </div>
            </div>
            <router-link to="/evaluation/landing/exam-center" class="center-entry-btn">
              进入考试中心
              <el-icon><ArrowRight /></el-icon>
            </router-link>
          </div>
          <div class="center-body">
            <div class="center-stats">
              <div class="center-stats-title">
                <el-icon><DataAnalysis /></el-icon>
                试卷概览
              </div>
              <DonutChart :data="examPieData" :size="140" :thickness="18">
                <div class="donut-num">{{ exams.length }}</div>
                <div class="donut-label">已发布试卷</div>
              </DonutChart>
              <div class="center-legend">
                <div v-for="d in examPieData" :key="d.name" class="legend-row">
                  <span class="legend-dot" :style="{ background: d.color }" />
                  <span class="legend-name">{{ d.name }}</span>
                  <span class="legend-value">{{ d.value }} 份</span>
                </div>
              </div>
            </div>
            <div class="center-cards">
              <div v-for="exam in recentExams" :key="exam.id" class="preview-card">
                <div class="card-cover" :style="coverStyle(exam)">
                  <el-icon v-if="!exam.coverImage" class="card-cover-icon"><Notebook /></el-icon>
                  <span class="card-chip">{{ exam.duration }} 分钟</span>
                </div>
                <div class="card-body">
                  <h3 class="card-name" :title="exam.name">{{ exam.name }}</h3>
                  <p class="card-desc">{{ exam.description || '暂无描述' }}</p>
                  <div class="card-meta">
                    <span><el-icon><Document /></el-icon>{{ exam.questionCount ?? (exam.questions || []).length }} 题</span>
                    <span><el-icon><Clock /></el-icon>{{ exam.duration }} 分钟</span>
                  </div>
                  <button class="card-btn card-btn-disabled" type="button" disabled>
                    <el-icon><Lock /></el-icon>暂无考试安排
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="center-empty-banner">
          <div class="ceb-grid" />
          <div class="ceb-content">
            <div class="ceb-title-group">
              <div class="ceb-icon"><el-icon :size="26"><Notebook /></el-icon></div>
              <div>
                <h2 class="ceb-title">考试中心</h2>
                <p class="ceb-sub">查看全部考试与你可参加的考试，按班级开放，进入后完成在线考试</p>
              </div>
            </div>
            <router-link to="/evaluation/landing/exam-center" class="ceb-btn">
              进入考试中心
              <el-icon><ArrowRight /></el-icon>
            </router-link>
          </div>
        </div>
      </template>

      <!-- ===== 筛选 + 工具栏 + 列表（滚动目标） ===== -->
      <div ref="listRef" class="list-anchor">
        <!-- 资源筛选 -->
        <div class="filter-card">
          <div class="filter-title">
            <span class="title-bar" />
            <el-icon><Filter /></el-icon>
            资源筛选
          </div>
          <div class="filter-row">
            <span class="filter-label">批次</span>
            <div class="filter-chips">
              <button
                v-for="b in batches"
                :key="b"
                type="button"
                :class="['chip', { active: selectedBatch === b }]"
                @click="handleBatchChange(b)"
              >
                {{ b }}
              </button>
            </div>
          </div>
          <div v-if="activeFilters.length" class="active-filters">
            <span class="af-label">已选条件：</span>
            <span v-for="f in activeFilters" :key="f.type" class="af-chip">
              {{ f.label }}
              <el-icon class="af-close" @click="removeFilter(f.type)"><Close /></el-icon>
            </span>
            <button type="button" class="af-clear" @click="clearFilters">清空筛选</button>
          </div>
        </div>

        <!-- 工具栏：排序 + 搜索 -->
        <div class="toolbar">
          <div class="sort-tabs">
            <button
              v-for="o in SORT_OPTIONS"
              :key="o.value"
              type="button"
              :class="['sort-tab', { active: sort === o.value }]"
              @click="handleSortChange(o.value)"
            >
              {{ o.label }}
            </button>
          </div>
          <el-input
            v-model="keyword"
            class="search-input"
            placeholder="搜索题库、试卷名称"
            clearable
            @keyup.enter="executeSearch"
            @clear="executeSearch"
          >
            <template #append>
              <el-button @click="executeSearch">搜索</el-button>
            </template>
          </el-input>
        </div>

        <!-- 计数 -->
        <div class="count-line">
          <span class="count-dot" />
          当前共展示 <b class="count-num">{{ filteredBanks.length + filteredExams.length }}</b> 个资源
        </div>

        <!-- 题库 -->
        <section v-if="filteredBanks.length > 0" class="resource-section">
          <div class="section-head">
            <h2 class="section-title">
              <span class="title-bar" />
              题库
              <span class="section-count">({{ filteredBanks.length }})</span>
            </h2>
          </div>
          <div class="card-grid">
            <div v-for="bank in pageBanks" :key="bank.id" class="resource-card">
              <router-link :to="`/evaluation/landing/banks/${bank.id}`" class="card-link">
                <div class="card-cover" :style="coverStyle(bank)">
                  <el-icon v-if="!bank.coverImage" class="card-cover-icon"><Collection /></el-icon>
                  <span v-if="bank.version" class="card-chip">{{ bank.version }}</span>
                </div>
                <div class="card-body">
                  <h3 class="card-name" :title="bank.name">{{ bank.name }}</h3>
                  <p class="card-desc">{{ bank.description || '暂无描述' }}</p>
                  <div class="card-footer">
                    <span class="card-meta-item">
                      <el-icon><Document /></el-icon>{{ bank.questionCount }} 题
                    </span>
                    <span class="card-meta-item">
                      <el-icon><Clock /></el-icon>{{ formatDate(bank.createdAt) }}
                    </span>
                    <span class="card-more">查看详情 →</span>
                  </div>
                </div>
              </router-link>
            </div>
          </div>
          <el-pagination
            v-if="totalPages > 1"
            v-model:current-page="currentPage"
            :page-size="CARDS_PER_PAGE"
            :total="filteredBanks.length"
            layout="prev, pager, next"
            class="pagination"
            @current-change="onPageChange"
          />
        </section>

        <!-- 试卷 -->
        <section v-if="filteredExams.length > 0" class="resource-section">
          <div class="section-head">
            <h2 class="section-title">
              <span class="title-bar" />
              试卷
              <span class="section-count">({{ filteredExams.length }})</span>
            </h2>
          </div>
          <div class="card-grid">
            <div v-for="exam in filteredExams" :key="exam.id" class="resource-card">
              <router-link :to="`/evaluation/landing/exams/${exam.id}`" class="card-link">
                <div class="card-cover" :style="coverStyle(exam)">
                  <el-icon v-if="!exam.coverImage" class="card-cover-icon"><Notebook /></el-icon>
                  <span class="card-chip">{{ exam.duration }} 分钟</span>
                </div>
                <div class="card-body">
                  <h3 class="card-name" :title="exam.name">{{ exam.name }}</h3>
                  <p class="card-desc">{{ exam.description || '暂无描述' }}</p>
                  <div class="card-meta">
                    <span class="card-meta-item">
                      <el-icon><Document /></el-icon>{{ exam.questionCount ?? (exam.questions || []).length }} 题
                    </span>
                    <span class="card-meta-item">
                      <el-icon><Clock /></el-icon>{{ exam.duration }} 分钟
                    </span>
                  </div>
                  <div class="card-btn card-btn-primary">
                    <el-icon><VideoPlay /></el-icon>去考试
                  </div>
                </div>
              </router-link>
            </div>
          </div>
        </section>

        <!-- 空态 -->
        <div v-if="!loading && filteredBanks.length === 0 && filteredExams.length === 0" class="empty-state">
          <div class="empty-icon"><el-icon :size="30"><Search /></el-icon></div>
          <div class="empty-title">暂无匹配的资源</div>
          <div class="empty-hint">试试调整搜索关键词</div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import {
  ArrowRight,
  Clock,
  Close,
  Collection,
  DataAnalysis,
  Document,
  Files,
  Filter,
  Lock,
  MagicStick,
  Notebook,
  Search,
  VideoPlay
} from '@element-plus/icons-vue';
import { questionBankApi, examApi, evaluationBatchApi } from '@/api/evaluation';
import { request } from '@/api/http';
import type { Exam, QuestionBank } from '@/types/evaluation';
import DonutChart from './DonutChart.vue';
import ExamCenterCard from './ExamCenterCard.vue';
import { coverGradientFor, formatDate } from './evaluation-types';
import type { ExamCenterItem } from './evaluation-types';

const CARDS_PER_PAGE = 12;

const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' }
];

const stats = computed(() => [
  { icon: Collection, value: banks.value.length, label: '题库总数', gradient: 'linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-2))' },
  { icon: Document, value: exams.value.length, label: '试卷总数', gradient: 'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))' },
  { icon: Files, value: totalQuestions.value, label: '题目总数', gradient: 'linear-gradient(135deg, var(--el-color-primary-light-2), var(--el-color-primary-light-4))' },
  { icon: VideoPlay, value: exams.value.length, label: '可参与考试', gradient: 'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))' }
]);

// ===== 数据 =====
const banks = ref<QuestionBank[]>([]);
const exams = ref<Exam[]>([]);
const centerItems = ref<ExamCenterItem[]>([]);
const batchNames = ref<Map<string, string>>(new Map());
const loading = ref(true);
const loadError = ref<string | null>(null);
const currentPage = ref(1);
const sort = ref('default');
const keyword = ref('');
const selectedBatch = ref('全部');
const listRef = ref<HTMLElement | null>(null);

async function fetchData() {
  loading.value = true;
  loadError.value = null;
  try {
    // examUsageApi.center() 未封装在 Vue api 层，直接按同一契约调用 GET /evaluation/exam-center
    // （对齐 React examUsageApi.center()；失败不阻断其余资源加载，React 同样 .catch(() => [])；
    //  若后端返回 401 则走 http.ts 统一登录跳转，等价 React handleUnauthorized）
    const [banksRes, examsRes, batchesRes, centerRes] = await Promise.all([
      questionBankApi.list({ status: 'published', limit: 1000 }),
      examApi.list({ status: 'published', limit: 1000 }),
      evaluationBatchApi.list({ limit: 1000 }),
      request<ExamCenterItem[]>('/evaluation/exam-center').catch(() => [] as ExamCenterItem[])
    ]);
    banks.value = banksRes.items || [];
    exams.value = examsRes.items || [];
    centerItems.value = centerRes || [];
    const map = new Map<string, string>();
    (batchesRes.items || []).forEach((b: { id?: string; name?: string }) => {
      if (b.id && b.name) map.set(b.id, b.name);
    });
    batchNames.value = map;
  } catch (err) {
    // 首屏加载失败给出用户可见提示，避免静默渲染空列表误导用户
    loadError.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}
onMounted(fetchData);

// ===== 考试中心统计 =====
const centerStats = computed(() => {
  const items = centerItems.value;
  return {
    total: items.length,
    pending: items.filter((i) => i.status === 'published').length,
    inProgress: items.filter((i) => i.status === 'in_progress' && !i.submitted).length,
    finished: items.filter((i) => i.status === 'finished' && !i.submitted).length,
    submitted: items.filter((i) => i.submitted).length
  };
});

const statusPieData = computed(() =>
  [
    { name: '待考', value: centerStats.value.pending, color: '#d97706' },
    { name: '进行中', value: centerStats.value.inProgress, color: '#16a34a' },
    { name: '已交卷', value: centerStats.value.submitted, color: '#2563eb' },
    { name: '已结束', value: centerStats.value.finished, color: '#94a3b8' }
  ].filter((d) => d.value > 0)
);

const examCoverMap = computed(() => {
  const map: Record<string, string> = {};
  exams.value.forEach((e) => {
    if (e.coverImage) map[e.id] = e.coverImage;
  });
  return map;
});

const recentExams = computed(() =>
  [...exams.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
);

const examPieData = computed(() => [
  { name: '已发布试卷', value: exams.value.length, color: '#2563eb' }
]);

// ===== 筛选 / 排序 =====
const batches = computed(() => {
  const set = new Set<string>();
  const lookup = (id: string) => batchNames.value.get(id) || id;
  banks.value.forEach((b) => {
    if (b.batchId) set.add(lookup(b.batchId));
  });
  exams.value.forEach((e) => {
    if (e.batchId) set.add(lookup(e.batchId));
  });
  return ['全部', ...Array.from(set).sort()];
});

function filterByKeyword<T extends { name: string; description?: string }>(list: T[], kw: string): T[] {
  if (!kw.trim()) return list;
  const k = kw.trim().toLowerCase();
  return list.filter(
    (item) => item.name.toLowerCase().includes(k) || (item.description || '').toLowerCase().includes(k)
  );
}

function applySort<T extends { name: string; createdAt: string; updatedAt: string }>(
  list: T[],
  sortKey: string
): T[] {
  const arr = [...list];
  switch (sortKey) {
    case 'recent':
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'update':
      arr.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    default:
      arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      break;
  }
  return arr;
}

function filterByBatch<T extends { batchId?: string }>(list: T[], batch: string): T[] {
  if (batch === '全部') return list;
  return list.filter(
    (item) => item.batchId && (batchNames.value.get(item.batchId) || item.batchId) === batch
  );
}

const filteredBanks = computed(() => {
  let list = filterByBatch(filterByKeyword(banks.value, keyword.value), selectedBatch.value);
  return applySort(list, sort.value);
});

const filteredExams = computed(() => {
  let list = filterByBatch(filterByKeyword(exams.value, keyword.value), selectedBatch.value);
  return applySort(list, sort.value);
});

const totalQuestions = computed(() =>
  banks.value.reduce((sum, b) => sum + (b.questionCount || 0), 0)
);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredBanks.value.length / CARDS_PER_PAGE))
);

const pageBanks = computed(() => {
  const start = (currentPage.value - 1) * CARDS_PER_PAGE;
  return filteredBanks.value.slice(start, start + CARDS_PER_PAGE);
});

const activeFilters = computed(() => {
  const filters: { type: string; label: string }[] = [];
  if (keyword.value.trim()) filters.push({ type: 'keyword', label: `关键词：${keyword.value.trim()}` });
  if (selectedBatch.value !== '全部') filters.push({ type: 'batch', label: `批次：${selectedBatch.value}` });
  return filters;
});

// ===== 交互 =====
watch(keyword, () => {
  currentPage.value = 1;
});

function executeSearch() {
  currentPage.value = 1;
  nextTick(() => {
    listRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function handleSortChange(value: string) {
  sort.value = value;
  currentPage.value = 1;
}

function handleBatchChange(value: string) {
  selectedBatch.value = value;
  currentPage.value = 1;
}

function clearFilters() {
  keyword.value = '';
  selectedBatch.value = '全部';
  currentPage.value = 1;
}

function removeFilter(type: string) {
  if (type === 'keyword') keyword.value = '';
  if (type === 'batch') selectedBatch.value = '全部';
  currentPage.value = 1;
}

function onPageChange() {
  nextTick(() => {
    listRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function coverStyle(item: { id: string; coverImage?: string }) {
  return item.coverImage
    ? {
        backgroundImage: `url('${item.coverImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : { background: coverGradientFor(item.id) };
}
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

/* ===== Hero ===== */
.hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
}
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.08;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.2) 1px, transparent 1px);
  background-size: 52px 52px;
  pointer-events: none;
}
.hero-inner {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 56px 24px 64px;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(6px);
  color: #fff;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}
.hero-title {
  margin: 0 0 12px;
  font-size: 40px;
  font-weight: 700;
  color: #fff;
  line-height: 1.25;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hero-sub {
  font-size: 24px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}
.hero-desc {
  margin: 0 0 24px;
  max-width: 640px;
  font-size: 15px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.88);
}
.hero-cta {
  height: 44px;
  padding: 0 28px;
  font-weight: 600;
  background: #fff;
  color: var(--el-color-primary);
  border: none;
}
.hero-cta:hover {
  background: #f5f7fa;
  color: var(--el-color-primary);
}
.hero-cta-icon {
  margin-left: 4px;
}

/* ===== 统计条 ===== */
.stats-wrap {
  max-width: 1200px;
  margin: -28px auto 0;
  padding: 0 24px;
  position: relative;
  z-index: 2;
  width: 100%;
  box-sizing: border-box;
}
.stats-bar {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  padding: 16px 20px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: 12px;
  transition: all 0.2s;
}
.stat-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  background: #f8fafc;
}
.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}
.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-top: 2px;
}

/* ===== 主区 ===== */
.landing-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px 48px;
  width: 100%;
  box-sizing: border-box;
  flex: 1;
}
.error-banner {
  margin-bottom: 20px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 14px;
  padding: 14px 18px;
  font-size: 14px;
}
.skeleton-block {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  height: 360px;
  margin-bottom: 20px;
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ===== 考试中心面板 ===== */
.center-panel {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  margin-bottom: 20px;
  overflow: hidden;
}
.center-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
}
.center-title-group {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.center-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-8);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.center-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}
.center-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
  max-width: 560px;
  line-height: 1.6;
}
.center-entry-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--el-color-primary);
  color: #fff;
  padding: 0 22px;
  height: 38px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.3);
  transition: all 0.2s;
  flex-shrink: 0;
}
.center-entry-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
.center-body {
  display: flex;
  gap: 20px;
  padding: 18px 24px 24px;
  flex-direction: column;
}
@media (min-width: 1024px) {
  .center-body { flex-direction: row; }
}
.center-stats {
  width: 100%;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 14px;
  padding: 16px;
  box-sizing: border-box;
}
@media (min-width: 1024px) {
  .center-stats { width: 250px; flex-shrink: 0; }
}
.center-stats-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 12px;
}
.center-stats-title .el-icon {
  color: var(--el-color-primary);
}
.donut-num {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
}
.donut-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}
.center-legend {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #475569;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-value {
  margin-left: auto;
  font-weight: 600;
  color: #0f172a;
}
.center-cards {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 640px) {
  .center-cards { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1200px) {
  .center-cards { grid-template-columns: repeat(3, 1fr); }
}

/* 空态渐变横幅 */
.center-empty-banner {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-2));
  padding: 22px 24px;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.25);
}
.ceb-grid {
  position: absolute;
  inset: 0;
  opacity: 0.1;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px);
  background-size: 36px 36px;
  pointer-events: none;
}
.ceb-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.ceb-title-group {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.ceb-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ceb-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
}
.ceb-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  max-width: 560px;
  line-height: 1.6;
}
.ceb-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  color: var(--el-color-primary);
  padding: 0 22px;
  height: 38px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  flex-shrink: 0;
}
.ceb-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* ===== 筛选卡 ===== */
.list-anchor {
  scroll-margin-top: 16px;
}
.filter-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  padding: 20px 24px;
  margin-bottom: 18px;
}
.filter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 16px;
}
.filter-title .el-icon {
  color: var(--el-color-primary);
}
.title-bar {
  width: 4px;
  height: 18px;
  border-radius: 4px;
  background: linear-gradient(180deg, var(--el-color-primary-light-2), var(--el-color-primary));
  flex-shrink: 0;
}
.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
}
.filter-label {
  font-size: 13px;
  color: #64748b;
  line-height: 30px;
  flex-shrink: 0;
}
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s;
}
.chip:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}
.chip.active {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
  font-weight: 500;
}
.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed #cbd5e1;
}
.af-label {
  font-size: 13px;
  color: #64748b;
}
.af-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
}
.af-close {
  cursor: pointer;
  font-size: 12px;
}
.af-close:hover {
  color: #ef4444;
}
.af-clear {
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

/* ===== 工具栏 ===== */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sort-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #fff;
  padding: 4px;
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  overflow-x: auto;
  max-width: 100%;
}
.sort-tab {
  border: none;
  background: none;
  padding: 7px 16px;
  border-radius: 9px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.sort-tab:hover {
  color: var(--el-color-primary);
  background: #f8fafc;
}
.sort-tab.active {
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}
.search-input {
  width: 100%;
  max-width: 340px;
}
.search-input :deep(.el-input__wrapper) {
  border-radius: 10px 0 0 10px;
  box-shadow: 0 0 0 1px #e7e5e4 inset;
  background: #f8fafc;
}
.search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
.search-input :deep(.el-input-group__append) {
  border-radius: 0 10px 10px 0;
  box-shadow: none;
  background: var(--el-color-primary);
}
.search-input :deep(.el-input-group__append .el-button) {
  background: var(--el-color-primary);
  color: #fff;
  border: none;
}

/* ===== 计数 ===== */
.count-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 18px;
}
.count-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
}
.count-num {
  color: var(--el-color-primary);
}

/* ===== 资源区块 ===== */
.resource-section {
  margin-bottom: 36px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: #0f172a;
}
.section-count {
  font-size: 13px;
  color: #64748b;
  font-weight: 400;
}
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
@media (min-width: 640px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .card-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1280px) {
  .card-grid { grid-template-columns: repeat(4, 1fr); }
}

.resource-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.25s;
}
.resource-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary-light-5);
}
.card-link {
  display: flex;
  flex-direction: column;
  height: 100%;
  text-decoration: none;
  color: inherit;
}
.card-cover {
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}
.card-cover-icon {
  font-size: 44px;
  color: rgba(255, 255, 255, 0.85);
}
.card-chip {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.card-body {
  padding: 18px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-name {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-desc {
  margin: 0 0 10px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
  border-top: 1px solid #f8fafc;
  padding-top: 12px;
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11px;
  color: #94a3b8;
  padding-bottom: 12px;
  margin-bottom: 10px;
  border-bottom: 1px solid #f8fafc;
}
.card-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.card-meta-item .el-icon {
  font-size: 12px;
}
.card-more {
  color: var(--el-color-primary);
  font-weight: 500;
  white-space: nowrap;
}
.card-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 34px;
  border-radius: 10px;
  font-size: 12px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  box-sizing: border-box;
}
.card-btn-primary {
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.25);
}
.card-btn-disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

/* ===== 分页 ===== */
.pagination {
  margin-top: 20px;
  justify-content: center;
}

/* ===== 空态 ===== */
.empty-state {
  text-align: center;
  padding: 64px 0;
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}
.empty-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 14px;
  border-radius: 14px;
  background: #f8fafc;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-title {
  font-size: 15px;
  font-weight: 500;
  color: #475569;
}
.empty-hint {
  font-size: 13px;
  color: #94a3b8;
  margin-top: 4px;
}
</style>

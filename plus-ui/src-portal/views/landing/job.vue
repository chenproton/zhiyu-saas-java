<template>
  <div class="landing">
    <!-- ===== Hero ===== -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-flex">
          <div class="hero-left">
            <div class="hero-badge">
              <el-icon><MagicStick /></el-icon>
              对接产业前沿 · 赋能岗位能力学习
            </div>
            <h1 class="hero-title">
              对接产业前沿
              <span class="hero-sub">开启岗位能力学习新征程</span>
            </h1>
            <p class="hero-desc">链接真实岗位场景，构建从认知到胜任的能力进阶闭环</p>
            <el-button class="hero-cta" round @click="executeSearch">
              浏览岗位
              <el-icon class="hero-cta-icon"><ArrowRight /></el-icon>
            </el-button>
          </div>
          <div class="hero-right">
            <PositionSideLists :target-positions="targetPositions" :favorite-positions="favoritePositions" />
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 统计条 ===== -->
    <div class="stats-wrap">
      <div class="stats-bar">
        <div v-for="s in jobStats" :key="s.label" class="stat-item">
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
      <!-- 收藏岗位排行榜（对齐 React beforeList） -->
      <div class="ranking-wrap">
        <RankingList :positions="positions" :industry-map="industryMap" />
      </div>

      <!-- 筛选 + 工具栏 + 列表（滚动目标） -->
      <div ref="listRef" class="list-anchor">
        <!-- 岗位筛选 -->
        <div class="filter-card">
          <div class="filter-title">
            <span class="title-bar" />
            <el-icon><Filter /></el-icon>
            岗位筛选
          </div>
          <LandingFilterRow
            label="行业"
            :items="industries"
            :selected="selectedIndustry"
            @update:selected="handleIndustryChange"
          />
          <LandingFilterRow
            label="专业"
            :items="majors"
            :selected="selectedMajor"
            :show-border="false"
            @update:selected="handleMajorChange"
          />
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
            placeholder="搜索岗位名称、岗位编码或关键词"
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
          当前共展示 <b class="count-num">{{ filtered.length }}</b> 个岗位查看入口
        </div>

        <!-- 加载骨架 -->
        <div v-if="loading" class="skeleton-grid">
          <div v-for="i in 12" :key="i" class="skeleton-card" />
        </div>

        <!-- 空态 -->
        <div v-else-if="filtered.length === 0" class="empty-state">
          <div class="empty-icon"><el-icon :size="30"><Search /></el-icon></div>
          <div class="empty-title">暂无匹配的岗位</div>
          <div class="empty-hint">试试调整筛选条件或搜索关键词</div>
        </div>

        <!-- 岗位卡片列表 -->
        <template v-else>
          <div class="card-grid">
            <JobCard
              v-for="pos in pageItems"
              :key="pos.id"
              :position="pos"
              :is-hot="hotPositionIds.has(pos.id)"
              :scenario-count="scenarioCountMap.get(pos.id) ?? 0"
              :ability-count="pos.abilityCount ?? 0"
              :industry-name="pos.industryId ? industryMap.get(pos.industryId) : undefined"
            />
          </div>
          <el-pagination
            v-if="totalPages > 1"
            v-model:current-page="currentPage"
            :page-size="CARDS_PER_PAGE"
            :total="filtered.length"
            layout="prev, pager, next"
            class="pagination"
            @current-change="onPageChange"
          />
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import {
  ArrowRight,
  Briefcase,
  Close,
  Files,
  Filter,
  MagicStick,
  OfficeBuilding,
  School,
  Search
} from '@element-plus/icons-vue';
import { positionApi, publicPositionApi, recommendApi } from '@/api/job';
import { scenarioApi } from '@/api/scene';
import { industryApi } from '@/api/system';
import { request } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { CareerPosition, PositionRecommendation } from '@/types/job';
import type { Scenario } from '@/types/scene';
import { useAuthStore } from '@/stores/auth';
import JobCard from './JobCard.vue';
import RankingList from './RankingList.vue';
import PositionSideLists from './PositionSideLists.vue';
import LandingFilterRow from './LandingFilterRow.vue';

const CARDS_PER_PAGE = 12;

const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'hot', label: '最多收藏' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' }
];

// ===== 数据 =====
const positions = ref<CareerPosition[]>([]);
const scenarios = ref<Scenario[]>([]);
const hotPositions = ref<{ positionId: string; order: number }[]>([]);
const favoritePositions = ref<CareerPosition[]>([]);
const targetPositions = ref<CareerPosition[]>([]);
const industryMap = ref<Map<string, string>>(new Map());
const loading = ref(true);
const currentPage = ref(1);
const sort = ref('default');
const keyword = ref('');
const selectedIndustry = ref('全部');
const selectedMajor = ref('全部');
const listRef = ref<HTMLElement | null>(null);

const authStore = useAuthStore();

// 分页全量拉取（对齐 React fetchAllPages：后端列表 maxPageSize 上限 200，需分页合并避免静默截断）
async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<ListResponse<T>>,
  pageSize = 200,
  maxPages = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    if (page >= maxPages) {
      throw new Error(`fetchAllPages: 超过最大页数 ${maxPages}，疑似分页未生效，已中止`);
    }
    const res = await fetcher(page, pageSize);
    const items = res.items || [];
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

async function fetchData() {
  loading.value = true;
  // 主列表各自独立兜底（对齐 React：单组失败不阻断整页渲染）
  await Promise.all([
    publicPositionApi
      .list({ status: 'published', limit: 1000 })
      .then((res) => {
        positions.value = res.items || [];
      })
      .catch(() => {
        positions.value = [];
      }),
    scenarioApi
      .list({ status: 'published', limit: 1000 })
      .then((res) => {
        scenarios.value = res.items || [];
      })
      .catch(() => {
        scenarios.value = [];
      })
  ]).finally(() => {
    loading.value = false;
  });

  // 运营推荐位（热门标记与默认排序权重），失败不阻断
  recommendApi
    .list({ limit: 1000 })
    .then((res) => {
      hotPositions.value = (res.items || [])
        .filter((rec: PositionRecommendation) => rec.isEnabled)
        .sort((a: PositionRecommendation, b: PositionRecommendation) => a.sortOrder - b.sortOrder)
        .map((rec: PositionRecommendation) => ({ positionId: rec.careerPositionId, order: rec.sortOrder }));
    })
    .catch(() => {
      hotPositions.value = [];
    });

  // 行业字典（对齐 React useIndustryMap 的 fetchAllPages 全量拉取）
  fetchAllPages((page, pageSize) => industryApi.list({ limit: pageSize, offset: page * pageSize }))
    .then((items) => {
      const map = new Map<string, string>();
      items.forEach((item) => {
        if (item.name) map.set(item.id, item.name);
      });
      industryMap.value = map;
    })
    .catch(() => {
      industryMap.value = new Map();
    });

  loadPersonal();
}

// 收藏/目标岗位：需登录；未登录不请求，401 由 http.ts 统一跳登录（对齐 React useAuth 判断）
async function loadPersonal() {
  if (!authStore.isLoggedIn) {
    favoritePositions.value = [];
    targetPositions.value = [];
    return;
  }
  try {
    const res = await positionApi.listFavorites();
    favoritePositions.value = res.items || [];
  } catch {
    favoritePositions.value = [];
  }
  try {
    // targetPositionApi 未封装在 Vue api 层，直接按同一契约调用（对齐 React GET /job/landing/target-positions）
    const res = await request<ListResponse<CareerPosition>>('/job/landing/target-positions');
    targetPositions.value = res.items || [];
  } catch {
    targetPositions.value = [];
  }
}

onMounted(fetchData);

// ===== 派生数据 =====
const hotPositionIds = computed(() => new Set(hotPositions.value.map((h) => h.positionId)));
const hotOrderMap = computed(() => new Map(hotPositions.value.map((h) => [h.positionId, h.order])));

const scenarioCountMap = computed(() => {
  const map = new Map<string, number>();
  scenarios.value.forEach((s) => {
    if (s.careerPositionId) {
      map.set(s.careerPositionId, (map.get(s.careerPositionId) || 0) + 1);
    }
  });
  return map;
});

const industries = computed(() => {
  const set = new Set<string>();
  positions.value.forEach((p) => {
    if (p.industryId) {
      const name = industryMap.value.get(p.industryId);
      if (name) set.add(name);
    }
  });
  return ['全部', ...Array.from(set).sort()];
});

const majors = computed(() => {
  const set = new Set<string>();
  positions.value.forEach((p) =>
    p.majorNames?.forEach((m) => {
      if (m) set.add(m);
    })
  );
  return ['全部', ...Array.from(set).sort()];
});

const filtered = computed(() => {
  let list = [...positions.value];
  if (selectedIndustry.value !== '全部') {
    list = list.filter(
      (p) => p.industryId && industryMap.value.get(p.industryId) === selectedIndustry.value
    );
  }
  if (selectedMajor.value !== '全部') {
    list = list.filter((p) => p.majorNames?.includes(selectedMajor.value));
  }
  if (keyword.value.trim()) {
    const k = keyword.value.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(k) ||
        (p.shortName?.toLowerCase().includes(k) ?? false) ||
        p.id.toLowerCase().includes(k)
    );
  }
  switch (sort.value) {
    case 'hot':
      list.sort(
        (a, b) => (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0) || a.name.localeCompare(b.name, 'zh-CN')
      );
      break;
    case 'recent':
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'update':
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    default: {
      list.sort((a, b) => {
        const aOrder = hotOrderMap.value.get(a.id);
        const bOrder = hotOrderMap.value.get(b.id);
        if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
      break;
    }
  }
  return list;
});

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / CARDS_PER_PAGE)));
const pageItems = computed(() => {
  const start = (currentPage.value - 1) * CARDS_PER_PAGE;
  return filtered.value.slice(start, start + CARDS_PER_PAGE);
});

const activeFilters = computed(() => {
  const filters: { type: string; label: string }[] = [];
  if (selectedIndustry.value !== '全部')
    filters.push({ type: 'industry', label: `行业：${selectedIndustry.value}` });
  if (selectedMajor.value !== '全部')
    filters.push({ type: 'major', label: `专业：${selectedMajor.value}` });
  if (keyword.value.trim())
    filters.push({ type: 'keyword', label: `关键词：${keyword.value.trim()}` });
  return filters;
});

const stats = computed(() => {
  const industrySet = new Set<string>();
  const majorSet = new Set<string>();
  let favoriteTotal = 0;
  positions.value.forEach((p) => {
    if (p.industryId) industrySet.add(p.industryId);
    p.majorNames?.forEach((m) => majorSet.add(m));
    favoriteTotal += p.favoriteCount ?? 0;
  });
  return {
    total: positions.value.length,
    industryCount: industrySet.size,
    majorCount: majorSet.size,
    favoriteTotal
  };
});

const jobStats = computed(() => [
  {
    icon: Briefcase,
    value: stats.value.total,
    label: '岗位总数',
    gradient: 'linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-2))'
  },
  {
    icon: Files,
    value: scenarios.value.length,
    label: '实践场景',
    gradient: 'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))'
  },
  {
    icon: OfficeBuilding,
    value: stats.value.industryCount,
    label: '覆盖行业',
    gradient: 'linear-gradient(135deg, var(--el-color-primary-light-2), var(--el-color-primary-light-4))'
  },
  {
    icon: School,
    value: stats.value.majorCount,
    label: '覆盖专业',
    gradient: 'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))'
  }
]);

// ===== 交互 =====
// 筛选/排序/关键词变化重置页码（对齐 React useEffect setCurrentPage(1)）
watch([selectedIndustry, selectedMajor, keyword, sort], () => {
  currentPage.value = 1;
});

function executeSearch() {
  currentPage.value = 1;
  nextTick(() => {
    listRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function onPageChange() {
  nextTick(() => {
    listRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function handleSortChange(value: string) {
  sort.value = value;
  currentPage.value = 1;
}

function handleIndustryChange(value: string) {
  selectedIndustry.value = value;
  currentPage.value = 1;
}

function handleMajorChange(value: string) {
  selectedMajor.value = value;
  currentPage.value = 1;
}

function removeFilter(type: string) {
  if (type === 'industry') selectedIndustry.value = '全部';
  if (type === 'major') selectedMajor.value = '全部';
  if (type === 'keyword') keyword.value = '';
  currentPage.value = 1;
}

function clearFilters() {
  selectedIndustry.value = '全部';
  selectedMajor.value = '全部';
  keyword.value = '';
  currentPage.value = 1;
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 56px 24px 64px;
  width: 100%;
  box-sizing: border-box;
}
.hero-flex {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
@media (min-width: 1024px) {
  .hero-flex {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    min-height: 440px;
  }
}
.hero-left {
  flex: 1;
  min-width: 0;
  padding-top: 8px;
}
.hero-right {
  width: 100%;
  flex-shrink: 0;
}
@media (min-width: 1024px) {
  .hero-right {
    width: 460px;
  }
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
  max-width: 1400px;
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
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (min-width: 1024px) {
  .stats-bar {
    grid-template-columns: repeat(4, 1fr);
  }
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px 48px;
  width: 100%;
  box-sizing: border-box;
  flex: 1;
}
.ranking-wrap {
  margin-bottom: 24px;
}
.list-anchor {
  scroll-margin-top: 16px;
}

/* ===== 筛选卡 ===== */
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
  margin-bottom: 4px;
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

/* ===== 骨架 ===== */
.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
@media (min-width: 640px) {
  .skeleton-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .skeleton-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
.skeleton-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  height: 320px;
  animation: pulse 1.6s ease-in-out infinite;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ===== 卡片列表 ===== */
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
@media (min-width: 640px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .card-grid {
    grid-template-columns: repeat(4, 1fr);
  }
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

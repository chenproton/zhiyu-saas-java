<template>
  <div class="landing">
    <!-- ===== Hero ===== -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">
          <el-icon><MagicStick /></el-icon>
          场景化实践 · 任务驱动教学
        </div>
        <h1 class="hero-title">
          场景化实践教学
          <span class="hero-sub">以真实场景驱动能力成长</span>
        </h1>
        <p class="hero-desc">基于真实业务场景的任务化训练，从入门到专家，系统提升综合实战能力</p>
        <el-button class="hero-cta" round @click="executeSearch">
          浏览场景
          <el-icon class="hero-cta-icon"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </section>

    <!-- ===== 统计条 ===== -->
    <div class="stats-wrap">
      <div class="stats-bar">
        <div v-for="s in sceneStats" :key="s.label" class="stat-item">
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
      <!-- 筛选 + 工具栏 + 列表（滚动目标） -->
      <div ref="listRef" class="list-anchor">
        <!-- 场景筛选 -->
        <div class="filter-card">
          <div class="filter-title">
            <span class="title-bar" />
            <el-icon><Filter /></el-icon>
            场景筛选
          </div>
          <LandingFilterRow
            label="行业"
            :items="industries"
            :selected="selectedIndustry"
            @update:selected="handleIndustryChange"
          />
          <LandingFilterRow
            label="岗位"
            :items="positionNames"
            :selected="selectedPosition"
            @update:selected="handlePositionChange"
          />
          <LandingFilterRow
            label="专业"
            :items="professionNames"
            :selected="selectedProfession"
            @update:selected="handleProfessionChange"
          />
          <LandingFilterRow
            label="难度"
            :items="difficulties"
            :selected="selectedDifficulty"
            :show-border="false"
            @update:selected="handleDifficultyChange"
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
            placeholder="搜索场景名称、编码或关键词"
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
          当前共展示 <b class="count-num">{{ filtered.length }}</b> 个场景查看入口
        </div>

        <!-- 加载骨架 -->
        <div v-if="loading" class="skeleton-grid">
          <div v-for="i in 12" :key="i" class="skeleton-card" />
        </div>

        <!-- 空态 -->
        <div v-else-if="filtered.length === 0" class="empty-state">
          <div class="empty-icon"><el-icon :size="30"><Search /></el-icon></div>
          <div class="empty-title">暂无匹配的场景</div>
          <div class="empty-hint">试试调整筛选条件或搜索关键词</div>
        </div>

        <!-- 场景卡片列表 -->
        <template v-else>
          <div class="card-grid">
            <SceneCard
              v-for="scenario in pageItems"
              :key="scenario.id"
              :scenario="scenario"
              :task-count="taskCountMap.get(scenario.id) ?? 0"
              :knowledge-point-count="knowledgePointCountMap.get(scenario.id) ?? 0"
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
  List,
  MagicStick,
  OfficeBuilding,
  Search
} from '@element-plus/icons-vue';
import { scenarioApi, taskApi } from '@/api/scene';
import { publicPositionApi } from '@/api/job';
import type { Scenario, ScenarioTask } from '@/types/scene';
import type { CareerPosition } from '@/types/job';
import SceneCard from './SceneCard.vue';
import LandingFilterRow from './LandingFilterRow.vue';
import { SCENE_DIFFICULTY } from './scene-types';

const CARDS_PER_PAGE = 12;

const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' },
  { value: 'tasks', label: '最多任务' }
];

// ===== 数据 =====
const scenarios = ref<Scenario[]>([]);
const positions = ref<CareerPosition[]>([]);
const taskCountMap = ref<Map<string, number>>(new Map());
const knowledgePointCountMap = ref<Map<string, number>>(new Map());
const loading = ref(true);
const currentPage = ref(1);
const sort = ref('default');
const keyword = ref('');
const selectedIndustry = ref('全部');
const selectedPosition = ref('全部');
const selectedProfession = ref('全部');
const selectedDifficulty = ref('全部');
const listRef = ref<HTMLElement | null>(null);

// 场景任务/知识点统计：仅用于「最多任务」排序与卡片角标，后台异步填充不阻塞首屏（对齐 React）
async function loadSceneTaskStats(scens: Scenario[]) {
  try {
    const results = await Promise.all(
      scens.map((s) =>
        taskApi.list({ scenarioId: s.id, limit: 1000 }).catch(() => ({ items: [] as ScenarioTask[], total: 0 }))
      )
    );
    const tMap = new Map<string, number>();
    const kpMap = new Map<string, number>();
    scens.forEach((s, idx) => {
      const taskList = results[idx]?.items || [];
      tMap.set(s.id, taskList.length);
      const kpIds = new Set<string>();
      taskList.forEach((t) => (t.knowledgePointIds || []).forEach((kid) => kpIds.add(kid)));
      kpMap.set(s.id, kpIds.size);
    });
    taskCountMap.value = tMap;
    knowledgePointCountMap.value = kpMap;
  } catch {
    taskCountMap.value = new Map();
    knowledgePointCountMap.value = new Map();
  }
}

async function fetchData() {
  loading.value = true;
  await Promise.all([
    scenarioApi
      .list({ status: 'published', limit: 1000 })
      .then((res) => {
        const scens = res.items || [];
        scenarios.value = scens;
        void loadSceneTaskStats(scens);
      })
      .catch(() => {
        scenarios.value = [];
        taskCountMap.value = new Map();
        knowledgePointCountMap.value = new Map();
      }),
    publicPositionApi
      .list({ status: 'published', limit: 1000 })
      .then((res) => {
        positions.value = res.items || [];
      })
      .catch(() => {
        positions.value = [];
      })
  ]).finally(() => {
    loading.value = false;
  });
}

onMounted(fetchData);

// ===== 派生数据 =====
const positionIdNameMap = computed(() => {
  const map = new Map<string, string>();
  positions.value.forEach((p) => map.set(p.id, p.shortName || p.name));
  return map;
});

const industries = computed(() => {
  const set = new Set<string>();
  scenarios.value.forEach((s) => s.industryNames?.forEach((n) => n && set.add(n)));
  return ['全部', ...Array.from(set).sort()];
});

const positionNames = computed(() => {
  const set = new Set<string>();
  scenarios.value.forEach((s) => {
    if (s.careerPositionId && positionIdNameMap.value.has(s.careerPositionId)) {
      set.add(positionIdNameMap.value.get(s.careerPositionId)!);
    }
  });
  return ['全部', ...Array.from(set).sort()];
});

const professionNames = computed(() => {
  const set = new Set<string>();
  scenarios.value.forEach((s) => s.professionNames?.forEach((n) => n && set.add(n)));
  return ['全部', ...Array.from(set).sort()];
});

const difficulties = computed(() => {
  const nums = new Set<number>();
  scenarios.value.forEach((s) => {
    if (s.difficulty) nums.add(s.difficulty);
  });
  return ['全部', ...Array.from(nums).sort().map((n) => SCENE_DIFFICULTY[n]?.label || String(n))];
});

const filtered = computed(() => {
  let list = [...scenarios.value];
  if (selectedIndustry.value !== '全部') {
    list = list.filter((s) => s.industryNames?.includes(selectedIndustry.value));
  }
  if (selectedPosition.value !== '全部') {
    const targetId = Array.from(positionIdNameMap.value.entries()).find(
      ([, name]) => name === selectedPosition.value
    )?.[0];
    if (targetId) list = list.filter((s) => s.careerPositionId === targetId);
  }
  if (selectedProfession.value !== '全部') {
    list = list.filter((s) => s.professionNames?.includes(selectedProfession.value));
  }
  if (selectedDifficulty.value !== '全部') {
    list = list.filter((s) => SCENE_DIFFICULTY[s.difficulty]?.label === selectedDifficulty.value);
  }
  if (keyword.value.trim()) {
    const k = keyword.value.trim().toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(k) ||
        (s.code?.toLowerCase().includes(k) ?? false) ||
        (s.background?.toLowerCase().includes(k) ?? false) ||
        s.id.toLowerCase().includes(k)
    );
  }
  switch (sort.value) {
    case 'tasks':
      list.sort(
        (a, b) =>
          (taskCountMap.value.get(b.id) ?? 0) - (taskCountMap.value.get(a.id) ?? 0) ||
          a.name.localeCompare(b.name, 'zh-CN')
      );
      break;
    case 'recent':
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'update':
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    default:
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      break;
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
  if (selectedIndustry.value !== '全部') filters.push({ type: 'industry', label: `行业：${selectedIndustry.value}` });
  if (selectedPosition.value !== '全部') filters.push({ type: 'position', label: `岗位：${selectedPosition.value}` });
  if (selectedProfession.value !== '全部') filters.push({ type: 'profession', label: `专业：${selectedProfession.value}` });
  if (selectedDifficulty.value !== '全部') filters.push({ type: 'difficulty', label: `难度：${selectedDifficulty.value}` });
  if (keyword.value.trim()) filters.push({ type: 'keyword', label: `关键词：${keyword.value.trim()}` });
  return filters;
});

const sceneStats = computed(() => {
  const industrySet = new Set<string>();
  let totalTasks = 0;
  const positionSet = new Set<string>();
  scenarios.value.forEach((s) => {
    s.industryNames?.forEach((n) => n && industrySet.add(n));
    totalTasks += taskCountMap.value.get(s.id) ?? 0;
    if (s.careerPositionId) positionSet.add(s.careerPositionId);
  });
  return [
    {
      icon: Files,
      value: scenarios.value.length,
      label: '实践场景',
      gradient: 'linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-2))'
    },
    {
      icon: List,
      value: totalTasks,
      label: '任务总数',
      gradient: 'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))'
    },
    {
      icon: OfficeBuilding,
      value: industrySet.size,
      label: '覆盖行业',
      gradient: 'linear-gradient(135deg, var(--el-color-primary-light-2), var(--el-color-primary-light-4))'
    },
    {
      icon: Briefcase,
      value: positionSet.size,
      label: '关联岗位',
      gradient: 'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))'
    }
  ];
});

// ===== 交互 =====
watch([selectedIndustry, selectedPosition, selectedProfession, selectedDifficulty, keyword, sort], () => {
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

function handlePositionChange(value: string) {
  selectedPosition.value = value;
  currentPage.value = 1;
}

function handleProfessionChange(value: string) {
  selectedProfession.value = value;
  currentPage.value = 1;
}

function handleDifficultyChange(value: string) {
  selectedDifficulty.value = value;
  currentPage.value = 1;
}

function removeFilter(type: string) {
  if (type === 'industry') selectedIndustry.value = '全部';
  if (type === 'position') selectedPosition.value = '全部';
  if (type === 'profession') selectedProfession.value = '全部';
  if (type === 'difficulty') selectedDifficulty.value = '全部';
  if (type === 'keyword') keyword.value = '';
  currentPage.value = 1;
}

function clearFilters() {
  selectedIndustry.value = '全部';
  selectedPosition.value = '全部';
  selectedProfession.value = '全部';
  selectedDifficulty.value = '全部';
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

/* ===== 卡片网格 ===== */
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

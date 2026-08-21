<template>
  <div class="landing">
    <!-- ===== Hero ===== -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">
          <el-icon><MagicStick /></el-icon>
          体系化课程 · 颗粒化知识管理
        </div>
        <h1 class="hero-title">
          课程教学管理平台
          <span class="hero-sub">从基础到进阶，系统提升专业能力</span>
        </h1>
        <p class="hero-desc">体系化课程设计、颗粒化知识点管理、多维度教学资源整合，让教与学更高效</p>
        <el-button class="hero-cta" round @click="executeSearch">
          浏览课程
          <el-icon class="hero-cta-icon"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </section>

    <!-- ===== 统计条 ===== -->
    <div class="stats-wrap">
      <div class="stats-bar">
        <div v-for="s in courseStats" :key="s.label" class="stat-item">
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
        <!-- 课程筛选 -->
        <div class="filter-card">
          <div class="filter-title">
            <span class="title-bar" />
            <el-icon><Filter /></el-icon>
            课程筛选
          </div>
          <LandingFilterRow
            v-if="industries.length > 1"
            label="行业"
            :items="industries"
            :selected="selectedIndustry"
            @update:selected="handleIndustryChange"
          />
          <LandingFilterRow
            v-if="batches.length > 1"
            label="批次"
            :items="batches"
            :selected="selectedBatch"
            :show-border="industries.length <= 1"
            @update:selected="handleBatchChange"
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
            placeholder="搜索课程名称、描述或专业"
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
          当前共展示 <b class="count-num">{{ filtered.length }}</b> 个课程
        </div>

        <!-- 加载骨架 -->
        <div v-if="loading" class="skeleton-grid">
          <div v-for="i in 12" :key="i" class="skeleton-card" />
        </div>

        <!-- 空态 -->
        <div v-else-if="filtered.length === 0" class="empty-state">
          <div class="empty-icon"><el-icon :size="30"><Search /></el-icon></div>
          <div class="empty-title">暂无匹配的课程</div>
          <div class="empty-hint">试试调整筛选条件或搜索关键词</div>
        </div>

        <template v-else>
          <!-- 体系课（分页） -->
          <div v-if="systemCourses.length > 0" class="mb-8">
            <div class="group-head">
              <h2 class="group-title">
                <span class="title-bar" />
                体系课
                <span class="group-count">({{ systemCourses.length }})</span>
              </h2>
            </div>
            <div class="card-grid">
              <CourseCard v-for="course in pageSystemCourses" :key="course.id" :course="course" />
            </div>
            <el-pagination
              v-if="totalPages > 1"
              v-model:current-page="currentPage"
              :page-size="CARDS_PER_PAGE"
              :total="systemCourses.length"
              layout="prev, pager, next"
              class="pagination"
              @current-change="onPageChange"
            />
          </div>

          <!-- 混合课 -->
          <div v-if="hybridCourses.length > 0" class="mb-8">
            <div class="group-head">
              <h2 class="group-title">
                <span class="title-bar" />
                混合课
                <span class="group-count">({{ hybridCourses.length }})</span>
              </h2>
            </div>
            <div class="card-grid">
              <CourseCard v-for="course in hybridCourses" :key="course.id" :course="course" />
            </div>
          </div>

          <!-- 颗粒课 -->
          <div v-if="granularCourses.length > 0">
            <div class="group-head">
              <h2 class="group-title">
                <span class="title-bar" />
                颗粒课
                <span class="group-count">({{ granularCourses.length }})</span>
              </h2>
            </div>
            <div class="card-grid">
              <CourseCard v-for="course in granularCourses" :key="course.id" :course="course" />
            </div>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { PropType } from 'vue';
import { ArrowRight, Close, Files, Filter, MagicStick, Notebook, Reading, School, Search } from '@element-plus/icons-vue';
import { courseApi } from '@/api/lesson';
import type { ListResponse } from '@/api/http';
import type { Course } from '@/types/lesson';
import { coverGradientFor, formatDate } from './lesson-landing-types';
import LandingFilterRow from './LandingFilterRow.vue';

const CARDS_PER_PAGE = 12;

const SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'recent', label: '最近收录' },
  { value: 'update', label: '最近更新' }
];

// ===== 分页全量拉取（对齐 React fetchAllPages：后端列表有分页上限，需分页合并避免静默截断） =====
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

// ===== 数据 =====
const courses = ref<Course[]>([]);
const loading = ref(true);
const currentPage = ref(1);
const sort = ref('default');
const keyword = ref('');
const selectedIndustry = ref('全部');
const selectedBatch = ref('全部');
const listRef = ref<HTMLElement | null>(null);
let searchTimer: number | null = null;

async function fetchData() {
  loading.value = true;
  try {
    const res = await fetchAllPages((page, pageSize) =>
      courseApi.list({ status: 'published', limit: pageSize, offset: page * pageSize })
    );
    courses.value = res || [];
  } catch {
    courses.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
onUnmounted(() => {
  if (searchTimer) window.clearTimeout(searchTimer);
});

// ===== 派生数据 =====
const industries = computed(() => {
  const set = new Set<string>();
  courses.value.forEach((c) => {
    if (c.industryName) set.add(c.industryName);
  });
  return ['全部', ...Array.from(set).sort()];
});

const batches = computed(() => {
  const set = new Set<string>();
  courses.value.forEach((c) => {
    if (c.batchName) set.add(c.batchName);
  });
  return ['全部', ...Array.from(set).sort()];
});

const filtered = computed(() => {
  let list = [...courses.value];

  if (keyword.value.trim()) {
    const k = keyword.value.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(k) ||
        (c.description || '').toLowerCase().includes(k) ||
        (c.majorName || '').toLowerCase().includes(k)
    );
  }
  if (selectedIndustry.value !== '全部') {
    list = list.filter((c) => c.industryName === selectedIndustry.value);
  }
  if (selectedBatch.value !== '全部') {
    list = list.filter((c) => c.batchName === selectedBatch.value);
  }

  switch (sort.value) {
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

const systemCourses = computed(() => filtered.value.filter((c) => c.type === 'system'));
const granularCourses = computed(() => filtered.value.filter((c) => c.type === 'granular'));
const hybridCourses = computed(() => filtered.value.filter((c) => c.type === 'hybrid'));

const totalPages = computed(() => Math.max(1, Math.ceil(systemCourses.value.length / CARDS_PER_PAGE)));
const pageSystemCourses = computed(() => {
  const start = (currentPage.value - 1) * CARDS_PER_PAGE;
  return systemCourses.value.slice(start, start + CARDS_PER_PAGE);
});

const activeFilters = computed(() => {
  const filters: { type: string; label: string }[] = [];
  if (selectedIndustry.value !== '全部')
    filters.push({ type: 'industry', label: `行业：${selectedIndustry.value}` });
  if (selectedBatch.value !== '全部')
    filters.push({ type: 'batch', label: `批次：${selectedBatch.value}` });
  if (keyword.value.trim())
    filters.push({ type: 'keyword', label: `关键词：${keyword.value.trim()}` });
  return filters;
});

const totalNodes = computed(() => courses.value.reduce((sum, c) => sum + (c.nodeCount || 0), 0));
const totalResources = computed(() => courses.value.reduce((sum, c) => sum + (c.resourceCount || 0), 0));

const courseStats = computed(() => [
  {
    icon: Reading,
    value: systemCourses.value.length,
    label: '体系课',
    gradient: 'linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-2))'
  },
  {
    icon: Notebook,
    value: granularCourses.value.length,
    label: '颗粒课',
    gradient: 'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))'
  },
  {
    icon: Files,
    value: totalResources.value,
    label: '教学资源',
    gradient: 'linear-gradient(135deg, var(--el-color-primary-light-2), var(--el-color-primary-light-4))'
  },
  {
    icon: School,
    value: totalNodes.value,
    label: '课程节点',
    gradient: 'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))'
  }
]);

// ===== 交互 =====
// 筛选/排序/关键词变化重置页码（对齐 React useEffect setCurrentPage(1)）
watch([selectedIndustry, selectedBatch, keyword, sort], () => {
  currentPage.value = 1;
});

function executeSearch() {
  currentPage.value = 1;
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    listRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
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

function handleBatchChange(value: string) {
  selectedBatch.value = value;
  currentPage.value = 1;
}

function removeFilter(type: string) {
  if (type === 'industry') selectedIndustry.value = '全部';
  if (type === 'batch') selectedBatch.value = '全部';
  if (type === 'keyword') keyword.value = '';
  currentPage.value = 1;
}

function clearFilters() {
  selectedIndustry.value = '全部';
  selectedBatch.value = '全部';
  keyword.value = '';
  currentPage.value = 1;
}

// ===== 课程卡片（对齐 React CourseCard） =====
const CourseCard = defineComponent({
  name: 'CourseCard',
  props: {
    course: { type: Object as PropType<Course>, required: true }
  },
  setup(props) {
    return () => {
      const course = props.course;
      const creatorName = course.creatorName || course.creatorId?.slice(0, 8) || '-';
      const coverStyle = course.coverImage
        ? { backgroundImage: `url('${course.coverImage}')` }
        : { background: coverGradientFor(course.id) };
      return h(
        'a',
        {
          class: 'course-card-link',
          href: `/lesson/landing/${course.id}`
        },
        [
          h('div', { class: 'course-card' }, [
            h(
              'div',
              { class: 'course-cover', style: coverStyle },
              [
                !course.coverImage
                  ? h('div', { class: 'course-cover-icon' }, [h(Reading, { size: 48, strokeWidth: 1.5 })])
                  : null,
                h(
                  'div',
                  { class: 'course-cover-badges' },
                  [
                    h('span', { class: 'course-cover-badge' }, course.version || 'V1.0'),
                    h('span', { class: 'course-cover-badge' }, `创建人：${creatorName}`)
                  ]
                ),
                h('div', { class: 'course-cover-body' }, [
                  h('div', { class: 'course-cover-name' }, course.name),
                  h('div', { class: 'course-cover-code' }, `课程编码：${course.code || course.id.slice(0, 8)}`)
                ])
              ]
            ),
            h('div', { class: 'course-body' }, [
              h(
                'div',
                { class: 'course-stats' },
                [
                  h('div', { class: 'course-stat' }, [
                    h('div', { class: 'course-stat-value' }, String(course.viewCount ?? 0)),
                    h('div', { class: 'course-stat-label' }, '浏览次数')
                  ]),
                  h('div', { class: 'course-stat' }, [
                    h('div', { class: 'course-stat-value' }, String(course.nodeCount)),
                    h('div', { class: 'course-stat-label' }, '关联节点')
                  ]),
                  h('div', { class: 'course-stat' }, [
                    h('div', { class: 'course-stat-value' }, String(course.resourceCount)),
                    h('div', { class: 'course-stat-label' }, '关联资源')
                  ])
                ]
              ),
              h(
                'div',
                { class: 'course-tags' },
                [
                  h('span', { class: 'course-tag course-tag-industry' }, `面向行业：${course.industryName || '未分类'}`),
                  h('span', { class: 'course-tag course-tag-major' }, `适用专业：${course.majorName || '未分类'}`)
                ]
              ),
              h('div', { class: 'course-dates' }, [
                h('span', { class: 'course-date' }, `收录：${formatDate(course.createdAt)}`),
                h('span', { class: 'course-date' }, `更新：${formatDate(course.updatedAt)}`)
              ])
            ])
          ])
        ]
      );
    };
  }
});
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

/* ===== 分组标题 ===== */
.mb-8 {
  margin-bottom: 32px;
}
.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.group-count {
  font-size: 13px;
  color: #64748b;
  font-weight: 400;
  margin-left: 4px;
}

/* ===== 课程卡片 ===== */
.course-card-link {
  display: block;
  text-decoration: none;
  color: inherit;
  height: 100%;
}
.course-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e7e5e4;
  transition: all 0.3s;
  cursor: pointer;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.course-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary-light-7);
}
.course-cover {
  position: relative;
  height: 176px;
  background-size: cover;
  background-position: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
  box-sizing: border-box;
}
.course-cover-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.85);
}
.course-cover-badges {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  gap: 6px;
}
.course-cover-badge {
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  color: #fff;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.course-cover-body {
  position: relative;
  z-index: 10;
}
.course-cover-name {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 4px;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.course-cover-code {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.course-body {
  padding: 16px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.course-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.course-stat {
  background: #f8fafc;
  border-radius: 12px;
  padding: 8px 10px;
  text-align: center;
  border: 1px solid #f1f5f9;
}
.course-stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}
.course-stat-label {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
.course-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.course-tag {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 500;
}
.course-tag-industry {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #ffedd5;
}
.course-tag-major {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
}
.course-dates {
  margin-top: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
}
.course-date {
  font-size: 12px;
  color: #64748b;
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

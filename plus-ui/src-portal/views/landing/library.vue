<template>
  <div class="landing">
    <!-- ===== Hero ===== -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">
          <el-icon><MagicStick /></el-icon>
          教学资产 · 一站式共享
        </div>
        <h1 class="hero-title">
          教学资产共享中心
          <span class="hero-sub">汇聚教学资源，服务一线教师</span>
        </h1>
        <p class="hero-desc">汇聚视频、文档、软件、场地等教学资源，为教师提供一站式资源共享服务</p>
        <el-button class="hero-cta" round @click="executeSearch">
          浏览资源
          <el-icon class="hero-cta-icon"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </section>

    <!-- ===== 统计条（热门资源类型 Top4） ===== -->
    <div v-if="topTypes.length" class="stats-wrap">
      <div class="stats-bar">
        <div v-for="(s, i) in topTypes" :key="s.type" class="stat-item">
          <div class="stat-icon" :style="{ background: STAT_GRADIENTS[i % STAT_GRADIENTS.length] }">
            <el-icon :size="22"><component :is="s.icon" /></el-icon>
          </div>
          <div class="stat-text">
            <div class="stat-value">{{ s.count.toLocaleString() }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <main class="landing-main">
      <!-- 首屏加载失败提示 -->
      <div v-if="loadError" class="error-banner">资源加载失败，请刷新重试</div>

      <!-- 筛选 + 工具栏 + 列表（滚动目标） -->
      <div ref="listRef" class="list-anchor">
        <!-- 资源筛选 -->
        <div class="filter-card">
          <div class="filter-title">
            <span class="title-bar" />
            <el-icon><Filter /></el-icon>
            资源筛选
          </div>
          <LandingFilterRow
            label="分类"
            :items="typeFilterItems"
            :selected="typeFilter === '全部' ? '全部' : typeLabel(typeFilter)"
            @update:selected="handleTypeChange"
          />
          <LandingFilterRow
            label="时间"
            :items="timeLabels"
            :selected="timeLabel(timeFilter)"
            @update:selected="handleTimeChange"
          />
          <LandingFilterRow
            label="院系"
            :items="orgItems"
            :selected="orgFilter"
            @update:selected="handleOrgChange"
          />
          <LandingFilterRow
            label="专业"
            :items="majorItems"
            :selected="majorFilter"
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
              :class="['sort-tab', { active: sortBy === o.value }]"
              @click="handleSortChange(o.value)"
            >
              {{ o.label }}
            </button>
          </div>
          <el-input
            v-model="keyword"
            class="search-input"
            placeholder="搜索视频、文档、软件、场地等教学资源..."
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
          当前共展示 <b class="count-num">{{ filteredResources.length }}</b> 个资源
        </div>

        <!-- 加载骨架 -->
        <div v-if="loading" class="skeleton-grid">
          <div v-for="i in 12" :key="i" class="skeleton-card" />
        </div>

        <!-- 空态 -->
        <div v-else-if="filteredResources.length === 0" class="empty-state">
          <div class="empty-icon"><el-icon :size="30"><Search /></el-icon></div>
          <div class="empty-title">暂无符合条件的资源</div>
          <div class="empty-hint">试试调整筛选条件或搜索关键词</div>
        </div>

        <!-- 资源卡片列表 + 分页 -->
        <template v-else>
          <div class="card-grid">
            <div
              v-for="resource in pageResources"
              :key="resource.id"
              class="resource-card"
              :class="{ 'is-disabled': !resource.url }"
              @click="openPreview(resource)"
            >
              <div class="card-cover" :style="coverStyle(resource)">
                <el-icon v-if="!resource.thumbnail" class="card-cover-icon">
                  <component :is="typeIcon(resource.resourceType)" />
                </el-icon>
                <span class="card-chip">
                  {{ RESOURCE_TYPE_LABELS[resource.resourceType] || resource.resourceType }}
                </span>
              </div>
              <div class="card-body">
                <h3 class="card-name" :title="resource.name">{{ resource.name }}</h3>

                <div
                  v-if="resource.uploaderOrgName || resource.uploaderMajorName"
                  class="card-org-meta"
                >
                  <span v-if="resource.uploaderOrgName" class="card-meta-item">
                    <el-icon><OfficeBuilding /></el-icon>{{ resource.uploaderOrgName }}
                  </span>
                  <span v-if="resource.uploaderMajorName" class="card-meta-item">
                    <el-icon><School /></el-icon>{{ resource.uploaderMajorName }}
                  </span>
                </div>

                <p v-if="resource.description" class="card-desc">{{ resource.description }}</p>

                <div class="card-footer">
                  <span class="card-meta-item">
                    <el-icon><Clock /></el-icon>{{ formatDateShort(resource.createdAt) }}
                  </span>
                  <span v-if="resource.fileSize != null" class="card-meta-item">
                    {{ formatSize(resource.fileSize) }}
                  </span>
                  <span
                    v-if="resource.url"
                    class="card-more"
                    :style="{ color: typeColor(resource.resourceType) }"
                  >
                    预览 <el-icon><View /></el-icon>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <el-pagination
            v-if="totalPages > 1"
            v-model:current-page="currentPage"
            :page-size="CARDS_PER_PAGE"
            :total="filteredResources.length"
            layout="prev, pager, next"
            class="pagination"
            @current-change="onPageChange"
          />
        </template>
      </div>
    </main>

    <!-- ===== 资源预览弹窗（对齐 React ResourcePreviewModal 简化版，沿用 lesson-detail 预览模式） ===== -->
    <el-dialog v-model="previewOpen" width="860px" top="6vh" class="lib-dialog">
      <template #header>
        <div class="lib-dialog-head">
          <span class="lib-dialog-title">{{ previewResource?.name || '资源预览' }}</span>
          <a
            v-if="previewResource && isSafeExternalUrl(previewResource.url)"
            :href="previewResource.url"
            target="_blank"
            rel="noopener noreferrer"
            class="lib-dialog-link"
          >
            <el-icon><TopRight /></el-icon>新窗口打开
          </a>
        </div>
      </template>
      <div class="lib-preview-body">
        <img
          v-if="previewResource && previewResource.resourceType === 'image' && previewDisplaySrc"
          :src="previewDisplaySrc"
          :alt="previewResource.name"
          class="lib-preview-img"
        />
        <video
          v-else-if="previewResource && previewResource.resourceType === 'video' && previewDisplaySrc"
          :src="previewDisplaySrc"
          controls
          class="lib-preview-media"
        />
        <audio
          v-else-if="previewResource && previewResource.resourceType === 'audio' && previewDisplaySrc"
          :src="previewDisplaySrc"
          controls
          class="lib-preview-audio"
        />
        <iframe
          v-else-if="previewIframeSrc"
          :src="previewIframeSrc"
          :title="previewResource?.name"
          class="lib-preview-iframe"
          allowfullscreen
        />
        <div
          v-else-if="previewResource && isSafeExternalUrl(previewResource.url)"
          class="lib-preview-external"
        >
          <el-icon :size="40" class="lib-preview-external-icon"><Link /></el-icon>
          <p>该链接无法内嵌预览，请点击右上角「新窗口打开」</p>
        </div>
        <div v-else class="lib-preview-loading">
          <el-icon :size="40" class="lib-preview-external-icon"><Document /></el-icon>
          <p>加载中…</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Component } from 'vue';
import {
  ArrowRight,
  Box,
  Close,
  Clock,
  Document,
  Filter,
  Grid,
  Headset,
  Link,
  MagicStick,
  Monitor,
  OfficeBuilding,
  Picture,
  QuestionFilled,
  School,
  Search,
  SetUp,
  TopRight,
  VideoPlay,
  View
} from '@element-plus/icons-vue';
import { resourceLibraryApi } from '@/api/library';
import { request } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { RESOURCE_TYPE_LABELS } from '@/types/library';
import type { ResourceKind, ResourceLibraryItem } from '@/types/library';
import LandingFilterRow from './LandingFilterRow.vue';

const CARDS_PER_PAGE = 12;

const SORT_OPTIONS = [
  { value: 'newest', label: '最新' },
  { value: 'popular', label: '热门' }
];

// 资源类型展示顺序（与共享 RESOURCE_TYPE_LABELS 对应）
const ALL_TYPES = Object.keys(RESOURCE_TYPE_LABELS) as ResourceKind[];

// 类型筛选 chip 的表情前缀（对齐 React TYPE_EMOJI）
const TYPE_EMOJI: Record<string, string> = {
  video: '🎬',
  document: '📄',
  spreadsheet: '📊',
  image: '🖼️',
  link: '🔗',
  audio: '🎵',
  archive: '📦',
  venue: '📍',
  facility: '🔧',
  software: '💻',
  other: '📦'
};

// 资源类型配色（对齐 React LIBRARY_LANDING_TYPE_COLORS）
const TYPE_COLORS: Record<string, string> = {
  video: '#3b82f6',
  document: '#f97316',
  spreadsheet: '#22c55e',
  image: '#a855f7',
  link: '#06b6d4',
  audio: '#ec4899',
  venue: '#ef4444',
  facility: '#64748b',
  software: '#6366f1',
  archive: '#14b8a6',
  other: '#78716c'
};

// 资源类型图标（对齐 React LIBRARY_LANDING_TYPE_ICONS，用 Element Plus 图标替代 lucide）
const TYPE_ICONS: Record<string, Component> = {
  video: VideoPlay,
  document: Document,
  spreadsheet: Grid,
  image: Picture,
  link: Link,
  audio: Headset,
  archive: Box,
  venue: OfficeBuilding,
  facility: SetUp,
  software: Monitor,
  other: QuestionFilled
};

const STAT_GRADIENTS = [
  'linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-2))',
  'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))',
  'linear-gradient(135deg, var(--el-color-primary-light-2), var(--el-color-primary-light-4))',
  'linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary-light-3))'
];

const TIME_RANGES = [
  { value: 'all', label: '全部时间' },
  { value: 'week', label: '近一周' },
  { value: 'month', label: '近一月' },
  { value: 'year', label: '近一年' }
];

function typeColor(t: ResourceKind): string {
  return TYPE_COLORS[t] || TYPE_COLORS.other;
}

function typeIcon(t: ResourceKind): Component {
  return TYPE_ICONS[t] || TYPE_ICONS.other;
}

// ===== 分页全量拉取（对齐 React fetchAllPages：后端列表 maxPageSize 上限 200，需分页合并避免静默截断） =====
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
const resources = ref<ResourceLibraryItem[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const keyword = ref('');
const typeFilter = ref<string>('全部');
const timeFilter = ref('all');
const orgFilter = ref('全部');
const majorFilter = ref('全部');
const sortBy = ref<'newest' | 'popular'>('newest');
const currentPage = ref(1);
const listRef = ref<HTMLElement | null>(null);
let searchTimer: number | null = null;
let nowTimer: number | null = null;

// 周期刷新时间基准，避免页面长驻时"近一周/近一月"时间筛选窗口随挂载时刻漂移失真（对齐 React）
const now = ref(Date.now());

async function fetchData() {
  loading.value = true;
  loadError.value = null;
  try {
    const items = await fetchAllPages((page, pageSize) =>
      resourceLibraryApi.list({ limit: pageSize, offset: page * pageSize })
    );
    resources.value = items || [];
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
  nowTimer = window.setInterval(() => {
    now.value = Date.now();
  }, 60_000);
});

onUnmounted(() => {
  if (searchTimer) window.clearTimeout(searchTimer);
  if (nowTimer) window.clearInterval(nowTimer);
});

// ===== 派生数据 =====
const typeFilterItems = computed(() => [
  '全部',
  ...ALL_TYPES.map((ty) => `${TYPE_EMOJI[ty] || '📦'} ${RESOURCE_TYPE_LABELS[ty] || ty}`)
]);

const timeLabels = computed(() => TIME_RANGES.map((r) => r.label));

function typeLabel(type: string): string {
  if (type === '全部') return '全部';
  const idx = ALL_TYPES.indexOf(type as ResourceKind);
  return idx >= 0 ? typeFilterItems.value[idx + 1] : type;
}

function typeFromLabel(label: string): string {
  if (label === '全部') return '全部';
  return (
    ALL_TYPES.find(
      (ty) => `${TYPE_EMOJI[ty] || '📦'} ${RESOURCE_TYPE_LABELS[ty] || ty}` === label
    ) || '全部'
  );
}

function timeLabel(value: string): string {
  return TIME_RANGES.find((r) => r.value === value)?.label || '全部时间';
}

function timeFromLabel(label: string): string {
  return TIME_RANGES.find((r) => r.label === label)?.value || 'all';
}

const typeStats = computed(() => {
  const stats: Record<string, number> = {};
  for (const r of resources.value) {
    stats[r.resourceType] = (stats[r.resourceType] || 0) + 1;
  }
  stats.total = resources.value.length;
  return stats;
});

const orgNames = computed(() => {
  const set = new Set<string>();
  for (const r of resources.value) {
    if (r.uploaderOrgName) set.add(r.uploaderOrgName);
  }
  return Array.from(set).sort();
});

const majorNames = computed(() => {
  const set = new Set<string>();
  if (orgFilter.value === '全部') {
    for (const r of resources.value) {
      if (r.uploaderMajorName) set.add(r.uploaderMajorName);
    }
  } else {
    for (const r of resources.value) {
      if (r.uploaderOrgName === orgFilter.value && r.uploaderMajorName) set.add(r.uploaderMajorName);
    }
  }
  return Array.from(set).sort();
});

const topTypes = computed(() =>
  ALL_TYPES.filter((t) => (typeStats.value[t] || 0) > 0)
    .map((t) => ({
      type: t,
      count: typeStats.value[t] || 0,
      icon: typeIcon(t),
      label: RESOURCE_TYPE_LABELS[t] || t
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
);

const orgItems = computed(() => ['全部', ...orgNames.value]);
const majorItems = computed(() =>
  orgFilter.value === '全部' ? ['全部'] : ['全部', ...majorNames.value]
);

const filteredResources = computed(() => {
  let list = resources.value;
  if (typeFilter.value !== '全部') {
    list = list.filter((r) => r.resourceType === typeFilter.value);
  }
  if (timeFilter.value !== 'all') {
    const ms =
      timeFilter.value === 'week'
        ? 7 * 86400000
        : timeFilter.value === 'month'
          ? 30 * 86400000
          : 365 * 86400000;
    list = list.filter((r) => now.value - new Date(r.createdAt).getTime() < ms);
  }
  if (orgFilter.value !== '全部') {
    list = list.filter((r) => r.uploaderOrgName === orgFilter.value);
  }
  if (majorFilter.value !== '全部') {
    list = list.filter((r) => r.uploaderMajorName === majorFilter.value);
  }
  if (keyword.value.trim()) {
    const q = keyword.value.toLowerCase();
    list = list.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
    );
  }
  if (sortBy.value === 'popular') {
    list = [...list].sort(
      (a, b) =>
        (Number(b.metadata?.viewCount) || 0) - (Number(a.metadata?.viewCount) || 0) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else {
    list = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  return list;
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredResources.value.length / CARDS_PER_PAGE))
);

const pageResources = computed(() => {
  const start = (currentPage.value - 1) * CARDS_PER_PAGE;
  return filteredResources.value.slice(start, start + CARDS_PER_PAGE);
});

const activeFilters = computed(() => {
  const filters: { type: string; label: string }[] = [];
  if (typeFilter.value !== '全部')
    filters.push({ type: 'type', label: `分类：${typeLabel(typeFilter.value)}` });
  if (timeFilter.value !== 'all')
    filters.push({ type: 'time', label: `时间：${timeLabel(timeFilter.value)}` });
  if (orgFilter.value !== '全部')
    filters.push({ type: 'org', label: `院系：${orgFilter.value}` });
  if (majorFilter.value !== '全部')
    filters.push({ type: 'major', label: `专业：${majorFilter.value}` });
  if (keyword.value.trim())
    filters.push({ type: 'keyword', label: `关键词：${keyword.value.trim()}` });
  return filters;
});

// ===== 交互 =====
// 筛选/排序/关键词变化重置页码（对齐 React useEffect setCurrentPage(1)）
watch([typeFilter, keyword, timeFilter, orgFilter, majorFilter, sortBy], () => {
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
  sortBy.value = value as 'newest' | 'popular';
  currentPage.value = 1;
}

function handleTypeChange(value: string) {
  typeFilter.value = typeFromLabel(value);
  currentPage.value = 1;
}

function handleTimeChange(value: string) {
  timeFilter.value = timeFromLabel(value);
  currentPage.value = 1;
}

function handleOrgChange(value: string) {
  orgFilter.value = value;
  majorFilter.value = '全部';
  currentPage.value = 1;
}

function handleMajorChange(value: string) {
  majorFilter.value = value;
  currentPage.value = 1;
}

function removeFilter(type: string) {
  if (type === 'type') typeFilter.value = '全部';
  if (type === 'time') timeFilter.value = 'all';
  if (type === 'org') orgFilter.value = '全部';
  if (type === 'major') majorFilter.value = '全部';
  if (type === 'keyword') keyword.value = '';
  currentPage.value = 1;
}

function clearFilters() {
  keyword.value = '';
  typeFilter.value = '全部';
  timeFilter.value = 'all';
  orgFilter.value = '全部';
  majorFilter.value = '全部';
  currentPage.value = 1;
}

// ===== 卡片封面 =====
function coverStyle(r: ResourceLibraryItem) {
  if (r.thumbnail) {
    return {
      backgroundImage: `url('${r.thumbnail}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  }
  const color = typeColor(r.resourceType);
  return { background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #0f172a))` };
}

function formatDateShort(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ===== 资源预览（对齐 React ResourcePreviewModal 的 kkfileview 路径，简化交互） =====
const previewOpen = ref(false);
const previewResource = ref<ResourceLibraryItem | null>(null);
const previewDisplaySrc = ref<string | null>(null);

function buildKkFileViewUrl(fileUrl: string): string {
  const origin = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';
  return `/kkfileview/onlinePreview?url=${btoa(`${origin}${fileUrl}`)}`;
}

function isSafeExternalUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function openPreview(r: ResourceLibraryItem) {
  if (!r.url) return;
  previewResource.value = r;
  previewDisplaySrc.value = null;
  previewOpen.value = true;
  // 本系统上传文件先换取短时签名 URL（kkFileView 服务端抓取无登录态），失败回退原 URL
  if (r.url.startsWith('/uploads/')) {
    try {
      const res = await request<{ url: string }>(`/files/sign-url?name=${encodeURIComponent(r.url)}`);
      previewDisplaySrc.value = res.url;
    } catch {
      previewDisplaySrc.value = r.url;
    }
  } else {
    previewDisplaySrc.value = r.url;
  }
}

const previewIframeSrc = computed(() => {
  const src = previewDisplaySrc.value;
  if (!src) return null;
  const r = previewResource.value;
  if (!r) return null;
  if (r.resourceType === 'image' || r.resourceType === 'video' || r.resourceType === 'audio') {
    return null;
  }
  if (src.startsWith('/uploads/')) return buildKkFileViewUrl(src);
  if (isSafeExternalUrl(src)) return null;
  return src;
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
.error-banner {
  margin-bottom: 20px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 14px;
  padding: 14px 18px;
  font-size: 14px;
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
  height: 300px;
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

.resource-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.3s;
  cursor: pointer;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.resource-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.1);
  border-color: var(--el-color-primary-light-5);
}
.resource-card.is-disabled {
  opacity: 0.85;
  cursor: default;
}
.card-cover {
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
  background-size: cover;
  background-position: center;
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
  padding: 16px 18px 18px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-name {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-org-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 11px;
  color: #94a3b8;
}
.card-desc {
  margin: 0 0 12px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f8fafc;
  font-size: 11px;
  color: #cbd5e1;
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  white-space: nowrap;
}
.card-more .el-icon {
  font-size: 12px;
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

/* ===== 预览弹窗 ===== */
.lib-dialog :deep(.el-dialog__header) {
  padding: 0;
  margin: 0;
}
.lib-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 2px;
}
.lib-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lib-dialog-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-primary);
  text-decoration: none;
  font-size: 13px;
  flex-shrink: 0;
}
.lib-dialog-link:hover {
  opacity: 0.85;
}
.lib-preview-body {
  height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 12px;
  overflow: hidden;
}
.lib-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.lib-preview-media {
  width: 100%;
  max-height: 100%;
}
.lib-preview-audio {
  width: 100%;
}
.lib-preview-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
.lib-preview-external,
.lib-preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
  font-size: 14px;
  text-align: center;
  padding: 24px;
}
.lib-preview-external-icon {
  color: #94a3b8;
}
</style>

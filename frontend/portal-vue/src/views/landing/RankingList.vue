<template>
  <!-- 收藏岗位排行榜：对齐原 React 版 ranking-list -->
  <div v-if="ranked.length === 0" class="rank-card">
    <div class="rank-header">
      <span class="rank-title-bar" />
      <el-icon class="rank-title-icon"><Trophy /></el-icon>
      收藏岗位排行榜
    </div>
    <div class="rank-empty">暂无岗位数据</div>
  </div>

  <div v-else class="rank-card">
    <div class="rank-header">
      <div class="rank-title-group">
        <span class="rank-title-bar" />
        <el-icon class="rank-title-icon"><Trophy /></el-icon>
        收藏岗位排行榜
      </div>
      <div class="rank-pager">
        <el-button class="rank-page-btn" size="small" :disabled="activePage <= 0" @click="page = activePage - 1">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="rank-page-info">{{ activePage + 1 }} / {{ totalPages }}</span>
        <el-button class="rank-page-btn" size="small" :disabled="activePage >= totalPages - 1" @click="page = activePage + 1">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="rank-grid">
      <router-link
        v-for="(pos, idx) in pageItems"
        :key="pos.id"
        :to="`/job/landing/${pos.id}`"
        class="rank-item"
      >
        <span class="rank-badge" :class="rankStyle(activePage * rowsPerPage + idx + 1)">
          {{ activePage * rowsPerPage + idx + 1 }}
        </span>
        <div class="rank-info">
          <div class="rank-line">
            <span class="rank-name">{{ pos.shortName || pos.name }}</span>
            <span class="rank-count" :class="{ 'rank-count-active': (pos.favoriteCount ?? 0) > 0 }">
              <el-icon class="rank-count-icon">
                <StarFilled v-if="(pos.favoriteCount ?? 0) > 0" />
                <Star v-else />
              </el-icon>
              {{ formatCount(pos.favoriteCount) }}
            </span>
          </div>
          <div class="rank-tags">
            <span class="rank-tag rank-tag-cat">{{ categoryFor(pos) }}</span>
            <template v-if="(pos.majorNames || []).filter(Boolean).length === 0">
              <span class="rank-tag rank-tag-major">未分类</span>
            </template>
            <template v-else>
              <span v-for="m in (pos.majorNames || []).filter(Boolean)" :key="m" class="rank-tag rank-tag-major">{{ m }}</span>
            </template>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ArrowLeft, ArrowRight, Star, StarFilled, Trophy } from '@element-plus/icons-vue';
import type { CareerPosition } from '@/types/job';

const props = withDefaults(
  defineProps<{
    positions?: CareerPosition[];
    industryMap?: Map<string, string>;
  }>(),
  {
    positions: () => [],
    industryMap: () => new Map<string, string>()
  }
);

const ROWS_PER_PAGE = 5;

// 移动端单列每页 5 行，桌面端双列每页 10 行（对齐 React matchMedia('(max-width: 639px)')）
const isMobile = ref(false);
let mql: MediaQueryList | null = null;
function syncMobile() {
  isMobile.value = window.matchMedia('(max-width: 639px)').matches;
}
onMounted(() => {
  syncMobile();
  mql = window.matchMedia('(max-width: 639px)');
  mql.addEventListener('change', syncMobile);
});
onUnmounted(() => {
  mql?.removeEventListener('change', syncMobile);
});

const page = ref(0);

const ranked = computed(() =>
  [...props.positions]
    .filter((p) => p.status === 'published')
    .sort((a, b) => {
      const countA = a.favoriteCount ?? 0;
      const countB = b.favoriteCount ?? 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name, 'zh-CN');
    })
);

const rowsPerPage = computed(() => (isMobile.value ? ROWS_PER_PAGE : ROWS_PER_PAGE * 2));
const totalPages = computed(() => Math.max(1, Math.ceil(ranked.value.length / rowsPerPage.value)));
// 视口切换导致每页行数变化时，在渲染期夹紧页码，避免空页
const activePage = computed(() => Math.min(page.value, totalPages.value - 1));
const pageItems = computed(() => {
  const start = activePage.value * rowsPerPage.value;
  return ranked.value.slice(start, start + rowsPerPage.value);
});

function rankStyle(rank: number): string {
  if (rank === 1) return 'rank-badge-gold';
  if (rank === 2) return 'rank-badge-silver';
  if (rank === 3) return 'rank-badge-bronze';
  return 'rank-badge-plain';
}

function formatCount(n?: number): string {
  if (!n || n <= 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toLocaleString();
}

function categoryFor(pos: CareerPosition): string {
  if (pos.industryId && props.industryMap.get(pos.industryId)) return props.industryMap.get(pos.industryId)!;
  return pos.positionType === 'enterprise' ? '企业' : '教学';
}
</script>

<style scoped>
.rank-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  padding: 20px;
}
.rank-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.rank-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}
.rank-title-bar {
  width: 4px;
  height: 20px;
  border-radius: 4px;
  background: linear-gradient(180deg, var(--el-color-primary-light-2), var(--el-color-primary));
  flex-shrink: 0;
}
.rank-title-icon {
  color: var(--el-color-primary);
  font-size: 16px;
}
.rank-pager {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rank-page-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  border-color: #e2e8f0;
  background: #fff;
  color: #64748b;
}
.rank-page-btn:hover:not([disabled]) {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.rank-page-btn.is-disabled {
  opacity: 0.4;
}
.rank-page-info {
  min-width: 40px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}
.rank-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px 16px;
}
@media (min-width: 640px) {
  .rank-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.rank-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--el-color-primary-light-8);
  background: var(--el-color-primary-light-9);
  transition: all 0.2s;
  text-decoration: none;
  color: inherit;
}
.rank-item:hover {
  background: var(--el-color-primary-light-8);
}
.rank-badge {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
  color: #94a3b8;
}
.rank-badge-gold {
  background: linear-gradient(135deg, #f59e0b, #fde047);
  color: #fff;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}
.rank-badge-silver {
  background: linear-gradient(135deg, #94a3b8, #cbd5e1);
  color: #fff;
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.3);
}
.rank-badge-bronze {
  background: linear-gradient(135deg, #d97706, #f59e0b);
  color: #fff;
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);
}
.rank-badge-plain {
  background: #f1f5f9;
  color: #94a3b8;
}
.rank-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rank-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rank-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}
.rank-item:hover .rank-name {
  color: var(--el-color-primary);
}
.rank-count {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 500;
  color: #f43f5e;
  white-space: nowrap;
}
.rank-count-active {
  color: #f43f5e;
}
.rank-count-icon {
  font-size: 12px;
}
.rank-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
}
.rank-tag {
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 500;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--el-color-primary-light-7);
  color: var(--el-color-primary);
}
.rank-tag-major {
  color: #059669;
  border-color: #d1fae5;
}
.rank-empty {
  text-align: center;
  padding: 24px 0;
  color: #94a3b8;
  font-size: 14px;
}
</style>

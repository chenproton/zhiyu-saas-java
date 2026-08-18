<template>
  <!-- 目标/收藏岗位侧边列表：对齐 React job-home.tsx 内联的 PositionSideLists。
       两个 tab 每 4 秒自动轮换，手动点击后重新计时。 -->
  <div class="side-card">
    <div class="side-header">
      <div class="side-tabs">
        <button
          type="button"
          :class="['side-tab', { 'side-tab-active': isRec, 'side-tab-yellow': isRec }]"
          @click="switchTab('recommended')"
        >
          <el-icon><Flag /></el-icon>
          目标岗位
        </button>
        <button
          type="button"
          :class="['side-tab', { 'side-tab-active': !isRec, 'side-tab-rose': !isRec }]"
          @click="switchTab('favorite')"
        >
          <el-icon><Star /></el-icon>
          收藏岗位
        </button>
      </div>
      <span class="side-count">{{ positions.length }} 个岗位</span>
    </div>

    <div v-if="positions.length === 0" class="side-empty">
      <el-icon class="side-empty-icon"><component :is="emptyIcon" /></el-icon>
      <div class="side-empty-text">{{ emptyText }}</div>
    </div>

    <div v-else class="side-list">
      <router-link
        v-for="pos in positions"
        :key="pos.id"
        :to="`/job/landing/${pos.id}`"
        class="side-item"
      >
        <div class="side-item-text">
          <span class="side-item-name" :class="isRec ? 'hover-yellow' : 'hover-rose'">{{ pos.shortName || pos.name }}</span>
          <span class="side-item-sub">
            适用专业：{{ pos.majorNames?.filter(Boolean)[0] || '未分类' }} · 更新：{{ formatDate(pos.updatedAt) }}
          </span>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Flag, Star } from '@element-plus/icons-vue';
import type { CareerPosition } from '@/types/job';
import { formatDate } from './evaluation-types';

const props = withDefaults(
  defineProps<{
    targetPositions?: CareerPosition[];
    favoritePositions?: CareerPosition[];
  }>(),
  {
    targetPositions: () => [],
    favoritePositions: () => []
  }
);

const activeTab = ref<'recommended' | 'favorite'>('recommended');
const tick = ref(0);

let timer: ReturnType<typeof setInterval> | null = null;
function startTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    activeTab.value = activeTab.value === 'recommended' ? 'favorite' : 'recommended';
  }, 4000);
}
// 手动切换后重置 4 秒计时（对齐 React useEffect [tick] 重建 interval）
watch(tick, startTimer);
onMounted(startTimer);
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function switchTab(tab: 'recommended' | 'favorite') {
  activeTab.value = tab;
  tick.value += 1;
}

const isRec = computed(() => activeTab.value === 'recommended');
const positions = computed(() => (isRec.value ? props.targetPositions : props.favoritePositions));
const emptyText = computed(() => (isRec.value ? '暂无目标岗位' : '快去收藏岗位吧！'));
const emptyIcon = computed(() => (isRec.value ? Flag : Star));
</script>

<style scoped>
.side-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  padding: 20px;
  color: #0f172a;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  height: 256px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
@media (min-width: 1024px) {
  .side-card {
    height: 340px;
  }
}
.side-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.side-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}
.side-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}
.side-tab:hover {
  color: #0f172a;
  background: #fff;
}
.side-tab-active {
  color: #fff;
  border: 1px solid transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.side-tab-yellow.side-tab-active {
  background: linear-gradient(135deg, #facc15, #f97316);
}
.side-tab-rose.side-tab-active {
  background: linear-gradient(135deg, #fb7185, #ec4899);
}
.side-count {
  margin-left: auto;
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}
.side-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 0;
}
.side-empty-icon {
  font-size: 36px;
  opacity: 0.4;
  color: #64748b;
}
.side-empty-text {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}
.side-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.side-list::-webkit-scrollbar {
  width: 4px;
}
.side-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}
.side-list::-webkit-scrollbar-track {
  background: transparent;
}
.side-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 12px;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
}
.side-item:hover {
  background: #f8fafc;
}
.side-item-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.side-item-name {
  font-size: 13px;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
}
.side-item:hover .hover-yellow {
  color: #d97706;
}
.side-item:hover .hover-rose {
  color: #e11d48;
}
.side-item-sub {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

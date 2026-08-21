<template>
  <div class="citation-panel">
    <div class="left-col">
      <div class="stat-card">
        <div class="stat-num">{{ statCount }}</div>
        <div class="stat-label">{{ statLabel }}</div>
      </div>
      <button type="button" class="zero-card" @click="dialogOpen = true">
        <div class="zero-num">{{ stats?.zeroCount ?? '-' }}</div>
        <div class="zero-label">零引用{{ entityLabel }}</div>
        <div class="zero-action">去管理 ›</div>
      </button>
    </div>

    <div class="chart-card">
      <div class="chart-head">
        <span class="chart-title">引用次数分布</span>
        <span class="chart-sub">共 {{ stats?.total ?? '-' }} 个{{ entityLabel }}</span>
      </div>
      <div v-if="chartData.length" class="bars">
        <div v-for="b in chartData" :key="b.label" class="bar-col">
          <span class="bar-count">{{ b.count }}</span>
          <div class="bar-track">
            <div class="bar" :style="{ height: barHeight(b.count) }"></div>
          </div>
          <span class="bar-label">{{ b.label }}</span>
        </div>
      </div>
      <div v-else class="chart-empty">暂无统计数据</div>
    </div>

    <UncitedResourcesDialog
      v-model="dialogOpen"
      :title="dialogTitle"
      :entity-label="entityLabel"
      :fetch-uncited="fetchUncited"
      :delete-item="deleteItem"
      @deleted="onUncitedDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import UncitedResourcesDialog from './UncitedResourcesDialog.vue';
import type { CitationStats, UncitedItem } from './types';

const props = defineProps<{
  entityLabel: string;
  dialogTitle: string;
  fetchStats: () => Promise<CitationStats>;
  fetchUncited: (params: {
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }) => Promise<{ items: UncitedItem[]; total: number }>;
  deleteItem: (id: string) => Promise<unknown>;
  statCount: number;
  statLabel: string;
}>();
const emit = defineEmits<{ (e: 'deleted'): void }>();

const stats = ref<CitationStats | null>(null);
const dialogOpen = ref(false);

const chartData = computed(() => stats.value?.buckets || []);
const maxCount = computed(() => Math.max(1, ...chartData.value.map((b) => b.count)));

function barHeight(count: number): string {
  if (count <= 0) return '2px';
  return `${Math.max(6, Math.round((count / maxCount.value) * 80))}px`;
}

async function loadStats(): Promise<void> {
  try {
    stats.value = await props.fetchStats();
  } catch {
    stats.value = null;
  }
}

function onUncitedDeleted(): void {
  emit('deleted');
  void loadStats();
}

onMounted(() => {
  void loadStats();
});
</script>

<style scoped>
.citation-panel {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.left-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 208px;
  flex-shrink: 0;
}
.stat-card {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eef2ff, #f5f7ff);
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}
.stat-label {
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.zero-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  background: linear-gradient(135deg, #fff1f2, #fff7ed);
  transition: background 0.2s;
}
.zero-card:hover {
  background: linear-gradient(135deg, #ffe4e6, #ffedd5);
}
.zero-num {
  font-size: 24px;
  font-weight: 700;
  color: #f43f5e;
}
.zero-label {
  font-size: 12px;
  color: #fb7185;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.zero-action {
  font-size: 11px;
  font-weight: 500;
  color: #f43f5e;
}
.chart-card {
  flex: 1;
  min-width: 0;
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #f1f5f9;
}
.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}
.chart-sub {
  font-size: 12px;
  color: #94a3b8;
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 112px;
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.bar-count {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
}
.bar-track {
  flex: 1;
  width: 100%;
  max-width: 40px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  background: #6366f1;
  min-height: 2px;
}
.bar-label {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 4px;
  white-space: nowrap;
}
.chart-empty {
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #cbd5e1;
}
</style>

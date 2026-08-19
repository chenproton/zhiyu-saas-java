<!--
  资源运营 Tab（学校管理员）。
  对齐 React frontend/edu/app/portal/workspace/_components/school-admin-resources-tab.tsx（206 行）：
  - 数据源：GET /portal/workspace/dashboard?role=school_admin（resourceStats / resourceGrowth / todos）；
  - 资源存量指标：6 张存量卡（图标 + 数量 + 名称）；
  - 资源增长趋势：岗位/场景/课程/题库/试卷/考试 各一张卡（今日新增 + 走势），空态「暂无增长数据」；
    React 用 recharts 折线，Vue 门户不引入新依赖，改用等价的内联 SVG 折线（同一份 resourceGrowth 数据，
    含首尾日期刻度与各点 title 悬浮值）；
  - 待审批资源：待审批总数 + 逐项计数，空态「暂无待审批」。
-->
<template>
  <div class="admin-resources">
    <!-- 资源存量指标 -->
    <div class="stock-grid">
      <div v-for="item in resourceStats" :key="item.label" class="stock-card">
        <span class="stock-icon">
          <el-icon :size="20"><component :is="resourceIcon(item.icon)" /></el-icon>
        </span>
        <div>
          <p class="stock-value">{{ item.value }}</p>
          <p class="stock-label">{{ item.label }}</p>
        </div>
      </div>
      <div v-if="resourceStats.length === 0" class="empty-line">暂无资源存量数据</div>
    </div>

    <div class="resources-grid">
      <div class="grid-main">
        <SectionCard title="资源增长趋势" :icon="TrendCharts" icon-color="blue">
          <div v-if="growth.length === 0" class="empty-line">暂无增长数据</div>
          <div v-else class="trend-grid">
            <div v-for="item in TREND_ITEMS" :key="item.key" class="trend-card">
              <div class="trend-head">
                <div class="trend-title">
                  <span
                    class="trend-icon"
                    :style="{ backgroundColor: `${item.color}1a`, color: item.color }"
                  >
                    <el-icon :size="16"><component :is="item.icon" /></el-icon>
                  </span>
                  <span class="trend-name">{{ item.label }}资源增长</span>
                </div>
                <div class="trend-latest">
                  <p class="trend-value" :style="{ color: item.color }">{{ latestOf(item.key) }}</p>
                  <p class="trend-hint">今日新增</p>
                </div>
              </div>

              <!-- 内联 SVG 折线（替代 React recharts LineChart，数据同源） -->
              <div class="trend-chart">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" class="spark">
                  <line x1="0" y1="20" x2="100" y2="20" class="spark-grid" />
                  <polyline :points="sparkPoints(item.key)" :stroke="item.color" class="spark-line" />
                  <circle
                    v-for="(pt, idx) in sparkDots(item.key)"
                    :key="idx"
                    :cx="pt.x"
                    :cy="pt.y"
                    r="1"
                    :fill="item.color"
                  >
                    <title>{{ pt.date }}：{{ pt.value }}</title>
                  </circle>
                </svg>
                <div class="spark-axis">
                  <span>{{ growth[0]?.date }}</span>
                  <span>{{ growth[growth.length - 1]?.date }}</span>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div class="grid-side">
        <SectionCard title="待审批资源" :icon="Tickets" icon-color="amber">
          <div class="pending-body">
            <div class="pending-total">
              <span class="pending-label">待审批总数</span>
              <el-tag size="small" type="danger" effect="light">{{ pendingCount }}</el-tag>
            </div>
            <div v-if="todos.length === 0" class="empty-line small">暂无待审批</div>
            <div v-for="item in todos" :key="item.id" class="pending-row">
              <span class="pending-name">{{ item.title }}</span>
              <el-tag size="small" type="info" effect="light">{{ item.count }}</el-tag>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { Component } from 'vue';
import {
  Briefcase,
  Checked,
  Coin,
  Collection,
  Document,
  Reading,
  Tickets,
  TrendCharts
} from '@element-plus/icons-vue';
import SectionCard from './SectionCard.vue';
import { workspaceDashboardApi } from './workspace-api';
import type {
  WorkspaceResourceGrowth,
  WorkspaceResourceStat,
  WorkspaceTodo
} from './workspace-api';

type GrowthKey = 'careerPositions' | 'scenarios' | 'courses' | 'questionBanks' | 'exams' | 'examUsages';

/** 后端下发的 icon key → Element Plus 图标（对齐 React iconMap） */
const ICON_MAP: Record<string, Component> = {
  'book-open': Reading,
  layers: Collection,
  briefcase: Briefcase,
  'file-text': Document,
  'check-circle': Checked
};

/** 六类资源趋势卡（对齐 React resourceTrendItems，含配色） */
const TREND_ITEMS: { key: GrowthKey; label: string; icon: Component; color: string }[] = [
  { key: 'careerPositions', label: '岗位', icon: Briefcase, color: '#8b5cf6' },
  { key: 'scenarios', label: '场景', icon: Collection, color: '#10b981' },
  { key: 'courses', label: '课程', icon: Reading, color: '#3b82f6' },
  { key: 'questionBanks', label: '题库', icon: Coin, color: '#06b6d4' },
  { key: 'exams', label: '试卷', icon: Document, color: '#f97316' },
  { key: 'examUsages', label: '考试', icon: Checked, color: '#ef4444' }
];

const resourceStats = ref<WorkspaceResourceStat[]>([]);
const todos = ref<WorkspaceTodo[]>([]);
const growth = ref<WorkspaceResourceGrowth[]>([]);

const pendingCount = computed(() => todos.value.reduce((acc, item) => acc + item.count, 0));

function resourceIcon(key?: string): Component {
  return ICON_MAP[key || ''] || Coin;
}

function seriesOf(key: GrowthKey): { date: string; value: number }[] {
  return growth.value.map((g) => ({ date: g.date, value: g[key] ?? 0 }));
}

function latestOf(key: GrowthKey): number {
  const series = seriesOf(key);
  return series[series.length - 1]?.value ?? 0;
}

/** 折线点：viewBox 100×40，纵向留 4 单位边距，全 0 时贴底 */
function sparkDots(key: GrowthKey): { x: number; y: number; date: string; value: number }[] {
  const series = seriesOf(key);
  if (series.length === 0) return [];
  const max = Math.max(...series.map((s) => s.value), 1);
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  return series.map((s, i) => ({
    x: series.length > 1 ? i * step : 50,
    y: 36 - (s.value / max) * 32,
    date: s.date,
    value: s.value
  }));
}

function sparkPoints(key: GrowthKey): string {
  return sparkDots(key)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

onMounted(async () => {
  try {
    const res = await workspaceDashboardApi.get({ role: 'school_admin' });
    resourceStats.value = res.resourceStats || [];
    todos.value = res.todos || [];
    growth.value = res.resourceGrowth || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载资源运营数据失败');
  }
});
</script>

<style scoped>
.admin-resources {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 存量卡 */
.stock-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 768px) {
  .stock-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .stock-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
.stock-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fff, rgba(249, 250, 251, 0.5));
  border: 1px solid #f3f4f6;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.stock-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.stock-value {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}
.stock-label {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

/* 主体 */
.resources-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 1024px) {
  .resources-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .grid-main { grid-column: span 3; }
}
.trend-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
@media (min-width: 640px) {
  .trend-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1280px) {
  .trend-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.trend-card {
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 16px;
}
.trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.trend-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.trend-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.trend-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trend-latest {
  text-align: right;
  flex-shrink: 0;
}
.trend-value {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}
.trend-hint {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}
.trend-chart {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.spark {
  width: 100%;
  height: 80px;
  overflow: visible;
}
.spark-grid {
  stroke: #f0f0f0;
  stroke-width: 0.5;
  stroke-dasharray: 3 3;
}
.spark-line {
  fill: none;
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}
.spark-axis {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: #94a3b8;
}

/* 待审批 */
.pending-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pending-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pending-label {
  font-size: 14px;
  color: #6b7280;
}
.pending-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
}
.pending-name {
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty-line {
  grid-column: 1 / -1;
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: #9ca3af;
}
.empty-line.small {
  padding: 16px 0;
  font-size: 12px;
}
</style>

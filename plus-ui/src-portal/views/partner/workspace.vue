<template>
  <div class="workspace" v-loading="loading">
    <!-- 顶部问候 + 企业徽标 -->
    <div class="ws-header">
      <div>
        <h2 class="ws-title">你好，{{ userName }}</h2>
        <p class="ws-sub">{{ enterprise?.name ? `欢迎回到 ${enterprise.name} 企业服务台` : '欢迎回到企业服务台' }}</p>
      </div>
      <div v-if="enterprise?.name" class="ws-enterprise">
        <img v-if="enterprise.logoUrl" :src="enterprise.logoUrl" :alt="enterprise.name" class="ws-logo" />
        <div v-else class="ws-logo ws-logo-fallback">
          <el-icon><OfficeBuilding /></el-icon>
        </div>
        <span class="ws-enterprise-name">{{ enterprise.name }}</span>
      </div>
    </div>

    <!-- 统计卡 -->
    <el-row :gutter="16" class="stat-row">
      <el-col v-for="card in statCards" :key="card.title" :xs="12" :sm="12" :md="6">
        <el-card shadow="never" class="stat-card" @click="go(card.href)">
          <div class="stat-inner">
            <div class="stat-icon" :style="{ background: card.bg, color: card.color }">
              <el-icon :size="22"><component :is="card.icon" /></el-icon>
            </div>
            <div class="stat-text">
              <div class="stat-label">{{ card.title }}</div>
              <div class="stat-value">{{ card.value }}</div>
              <div v-if="card.trend" class="stat-trend">{{ card.trend }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="section-card">
          <template #header>
            <div class="section-header">
              <span class="section-title">
                <el-icon class="section-icon" style="color:#6366f1"><Files /></el-icon>
                共建资源分布
              </span>
              <el-button link type="primary" size="small" @click="go('/partner/co-build/positions')">前往共建资源</el-button>
            </div>
          </template>
          <div v-if="resourceTotal > 0" class="resource-body">
            <div class="donut-wrap">
              <div class="donut" :style="{ background: donutGradient }">
                <div class="donut-hole">
                  <div class="donut-total">{{ resourceTotal }}</div>
                  <div class="donut-label">共建资源</div>
                </div>
              </div>
            </div>
            <div class="resource-legend">
              <div v-for="item in resourcePieData" :key="item.name" class="legend-row">
                <span class="legend-dot" :style="{ background: item.color }"></span>
                <span class="legend-name">{{ item.name }}</span>
                <el-tag size="small" type="info" effect="plain">{{ item.value }}</el-tag>
              </div>
            </div>
          </div>
          <div v-else class="cobuild-empty">
            <div class="cobuild-empty-art">
              <div class="ring"></div>
              <div class="core"><el-icon :size="26" style="color:#a5b4fc"><Files /></el-icon></div>
            </div>
            <p class="empty-title">暂无共建资源</p>
            <p class="empty-desc">与学校共建岗位与场景，展示合作成果</p>
            <el-button size="small" @click="go('/partner/co-build/positions')">前往共建资源</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card shadow="never" class="section-card">
          <template #header>
            <div class="section-header">
              <span class="section-title">
                <el-icon class="section-icon" style="color:#6366f1"><TrendCharts /></el-icon>
                合作内容统计
              </span>
              <el-button link type="primary" size="small" @click="go('/partner/cooperation')">查看全部</el-button>
            </div>
          </template>
          <div class="line-chart">
            <svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet">
              <!-- 横向网格线 + Y 轴刻度 -->
              <g v-for="tick in yTicks" :key="tick.y">
                <line :x1="plot.left" :y1="tick.y" :x2="plot.right" :y2="tick.y" stroke="#f1f5f9" stroke-width="1" />
                <text :x="plot.left - 6" :y="tick.y + 4" text-anchor="end" font-size="10" fill="#94a3b8">{{ tick.label }}</text>
              </g>
              <!-- X 轴月份 -->
              <g v-for="(m, i) in contentMonthly" :key="i">
                <text
                  :x="xOf(i)"
                  :y="plot.bottom + 16"
                  text-anchor="middle"
                  font-size="10"
                  fill="#94a3b8"
                >{{ m.month }}</text>
              </g>
              <!-- 三条折线 -->
              <g v-for="s in lineSeries" :key="s.key">
                <polyline
                  :points="s.points.map((p) => `${p.x},${p.y}`).join(' ')"
                  fill="none"
                  :stroke="s.color"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <circle
                  v-for="(p, pi) in s.points"
                  :key="pi"
                  :cx="p.x"
                  :cy="p.y"
                  :r="pi === 0 ? 3 : 3"
                  :fill="s.color"
                />
              </g>
            </svg>
            <div class="line-legend">
              <span v-for="s in lineSeries" :key="s.key" class="legend-item">
                <span class="legend-dot" :style="{ background: s.color }"></span>{{ s.label }}
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 待办卡 -->
    <el-row :gutter="16" class="todo-row">
      <el-col v-for="todo in todos" :key="todo.title" :xs="24" :sm="8">
        <el-card
          shadow="never"
          class="todo-card"
          :class="{ active: todo.active }"
          @click="go(todo.href)"
        >
          <div class="todo-inner">
            <div class="todo-top">
              <div class="todo-title">
                <span class="todo-icon" :style="{ background: todo.bg, color: todo.color }">
                  <el-icon :size="16"><component :is="todo.icon" /></el-icon>
                </span>
                <span>{{ todo.title }}</span>
              </div>
              <span v-if="todo.active" class="todo-badge">{{ todo.count }}</span>
              <span v-else class="todo-ok">
                <el-icon><CircleCheck /></el-icon>
              </span>
            </div>
            <p class="todo-hint" :class="{ active: todo.active }">{{ todo.active ? todo.hint : todo.okHint }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  User,
  School,
  Briefcase,
  Files,
  TrendCharts,
  OfficeBuilding,
  Document,
  CircleCheck
} from '@element-plus/icons-vue';
import { partnerWorkspaceApi, partnerSchoolApi, partnerMentorTaskApi } from '@/api/partner';
import { partnerRequest } from '@/api/http';
import type { PartnerDashboard, PartnerEnterprise, PartnerSchool, PartnerMentorTask } from '@/types/partner';

interface MeResponse {
  user?: { id?: string; name?: string; username?: string };
  enterprise?: PartnerEnterprise;
}

interface MonthPoint {
  month: string;
  projects: number;
  agreements: number;
  achievements: number;
}

interface LineSeries {
  key: 'projects' | 'agreements' | 'achievements';
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

const router = useRouter();
const loading = ref(false);
const data = ref<PartnerDashboard | null>(null);
const schools = ref<PartnerSchool[]>([]);
const tasks = ref<PartnerMentorTask[]>([]);
const me = ref<MeResponse | null>(null);

const userName = computed(() => me.value?.user?.name || me.value?.user?.username || '');
const enterprise = computed(() => me.value?.enterprise);

// ---- 统计卡 ----
const sumOf = (key: 'experts' | 'positions' | 'scenarios') =>
  (data.value?.monthlyNewCounts ?? []).reduce((s, m) => s + (m[key] || 0), 0);
const schoolNewTotal = (data.value?.monthlySchoolCounts ?? []).reduce((s, m) => s + m.count, 0);

const statCards = computed(() => [
  { title: '专家数量', value: data.value?.expertCount ?? 0, trend: `近 6 个月新增 ${sumOf('experts')} 个`, href: '/partner/experts', icon: User, bg: '#eff6ff', color: '#2563eb' },
  { title: '合作学校', value: data.value?.schoolCount ?? 0, trend: `近 6 个月新增 ${schoolNewTotal} 所`, href: '/partner/schools', icon: School, bg: '#ecfdf5', color: '#059669' },
  { title: '共建岗位', value: data.value?.coBuildPositionCount ?? 0, trend: `近 6 个月新增 ${sumOf('positions')} 个`, href: '/partner/co-build/positions', icon: Briefcase, bg: '#eef2ff', color: '#6366f1' },
  { title: '共建场景', value: data.value?.coBuildScenarioCount ?? 0, trend: `近 6 个月新增 ${sumOf('scenarios')} 个`, href: '/partner/co-build/scenes', icon: Files, bg: '#f5f3ff', color: '#7c3aed' }
]);

// ---- 共建资源饼图 ----
const positionCount = computed(() => data.value?.coBuildPositionCount ?? 0);
const scenarioCount = computed(() => data.value?.coBuildScenarioCount ?? 0);
const resourceTotal = computed(() => positionCount.value + scenarioCount.value);
const resourcePieData = computed(() => [
  { name: '岗位共建', value: positionCount.value, color: '#6366f1' },
  { name: '场景共建', value: scenarioCount.value, color: '#a78bfa' }
]);
const donutGradient = computed(() => {
  const total = resourceTotal.value;
  if (total <= 0) return '#f1f5f9';
  let acc = 0;
  const stops = resourcePieData.value.map((d) => {
    const start = (acc / total) * 100;
    acc += d.value;
    const end = (acc / total) * 100;
    return `${d.color} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(',')})`;
});

// ---- 合作内容折线图 ----
const contentMonthly = computed<MonthPoint[]>(() =>
  (data.value?.contentMonthlyCounts ?? []).map((m) => ({
    month: m.month,
    projects: m.projects ?? 0,
    agreements: m.agreements ?? 0,
    achievements: m.achievements ?? 0
  }))
);

const plot = { left: 40, right: 544, top: 16, bottom: 190 };

const xOf = (i: number) => {
  const months = contentMonthly.value;
  if (months.length <= 1) return (plot.left + plot.right) / 2;
  return plot.left + ((plot.right - plot.left) * i) / (months.length - 1);
};

const yTicks = computed(() => {
  const maxVal = Math.max(
    1,
    ...contentMonthly.value.flatMap((m) => [m.projects, m.agreements, m.achievements])
  );
  const h = plot.bottom - plot.top;
  return [0, 0.5, 1].map((r) => ({
    y: plot.top + h - r * h,
    label: String(Math.round(maxVal * r))
  }));
});

const lineSeries = computed<LineSeries[]>(() => {
  const months = contentMonthly.value;
  const maxVal = Math.max(
    1,
    ...months.flatMap((m) => [m.projects, m.agreements, m.achievements])
  );
  const h = plot.bottom - plot.top;
  const keys: Array<LineSeries['key']> = ['projects', 'agreements', 'achievements'];
  const meta: Record<LineSeries['key'], { label: string; color: string }> = {
    projects: { label: '合作项目', color: '#6366f1' },
    agreements: { label: '合作协议', color: '#10b981' },
    achievements: { label: '合作成果', color: '#f59e0b' }
  };
  return keys.map((key) => ({
    key,
    label: meta[key].label,
    color: meta[key].color,
    points: months.map((m, i) => ({
      x: xOf(i),
      y: plot.top + h - (m[key] / maxVal) * h
    }))
  }));
});

// ---- 待办卡 ----
function getMissingFields(e: PartnerEnterprise | undefined): string[] {
  if (!e) return [];
  const missing: string[] = [];
  if (!e.logoUrl) missing.push('企业 Logo');
  if (!e.description) missing.push('企业简介');
  if (!e.contactPerson || !e.contactPhone) missing.push('联系人和联系电话');
  if (!e.coverImage) missing.push('企业主页封面');
  if (
    (e.businessLicensePhotos?.length ?? 0) === 0 &&
    (e.intellectualPropertyPhotos?.length ?? 0) === 0 &&
    (e.qualificationPhotos?.length ?? 0) === 0
  ) {
    missing.push('资质/证照图片');
  }
  return missing;
}

const negotiatingCount = computed(() => schools.value.filter((s) => s.status === 'negotiating').length);
const unfinishedTaskCount = computed(
  () =>
    tasks.value.filter(
      (t) => (t.assignedCount ?? 0) === 0 || (t.gradedCount ?? 0) < (t.assignedCount ?? 0)
    ).length
);
const missingFields = computed(() => getMissingFields(me.value?.enterprise));

const todos = computed(() => [
  {
    title: '待确认合作',
    count: negotiatingCount.value,
    hint: `有 ${negotiatingCount.value} 所学校等待确认合作`,
    okHint: '暂无待确认的合作学校',
    href: '/partner/schools',
    icon: OfficeBuilding,
    active: negotiatingCount.value > 0,
    bg: '#fffbeb',
    color: '#d97706'
  },
  {
    title: '测评任务',
    count: unfinishedTaskCount.value,
    hint: `有 ${unfinishedTaskCount.value} 项测评任务待评分`,
    okHint: '测评任务均已完成',
    href: '/partner/tasks',
    icon: Document,
    active: unfinishedTaskCount.value > 0,
    bg: '#fff1f2',
    color: '#e11d48'
  },
  {
    title: '资料完整度',
    count: missingFields.value.length,
    hint: `企业资料缺 ${missingFields.value.length} 项：${missingFields.value.join('、')}`,
    okHint: '企业资料已完善',
    href: '/partner/enterprise',
    icon: Document,
    active: missingFields.value.length > 0,
    bg: '#eff6ff',
    color: '#2563eb'
  }
]);

function go(path: string) {
  router.push(path);
}

async function load() {
  loading.value = true;
  try {
    const [dashboard, schoolRes, taskRes, meRes] = await Promise.all([
      partnerWorkspaceApi.dashboard(),
      partnerSchoolApi.list({ limit: 200 }),
      partnerMentorTaskApi.list(),
      partnerRequest<MeResponse>('/auth/partner/me')
    ]);
    data.value = dashboard;
    schools.value = schoolRes.items || [];
    tasks.value = taskRes.items || [];
    me.value = meRes;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.workspace {
  padding: 16px;
  min-height: 100%;
}
.ws-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.ws-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}
.ws-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: #909399;
}
.ws-enterprise {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #f0f2f5;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.ws-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid #f0f2f5;
}
.ws-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
}
.ws-enterprise-name {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}
.stat-row {
  margin-bottom: 4px;
}
.stat-card {
  cursor: pointer;
  border-radius: 12px;
  border: 1px solid #f0f2f5;
  transition: box-shadow 0.2s;
  margin-bottom: 12px;
}
.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.stat-inner {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-text {
  min-width: 0;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #303133;
  margin-top: 2px;
}
.stat-trend {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chart-row {
  margin-bottom: 4px;
}
.section-card {
  border-radius: 12px;
  border: 1px solid #f0f2f5;
  margin-bottom: 12px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.section-icon {
  width: 30px;
  height: 30px;
  padding: 7px;
  border-radius: 8px;
  background: #eef2ff;
}
.resource-body {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 8px 0;
}
.donut-wrap {
  flex-shrink: 0;
}
.donut {
  width: 132px;
  height: 132px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.donut-hole {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.donut-total {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}
.donut-label {
  font-size: 12px;
  color: #909399;
}
.resource-legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-name {
  font-size: 13px;
  color: #606266;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cobuild-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px 0;
}
.cobuild-empty-art {
  position: relative;
  width: 96px;
  height: 96px;
  margin-bottom: 12px;
}
.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px dashed #c7d2fe;
  animation: spin 24s linear infinite;
}
.core {
  position: absolute;
  inset: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #eef2ff, #f5f3ff);
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.empty-title {
  margin: 0;
  font-size: 13px;
  color: #909399;
}
.empty-desc {
  margin: 4px 0 12px;
  font-size: 12px;
  color: #c0c4cc;
}
.line-chart {
  width: 100%;
}
.line-chart svg {
  width: 100%;
  height: 220px;
  display: block;
}
.line-legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 4px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}
.todo-row {
  margin-bottom: 0;
}
.todo-card {
  border-radius: 12px;
  border: 1px solid #f0f2f5;
  cursor: pointer;
  transition: box-shadow 0.2s;
  height: 100%;
}
.todo-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.todo-card.active {
  border-color: #fde68a;
}
.todo-inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.todo-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.todo-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}
.todo-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.todo-badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #f43f5e;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.todo-ok {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
}
.todo-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #909399;
}
.todo-hint.active {
  color: #b45309;
  font-weight: 500;
}
</style>

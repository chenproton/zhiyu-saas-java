<!--
  通用服务台（企业导师等非学生/教师/学校管理员角色的兜底视图）。
  对齐 React frontend/edu/app/portal/workspace/page.tsx 尾部通用分支：
  - 快捷统计 4 卡（合作项目 / 实习学生 / 待办事项 / 消息通知）取 dashboard.stats 与 todos/announcements；
  - 8 个信息卡：通知公告 / 校园日历 / 待办事项 / 账号安全中心 / 本周活跃度 / 学习数据统计 /
    资源使用占比 / 校园通讯录。其中安全项、周活跃度、月度趋势、资源占比、通讯录在 React 侧
    即为空数组（等待后端接口），Vue 同样为空态；React 用 recharts 画的三处图表，
    Vue 门户不引入新依赖，空数据下按「暂无数据」占位（数据接入后再评估图表方案）。
-->
<template>
  <div class="generic-workspace">
    <!-- 快捷统计 -->
    <div class="quick-stats">
      <div class="quick-card primary">
        <div>
          <p class="quick-label">{{ stats.label1 }}</p>
          <p class="quick-value">{{ stats.value1 }}</p>
        </div>
        <span class="quick-icon"><el-icon :size="24"><Reading /></el-icon></span>
      </div>
      <div class="quick-card emerald">
        <div>
          <p class="quick-label">{{ stats.label2 }}</p>
          <p class="quick-value">{{ stats.value2 }}</p>
        </div>
        <span class="quick-icon"><el-icon :size="24"><UserFilled /></el-icon></span>
      </div>
      <div class="quick-card amber">
        <div>
          <p class="quick-label">待办事项</p>
          <p class="quick-value">{{ totalTodo }}</p>
        </div>
        <span class="quick-icon"><el-icon :size="24"><Checked /></el-icon></span>
      </div>
      <div class="quick-card primary">
        <div>
          <p class="quick-label">消息通知</p>
          <p class="quick-value">{{ newAnnouncementCount }}</p>
        </div>
        <span class="quick-icon"><el-icon :size="24"><Bell /></el-icon></span>
      </div>
    </div>

    <div class="info-grid">
      <!-- 通知公告 -->
      <SectionCard title="通知公告" :icon="Bell" icon-color="blue">
        <el-scrollbar height="200px">
          <div v-if="announcements.length === 0" class="empty-line">暂无通知公告</div>
          <div v-for="item in announcements" :key="item.id" class="notice-item">
            <el-tag size="small" :type="item.type === '重要' ? 'danger' : 'info'" effect="light">
              {{ item.type }}
            </el-tag>
            <div class="notice-body">
              <p class="notice-title">{{ item.title }}</p>
              <p class="notice-date">{{ item.date }}</p>
            </div>
            <span v-if="item.isNew" class="notice-dot" />
          </div>
        </el-scrollbar>
      </SectionCard>

      <!-- 校园日历 -->
      <SectionCard title="校园日历" :icon="Calendar" icon-color="amber">
        <div class="calendar-head">{{ year }}年{{ month }}月</div>
        <div class="calendar-grid">
          <div v-for="d in WEEK_SHORT_LABELS" :key="d" class="calendar-week">{{ d }}</div>
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="calendar-day"
            :class="{ today: day === todayDate }"
          >
            {{ day }}
          </div>
        </div>
        <div class="calendar-foot">
          <div class="calendar-foot-label">今日日程</div>
          <div class="empty-line small">暂无日程</div>
        </div>
      </SectionCard>

      <!-- 待办事项 -->
      <SectionCard title="待办事项" :icon="Checked" icon-color="green">
        <div class="todo-summary">
          <div class="todo-total">
            <div class="todo-total-value">{{ totalTodo }}</div>
            <div class="todo-total-label">待办</div>
          </div>
          <div class="todo-items">
            <div v-if="todos.length === 0" class="empty-line small">暂无待办</div>
            <div v-for="(item, idx) in todos" :key="item.id" class="todo-line">
              <span class="todo-dot" :style="{ background: TODO_COLORS[idx % TODO_COLORS.length] }" />
              <span class="todo-name">{{ item.title }}</span>
              <el-tag size="small" type="info" effect="light">{{ item.count }}</el-tag>
            </div>
          </div>
        </div>
      </SectionCard>

      <!-- 账号安全中心 -->
      <SectionCard title="账号安全中心" :icon="Lock" icon-color="blue">
        <div class="empty-line">暂无安全项数据</div>
      </SectionCard>

      <!-- 本周活跃度 -->
      <SectionCard title="本周活跃度" :icon="TrendCharts" icon-color="blue">
        <div class="empty-line">暂无数据</div>
      </SectionCard>

      <!-- 学习数据统计 -->
      <SectionCard title="学习数据统计" :icon="Histogram" icon-color="blue">
        <div class="empty-line">暂无数据</div>
      </SectionCard>

      <!-- 资源使用占比 -->
      <SectionCard title="资源使用占比" :icon="PieChart" icon-color="cyan">
        <div class="empty-line">暂无数据</div>
      </SectionCard>

      <!-- 校园通讯录 -->
      <SectionCard title="校园通讯录" :icon="UserFilled" icon-color="green">
        <div class="empty-line">暂无联系人</div>
      </SectionCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Bell,
  Calendar,
  Checked,
  Histogram,
  Lock,
  PieChart,
  Reading,
  TrendCharts,
  UserFilled
} from '@element-plus/icons-vue';
import SectionCard from './SectionCard.vue';
import { workspaceDashboardApi } from './workspace-api';
import type { WorkspaceAnnouncement, WorkspaceStats, WorkspaceTodo } from './workspace-api';
import { WEEK_SHORT_LABELS } from './workspace-utils';

const props = defineProps<{ roleCode?: string }>();

const TODO_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
const DEFAULT_STATS: WorkspaceStats = { label1: '合作项目', value1: 5, label2: '实习学生', value2: 23 };

const announcements = ref<WorkspaceAnnouncement[]>([]);
const todos = ref<WorkspaceTodo[]>([]);
const dashboardStats = ref<WorkspaceStats | null>(null);

const stats = computed(() => dashboardStats.value || DEFAULT_STATS);
const totalTodo = computed(() => todos.value.reduce((acc, item) => acc + item.count, 0));
const newAnnouncementCount = computed(() => announcements.value.filter((a) => a.isNew).length);

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const todayDate = now.getDate();

const calendarDays = computed<(number | null)[]>(() => {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
});

onMounted(async () => {
  try {
    const res = await workspaceDashboardApi.get(props.roleCode ? { role: props.roleCode } : undefined);
    announcements.value = res.announcements || [];
    todos.value = res.todos || [];
    dashboardStats.value = res.stats || null;
  } catch {
    announcements.value = [];
    todos.value = [];
    dashboardStats.value = null;
  }
});
</script>

<style scoped>
.generic-workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 快捷统计 */
.quick-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 640px) {
  .quick-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
}
.quick-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  color: #fff;
}
.quick-card.primary {
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-3));
}
.quick-card.emerald {
  background: linear-gradient(90deg, #10b981, #059669);
}
.quick-card.amber {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}
.quick-label {
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
}
.quick-value {
  margin: 4px 0 0;
  font-size: 24px;
  font-weight: 700;
}
.quick-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 信息卡片区 */
.info-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
@media (min-width: 768px) {
  .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1280px) {
  .info-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.empty-line {
  padding: 32px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}
.empty-line.small {
  padding: 12px 0;
}

/* 通知公告 */
.notice-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
}
.notice-body {
  flex: 1;
  min-width: 0;
}
.notice-title {
  margin: 0;
  font-size: 14px;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notice-date {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.notice-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  margin-top: 6px;
}

/* 校园日历 */
.calendar-head {
  text-align: right;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  margin-bottom: 8px;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.calendar-week {
  text-align: center;
  font-size: 12px;
  color: #6b7280;
  padding: 4px 0;
}
.calendar-day {
  text-align: center;
  font-size: 12px;
  padding: 6px 0;
  border-radius: 6px;
  color: #6b7280;
}
.calendar-day.today {
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 500;
}
.calendar-foot {
  border-top: 1px solid #ebeef5;
  margin-top: 8px;
  padding-top: 8px;
}
.calendar-foot-label {
  font-size: 12px;
  color: #6b7280;
}

/* 待办事项 */
.todo-summary {
  display: flex;
  align-items: center;
  gap: 16px;
}
.todo-total {
  width: 96px;
  height: 96px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 6px solid var(--el-color-primary-light-8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.todo-total-value {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}
.todo-total-label {
  font-size: 12px;
  color: #6b7280;
}
.todo-items {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.todo-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.todo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.todo-name {
  flex: 1;
  min-width: 0;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

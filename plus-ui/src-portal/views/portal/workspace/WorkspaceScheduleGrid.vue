<!--
  工作台课表网格（年 / 月 / 周 三视图 + 年月周下拉 + 上下翻页 + 今天）。
  对齐原 React 版 workspace-schedule-grid.tsx（595 行）：
  - 周视图：8 列（节次/星期 + 周一~周日）× 10 节次行，事件卡按 type 取色并挂气泡；
  - 月视图：日历格，带 date 的单次事件按日期匹配、不带 date 的按星期每周重复，超 3 条折叠为「+N 项」；
  - 年视图：12 个月卡片，仅带 date 的单次事件按月归类（每月最多 4 条），否则显示「暂无安排」。
-->
<template>
  <div class="ws-grid">
    <!-- 工具栏 -->
    <div class="grid-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-icon"><el-icon :size="20"><Calendar /></el-icon></span>
        <div>
          <div class="toolbar-title">
            {{ year }}年{{ month }}月<template v-if="view === 'week'"> · 第{{ weekIndex }}周</template>
          </div>
          <div v-if="view === 'week'" class="toolbar-sub">
            {{ formatYMD(weekStart) }} - {{ formatYMD(weekEnd) }}
          </div>
        </div>
      </div>

      <div class="toolbar-right">
        <template v-if="view !== 'year'">
          <el-select v-model="yearSel" size="default" class="sel-year" placeholder="年份">
            <el-option v-for="y in YEAR_OPTIONS" :key="y" :label="`${y}年`" :value="y" />
          </el-select>
          <el-select v-model="monthSel" size="default" class="sel-month" placeholder="月份">
            <el-option v-for="m in 12" :key="m" :label="`${m}月`" :value="m" />
          </el-select>
        </template>

        <el-select
          v-if="view === 'week'"
          v-model="weekSel"
          size="default"
          class="sel-week"
          placeholder="周次"
        >
          <el-option v-for="w in weeksInMonth" :key="w" :label="`第${w}周`" :value="w" />
        </el-select>

        <el-button-group>
          <el-button :icon="ArrowLeft" aria-label="上一周" @click="prevPeriod" />
          <el-button :icon="ArrowRight" aria-label="下一周" @click="nextPeriod" />
        </el-button-group>

        <el-button @click="goToday">今天</el-button>

        <el-radio-group v-model="view" size="default">
          <el-radio-button value="year">年</el-radio-button>
          <el-radio-button value="month">月</el-radio-button>
          <el-radio-button value="week">周</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 周视图 -->
    <div v-if="view === 'week'" class="week-view">
      <div class="week-inner">
        <div class="week-row week-head">
          <div class="week-cell head-cell period-head">节次 / 星期</div>
          <div v-for="d in WEEK_DAY_LABELS" :key="d" class="week-cell head-cell">{{ d }}</div>
        </div>
        <div v-for="row in weekRows" :key="row.period" class="week-row">
          <div class="week-cell period-cell">{{ row.period }}</div>
          <div
            v-for="(cell, dayIdx) in row.cells"
            :key="dayIdx"
            class="week-cell slot-cell"
            :class="{ empty: !cell }"
          >
            <WorkspaceEventPopover v-if="cell" :event="cell">
              <div class="event-card" :class="`type-${cell.type}`">
                <div class="event-top">
                  <span class="event-badge">{{ TYPE_LABELS[cell.type] }}</span>
                  <span v-if="cell.tag" class="event-tag">{{ cell.tag }}</span>
                </div>
                <div class="event-title">{{ cell.title }}</div>
                <div v-if="cell.description" class="event-line">{{ cell.description }}</div>
                <div v-if="cell.teacher" class="event-line">
                  <el-icon><User /></el-icon>{{ cell.teacher }}
                </div>
                <div v-if="cell.location" class="event-line">
                  <el-icon><Location /></el-icon>{{ cell.location }}
                </div>
              </div>
            </WorkspaceEventPopover>
            <div v-else class="event-placeholder">-</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 月视图 -->
    <div v-else-if="view === 'month'" class="month-view">
      <div class="month-head">
        <div v-for="d in WEEK_SHORT_LABELS" :key="d" class="month-head-cell">周{{ d }}</div>
      </div>
      <div class="month-body">
        <div
          v-for="(cell, index) in monthCells"
          :key="index"
          class="month-cell"
          :class="{ blank: cell.day === null }"
        >
          <template v-if="cell.day !== null">
            <div class="month-day">{{ cell.day }}</div>
            <div class="month-events">
              <WorkspaceEventPopover v-for="e in cell.events.slice(0, 3)" :key="e.id" :event="e">
                <div class="event-chip" :class="`type-${e.type}`">{{ e.title }}</div>
              </WorkspaceEventPopover>
              <div v-if="cell.events.length > 3" class="month-more">
                +{{ cell.events.length - 3 }} 项
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 年视图 -->
    <div v-else class="year-view">
      <div v-for="cell in yearCells" :key="cell.month" class="year-card">
        <div class="year-card-title">{{ cell.month }}月</div>
        <div class="year-card-body">
          <WorkspaceEventPopover v-for="e in cell.events" :key="e.id" :event="e">
            <div class="event-chip" :class="`type-${e.type}`">{{ e.title }}</div>
          </WorkspaceEventPopover>
          <div v-if="cell.events.length === 0" class="year-empty">暂无安排</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, Calendar, Location, User } from '@element-plus/icons-vue';
import WorkspaceEventPopover from './WorkspaceEventPopover.vue';
import type { WorkspaceScheduleEvent, WorkspaceScheduleEventType } from './workspace-api';
import {
  ALL_PERIODS,
  WEEK_DAY_LABELS,
  WEEK_SHORT_LABELS,
  formatYMD,
  getWeekEnd,
  getWeekIndex,
  getWeekStart,
  getWeekTargetDate,
  getWeeksInMonth
} from './workspace-utils';

const props = defineProps<{ events: WorkspaceScheduleEvent[] }>();

const YEAR_OPTIONS = [2025, 2026, 2027];
const TYPE_LABELS: Record<WorkspaceScheduleEventType, string> = {
  course: '课程',
  scene: '岗位场景',
  exam: '考试/测评',
  todo: '待办'
};

type ViewType = 'year' | 'month' | 'week';

const view = ref<ViewType>('week');
const currentDate = ref(new Date());

const year = computed(() => currentDate.value.getFullYear());
const month = computed(() => currentDate.value.getMonth() + 1);
const weekStart = computed(() => getWeekStart(currentDate.value));
const weekEnd = computed(() => getWeekEnd(weekStart.value));
// 基于绝对日期差计算周次（第 1 周为包含当月 1 号的那一周），避免跨月错算
const weekIndex = computed(() => getWeekIndex(weekStart.value, year.value, month.value));
const weeksInMonth = computed(() => getWeeksInMonth(year.value, month.value));

/* 下拉选择：与 currentDate 双向同步 */
const yearSel = ref(year.value);
const monthSel = ref(month.value);
const weekSel = ref(weekIndex.value);
watch([year, month, weekIndex], ([y, m, w]) => {
  yearSel.value = y;
  monthSel.value = m;
  weekSel.value = w;
});
watch(yearSel, (val) => {
  if (val === year.value) return;
  const d = new Date(currentDate.value);
  d.setFullYear(val);
  currentDate.value = d;
});
watch(monthSel, (val) => {
  if (val === month.value) return;
  const d = new Date(currentDate.value);
  d.setMonth(val - 1);
  currentDate.value = d;
});
watch(weekSel, (val) => {
  if (val === weekIndex.value) return;
  currentDate.value = getWeekTargetDate(year.value, month.value, val);
});

function prevPeriod() {
  const d = new Date(currentDate.value);
  if (view.value === 'week') d.setDate(d.getDate() - 7);
  if (view.value === 'month') d.setMonth(d.getMonth() - 1);
  if (view.value === 'year') d.setFullYear(d.getFullYear() - 1);
  currentDate.value = d;
}

function nextPeriod() {
  const d = new Date(currentDate.value);
  if (view.value === 'week') d.setDate(d.getDate() + 7);
  if (view.value === 'month') d.setMonth(d.getMonth() + 1);
  if (view.value === 'year') d.setFullYear(d.getFullYear() + 1);
  currentDate.value = d;
}

function goToday() {
  currentDate.value = new Date();
}

/* ---------- 周视图：事件需属于当前周（不带 date 视为每周重复） ---------- */
function inCurrentWeek(event: WorkspaceScheduleEvent): boolean {
  if (!event.date) return true;
  const key = event.date.slice(0, 10);
  return key >= formatYMD(weekStart.value) && key <= formatYMD(weekEnd.value);
}

const weekEvents = computed(() => props.events.filter(inCurrentWeek));

/** 周视图行：每行一个节次，7 列按星期取当格事件（无则 null） */
const weekRows = computed(() =>
  ALL_PERIODS.map((period) => ({
    period,
    cells: [1, 2, 3, 4, 5, 6, 7].map(
      (day) =>
        weekEvents.value.find((e) => e.dayOfWeek === day && e.period === period) ||
        (null as WorkspaceScheduleEvent | null)
    )
  }))
);

/* ---------- 月视图 ---------- */
const calendarDays = computed<(number | null)[]>(() => {
  const firstDay = new Date(year.value, month.value - 1, 1);
  const daysInMonth = new Date(year.value, month.value, 0).getDate();
  const startDayOfWeek = firstDay.getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
});

/**
 * 月视图格子：单次事件（带 date）按日期精确匹配，避免在当月所有同星期格重复出现；
 * 未带 date 的事件视为每周重复安排，按星期匹配。
 */
const monthCells = computed(() =>
  calendarDays.value.map((day, index) => {
    if (day === null) return { day, events: [] as WorkspaceScheduleEvent[] };
    const key = `${year.value}-${String(month.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      day,
      events: props.events.filter((e) =>
        e.date ? e.date.slice(0, 10) === key : e.dayOfWeek === (index % 7 || 7)
      )
    };
  })
);

/* ---------- 年视图：仅带 date 的单次事件按月归类（每月最多 4 条） ---------- */
const yearCells = computed(() =>
  Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
    const monthKey = `${year.value}-${String(m).padStart(2, '0')}`;
    return {
      month: m,
      events: props.events
        .filter((e) => (e.date ? e.date.slice(0, 7) === monthKey : false))
        .slice(0, 4)
    };
  })
);
</script>

<style scoped>
.ws-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 工具栏 ===== */
.grid-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.toolbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.toolbar-sub {
  font-size: 12px;
  color: #6b7280;
}
.toolbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.sel-year { width: 108px; }
.sel-month { width: 100px; }
.sel-week { width: 112px; }

/* ===== 周视图 ===== */
.week-view {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow-x: auto;
  background: #fff;
}
.week-inner {
  min-width: 760px;
}
.week-row {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  border-top: 1px solid #e5e7eb;
}
.week-row.week-head {
  border-top: none;
  background: #f9fafb;
}
.week-cell {
  border-right: 1px solid #e5e7eb;
}
.week-cell:last-child {
  border-right: none;
}
.head-cell {
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  text-align: center;
}
.period-cell {
  padding: 12px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  background: rgba(249, 250, 251, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.slot-cell {
  padding: 6px;
  min-height: 90px;
}
.slot-cell.empty {
  background: rgba(249, 250, 251, 0.4);
}
.event-placeholder {
  width: 100%;
  min-height: 70px;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #d1d5db;
}
.event-card {
  width: 100%;
  border-radius: 8px;
  border: 1px solid;
  padding: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}
.event-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transform: scale(1.02);
}
.type-course { background: #eff6ff; border-color: #bfdbfe; }
.type-scene { background: #fff7ed; border-color: #fed7aa; }
.type-exam { background: #f5f3ff; border-color: #ddd6fe; }
.type-todo { background: #f9fafb; border-color: #e5e7eb; }
.event-top {
  display: flex;
  align-items: center;
  gap: 4px;
}
.event-badge {
  font-size: 10px;
  line-height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  border: 1px solid currentColor;
  font-weight: 500;
}
.type-course .event-badge { color: #2563eb; }
.type-scene .event-badge { color: #ea580c; }
.type-exam .event-badge { color: #7c3aed; }
.type-todo .event-badge { color: #4b5563; }
.event-tag,
.event-line {
  font-size: 10px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-title {
  margin-top: 2px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 月视图 ===== */
.month-view {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 20px;
}
.month-head {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 8px;
}
.month-head-cell {
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  padding: 8px 0;
}
.month-body {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
.month-cell {
  min-height: 100px;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  padding: 8px;
  transition: background-color 0.2s;
}
.month-cell:not(.blank):hover {
  background: #f9fafb;
  cursor: pointer;
}
.month-cell.blank {
  border-color: transparent;
}
.month-day {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}
.month-events {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.month-more {
  font-size: 10px;
  color: #9ca3af;
  padding-left: 4px;
}
.event-chip {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.event-chip.type-course { color: #2563eb; }
.event-chip.type-scene { color: #ea580c; }
.event-chip.type-exam { color: #7c3aed; }
.event-chip.type-todo { color: #4b5563; }

/* ===== 年视图 ===== */
.year-view {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (min-width: 768px) {
  .year-view { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .year-view { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.year-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 16px;
  transition: box-shadow 0.2s;
}
.year-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.year-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 12px;
}
.year-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.year-empty {
  font-size: 10px;
  color: #9ca3af;
}
</style>

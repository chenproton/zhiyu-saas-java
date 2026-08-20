<!--
  教师工作台课程日历（周视图表格 + 事件气泡操作）。
  对齐原 React 版 teacher-dashboard-tab.tsx 的 CourseScheduleTable：
  - 头部：{年}年{月}月 · 第{N}周 + 周起止日期 + 年/月/周下拉 + 上一周/下一周 + 今天；
  - 表体：8 列（节次/星期 + 周一~周日）× 9 节次（上午 1~晚自习 1），按 dayOfWeek + period 命中事件；
  - 课程/场景类事件挂气泡：已关联节次/任务列表 + 修改关联 / 前往备课·导学准备 / 前往上课·前往导学 /
    前往评分（场景→场景任务评价；混合课→考勤评分弹窗；其余→课程节点测评）+ 教学进展 / 测评进展；
  - 其它类型事件（会议/培训/考试/待办）只渲染卡片不挂气泡，空格渲染虚线占位。
  与 React 一致：周次切换只改表头与日期区间，不过滤事件（后端下发的是每周重复的课表格位）。
-->
<template>
  <div class="teacher-schedule">
    <!-- 头部工具条 -->
    <div class="sched-head">
      <div class="head-left">
        <el-icon><Calendar /></el-icon>
        <span class="head-title">{{ year }}年{{ month }}月 · 第{{ weekIndex }}周</span>
        <span class="head-range">{{ formatYMD(weekStart) }} - {{ formatYMD(weekEnd) }}</span>
      </div>
      <div class="head-right">
        <el-select v-model="yearSel" size="small" class="sel-year">
          <el-option v-for="y in YEAR_OPTIONS" :key="y" :label="`${y}年`" :value="y" />
        </el-select>
        <el-select v-model="monthSel" size="small" class="sel-month">
          <el-option v-for="m in 12" :key="m" :label="`${m}月`" :value="m" />
        </el-select>
        <el-select v-model="weekSel" size="small" class="sel-week">
          <el-option v-for="w in weeksInMonth" :key="w" :label="`第${w}周`" :value="w" />
        </el-select>
        <el-button-group>
          <el-button size="small" :icon="ArrowLeft" aria-label="上一周" @click="goPrevWeek" />
          <el-button size="small" :icon="ArrowRight" aria-label="下一周" @click="goNextWeek" />
        </el-button-group>
        <el-button size="small" @click="goToday">今天</el-button>
      </div>
    </div>

    <!-- 表体 -->
    <div class="sched-scroll">
      <div class="sched-grid">
        <div class="grid-row grid-head">
          <div class="grid-cell head-cell">节次 / 星期</div>
          <div v-for="d in TEACHER_WEEKDAYS" :key="d" class="grid-cell head-cell">{{ d }}</div>
        </div>

        <div v-for="period in TEACHER_PERIODS" :key="period" class="grid-row">
          <div class="grid-cell period-cell">{{ period }}</div>
          <template v-for="dayOfWeek in [1, 2, 3, 4, 5, 6, 7]" :key="`${period}-${dayOfWeek}`">
            <div class="grid-cell slot-cell" :class="{ empty: !cellEvent(dayOfWeek, period) }">
              <!-- 课程/场景：挂气泡 -->
              <el-popover
                v-if="courseLikeCell(dayOfWeek, period)"
                placement="right"
                trigger="click"
                :width="320"
                :show-arrow="false"
                popper-class="teacher-sched-popover"
              >
                <template #reference>
                  <span class="cell-trigger">
                    <ScheduleEventCard :event="courseLikeCell(dayOfWeek, period)!" hint />
                  </span>
                </template>
                <ScheduleEventActions
                  :event="courseLikeCell(dayOfWeek, period)!"
                  :meta="cellMeta(courseLikeCell(dayOfWeek, period)!)"
                  :association="prepAssociations[cellMeta(courseLikeCell(dayOfWeek, period)!).sessionKey]"
                  @prep="onPrep"
                  @grade="onGrade"
                  @detail="onDetail"
                />
              </el-popover>

              <!-- 其它类型事件：静态卡片 -->
              <ScheduleEventCard
                v-else-if="cellEvent(dayOfWeek, period)"
                :event="cellEvent(dayOfWeek, period)!"
              />

              <!-- 空格 -->
              <div v-else class="cell-placeholder">-</div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, Calendar } from '@element-plus/icons-vue';
import ScheduleEventCard from './ScheduleEventCard.vue';
import ScheduleEventActions from './ScheduleEventActions.vue';
import type {
  WorkspaceClassPlan,
  WorkspaceClassSession,
  WorkspaceScheduleEvent
} from './workspace-api';
import type {
  CellMeta,
  CourseDetailTarget,
  HybridGradeRequest,
  PrepAssociationRecord,
  PrepRequest
} from './workspace-teacher-types';
import {
  HYBRID_PREP_URL,
  SCENE_PREP_URL,
  TEACHER_PERIODS,
  TEACHER_WEEKDAYS
} from './workspace-teacher-types';
import {
  formatYMD,
  getWeekEnd,
  getWeekIndex,
  getWeekStart,
  getWeekTargetDate,
  getWeeksInMonth,
  lessonLandingHref,
  sceneLandingHref
} from './workspace-utils';

const props = withDefaults(
  defineProps<{
    events?: WorkspaceScheduleEvent[];
    classPlans?: WorkspaceClassPlan[];
    classSessions?: WorkspaceClassSession[];
    prepAssociations?: Record<string, PrepAssociationRecord>;
  }>(),
  { events: () => [], classPlans: () => [], classSessions: () => [], prepAssociations: () => ({}) }
);

const emit = defineEmits<{
  prep: [payload: PrepRequest];
  grade: [payload: HybridGradeRequest];
  detail: [payload: { course: CourseDetailTarget; tab: 'tracking' | 'assessment' }];
}>();

const YEAR_OPTIONS = [2025, 2026, 2027];

const currentDate = ref(new Date());

const year = computed(() => currentDate.value.getFullYear());
const month = computed(() => currentDate.value.getMonth() + 1);
const weekStart = computed(() => getWeekStart(currentDate.value));
const weekEnd = computed(() => getWeekEnd(weekStart.value));
// 基于绝对日期差计算周次（第 1 周为包含当月 1 号的那一周），避免跨月错算/周下拉重复值
const weekIndex = computed(() => getWeekIndex(weekStart.value, year.value, month.value));
const weeksInMonth = computed(() => getWeeksInMonth(year.value, month.value));

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

function goPrevWeek() {
  const d = new Date(currentDate.value);
  d.setDate(d.getDate() - 7);
  currentDate.value = d;
}
function goNextWeek() {
  const d = new Date(currentDate.value);
  d.setDate(d.getDate() + 7);
  currentDate.value = d;
}
function goToday() {
  currentDate.value = new Date();
}

/* ---------- 格位事件 ---------- */
function cellEvent(dayOfWeek: number, period: string): WorkspaceScheduleEvent | undefined {
  return props.events.find((e) => e.dayOfWeek === dayOfWeek && e.period === period);
}

function courseLikeCell(dayOfWeek: number, period: string): WorkspaceScheduleEvent | undefined {
  const event = cellEvent(dayOfWeek, period);
  if (!event) return undefined;
  return event.type === 'course' || event.type === 'scene' ? event : undefined;
}

function matchingPlan(event: WorkspaceScheduleEvent): WorkspaceClassPlan | undefined {
  return props.classPlans.find(
    (p) => p.course === event.title && (event.className ? p.name === event.className : true)
  );
}

/** 对齐 React getCourseUrls + sessionKey 推导 */
function cellMeta(event: WorkspaceScheduleEvent): CellMeta {
  const plan = matchingPlan(event);
  const planId = plan?.id || event.id;
  const session = plan
    ? props.classSessions.find(
        (s) =>
          s.courseId === plan.id &&
          s.weekday === TEACHER_WEEKDAYS[event.dayOfWeek - 1] &&
          s.period === event.period
      )
    : undefined;
  const sessionKey = session?.id || `${planId}-${event.dayOfWeek}-${event.period}`;
  const isHybrid = event.type !== 'scene';
  return {
    planId,
    sessionKey,
    isHybrid,
    prepUrl: isHybrid ? HYBRID_PREP_URL : SCENE_PREP_URL,
    learnUrl: isHybrid
      ? event.courseId
        ? lessonLandingHref(event.courseId, event.resourceVersion)
        : ''
      : event.scenarioId
        ? sceneLandingHref(event.scenarioId, event.resourceVersion)
        : ''
  };
}

/* ---------- 气泡回调（原样上抛给 TeacherDashboardTab） ---------- */
function onPrep(payload: PrepRequest) {
  emit('prep', payload);
}

function onGrade(payload: HybridGradeRequest) {
  emit('grade', payload);
}

function onDetail(payload: { event: WorkspaceScheduleEvent; tab: 'tracking' | 'assessment' }) {
  const plan = matchingPlan(payload.event);
  emit('detail', {
    course: {
      id: plan?.id || payload.event.id,
      name: payload.event.title,
      className: payload.event.className || payload.event.tag || '',
      students: plan?.students || 0
    },
    tab: payload.tab
  });
}
</script>

<style scoped>
.teacher-schedule {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

/* 头部 */
.sched-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
@media (min-width: 1280px) {
  .sched-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.head-left :deep(.el-icon) {
  color: var(--el-color-primary);
}
.head-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.head-range {
  font-size: 12px;
  color: #6b7280;
}
.head-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.sel-year { width: 96px; }
.sel-month { width: 88px; }
.sel-week { width: 104px; }

/* 表体 */
.sched-scroll {
  overflow-x: auto;
}
.sched-grid {
  min-width: 760px;
}
.grid-row {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  border-top: 1px solid #e5e7eb;
}
.grid-row.grid-head {
  border-top: none;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
.grid-cell {
  border-right: 1px solid #e5e7eb;
}
.grid-cell:last-child {
  border-right: none;
}
.head-cell {
  padding: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.period-cell {
  padding: 12px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  background: rgba(249, 250, 251, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.slot-cell {
  padding: 6px;
  min-height: 80px;
}
.slot-cell.empty {
  background: rgba(249, 250, 251, 0.3);
}
.cell-trigger {
  display: block;
  width: 100%;
  height: 100%;
}
.cell-placeholder {
  width: 100%;
  min-height: 65px;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #d1d5db;
}
</style>

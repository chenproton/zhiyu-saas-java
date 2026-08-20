<template>
  <div class="sg-root">
    <div v-if="loading" class="sg-loading">加载中...</div>

    <el-empty
      v-else-if="!hasData && !alwaysShow"
      :description="emptyText"
      :image-size="60"
      class="sg-empty"
    />

    <div v-else class="sg-table-wrap">
      <table class="sg-table">
        <thead>
          <tr>
            <th class="sg-th sg-th-first">节次</th>
            <th v-for="d in dayLabels" :key="d" class="sg-th">{{ d }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in displayRows" :key="row.key" class="sg-row">
            <td class="sg-td sg-td-label">
              <div class="sg-label">{{ row.label }}</div>
              <div v-if="row.time" class="sg-time">{{ row.time }}</div>
            </td>
            <td
              v-for="(d, dayIdx) in dayLabels"
              :key="d"
              class="sg-td sg-td-cell"
              :class="{ 'sg-cell-clickable': isCellClickable(dayIdx + 1, row.key) }"
              @click="onCellClick(dayIdx + 1, row.key)"
            >
              <div class="sg-cell-body">
                <div
                  v-for="e in cellOf(dayIdx + 1, row.key)"
                  :key="e.id"
                  class="sg-card"
                  :class="{
                    'sg-card-scene': e.type === 'scene',
                    'sg-card-hover': editable,
                    'sg-card-moving': movingEntry?.id === e.id
                  }"
                  @click.stop="onCardClick(e)"
                >
                  <div class="sg-card-head">
                    <span class="sg-card-name" :title="e.courseName">{{ e.courseName }}</span>
                    <span v-if="e.type === 'scene'" class="sg-scene-badge">场景</span>
                  </div>
                  <div v-if="e.teacherName" class="sg-card-meta">
                    <el-icon class="sg-meta-icon"><User /></el-icon>
                    <span class="sg-meta-text">{{ e.teacherName }}</span>
                  </div>
                  <div v-if="e.venueName" class="sg-card-meta">
                    <el-icon class="sg-meta-icon"><Location /></el-icon>
                    <span class="sg-meta-text">{{ e.venueName }}</span>
                  </div>
                  <div class="sg-card-week">第{{ e.startWeek }}-{{ e.endWeek }}周{{ weekPatternSuffix(e.weekPattern) }}</div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Location, User } from '@element-plus/icons-vue';
import type { PeriodSlot, ScheduleEntry } from '@/types/affairs';

// 周课表网格（7 列星期 × 节次行），对齐 React components/shared/schedule-grid.tsx；
// 排课页（可编辑/可移动）与学生/教师工作台（只读）共用。

/** 按周次过滤：startWeek <= week <= endWeek 且周次模式匹配 */
function filterEntriesByWeek(entries: ScheduleEntry[] | null | undefined, week?: number): ScheduleEntry[] {
  if (!entries) return [];
  if (!week) return entries;
  return entries.filter((e) => {
    if (e.startWeek > week || e.endWeek < week) return false;
    if (e.weekPattern === 'odd') return week % 2 === 1;
    if (e.weekPattern === 'even') return week % 2 === 0;
    return true;
  });
}

const props = withDefaults(
  defineProps<{
    entries: ScheduleEntry[];
    periodSlots?: PeriodSlot[];
    week?: number;
    loading?: boolean;
    emptyText?: string;
    /** 即使无条目也渲染空表格（排课页始终显示网格） */
    alwaysShow?: boolean;
    /** 当前正在调整位置的目标条目（高亮显示） */
    movingEntry?: ScheduleEntry | null;
    /** 卡片可点击（点击卡片主体打开编辑） */
    editable?: boolean;
    /** 支持把 movingEntry 移动到空格 */
    movable?: boolean;
    /** 空格可点击（选中待排课程后点空格排课 / 移动条目到空格） */
    clickable?: boolean;
  }>(),
  {
    periodSlots: () => [],
    week: undefined,
    loading: false,
    emptyText: '暂无课表数据',
    alwaysShow: false,
    movingEntry: null,
    editable: false,
    movable: false,
    clickable: false
  }
);

const emit = defineEmits<{
  (e: 'entry-click', entry: ScheduleEntry): void;
  (e: 'cell-click', dayOfWeek: number, periodKey: string): void;
  (e: 'entry-move', entry: ScheduleEntry, dayOfWeek: number, periodKey: string): void;
}>();

const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const visibleEntries = computed(() => filterEntriesByWeek(props.entries, props.week));

interface GridRow {
  key: string;
  label: string;
  time?: string;
}

const rows = computed<GridRow[]>(() => {
  if (props.periodSlots && props.periodSlots.length > 0) {
    return [...props.periodSlots]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        key: s.name,
        label: s.name,
        time: s.startTime ? `${s.startTime.slice(0, 5)}${s.endTime ? `-${s.endTime.slice(0, 5)}` : ''}` : undefined
      }));
  }
  const names = new Set<string>();
  for (const e of visibleEntries.value) {
    for (const p of e.periods || []) names.add(p);
  }
  return Array.from(names)
    .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
    .map((name) => ({ key: name, label: name }));
});

const cellMap = computed(() => {
  const map = new Map<string, ScheduleEntry[]>();
  for (const e of visibleEntries.value) {
    for (const p of e.periods || []) {
      const key = `${e.dayOfWeek}:${p}`;
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    }
  }
  return map;
});

const hasData = computed(() => rows.value.length > 0);

const displayRows = computed<GridRow[]>(() => {
  if (hasData.value) return rows.value;
  if (props.periodSlots && props.periodSlots.length > 0) {
    return [...props.periodSlots]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ key: s.name, label: s.name }));
  }
  return [{ key: '__empty', label: '暂无节次' }];
});

function cellOf(day: number, periodKey: string): ScheduleEntry[] {
  return cellMap.value.get(`${day}:${periodKey}`) || [];
}

function isCellClickable(day: number, periodKey: string): boolean {
  if (cellOf(day, periodKey).length > 0) return false;
  return props.clickable || (props.movable && !!props.movingEntry);
}

function onCellClick(day: number, periodKey: string) {
  if (cellOf(day, periodKey).length > 0) return;
  if (props.movingEntry && props.movable) {
    emit('entry-move', props.movingEntry, day, periodKey);
  } else {
    emit('cell-click', day, periodKey);
  }
}

function onCardClick(entry: ScheduleEntry) {
  emit('entry-click', entry);
}

function weekPatternSuffix(pattern: string): string {
  if (pattern === 'odd') return '（单周）';
  if (pattern === 'even') return '（双周）';
  return '';
}
</script>

<style scoped>
.sg-root {
  width: 100%;
}
.sg-loading {
  padding: 40px 0;
  text-align: center;
  color: #909399;
  font-size: 14px;
}
.sg-empty {
  padding: 24px 0;
}
.sg-table-wrap {
  overflow-x: auto;
}
.sg-table {
  width: 100%;
  min-width: 840px;
  border-collapse: collapse;
  table-layout: fixed;
}
.sg-th {
  width: 130px;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  padding: 8px 4px;
  font-size: 12px;
  font-weight: 500;
  color: #909399;
  text-align: center;
}
.sg-th-first {
  width: 80px;
}
.sg-td {
  border: 1px solid #ebeef5;
  padding: 4px;
  vertical-align: top;
}
.sg-td-label {
  background: #fafafa;
  padding: 6px 8px;
}
.sg-label {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
}
.sg-time {
  font-size: 10px;
  color: #c0c4cc;
  margin-top: 2px;
}
.sg-td-cell {
  padding: 4px;
}
.sg-cell-clickable {
  cursor: pointer;
  transition: background 0.2s;
}
.sg-cell-clickable:hover {
  background: rgba(64, 158, 255, 0.08);
}
.sg-cell-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 2rem;
}
.sg-card {
  border: 1px solid #a0cfff;
  background: #ecf5ff;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 11px;
  line-height: 1.4;
  text-align: left;
  max-width: 130px;
  user-select: none;
}
.sg-card-scene {
  border-color: #f3d19e;
  background: #fdf6ec;
}
.sg-card-hover {
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.sg-card-hover:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.sg-card-moving {
  box-shadow: 0 0 0 2px #409eff;
}
.sg-card-head {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sg-card-name {
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.sg-scene-badge {
  flex-shrink: 0;
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #f3d19e;
  border-radius: 9999px;
  font-size: 10px;
  padding: 0 4px;
  line-height: 16px;
}
.sg-card-meta {
  display: flex;
  align-items: center;
  gap: 2px;
  color: #909399;
  margin-top: 2px;
}
.sg-meta-icon {
  font-size: 12px;
  flex-shrink: 0;
}
.sg-meta-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sg-card-week {
  margin-top: 2px;
  color: #909399;
  font-size: 10px;
}
</style>

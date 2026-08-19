<!--
  学期周课表网格（7 列星期 × 节次行），学生/教师工作台「我的课表」共用。
  对齐 React frontend/edu/components/shared/schedule-grid.tsx
  （节次行优先取节次配置并按 sortOrder 排序，缺省时从课表条目的 periods 归并；
   按周次过滤支持单/双周；场景课带「场景」徽标；提供 href 时整卡可跳转）。
-->
<template>
  <div class="schedule-grid-wrap">
    <div v-if="loading" class="grid-loading">加载中...</div>
    <el-empty v-else-if="!hasData && !alwaysShow" :description="emptyText" />
    <table v-else class="schedule-table">
      <thead>
        <tr>
          <th class="period-col">节次</th>
          <th v-for="d in DAY_LABELS" :key="d">{{ d }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in displayRows" :key="row.key">
          <td class="period-cell">
            <div class="period-label">{{ row.label }}</div>
            <div v-if="row.time" class="period-time">{{ row.time }}</div>
          </td>
          <td v-for="(_, dayIdx) in DAY_LABELS" :key="dayIdx" class="slot-cell">
            <div class="slot-inner">
              <component
                v-for="entry in cellEntries(dayIdx + 1, row.key)"
                :is="entryHref(entry) ? 'router-link' : 'div'"
                :key="entry.id"
                :to="entryHref(entry)"
                class="entry-link"
              >
                <div class="entry-card" :class="entry.type === 'scene' ? 'is-scene' : 'is-course'">
                  <div class="entry-head">
                    <span class="entry-name">{{ entry.courseName }}</span>
                    <span v-if="entry.type === 'scene'" class="entry-badge">场景</span>
                  </div>
                  <div v-if="entry.teacherName" class="entry-meta">
                    <el-icon><User /></el-icon>{{ entry.teacherName }}
                  </div>
                  <div v-if="entry.venueName" class="entry-meta">
                    <el-icon><Location /></el-icon>{{ entry.venueName }}
                  </div>
                  <div class="entry-meta">
                    第{{ entry.startWeek }}-{{ entry.endWeek }}周{{ weekPatternSuffix(entry.weekPattern) }}
                  </div>
                </div>
              </component>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Location, User } from '@element-plus/icons-vue';
import type { PeriodSlot, ScheduleEntry } from '@/types/affairs';

const props = withDefaults(
  defineProps<{
    entries: ScheduleEntry[];
    periodSlots?: PeriodSlot[];
    week?: number;
    loading?: boolean;
    emptyText?: string;
    alwaysShow?: boolean;
    getEntryHref?: (entry: ScheduleEntry) => string | undefined;
  }>(),
  {
    periodSlots: () => [],
    loading: false,
    emptyText: '暂无课表数据',
    alwaysShow: false
  }
);

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface GridRow {
  key: string;
  label: string;
  time?: string;
}

/** 按周次过滤：startWeek <= week <= endWeek 且周次模式匹配 */
const visibleEntries = computed(() => {
  const entries = props.entries || [];
  const week = props.week;
  if (!week) return entries;
  return entries.filter((e) => {
    if (e.startWeek > week || e.endWeek < week) return false;
    if (e.weekPattern === 'odd') return week % 2 === 1;
    if (e.weekPattern === 'even') return week % 2 === 0;
    return true;
  });
});

const rows = computed<GridRow[]>(() => {
  if (props.periodSlots && props.periodSlots.length > 0) {
    return [...props.periodSlots]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        key: s.name,
        label: s.name,
        time: s.startTime
          ? `${s.startTime.slice(0, 5)}${s.endTime ? `-${s.endTime.slice(0, 5)}` : ''}`
          : undefined
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

function cellEntries(dayOfWeek: number, periodKey: string): ScheduleEntry[] {
  return cellMap.value.get(`${dayOfWeek}:${periodKey}`) || [];
}

function entryHref(entry: ScheduleEntry): string | undefined {
  return props.getEntryHref?.(entry);
}

function weekPatternSuffix(pattern: string): string {
  if (pattern === 'odd') return '（单周）';
  if (pattern === 'even') return '（双周）';
  return '';
}
</script>

<style scoped>
.schedule-grid-wrap {
  overflow-x: auto;
}
.grid-loading {
  padding: 64px 0;
  text-align: center;
  font-size: 14px;
  color: #9ca3af;
}
.schedule-table {
  min-width: 840px;
  width: 100%;
  border-collapse: collapse;
}
.schedule-table th {
  border: 1px solid #ebeef5;
  background: rgba(245, 247, 250, 0.6);
  padding: 8px 4px;
  font-size: 12px;
  font-weight: 500;
  color: #909399;
  width: 130px;
}
.schedule-table th.period-col {
  width: 80px;
}
.schedule-table td {
  border: 1px solid #ebeef5;
  padding: 4px;
  vertical-align: top;
}
.period-cell {
  background: rgba(245, 247, 250, 0.4);
  padding: 6px 8px !important;
}
.period-label {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}
.period-time {
  font-size: 10px;
  color: #909399;
}
.slot-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 32px;
}
.entry-link {
  display: block;
  text-decoration: none;
  color: inherit;
}
.entry-card {
  max-width: 130px;
  border: 1px solid;
  border-radius: 6px;
  padding: 4px;
  font-size: 11px;
  line-height: 1.3;
  transition: box-shadow 0.2s;
}
.entry-card.is-course {
  border-color: #bfdbfe;
  background: #eff6ff;
}
.entry-card.is-scene {
  border-color: #fed7aa;
  background: #fff7ed;
}
.entry-link:hover .entry-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.entry-head {
  display: flex;
  align-items: center;
  gap: 4px;
}
.entry-name {
  font-weight: 500;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-badge {
  flex-shrink: 0;
  border-radius: 999px;
  background: #ffedd5;
  color: #ea580c;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 500;
}
.entry-meta {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<!--
  课表格位事件卡（教师工作台课程日历）。
  对齐 React teacher-dashboard-tab.tsx 格位卡片：类型徽标 + tag + 标题 + 描述 + 地点，
  课程/场景类事件底部追加「点击查看操作」提示（hint）。
-->
<template>
  <div
    class="ev-card"
    :style="{ background: style.bg, borderColor: style.border }"
    :class="{ hoverable: hint }"
  >
    <div class="ev-top">
      <span class="ev-badge" :style="{ color: style.badge, borderColor: style.badge }">
        {{ style.label }}
      </span>
      <span v-if="event.tag" class="ev-tag">{{ event.tag }}</span>
    </div>
    <div class="ev-title">{{ event.title }}</div>
    <div v-if="event.description" class="ev-line">{{ event.description }}</div>
    <div v-if="event.location" class="ev-line">📍{{ event.location }}</div>
    <div v-if="hint" class="ev-hint" :style="{ color: style.badge }">点击查看操作</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WorkspaceScheduleEvent } from './workspace-api';
import { SCHEDULE_TYPE_CONFIG } from './workspace-teacher-types';

const props = withDefaults(defineProps<{ event: WorkspaceScheduleEvent; hint?: boolean }>(), {
  hint: false
});

const style = computed(
  () => SCHEDULE_TYPE_CONFIG[props.event.type] || SCHEDULE_TYPE_CONFIG.todo
);
</script>

<style scoped>
.ev-card {
  width: 100%;
  height: 100%;
  min-height: 68px;
  border: 1px solid;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}
.ev-card.hoverable:hover,
.ev-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transform: scale(1.02);
}
.ev-top {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.ev-badge {
  flex-shrink: 0;
  font-size: 10px;
  line-height: 16px;
  padding: 0 4px;
  border: 1px solid;
  border-radius: 4px;
  font-weight: 500;
}
.ev-tag,
.ev-line {
  font-size: 10px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ev-title {
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ev-hint {
  margin-top: 2px;
  font-size: 10px;
  font-weight: 500;
}
</style>

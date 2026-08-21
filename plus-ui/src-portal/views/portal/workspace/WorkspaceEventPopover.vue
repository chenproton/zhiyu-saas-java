<!--
  课表事件气泡：可跳转事件（课程/场景）点击弹出「前往学习 / 查看测评结果」。
  对齐原 React 版 workspace-schedule-grid.tsx
  的 ScheduleEventPopover（不可跳转事件原样渲染，不挂气泡；查看测评结果按钮禁用）。
-->
<template>
  <el-popover
    v-if="learnUrl"
    placement="right"
    trigger="click"
    :width="288"
    :show-arrow="false"
    popper-class="ws-event-popover"
  >
    <template #reference>
      <span class="popover-trigger"><slot /></span>
    </template>
    <div class="pop-body">
      <div class="pop-head">
        <span class="pop-title">{{ event.title }}</span>
        <el-tag v-if="event.tag" size="small" type="info">{{ event.tag }}</el-tag>
      </div>
      <div class="pop-meta">
        <div v-if="event.teacher" class="pop-meta-row">
          <el-icon><User /></el-icon>{{ event.teacher }}
        </div>
        <div v-if="event.location" class="pop-meta-row">
          <el-icon><Location /></el-icon>{{ event.location }}
        </div>
        <div v-if="event.description" class="pop-desc">{{ event.description }}</div>
      </div>
      <div class="pop-actions" :class="isCourse ? 'course' : 'scene'">
        <span class="pop-actions-label">操作</span>
        <div class="pop-actions-row">
          <el-button size="small" :class="isCourse ? 'go-course' : 'go-scene'" @click="goLearn">
            <el-icon><Link /></el-icon>前往学习
          </el-button>
          <el-button size="small" disabled>
            <el-icon><DocumentChecked /></el-icon>查看测评结果
          </el-button>
        </div>
      </div>
    </div>
  </el-popover>
  <slot v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { DocumentChecked, Link, Location, User } from '@element-plus/icons-vue';
import type { WorkspaceScheduleEvent } from './workspace-api';
import { lessonLandingHref, sceneLandingHref } from './workspace-utils';

const props = defineProps<{ event: WorkspaceScheduleEvent }>();
const router = useRouter();

const isCourse = computed(() => props.event.type === 'course');

/** 学生入口带排课 stamp 的 resourceVersion（?v=），按班级绑定版本读快照 */
const learnUrl = computed(() => {
  const e = props.event;
  if (e.type === 'scene' && e.scenarioId) return sceneLandingHref(e.scenarioId, e.resourceVersion);
  if (e.type === 'course' && e.courseId) return lessonLandingHref(e.courseId, e.resourceVersion);
  return '';
});

function goLearn() {
  if (learnUrl.value) router.push(learnUrl.value);
}
</script>

<style scoped>
.popover-trigger {
  display: block;
  width: 100%;
  height: 100%;
}
.pop-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pop-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}
.pop-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pop-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}
.pop-meta-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.pop-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pop-actions {
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: rgba(239, 246, 255, 0.5);
  padding: 8px;
}
.pop-actions.scene {
  border-color: #fed7aa;
  background: rgba(255, 247, 237, 0.6);
}
.pop-actions-label {
  display: block;
  font-size: 10px;
  color: #9ca3af;
  margin-bottom: 6px;
}
.pop-actions-row {
  display: flex;
  gap: 8px;
}
.pop-actions-row :deep(.el-button) {
  flex: 1;
  font-size: 11px;
}
.pop-actions-row :deep(.go-course) {
  border-color: #bfdbfe;
  color: #2563eb;
}
.pop-actions-row :deep(.go-scene) {
  border-color: #fed7aa;
  color: #ea580c;
}
</style>

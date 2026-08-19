<!--
  课表格位气泡内容（教师工作台课程日历的课程/场景事件操作）。
  对齐 React teacher-dashboard-tab.tsx 的 PopoverContent：
  - 头部：事件标题 + 班级徽标；
  - 已关联节次/任务块（有关联时）：条目列表 + 「修改关联」；
  - 操作：前往备课 / 导学准备（弹关联备课弹窗）、前往上课 / 前往导学（站内跳转，无链接则禁用）、
    前往评分（场景 → /evaluation/scene-results；课程 → 查课程类型：混合课弹考勤评分，其余进课程节点测评）；
  - 数据查看：教学进展 / 测评进展（弹课程数据弹窗）。
-->
<template>
  <div class="pop-body">
    <div class="pop-head">
      <span class="pop-title">{{ event.title }}</span>
      <el-tag v-if="event.className" size="small" type="info" effect="light">
        {{ event.className }}
      </el-tag>
    </div>

    <div
      v-if="association && association.subItems.length > 0"
      class="assoc-block"
      :class="{ scene: !meta.isHybrid }"
    >
      <span class="assoc-title">
        {{ meta.isHybrid ? '已关联节次' : '已关联任务' }}（{{ association.subItems.length }}）
      </span>
      <div class="assoc-list">
        <div v-for="si in association.subItems" :key="si.id" class="assoc-item">{{ si.name }}</div>
      </div>
      <el-button link size="small" class="assoc-edit" @click="requestPrep">修改关联</el-button>
    </div>

    <span class="pop-label">操作</span>
    <div class="pop-actions">
      <el-button size="small" class="act-btn" :class="actClass" @click="requestPrep">
        <el-icon><Link /></el-icon>{{ meta.isHybrid ? '前往备课' : '导学准备' }}
      </el-button>
      <el-button
        size="small"
        class="act-btn"
        :class="actClass"
        :disabled="!meta.learnUrl"
        @click="goLearn"
      >
        <el-icon><VideoPlay /></el-icon>{{ meta.isHybrid ? '前往上课' : '前往导学' }}
      </el-button>
      <el-button size="small" class="act-btn act-amber" :loading="grading" @click="goGrade">
        <el-icon><School /></el-icon>前往评分
      </el-button>
    </div>

    <div class="pop-foot">
      <span class="pop-label">数据查看</span>
      <div class="pop-actions">
        <el-button link size="small" class="link-btn" :class="linkClass" @click="emitDetail('tracking')">
          <el-icon><TrendCharts /></el-icon>教学进展
        </el-button>
        <el-button link size="small" class="link-btn link-primary" @click="emitDetail('assessment')">
          <el-icon><DocumentChecked /></el-icon>测评进展
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  DocumentChecked,
  Link,
  School,
  TrendCharts,
  VideoPlay
} from '@element-plus/icons-vue';
import { courseApi } from '@/api/lesson';
import type { WorkspaceScheduleEvent } from './workspace-api';
import type {
  CellMeta,
  HybridGradeRequest,
  PrepAssociationRecord,
  PrepRequest
} from './workspace-teacher-types';

const props = defineProps<{
  event: WorkspaceScheduleEvent;
  meta: CellMeta;
  association?: PrepAssociationRecord;
}>();

const emit = defineEmits<{
  prep: [payload: PrepRequest];
  grade: [payload: HybridGradeRequest];
  detail: [payload: { event: WorkspaceScheduleEvent; tab: 'tracking' | 'assessment' }];
}>();

const router = useRouter();
const grading = ref(false);

const actClass = computed(() => (props.meta.isHybrid ? 'act-primary' : 'act-emerald'));
const linkClass = computed(() => (props.meta.isHybrid ? 'link-primary' : 'link-emerald'));

function requestPrep() {
  emit('prep', {
    planId: props.meta.planId,
    sessionKey: props.meta.sessionKey,
    planName: props.event.title,
    isHybrid: props.meta.isHybrid,
    prepUrl: props.meta.prepUrl
  });
}

function goLearn() {
  if (props.meta.learnUrl) void router.push(props.meta.learnUrl);
}

async function goGrade() {
  const event = props.event;
  // 场景事件 → 场景任务评价
  if (event.type === 'scene') {
    void router.push('/evaluation/scene-results');
    return;
  }
  // 课程类事件：混合课保留考勤评分，其余进课程节点测评评分
  if (event.courseId) {
    grading.value = true;
    try {
      const course = await courseApi.get(event.courseId);
      if (course.type === 'hybrid') {
        emit('grade', {
          title: `${event.title} · ${event.period}`,
          className: event.className || event.tag || '',
          courseId: event.courseId
        });
        return;
      }
    } catch {
      // 课程查询失败按非混合课处理
    } finally {
      grading.value = false;
    }
  }
  void router.push(
    event.courseId
      ? `/evaluation/lesson-results?courseId=${event.courseId}`
      : '/evaluation/lesson-results'
  );
}

function emitDetail(tab: 'tracking' | 'assessment') {
  emit('detail', { event: props.event, tab });
}
</script>

<style scoped>
.pop-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.assoc-block {
  border: 1px solid var(--el-color-primary-light-8);
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.assoc-block.scene {
  border-color: #a7f3d0;
  background: rgba(236, 253, 245, 0.6);
}
.assoc-title {
  font-size: 10px;
  font-weight: 500;
  color: var(--el-color-primary);
}
.assoc-block.scene .assoc-title {
  color: #059669;
}
.assoc-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 100px;
  overflow-y: auto;
}
.assoc-item {
  font-size: 12px;
  color: #374151;
  padding-left: 8px;
  border-left: 2px solid var(--el-color-primary-light-7);
}
.assoc-block.scene .assoc-item {
  border-left-color: #a7f3d0;
}
.assoc-edit {
  align-self: flex-start;
  font-size: 10px;
}
.pop-label {
  font-size: 10px;
  color: #9ca3af;
}
.pop-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pop-actions :deep(.el-button) {
  flex: 1;
  font-size: 11px;
  margin-left: 0;
}
.act-btn.act-primary {
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
}
.act-btn.act-emerald {
  border-color: #a7f3d0;
  color: #059669;
}
.act-btn.act-amber {
  border-color: #fde68a;
  color: #d97706;
}
.pop-foot {
  border-top: 1px dashed #e5e7eb;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.link-btn.link-primary {
  color: var(--el-color-primary);
}
.link-btn.link-emerald {
  color: #059669;
}
</style>

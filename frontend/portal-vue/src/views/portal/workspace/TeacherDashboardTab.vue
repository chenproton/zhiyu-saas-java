<!--
  教师工作台首页 Tab：左侧课程日历（3/4）+ 右侧「待办事项 / 通知公告」（1/4）。
  对齐 React frontend/edu/app/portal/workspace/_components/teacher-dashboard-tab.tsx（794 行）：
  - 数据源：GET /portal/workspace/dashboard?role=teacher（announcements/todos/schedule/classPlans/classSessions）；
  - 课程日历：TeacherScheduleTable（周视图 + 格位气泡操作）；
  - 待办事项：按 type 取图标与中文标签（成绩/审批/作业/审核），空态「暂无待办事项」，
    「全部待办」跳「我的场景/课程」Tab；
  - 通知公告：重要标红、isNew 红点，空态「暂无通知公告」；
  - 弹窗：关联备课（PrepAssociateDialog）、混合课评分（HybridGradingDialog）、课程数据（CourseDetailDialog）。
-->
<template>
  <div class="teacher-dashboard">
    <div class="dash-grid">
      <div class="grid-main">
        <SectionCard>
          <TeacherScheduleTable
            :events="schedule"
            :class-plans="classPlans"
            :class-sessions="classSessions"
            :prep-associations="prepAssociations"
            @prep="openPrepDialog"
            @grade="openHybridGrading"
            @detail="openCourseDetail"
          />
        </SectionCard>
      </div>

      <div class="grid-side">
        <!-- 待办事项 -->
        <SectionCard
          title="待办事项"
          :icon="Checked"
          icon-color="rose"
          action-label="全部待办"
          @action="emit('tab-change', 'courses')"
        >
          <el-scrollbar height="260px">
            <div class="todo-list">
              <div v-if="todos.length === 0" class="empty-line">暂无待办事项</div>
              <div v-for="item in todos" :key="item.id" class="todo-item">
                <div class="todo-left">
                  <span class="todo-icon">
                    <el-icon><component :is="typeIcon(item.type)" /></el-icon>
                  </span>
                  <div class="todo-text">
                    <p class="todo-title">{{ item.title }}</p>
                    <p v-if="item.deadline" class="todo-deadline">
                      <el-icon><Clock /></el-icon>
                      截止 {{ item.deadline }} · {{ typeLabel(item.type) }}
                    </p>
                  </div>
                </div>
                <div class="todo-right">
                  <el-tag size="small" :type="item.urgent ? 'danger' : 'info'" effect="light">
                    {{ item.count }}
                  </el-tag>
                  <el-icon class="todo-arrow"><ArrowRight /></el-icon>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </SectionCard>

        <!-- 通知公告 -->
        <SectionCard title="通知公告" :icon="Bell" icon-color="blue" action-label="全部通知">
          <el-scrollbar height="240px">
            <div class="notice-list">
              <div v-if="announcements.length === 0" class="empty-line">暂无通知公告</div>
              <div v-for="item in announcements" :key="item.id" class="notice-item">
                <el-tag
                  size="small"
                  :type="item.type === '重要' ? 'danger' : 'info'"
                  effect="light"
                  class="notice-badge"
                >
                  {{ item.type }}
                </el-tag>
                <div class="notice-body">
                  <p class="notice-title">{{ item.title }}</p>
                  <p class="notice-date">{{ item.date }}</p>
                </div>
                <span v-if="item.isNew" class="notice-dot" />
              </div>
            </div>
          </el-scrollbar>
        </SectionCard>
      </div>
    </div>

    <PrepAssociateDialog
      v-model:open="prepDialogOpen"
      :plan-id="prepPlanId"
      :plan-name="prepPlanName"
      :is-hybrid="prepIsHybrid"
      :current-sub-item-ids="prepAssociations[prepSessionId]?.subItems.map((s) => s.id)"
      :prep-url="prepUrl"
      @confirm="handlePrepConfirm"
    />
    <HybridGradingDialog
      v-model:open="hybridGradeDialogOpen"
      :session-title="hybridGradeSessionTitle"
      :class-name="hybridGradeClassName"
      :course-id="hybridGradeCourseId"
    />
    <CourseDetailDialog
      v-model:open="courseDialogOpen"
      :course="courseDetailTarget"
      :tab="courseDetailTab"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { Component } from 'vue';
import {
  ArrowRight,
  Bell,
  Checked,
  Clock,
  Document,
  Reading,
  School,
  Tickets
} from '@element-plus/icons-vue';
import SectionCard from './SectionCard.vue';
import TeacherScheduleTable from './TeacherScheduleTable.vue';
import PrepAssociateDialog from './PrepAssociateDialog.vue';
import HybridGradingDialog from './HybridGradingDialog.vue';
import CourseDetailDialog from './CourseDetailDialog.vue';
import { workspaceDashboardApi } from './workspace-api';
import type {
  WorkspaceAnnouncement,
  WorkspaceClassPlan,
  WorkspaceClassSession,
  WorkspaceScheduleEvent,
  WorkspaceTodo
} from './workspace-api';
import type {
  CourseDetailTarget,
  HybridGradeRequest,
  PrepAssociationRecord,
  PrepRequest,
  PrepSubItem
} from './workspace-teacher-types';

const props = withDefaults(
  defineProps<{ prepAssociations?: Record<string, PrepAssociationRecord> }>(),
  { prepAssociations: () => ({}) }
);
const emit = defineEmits<{
  'tab-change': [tab: string];
  associate: [sessionId: string, record: PrepAssociationRecord];
}>();

/** 待办类型 → 图标 / 中文标签（对齐 React typeIconMap / typeLabelMap） */
const TYPE_ICONS: Record<string, Component> = {
  grade: School,
  approve: Tickets,
  homework: Reading,
  review: Checked
};
const TYPE_LABELS: Record<string, string> = {
  grade: '成绩',
  approve: '审批',
  homework: '作业',
  review: '审核'
};

const announcements = ref<WorkspaceAnnouncement[]>([]);
const todos = ref<WorkspaceTodo[]>([]);
const schedule = ref<WorkspaceScheduleEvent[]>([]);
const classPlans = ref<WorkspaceClassPlan[]>([]);
const classSessions = ref<WorkspaceClassSession[]>([]);

/* 关联备课弹窗 */
const prepDialogOpen = ref(false);
const prepPlanId = ref('');
const prepSessionId = ref('');
const prepPlanName = ref('');
const prepIsHybrid = ref(true);
const prepUrl = ref('');

/* 混合课评分弹窗 */
const hybridGradeDialogOpen = ref(false);
const hybridGradeSessionTitle = ref('');
const hybridGradeClassName = ref('');
const hybridGradeCourseId = ref<string | undefined>(undefined);

/* 课程数据弹窗 */
const courseDialogOpen = ref(false);
const courseDetailTarget = ref<CourseDetailTarget | null>(null);
const courseDetailTab = ref<'tracking' | 'assessment'>('tracking');

function typeIcon(type: string): Component {
  return TYPE_ICONS[type] || Document;
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

function openPrepDialog(payload: PrepRequest) {
  prepPlanId.value = payload.planId;
  prepSessionId.value = payload.sessionKey;
  prepPlanName.value = payload.planName;
  prepIsHybrid.value = payload.isHybrid;
  prepUrl.value = payload.prepUrl;
  prepDialogOpen.value = true;
}

function handlePrepConfirm(subItems: PrepSubItem[]) {
  emit('associate', prepSessionId.value, {
    planId: prepPlanId.value,
    subItems: subItems.map((s) => ({ id: s.id, name: s.name }))
  });
}

function openHybridGrading(payload: HybridGradeRequest) {
  hybridGradeSessionTitle.value = payload.title;
  hybridGradeClassName.value = payload.className;
  hybridGradeCourseId.value = payload.courseId;
  hybridGradeDialogOpen.value = true;
}

function openCourseDetail(payload: { course: CourseDetailTarget; tab: 'tracking' | 'assessment' }) {
  courseDetailTarget.value = payload.course;
  courseDetailTab.value = payload.tab;
  courseDialogOpen.value = true;
}

onMounted(async () => {
  try {
    const res = await workspaceDashboardApi.get({ role: 'teacher' });
    announcements.value = res.announcements || [];
    todos.value = res.todos || [];
    schedule.value = res.schedule || [];
    classPlans.value = res.classPlans || [];
    classSessions.value = res.classSessions || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载教师工作台数据失败');
  }
});
</script>

<style scoped>
.teacher-dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dash-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 1024px) {
  .dash-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .grid-main {
    grid-column: span 3;
  }
}
.grid-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty-line {
  padding: 32px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}

/* 待办事项 */
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 8px;
}
.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: rgba(249, 250, 251, 0.5);
  cursor: pointer;
  transition: background-color 0.2s;
}
.todo-item:hover {
  background: #f9fafb;
}
.todo-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.todo-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #f3f4f6;
  color: #6b7280;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.todo-text {
  min-width: 0;
}
.todo-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.todo-deadline {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
}
.todo-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.todo-arrow {
  color: #d1d5db;
}

/* 通知公告 */
.notice-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 8px;
}
.notice-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.notice-item:hover {
  background: #f9fafb;
}
.notice-badge {
  flex-shrink: 0;
  margin-top: 2px;
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
</style>

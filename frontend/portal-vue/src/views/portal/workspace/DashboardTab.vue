<!--
  工作台首页 Tab：左侧课表（3/4）+ 右侧「今日待办 / 通知公告」（1/4）。
  对齐 React frontend/edu/app/portal/workspace/_components/dashboard-tab.tsx
  （dashboard 接口按 activeRoleCode 取数；角色切换用请求序号丢弃过期响应；
   待办空态「暂无待办事项」、公告空态「暂无通知公告」；待办「查看全部」跳「我的学习」）。
-->
<template>
  <div class="dashboard-tab">
    <div class="dashboard-grid">
      <div class="grid-main">
        <SectionCard>
          <WorkspaceScheduleGrid :events="schedule" />
        </SectionCard>
      </div>

      <div class="grid-side">
        <!-- 今日待办 -->
        <SectionCard
          title="今日待办"
          :icon="Checked"
          icon-color="rose"
          action-label="查看全部"
          @action="emit('tab-change', 'learning')"
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
        <SectionCard title="通知公告" :icon="Bell" icon-color="blue" action-label="查看全部">
          <el-scrollbar height="220px">
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Checked,
  Clock,
  Collection,
  Document,
  Reading,
  School
} from '@element-plus/icons-vue';
import type { Component } from 'vue';
import SectionCard from './SectionCard.vue';
import WorkspaceScheduleGrid from './WorkspaceScheduleGrid.vue';
import { workspaceDashboardApi } from './workspace-api';
import type {
  WorkspaceAnnouncement,
  WorkspaceScheduleEvent,
  WorkspaceTodo
} from './workspace-api';

const props = defineProps<{ activeRoleCode?: string }>();
const emit = defineEmits<{ 'tab-change': [tab: string] }>();

const TYPE_ICONS: Record<string, Component> = {
  course: Reading,
  scene: Collection,
  exam: School,
  report: Briefcase
};
const TYPE_LABELS: Record<string, string> = {
  course: '课程',
  scene: '场景',
  exam: '测评',
  report: '报告'
};

const announcements = ref<WorkspaceAnnouncement[]>([]);
const todos = ref<WorkspaceTodo[]>([]);
const schedule = ref<WorkspaceScheduleEvent[]>([]);
// 角色切换请求序号：丢弃过期响应，防止旧角色数据覆盖新角色
let loadSeq = 0;

function typeIcon(type: string): Component {
  return TYPE_ICONS[type] || Document;
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

async function load() {
  const seq = ++loadSeq;
  try {
    const res = await workspaceDashboardApi.get(
      props.activeRoleCode ? { role: props.activeRoleCode } : undefined
    );
    if (seq !== loadSeq) return;
    announcements.value = res.announcements || [];
    todos.value = res.todos || [];
    schedule.value = res.schedule || [];
  } catch (e) {
    if (seq !== loadSeq) return;
    ElMessage.error((e as Error).message || '加载工作台 dashboard 失败');
  }
}

onMounted(load);
watch(() => props.activeRoleCode, load);
</script>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 1024px) {
  .dashboard-grid {
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

/* 今日待办 */
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

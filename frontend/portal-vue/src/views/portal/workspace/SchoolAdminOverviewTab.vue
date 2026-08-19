<!--
  学校管理员工作台首页 Tab（资源运营驾驶舱）。
  对齐 React frontend/edu/app/portal/workspace/_components/school-admin-overview-tab.tsx（248 行）：
  - 数据源：GET /portal/workspace/dashboard?role=school_admin（resourceStats/personnelStats/todos/announcements）；
  - 资源管理入口：后端下发的资源存量卡（icon key → 图标，href 跳转）+ 3 个固定入口
    （教学资源共享库 /library/knowledge、教务管理 /affairs/programs、产教融合 /portal/apps/alliance/enterprises）；
  - 学校人员概览：人员计数卡，空态「暂无人员数据」；
  - 右侧：待办事项（「全部待办」跳审批中心 Tab，空态「暂无待办事项」）+ 通知公告（空态「暂无通知公告」）。
-->
<template>
  <div class="admin-overview">
    <div class="overview-grid">
      <div class="grid-main">
        <!-- 资源管理入口 -->
        <SectionCard title="资源管理入口" :icon="Grid" icon-color="blue">
          <div class="entry-grid">
            <div
              v-for="item in resourceEntries"
              :key="item.label"
              class="entry-card"
              :class="{ disabled: !item.to }"
              @click="go(item.to)"
            >
              <span class="entry-icon">
                <el-icon :size="22"><component :is="resourceIcon(item.icon)" /></el-icon>
              </span>
              <span class="entry-text">
                <span class="entry-value">{{ item.value }}</span>
                <span class="entry-label">{{ item.label }}</span>
              </span>
              <el-icon class="entry-arrow"><ArrowRight /></el-icon>
            </div>

            <div
              v-for="entry in EXTRA_ENTRIES"
              :key="entry.label"
              class="entry-card"
              @click="go(entry.href)"
            >
              <span class="entry-icon">
                <el-icon :size="22"><component :is="entry.icon" /></el-icon>
              </span>
              <span class="entry-text">
                <span class="entry-title">{{ entry.label }}</span>
                <span class="entry-desc">{{ entry.desc }}</span>
              </span>
              <el-icon class="entry-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </SectionCard>

        <!-- 学校人员概览 -->
        <SectionCard title="学校人员概览" :icon="UserFilled" icon-color="green">
          <div class="person-grid">
            <div v-for="item in personnelStats" :key="item.label" class="person-card">
              <div class="person-value">{{ item.value }}</div>
              <div class="person-label">{{ item.label }}</div>
            </div>
            <div v-if="personnelStats.length === 0" class="empty-line">暂无人员数据</div>
          </div>
        </SectionCard>
      </div>

      <div class="grid-side">
        <!-- 待办事项 -->
        <SectionCard
          title="待办事项"
          :icon="Checked"
          icon-color="rose"
          action-label="全部待办"
          @action="emit('tab-change', 'approvals')"
        >
          <el-scrollbar height="260px">
            <div class="todo-list">
              <div v-if="todos.length === 0" class="empty-line">暂无待办事项</div>
              <div v-for="item in todos" :key="item.id" class="todo-item">
                <div class="todo-left">
                  <span class="todo-icon"><el-icon><Tickets /></el-icon></span>
                  <div class="todo-text">
                    <p class="todo-title">{{ item.title }}</p>
                    <p v-if="item.deadline" class="todo-deadline">
                      <el-icon><Clock /></el-icon>截止 {{ item.deadline }}
                    </p>
                  </div>
                </div>
                <div class="todo-right">
                  <el-tag size="small" type="danger" effect="light">{{ item.count }}</el-tag>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { Component } from 'vue';
import {
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  Checked,
  Clock,
  Coin,
  Collection,
  Document,
  Files,
  Grid,
  Reading,
  Tickets,
  UserFilled
} from '@element-plus/icons-vue';
import SectionCard from './SectionCard.vue';
import { workspaceDashboardApi } from './workspace-api';
import type {
  WorkspaceAnnouncement,
  WorkspacePersonnelStat,
  WorkspaceResourceStat,
  WorkspaceTodo
} from './workspace-api';

const emit = defineEmits<{ 'tab-change': [tab: string] }>();

/** 后端下发的 icon key → Element Plus 图标（对齐 React iconMap） */
const ICON_MAP: Record<string, Component> = {
  'book-open': Reading,
  layers: Collection,
  briefcase: Briefcase,
  'file-text': Document,
  'check-circle': Checked
};

/** 固定资源入口（对齐 React extraResourceEntries） */
const EXTRA_ENTRIES: { label: string; icon: Component; href: string; desc: string }[] = [
  { label: '教学资源共享库', icon: Files, href: '/library/knowledge', desc: '知识点、能力点与教学资源' },
  { label: '教务管理', icon: Calendar, href: '/affairs/programs', desc: '培养方案、教学计划、排课' },
  {
    label: '产教融合',
    icon: UserFilled,
    href: '/portal/apps/alliance/enterprises',
    desc: '合作企业、项目与成果'
  }
];

const announcements = ref<WorkspaceAnnouncement[]>([]);
const todos = ref<WorkspaceTodo[]>([]);
const resourceStats = ref<WorkspaceResourceStat[]>([]);
const personnelStats = ref<WorkspacePersonnelStat[]>([]);

const router = useRouter();

/**
 * 后端下发的 href 到 Vue 路由的对齐：
 * - `/scene/` 在 React/Vue 两侧都无对应页面，Vue 侧归一到场景列表 `/scene/scenarios`，避免入口点不动；
 * - 其余 href 无对应路由时置空（卡片不可点），不产生无匹配路由跳转。
 */
const HREF_ALIASES: Record<string, string> = {
  '/scene/': '/scene/scenarios',
  '/scene': '/scene/scenarios'
};

const resourceEntries = computed(() =>
  resourceStats.value.map((item) => ({ ...item, to: resolveHref(item.href) }))
);

function resolveHref(href?: string): string {
  if (!href) return '';
  const path = HREF_ALIASES[href] || href;
  return router.resolve(path).matched.length > 0 ? path : '';
}

function go(path: string) {
  if (path) void router.push(path);
}

function resourceIcon(key?: string): Component {
  return ICON_MAP[key || ''] || Coin;
}

onMounted(async () => {
  try {
    const res = await workspaceDashboardApi.get({ role: 'school_admin' });
    announcements.value = res.announcements || [];
    todos.value = res.todos || [];
    resourceStats.value = res.resourceStats || [];
    personnelStats.value = res.personnelStats || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载学校管理员工作台数据失败');
  }
});
</script>

<style scoped>
.admin-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 1024px) {
  .overview-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .grid-main { grid-column: span 3; }
}
.grid-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grid-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty-line {
  grid-column: 1 / -1;
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}

/* 资源入口 */
.entry-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
@media (min-width: 640px) {
  .entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1280px) {
  .entry-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.entry-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: rgba(249, 250, 251, 0.5);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.entry-card.disabled {
  cursor: default;
}
.entry-card:hover {
  background: #fff;
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.entry-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #f3f4f6;
  color: var(--el-color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.entry-card:hover .entry-icon {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}
.entry-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.entry-value {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}
.entry-label,
.entry-desc {
  font-size: 13px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.entry-desc {
  margin-top: 2px;
  font-size: 12px;
}
.entry-arrow {
  flex-shrink: 0;
  color: #d1d5db;
}
.entry-card:hover .entry-arrow {
  color: var(--el-color-primary);
}

/* 人员概览 */
.person-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 640px) {
  .person-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.person-card {
  padding: 12px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: rgba(249, 250, 251, 0.5);
  text-align: center;
}
.person-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}
.person-label {
  margin-top: 2px;
  font-size: 12px;
  color: #6b7280;
}

/* 待办 */
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

/* 公告 */
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

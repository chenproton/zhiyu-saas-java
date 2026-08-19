<!--
  教师学生情况 Tab（学校管理员）。
  对齐 React frontend/edu/app/portal/workspace/_components/school-admin-personnel-tab.tsx（129 行）：
  - 数据源：GET /portal/workspace/dashboard?role=school_admin 的 personnelStats（学生/教职工/企业导师/学校管理员）；
  - 顶部计数卡：按人员类别取图标（学生/教职工/企业导师/学校管理员），主色渐变卡；
  - 人员管理入口：学生管理 / 教职工管理 / 账户列表 / 角色权限 / 组织架构（跳 /portal/apps/system/org-user/*）。
-->
<template>
  <div class="admin-personnel">
    <div class="stat-grid">
      <div v-for="item in personnelStats" :key="item.label" class="stat-card">
        <div>
          <p class="stat-label">{{ item.label }}</p>
          <p class="stat-value">{{ item.value }}</p>
        </div>
        <span class="stat-icon">
          <el-icon :size="22"><component :is="personIcon(item.label)" /></el-icon>
        </span>
      </div>
      <div v-if="personnelStats.length === 0" class="empty-line">暂无人员数据</div>
    </div>

    <SectionCard title="人员管理入口" :icon="UserFilled" icon-color="green">
      <div class="entry-grid">
        <div
          v-for="entry in QUICK_LINKS"
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { Component } from 'vue';
import {
  ArrowRight,
  Avatar,
  Key,
  OfficeBuilding,
  School,
  Setting,
  User,
  UserFilled
} from '@element-plus/icons-vue';
import SectionCard from './SectionCard.vue';
import { workspaceDashboardApi } from './workspace-api';
import type { WorkspacePersonnelStat } from './workspace-api';

/** 人员类别 → 图标（对齐 React iconMap） */
const ICON_MAP: Record<string, Component> = {
  学生: School,
  教职工: UserFilled,
  企业导师: Avatar,
  学校管理员: Setting
};

/** 人员管理入口（对齐 React quickLinks） */
const QUICK_LINKS: { label: string; desc: string; href: string; icon: Component }[] = [
  {
    label: '学生管理',
    desc: '查看、编辑、批量导入学生',
    href: '/portal/apps/system/org-user/students',
    icon: School
  },
  {
    label: '教职工管理',
    desc: '管理教师账号与角色',
    href: '/portal/apps/system/org-user/teachers',
    icon: UserFilled
  },
  {
    label: '账户列表',
    desc: '全部账户启停与密码重置',
    href: '/portal/apps/system/org-user/accounts',
    icon: User
  },
  {
    label: '角色权限',
    desc: '自定义角色与菜单授权',
    href: '/portal/apps/system/org-user/roles',
    icon: Key
  },
  {
    label: '组织架构',
    desc: '学院、专业、班级维护',
    href: '/portal/apps/system/org-user/org-structure',
    icon: OfficeBuilding
  }
];

const router = useRouter();
const personnelStats = ref<WorkspacePersonnelStat[]>([]);

function personIcon(label: string): Component {
  return ICON_MAP[label] || UserFilled;
}

function go(path: string) {
  void router.push(path);
}

onMounted(async () => {
  try {
    const res = await workspaceDashboardApi.get({ role: 'school_admin' });
    personnelStats.value = res.personnelStats || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载人员概览失败');
  }
});
</script>

<style scoped>
.admin-personnel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 768px) {
  .stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.stat-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-3));
  color: #fff;
}
.stat-label {
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
}
.stat-value {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}
.stat-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 入口卡 */
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
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: rgba(249, 250, 251, 0.5);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
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
.entry-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.entry-desc {
  margin-top: 2px;
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-arrow {
  flex-shrink: 0;
  margin-top: 12px;
  color: #d1d5db;
}
.entry-card:hover .entry-arrow {
  color: var(--el-color-primary);
}
.empty-line {
  grid-column: 1 / -1;
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}
</style>

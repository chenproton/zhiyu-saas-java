<!--
  我的服务台（/portal/workspace）——完整复刻原 React 版 workspace/page.tsx（911 行）。

  对齐要点：
  - 角色分支：student（学生工作台）/ teacher（教师工作台）/ school_admin（学校管理员工作台），
    其余角色（企业导师等）走通用服务台兜底视图；角色由 /auth/portal/me 的 roles 解析，
    默认优先级 school_admin > teacher > student > enterprise_mentor，
    并与 React 共用 localStorage key `zhiyu-active-role:<userId>` 记忆选择（lib/active-role.ts）。
  - 顶部标题/欢迎语/当前角色胶囊按角色取文案（含今日中文长日期）。
  - Tab 导航：粘顶白底圆角条 + 图标 + 标签 + 激活态（primary 底 + 白字），横向可滚动。
  - `?tab=` 决定激活 Tab；非法/缺省回 dashboard；切换 Tab 用 replace 写回 query（与 React 一致）。
  - 学生 8 个 Tab：工作台首页 / 我的学习 / 我的课表 / 我的收藏 / 测评认证 / 学生画像 / 学习社区 / 个人中心。
  - 教师 5 个 Tab：工作台首页 / 我的场景·课程 / 我的课表 / 我的学生 / 个人中心。
  - 学校管理员 5 个 Tab：工作台首页 / 资源运营 / 审批中心 / 教师学生情况 / 个人中心。
  - 教师备课关联（prepAssociations）在本页持有，供「工作台首页」与「我的场景/课程」共享（对齐 React TeacherWorkspace）。
  - React 顶栏承担的角色切换在 Vue 门户顶栏尚未移植，这里在「当前角色」胶囊上提供下拉切换，
    保证多角色用户三套工作台都可达（写回同一 localStorage key）。
-->
<template>
  <div class="workspace-page">
    <!-- 登录态加载 -->
    <div v-if="loading" class="page-loading">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    </div>

    <!-- 未登录 -->
    <div v-else-if="!user" class="page-guest">
      <p>请先登录后查看服务台</p>
      <router-link to="/portal/login" class="guest-link">去登录</router-link>
    </div>

    <template v-else>
      <!-- 页头 -->
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ headerTitle }}</h1>
          <p class="page-sub">{{ headerSub }}</p>
        </div>

        <el-dropdown v-if="roles.length > 1" trigger="click" placement="bottom-end" @command="switchRole">
          <button type="button" class="role-chip clickable">
            <el-icon><component :is="roleIcon" /></el-icon>
            <span>当前角色：{{ activeRoleName }}</span>
            <el-icon class="role-arrow"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="role in roles"
                :key="role.id"
                :command="role.id"
                :disabled="role.id === activeRole?.id"
              >
                {{ role.name }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div v-else class="role-chip">
          <el-icon><component :is="roleIcon" /></el-icon>
          <span>当前角色：{{ activeRoleName }}</span>
        </div>
      </div>

      <!-- 学生 / 教师 / 学校管理员：Tab 工作台 -->
      <div v-if="tabs.length > 0" class="workspace-body">
        <div class="tab-bar">
          <div class="tab-scroll">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="tab-item"
              :class="{ active: activeTab === tab.id }"
              @click="goTab(tab.id)"
            >
              <el-icon><component :is="tab.icon" /></el-icon>
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div class="tab-content" :key="`${currentRole}-${activeTab}`">
          <!-- ===== 学生 ===== -->
          <template v-if="currentRole === 'student'">
            <DashboardTab
              v-if="activeTab === 'dashboard'"
              :active-role-code="activeRole?.code"
              @tab-change="goTab"
            />
            <LearningTab v-else-if="activeTab === 'learning'" />
            <MyScheduleTab v-else-if="activeTab === 'schedule'" role="student" />
            <CareerTab v-else-if="activeTab === 'career'" />
            <AssessmentTab v-else-if="activeTab === 'assessment'" />
            <PortraitTab v-else-if="activeTab === 'portrait'" :user-id="user?.id" />
            <CommunityTab v-else-if="activeTab === 'community'" />
            <ProfileTab
              v-else-if="activeTab === 'profile'"
              variant="student"
              :user="user"
              :major="major"
              :org-node="orgNode"
              :institution="institution"
            />
          </template>

          <!-- ===== 教师 ===== -->
          <template v-else-if="currentRole === 'teacher'">
            <TeacherDashboardTab
              v-if="activeTab === 'dashboard'"
              :prep-associations="prepAssociations"
              @tab-change="goTab"
              @associate="setPrepAssociation"
            />
            <TeacherCoursesTab
              v-else-if="activeTab === 'courses'"
              :prep-associations="prepAssociations"
              @associate="setPrepAssociation"
            />
            <MyScheduleTab v-else-if="activeTab === 'schedule'" role="teacher" />
            <TeacherPortraitsTab v-else-if="activeTab === 'portraits'" />
            <TeacherProfileTab
              v-else
              :user="user"
              :major="major"
              :org-node="orgNode"
            />
          </template>

          <!-- ===== 学校管理员 ===== -->
          <template v-else>
            <SchoolAdminOverviewTab v-if="activeTab === 'dashboard'" @tab-change="goTab" />
            <SchoolAdminResourcesTab v-else-if="activeTab === 'resources'" />
            <SchoolAdminApprovalsTab v-else-if="activeTab === 'approvals'" />
            <SchoolAdminPersonnelTab v-else-if="activeTab === 'personnel'" />
            <ProfileTab
              v-else
              variant="staff"
              :user="user"
              :major="major"
              :org-node="orgNode"
              :institution="institution"
            />
          </template>
        </div>
      </div>

      <!-- 其它角色（企业导师等）：通用服务台 -->
      <GenericWorkspace v-else :role-code="activeRole?.code" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Component } from 'vue';
import {
  ArrowDown,
  Briefcase,
  Calendar,
  Checked,
  Collection,
  Compass,
  DataBoard,
  Histogram,
  Loading,
  OfficeBuilding,
  ChatDotSquare,
  Reading,
  School,
  Trophy,
  User,
  UserFilled
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import type { Major, Organization, Role } from '@/types/system';
import type { User as PortalUser } from '@/types/user';
import DashboardTab from './workspace/DashboardTab.vue';
import LearningTab from './workspace/LearningTab.vue';
import MyScheduleTab from './workspace/MyScheduleTab.vue';
import CareerTab from './workspace/CareerTab.vue';
import AssessmentTab from './workspace/AssessmentTab.vue';
import PortraitTab from './workspace/PortraitTab.vue';
import CommunityTab from './workspace/CommunityTab.vue';
import ProfileTab from './workspace/ProfileTab.vue';
import TeacherDashboardTab from './workspace/TeacherDashboardTab.vue';
import TeacherCoursesTab from './workspace/TeacherCoursesTab.vue';
import TeacherPortraitsTab from './workspace/TeacherPortraitsTab.vue';
import TeacherProfileTab from './workspace/TeacherProfileTab.vue';
import SchoolAdminOverviewTab from './workspace/SchoolAdminOverviewTab.vue';
import SchoolAdminResourcesTab from './workspace/SchoolAdminResourcesTab.vue';
import SchoolAdminApprovalsTab from './workspace/SchoolAdminApprovalsTab.vue';
import SchoolAdminPersonnelTab from './workspace/SchoolAdminPersonnelTab.vue';
import GenericWorkspace from './workspace/GenericWorkspace.vue';
import { portalMeApi } from './workspace/workspace-api';
import type { PortalInstitution } from './workspace/workspace-api';
import type { PrepAssociationRecord } from './workspace/workspace-teacher-types';
import { persistActiveRole, resolveActiveRole, todayLabel } from './workspace/workspace-utils';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/* ---------- Tab 配置（逐项对齐 React studentTabs / teacherTabs / schoolAdminTabs） ---------- */
interface TabItem {
  id: string;
  label: string;
  icon: Component;
}

const STUDENT_TABS: TabItem[] = [
  { id: 'dashboard', label: '工作台首页', icon: DataBoard },
  { id: 'learning', label: '我的学习', icon: Collection },
  { id: 'schedule', label: '我的课表', icon: Calendar },
  { id: 'career', label: '我的收藏', icon: Compass },
  { id: 'assessment', label: '测评认证', icon: Trophy },
  { id: 'portrait', label: '学生画像', icon: Histogram },
  { id: 'community', label: '学习社区', icon: ChatDotSquare },
  { id: 'profile', label: '个人中心', icon: User }
];

const TEACHER_TABS: TabItem[] = [
  { id: 'dashboard', label: '工作台首页', icon: DataBoard },
  { id: 'courses', label: '我的场景/课程', icon: Reading },
  { id: 'schedule', label: '我的课表', icon: Calendar },
  { id: 'portraits', label: '我的学生', icon: Histogram },
  { id: 'profile', label: '个人中心', icon: User }
];

const SCHOOL_ADMIN_TABS: TabItem[] = [
  { id: 'dashboard', label: '工作台首页', icon: DataBoard },
  { id: 'resources', label: '资源运营', icon: Reading },
  { id: 'approvals', label: '审批中心', icon: Checked },
  { id: 'personnel', label: '教师学生情况', icon: UserFilled },
  { id: 'profile', label: '个人中心', icon: User }
];

/* ---------- 登录态（roles / 班级 / 专业 / 机构 由 /auth/portal/me 取） ---------- */
const loading = ref(true);
const user = ref<PortalUser | null>(null);
const roles = ref<Role[]>([]);
const orgNode = ref<Organization | null>(null);
const major = ref<Major | null>(null);
const institution = ref<PortalInstitution | null>(null);
const activeRoleId = ref<string | undefined>(undefined);

const activeRole = computed<Role | undefined>(() => {
  if (roles.value.length === 0) return undefined;
  if (activeRoleId.value) {
    const found = roles.value.find((r) => r.id === activeRoleId.value);
    if (found) return found;
  }
  return resolveActiveRole(user.value?.id, roles.value);
});

const currentRole = computed(() => activeRole.value?.code || 'teacher');
const activeRoleName = computed(() => activeRole.value?.name || defaultRoleName.value);

const defaultRoleName = computed(() => {
  if (currentRole.value === 'student') return '学生';
  if (currentRole.value === 'school_admin') return '学校管理员';
  return '教职工';
});

const roleIcon = computed<Component>(() => {
  if (currentRole.value === 'student') return Reading;
  if (currentRole.value === 'teacher') return School;
  if (currentRole.value === 'school_admin') return OfficeBuilding;
  return Briefcase;
});

/* ---------- 页头文案（对齐 React 各角色欢迎语） ---------- */
const today = todayLabel();

const headerTitle = computed(() => {
  if (currentRole.value === 'student') return '学生工作台';
  if (currentRole.value === 'teacher') return '教师工作台';
  if (currentRole.value === 'school_admin') return '学校管理员工作台';
  return '我的服务台';
});

const headerSub = computed(() => {
  if (currentRole.value === 'student') {
    return `欢迎回来，同学。今天是${today}。管理你的学习、岗位、测评与成长。`;
  }
  if (currentRole.value === 'teacher') {
    return `欢迎回来，${user.value?.name || '老师'}。今天是${today}。管理你的课程、教学跟踪与测评。`;
  }
  if (currentRole.value === 'school_admin') {
    return '欢迎回来，管理员。管理全校教学资源、审批与人员。';
  }
  return `欢迎回来，企业用户。今天是${today}。`;
});

/* ---------- Tab 激活（?tab=，非法/缺省回 dashboard） ---------- */
const tabs = computed<TabItem[]>(() => {
  if (currentRole.value === 'student') return STUDENT_TABS;
  if (currentRole.value === 'teacher') return TEACHER_TABS;
  if (currentRole.value === 'school_admin') return SCHOOL_ADMIN_TABS;
  return [];
});

const activeTab = computed(() => {
  const urlTab = route.query.tab;
  const value = Array.isArray(urlTab) ? urlTab[0] : urlTab;
  return value && tabs.value.some((t) => t.id === value) ? String(value) : 'dashboard';
});

/**
 * 教师备课关联（节次/任务）在「工作台首页」与「我的场景/课程」两个 Tab 间共享，
 * 与 React TeacherWorkspace 的 prepAssociations state 同层级（切 Tab 不丢）。
 */
const prepAssociations = ref<Record<string, PrepAssociationRecord>>({});

function setPrepAssociation(sessionId: string, record: PrepAssociationRecord) {
  prepAssociations.value = { ...prepAssociations.value, [sessionId]: record };
}

function goTab(id: string) {
  router.replace({ path: '/portal/workspace', query: { tab: id } });
}

function switchRole(roleId: string) {
  if (!user.value) return;
  activeRoleId.value = roleId;
  persistActiveRole(user.value.id, roleId);
  // 角色切换后回到该角色的工作台首页（各角色 Tab 集合不同）
  router.replace({ path: '/portal/workspace', query: { tab: 'dashboard' } });
}

onMounted(async () => {
  loading.value = true;
  try {
    const me = await portalMeApi.me();
    user.value = me.user;
    roles.value = me.roles || [];
    orgNode.value = me.orgNode || null;
    major.value = me.major || null;
    institution.value = me.institution || null;
    // 同步到全局登录态，供顶栏用户区展示（store 已有 user 时保持一致）
    if (!auth.user) auth.user = me.user as unknown as typeof auth.user;
  } catch {
    // 401 已由 http 层跳登录；其余错误按未登录处理，展示登录引导
    user.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.workspace-page {
  padding: 8px 0 0;
}

/* 加载 / 未登录 */
.page-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 160px);
  color: #9ca3af;
}
.page-guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: calc(100vh - 160px);
  font-size: 14px;
  color: #6b7280;
}
.guest-link {
  color: var(--el-color-primary);
}
.guest-link:hover {
  text-decoration: underline;
}

/* 页头 */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}
@media (min-width: 640px) {
  .page-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}
.page-sub {
  margin: 4px 0 0;
  font-size: 14px;
  color: #6b7280;
}
.role-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}
.role-chip :deep(.el-icon) {
  color: var(--el-color-primary);
}
.role-chip.clickable {
  cursor: pointer;
}
.role-chip.clickable:hover {
  border-color: var(--el-color-primary-light-7);
}
.role-arrow {
  color: #9ca3af !important;
}

/* Tab 导航（粘顶，对齐 React sticky top-14） */
.workspace-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tab-bar {
  position: sticky;
  top: 56px;
  z-index: 30;
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 4px;
}
.tab-scroll {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tab-scroll::-webkit-scrollbar {
  display: none;
}
.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s, background-color 0.2s;
}
.tab-item:hover {
  color: #111827;
  background: #f9fafb;
}
.tab-item.active {
  background: var(--el-color-primary);
  color: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.tab-content {
  animation: ws-fade-in 0.3s ease;
}
@keyframes ws-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

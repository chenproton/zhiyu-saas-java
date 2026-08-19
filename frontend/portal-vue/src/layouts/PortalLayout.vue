<!--
  门户全局布局壳（完整移植 React 布局体系）

  对齐来源：
  - 顶部导航：React `frontend/edu/components/portal/top-nav.tsx`
    （品牌 + 门户首页/我的服务台/应用服务中心 3 项 + 当前时间 + 用户区/登录入口，含 isActive 高亮语义）
  - 布局壳：React `frontend/edu/components/platform-shell/PlatformShell.tsx`
    + `components/shared/platform-layout.tsx`（顶栏固定 56px + 左侧域导航 + 右侧内容区）
  - 域侧栏挂载：React 各域 `app/<domain>/layout.tsx`；Vue 路由为单层 children，
    故按路径解析域配置（见 navigation-config.ts resolvePlatformNavigationConfig）

  说明：
  - 已移除「学习社区 / 我的收藏」顶部入口（React 顶部导航仅 3 项，社区/收藏归「我的服务台」学生视图）；
    对应路由保留，入口后续由 workspace 承担。
  - React 顶栏的国际化切换 / 字号缩放 / 移动端扫码 / 角色切换依赖 React 侧 hooks 与接口，
    Vue 门户暂无对应数据源，未移植（见交付说明）。
-->
<template>
  <div class="portal-layout">
    <header class="portal-header">
      <div class="header-left">
        <router-link to="/portal" class="brand">知与 SaaS</router-link>

        <nav v-if="auth.isLoggedIn" class="top-nav">
          <router-link
            v-for="item in topNavItems"
            :key="item.href"
            class="top-nav-item"
            :class="{ 'is-active': isTopNavActive(item.href) }"
            :to="item.href"
            :title="item.label"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
            <span v-if="isTopNavActive(item.href)" class="top-nav-underline" />
          </router-link>
        </nav>
      </div>

      <div class="header-right">
        <div class="current-time">{{ currentTime }}</div>

        <el-dropdown v-if="auth.isLoggedIn" trigger="click" placement="bottom-end">
          <button type="button" class="user-trigger">
            <span class="user-avatar">{{ userInitial }}</span>
            <span class="user-meta">
              <span class="user-name">{{ userName }}</span>
              <span class="user-sub">{{ tenantLabel }} · {{ roleLabel }}</span>
            </span>
            <el-icon class="user-arrow"><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/portal/workspace')">
                <el-icon><User /></el-icon>个人中心
              </el-dropdown-item>
              <el-dropdown-item
                @click="router.push({ path: '/portal/workspace', query: { tab: 'profile' } })"
              >
                <el-icon><Setting /></el-icon>账号设置
              </el-dropdown-item>
              <el-dropdown-item divided class="logout-item" @click="onLogout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <router-link v-else class="login-entry" to="/portal/login" title="登录">
          <el-icon><User /></el-icon>
          <span>登录</span>
        </router-link>
      </div>
    </header>

    <div class="portal-body">
      <PlatformSideNav v-if="sideNavConfig" :config="sideNavConfig" />
      <main class="portal-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowDown, Grid, HomeFilled, Setting, Suitcase, SwitchButton, User } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import PlatformSideNav from './PlatformSideNav.vue';
import { resolvePlatformNavigationConfig } from './navigation-config';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/* ---------- 顶部导航（对齐 React navItems，3 项） ---------- */
const topNavItems = [
  { href: '/portal', label: '门户首页', icon: HomeFilled },
  { href: '/portal/workspace', label: '我的服务台', icon: Suitcase },
  { href: '/portal/apps', label: '应用服务中心', icon: Grid }
];

/**
 * 对齐 React top-nav.tsx isActive：
 * - /portal 精确匹配；
 * - /portal/apps 仅主页高亮（平台页 /portal/apps/ai 等有独立定位，不高亮入口）；
 * - 其余前缀匹配。
 */
function isTopNavActive(href: string): boolean {
  const path = route.path;
  if (href === '/portal') return path === '/portal';
  if (href === '/portal/apps') return path === '/portal/apps';
  return path.startsWith(href);
}

/* ---------- 左侧域导航：按当前路径解析域配置 ---------- */
const sideNavConfig = computed(() => resolvePlatformNavigationConfig(route.path));

/* ---------- 用户区 ---------- */
const userName = computed(() => auth.user?.name || '');
const userInitial = computed(() => auth.user?.name?.charAt(0).toUpperCase() || 'U');

const tenantLabel = computed(() => {
  const user = auth.user;
  if (!user) return '租户';
  const direct = user.tenantName;
  if (typeof direct === 'string' && direct) return direct;
  const tenant = user.tenant;
  if (tenant && typeof tenant === 'object') {
    const name = (tenant as { name?: unknown }).name;
    if (typeof name === 'string' && name) return name;
  }
  return '租户';
});

const roleLabel = computed(() => {
  const user = auth.user;
  if (!user) return '用户';
  if (typeof user.role === 'string' && user.role) return user.role;
  const first = user.roles?.[0];
  return typeof first === 'string' && first ? first : '用户';
});

function onLogout() {
  auth.logout();
  // 对齐 React logout 后回门户登录页
  router.replace('/portal/login');
}

/* ---------- 当前时间（对齐 React：秒级刷新，页面不可见时跳过） ---------- */
const WEEK_DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const currentTime = ref('');
let timer: ReturnType<typeof setInterval> | null = null;

function updateTime() {
  if (document.visibilityState !== 'visible') return;
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  currentTime.value =
    `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ` +
    `${WEEK_DAYS[now.getDay()]} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function handleVisibility() {
  if (document.visibilityState === 'visible') updateTime();
}

onMounted(() => {
  updateTime();
  timer = setInterval(updateTime, 1000);
  document.addEventListener('visibilitychange', handleVisibility);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  document.removeEventListener('visibilitychange', handleVisibility);
});
</script>

<style scoped>
.portal-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

/* 顶栏：高 56px（React h-14）、白底毛玻璃、底部细边、粘顶 */
.portal-header {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #ebeef5;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  position: sticky;
  top: 0;
  z-index: 1010;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  white-space: nowrap;
}
.brand {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}

/* 顶部导航项：图标 + 文案 + 激活下划线（对齐 React 高亮样式） */
.top-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.top-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 14px;
  color: #909399;
  border-radius: 6px;
  white-space: nowrap;
  transition: color 0.2s, background-color 0.2s;
}
.top-nav-item:hover {
  color: #303133;
  background: #f5f7fa;
}
.top-nav-item.is-active {
  color: var(--el-color-primary);
  font-weight: 500;
}
.top-nav-underline {
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  border-radius: 2px;
  background: var(--el-color-primary);
}

.current-time {
  font-size: 14px;
  color: #909399;
}

/* 用户区 */
.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
}
.user-trigger:hover {
  background: #f5f7fa;
}
.user-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}
.user-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.25;
}
.user-name {
  font-size: 14px;
  color: #303133;
}
.user-sub {
  font-size: 12px;
  color: #909399;
}
.user-arrow {
  color: #909399;
}
.logout-item {
  color: var(--el-color-danger);
}

.login-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #909399;
  transition: color 0.2s, background-color 0.2s;
}
.login-entry:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

/* 主体：左侧域导航 + 右侧内容（对齐 React flex min-h-[calc(100vh-3.5rem)]） */
.portal-body {
  flex: 1;
  display: flex;
  min-height: calc(100vh - 56px);
}
.portal-main {
  flex: 1;
  min-width: 0;
  padding: 16px;
}

@media (min-width: 640px) {
  .portal-header {
    padding: 0 24px;
  }
  .portal-main {
    padding: 24px;
  }
}

/* 窄屏：隐藏时间与用户副信息、顶部导航文字（对齐 React 按优先级降级显示） */
@media (max-width: 767px) {
  .current-time,
  .user-meta {
    display: none;
  }
  .top-nav-item span:not(.top-nav-underline) {
    display: none;
  }
  .header-left {
    gap: 12px;
  }
}
</style>

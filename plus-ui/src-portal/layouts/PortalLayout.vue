<!--
  门户全局布局壳（完整移植 React 布局体系）

  对齐来源：
  - 顶部导航：复用 `PortalHeader.vue`（原 React 版 `top-nav.tsx`，从本组件提取为共享组件，
    与 LandingLayout（landing 仅 TopNav 布局）共用，保证全站顶部导航一致）
  - 布局壳：原 React 版 `PlatformShell.tsx`
    + `components/shared/platform-layout.tsx`（顶栏固定 56px + 左侧域导航 + 右侧内容区）
  - 域侧栏挂载：React 各域 `app/<domain>/layout.tsx`；Vue 路由为单层 children，
    故按路径解析域配置（见 navigation-config.ts resolvePlatformNavigationConfig）

  说明：
  - 已移除「学习社区 / 我的收藏」顶部入口（React 顶部导航仅 3 项，社区/收藏归「我的服务台」学生视图）；
    对应路由保留，入口后续由 workspace 承担。
-->
<template>
  <div class="portal-layout">
    <PortalHeader />

    <div class="portal-body">
      <PlatformSideNav v-if="sideNavConfig && !sideNavConfig.hideSideNav" :config="sideNavConfig" />
      <main class="portal-main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import PortalHeader from './PortalHeader.vue';
import PlatformSideNav from './PlatformSideNav.vue';
import { resolvePlatformNavigationConfig } from './navigation-config';

const route = useRoute();

/* ---------- 左侧域导航：按当前路径解析域配置 ---------- */
const sideNavConfig = computed(() => resolvePlatformNavigationConfig(route.path));
</script>

<style scoped>
.portal-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
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
  .portal-main {
    padding: 24px;
  }
}
</style>

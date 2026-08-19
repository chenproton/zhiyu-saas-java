<!--
  平台左侧导航（完整移植 React frontend/packages/ui/src/components/platform-shell/PlatformSideNav.tsx）

  对齐要点：
  - 品牌区：返回按钮（config.sideBackHref）+ 平台图标 + currentPlatformLabel，底部分隔线；
  - 分组渲染：一级分组（有 children）可折叠，叶子项直接跳转；
  - 激活高亮：沿用 React matchers 语义（`$` 精确 / 前缀匹配），同组多命中取最长 target；
  - 默认展开：config.defaultExpandedSideNavIds，缺省时展开全部分组；
    路由切换只「追加」当前活跃分组，不强制重新展开用户手动折叠的分组（对齐 React）；
  - 平台切换区：config.platformSwitchItems 非空时渲染（当前各域为空数组，保留以对齐）；
  - 尺寸：宽 224px（React w-56）、顶部偏移 56px（React top-14）、白底 + 右侧细边框；
  - 移动端：<768px 折叠为浮动按钮 + 抽屉式面板（对齐 React Sheet 抽屉），路由切换自动收起。

  差异说明：React 侧栏按 hasMenuPermission 过滤菜单项；Vue 门户当前无菜单权限数据源
  （auth store 仅有 token/user），故只过滤 hidden 项，权限过滤待权限 store 落地后接入。
-->
<template>
  <button
    v-if="isMobile"
    type="button"
    class="side-nav-toggle"
    aria-label="打开导航菜单"
    @click="mobileOpen = true"
  >
    <el-icon><Fold /></el-icon>
  </button>

  <div v-if="isMobile && mobileOpen" class="side-nav-mask" @click="mobileOpen = false" />

  <aside class="side-nav" :class="{ 'is-mobile': isMobile, 'is-open': mobileOpen }">
    <div class="side-nav-brand">
      <router-link
        class="brand-back"
        :to="config.sideBackHref"
        :aria-label="backLabel"
        :title="backLabel"
      >
        <el-icon><ArrowLeft /></el-icon>
      </router-link>
      <div class="brand-title" :title="config.brandTitle">
        <el-icon class="brand-icon"><component :is="platformIcon" /></el-icon>
        <h2>{{ config.currentPlatformLabel }}</h2>
      </div>
    </div>

    <el-menu
      ref="menuRef"
      :key="config.currentPlatformId"
      class="side-nav-menu"
      :default-active="activeIndex"
      :default-openeds="defaultOpeneds"
      router
    >
      <template v-for="item in visibleSideNavItems" :key="item.id">
        <el-sub-menu v-if="item.children && item.children.length" :index="item.id">
          <template #title>
            <el-icon><component :is="resolveIcon(item.icon)" /></el-icon>
            <span>{{ item.label }}</span>
          </template>
          <el-menu-item v-for="child in item.children" :key="child.id" :index="child.href">
            {{ child.label }}
          </el-menu-item>
        </el-sub-menu>
        <el-menu-item v-else :index="item.href || '/'">
          <el-icon><component :is="resolveIcon(item.icon)" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </template>
    </el-menu>

    <div v-if="config.platformSwitchItems && config.platformSwitchItems.length" class="side-nav-switch">
      <p class="switch-title">平台切换</p>
      <router-link
        v-for="item in config.platformSwitchItems"
        :key="item.id"
        class="switch-item"
        :class="{ 'is-active': matchesPath(route.path, item.href, item.matchers) }"
        :to="item.href"
      >
        <el-icon><component :is="resolveIcon(item.icon)" /></el-icon>
        <span>{{ item.label }}</span>
      </router-link>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft, Fold } from '@element-plus/icons-vue';
import type { MenuInstance } from 'element-plus';
import {
  getActiveChild,
  getMatchedTarget,
  matchesPath,
  resolvePlatformIcon
} from './navigation-config';
import type { PlatformIconKey, PlatformNavigationConfig, SideNavItem } from './navigation-config';

const props = defineProps<{ config: PlatformNavigationConfig }>();

const route = useRoute();
const menuRef = useTemplateRef<MenuInstance>('menuRef');
const mobileOpen = ref(false);
// 初值直接取 matchMedia（纯客户端 SPA，无 SSR），避免手机端首帧先按桌面侧栏渲染再切抽屉
const isMobile = ref(window.matchMedia('(max-width: 767px)').matches);

const resolveIcon = (icon?: PlatformIconKey) => resolvePlatformIcon(icon);
const platformIcon = computed(() => resolvePlatformIcon(props.config.platformIcon));
const backLabel = computed(() =>
  props.config.currentPlatformLabel ? `返回${props.config.currentPlatformLabel}` : '返回'
);

/** 只过滤 hidden 项（React 另有 hasMenuPermission 过滤，见组件头注释） */
const visibleSideNavItems = computed<SideNavItem[]>(() =>
  props.config.sideNavItems
    .filter((item) => !item.hidden)
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((child) => !child.hidden) }
        : item
    )
    .filter((item) => !item.children || item.children.length > 0)
);

/** 默认展开分组：配置优先，缺省展开全部分组（对齐 React defaultExpanded） */
const defaultOpeneds = computed<string[]>(() =>
  props.config.defaultExpandedSideNavIds?.length
    ? props.config.defaultExpandedSideNavIds
    : visibleSideNavItems.value.filter((item) => item.children?.length).map((item) => item.id)
);

/**
 * 当前激活项索引（el-menu 只允许单一 active）：
 * 收集全部叶子项/子项的命中 target，取最长者（对齐 React getActiveChild 的最长匹配语义）。
 */
const activeIndex = computed(() => {
  const candidates: { href: string; target: string }[] = [];
  for (const item of visibleSideNavItems.value) {
    if (item.children?.length) {
      const child = getActiveChild(route.path, item.children);
      if (child) {
        const target = getMatchedTarget(route.path, child.href, child.matchers);
        if (target) candidates.push({ href: child.href, target });
      }
      continue;
    }
    const target = getMatchedTarget(route.path, item.href, item.matchers);
    if (target && item.href) candidates.push({ href: item.href, target });
  }
  if (candidates.length === 0) return '';
  return candidates.sort((a, b) => b.target.length - a.target.length)[0].href;
});

/** 当前路由所属分组（用于路由切换时追加展开） */
const activeParentIds = computed(() =>
  visibleSideNavItems.value
    .filter((item) => item.children?.length && getActiveChild(route.path, item.children))
    .map((item) => item.id)
);

watch(
  () => route.path,
  async () => {
    mobileOpen.value = false;
    // 等待本轮渲染完成：跨域切换时 el-menu 会按 currentPlatformId 重挂载，
    // 直接在 pre-flush 阶段调用旧实例的 open(id) 会命中不存在的分组（Element Plus open 无空值守卫）
    await nextTick();
    // 仅追加活跃分组，不关闭用户手动折叠的其他分组（对齐 React expandedItems 语义）
    activeParentIds.value.forEach((id) => menuRef.value?.open(id));
  }
);

let mediaQuery: MediaQueryList | null = null;
const syncIsMobile = (event: MediaQueryList | MediaQueryListEvent) => {
  isMobile.value = event.matches;
  if (!event.matches) mobileOpen.value = false;
};

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 767px)');
  syncIsMobile(mediaQuery);
  mediaQuery.addEventListener('change', syncIsMobile);
  // 首屏兜底：活跃分组未列入 defaultExpandedSideNavIds 时也展开（对齐 React 活跃父项必展开）
  activeParentIds.value.forEach((id) => menuRef.value?.open(id));
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', syncIsMobile);
});
</script>

<style scoped>
/* 侧栏容器：对齐 React aside（w-56 / sticky top-14 / 白底 / 右细边） */
.side-nav {
  width: 224px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #f0f2f5;
  position: sticky;
  top: 56px;
  height: calc(100vh - 56px);
  overflow-y: auto;
}

/* 品牌区：返回按钮 + 平台图标 + 平台名 */
.side-nav-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #f0f2f5;
}
.brand-back {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #f5f7fa;
  color: #606266;
  transition: background-color 0.2s, color 0.2s;
}
.brand-back:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.brand-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.brand-icon {
  color: var(--el-color-primary);
  font-size: 16px;
}
.brand-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 菜单主体 */
.side-nav-menu {
  flex: 1;
  padding: 12px;
  border-right: none;
}
.side-nav-menu:not(.el-menu--collapse) {
  width: 100%;
}
.side-nav-menu :deep(.el-menu-item),
.side-nav-menu :deep(.el-sub-menu__title) {
  height: 40px;
  line-height: 40px;
  min-width: 0;
  padding-left: 12px !important;
  padding-right: 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  font-size: 14px;
  color: #606266;
}
/* 图标尺寸与间距对齐 React（h-4 w-4 + gap-2.5） */
.side-nav-menu :deep(.el-menu-item > .el-icon),
.side-nav-menu :deep(.el-sub-menu__title > .el-icon) {
  width: 16px;
  margin-right: 10px;
  font-size: 16px;
}
.side-nav-menu :deep(.el-menu-item:hover),
.side-nav-menu :deep(.el-sub-menu__title:hover) {
  background: #f5f7fa;
  color: #303133;
}
/* 叶子项激活：主色底 + 白字（对齐 React bg-primary text-white） */
.side-nav-menu :deep(.el-menu-item.is-active) {
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 500;
}
.side-nav-menu :deep(.el-menu-item.is-active:hover) {
  background: var(--el-color-primary);
  color: #fff;
}
/* 分组标题激活：浅主色底 + 主色字（对齐 React bg-primary/5 text-primary） */
.side-nav-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}
/* 子项缩进 + 左侧引导线（对齐 React ml-4 border-l-2 pl-3） */
.side-nav-menu :deep(.el-menu--inline) {
  margin: 4px 0 4px 16px;
  padding-left: 12px;
  border-left: 2px solid #f0f2f5;
}
.side-nav-menu :deep(.el-menu--inline .el-menu-item) {
  height: 36px;
  line-height: 36px;
  color: #909399;
}
.side-nav-menu :deep(.el-menu--inline .el-menu-item.is-active) {
  color: #fff;
}
.side-nav-menu :deep(.el-sub-menu__icon-arrow) {
  color: #c0c4cc;
}

/* 平台切换区（对齐 React 底部 platformSwitchItems 区块） */
.side-nav-switch {
  border-top: 1px solid #f0f2f5;
  padding: 12px;
}
.switch-title {
  margin: 0 0 8px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 500;
  color: #c0c4cc;
}
.switch-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: #909399;
  transition: background-color 0.2s, color 0.2s;
}
.switch-item:hover {
  background: #f5f7fa;
  color: #303133;
}
.switch-item.is-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}

/* 移动端：浮动按钮 + 抽屉式面板 */
.side-nav-toggle {
  position: fixed;
  left: 12px;
  top: 64px;
  z-index: 1001;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fff;
  color: #606266;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  cursor: pointer;
}
.side-nav-toggle:hover {
  color: var(--el-color-primary);
}
.side-nav-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.35);
}
.side-nav.is-mobile {
  position: fixed;
  left: 0;
  top: 56px;
  z-index: 1002;
  /* 对齐 React Sheet 抽屉 w-72 = 288px */
  width: 288px;
  height: calc(100vh - 56px);
  transform: translateX(-100%);
  transition: transform 0.2s ease;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.08);
}
.side-nav.is-mobile.is-open {
  transform: translateX(0);
}
</style>

<template>
  <div class="apps-page">
    <!-- 常用服务栏 -->
    <div class="quick-bar">
      <div class="quick-head">
        <div class="quick-title">
          <el-icon :size="16" class="quick-spark"><MagicStick /></el-icon>
          <span>常用服务</span>
        </div>
        <div class="quick-chips">
          <button
            v-for="item in visibleQuickAccess"
            :key="item.href"
            type="button"
            class="quick-chip"
            @click="onServiceClick(item)"
          >
            <el-icon :size="16"><component :is="iconOf(item.icon)" /></el-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="apps-body">
      <!-- 左侧栏（桌面端） -->
      <aside class="apps-aside">
        <nav class="aside-nav">
          <button
            v-for="item in visibleMenuItems"
            :key="item.id"
            type="button"
            class="aside-item"
            :class="{ active: activeMenu === item.id }"
            @click="scrollToSection(item.id)"
          >
            <el-icon :size="16"><component :is="iconOf(item.icon)" /></el-icon>
            <span class="aside-label">{{ item.label }}</span>
            <el-icon v-if="activeMenu === item.id" :size="16" class="aside-arrow"><Right /></el-icon>
          </button>
        </nav>
      </aside>

      <!-- 主内容 -->
      <main ref="contentRef" class="apps-main" @scroll="onScroll">
        <div v-if="authLoading" class="apps-state">
          <span>加载中...</span>
        </div>

        <div v-else-if="allModules.length === 0" class="apps-state">
          <span>暂无可用应用，请联系管理员开通套餐</span>
        </div>

        <template v-else>
          <div
            v-for="section in allModules"
            :key="section.id"
            :ref="(el) => setSectionRef(section.id, el)"
            class="module-section"
          >
            <div class="section-head">
              <div class="section-icon" :style="{ color: section.color, background: section.bg }">
                <el-icon :size="20"><component :is="iconOf(section.icon)" /></el-icon>
              </div>
              <a
                v-if="section.href && section.href !== '#'"
                class="section-title-link"
                @click="go(section.href)"
              >
                {{ section.label }}
              </a>
              <h2 v-else class="section-title">{{ section.label }}</h2>
              <span class="section-count">{{ section.modules.length }} 个模块</span>
            </div>

            <div class="module-grid">
              <div
                v-for="module in section.modules"
                :key="module.id"
                class="module-card"
                :class="{ 'module-card-disabled': module.href === '#' }"
                @click="onModuleClick(module)"
              >
                <h3 class="module-title">
                  {{ module.title }}
                  <el-icon v-if="isExternal(module.href)" :size="12" class="module-ext"><TopRight /></el-icon>
                </h3>
                <p class="module-desc">{{ module.desc || '' }}</p>
                <div class="module-enter">
                  <el-icon :size="16"><Right /></el-icon>
                </div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Component } from 'vue';
import {
  Briefcase,
  Calendar,
  CircleCheck,
  Grid,
  MagicStick,
  Promotion,
  Reading,
  Right,
  School,
  Setting,
  Share,
  TopRight,
  TrendCharts,
  UserFilled
} from '@element-plus/icons-vue';
import {
  APPS_MENU_ITEMS,
  APPS_PLATFORM_HREFS,
  APPS_PLATFORM_MODULES,
  APPS_PLATFORM_STYLES,
  APPS_QUICK_ACCESS,
  getServiceClickCounts,
  hasMenuPermission,
  loadPortalAuth,
  recordServiceClick,
  resolveActiveRole,
  type AppsModuleItem
} from './portal-navigation';
import type { Role } from '@/types/system';
import type { User } from '@/types/user';

const ICONS: Record<string, Component> = {
  setting: Setting,
  briefcase: Briefcase,
  layers: Grid,
  book: Reading,
  'check-circle': CircleCheck,
  share: Share,
  'bar-chart': TrendCharts,
  'graduation-cap': School
};

function iconOf(key: string): Component {
  return ICONS[key] || Grid;
}

const router = useRouter();

/* ---------- 登录态 + 订阅 + 菜单权限 ---------- */
const authLoading = ref(true);
const user = ref<User | null>(null);
const roles = ref<Role[]>([]);
const activeRoleCode = ref<string | undefined>(undefined);
const menus = ref<unknown>(null);
const subscriptionModules = ref<Record<string, boolean> | null>(null);

function hasMenuPerm(path: string): boolean {
  return hasMenuPermission(activeRoleCode.value, menus.value, path, subscriptionModules.value);
}

interface ModuleSection {
  id: string;
  label: string;
  href: string;
  icon: string;
  color: string;
  bg: string;
  modules: AppsModuleItem[];
}

const allModules = computed<ModuleSection[]>(() => {
  return APPS_MENU_ITEMS.filter((item) => subscriptionModules.value?.[item.id] === true)
    .map((item) => {
      const modules = (APPS_PLATFORM_MODULES[item.id] || []).filter((m) => hasMenuPerm(m.href));
      const style = APPS_PLATFORM_STYLES[item.id] || { color: '#2563eb', bg: '#eff6ff' };
      return {
        id: item.id,
        label: item.label,
        href: APPS_PLATFORM_HREFS[item.id] ?? '#',
        icon: item.icon,
        color: style.color,
        bg: style.bg,
        modules
      };
    })
    .filter((section) => section.modules.length > 0);
});

const visibleMenuItems = computed(() =>
  APPS_MENU_ITEMS.filter((m) => allModules.value.some((s) => s.id === m.id))
);

/* ---------- 常用服务 ---------- */
interface ServiceItem {
  icon: string;
  label: string;
  href: string;
}

const servicePool = computed<ServiceItem[]>(() => {
  const pool: ServiceItem[] = APPS_QUICK_ACCESS.map((item) => ({ ...item }));
  for (const section of allModules.value) {
    for (const m of section.modules) {
      if (!pool.some((p) => p.href === m.href)) {
        pool.push({ href: m.href, label: m.title, icon: section.icon });
      }
    }
  }
  return pool;
});

const serviceClickCounts = ref<Record<string, number>>({});

const visibleQuickAccess = computed<ServiceItem[]>(() => {
  const visible = servicePool.value.filter((item) => hasMenuPerm(item.href));
  const hasClicks = visible.some((item) => (serviceClickCounts.value[item.href] || 0) > 0);
  if (!hasClicks) {
    return visible.filter((item) => APPS_QUICK_ACCESS.some((q) => q.href === item.href)).slice(0, 6);
  }
  return [...visible]
    .sort((a, b) => (serviceClickCounts.value[b.href] || 0) - (serviceClickCounts.value[a.href] || 0))
    .slice(0, 6);
});

/* ---------- 滚动监听 + 侧栏联动 ---------- */
const contentRef = ref<HTMLElement | null>(null);
const sectionEls: Record<string, HTMLElement | null> = {};
const activeMenu = ref(APPS_MENU_ITEMS[0].id);

function setSectionRef(id: string, el: unknown) {
  sectionEls[id] = (el as HTMLElement) || null;
}

function onScroll() {
  const el = contentRef.value;
  if (!el) return;
  const scrollTop = el.scrollTop;
  let current = APPS_MENU_ITEMS[0].id;
  for (const section of allModules.value) {
    const node = sectionEls[section.id];
    if (node) {
      const offsetTop = node.offsetTop - 100;
      if (scrollTop >= offsetTop) current = section.id;
    }
  }
  activeMenu.value = current;
}

function scrollToSection(sectionId: string) {
  const el = sectionEls[sectionId];
  const content = contentRef.value;
  if (el && content) {
    const offsetTop = el.offsetTop - 20;
    content.scrollTo({ top: offsetTop, behavior: 'smooth' });
  }
  activeMenu.value = sectionId;
}

/* ---------- 点击 ---------- */
function isExternal(href: string): boolean {
  return href.startsWith('http');
}

function go(href: string) {
  if (!href || href === '#') return;
  if (isExternal(href)) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  router.push(href);
}

function onServiceClick(item: ServiceItem) {
  recordServiceClick(item.href);
  go(item.href);
}

function onModuleClick(module: AppsModuleItem) {
  recordServiceClick(module.href);
  if (module.href === '#') return;
  go(module.href);
}

onMounted(async () => {
  serviceClickCounts.value = getServiceClickCounts();
  try {
    const { me, subscriptionModules: subs } = await loadPortalAuth();
    user.value = me?.user ?? null;
    roles.value = me?.roles ?? [];
    subscriptionModules.value = subs;
    const active = resolveActiveRole(user.value?.id, roles.value);
    activeRoleCode.value = active?.code;
    const perms = active?.permissions as Record<string, unknown> | undefined;
    menus.value = perms?.menus ?? null;
  } finally {
    authLoading.value = false;
  }
});
</script>

<style scoped>
.apps-page {
  min-height: calc(100vh - 56px);
  background: #f5f7fa;
}

/* 常用服务栏 */
.quick-bar {
  position: sticky;
  top: 56px;
  z-index: 10;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  padding: 12px 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.quick-head {
  display: flex;
  align-items: center;
  gap: 16px;
}
.quick-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6b7280;
  flex-shrink: 0;
  font-weight: 500;
}
.quick-spark {
  color: #f59e0b;
}
.quick-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
}
.quick-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f4f4f5;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
}
.quick-chip:hover {
  background: rgba(64, 158, 255, 0.05);
  color: var(--el-color-primary, #409eff);
}

/* 主体 */
.apps-body {
  display: flex;
}
.apps-aside {
  display: none;
  width: 224px;
  flex-shrink: 0;
  background: #fff;
  min-height: calc(100vh - 56px - 56px);
  position: sticky;
  top: 112px;
  align-self: flex-start;
  border-right: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
@media (min-width: 768px) {
  .apps-aside {
    display: block;
  }
}
.aside-nav {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.aside-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.2s;
}
.aside-item:hover {
  background: #f4f4f5;
  color: #111827;
}
.aside-item.active {
  background: var(--el-color-primary, #409eff);
  color: #fff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}
.aside-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.aside-arrow {
  color: rgba(255, 255, 255, 0.7);
}

/* 主内容 */
.apps-main {
  flex: 1;
  padding: 16px 24px;
  overflow-y: auto;
  max-height: calc(100vh - 56px - 56px);
}
.apps-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 256px;
  color: #6b7280;
  font-size: 14px;
}
.module-section {
  margin-bottom: 20px;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.section-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.section-title-link {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  text-decoration: none;
}
.section-title-link:hover {
  color: var(--el-color-primary, #409eff);
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}
.section-count {
  font-size: 12px;
  color: #6b7280;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 999px;
}

.module-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 640px) {
  .module-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .module-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
}
@media (min-width: 1280px) {
  .module-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}

.module-card {
  position: relative;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 96px;
}
.module-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: rgba(64, 158, 255, 0.2);
}
.module-card-disabled {
  cursor: default;
  opacity: 0.6;
}
.module-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.3;
  padding-right: 8px;
}
.module-card:not(.module-card-disabled):hover .module-title {
  color: var(--el-color-primary, #409eff);
}
.module-ext {
  color: #9ca3af;
}
.module-desc {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.module-enter {
  position: absolute;
  bottom: 16px;
  right: 16px;
  color: var(--el-color-primary, #409eff);
  opacity: 0;
  transition: opacity 0.2s;
}
.module-card:not(.module-card-disabled):hover .module-enter {
  opacity: 1;
}
</style>

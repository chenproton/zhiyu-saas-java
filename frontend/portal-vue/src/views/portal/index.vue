<template>
  <div class="portal-home">
    <!-- Hero 横幅 -->
    <section class="hero-wrap">
      <div class="hero">
        <h1 class="hero-title">
          <span class="hero-title-accent">场景化数智</span>教学服务体系
        </h1>
        <div class="hero-features">
          <span v-for="f in features" :key="f" class="feature-pill">{{ f }}</span>
        </div>
      </div>
    </section>

    <!-- 三组生态 -->
    <main class="home-main">
      <div v-for="section in sections" :key="section.title" class="home-section">
        <div class="section-label">
          <h3 class="section-title"><span class="section-bar" />{{ section.title }}</h3>
          <span class="section-line" />
        </div>

        <div class="card-grid">
          <div
            v-for="item in section.items"
            :key="item.id"
            class="platform-card"
            :class="{ locked: isLocked(item) }"
            @click="onCardClick(item)"
          >
            <div v-if="isLocked(item)" class="lock-badge">
              <el-icon :size="16"><Lock /></el-icon>
              <span>{{ lockLabel(item) }}</span>
            </div>

            <div
              class="card-icon"
              :style="{ color: item.color, background: item.bg, borderColor: item.bg }"
            >
              <el-icon :size="24"><component :is="iconOf(item.icon)" /></el-icon>
            </div>

            <div class="card-body">
              <h4 class="card-title">{{ item.title }}</h4>
              <p class="card-desc">{{ item.desc }}</p>
            </div>

            <div v-if="!isLocked(item)" class="card-enter">
              进入
              <el-icon :size="14"><Right /></el-icon>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Briefcase,
  Calendar,
  CircleCheck,
  Grid,
  Lock,
  Promotion,
  Reading,
  Right,
  School,
  Setting,
  Share,
  ShoppingCart,
  TrendCharts,
  UserFilled
} from '@element-plus/icons-vue';
import type { Component } from 'vue';
import {
  HOME_FEATURES,
  HOME_INTERNAL_ROUTES,
  HOME_PLATFORMS,
  HOME_SECTIONS,
  hasMenuPermission,
  loadPortalAuth,
  resolveActiveRole,
  type HomePlatformItem
} from './portal-navigation';
import type { Role } from '@/types/system';
import type { User } from '@/types/user';

const ICONS: Record<string, Component> = {
  users: UserFilled,
  briefcase: Briefcase,
  layers: Grid,
  'check-circle': CircleCheck,
  book: Reading,
  share: Share,
  'shopping-cart': ShoppingCart,
  calendar: Calendar,
  'graduation-cap': School,
  'bar-chart': TrendCharts,
  rocket: Promotion,
  setting: Setting
};

function iconOf(key: string): Component {
  return ICONS[key] || Grid;
}

const router = useRouter();

const features = HOME_FEATURES;

const sections = computed(() =>
  HOME_SECTIONS.map((s) => ({
    title: s.title,
    items: s.ids
      .map((id) => HOME_PLATFORMS.find((p) => p.id === id))
      .filter((p): p is HomePlatformItem => Boolean(p))
  }))
);

/* ---------- 登录态 + 菜单权限（对齐 React 卡片锁定语义） ---------- */
const authLoading = ref(true);
const user = ref<User | null>(null);
const roles = ref<Role[]>([]);
const activeRoleCode = ref<string | undefined>(undefined);
const menus = ref<unknown>(null);
const subscriptionModules = ref<Record<string, boolean> | null>(null);

function hasMenuPerm(path: string): boolean {
  return hasMenuPermission(activeRoleCode.value, menus.value, path, subscriptionModules.value);
}

function isLocked(item: HomePlatformItem): boolean {
  const url = HOME_INTERNAL_ROUTES[item.id] || '';
  const noPermission = !!user.value && !authLoading.value && !hasMenuPerm(url);
  return !url || noPermission;
}

function lockLabel(item: HomePlatformItem): string {
  return HOME_INTERNAL_ROUTES[item.id] ? '暂无权限' : '暂未开放';
}

function onCardClick(item: HomePlatformItem) {
  const url = HOME_INTERNAL_ROUTES[item.id] || '';
  if (!url || isLocked(item)) return;
  router.push(url);
}

onMounted(async () => {
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
.portal-home {
  min-height: 100vh;
  background: radial-gradient(circle at 50% -10%, rgba(64, 158, 255, 0.06), transparent 45%), #f7f9fc;
  padding-bottom: 32px;
}

/* Hero */
.hero-wrap {
  padding: 12px 24px 0;
}
.hero {
  max-width: 1312px;
  margin: 0 auto;
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
  background: linear-gradient(
    120deg,
    rgba(64, 158, 255, 0.06) 0%,
    rgba(64, 158, 255, 0.02) 55%,
    rgba(64, 158, 255, 0.05) 100%
  );
  box-shadow: 0 0 30px rgba(64, 158, 255, 0.06);
}
.hero-title {
  margin: 0 0 20px;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 1px;
  line-height: 1.3;
  color: #333;
}
.hero-title-accent {
  color: var(--el-color-primary, #409eff);
}
.hero-features {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.feature-pill {
  font-size: 13px;
  color: #555;
  background: #f2f5fa;
  border: 1px solid #e6ebf3;
  border-radius: 999px;
  padding: 6px 16px;
}

/* Main */
.home-main {
  max-width: 1312px;
  margin: 0 auto;
  padding: 0 24px;
}
.home-section {
  margin-top: 20px;
}
.section-label {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  margin-top: 5px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #333;
}
.section-bar {
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: var(--el-color-primary, #409eff);
  display: inline-block;
}
.section-line {
  flex: 1;
  height: 1px;
  background: #e9edf4;
}

/* Cards */
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 640px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .card-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
  }
}

.platform-card {
  position: relative;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  border: 1px solid #e8ecf3;
  background: #fff;
  box-shadow: 0 0 30px rgba(64, 158, 255, 0.1);
  overflow: hidden;
  transition: all 0.4s;
}
.platform-card:not(.locked) {
  cursor: pointer;
}
.platform-card:not(.locked):hover {
  transform: translateY(-8px);
  border-color: rgba(64, 158, 255, 0.25);
  box-shadow: 0 10px 32px rgba(64, 158, 255, 0.15);
}
.platform-card.locked {
  border-style: dashed;
  border-color: #d7dce6;
  background: #fafbfc;
}
.lock-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: #8590a6;
  z-index: 5;
  font-size: 9px;
  font-weight: 500;
  white-space: nowrap;
}
.card-icon {
  border-radius: 16px;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  margin-bottom: 14px;
  transition: transform 0.4s;
  flex-shrink: 0;
}
.platform-card:not(.locked):hover .card-icon {
  transform: scale(1.1);
}
.card-body {
  position: relative;
}
.card-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  color: #333;
}
.card-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-enter {
  position: absolute;
  bottom: 12px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-color-primary, #409eff);
  opacity: 0;
  transition: opacity 0.3s;
}
.platform-card:not(.locked):hover .card-enter {
  opacity: 1;
}
</style>

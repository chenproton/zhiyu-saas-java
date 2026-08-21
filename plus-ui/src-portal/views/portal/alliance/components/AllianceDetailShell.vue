<template>
  <div class="ads" :style="{ background: pageBackground }">
    <!-- 标题区 -->
    <section class="ads-header">
      <div v-if="coverImage" class="ads-cover-bg">
        <img :src="coverImage" alt="" aria-hidden="true" />
        <div class="ads-cover-mask" />
      </div>
      <div class="ads-header-inner">
        <nav v-if="showBack && crumbs.length" class="ads-crumbs">
          <template v-for="(crumb, idx) in crumbs" :key="idx">
            <el-icon v-if="idx > 0" class="ads-chev"><ArrowRight /></el-icon>
            <router-link v-if="crumb.href && idx < crumbs.length - 1" :to="crumb.href" class="ads-crumb-link">{{ crumb.label }}</router-link>
            <span v-else class="ads-crumb" :class="{ last: idx === crumbs.length - 1 }">{{ crumb.label }}</span>
          </template>
        </nav>

        <div class="ads-title-row">
          <img v-if="iconImage" :src="iconImage.src" :alt="iconImage.alt" class="ads-icon-img" :style="{ background: iconGradient }" />
          <div v-else-if="icon" class="ads-icon-box" :style="{ background: iconGradient }">
            <el-icon :size="44" color="#fff"><component :is="icon" /></el-icon>
          </div>
          <div class="ads-title-text">
            <h1 class="ads-title">{{ title }}</h1>
            <p v-if="subtitle" class="ads-subtitle">{{ subtitle }}</p>
            <div v-if="badges.length" class="ads-badges">
              <span
                v-for="(b, i) in badges"
                :key="i"
                class="ads-badge"
                :style="b.background ? { background: b.background, color: b.color || '#fff', borderColor: 'transparent' } : {}"
              >{{ b.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ads-body">
      <div class="ads-body-inner">
        <div v-if="stats.length" class="ads-stats">
          <div v-for="stat in stats" :key="stat.label" class="ads-stat">
            <div class="ads-stat-icon" :style="{ background: stat.gradient }">
              <el-icon :size="22" color="#fff"><component :is="stat.icon" /></el-icon>
            </div>
            <div class="ads-stat-text">
              <p class="ads-stat-value">{{ stat.value }}</p>
              <p class="ads-stat-label">{{ stat.label }}</p>
            </div>
          </div>
        </div>

        <el-tabs v-model="activeTab" class="ads-tabs">
          <el-tab-pane v-for="tab in tabs" :key="tab.value" :name="tab.value">
            <template #label>
              <span class="ads-tab-label">{{ tab.label }}</span>
              <span v-if="tab.count != null" class="ads-tab-count">{{ tab.count }}</span>
            </template>
            <slot :name="tab.value" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowRight } from '@element-plus/icons-vue';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}
export interface DetailStat {
  label: string;
  value: string | number;
  icon: any;
  gradient: string;
}
export interface DetailBadge {
  text: string;
  background?: string;
  color?: string;
}
export interface DetailTab {
  value: string;
  label: string;
  count?: number;
}

const props = withDefaults(
  defineProps<{
    breadcrumbs?: BreadcrumbItem[];
    backHref: string;
    backLabel?: string;
    showBack?: boolean;
    icon?: any;
    iconImage?: { src: string; alt: string };
    iconGradient?: string;
    title: string;
    subtitle?: string;
    badges?: DetailBadge[];
    stats?: DetailStat[];
    tabs: DetailTab[];
    pageGradient?: string;
    coverImage?: string;
  }>(),
  {
    showBack: true,
    iconGradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    badges: () => [],
    stats: () => [],
    pageGradient: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 30%, rgba(239,246,255,0.4) 100%)',
  },
);

const crumbs = computed<BreadcrumbItem[]>(() => {
  if (props.breadcrumbs && props.breadcrumbs.length) return props.breadcrumbs;
  return props.showBack ? [{ label: props.backLabel || '返回列表', href: props.backHref }] : [];
});

const pageBackground = computed(() => {
  // 接受 tailwind 式 from/via/to 的近似色板；默认蓝紫渐变
  return props.pageGradient.includes('linear-gradient')
    ? props.pageGradient
    : 'linear-gradient(180deg, #f8fafc 0%, #ffffff 30%, rgba(239,246,255,0.4) 100%)';
});

const activeTab = ref(props.tabs[0]?.value ?? '');
</script>

<style scoped>
.ads { min-height: 100vh; }
.ads-header { position: relative; padding: 12px 0 32px; overflow: hidden; }
.ads-cover-bg { position: absolute; inset: 0; overflow: hidden; }
.ads-cover-bg img { width: 100%; height: 100%; object-fit: cover; filter: blur(40px); transform: scale(1.1); opacity: 0.5; }
.ads-cover-mask { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0.75), rgba(255,255,255,0.95)); }
.ads-header-inner { position: relative; max-width: 1280px; margin: 0 auto; padding: 0 24px; }
.ads-crumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 13px; color: #94a3b8; margin-bottom: 16px; }
.ads-chev { color: #cbd5e1; }
.ads-crumb-link { color: #94a3b8; text-decoration: none; white-space: nowrap; transition: color 0.2s; }
.ads-crumb-link:hover { color: #409eff; }
.ads-crumb { color: #94a3b8; white-space: nowrap; }
.ads-crumb.last { color: #334155; font-weight: 500; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.ads-title-row { display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
.ads-icon-box { width: 96px; height: 96px; border-radius: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 10px 20px rgba(0,0,0,0.15); }
.ads-icon-img { width: 80px; height: 80px; border-radius: 24px; object-fit: cover; box-shadow: 0 10px 20px rgba(0,0,0,0.15); flex-shrink: 0; border: 1px solid rgba(255,255,255,0.4); }
.ads-title-text { flex: 1; min-width: 0; }
.ads-title { font-size: 32px; font-weight: 800; color: #0f172a; line-height: 1.1; margin-bottom: 8px; word-break: break-word; }
.ads-subtitle { color: #64748b; font-size: 16px; }
.ads-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
.ads-badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 9999px; background: rgba(255,255,255,0.7); border: 1px solid #e2e8f0; color: #475569; font-size: 12px; font-weight: 500; }
.ads-body { padding-bottom: 96px; }
.ads-body-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
.ads-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
.ads-stat { display: flex; align-items: center; gap: 16px; background: #fff; border-radius: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); padding: 24px; }
.ads-stat-icon { width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.12); }
.ads-stat-text { min-width: 0; }
.ads-stat-value { font-size: 24px; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ads-stat-label { font-size: 12px; color: #64748b; font-weight: 500; }
.ads-tabs { background: #fff; border-radius: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); padding: 8px 20px 20px; border: 1px solid #f1f5f9; }
.ads-tab-label { margin-right: 6px; }
.ads-tab-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 9999px; background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 500; line-height: 1; }
@media (max-width: 768px) {
  .ads-stats { grid-template-columns: repeat(2, 1fr); }
  .ads-title { font-size: 24px; }
  .ads-icon-box { width: 72px; height: 72px; border-radius: 18px; }
}
</style>

<template>
  <div class="pls">
    <!-- 页头 -->
    <div class="pls-header">
      <div class="pls-header-inner">
        <router-link :to="backHref" class="pls-back">
          <el-icon><ArrowLeft /></el-icon>
          {{ backLabel }}
        </router-link>
        <div class="pls-title-row">
          <div class="pls-icon-box">
            <el-icon :size="22"><component :is="icon" /></el-icon>
          </div>
          <div class="pls-title-text">
            <h1 class="pls-title">{{ title }}</h1>
            <p class="pls-subtitle">{{ subtitle }}</p>
          </div>
        </div>
      </div>
    </div>

    <main class="pls-main">
      <div class="pls-toolbar">
        <div class="pls-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            :class="['pls-tab', { active: activeTab === tab.value }]"
            @click="$emit('update:activeTab', tab.value)"
          >
            {{ tab.label }}
            <span class="pls-tab-count" :class="{ 'count-active': activeTab === tab.value }">{{ tab.count }}</span>
          </button>
        </div>
        <el-input
          :model-value="keyword"
          class="pls-search"
          :placeholder="placeholder"
          clearable
          @update:model-value="$emit('update:keyword', $event)"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <div v-if="loading" class="pls-skeleton" :class="gridClassName">
        <div v-for="i in 6" :key="i" class="pls-skeleton-card" />
      </div>
      <slot v-else />
    </main>

    <footer class="pls-footer">知与 SaaS · 产教融合联盟</footer>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Search } from '@element-plus/icons-vue';

export interface PublicListTab {
  value: string;
  label: string;
  count: number;
}

withDefaults(
  defineProps<{
    title: string;
    subtitle: string;
    icon: any;
    tabs: PublicListTab[];
    activeTab: string;
    keyword: string;
    placeholder?: string;
    loading?: boolean;
    backHref?: string;
    backLabel?: string;
    gridClassName?: string;
  }>(),
  {
    placeholder: '搜索...',
    loading: false,
    backHref: '/portal/alliance/landing',
    backLabel: '返回校企合作联盟首页',
    gridClassName: 'grid-3',
  },
);

defineEmits<{
  'update:activeTab': [value: string];
  'update:keyword': [value: string];
}>();
</script>

<style scoped>
.pls { min-height: 100vh; display: flex; flex-direction: column; background: #f5f8ff; }
.pls-header { position: relative; overflow: hidden; background: linear-gradient(135deg, #409eff, #2f7fd6, #1f66b3); }
.pls-header-inner { position: relative; max-width: 1400px; margin: 0 auto; padding: 24px 24px; }
.pls-back { display: inline-flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.8); text-decoration: none; font-size: 14px; margin-bottom: 16px; transition: color 0.2s; }
.pls-back:hover { color: #fff; }
.pls-title-row { display: flex; align-items: center; gap: 16px; }
.pls-icon-box { width: 56px; height: 56px; border-radius: 16px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
.pls-title-text { flex: 1; min-width: 0; }
.pls-title { font-size: 24px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pls-subtitle { font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 4px; }
.pls-main { max-width: 1400px; margin: 0 auto; padding: 24px; width: 100%; flex: 1; }
.pls-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.pls-tabs { display: flex; align-items: center; gap: 4px; background: #fff; padding: 4px; border-radius: 12px; border: 1px solid #e7e5e4; box-shadow: 0 1px 2px rgba(0,0,0,0.05); overflow-x: auto; max-width: 100%; }
.pls-tab { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px; font-size: 13px; color: #475569; background: transparent; border: none; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
.pls-tab:hover { color: #409eff; background: #f8fafc; }
.pls-tab.active { background: #409eff; color: #fff; }
.pls-tab-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 9999px; background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 500; line-height: 1; }
.pls-tab-count.count-active { background: rgba(255,255,255,0.2); color: #fff; }
.pls-search { width: 320px; max-width: 100%; }
.pls-skeleton { display: grid; gap: 20px; }
.pls-skeleton.grid-3 { grid-template-columns: repeat(3, 1fr); }
.pls-skeleton.grid-2 { grid-template-columns: repeat(2, 1fr); }
.pls-skeleton-card { background: #fff; border-radius: 16px; border: 1px solid #e7e5e4; height: 220px; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.pls-footer { margin-top: auto; text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; border-top: 1px solid #eef2f7; }
@media (max-width: 768px) {
  .pls-skeleton.grid-3, .pls-skeleton.grid-2 { grid-template-columns: 1fr; }
  .pls-title { font-size: 20px; }
}
</style>

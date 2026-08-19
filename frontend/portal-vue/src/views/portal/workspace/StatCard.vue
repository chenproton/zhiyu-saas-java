<!--
  指标卡：图标 + 标题 + 数值 + 趋势文案。
  对齐 React frontend/edu/app/portal/workspace/_components/stat-card.tsx
  （白底圆角 12px、hover 抬阴影；trendUp 为绿色，否则灰色；可点击时整卡可键盘触发）。
-->
<template>
  <div
    class="stat-card"
    :class="{ clickable: clickable }"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="clickable && emit('click')"
    @keydown.enter.prevent="clickable && emit('click')"
    @keydown.space.prevent="clickable && emit('click')"
  >
    <span class="stat-icon" :class="`icon-${color}`">
      <el-icon :size="24"><component :is="icon" /></el-icon>
    </span>
    <div class="stat-body">
      <p class="stat-title">{{ title }}</p>
      <p class="stat-value">{{ value }}</p>
      <p v-if="trend" class="stat-trend" :class="{ up: trendUp }">{{ trend }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';

withDefaults(
  defineProps<{
    title: string;
    value: string | number;
    icon: Component;
    trend?: string;
    trendUp?: boolean;
    color?: 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'cyan' | 'indigo';
    clickable?: boolean;
  }>(),
  { color: 'blue', trendUp: false, clickable: false }
);

const emit = defineEmits<{ click: [] }>();
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s;
}
.stat-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.stat-card.clickable {
  cursor: pointer;
}
.stat-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-blue { background: #eff6ff; color: #2563eb; }
.icon-green { background: #ecfdf5; color: #059669; }
.icon-amber { background: #fffbeb; color: #d97706; }
.icon-purple { background: #f5f3ff; color: #7c3aed; }
.icon-rose { background: #fff1f2; color: #e11d48; }
.icon-cyan { background: #ecfeff; color: #0891b2; }
.icon-indigo { background: #eef2ff; color: #4f46e5; }
.stat-body {
  min-width: 0;
}
.stat-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat-value {
  margin: 2px 0 0;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}
.stat-trend {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
}
.stat-trend.up {
  color: #059669;
}
</style>

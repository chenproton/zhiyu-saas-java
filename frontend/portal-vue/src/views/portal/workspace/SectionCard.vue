<!--
  区块卡片：标题 + 图标底色 + 右侧动作按钮 + 内容插槽。
  对齐 React frontend/edu/app/portal/workspace/_components/section-card.tsx
  （白底、1px #f3f4f6 边框、圆角 12px、轻阴影；图标 32×32 圆角底色按 iconColor 取色）。
-->
<template>
  <div class="section-card">
    <div v-if="title" class="section-head">
      <div class="section-title">
        <span v-if="icon" class="section-icon" :class="`icon-${iconColor}`">
          <el-icon><component :is="icon" /></el-icon>
        </span>
        {{ title }}
      </div>
      <button v-if="actionLabel" type="button" class="section-action" @click="emit('action')">
        {{ actionLabel }}
      </button>
    </div>
    <div class="section-body" :class="{ 'no-title': !title }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';

withDefaults(
  defineProps<{
    title?: string;
    icon?: Component;
    iconColor?: 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'cyan' | 'indigo' | 'gray';
    actionLabel?: string;
  }>(),
  { iconColor: 'blue' }
);

const emit = defineEmits<{ action: [] }>();
</script>

<style scoped>
.section-card {
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.section-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.icon-blue { background: #eff6ff; color: #2563eb; }
.icon-green { background: #ecfdf5; color: #059669; }
.icon-amber { background: #fffbeb; color: #d97706; }
.icon-purple { background: #f5f3ff; color: #7c3aed; }
.icon-rose { background: #fff1f2; color: #e11d48; }
.icon-cyan { background: #ecfeff; color: #0891b2; }
.icon-indigo { background: #eef2ff; color: #4f46e5; }
.icon-gray { background: #f3f4f6; color: #4b5563; }
.section-action {
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}
.section-action:hover {
  background: #eff6ff;
  color: #1d4ed8;
}
.section-body {
  padding: 0 16px 16px;
}
.section-body.no-title {
  padding-top: 12px;
}
</style>

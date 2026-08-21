<template>
  <div class="section-card">
    <div class="sc-header">
      <span class="sc-bar" />
      <el-icon v-if="icon" class="sc-icon"><component :is="icon" /></el-icon>
      <h3 class="sc-title">{{ title }}</h3>
    </div>
    <div class="sc-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; icon?: any }>();
</script>

<style scoped>
.section-card { background: #fff; border: none; border-radius: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); padding: 20px; }
.sc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.sc-bar { width: 6px; height: 24px; border-radius: 9999px; background: linear-gradient(to bottom, rgba(64,158,255,0.8), rgba(64,158,255,0.6)); }
.sc-icon { color: #64748b; }
.sc-title { font-size: 18px; font-weight: 600; color: #0f172a; }
.sc-body { color: #334155; }
</style>

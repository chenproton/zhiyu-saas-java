<template>
  <div class="sh">
    <div class="sh-eyebrow"><el-icon><MagicStick /></el-icon>{{ eyebrow }}</div>
    <h2 class="sh-title">{{ title }}</h2>
    <p class="sh-subtitle">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
import { MagicStick } from '@element-plus/icons-vue';
defineProps<{ eyebrow: string; title: string; subtitle: string }>();
</script>

<style scoped>
.sh { text-align: center; margin-bottom: 32px; }
.sh-eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 9999px; background: rgba(64,158,255,0.05); border: 1px solid rgba(64,158,255,0.1); color: #409eff; font-size: 12px; font-weight: 500; margin-bottom: 16px; }
.sh-title { font-size: 32px; font-weight: 600; color: #0f172a; margin-bottom: 12px; letter-spacing: -0.02em; }
.sh-subtitle { font-size: 16px; color: #64748b; max-width: 640px; margin: 0 auto; line-height: 1.8; }
</style>

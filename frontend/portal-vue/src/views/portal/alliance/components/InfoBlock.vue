<template>
  <div class="info-block">
    <p class="ib-label">{{ label }}</p>
    <p class="ib-value">{{ value ?? '-' }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; value?: string | number | null }>();
</script>

<style scoped>
.info-block { padding: 16px; border-radius: 16px; background: #f8fafc; }
.ib-label { font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
.ib-value { font-size: 14px; font-weight: 600; color: #0f172a; word-break: break-all; }
</style>

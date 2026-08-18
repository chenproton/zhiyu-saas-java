<template>
  <div class="gradient-placeholder" :style="{ background: gradient }">
    <span v-if="label" class="gp-label">{{ label.slice(0, 1) }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  seed?: string;
  label?: string;
}>();

const GRADIENTS = [
  'linear-gradient(135deg, #409eff 0%, rgba(64,158,255,0.8) 100%)',
  'linear-gradient(135deg, rgba(64,158,255,0.8) 0%, rgba(64,158,255,0.6) 100%)',
  'linear-gradient(135deg, #64748b 0%, #334155 100%)',
  'linear-gradient(135deg, rgba(64,158,255,0.9) 0%, rgba(64,158,255,0.7) 100%)',
  'linear-gradient(135deg, #409eff 0%, rgba(64,158,255,0.7) 100%)',
  'linear-gradient(135deg, rgba(64,158,255,0.8) 0%, rgba(64,158,255,0.7) 100%)',
];

const gradient = computed(() => GRADIENTS[(props.seed?.length ?? 0) % GRADIENTS.length]);
</script>

<style scoped>
.gradient-placeholder {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.gp-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  user-select: none;
}
</style>

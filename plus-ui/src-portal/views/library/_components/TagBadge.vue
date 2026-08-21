<template>
  <span class="tag-badge" :style="badgeStyle">{{ tag.name }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TagItem } from '@/types/library';

const props = defineProps<{ tag: TagItem }>();

const badgeStyle = computed(() => ({
  color: props.tag.color,
  borderColor: `${props.tag.color}55`,
  backgroundColor: `${props.tag.color}14`
}));
</script>

<style scoped>
.tag-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 12px;
  line-height: 20px;
  font-weight: 400;
  white-space: nowrap;
}
</style>

<template>
  <el-select
    :model-value="modelValue"
    multiple
    filterable
    clearable
    placeholder="选择标签..."
    style="width: 100%"
    @update:model-value="onChange"
  >
    <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id">
      <span class="tag-option">
        <span class="dot" :style="{ backgroundColor: t.color || '#94a3b8' }" />
        <span>{{ t.name }}</span>
      </span>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { useTags } from './useTags';

defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const { tags } = useTags();

function onChange(v: string[]): void {
  emit('update:modelValue', v ?? []);
}
</script>

<style scoped>
.tag-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>

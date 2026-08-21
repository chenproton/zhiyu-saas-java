<template>
  <div class="tag-filter-bar">
    <span class="filter-label">标签筛选：</span>
    <template v-if="tags.length">
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        class="filter-chip"
        :style="chipStyle(tag)"
        @click="toggle(tag.id)"
      >
        <span class="dot" :style="{ backgroundColor: isSelected(tag.id) ? '#fff' : tag.color }" />
        <span>{{ tag.name }}</span>
        <span v-if="isSelected(tag.id)" class="close">✕</span>
      </button>
      <button v-if="modelValue.length" type="button" class="clear-btn" @click="emit('update:modelValue', [])">
        清除筛选
      </button>
    </template>
    <span v-else-if="!loading" class="empty">暂无标签，请先在「标签管理」中创建后再进行标签筛选</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTags } from './useTags';
import type { TagItem } from '@/types/library';

const props = defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const { tags, loading } = useTags();

const selected = computed(() => new Set(props.modelValue));

function isSelected(id: string): boolean {
  return selected.value.has(id);
}

function toggle(id: string): void {
  const next = new Set(props.modelValue);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit('update:modelValue', Array.from(next));
}

function chipStyle(tag: TagItem): Record<string, string> {
  return isSelected(tag.id)
    ? {
        background: tag.color,
        color: '#fff',
        borderColor: tag.color,
        boxShadow: `0 2px 8px ${tag.color}30`
      }
    : {
        background: '#f8fafc',
        color: '#64748b',
        borderColor: '#e2e8f0'
      };
}
</script>

<style scoped>
.tag-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  background: #fff;
}
.filter-label {
  font-size: 13px;
  color: #94a3b8;
  margin-right: 4px;
  flex-shrink: 0;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-chip .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.filter-chip .close {
  font-size: 11px;
  margin-left: 2px;
}
.clear-btn {
  margin-left: auto;
  padding: 5px 12px;
  border: 1px solid #fecaca;
  border-radius: 9999px;
  background: #fef2f2;
  color: #f87171;
  font-size: 12px;
  cursor: pointer;
}
.empty {
  font-size: 13px;
  color: #94a3b8;
}
</style>

<template>
  <el-dialog
    :model-value="modelValue"
    title="选择颗粒课"
    width="800px"
    @update:model-value="onClose"
  >
    <div class="gl-body">
      <div class="gl-left">
        <el-input v-model="search" placeholder="搜索颗粒课名称或编码..." clearable class="gl-search" />
        <div class="gl-list">
          <div
            v-for="gl in filtered"
            :key="gl.id"
            class="gl-item"
            :class="{ active: isSelected(gl.id) }"
            @click="toggle(gl.id)"
          >
            <div class="gl-check" :class="{ checked: isSelected(gl.id) }">{{ isSelected(gl.id) ? '✓' : '' }}</div>
            <div class="gl-info">
              <div class="gl-name">{{ gl.name }}</div>
              <div v-if="gl.description" class="gl-desc">{{ gl.description }}</div>
            </div>
            <span v-if="gl.code" class="gl-code">{{ gl.code }}</span>
          </div>
          <div v-if="filtered.length === 0" class="gl-empty">未找到匹配的颗粒课</div>
        </div>
      </div>

      <div class="gl-right">
        <p class="gl-selected-title">已选择 ({{ selectedIds.length }})</p>
        <div class="gl-selected-list">
          <div v-if="selectedCourses.length === 0" class="gl-empty">从左侧选择颗粒课</div>
          <div v-for="gl in selectedCourses" :key="gl.id" class="gl-selected-item">
            <span class="gl-selected-name">{{ gl.name }}</span>
            <button type="button" class="gl-remove" @click="toggle(gl.id)">✕</button>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GranularLessonOption } from './types';

const props = defineProps<{
  modelValue: boolean;
  granularCourses: GranularLessonOption[];
  selectedIds: string[];
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'update:selectedIds', v: string[]): void;
}>();

const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim();
  if (!q) return props.granularCourses;
  return props.granularCourses.filter(
    (g) => g.name.includes(q) || (g.code ? g.code.includes(q) : false)
  );
});

const selectedCourses = computed(() =>
  props.selectedIds
    .map((id) => props.granularCourses.find((g) => g.id === id))
    .filter((g): g is GranularLessonOption => Boolean(g))
);

function isSelected(id: string): boolean {
  return props.selectedIds.includes(id);
}

function toggle(id: string): void {
  const next = isSelected(id) ? props.selectedIds.filter((x) => x !== id) : [...props.selectedIds, id];
  emit('update:selectedIds', next);
}

function onClose(open: boolean): void {
  if (!open) search.value = '';
  emit('update:modelValue', open);
}
</script>

<style scoped>
.gl-body {
  display: flex;
  gap: 16px;
  height: 50vh;
  min-height: 320px;
}
.gl-left {
  flex: 3;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  min-height: 0;
}
.gl-search {
  margin-bottom: 12px;
}
.gl-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}
.gl-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.gl-item:hover {
  border-color: #cbd5e1;
}
.gl-item.active {
  border-color: #409eff;
  background: #ecf5ff;
}
.gl-check {
  width: 16px;
  height: 16px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  flex-shrink: 0;
}
.gl-check.checked {
  background: #409eff;
  border-color: #409eff;
}
.gl-info {
  flex: 1;
  min-width: 0;
}
.gl-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.gl-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}
.gl-code {
  font-size: 10px;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
}
.gl-right {
  flex: 2;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  min-height: 0;
}
.gl-selected-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}
.gl-selected-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gl-selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}
.gl-selected-name {
  flex: 1;
  font-size: 13px;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gl-remove {
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
}
.gl-empty {
  text-align: center;
  color: #94a3b8;
  padding: 24px 0;
  font-size: 13px;
}
</style>

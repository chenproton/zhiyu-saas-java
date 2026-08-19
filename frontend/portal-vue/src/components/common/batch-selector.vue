<template>
  <div class="batch-selector">
    <el-select
      v-if="majors.length > 0"
      :model-value="selectedMajorId"
      placeholder="全部专业"
      class="bs-major"
      @update:model-value="(v: string) => emit('update:selectedMajorId', v)"
    >
      <el-option label="全部专业" value="all" />
      <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
    </el-select>

    <div class="bs-list">
      <div v-if="batches.length === 0" class="bs-empty">暂无批次分组</div>
      <div
        v-for="b in batches"
        :key="b.id"
        class="bs-item"
        :class="{ active: selectedBatchId === b.id }"
        @click="emit('update:selectedBatchId', b.id)"
      >
        <div class="bs-item-text">
          <div class="bs-name" :class="{ active: selectedBatchId === b.id }">{{ b.name }}</div>
          <div class="bs-id">ID: {{ b.id.slice(0, 8) }}</div>
        </div>
        <el-icon v-if="selectedBatchId === b.id" class="bs-check"><Check /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check } from '@element-plus/icons-vue';
import type { ContentBatch } from './content-list-page.types';
import type { Major } from '@/types/system';

defineProps<{
  batches: ContentBatch[];
  majors: Major[];
  selectedMajorId: string;
  selectedBatchId: string;
}>();

const emit = defineEmits<{
  (e: 'update:selectedMajorId', value: string): void;
  (e: 'update:selectedBatchId', value: string): void;
}>();
</script>

<style scoped>
.batch-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bs-major {
  width: 100%;
}
.bs-list {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
  background: #fff;
}
.bs-empty {
  padding: 24px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}
.bs-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f0f2f5;
  transition: background 0.2s;
}
.bs-item:last-child {
  border-bottom: none;
}
.bs-item:hover {
  background: #f5f7fa;
}
.bs-item.active {
  background: #ecf5ff;
}
.bs-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.bs-name.active {
  color: #409eff;
}
.bs-id {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}
.bs-check {
  color: #409eff;
  flex-shrink: 0;
}
</style>

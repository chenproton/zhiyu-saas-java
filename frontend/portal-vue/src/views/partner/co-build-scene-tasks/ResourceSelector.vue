<template>
  <div class="resource-selector">
    <div class="toolbar">
      <el-input v-model="search" placeholder="搜索资源名称或描述..." clearable style="flex: 1" />
      <span class="count">共 {{ pool.length }} 个资源，已选 {{ selectedIds.length }} 个</span>
    </div>

    <div class="resource-list">
      <div
        v-for="r in filtered"
        :key="r.id"
        class="resource-item"
        :class="{ selected: isSelected(r.id) }"
        @click="toggle(r.id)"
      >
        <div class="check">
          <el-icon v-if="isSelected(r.id)" color="#409eff"><CircleCheckFilled /></el-icon>
          <el-icon v-else color="#c0c4cc"><CircleCheck /></el-icon>
        </div>
        <div class="res-icon" :style="{ background: typeColor(r.type) }">
          <el-icon><Document /></el-icon>
        </div>
        <div class="res-info">
          <div class="res-name">{{ r.name }}</div>
          <div class="res-meta">
            <el-tag size="small" type="info" disable-transitions>{{ typeLabel(r.type) }}</el-tag>
            <span v-if="r.size" class="res-size">{{ r.size }}</span>
          </div>
        </div>
      </div>
      <div v-if="filtered.length === 0" class="no-result">无匹配资源</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ResourceItem } from '@/views/lesson/lesson-edit-utils';

const props = defineProps<{
  pool: ResourceItem[];
  selectedIds: string[];
}>();

const emit = defineEmits<{
  (e: 'change', ids: string[]): void;
}>();

const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.pool;
  return props.pool.filter(
    (r) =>
      (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
  );
});

function isSelected(id: string): boolean {
  return props.selectedIds.includes(id);
}

function toggle(id: string) {
  if (isSelected(id)) {
    emit('change', props.selectedIds.filter((x) => x !== id));
  } else {
    emit('change', [...props.selectedIds, id]);
  }
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    document: '文档',
    spreadsheet: '表格',
    image: '图片',
    audio: '音频',
    video: '视频',
    archive: '压缩包',
    software: '软件',
    other: '其他',
    link: '链接',
    file: '文件'
  };
  return map[t] || t || '文件';
}

function typeColor(t: string): string {
  const map: Record<string, string> = {
    document: '#ecf5ff',
    spreadsheet: '#f0f9eb',
    image: '#fdf6ec',
    audio: '#fef0f0',
    video: '#f5f3ff',
    archive: '#f0f2f7',
    software: '#e6fffb'
  };
  return map[t] || '#f0f2f7';
}
</script>

<style scoped>
.resource-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.count {
  color: #666;
  font-size: 13px;
  white-space: nowrap;
}
.resource-list {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  max-height: 460px;
  overflow-y: auto;
}
.resource-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #f5f7fa;
  cursor: pointer;
}
.resource-item:last-child {
  border-bottom: none;
}
.resource-item:hover {
  background: #f5f7fa;
}
.resource-item.selected {
  background: #ecf5ff;
}
.res-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606266;
}
.res-info {
  flex: 1;
  min-width: 0;
}
.res-name {
  font-size: 14px;
  color: #303133;
}
.res-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.res-size {
  font-size: 12px;
  color: #999;
}
.no-result {
  padding: 24px;
  text-align: center;
  color: #999;
}
</style>

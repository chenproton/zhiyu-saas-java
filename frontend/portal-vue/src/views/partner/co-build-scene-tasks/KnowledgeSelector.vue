<template>
  <div class="knowledge-selector">
    <div class="selected-tags">
      <el-tag
        v-for="item in selected"
        :key="item.id"
        closable
        type="primary"
        effect="plain"
        @close="remove(item.id)"
      >
        {{ item.name }}
      </el-tag>
      <span v-if="selected.length === 0" class="empty-tip">尚未选择知识点</span>
    </div>

    <div class="toolbar">
      <el-input v-model="search" placeholder="搜索知识点名称、编码或描述..." clearable style="flex: 1" />
      <span class="count">共 {{ filtered.length }} 个，已选 {{ selected.length }} 个</span>
    </div>

    <div class="pool-list">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="pool-item"
        :class="{ selected: isSelected(item.id) }"
        @click="toggle(item)"
      >
        <div class="check">
          <el-icon v-if="isSelected(item.id)" color="#409eff"><CircleCheckFilled /></el-icon>
          <el-icon v-else color="#c0c4cc"><CircleCheck /></el-icon>
        </div>
        <div class="kp-info">
          <div class="kp-name">
            {{ item.name }}
            <span v-if="item.code" class="kp-code">{{ item.code }}</span>
          </div>
          <div v-if="item.description" class="kp-desc">{{ item.description }}</div>
          <div v-if="(item.granularLessons || []).length" class="kp-granular">
            关联颗粒课 {{ item.granularLessons!.length }} 门
          </div>
        </div>
      </div>
      <div v-if="filtered.length === 0" class="no-result">无匹配知识点</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { KnowledgePointItem } from '@/views/lesson/lesson-edit-utils';

const props = defineProps<{
  selected: KnowledgePointItem[];
  pool: KnowledgePointItem[];
}>();

const emit = defineEmits<{
  (e: 'change', selected: KnowledgePointItem[]): void;
}>();

const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.pool;
  return props.pool.filter(
    (k) =>
      (k.name || '').toLowerCase().includes(q) ||
      (k.code || '').toLowerCase().includes(q) ||
      (k.description || '').toLowerCase().includes(q)
  );
});

function isSelected(id: string): boolean {
  return props.selected.some((s) => s.id === id);
}

function toggle(item: KnowledgePointItem) {
  if (isSelected(item.id)) {
    emit('change', props.selected.filter((s) => s.id !== item.id));
  } else {
    emit('change', [...props.selected, item]);
  }
}

function remove(id: string) {
  emit('change', props.selected.filter((s) => s.id !== id));
}
</script>

<style scoped>
.knowledge-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
}
.empty-tip {
  color: #999;
  font-size: 13px;
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
.pool-list {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  max-height: 420px;
  overflow-y: auto;
}
.pool-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #f5f7fa;
  cursor: pointer;
}
.pool-item:last-child {
  border-bottom: none;
}
.pool-item:hover {
  background: #f5f7fa;
}
.pool-item.selected {
  background: #ecf5ff;
}
.check {
  margin-top: 2px;
}
.kp-info {
  flex: 1;
  min-width: 0;
}
.kp-name {
  font-size: 14px;
  color: #303133;
}
.kp-code {
  font-size: 12px;
  color: #999;
  font-family: monospace;
  margin-left: 6px;
}
.kp-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.kp-granular {
  font-size: 12px;
  color: #67c23a;
  margin-top: 2px;
}
.no-result {
  padding: 24px;
  text-align: center;
  color: #999;
}
</style>

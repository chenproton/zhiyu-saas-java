<template>
  <div class="ability-selector">
    <div class="toolbar">
      <el-input v-model="search" placeholder="搜索能力点名称、编码或描述..." clearable style="flex: 1" />
      <span class="count">共 {{ relatedAbilities.length }} 个关联能力点，已选 {{ selectedIds.length }} 个</span>
    </div>

    <div v-if="relatedAbilities.length === 0" class="empty">
      目标岗位暂无关联能力点，请先在学校端为岗位配置能力建模
    </div>

    <div v-else class="ability-grid">
      <div
        v-for="ab in filtered"
        :key="ab.id"
        class="ability-card"
        :class="{ selected: isSelected(ab.id) }"
        @click="toggle(ab.id)"
      >
        <div class="ability-head">
          <div class="check">
            <el-icon v-if="isSelected(ab.id)" color="#409eff"><CircleCheckFilled /></el-icon>
            <el-icon v-else color="#c0c4cc"><CircleCheck /></el-icon>
          </div>
          <span class="ability-name">{{ ab.name }}</span>
          <span v-if="ab.code" class="ability-code">{{ ab.code }}</span>
        </div>
        <p v-if="ab.description" class="ability-desc">{{ ab.description }}</p>
      </div>
      <div v-if="filtered.length === 0" class="no-result">无匹配能力点</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AbilityPointItem } from '@/views/lesson/lesson-edit-utils';

const props = defineProps<{
  relatedAbilities: AbilityPointItem[];
  selectedIds: string[];
}>();

const emit = defineEmits<{
  (e: 'change', ids: string[]): void;
}>();

const search = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.relatedAbilities;
  return props.relatedAbilities.filter(
    (ab) =>
      (ab.name || '').toLowerCase().includes(q) ||
      (ab.code || '').toLowerCase().includes(q) ||
      (ab.description || '').toLowerCase().includes(q)
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
</script>

<style scoped>
.ability-selector {
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
.empty {
  padding: 40px;
  text-align: center;
  color: #999;
}
.ability-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-height: 460px;
  overflow-y: auto;
  align-content: start;
}
.ability-card {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.ability-card:hover {
  background: #f5f7fa;
}
.ability-card.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.ability-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.check {
  flex-shrink: 0;
}
.ability-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ability-code {
  font-size: 11px;
  color: #999;
  font-family: monospace;
  flex-shrink: 0;
}
.ability-desc {
  font-size: 12px;
  color: #909399;
  margin: 6px 0 0 22px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.no-result {
  grid-column: 1 / -1;
  padding: 24px;
  text-align: center;
  color: #999;
}
</style>

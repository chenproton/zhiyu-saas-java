<template>
  <div class="ability-selector">
    <div v-if="selected.length > 0" class="selected-tags">
      <el-tag v-for="ap in selected" :key="ap.id" type="primary" effect="plain" closable class="ap-tag" @close="toggle(ap)">
        {{ ap.name }}
      </el-tag>
    </div>
    <el-button plain size="small" class="trigger-btn" @click="open = true">
      <el-icon><Award /></el-icon>
      {{ selected.length > 0 ? '调整能力点' : '关联能力点' }}
    </el-button>

    <el-dialog v-model="open" title="关联能力点" width="520px" append-to-body destroy-on-close>
      <el-input v-model="search" placeholder="搜索能力点名称、编码、描述" clearable class="search-input">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <div class="list">
        <el-empty v-if="filtered.length === 0 && !adding" description="未找到匹配的能力点" :image-size="56" />
        <div
          v-for="ap in filtered"
          :key="ap.id"
          class="ap-item"
          :class="{ selected: isSelected(ap.id) }"
          @click="toggle(ap)"
        >
          <el-icon class="ap-check" :color="isSelected(ap.id) ? '#409eff' : '#c0c4cc'">
            <CircleCheck v-if="isSelected(ap.id)" />
            <CircleCheckFilled v-else class="unchecked" />
          </el-icon>
          <div class="ap-info">
            <p class="ap-name">{{ ap.name }}</p>
            <p v-if="ap.code" class="ap-code">{{ ap.code }}</p>
            <p v-if="ap.description" class="ap-desc">{{ ap.description }}</p>
          </div>
        </div>
      </div>

      <template v-if="adding">
        <div class="add-form">
          <p class="add-title">新增能力点</p>
          <el-input v-model="newName" placeholder="名称" class="add-input" />
          <el-input v-model="newDesc" placeholder="描述（可选）" class="add-input" />
          <div class="add-actions">
            <el-button size="small" @click="adding = false">取消</el-button>
            <el-button size="small" type="primary" :disabled="!newName.trim()" @click="handleAddCustom">添加</el-button>
          </div>
        </div>
      </template>
      <el-button v-else link type="primary" size="small" class="custom-btn" @click="adding = true">
        <el-icon><Plus /></el-icon> 自定义能力点
      </el-button>

      <template #footer>
        <el-button type="primary" @click="open = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AbilityPointItem } from './lesson-edit-utils';

const props = defineProps<{
  selected: AbilityPointItem[];
  pool: AbilityPointItem[];
}>();

const emit = defineEmits<{
  (e: 'change', selected: AbilityPointItem[]): void;
  (e: 'addCustom', name: string, description?: string): void;
}>();

const open = ref(false);
const search = ref('');
const newName = ref('');
const newDesc = ref('');
const adding = ref(false);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.pool;
  return props.pool.filter(
    (ap) =>
      (ap.name || '').toLowerCase().includes(q) ||
      (ap.code || '').toLowerCase().includes(q) ||
      (ap.description || '').toLowerCase().includes(q)
  );
});

function isSelected(id: string): boolean {
  return props.selected.some((s) => s.id === id);
}

function toggle(ap: AbilityPointItem) {
  const exists = isSelected(ap.id);
  if (exists) {
    emit('change', props.selected.filter((s) => s.id !== ap.id));
  } else {
    emit('change', [...props.selected, ap]);
  }
}

function handleAddCustom() {
  if (!newName.value.trim()) return;
  emit('addCustom', newName.value.trim(), newDesc.value.trim());
  newName.value = '';
  newDesc.value = '';
  adding.value = false;
}
</script>

<style scoped>
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.ap-tag {
  font-weight: normal;
}
.trigger-btn {
  font-size: 12px;
}
.search-input {
  margin-bottom: 10px;
}
.list {
  max-height: 320px;
  overflow-y: auto;
}
.ap-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.ap-item:hover {
  border-color: #a0cfff;
}
.ap-item.selected {
  border-color: #409eff;
  background: #ecf5ff;
}
.ap-check {
  margin-top: 2px;
  flex-shrink: 0;
}
.ap-check .unchecked {
  color: #dcdfe6;
}
.ap-info {
  flex: 1;
  min-width: 0;
}
.ap-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin: 0;
}
.ap-code {
  font-size: 10px;
  color: #c0c4cc;
  margin: 2px 0 0;
}
.ap-desc {
  font-size: 12px;
  color: #909399;
  margin: 4px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.add-form {
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
  margin-top: 8px;
}
.add-title {
  font-size: 12px;
  color: #606266;
  margin: 0 0 8px;
}
.add-input {
  margin-bottom: 8px;
}
.add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.custom-btn {
  margin-top: 8px;
}
</style>

<!--
  关联备课内容弹窗（教师工作台首页 / 我的场景·课程共用）。
  对齐原 React 版 prep-associate-dialog.tsx：
  - 一级为「混合课程 / 实践场景」（只读展示 planName），二级为可多选的「节次 / 任务」；
  - 候选来自 hybridCourseSessions / scenarioTasks（React 侧为空，展示「暂无可用节次/任务」）；
  - 确认关联后按钮变「修改关联」，并出现「前往备课 / 前往导学」（新窗口打开 prepUrl）；
  - 关闭弹窗回滚勾选到入参 currentSubItemIds，并清掉已确认态。
-->
<template>
  <el-dialog
    :model-value="open"
    width="520px"
    :close-on-click-modal="false"
    @update:model-value="handleOpenChange"
  >
    <template #header>
      <div class="dlg-head">
        <span class="dlg-title">
          <el-icon><Reading /></el-icon>
          关联备课内容
        </span>
        <p class="dlg-desc">勾选要备课的{{ level2Label }}（可多选），后续可直接跳转到对应备课页面。</p>
      </div>
    </template>

    <div class="prep-body">
      <div class="field">
        <label class="field-label">{{ level1Label }}</label>
        <div class="plan-row">
          <el-tag size="small" :type="isHybrid ? 'primary' : 'success'" effect="plain">
            {{ level1Label }}
          </el-tag>
          <span class="plan-name">{{ planName }}</span>
        </div>
      </div>

      <div class="field">
        <div class="field-head">
          <label class="field-label">{{ level2Label }}名称</label>
          <span v-if="selectedIds.size > 0" class="field-hint">
            已选 {{ selectedIds.size }}/{{ subItems.length }}
          </span>
        </div>
        <p v-if="subItems.length === 0" class="empty-line">暂无可用{{ level2Label }}</p>
        <div v-else class="sub-list">
          <div
            v-for="item in subItems"
            :key="item.id"
            class="sub-item"
            :class="{ selected: selectedIds.has(item.id), scene: !isHybrid }"
            @click="toggleItem(item.id)"
          >
            <el-checkbox :model-value="selectedIds.has(item.id)" class="sub-check" />
            <span class="sub-name">{{ item.name }}</span>
            <span v-if="selectedIds.has(item.id) && confirmed" class="sub-flag">已关联</span>
            <el-icon v-else-if="selectedIds.has(item.id)" class="sub-check-icon"><Check /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dlg-foot">
        <el-button link size="small" class="clear-btn" @click="selectedIds = new Set()">
          清空选择
        </el-button>
        <div class="foot-right">
          <el-button @click="handleOpenChange(false)">取消</el-button>
          <el-button type="primary" :disabled="selectedIds.size === 0" @click="handleConfirm">
            {{ confirmed ? '修改关联' : '确认关联' }}
          </el-button>
          <el-button v-if="confirmed && prepUrl" type="primary" @click="handleNavigate">
            {{ isHybrid ? '前往备课' : '前往导学' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Check, Reading } from '@element-plus/icons-vue';
import {
  hybridCourseSessions,
  scenarioTasks,
  type PrepSubItem
} from './workspace-teacher-types';

const props = defineProps<{
  open: boolean;
  planId: string;
  planName: string;
  isHybrid: boolean;
  currentSubItemIds?: string[];
  prepUrl?: string;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  confirm: [subItems: PrepSubItem[]];
}>();

const subItems = computed<PrepSubItem[]>(() =>
  props.isHybrid ? hybridCourseSessions[props.planId] || [] : scenarioTasks[props.planId] || []
);

const level1Label = computed(() => (props.isHybrid ? '混合课程' : '实践场景'));
const level2Label = computed(() => (props.isHybrid ? '节次' : '任务'));

const selectedIds = ref<Set<string>>(new Set(props.currentSubItemIds || []));
const confirmed = ref(false);

// 每次打开按最新入参重置勾选（React 侧由 key/state 初始值等价实现）
watch(
  () => props.open,
  (v) => {
    if (v) {
      selectedIds.value = new Set(props.currentSubItemIds || []);
      confirmed.value = false;
    }
  }
);

function toggleItem(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function handleConfirm() {
  const items = subItems.value.filter((s) => selectedIds.value.has(s.id));
  if (items.length > 0) {
    emit('confirm', items);
    confirmed.value = true;
  }
}

function handleNavigate() {
  if (props.prepUrl) window.open(props.prepUrl, '_blank');
  emit('update:open', false);
}

function handleOpenChange(v: boolean) {
  emit('update:open', v);
  if (!v) {
    selectedIds.value = new Set(props.currentSubItemIds || []);
    confirmed.value = false;
  }
}
</script>

<style scoped>
.dlg-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dlg-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}
.dlg-title :deep(.el-icon) {
  color: var(--el-color-primary);
}
.dlg-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
.prep-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.field-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}
.field-hint {
  font-size: 12px;
  color: #9ca3af;
}
.plan-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}
.plan-name {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}
.empty-line {
  margin: 0;
  padding: 12px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}
.sub-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
}
.sub-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}
.sub-item:hover {
  border-color: #e5e7eb;
  background: #f9fafb;
}
.sub-item.selected {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}
.sub-item.selected.scene {
  border-color: #6ee7b7;
  background: #ecfdf5;
}
.sub-check {
  pointer-events: none;
}
.sub-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: #374151;
}
.sub-item.selected .sub-name {
  font-weight: 600;
  color: #111827;
}
.sub-flag {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.sub-item.scene .sub-flag {
  border-color: #a7f3d0;
  background: #ecfdf5;
  color: #059669;
}
.sub-check-icon {
  flex-shrink: 0;
  color: var(--el-color-primary);
}
.sub-item.scene .sub-check-icon {
  color: #059669;
}
.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #f3f4f6;
  padding-top: 8px;
}
.clear-btn {
  font-size: 12px;
  color: #9ca3af;
}
.foot-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

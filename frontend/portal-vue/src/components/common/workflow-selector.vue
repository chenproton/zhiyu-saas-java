<template>
  <div class="workflow-selector">
    <div v-if="workflows.length === 0" class="ws-empty">暂无启用的审批流程，请先在审批流程管理中启用</div>
    <el-select
      v-else
      :model-value="selectedWorkflowId"
      placeholder="选择审批流程"
      class="ws-select"
      @update:model-value="(v: string) => emit('update:selectedWorkflowId', v)"
    >
      <el-option v-for="w in workflows" :key="w.id" :label="w.name" :value="w.id" />
    </el-select>
    <p class="ws-hint">选择审批流程后直接提交，无需绑定批次分组；提交后资源仍可在批次分组视图中随时绑定</p>
  </div>
</template>

<script setup lang="ts">
import type { Workflow } from '@/types/system';

defineProps<{
  workflows: Workflow[];
  selectedWorkflowId: string;
}>();

const emit = defineEmits<{
  (e: 'update:selectedWorkflowId', value: string): void;
}>();
</script>

<style scoped>
.workflow-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ws-empty {
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}
.ws-select {
  width: 100%;
}
.ws-hint {
  margin: 0;
  font-size: 12px;
  color: #c0c4cc;
}
</style>

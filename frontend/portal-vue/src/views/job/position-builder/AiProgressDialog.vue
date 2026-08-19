<template>
  <!-- AI 进度弹窗（对齐 React components/job/position-builder/ai-assist-progress-dialog.tsx） -->
  <el-dialog
    :model-value="open"
    :title="title"
    width="480px"
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => !v && emit('close')"
    @close="emit('close')"
  >
    <p class="dialog-desc">{{ description }}</p>
    <div class="progress-head">
      <span>当前进度</span>
      <span>{{ progress }}%</span>
    </div>
    <el-progress :percentage="progress" :show-text="false" :stroke-width="8" />
    <div class="step-list">
      <div
        v-for="(step, idx) in steps"
        :key="`${idx}-${step}`"
        class="step-item"
        :class="{ 'is-active': isActive(idx), 'is-done': isDone(idx) }"
      >
        <el-icon v-if="isActive(idx)" class="is-loading step-icon active"><Loading /></el-icon>
        <el-icon v-else-if="isDone(idx)" class="step-icon done"><CircleCheckFilled /></el-icon>
        <span v-else class="step-dot" />
        <span class="step-text">{{ step }}</span>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { CircleCheckFilled, Loading } from '@element-plus/icons-vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    description?: string;
    steps: string[];
    /** currentStep < 0 或 >= steps.length 表示全部完成 */
    currentStep: number;
    progress: number;
  }>(),
  {
    title: 'AI 辅助编写中',
    description: '大模型正在处理岗位信息，请稍候...'
  }
);

const emit = defineEmits<{ (e: 'close'): void }>();

function isDone(idx: number): boolean {
  return props.currentStep < 0 || props.currentStep >= props.steps.length || idx < props.currentStep;
}

function isActive(idx: number): boolean {
  return !isDone(idx) && idx === props.currentStep;
}
</script>

<style scoped>
.dialog-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #909399;
}
.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
  color: #8b5cf6;
}
.step-list {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
  font-size: 13px;
  color: #c0c4cc;
  transition: all 0.2s;
}
.step-item.is-active {
  background: #f6f2ff;
  border-color: #d9c8ff;
  color: #7c3aed;
}
.step-item.is-done {
  background: #f0f9f2;
  border-color: #c8e6cd;
  color: #529b57;
}
.step-icon {
  flex-shrink: 0;
}
.step-icon.active {
  color: #8b5cf6;
}
.step-icon.done {
  color: #67c23a;
}
.step-dot {
  width: 14px;
  height: 14px;
  border: 2px solid #dcdfe6;
  border-radius: 50%;
  flex-shrink: 0;
}
.step-text {
  font-weight: 500;
}
</style>

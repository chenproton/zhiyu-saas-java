<template>
  <div class="activation-config">
    <p class="label">启用条件</p>
    <div class="mode-grid">
      <button
        v-for="m in modes"
        :key="m.key"
        type="button"
        class="mode-card"
        :class="{ active: mode === m.key }"
        @click="emit('change', { activationMode: m.key })"
      >
        <div class="mode-head">
          <span class="radio" :class="{ on: mode === m.key }"><i v-if="mode === m.key" /></span>
          <span class="mode-label">{{ m.label }}</span>
        </div>
        <p class="mode-desc">{{ m.desc }}</p>
      </button>
    </div>
    <div v-if="mode === 'scheduled'" class="schedule-row">
      <div class="field">
        <p class="sub-label">启用时间</p>
        <el-date-picker
          :model-value="value.scheduledTime || ''"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm"
          format="YYYY-MM-DD HH:mm"
          placeholder="选择启用时间"
          style="width: 100%"
          @update:model-value="(v: string) => emit('change', { scheduledTime: v || '' })"
        />
      </div>
      <div class="field">
        <p class="sub-label">停用时间</p>
        <el-date-picker
          :model-value="value.scheduledEndTime || ''"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm"
          format="YYYY-MM-DD HH:mm"
          placeholder="选择停用时间"
          style="width: 100%"
          @update:model-value="(v: string) => emit('change', { scheduledEndTime: v || '' })"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 测评启用条件：手动启用 / 定时启用（起止时间）/ 随时作答
// 对齐 React frontend/edu/components/evaluation-rules/exam-activation-config.tsx
import { computed } from 'vue';
import type { ExamActivationValue } from './types';

const props = defineProps<{ value: ExamActivationValue }>();
const emit = defineEmits<{ (e: 'change', updates: Partial<ExamActivationValue>): void }>();

const mode = computed(() => props.value.activationMode ?? 'manual');

const modes = [
  { key: 'manual', label: '手动启用', desc: '老师手动开启后学生可作答' },
  { key: 'scheduled', label: '定时启用', desc: '预设开始结束时间，到时间自动开启关闭' },
  { key: 'always', label: '随时作答', desc: '创建后立即开放，学生随时可进入作答' }
];
</script>

<style scoped>
.activation-config {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
.label {
  margin: 0 0 8px;
  font-size: 12px;
  color: #909399;
}
.sub-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #909399;
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.mode-card {
  text-align: left;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font: inherit;
  color: #606266;
  transition: all 0.2s;
}
.mode-card:hover {
  border-color: #c0c4cc;
}
.mode-card.active {
  border-color: #409eff;
  background: #f7fbff;
  color: #409eff;
}
.mode-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.radio {
  width: 15px;
  height: 15px;
  border: 1px solid #dcdfe6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.radio.on {
  border-color: #409eff;
  background: #409eff;
}
.radio.on i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
}
.mode-label {
  font-size: 12px;
  font-weight: 500;
}
.mode-desc {
  margin: 4px 0 0 23px;
  font-size: 11px;
  color: #a8abb2;
}
.schedule-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}
</style>

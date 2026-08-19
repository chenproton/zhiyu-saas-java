<template>
  <el-dialog
    :model-value="modelValue"
    title="测评对象配置"
    width="720px"
    append-to-body
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <template #header>
      <div class="dialog-header">
        <p class="dialog-title">测评对象配置</p>
        <p class="dialog-desc">配置 {{ methodLabel }} 的测评对象</p>
      </div>
    </template>
    <p class="hint">选择本评价方式的测评对象类型</p>
    <div class="object-grid">
      <button
        v-for="opt in options"
        :key="opt.key"
        type="button"
        class="object-card"
        :class="{ active: currentObject === opt.key }"
        @click="pick(opt.key)"
      >
        <div class="object-icon" :class="{ active: currentObject === opt.key }">
          <el-icon :size="24"><component :is="opt.icon" /></el-icon>
        </div>
        <div>
          <p class="object-label">{{ opt.label }}</p>
          <p class="object-desc">{{ opt.desc }}</p>
        </div>
      </button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
// 测评对象配置弹窗：对齐 React renderObjectDialogContent（个人 / 小组）
import { computed } from 'vue';
import type { EvalObjectType, EvalRuleConfig } from '@/views/lesson/lesson-edit-utils';
import { methodLabelOf } from './types';

const props = defineProps<{
  modelValue: boolean;
  methodKey: string;
  config: EvalRuleConfig;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'patch', patch: Partial<EvalRuleConfig>): void;
}>();

const options = [
  { key: 'individual', label: '个人', desc: '以学生个人为单位进行测评', icon: 'User' },
  { key: 'group', label: '小组', desc: '以小组为单位进行测评', icon: 'UserFilled' }
];

const methodLabel = computed(() => methodLabelOf(props.methodKey));

const currentObject = computed(
  () => props.config.methodEvalObjects[props.methodKey] || props.config.evalObject
);

function pick(key: string) {
  emit('patch', {
    methodEvalObjects: { ...props.config.methodEvalObjects, [props.methodKey]: key as EvalObjectType }
  });
}
</script>

<style scoped>
.dialog-header .dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.dialog-header .dialog-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}
.hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: #909399;
}
.object-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.object-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: all 0.2s;
}
.object-card:hover {
  border-color: #c0c4cc;
}
.object-card.active {
  border-color: #409eff;
  background: #f7fbff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.2);
}
.object-icon {
  padding: 12px;
  border-radius: 8px;
  background: #f5f7fa;
  color: #c0c4cc;
  display: flex;
}
.object-icon.active {
  background: #ecf5ff;
  color: #409eff;
}
.object-label {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}
.object-desc {
  margin: 0;
  font-size: 12px;
  color: #a8abb2;
}
</style>

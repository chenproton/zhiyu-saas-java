<template>
  <div class="score-input-wrap">
    <el-input
      :model-value="value"
      type="number"
      :min="0"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="score-input"
      @input="emit('update', String($event ?? ''))"
      @blur="emit('blur')"
    />
    <span class="score-max-label">/ {{ max }}</span>
    <el-tooltip v-if="!disabled" content="一键满分" placement="top">
      <el-button size="small" text class="max-btn" @click="emit('update', String(max))">
        <el-icon><Trophy /></el-icon>
      </el-button>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { Trophy } from '@element-plus/icons-vue';

// 统一评分输入（对齐 React exam-grading/ScoreInput）：
// 输入过程走 update 事件（满分即时提交由父级判定），失焦走 blur 事件提交校验。
withDefaults(defineProps<{ value: string; max: number; step?: number; disabled?: boolean }>(), {
  step: 0.5,
  disabled: false
});
const emit = defineEmits<{ (e: 'update', val: string): void; (e: 'blur'): void }>();
</script>

<style scoped>
.score-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.score-input {
  width: 72px;
}
.score-input :deep(.el-input__inner) {
  text-align: right;
  font-weight: 600;
  height: 32px;
}
.score-max-label {
  font-size: 12px;
  color: #c0c4cc;
  white-space: nowrap;
}
.max-btn {
  color: #409eff;
  padding: 4px;
}
</style>

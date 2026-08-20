<template>
  <el-dialog
    :model-value="modelValue"
    title="题目预览"
    width="640px"
    append-to-body
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div v-if="question" class="q-preview">
      <div class="q-head">
        <el-tag size="small" :color="typeColor" style="color: #fff; border: none">{{ typeLabel }}</el-tag>
        <span v-if="question.score != null" class="q-score">{{ question.score }} 分</span>
      </div>
      <p class="q-content">{{ question.content }}</p>
      <div v-if="question.options && question.options.length > 0" class="q-options">
        <div v-for="(opt, i) in question.options" :key="i" class="q-option">
          <span class="q-option-label">{{ String.fromCharCode(65 + i) }}.</span>
          <span>{{ opt }}</span>
        </div>
      </div>
      <div class="q-answer">
        <span class="label">答案：</span>
        <span>{{ answerText }}</span>
      </div>
      <div v-if="question.analysis" class="q-analysis">
        <span class="label">解析：</span>
        <span>{{ question.analysis }}</span>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
// 题目预览弹窗：对齐原 React 版 question-preview.tsx
import { computed } from 'vue';
import { QUESTION_TYPE_COLORS, QUESTION_TYPE_LABELS } from '@/types/evaluation';
import type { QuestionType } from '@/types/evaluation';

interface PreviewQuestion {
  type: QuestionType;
  content: string;
  options?: string[];
  answer: string | string[];
  analysis?: string;
  score?: number;
}

const props = defineProps<{
  modelValue: boolean;
  question: PreviewQuestion | null;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const typeColor = computed(() => QUESTION_TYPE_COLORS[props.question?.type ?? ''] || '#909399');
const typeLabel = computed(() => QUESTION_TYPE_LABELS[props.question?.type ?? 'single'] || props.question?.type);

const answerText = computed(() => {
  const a = props.question?.answer;
  if (Array.isArray(a)) return a.join('、') || '-';
  return a || '-';
});
</script>

<style scoped>
.q-preview {
  padding: 4px 0;
}
.q-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.q-score {
  font-size: 13px;
  color: #909399;
}
.q-content {
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.7;
  color: #303133;
  white-space: pre-wrap;
}
.q-options {
  margin-bottom: 12px;
}
.q-option {
  font-size: 14px;
  line-height: 1.8;
  color: #606266;
}
.q-option-label {
  display: inline-block;
  min-width: 22px;
  color: #909399;
}
.q-answer,
.q-analysis {
  font-size: 14px;
  line-height: 1.7;
  color: #606266;
  margin-top: 6px;
}
.label {
  color: #909399;
}
</style>

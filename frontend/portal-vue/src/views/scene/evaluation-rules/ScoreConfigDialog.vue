<template>
  <el-dialog
    :model-value="modelValue"
    title="题型分配"
    width="520px"
    append-to-body
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <p class="hint">
      为每种题型配置总分（合计 100 分），系统自动在每个题型内均匀分配。如有余数，从该题型的第一道题开始额外增加 1 分。
    </p>
    <div v-for="qt in types" :key="qt" class="type-row">
      <span class="type-label">{{ typeLabel(qt) }}（{{ typeQuestions(qt).length }} 题）</span>
      <el-input-number
        :model-value="typeScores[qt] ?? 0"
        :min="0"
        :max="100"
        :step="1"
        :precision="0"
        size="small"
        controls-position="right"
        @update:model-value="(v: number | undefined) => (typeScores[qt] = v || 0)"
      />
      <span class="unit">分</span>
    </div>
    <div class="total-row">
      <span :class="totalInput === 100 ? 'ok' : 'bad'">合计：{{ totalInput }} 分</span>
      <span v-if="totalInput !== 100" class="tip">（需等于 100 分）</span>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!isValid" @click="handleApply">应用配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
// 题型分配弹窗：对齐 React frontend/edu/components/evaluation/score-config-dialog.tsx
import { computed, ref, watch } from 'vue';
import { QUESTION_TYPE_LABELS } from './types';

const props = defineProps<{
  modelValue: boolean;
  questions: { questionId: string; type: string }[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'apply', scores: Record<string, number>): void;
}>();

const typeScores = ref<Record<string, number>>({});

const typeQuestionsMap = computed(() => {
  const map: Record<string, { questionId: string; type: string }[]> = {};
  props.questions.forEach((q) => {
    if (!map[q.type]) map[q.type] = [];
    map[q.type].push(q);
  });
  return map;
});

const types = computed(() => Object.keys(typeQuestionsMap.value));

function typeQuestions(t: string) {
  return typeQuestionsMap.value[t] || [];
}

function typeLabel(t: string): string {
  return QUESTION_TYPE_LABELS[t] || t;
}

// 仅在弹窗从关闭→打开时初始化分值为 0，避免覆盖用户已输入的值
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const init: Record<string, number> = {};
    types.value.forEach((t) => (init[t] = 0));
    typeScores.value = init;
  }
);

const totalInput = computed(() => types.value.reduce((sum, t) => sum + (typeScores.value[t] || 0), 0));

const isValid = computed(
  () => totalInput.value === 100 && types.value.every((t) => (typeScores.value[t] || 0) > 0)
);

function handleApply() {
  const scores: Record<string, number> = {};
  types.value.forEach((t) => {
    const list = typeQuestions(t);
    const typeTotal = typeScores.value[t] || 0;
    const n = list.length;
    if (n === 0) return;
    const base = Math.floor(typeTotal / n);
    const remainder = typeTotal - base * n;
    list.forEach((q, idx) => {
      scores[q.questionId] = base + (idx < remainder ? 1 : 0);
    });
  });
  emit('apply', scores);
  emit('update:modelValue', false);
}
</script>

<style scoped>
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}
.type-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.type-label {
  flex: 1;
  font-size: 13px;
  color: #606266;
}
.unit {
  font-size: 12px;
  color: #909399;
}
.total-row {
  text-align: right;
  font-size: 13px;
  margin-top: 4px;
}
.total-row .ok {
  color: #67c23a;
  font-weight: 600;
}
.total-row .bad {
  color: #f56c6c;
}
.total-row .tip {
  margin-left: 6px;
  color: #909399;
  font-size: 12px;
}
</style>

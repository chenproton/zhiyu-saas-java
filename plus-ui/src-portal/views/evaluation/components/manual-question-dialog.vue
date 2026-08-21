<template>
  <el-dialog
    :model-value="modelValue"
    title="手动抽题"
    width="820px"
    top="6vh"
    append-to-body
    destroy-on-close
    @update:model-value="handleClose"
  >
    <div class="md-toolbar">
      <el-select v-model="selectedBankId" placeholder="选择题库" style="width: 260px" @change="onBankChange">
        <el-option v-for="b in publishedBanks" :key="b.id" :label="bankLabel(b)" :value="b.id" />
      </el-select>
      <template v-if="selectedBankId">
        <el-input v-model="search" placeholder="搜索题目内容..." clearable style="flex: 1" />
        <el-select v-model="typeFilter" style="width: 130px">
          <el-option label="全部类型" value="all" />
          <el-option v-for="t in QUESTION_TYPES" :key="t" :label="QUESTION_TYPE_LABELS[t]" :value="t" />
        </el-select>
      </template>
    </div>

    <div v-if="selectedBankId" class="md-head">
      <el-checkbox
        :model-value="filteredQuestions.length > 0 && selectedIds.length === filteredQuestions.length"
        @change="(v: boolean | string | number) => handleSelectAll(!!v)"
      >
        已选 {{ selectedIds.length }} / {{ filteredQuestions.length }} 题
      </el-checkbox>
      <el-button type="primary" size="small" :disabled="selectedIds.length === 0" @click="handleAddSelected">
        添加选中题目 ({{ selectedIds.length }})
      </el-button>
    </div>

    <div v-loading="loadingQuestions" class="md-body">
      <el-empty v-if="selectedBankId && !loadingQuestions && filteredQuestions.length === 0"
        :description="questions.length === 0 ? '该题库暂无题目' : '没有找到匹配的题目'" :image-size="60" />
      <div v-else-if="selectedBankId" class="md-list">
        <div
          v-for="q in filteredQuestions"
          :key="q.id"
          class="md-card"
          :class="{ selected: selectedIds.includes(q.id) }"
          @click="toggle(q.id)"
        >
          <el-checkbox :model-value="selectedIds.includes(q.id)" @click.stop @change="() => toggle(q.id)" />
          <div class="md-card-body">
            <p class="md-content">{{ q.content }}</p>
            <div class="md-meta">
              <el-tag size="small" :color="typeColor(q.type)" style="color: #fff; border: none">{{ typeLabel(q.type) }}</el-tag>
              <el-tag v-if="q.difficulty" size="small" type="info">{{ difficultyLabel(q.difficulty) }}</el-tag>
              <span class="dim">{{ q.score }} 分</span>
              <span v-if="kpNames(q).length > 0" class="dim md-kp">{{ kpNames(q).join('、') }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="请先选择一个题库" :image-size="60" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
// 手动抽题弹窗：对齐原 React 版 manual-question-dialog.tsx
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { questionApi, questionBankApi } from '@/api/evaluation';
import { knowledgeApi } from '@/api/lesson';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, QUESTION_TYPE_COLORS, DIFFICULTY_LABELS } from '@/types/evaluation';
import type { Question, QuestionBank, QuestionType } from '@/types/evaluation';

interface EvalKnowledgePoint {
  id: string;
  name: string;
}

const props = defineProps<{
  modelValue: boolean;
  selectedQuestionIds: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'add-questions', questions: Question[]): void;
}>();

const banks = ref<QuestionBank[]>([]);
const questions = ref<Question[]>([]);
const knowledgePoints = ref<EvalKnowledgePoint[]>([]);
const selectedBankId = ref('');
const search = ref('');
const typeFilter = ref<QuestionType | 'all'>('all');
const selectedIds = ref<string[]>([]);
const loadingQuestions = ref(false);

const publishedBanks = computed(() => banks.value.filter((b) => b.status === 'published'));

const filteredQuestions = computed(() =>
  questions.value.filter((q) => {
    const matchSearch = q.content.toLowerCase().includes(search.value.toLowerCase());
    const matchType = typeFilter.value === 'all' || q.type === typeFilter.value;
    const notAdded = !props.selectedQuestionIds.includes(q.id);
    return matchSearch && matchType && notAdded;
  })
);

async function loadBanks() {
  try {
    const res = await questionBankApi.list({ limit: 200 });
    banks.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载题库失败');
  }
}

async function loadKnowledgePoints() {
  try {
    const res = await knowledgeApi.list({ limit: 1000 });
    knowledgePoints.value = res.items.map((kp) => ({ id: kp.id, name: kp.name }));
  } catch {
    knowledgePoints.value = [];
  }
}

async function loadQuestions() {
  if (!selectedBankId.value) return;
  loadingQuestions.value = true;
  try {
    const res = await questionApi.list({ bankId: selectedBankId.value, limit: 500 });
    questions.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载题目失败');
  } finally {
    loadingQuestions.value = false;
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    await loadBanks();
    await loadKnowledgePoints();
    if (publishedBanks.value.length > 0 && !selectedBankId.value) {
      selectedBankId.value = publishedBanks.value[0].id;
      await loadQuestions();
    }
  }
);

function onBankChange() {
  selectedIds.value = [];
  void loadQuestions();
}

function bankLabel(b: QuestionBank): string {
  return `${b.name} (${b.questionCount ?? 0} 题)`;
}

function toggle(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id];
}

function handleSelectAll(checked: boolean) {
  selectedIds.value = checked ? filteredQuestions.value.map((q) => q.id) : [];
}

function handleAddSelected() {
  const toAdd = questions.value.filter((q) => selectedIds.value.includes(q.id));
  emit('add-questions', toAdd);
  selectedIds.value = [];
  emit('update:modelValue', false);
}

function handleClose(v: boolean) {
  if (!v) {
    selectedIds.value = [];
    search.value = '';
    typeFilter.value = 'all';
  }
  emit('update:modelValue', v);
}

function typeLabel(t: QuestionType): string {
  return QUESTION_TYPE_LABELS[t] || t;
}
function typeColor(t: QuestionType): string {
  return QUESTION_TYPE_COLORS[t] || '#909399';
}
function difficultyLabel(d: string): string {
  return DIFFICULTY_LABELS[d] || d;
}
function kpNames(q: Question): string[] {
  return (q.knowledgePoints || [])
    .map((id) => knowledgePoints.value.find((k) => k.id === id)?.name)
    .filter(Boolean) as string[];
}
</script>

<style scoped>
.md-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.md-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.md-body {
  min-height: 240px;
  max-height: 54vh;
  overflow-y: auto;
}
.md-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.md-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.md-card:hover {
  border-color: #a0cfff;
}
.md-card.selected {
  border-color: #409eff;
  background: #f0f7ff;
}
.md-card-body {
  flex: 1;
  min-width: 0;
}
.md-content {
  margin: 0 0 6px;
  font-size: 13px;
  color: #303133;
  line-height: 1.5;
}
.md-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.dim {
  font-size: 12px;
  color: #909399;
}
.md-kp {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

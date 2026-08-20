<template>
  <el-dialog
    :model-value="modelValue"
    :title="previewQuestions ? '抽题预览' : '随机抽题'"
    width="760px"
    top="6vh"
    append-to-body
    destroy-on-close
    @update:model-value="handleClose"
  >
    <!-- 预览视图 -->
    <template v-if="previewQuestions">
      <p class="rd-hint">已抽取 {{ previewQuestions.length }} 道题目，可移除不需要的题目后确认加入</p>
      <div class="rd-preview">
        <el-empty v-if="previewQuestions.length === 0" description="未抽到符合条件的题目，请调整筛选条件后重试" :image-size="60" />
        <div v-for="(q, i) in previewQuestions" :key="q.id" class="rd-preview-card">
          <span class="rd-idx">{{ i + 1 }}.</span>
          <div class="rd-preview-body">
            <p class="rd-preview-content">{{ q.content }}</p>
            <div class="rd-preview-meta">
              <el-tag size="small" :color="typeColor(q.type)" style="color: #fff; border: none">{{ typeLabel(q.type) }}</el-tag>
              <el-tag v-if="q.difficulty" size="small" type="info">{{ difficultyLabel(q.difficulty) }}</el-tag>
              <span v-if="bankName(q.bankId)" class="dim">{{ bankName(q.bankId) }}</span>
            </div>
          </div>
          <el-button link type="danger" @click="removeFromPreview(q.id)">移除</el-button>
        </div>
      </div>
    </template>

    <!-- 筛选视图 -->
    <template v-else>
      <div class="rd-body">
        <div class="rd-section">
          <div class="rd-label">选择题库</div>
          <el-select v-model="selectedBankIds" multiple collapse-tags clearable filterable placeholder="不选则从全部题库抽取" style="width: 100%" @change="resetWeight">
            <el-option v-for="b in publishedBanks" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </div>

        <div class="rd-section">
          <div class="rd-label">题目类型</div>
          <el-checkbox-group v-model="selectedTypes" @change="resetWeight">
            <el-checkbox-button v-for="t in QUESTION_TYPES" :key="t" :value="t">{{ QUESTION_TYPE_LABELS[t] }}</el-checkbox-button>
          </el-checkbox-group>
        </div>

        <div class="rd-section">
          <div class="rd-label">难度等级</div>
          <el-checkbox-group v-model="selectedDifficulties" @change="resetWeight">
            <el-checkbox-button v-for="d in difficulties" :key="d" :value="d">{{ DIFFICULTY_LABELS[d] }}</el-checkbox-button>
          </el-checkbox-group>
        </div>

        <div class="rd-section">
          <div class="rd-label">知识点</div>
          <el-select v-model="selectedKnowledgePoints" multiple collapse-tags clearable filterable placeholder="不选则包含全部知识点" style="width: 100%" :loading="loadingKnowledgePoints" @change="resetWeight">
            <el-option v-for="kp in knowledgePoints" :key="kp.id" :label="kp.name" :value="kp.id" />
          </el-select>
        </div>

        <div v-if="availableDimensions.length > 0" class="rd-section">
          <div class="rd-label">按比例分配</div>
          <div class="rd-dims">
            <el-checkbox-button
              v-for="dim in availableDimensions"
              :key="dim"
              :model-value="weightDimension === dim"
              @change="() => toggleWeightDim(dim)"
            >
              {{ DIM_LABEL[dim] }}
            </el-checkbox-button>
          </div>
          <div v-if="weightDimension && weightKeys.length > 0" class="rd-weights">
            <div v-for="key in weightKeys" :key="key" class="rd-weight-row">
              <span class="rd-weight-label">{{ weightKeyLabel(key) }}</span>
              <el-input-number
                :model-value="weightValues[key] ?? 0"
                :min="0"
                :max="100"
                size="small"
                controls-position="right"
                @update:model-value="(v: number | undefined) => setWeight(key, v || 0)"
              />
            </div>
            <p class="dim">输入的数字按比例折算，无需凑满 100</p>
          </div>
        </div>

        <div class="rd-section">
          <div class="rd-label">抽取数量</div>
          <el-input-number v-model="count" :min="1" :max="countSliderMax" size="small" />
          <p class="dim rd-summary">
            {{ filterSummary || '未设置筛选，从全部题目中抽取' }}｜可用题目池：{{ filteredPool.length }} 道
            <span v-if="count > filteredPool.length" class="rd-warn">（超过可用数量，将全部抽取）</span>
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <template v-if="previewQuestions">
        <el-button @click="previewQuestions = null">重新抽题</el-button>
        <el-button type="primary" :disabled="previewQuestions.length === 0" @click="handleConfirm">确认加入试卷</el-button>
      </template>
      <template v-else>
        <span class="rd-footer-info">
          <span v-if="filteredPool.length === 0" class="rd-warn">当前条件下没有可用题目</span>
          <span v-else class="dim">实际抽取 {{ Math.min(count, filteredPool.length) }} 道题目</span>
        </span>
        <el-button @click="handleClose(false)">取消</el-button>
        <el-button type="primary" :disabled="filteredPool.length === 0" @click="doRandomSelect">随机抽题</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
// 随机抽题弹窗：对齐原 React 版 random-question-dialog.tsx
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { questionApi, questionBankApi } from '@/api/evaluation';
import { knowledgeApi } from '@/api/lesson';
import { fetchAllPages } from '@/components/common/content-list-page.types';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, QUESTION_TYPE_COLORS, DIFFICULTY_LABELS } from '@/types/evaluation';
import type { Difficulty, Question, QuestionBank, QuestionType } from '@/types/evaluation';

type WeightDimension = 'bank' | 'type' | 'difficulty' | 'knowledge';

const DIM_LABEL: Record<WeightDimension, string> = {
  bank: '按题库比例',
  type: '按题型比例',
  difficulty: '按难度比例',
  knowledge: '按知识点比例'
};

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

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
const loadingKnowledgePoints = ref(false);

const selectedBankIds = ref<string[]>([]);
const selectedTypes = ref<QuestionType[]>([]);
const selectedDifficulties = ref<Difficulty[]>([]);
const selectedKnowledgePoints = ref<string[]>([]);
const count = ref(5);

const weightDimension = ref<WeightDimension | ''>('');
const weightValues = ref<Record<string, number>>({});
const previewQuestions = ref<Question[] | null>(null);

const publishedBanks = computed(() => banks.value.filter((b) => b.status === 'published'));

const basePool = computed(() =>
  questions.value.filter((q) => {
    if (props.selectedQuestionIds.includes(q.id)) return false;
    const bank = banks.value.find((b) => b.id === q.bankId);
    return bank?.status === 'published';
  })
);

const filteredPool = computed(() => {
  let pool = [...basePool.value];
  if (selectedBankIds.value.length > 0) pool = pool.filter((q) => selectedBankIds.value.includes(q.bankId));
  if (selectedTypes.value.length > 0) pool = pool.filter((q) => selectedTypes.value.includes(q.type));
  if (selectedDifficulties.value.length > 0)
    pool = pool.filter((q) => q.difficulty && selectedDifficulties.value.includes(q.difficulty as Difficulty));
  if (selectedKnowledgePoints.value.length > 0)
    pool = pool.filter((q) => q.knowledgePoints?.some((kp) => selectedKnowledgePoints.value.includes(kp)));
  return pool;
});

const weightKeys = computed<string[]>(() => {
  if (!weightDimension.value) return [];
  switch (weightDimension.value) {
    case 'bank':
      return selectedBankIds.value.length > 0 ? selectedBankIds.value : publishedBanks.value.map((b) => b.id);
    case 'type':
      return QUESTION_TYPES as string[];
    case 'difficulty':
      return difficulties as string[];
    case 'knowledge':
      return selectedKnowledgePoints.value.length > 0
        ? selectedKnowledgePoints.value
        : knowledgePoints.value.map((k) => k.id);
  }
});

const availableDimensions = computed<WeightDimension[]>(() => {
  const dims: WeightDimension[] = [];
  const bankKeys = selectedBankIds.value.length > 0 ? selectedBankIds.value : publishedBanks.value.map((b) => b.id);
  if (bankKeys.length >= 2) dims.push('bank');
  const typeKeys = selectedTypes.value.length > 0 ? selectedTypes.value : (QUESTION_TYPES as string[]);
  if (typeKeys.length >= 2) dims.push('type');
  const diffKeys = selectedDifficulties.value.length > 0 ? selectedDifficulties.value : (difficulties as string[]);
  if (diffKeys.length >= 2) dims.push('difficulty');
  const kpKeys = selectedKnowledgePoints.value.length > 0
    ? selectedKnowledgePoints.value
    : knowledgePoints.value.map((k) => k.id);
  if (kpKeys.length >= 2) dims.push('knowledge');
  return dims;
});

const countSliderMax = computed(() => Math.max(1, Math.min(50, filteredPool.value.length)));

const filterSummary = computed(() => {
  const parts: string[] = [];
  if (selectedBankIds.value.length > 0) parts.push(`题库 ${selectedBankIds.value.length} 个`);
  if (selectedTypes.value.length > 0) parts.push(`题型 ${selectedTypes.value.length} 种`);
  if (selectedDifficulties.value.length > 0) parts.push(`难度 ${selectedDifficulties.value.length} 级`);
  if (selectedKnowledgePoints.value.length > 0) parts.push(`知识点 ${selectedKnowledgePoints.value.length} 个`);
  return parts.length > 0 ? `筛选条件：${parts.join('，')}` : '';
});

async function loadData() {
  try {
    const [bankRes, allQuestions] = await Promise.all([
      questionBankApi.list({ limit: 200 }),
      fetchAllPages<Question>((page, pageSize) => questionApi.list({ limit: pageSize, offset: page * pageSize }))
    ]);
    banks.value = bankRes.items;
    questions.value = allQuestions;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载题目列表失败');
  }
}

async function loadKnowledgePoints() {
  loadingKnowledgePoints.value = true;
  try {
    const res = await knowledgeApi.list({ limit: 1000 });
    knowledgePoints.value = res.items.map((kp) => ({ id: kp.id, name: kp.name }));
  } catch {
    knowledgePoints.value = [];
  } finally {
    loadingKnowledgePoints.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    void loadData();
    void loadKnowledgePoints();
  }
);

function allocateProportions(total: number, entries: string[], weights: Record<string, number>): Record<string, number> {
  const active = entries.filter((k) => (weights[k] ?? 0) > 0);
  const items = active.length > 0 ? active : entries;
  const rawSum = items.reduce((s, k) => s + (weights[k] || 0), 0);
  const fracs = items.map((k) => ({
    key: k,
    frac: rawSum > 0 ? (total * (weights[k] || 0)) / rawSum : total / items.length
  }));
  const result: Record<string, number> = {};
  let allocated = 0;
  const remainders: { key: string; rem: number }[] = [];
  fracs.forEach(({ key, frac }) => {
    const floor = Math.floor(frac);
    result[key] = floor;
    allocated += floor;
    remainders.push({ key, rem: frac - floor });
  });
  remainders.sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < total - allocated; i++) {
    if (i < remainders.length) result[remainders[i].key]++;
  }
  return result;
}

function doRandomSelect() {
  let allSelected: Question[] = [];
  const pool = filteredPool.value;

  if (weightDimension.value && weightKeys.value.length > 0) {
    const allocation = allocateProportions(count.value, weightKeys.value, weightValues.value);
    const used = new Set<string>();

    Object.entries(allocation).forEach(([key, target]) => {
      if (target <= 0) return;
      const candidates = pool.filter((q) => {
        if (used.has(q.id)) return false;
        if (weightDimension.value === 'bank') return q.bankId === key;
        if (weightDimension.value === 'type') return q.type === key;
        if (weightDimension.value === 'difficulty') return q.difficulty === key;
        return q.knowledgePoints?.includes(key);
      });
      const take = Math.min(target, candidates.length);
      for (let i = 0; i < take; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const q = candidates.splice(idx, 1)[0];
        allSelected.push(q);
        used.add(q.id);
      }
    });

    if (allSelected.length < count.value) {
      const remaining = pool.filter((q) => !used.has(q.id));
      const need = count.value - allSelected.length;
      for (let i = 0; i < Math.min(need, remaining.length); i++) {
        const idx = Math.floor(Math.random() * remaining.length);
        allSelected.push(remaining.splice(idx, 1)[0]);
        used.add(allSelected[allSelected.length - 1].id);
      }
    }
  } else {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    allSelected = shuffled.slice(0, Math.min(count.value, shuffled.length));
  }

  for (let i = allSelected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allSelected[i], allSelected[j]] = [allSelected[j], allSelected[i]];
  }
  previewQuestions.value = allSelected;
}

function handleConfirm() {
  if (previewQuestions.value && previewQuestions.value.length > 0) {
    emit('add-questions', previewQuestions.value);
  }
  handleClose(false);
}

function resetWeight() {
  weightDimension.value = '';
  weightValues.value = {};
}

function toggleWeightDim(dim: WeightDimension) {
  if (weightDimension.value === dim) {
    weightDimension.value = '';
    weightValues.value = {};
  } else {
    weightDimension.value = dim;
    weightValues.value = {};
  }
}

function setWeight(key: string, v: number) {
  weightValues.value = { ...weightValues.value, [key]: Math.max(0, Math.min(100, v)) };
}

function removeFromPreview(qid: string) {
  previewQuestions.value = previewQuestions.value ? previewQuestions.value.filter((q) => q.id !== qid) : null;
}

function handleClose(v: boolean) {
  if (!v) {
    selectedBankIds.value = [];
    selectedTypes.value = [];
    selectedDifficulties.value = [];
    selectedKnowledgePoints.value = [];
    count.value = 5;
    weightDimension.value = '';
    weightValues.value = {};
    previewQuestions.value = null;
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
function bankName(bankId: string): string {
  return banks.value.find((b) => b.id === bankId)?.name || '';
}
function weightKeyLabel(key: string): string {
  if (weightDimension.value === 'bank') return banks.value.find((b) => b.id === key)?.name || key;
  if (weightDimension.value === 'type') return QUESTION_TYPE_LABELS[key as QuestionType] || key;
  if (weightDimension.value === 'difficulty') return DIFFICULTY_LABELS[key] || key;
  return knowledgePoints.value.find((k) => k.id === key)?.name || key;
}
</script>

<style scoped>
.rd-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
.rd-body {
  max-height: 56vh;
  overflow-y: auto;
  padding-right: 4px;
}
.rd-section {
  margin-bottom: 14px;
}
.rd-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 6px;
}
.rd-dims {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.rd-weights {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #f7f8fa;
  padding: 10px 12px;
  max-height: 200px;
  overflow-y: auto;
}
.rd-weight-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.rd-weight-label {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rd-summary {
  margin-top: 6px;
}
.rd-warn {
  color: #e6a23c;
}
.rd-footer-info {
  flex: 1;
  text-align: left;
  font-size: 12px;
}
.rd-preview {
  max-height: 54vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rd-preview-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
}
.rd-idx {
  width: 20px;
  flex-shrink: 0;
  color: #909399;
  font-size: 12px;
  line-height: 20px;
}
.rd-preview-body {
  flex: 1;
  min-width: 0;
}
.rd-preview-content {
  margin: 0 0 6px;
  font-size: 13px;
  color: #303133;
  line-height: 1.5;
}
.rd-preview-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.dim {
  font-size: 12px;
  color: #909399;
}
</style>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="question ? '编辑题目' : '新建题目'"
    width="820px"
    top="5vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="qf-body">
      <!-- 题型切换条 -->
      <div class="qf-types">
        <el-radio-group v-model="type" size="small" @change="handleTypeChange">
          <el-radio-button v-for="t in QUESTION_TYPES" :key="t" :value="t">
            {{ QUESTION_TYPE_LABELS[t] }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- 题干 -->
      <div class="qf-section">
        <div class="qf-section-head">
          <span class="qf-section-title">题目</span>
          <el-button link size="small" @click="content = ''">清空</el-button>
        </div>
        <el-input v-model="content" type="textarea" :rows="3" placeholder="请输入题目内容..." />
        <div v-if="type === 'fill'" class="qf-blank-tip">
          <el-button link type="primary" size="small" @click="insertBlankMarker">插入填空标记 {n}</el-button>
          <span class="dim">已识别 {{ blankCount }} 个空位</span>
        </div>
      </div>

      <!-- 选项（单选/多选） -->
      <div v-if="type === 'single' || type === 'multiple'" class="qf-section">
        <div class="qf-section-head">
          <span class="qf-section-title">选项设置</span>
          <el-button v-if="options.length < MAX_OPTIONS" link type="primary" size="small" @click="addOption">
            添加选项
          </el-button>
        </div>
        <div v-for="(opt, index) in options" :key="index" class="qf-option-row">
          <span class="qf-option-label">{{ String.fromCharCode(65 + index) }}</span>
          <el-radio
            v-if="type === 'single'"
            :model-value="singleAnswer === String(index)"
            class="qf-radio"
            @change="() => toggleSingleAnswer(index)"
          />
          <el-checkbox
            v-else
            :model-value="multipleAnswer.includes(String(index))"
            class="qf-radio"
            @change="() => toggleMultipleAnswer(index)"
          />
          <el-input v-model="options[index]" :placeholder="'选项 ' + String.fromCharCode(65 + index)" size="small" />
          <el-button link size="small" :disabled="index === 0" @click="moveOption(index, -1)">上移</el-button>
          <el-button link size="small" :disabled="index === options.length - 1" @click="moveOption(index, 1)">下移</el-button>
          <el-button link type="danger" size="small" :disabled="options.length <= MIN_OPTIONS" @click="removeOption(index)">
            删除
          </el-button>
        </div>
      </div>

      <!-- 判断题答案 -->
      <div v-else-if="type === 'judge'" class="qf-section">
        <div class="qf-section-head"><span class="qf-section-title">正确答案</span></div>
        <el-radio-group v-model="judgeAnswer">
          <el-radio-button value="true">正确</el-radio-button>
          <el-radio-button value="false">错误</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 填空题答案 -->
      <div v-else-if="type === 'fill'" class="qf-section">
        <div class="qf-section-head"><span class="qf-section-title">空位答案</span></div>
        <el-empty v-if="blankCount === 0" description="在题目中点击「插入填空标记」来创建空位" :image-size="60" />
        <div v-for="idx in blankCount" :key="idx" class="qf-fill-row">
          <el-tag size="small" type="warning">空位 {{ idx }}</el-tag>
          <el-input :model-value="fillAnswer[idx - 1] || ''" size="small" placeholder="标准答案"
            @update:model-value="(v: string) => updateBlankAnswer(idx - 1, v)" />
        </div>
      </div>

      <!-- 问答题/简答题答案 -->
      <div v-else class="qf-section">
        <div class="qf-section-head"><span class="qf-section-title">参考答案</span></div>
        <el-input v-model="essayAnswer" type="textarea" :rows="3" placeholder="请输入参考答案..." />
      </div>

      <!-- 设置 -->
      <div class="qf-section qf-settings">
        <div class="qf-setting-row">
          <span class="qf-label">难度</span>
          <el-select v-model="difficulty" size="small" style="width: 140px">
            <el-option v-for="(label, key) in DIFFICULTY_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
          <span class="qf-label">分值</span>
          <el-input-number v-model="score" :min="0" :step="0.5" size="small" style="width: 120px" />
        </div>
        <div class="qf-setting-row">
          <span class="qf-label">知识点</span>
          <el-select
            v-model="knowledgePointIds"
            multiple
            filterable
            clearable
            size="small"
            placeholder="选择知识点..."
            style="flex: 1"
            :loading="loadingKnowledgePoints"
          >
            <el-option v-for="kp in knowledgePoints" :key="kp.id" :label="kp.name" :value="kp.id" />
          </el-select>
        </div>
        <div v-if="type === 'single' || type === 'multiple'" class="qf-setting-row">
          <el-checkbox v-model="shuffleOptions">选项随机排序</el-checkbox>
        </div>
        <div class="qf-setting-row">
          <span class="qf-label">解析</span>
          <el-input v-model="analysis" type="textarea" :rows="2" placeholder="输入解析内容（选填）" style="flex: 1" />
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button v-if="!question" :disabled="!content.trim()" @click="handleSubmitAndContinue">保存并继续添加</el-button>
      <el-button type="primary" :disabled="!content.trim()" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
// 题目编辑弹窗：对齐 React frontend/edu/components/evaluation/question-form-dialog.tsx
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { knowledgeApi } from '@/api/lesson';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, DIFFICULTY_LABELS } from '@/types/evaluation';
import type { Difficulty, Question, QuestionFormData, QuestionType } from '@/types/evaluation';

const MAX_OPTIONS = 8;
const MIN_OPTIONS = 2;

interface EvalKnowledgePoint {
  id: string;
  name: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    question?: Question | null;
    defaultType?: QuestionType;
  }>(),
  { question: null, defaultType: 'single' }
);

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', data: QuestionFormData): void;
}>();

const type = ref<QuestionType>('single');
const content = ref('');
const options = ref<string[]>(['', '', '', '']);
const answer = ref<string | string[]>('');
const score = ref(0);
const analysis = ref('');
const difficulty = ref<Difficulty>('medium');
const knowledgePointIds = ref<string[]>([]);
const knowledgePoints = ref<EvalKnowledgePoint[]>([]);
const loadingKnowledgePoints = ref(false);
const shuffleOptions = ref(false);

const singleAnswer = computed({
  get: () => (typeof answer.value === 'string' ? answer.value : ''),
  set: (v: string) => (answer.value = v)
});
const multipleAnswer = computed(() => (Array.isArray(answer.value) ? answer.value : []));
const judgeAnswer = computed({
  get: () => (typeof answer.value === 'string' ? answer.value : ''),
  set: (v: string) => (answer.value = v)
});
const essayAnswer = computed({
  get: () => (typeof answer.value === 'string' ? answer.value : ''),
  set: (v: string) => (answer.value = v)
});
const fillAnswer = computed(() => (Array.isArray(answer.value) ? answer.value : []));

const blankCount = computed(() => {
  const matches = content.value.match(/\{(\d+)\}/g);
  return matches ? matches.length : 0;
});

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

// 后端存储的选项文本答案转索引（单/多选弹窗内以 A/B/C/D 判断）
function answerToIndexes(ans: string | string[], opts: string[]): string | string[] {
  if (Array.isArray(ans)) {
    return ans.map((a) => String(opts.indexOf(a))).filter((i) => i !== '-1');
  }
  const idx = opts.indexOf(ans as string);
  return idx >= 0 ? String(idx) : '';
}

function loadQuestion() {
  if (props.question) {
    type.value = props.question.type;
    content.value = props.question.content;
    options.value = props.question.options || ['', '', '', ''];
    if (props.question.type === 'single') {
      const indexes = answerToIndexes(props.question.answer, props.question.options || []);
      answer.value = Array.isArray(indexes) ? indexes[0] ?? '' : indexes;
    } else if (props.question.type === 'multiple') {
      answer.value = answerToIndexes(props.question.answer, props.question.options || []);
    } else if (props.question.type === 'judge') {
      answer.value = Array.isArray(props.question.answer)
        ? props.question.answer[0] ?? ''
        : props.question.answer;
    } else if (props.question.type === 'fill') {
      answer.value = Array.isArray(props.question.answer) ? props.question.answer : [];
    } else {
      answer.value = Array.isArray(props.question.answer)
        ? props.question.answer[0] ?? ''
        : props.question.answer;
    }
    analysis.value = props.question.analysis || '';
    difficulty.value = (props.question.difficulty as Difficulty) || 'medium';
    score.value = props.question.score ?? 0;
    knowledgePointIds.value = props.question.knowledgePoints || [];
    shuffleOptions.value = !!props.question.shuffleOptions;
  } else {
    type.value = props.defaultType;
    content.value = '';
    options.value = ['', '', '', ''];
    answer.value = props.defaultType === 'multiple' ? [] : '';
    analysis.value = '';
    difficulty.value = 'medium';
    score.value = 0;
    knowledgePointIds.value = [];
    shuffleOptions.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    loadQuestion();
    void loadKnowledgePoints();
  }
);

function buildFormData(): QuestionFormData {
  let finalAnswer: string[];
  if (type.value === 'single') {
    const chosen = options.value[parseInt(answer.value as string, 10)] || '';
    finalAnswer = chosen ? [chosen] : [];
  } else if (type.value === 'multiple') {
    finalAnswer = (answer.value as string[])
      .map((a) => options.value[parseInt(a, 10)] || '')
      .filter(Boolean);
  } else if (Array.isArray(answer.value)) {
    finalAnswer = [...answer.value];
  } else {
    finalAnswer = [answer.value as string];
  }

  const data: QuestionFormData = {
    type: type.value,
    content: content.value.trim(),
    analysis: analysis.value.trim() || undefined,
    score: score.value,
    answer: finalAnswer,
    difficulty: difficulty.value,
    knowledgePoints: knowledgePointIds.value.length > 0 ? knowledgePointIds.value : undefined,
    shuffleOptions: shuffleOptions.value
  };

  if (type.value === 'single' || type.value === 'multiple') {
    data.options = options.value.filter((o) => o.trim());
  }
  return data;
}

function resetForNext() {
  content.value = '';
  options.value = ['', '', '', ''];
  answer.value = type.value === 'multiple' ? [] : '';
  analysis.value = '';
  shuffleOptions.value = false;
}

function handleSubmit() {
  if (!content.value.trim()) return;
  emit('submit', buildFormData());
  emit('update:modelValue', false);
}

function handleSubmitAndContinue() {
  if (!content.value.trim()) return;
  emit('submit', buildFormData());
  resetForNext();
}

function handleTypeChange() {
  options.value = ['', '', '', ''];
  answer.value = type.value === 'multiple' ? [] : '';
}

function toggleSingleAnswer(index: number) {
  answer.value = String(index);
}

function toggleMultipleAnswer(index: number) {
  const key = String(index);
  const current = Array.isArray(answer.value) ? answer.value : [];
  answer.value = current.includes(key) ? current.filter((a) => a !== key) : [...current, key];
}

function addOption() {
  if (options.value.length < MAX_OPTIONS) options.value = [...options.value, ''];
}

function removeOption(index: number) {
  if (options.value.length <= MIN_OPTIONS) return;
  const next = options.value.filter((_, i) => i !== index);
  const adjust = (a: string): string | null => {
    const idx = parseInt(a, 10);
    if (idx === index) return null;
    if (idx > index) return String(idx - 1);
    return String(idx);
  };
  options.value = next;
  if (Array.isArray(answer.value)) {
    answer.value = answer.value.map(adjust).filter((a): a is string => a !== null);
  } else {
    const adjusted = adjust(answer.value as string);
    answer.value = adjusted === null ? '' : adjusted;
  }
}

function moveOption(index: number, dir: number) {
  const newIndex = index + dir;
  if (newIndex < 0 || newIndex >= options.value.length) return;
  const next = [...options.value];
  const temp = next[index];
  next[index] = next[newIndex];
  next[newIndex] = temp;
  options.value = next;

  const swap = (a: string): string => {
    const idx = parseInt(a, 10);
    if (idx === index) return String(newIndex);
    if (idx === newIndex) return String(index);
    return String(idx);
  };
  if (Array.isArray(answer.value)) {
    answer.value = answer.value.map(swap);
  } else {
    answer.value = swap(answer.value as string);
  }
}

function insertBlankMarker() {
  const marker = `{${blankCount.value + 1}}`;
  content.value = content.value + marker;
}

function updateBlankAnswer(idx: number, value: string) {
  const current = Array.isArray(answer.value) ? [...answer.value] : [];
  current[idx] = value;
  answer.value = current;
}
</script>

<style scoped>
.qf-body {
  max-height: 66vh;
  overflow-y: auto;
  padding-right: 4px;
}
.qf-types {
  margin-bottom: 14px;
  display: flex;
  flex-wrap: wrap;
}
.qf-section {
  margin-bottom: 16px;
}
.qf-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.qf-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}
.qf-blank-tip {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.dim {
  color: #909399;
  font-size: 12px;
}
.qf-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.qf-option-label {
  width: 18px;
  text-align: center;
  font-weight: 600;
  color: #909399;
}
.qf-radio {
  flex-shrink: 0;
}
.qf-fill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.qf-settings {
  border-top: 1px solid #ebeef5;
  padding-top: 14px;
}
.qf-setting-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.qf-label {
  width: 48px;
  flex-shrink: 0;
  font-size: 13px;
  color: #606266;
  line-height: 32px;
}
</style>

<template>
  <div class="q-card" :class="{ 'q-subjective': !auto }">
    <!-- 卡片头 -->
    <div class="q-header" @click="expanded = !expanded">
      <div class="q-tag-group">
        <span class="q-type-badge" :class="{ 'badge-subjective': !auto }">{{ questionTypeLabel(question.type) }}</span>
        <span class="q-index">第 {{ index + 1 }} 题</span>
      </div>
      <span class="q-content-preview">{{ question.content }}</span>
      <div class="q-score-area" @click.stop>
        <template v-if="!auto">
          <ScoreInput
            :value="localScore"
            :max="question.score || 0"
            :disabled="isGraded"
            @update="onScoreInput"
            @blur="onScoreBlur"
          />
        </template>
        <template v-else>
          <span class="auto-score">{{ autoScore }}</span>
          <span class="auto-max">/ {{ question.score || 0 }}</span>
          <el-tag v-if="correct" type="success" size="small">
            <el-icon class="tag-icon"><CircleCheck /></el-icon>正确
          </el-tag>
          <el-tag v-else type="danger" size="small">
            <el-icon class="tag-icon"><CircleClose /></el-icon>错误
          </el-tag>
        </template>
        <el-icon class="q-chevron" @click.stop="expanded = !expanded">
          <ArrowUp v-if="expanded" />
          <ArrowDown v-else />
        </el-icon>
      </div>
    </div>

    <!-- 展开体 -->
    <div v-if="expanded" class="q-body">
      <p class="q-content">{{ question.content }}</p>

      <div v-if="question.options && question.options.length" class="q-options">
        <div v-for="(opt, oi) in question.options" :key="oi" class="opt-row" :class="optionClass(opt)">
          <span class="opt-letter">{{ String.fromCharCode(65 + oi) }}</span>
          <span class="opt-text">{{ opt }}</span>
          <el-icon v-if="isOptionCorrect(opt)" class="opt-icon opt-icon-ok"><CircleCheck /></el-icon>
          <el-icon v-else-if="isOptionSelected(opt)" class="opt-icon opt-icon-no"><CircleClose /></el-icon>
        </div>
      </div>

      <template v-if="!auto">
        <div class="student-answer-box">
          <div class="box-title">
            <el-icon class="box-title-icon"><User /></el-icon>学生答案
          </div>
          <p class="answer-text">{{ getAnswerLabel(answer) }}</p>
        </div>
        <!-- 参考答案（试卷类题目） -->
        <div class="ref-answer-box">
          <div class="ref-title">参考答案</div>
          <p class="ref-text">{{ getAnswerLabel(question.answer) }}</p>
          <p v-if="question.analysis" class="ref-analysis">{{ question.analysis }}</p>
        </div>
        <div class="teacher-score-row">
          <span class="teacher-label">教师评分</span>
          <ScoreInput
            :value="localScore"
            :max="question.score || 0"
            :disabled="isGraded"
            @update="onLocalOnly"
            @blur="onScoreBlur"
          />
        </div>
      </template>
      <template v-else>
        <div class="answer-compare">
          <div class="answer-pair">
            <span class="a-label">学生答案：</span>
            <span :class="correct ? 'a-correct' : 'a-wrong'">{{ getAnswerLabel(answer) }}</span>
          </div>
          <div class="answer-pair">
            <span class="a-label">正确答案：</span>
            <span class="a-correct">{{ getAnswerLabel(question.answer) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowDown, ArrowUp, CircleCheck, CircleClose, User } from '@element-plus/icons-vue';
import ScoreInput from './score-input.vue';
import {
  getAnswerLabel,
  getAutoScore,
  isAnswerCorrect,
  isAutoQuestion,
  questionTypeLabel,
  type ExamQuestionShape
} from './grading-utils';

// 客观题/主观题评分卡片（对齐 React exam-grading/QuestionGradingCard）
const props = defineProps<{
  question: ExamQuestionShape;
  index: number;
  answer: unknown;
  score: number;
  isGraded: boolean;
}>();
const emit = defineEmits<{ (e: 'score-change', questionId: string, newScore: number): void }>();

const localScore = ref(String(props.score));
const expanded = ref(!isAutoQuestion(props.question));
const prevScore = ref(props.score);

// 父级外部更新该题分数（自动评分回填等）时同步本地输入框（对齐 React 渲染期派生状态）
watch(
  () => props.score,
  (s) => {
    if (s !== prevScore.value) {
      prevScore.value = s;
      localScore.value = String(s);
    }
  }
);

const auto = computed(() => isAutoQuestion(props.question));
const correct = computed(() => isAnswerCorrect(props.question, props.answer));
const autoScore = computed(() => (auto.value ? getAutoScore(props.question, props.answer) : 0));

function commitIfValid(val: string): boolean {
  const num = parseFloat(val);
  const max = props.question.score || 0;
  if (!Number.isNaN(num) && num >= 0 && num <= max) {
    emit('score-change', props.question.id, num);
    return true;
  }
  return false;
}

// 仅当达到满分（含「一键满分」按钮）时同步提交，其余输入在失焦时提交
function onScoreInput(val: string) {
  localScore.value = val;
  if (val === String(props.question.score || 0)) commitIfValid(val);
}

// 展开体「教师评分」输入只更新本地，失焦统一提交（对齐 React setLocalScore + onBlur）
function onLocalOnly(val: string) {
  localScore.value = val;
}

function onScoreBlur() {
  if (!commitIfValid(localScore.value)) {
    localScore.value = String(props.score);
  }
}

function isOptionCorrect(opt: string): boolean {
  const ans = props.question.answer;
  return Array.isArray(ans) ? ans.includes(opt) : ans === opt;
}

function isOptionSelected(opt: string): boolean {
  const ans = props.answer;
  return Array.isArray(ans) ? (ans as string[]).includes(opt) : ans === opt;
}

function optionClass(opt: string): string {
  if (isOptionCorrect(opt)) return 'opt-correct';
  if (isOptionSelected(opt)) return 'opt-wrong';
  return 'opt-plain';
}
</script>

<style scoped>
.q-card {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.q-subjective {
  border-color: #f3d19e;
}
.q-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.q-header:hover {
  background: #fafafa;
}
.q-subjective .q-header {
  background: rgba(253, 246, 236, 0.5);
}
.q-subjective .q-header:hover {
  background: rgba(253, 246, 236, 0.75);
}
.q-tag-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.q-type-badge {
  font-size: 10px;
  line-height: 20px;
  padding: 0 6px;
  border-radius: 9999px;
  border: 1px solid #dcdfe6;
  color: #606266;
  background: #fff;
  white-space: nowrap;
}
.badge-subjective {
  border-color: #f3d19e;
  color: #b88230;
}
.q-index {
  font-size: 12px;
  color: #c0c4cc;
  white-space: nowrap;
}
.q-content-preview {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.q-score-area {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.auto-score {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}
.auto-max {
  font-size: 12px;
  color: #c0c4cc;
}
.q-chevron {
  color: #c0c4cc;
  cursor: pointer;
  margin-left: 2px;
}
.q-body {
  padding: 12px 16px 16px;
  border-top: 1px solid #f0f2f5;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.q-content {
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
  font-weight: 500;
  margin: 0;
}
.q-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.opt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  font-size: 14px;
  transition: all 0.2s;
}
.opt-correct {
  background: #f0f9eb;
  border-color: #e1f3d8;
  color: #67c23a;
}
.opt-wrong {
  background: #fef0f0;
  border-color: #fde2e2;
  color: #f56c6c;
}
.opt-plain {
  background: rgba(247, 248, 250, 0.6);
  color: #606266;
}
.opt-letter {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  background: #fff;
  color: #909399;
  border: 1px solid #dcdfe6;
}
.opt-correct .opt-letter {
  background: #67c23a;
  color: #fff;
  border-color: #67c23a;
}
.opt-wrong .opt-letter {
  background: #f56c6c;
  color: #fff;
  border-color: #f56c6c;
}
.opt-text {
  flex: 1;
}
.opt-icon {
  flex-shrink: 0;
  font-size: 16px;
}
.opt-icon-ok {
  color: #67c23a;
}
.opt-icon-no {
  color: #f56c6c;
}
.student-answer-box {
  background: rgba(253, 246, 236, 0.5);
  border: 1px solid #faecd8;
  border-radius: 8px;
  padding: 12px;
}
.box-title {
  font-size: 12px;
  font-weight: 500;
  color: #b88230;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}
.box-title-icon {
  font-size: 12px;
}
.answer-text {
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}
.ref-answer-box {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  border-radius: 8px;
  padding: 12px;
}
.ref-title {
  font-size: 12px;
  font-weight: 500;
  color: #67c23a;
  margin-bottom: 6px;
}
.ref-text {
  font-size: 14px;
  color: #67c23a;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}
.ref-analysis {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  margin: 6px 0 0;
  white-space: pre-wrap;
}
.teacher-score-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.teacher-label {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}
.answer-compare {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  background: #f8fafc;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
}
.answer-pair {
  display: flex;
  align-items: center;
  gap: 4px;
}
.a-label {
  color: #909399;
}
.a-correct {
  color: #67c23a;
  font-weight: 500;
}
.a-wrong {
  color: #f56c6c;
  font-weight: 500;
}
.tag-icon {
  margin-right: 2px;
  vertical-align: -2px;
}
</style>

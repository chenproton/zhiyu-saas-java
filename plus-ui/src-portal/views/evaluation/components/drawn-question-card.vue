<template>
  <div class="d-card">
    <div class="d-tags">
      <span class="d-badge badge-plain">第 {{ index + 1 }} 题</span>
      <span v-if="!isSimpleQuestion" class="d-badge">{{ questionTypeLabel(questionType) }}</span>
    </div>
    <p class="d-content">{{ questionContent }}</p>
    <p v-if="question.description" class="d-desc">{{ question.description }}</p>

    <div v-if="question.options && question.options.length" class="d-options">
      <div v-for="(opt, oi) in question.options" :key="oi" class="opt-row" :class="isCorrectOption(opt) ? 'opt-correct' : 'opt-plain'">
        <span class="opt-letter">{{ String.fromCharCode(65 + oi) }}</span>
        <span class="opt-text">{{ opt }}</span>
        <el-icon v-if="isCorrectOption(opt)" class="opt-icon"><CircleCheck /></el-icon>
      </div>
    </div>

    <!-- 参考答案 -->
    <div class="ref-box">
      <div class="ref-title">参考答案</div>
      <p class="ref-text">{{ answerLabel }}</p>
    </div>

    <div class="oral">
      <span class="oral-label">学生口头回答记录（教师现场记录）</span>
      <el-input
        v-model="value"
        type="textarea"
        :rows="3"
        :disabled="isGraded"
        placeholder="请记录学生现场口头回答的要点..."
        resize="none"
        @blur="emit('oral-answer-change', question.id, value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CircleCheck } from '@element-plus/icons-vue';
import { questionTypeLabel } from './grading-utils';

// 现场问答抽题卡片（对齐 React scene-results/[id] DrawnQuestionCard）
export interface DrawnQuestion {
  id: string;
  name?: string;
  content?: string;
  type?: string;
  description?: string;
  options?: string[];
  answer?: string | string[];
}

const props = defineProps<{
  question: DrawnQuestion;
  index: number;
  oralAnswer: string;
  isGraded: boolean;
}>();
const emit = defineEmits<{ (e: 'oral-answer-change', questionId: string, oralAnswer: string): void }>();

const value = ref(props.oralAnswer);

const isSimpleQuestion = computed(() => !props.question.content && !!props.question.name);
const questionContent = computed(() => props.question.content || props.question.name || '');
const questionType = computed(() => props.question.type || 'short_answer');

const answerLabel = computed(() => {
  const q = props.question;
  if (q.type === 'judge' || q.type === 'judgment') {
    return q.answer === 'true' ? '正确' : '错误';
  }
  if (Array.isArray(q.answer)) return q.answer.join('、');
  return q.answer || '-';
});

function isCorrectOption(opt: string): boolean {
  const ans = props.question.answer;
  return Array.isArray(ans) ? ans.includes(opt) : ans === opt;
}
</script>

<style scoped>
.d-card {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.d-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.d-badge {
  font-size: 10px;
  line-height: 20px;
  padding: 0 6px;
  border-radius: 9999px;
  border: 1px solid #dcdfe6;
  color: #606266;
  background: #fff;
  white-space: nowrap;
}
.badge-plain {
  background: #f8fafc;
}
.d-content {
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
  font-weight: 500;
  margin: 0;
}
.d-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  margin: 0;
}
.d-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  font-size: 14px;
}
.opt-correct {
  background: #f0f9eb;
  border-color: #e1f3d8;
  color: #67c23a;
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
.opt-text {
  flex: 1;
}
.opt-icon {
  flex-shrink: 0;
  font-size: 16px;
  color: #67c23a;
}
.ref-box {
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
.oral {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.oral-label {
  font-size: 12px;
  color: #909399;
}
</style>

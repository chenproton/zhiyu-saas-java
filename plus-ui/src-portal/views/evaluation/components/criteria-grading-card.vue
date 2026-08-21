<template>
  <div class="c-card">
    <div class="c-head">
      <div class="c-title-wrap">
        <h4 class="c-name">{{ item.name }}</h4>
        <p v-if="item.description" class="c-desc">{{ item.description }}</p>
        <!-- 评分细则（score_rule 模式的加减分规则） -->
        <p v-if="item.rule" class="c-rule">加减分规则：{{ item.rule }}</p>
      </div>
      <span class="c-weight">{{ item.weight || 0 }} 分</span>
    </div>
    <div class="c-body">
      <div class="c-score-row">
        <span class="c-label">评分</span>
        <ScoreInput
          :value="localScore"
          :max="item.weight || 100"
          :disabled="isGraded"
          @update="onScoreInput"
          @blur="onScoreBlur"
        />
      </div>
      <div class="c-comment">
        <span class="c-label">评语</span>
        <el-input
          v-model="localComment"
          type="textarea"
          :rows="2"
          :disabled="isGraded"
          placeholder="请输入评分说明或改进建议..."
          resize="none"
          @blur="emit('change', item.id, score, localComment)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ScoreInput from './score-input.vue';

// 评价点 / 评分规则项评分卡片（合并对齐 React EvalPointGradingCard 与 ScoreRuleGradingCard，
// 二者结构一致，仅 score_rule 模式多一行「加减分规则」展示，以 item.rule 有无区分）
export interface GradingCriteria {
  id: string;
  name: string;
  description?: string;
  rule?: string;
  weight: number;
}

const props = defineProps<{
  item: GradingCriteria;
  score: number;
  comment: string;
  isGraded: boolean;
}>();
const emit = defineEmits<{ (e: 'change', id: string, score: number, comment: string): void }>();

const localScore = ref(String(props.score));
const localComment = ref(props.comment);

function commitIfValid(val: string, newComment?: string): boolean {
  const num = parseFloat(val);
  // 权重为 0（未配置）时按 100 分上限校验，与输入框 max 保持一致，避免失焦后分数被清空
  const max = props.item.weight || 100;
  const cmt = newComment !== undefined ? newComment : localComment.value;
  if (!Number.isNaN(num) && num >= 0 && num <= max) {
    emit('change', props.item.id, num, cmt);
    return true;
  }
  return false;
}

// 仅当达到满分（含「一键满分」按钮）时同步提交，其余输入在失焦时提交
function onScoreInput(val: string) {
  localScore.value = val;
  if (val === String(props.item.weight || 100)) commitIfValid(val);
}

function onScoreBlur() {
  if (!commitIfValid(localScore.value)) {
    localScore.value = String(props.score);
  }
}
</script>

<style scoped>
.c-card {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.c-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.c-title-wrap {
  flex: 1;
  min-width: 0;
}
.c-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin: 0;
}
.c-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  margin: 4px 0 0;
}
.c-rule {
  font-size: 12px;
  color: #409eff;
  line-height: 1.6;
  background: rgba(64, 158, 255, 0.06);
  border: 1px solid rgba(64, 158, 255, 0.15);
  border-radius: 6px;
  padding: 4px 8px;
  margin: 6px 0 0;
}
.c-weight {
  font-size: 10px;
  line-height: 20px;
  padding: 0 6px;
  border-radius: 9999px;
  border: 1px solid #dcdfe6;
  color: #606266;
  white-space: nowrap;
  flex-shrink: 0;
}
.c-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  padding: 12px;
}
.c-score-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.c-comment {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.c-label {
  font-size: 12px;
  color: #606266;
  font-weight: 500;
  flex-shrink: 0;
}
</style>

<template>
  <div class="eval-rules-editor">
    <!-- 标题区（对齐 React inline 模式头部） -->
    <div class="editor-head">
      <div class="head-icon">
        <el-icon :size="20"><Trophy /></el-icon>
      </div>
      <div>
        <h3 class="head-title">{{ title || '配置评价规则' }}</h3>
        <p class="head-desc">配置各评价方式的测评对象、评价主体、测评资源与评价标准</p>
      </div>
    </div>

    <div class="editor-body">
      <el-empty
        v-if="local.evaluationMethods.length === 0"
        description="尚未配置评价方式，请先在「配置任务测评方式」中选择评价类型"
        :image-size="90"
      />
      <div v-else class="method-stack">
        <!-- 顶部工具条 -->
        <div class="toolbar">
          <el-button plain @click="orderDialogOpen = true">
            <el-icon><Sort /></el-icon> 配置评价顺序
          </el-button>
          <el-button plain @click="weightDialogOpen = true">
            <el-icon><ScaleToOriginal /></el-icon> 配置评价权重
            <span class="weight-pill" :class="methodWeightTotal === 100 ? 'ok' : 'bad'">{{ methodWeightTotal }}%</span>
          </el-button>
        </div>

        <!-- 每个评价方式一张卡片 -->
        <div v-for="methodKey in local.evaluationMethods" :key="methodKey" class="method-card">
          <template v-if="methodOptionOf(methodKey)">
            <div class="method-card-head">
              <div
                class="method-icon"
                :style="{ background: methodOptionOf(methodKey)!.colorBg, color: methodOptionOf(methodKey)!.color }"
              >
                <el-icon :size="18"><component :is="methodOptionOf(methodKey)!.icon" /></el-icon>
              </div>
              <div class="method-text">
                <p class="method-label">{{ methodOptionOf(methodKey)!.label }}</p>
                <p class="method-desc">{{ methodOptionOf(methodKey)!.desc }}</p>
              </div>
            </div>
            <div class="method-card-body">
              <StepCard
                :step="1"
                title="测评对象"
                icon="UserFilled"
                :summary="objectCardOf(methodKey).summary"
                :description="objectCardOf(methodKey).description"
                :configured="objectCardOf(methodKey).configured"
                clickable
                @click="openDialog('object', methodKey)"
              />
              <StepCard
                :step="2"
                title="评价主体"
                icon="Avatar"
                :summary="subjectCardOf(methodKey).summary"
                :description="subjectCardOf(methodKey).description"
                :badge="subjectCardOf(methodKey).badge"
                clickable
                @click="openDialog('subject', methodKey)"
              />
              <StepCard
                :step="3"
                title="测评资源"
                icon="Coin"
                :summary="resourceCardOf(methodKey).summary"
                :description="resourceCardOf(methodKey).description"
                :configured="resourceCardOf(methodKey).configured"
                clickable
                @click="openDialog('resource', methodKey)"
              />
              <StepCard
                v-if="AUTO_SCORE_METHODS.includes(methodKey)"
                :step="4"
                title="评价标准配置"
                icon="Aim"
                summary="自动读取得分"
                description="系统将自动读取测评资源的得分"
                tone="success"
                configured
              />
              <StepCard
                v-else
                :step="4"
                title="评价标准配置"
                icon="Aim"
                :summary="standardCardOf(methodKey).summary"
                :description="standardCardOf(methodKey).description"
                :badge="standardCardOf(methodKey).badge"
                :configured="standardCardOf(methodKey).configured"
                clickable
                @click="openDialog('method', methodKey)"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 评价方式顺序配置 -->
    <el-dialog v-model="orderDialogOpen" title="评价方式顺序配置" width="560px" append-to-body>
      <p class="dialog-desc mb-12">点击箭头调整评价方式的执行顺序</p>
      <div class="order-list">
        <div v-for="(methodKey, index) in local.evaluationMethods" :key="methodKey" class="order-row">
          <template v-if="methodOptionOf(methodKey)">
            <span class="order-no">{{ index + 1 }}</span>
            <div
              class="method-icon small"
              :style="{ background: methodOptionOf(methodKey)!.colorBg, color: methodOptionOf(methodKey)!.color }"
            >
              <el-icon :size="14"><component :is="methodOptionOf(methodKey)!.icon" /></el-icon>
            </div>
            <span class="order-label">{{ methodOptionOf(methodKey)!.label }}</span>
            <div class="order-actions">
              <el-button link size="small" :disabled="index === 0" @click="moveMethodUp(index)">
                <el-icon><ArrowUp /></el-icon>
              </el-button>
              <el-button
                link
                size="small"
                :disabled="index === local.evaluationMethods.length - 1"
                @click="moveMethodDown(index)"
              >
                <el-icon><ArrowDown /></el-icon>
              </el-button>
            </div>
          </template>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="orderDialogOpen = false">完成</el-button>
      </template>
    </el-dialog>

    <!-- 评价方式权重配置 -->
    <el-dialog v-model="weightDialogOpen" title="评价方式权重配置" width="760px" append-to-body>
      <p class="dialog-desc mb-12">配置各评价方式的权重占比，合计需等于 100%</p>
      <div class="weight-head">
        <span class="weight-pill" :class="methodWeightTotal === 100 ? 'ok' : 'bad'">
          合计 {{ methodWeightTotal }}%
          <span v-if="methodWeightTotal !== 100" class="pill-tip">(需等于100%)</span>
        </span>
        <el-button size="small" plain @click="distributeMethodWeights">
          <el-icon><RefreshLeft /></el-icon> 一键平均
        </el-button>
      </div>
      <div class="weight-grid">
        <div v-for="methodKey in local.evaluationMethods" :key="methodKey" class="weight-item">
          <template v-if="methodOptionOf(methodKey)">
            <div
              class="method-icon small"
              :style="{ background: methodOptionOf(methodKey)!.colorBg, color: methodOptionOf(methodKey)!.color }"
            >
              <el-icon :size="14"><component :is="methodOptionOf(methodKey)!.icon" /></el-icon>
            </div>
            <div class="weight-main">
              <p class="weight-label">{{ methodOptionOf(methodKey)!.label }}</p>
              <div class="weight-input-row">
                <el-input-number
                  :min="0"
                  :max="100"
                  :precision="0"
                  size="small"
                  controls-position="right"
                  class="weight-input"
                  :model-value="local.methodWeights[methodKey] || 0"
                  @update:model-value="(v: number | undefined) => updateMethodWeight(methodKey, v || 0)"
                />
                <span class="dim">%</span>
              </div>
            </div>
          </template>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="weightDialogOpen = false">完成</el-button>
      </template>
    </el-dialog>

    <!-- 四个步骤弹窗 -->
    <ObjectDialog
      v-if="erDialogMethod && erDialogOpen === 'object'"
      :model-value="true"
      :method-key="erDialogMethod"
      :config="local"
      @update:model-value="(v: boolean) => !v && closeDialog()"
      @patch="applyPatch"
    />
    <SubjectDialog
      v-if="erDialogMethod && erDialogOpen === 'subject'"
      :model-value="true"
      :method-key="erDialogMethod"
      :config="local"
      @update:model-value="(v: boolean) => !v && closeDialog()"
      @patch="applyPatch"
    />
    <ResourceDialog
      v-if="erDialogMethod && erDialogOpen === 'resource'"
      :model-value="true"
      :method-key="erDialogMethod"
      :config="local"
      @update:model-value="(v: boolean) => !v && closeDialog()"
      @patch="applyPatch"
      @toggle-question="toggleQuestion"
    />
    <StandardDialog
      v-if="erDialogMethod && erDialogOpen === 'method'"
      :model-value="true"
      :method-key="erDialogMethod"
      :config="local"
      :knowledge-points="knowledgePoints || []"
      :ability-points="abilityPoints || []"
      :persist-standard="persistStandard"
      @update:model-value="(v: boolean) => !v && closeDialog()"
      @patch="applyPatch"
      @open-kp="openKpDialog"
      @open-ab="openAbDialog"
    />

    <!-- 知识点 / 能力点关联 -->
    <PointPickerDialog
      v-model="kpDialogOpen"
      kind="kp"
      :pool="knowledgePoints || []"
      :selected-ids="kpSelectedIds"
      @toggle="toggleKnowledgePoint"
    />
    <PointPickerDialog
      v-model="abDialogOpen"
      kind="ab"
      :pool="abilityPoints || []"
      :selected-ids="abSelectedIds"
      @toggle="toggleAbilityPoint"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 任务评价规则编辑器（EvaluationRulesEditor）。
 *
 * 完整复刻原 React 版 `evaluation-rules-editor.tsx`（5029 行）：
 * 评价顺序/权重配置 → 每个评价方式的四步卡片（测评对象 / 评价主体 / 测评资源 / 评价标准配置）
 * → 各步骤弹窗（含现场问答题库、评审流程与评分人、试卷、题库选题、量规与评分规则、模板库、
 * 知识点/能力点绑定），并支持「保存评价标准」立即落库（persistStandard）。
 *
 * 受控组件：props.value 为 EvalRuleConfig，任何修改都通过 emit('change', clone(local)) 上抛，
 * 与门户现有 EvalMethodConfig / 各 selector 组件保持一致的受控约定。
 */
import { computed, ref, watch } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  RefreshLeft,
  ScaleToOriginal,
  Sort,
  Trophy
} from '@element-plus/icons-vue';
import {
  DEFAULT_EVAL_RULE_SUBJECTS,
  buildDefaultReviewSteps,
  clone,
  makeDefaultEvalRuleConfig,
  type AbilityPointItem,
  type EvalRuleConfig,
  type EvalRuleMethodKey,
  type EvalRulePoint,
  type EvalRuleScoreRule,
  type KnowledgePointItem
} from '@/views/lesson/lesson-edit-utils';
import StepCard from './StepCard.vue';
import ObjectDialog from './ObjectDialog.vue';
import SubjectDialog from './SubjectDialog.vue';
import ResourceDialog from './ResourceDialog.vue';
import StandardDialog from './StandardDialog.vue';
import PointPickerDialog from './PointPickerDialog.vue';
import {
  AUTO_SCORE_METHODS,
  EVAL_POINT_FIELD_BY_METHOD,
  EVAL_SUB_TYPE_LABELS,
  SUBJECT_LABELS,
  methodOptionOf,
  scoreRulesFieldOf,
  standardModeFieldOf,
  standardNameFieldOf,
  type EvalPointField
} from './types';

const props = defineProps<{
  /** 评价规则配置（受控） */
  value?: EvalRuleConfig;
  /** 任务已启用的评价方式（与 value.evaluationMethods 同源，用于同步方法增删） */
  evaluationMethods?: string[];
  knowledgePoints?: KnowledgePointItem[];
  abilityPoints?: AbilityPointItem[];
  title?: string;
  /** 评价标准表单「保存」回调：把当前方法的评价标准立即关联到任务（走 evaluation-methods 落库） */
  persistStandard?: (methodKey: string, config: EvalRuleConfig) => Promise<void> | void;
}>();

const emit = defineEmits<{ (e: 'change', config: EvalRuleConfig): void }>();

/* ============ 本地受控状态 ============ */

const local = ref<EvalRuleConfig>(makeDefaultEvalRuleConfig([]));

watch(
  () => props.value,
  (v) => {
    if (!v) return;
    const methods = (v.evaluationMethods || []).map((m) =>
      (m as string) === 'exam' ? 'homework' : (m as EvalRuleMethodKey)
    );
    const base = makeDefaultEvalRuleConfig(methods);
    local.value = { ...base, ...clone(v), evaluationMethods: methods };
    // 默认评审步骤需要写入 config.reviewSteps，否则保存时不会随 change 持久化（对齐 React 同名逻辑）
    if (!local.value.reviewSteps || local.value.reviewSteps.length === 0) {
      local.value.reviewSteps = buildDefaultReviewSteps().map((rs, i) => ({ ...rs, sortOrder: i }));
      emitChange();
    }
  },
  { immediate: true, deep: true }
);

function emitChange() {
  emit('change', clone(local.value));
}

function applyPatch(patch: Partial<EvalRuleConfig>) {
  local.value = { ...local.value, ...patch };
  emitChange();
}

/* ============ 弹窗开关 ============ */

const erDialogOpen = ref<'object' | 'subject' | 'resource' | 'method' | null>(null);
const erDialogMethod = ref<string | null>(null);
const orderDialogOpen = ref(false);
const weightDialogOpen = ref(false);

function openDialog(type: 'object' | 'subject' | 'resource' | 'method', methodKey: string) {
  erDialogMethod.value = methodKey;
  erDialogOpen.value = type;
}

function closeDialog() {
  erDialogOpen.value = null;
}

/* ============ 方法顺序与权重 ============ */

const methodWeightTotal = computed(() =>
  local.value.evaluationMethods.reduce((sum, m) => sum + (local.value.methodWeights[m] || 0), 0)
);

function updateMethodWeight(methodKey: string, value: number) {
  applyPatch({
    methodWeights: {
      ...local.value.methodWeights,
      [methodKey]: Math.max(0, Math.min(100, value))
    }
  });
}

function distributeMethodWeights() {
  const count = local.value.evaluationMethods.length;
  if (count === 0) return;
  const base = Math.floor(100 / count);
  const remainder = 100 % count;
  const weights: Record<string, number> = {};
  local.value.evaluationMethods.forEach((m, i) => {
    weights[m] = base + (i < remainder ? 1 : 0);
  });
  applyPatch({ methodWeights: weights });
}

function moveMethodUp(index: number) {
  if (index <= 0) return;
  const methods = [...local.value.evaluationMethods];
  [methods[index - 1], methods[index]] = [methods[index], methods[index - 1]];
  applyPatch({ evaluationMethods: methods });
}

function moveMethodDown(index: number) {
  if (index >= local.value.evaluationMethods.length - 1) return;
  const methods = [...local.value.evaluationMethods];
  [methods[index + 1], methods[index]] = [methods[index], methods[index + 1]];
  applyPatch({ evaluationMethods: methods });
}

/* ============ 四步卡片摘要 ============ */

function objectCardOf(methodKey: string) {
  const current = local.value.methodEvalObjects[methodKey] || local.value.evalObject;
  const labels: Record<string, string> = { individual: '个人', group: '小组' };
  const descs: Record<string, string> = { individual: '以个人为单位', group: '以小组为单位' };
  return {
    summary: labels[current] || '未选择',
    description: descs[current] || '点击配置',
    configured: !!labels[current]
  };
}

/** 评价主体取值：methodEvalSubjects 空数组视为未配置，逐级回退到全局默认主体 */
function methodSubjectsOf(methodKey: string) {
  const ms = local.value.methodEvalSubjects[methodKey];
  if (ms && ms.length > 0) return ms;
  return local.value.evalSubjects && local.value.evalSubjects.length > 0
    ? local.value.evalSubjects
    : DEFAULT_EVAL_RULE_SUBJECTS;
}

function subjectCardOf(methodKey: string) {
  const enabled = methodSubjectsOf(methodKey).filter((s) => s.enabled);
  const totalWeight = enabled.reduce((sum, s) => sum + (s.params?.weightPercent || 0), 0);
  return {
    summary: enabled.length === 0 ? '未配置' : enabled.map((s) => SUBJECT_LABELS[s.type] || s.type).join('、'),
    description: enabled.length === 0 ? '点击配置' : `总权重 ${totalWeight}%`,
    badge: enabled.length > 0 ? `${enabled.length} 类` : undefined
  };
}

function hasResourceContent(methodKey: string): boolean {
  const res = (local.value.methodResourceConfigs || {})[methodKey];
  return !!res && typeof res === 'object' && Object.keys(res).length > 0;
}

function resourceCardOf(methodKey: string) {
  const configured = (() => {
    switch (methodKey) {
      case 'random_draw':
        return local.value.randomDrawSelectedIds.length > 0;
      case 'review':
        return (
          local.value.reviewEvalPoints.length > 0 ||
          !!local.value.reviewRubricId ||
          (local.value.reviewScoreRules?.length || 0) > 0 ||
          hasResourceContent('review')
        );
      case 'paper':
        return local.value.paperIds.length > 0;
      case 'question_bank':
        return local.value.questionBankQuestions.length > 0;
      case 'outcome':
        return (
          local.value.outcomeEvalPoints.length > 0 ||
          !!local.value.outcomeRubricId ||
          (local.value.outcomeScoreRules?.length || 0) > 0 ||
          hasResourceContent('outcome')
        );
      case 'homework':
        return (
          local.value.homeworkEvalPoints.length > 0 ||
          !!local.value.homeworkRubricId ||
          (local.value.homeworkScoreRules?.length || 0) > 0 ||
          hasResourceContent('homework')
        );
      case 'quiz':
        return local.value.quizQuestions.length > 0;
      default:
        return false;
    }
  })();
  return {
    summary: configured ? '已配置' : '未配置',
    description: configured ? '点击修改测评资源' : '点击配置测评资源',
    configured
  };
}

function evalPointsOf(methodKey: string): EvalRulePoint[] {
  const field = EVAL_POINT_FIELD_BY_METHOD[methodKey];
  return field ? ((local.value as any)[field] as EvalRulePoint[]) || [] : [];
}

function standardCardOf(methodKey: string) {
  const standardMode = (local.value as any)[standardModeFieldOf(methodKey)] as
    | 'rubric'
    | 'score_rule'
    | undefined;
  const standardName = (local.value as any)[standardNameFieldOf(methodKey)] as string | undefined;
  const scoreRules = ((local.value as any)[scoreRulesFieldOf(methodKey)] as EvalRuleScoreRule[]) || [];
  const points = evalPointsOf(methodKey);

  if (standardMode === 'score_rule') {
    return {
      summary: scoreRules.length === 0 ? '未配置评分项' : `${scoreRules.length} 个评分项`,
      description: standardName ? `${standardName} · 评分规则` : '评分规则',
      badge: scoreRules.length > 0 ? `${scoreRules.length} 项` : undefined,
      configured: scoreRules.length > 0
    };
  }

  const subTypeCounts: Record<string, number> = {};
  points.forEach((p) => {
    if (p.subType) subTypeCounts[p.subType] = (subTypeCounts[p.subType] || 0) + 1;
  });
  const subTypeSummary = Object.entries(subTypeCounts).map(
    ([k, v]) => `${EVAL_SUB_TYPE_LABELS[k] || k}${v}`
  );
  return {
    summary: points.length === 0 ? '未配置评价点' : `${points.length} 个评价点`,
    description: standardName
      ? standardName
      : subTypeSummary.length === 0
        ? '点击配置评价标准'
        : subTypeSummary.join(' · '),
    badge: points.length > 0 ? `${points.length} 点` : undefined,
    configured: points.length > 0
  };
}

/* ============ 题库/随堂测题目勾选 ============ */

function toggleQuestion(field: 'questionBankQuestions' | 'quizQuestions', qid: string) {
  const arr = field === 'quizQuestions' ? local.value.quizQuestions : local.value.questionBankQuestions;
  const next = arr.includes(qid) ? arr.filter((x) => x !== qid) : [...arr, qid];
  applyPatch({ [field]: next } as unknown as Partial<EvalRuleConfig>);
}

/* ============ 知识点 / 能力点绑定 ============ */

const kpDialogOpen = ref(false);
const abDialogOpen = ref(false);
const pickerPointId = ref<string | null>(null);
const pickerField = ref<EvalPointField | null>(null);

function openKpDialog(pointId: string, field: EvalPointField) {
  pickerPointId.value = pointId;
  pickerField.value = field;
  kpDialogOpen.value = true;
}

function openAbDialog(pointId: string, field: EvalPointField) {
  pickerPointId.value = pointId;
  pickerField.value = field;
  abDialogOpen.value = true;
}

const pickerPoint = computed<EvalRulePoint | null>(() => {
  if (!pickerField.value || !pickerPointId.value) return null;
  const points = ((local.value as any)[pickerField.value] as EvalRulePoint[]) || [];
  return points.find((p) => p.id === pickerPointId.value) || null;
});

const kpSelectedIds = computed(() => pickerPoint.value?.knowledgePointIds || []);
const abSelectedIds = computed(() => pickerPoint.value?.abilityPointIds || []);

function updatePickerPoint(updates: Partial<EvalRulePoint>) {
  const field = pickerField.value;
  const pointId = pickerPointId.value;
  if (!field || !pointId) return;
  const points = ((local.value as any)[field] as EvalRulePoint[]) || [];
  applyPatch({
    [field]: points.map((p) => (p.id === pointId ? { ...p, ...updates } : p))
  } as unknown as Partial<EvalRuleConfig>);
}

function toggleKnowledgePoint(id: string) {
  const ids = kpSelectedIds.value;
  updatePickerPoint({
    knowledgePointIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
  });
}

function toggleAbilityPoint(id: string) {
  const ids = abSelectedIds.value;
  updatePickerPoint({
    abilityPointIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
  });
}
</script>

<style scoped>
.eval-rules-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.head-icon {
  padding: 6px;
  border-radius: 6px;
  background: #ecf5ff;
  color: #409eff;
  display: flex;
}
.head-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.head-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: #909399;
}
.editor-body {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 16px;
  background: #fff;
}
.method-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.weight-pill {
  margin-left: 6px;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 500;
}
.weight-pill.ok {
  background: #f0f9eb;
  color: #67c23a;
}
.weight-pill.bad {
  background: #fef0f0;
  color: #f56c6c;
}
.pill-tip {
  font-size: 10px;
  margin-left: 2px;
}
.method-card {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.method-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  background: #fafafa;
}
.method-icon {
  padding: 6px;
  border-radius: 6px;
  display: flex;
}
.method-icon.small {
  padding: 5px;
}
.method-text {
  min-width: 0;
}
.method-label {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.method-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: #a8abb2;
}
.method-card-body {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.dialog-desc {
  margin: 0;
  font-size: 12px;
  color: #909399;
}
.mb-12 {
  margin-bottom: 12px;
}
.order-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.order-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid #f2f6fc;
  border-radius: 8px;
  background: #fafafa;
}
.order-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e4e7ed;
  color: #909399;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}
.order-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}
.order-actions {
  display: flex;
  gap: 2px;
}
.weight-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.weight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.weight-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid #f2f6fc;
  border-radius: 8px;
  background: #fafafa;
}
.weight-main {
  min-width: 0;
  flex: 1;
}
.weight-label {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.weight-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}
.weight-input {
  width: 92px;
}
.dim {
  font-size: 12px;
  color: #909399;
}
@media (max-width: 1280px) {
  .method-card-body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .weight-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

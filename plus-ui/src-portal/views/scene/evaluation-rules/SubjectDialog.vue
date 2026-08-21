<template>
  <el-dialog
    :model-value="modelValue"
    width="960px"
    top="6vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <template #header>
      <div class="dialog-header">
        <p class="dialog-title">评价主体配置</p>
        <p class="dialog-desc">配置 {{ methodLabel }} 的评价主体</p>
      </div>
    </template>

    <div class="toolbar">
      <p class="hint">配置参与评价的主体及其参数</p>
      <el-button size="small" plain @click="distributeWeights">
        <el-icon><ScaleToOriginal /></el-icon> 一键平均权重
      </el-button>
    </div>

    <div class="subject-grid">
      <div
        v-for="subject in displaySubjects"
        :key="subject.type"
        class="subject-card"
        :class="{ enabled: subject.enabled }"
      >
        <div class="subject-head">
          <div class="subject-left">
            <el-switch
              :model-value="subject.enabled"
              @update:model-value="(v: boolean) => updateSubject(subject.type, { enabled: v })"
            />
            <span class="subject-label">{{ subjectLabel(subject.type) }}</span>
          </div>
          <el-tag
            v-if="subject.enabled && subject.params?.weightPercent !== undefined"
            size="small"
            type="info"
            disable-transitions
          >
            权重 {{ subject.params.weightPercent }}%
          </el-tag>
        </div>

        <div v-if="subject.enabled" class="subject-body">
          <!-- 教师 -->
          <template v-if="subject.type === 'teacher'">
            <div class="field-grid">
              <div class="field">
                <p class="field-label">专业背景要求</p>
                <el-input
                  size="small"
                  :model-value="subject.params?.teacherBackground || ''"
                  placeholder="计算机/软件工程相关专业"
                  @update:model-value="(v: string) => updateParams(subject.type, { teacherBackground: v })"
                />
              </div>
              <div class="field">
                <p class="field-label">评分人数</p>
                <el-input-number
                  size="small"
                  :min="1"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.scorerCount || 1"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { scorerCount: Math.max(1, v || 1) })"
                />
                <div v-if="(subject.params?.scorerCount || 1) > 1" class="sub-field">
                  <p class="field-label">统计规则</p>
                  <el-select
                    size="small"
                    :model-value="subject.params?.aggregationRule || 'average'"
                    placeholder="选择统计规则"
                    @update:model-value="(v: string) => updateParams(subject.type, { aggregationRule: v })"
                  >
                    <el-option v-for="r in aggregationRules" :key="r.value" :label="r.label" :value="r.value" />
                  </el-select>
                </div>
              </div>
              <div class="field">
                <p class="field-label">评分权重 (%)</p>
                <el-input-number
                  size="small"
                  :min="0"
                  :max="100"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.weightPercent || 0"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { weightPercent: clampPercent(v) })"
                />
              </div>
              <div class="field">
                <p class="field-label">最低教龄 (年)</p>
                <el-input-number
                  size="small"
                  :min="0"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.minTeachingYears || 0"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { minTeachingYears: Math.max(0, v || 0) })"
                />
              </div>
            </div>
          </template>

          <!-- 企业导师 -->
          <template v-else-if="subject.type === 'enterprise_mentor'">
            <div class="field-grid">
              <div class="field">
                <p class="field-label">专业领域</p>
                <el-input
                  size="small"
                  :model-value="subject.params?.expertise || ''"
                  placeholder="网络安全 / 渗透测试"
                  @update:model-value="(v: string) => updateParams(subject.type, { expertise: v })"
                />
              </div>
              <div class="field">
                <p class="field-label">工作年限要求 (年)</p>
                <el-input-number
                  size="small"
                  :min="0"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.minYears || 0"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { minYears: Math.max(0, v || 0) })"
                />
              </div>
              <div class="field">
                <p class="field-label">评分人数</p>
                <el-input-number
                  size="small"
                  :min="1"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.scorerCount || 1"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { scorerCount: Math.max(1, v || 1) })"
                />
                <div v-if="(subject.params?.scorerCount || 1) > 1" class="sub-field">
                  <p class="field-label">统计规则</p>
                  <el-select
                    size="small"
                    :model-value="subject.params?.aggregationRule || 'average'"
                    placeholder="选择统计规则"
                    @update:model-value="(v: string) => updateParams(subject.type, { aggregationRule: v })"
                  >
                    <el-option v-for="r in aggregationRules" :key="r.value" :label="r.label" :value="r.value" />
                  </el-select>
                </div>
              </div>
              <div class="field">
                <p class="field-label">评分权重 (%)</p>
                <el-input-number
                  size="small"
                  :min="0"
                  :max="100"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.weightPercent || 0"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { weightPercent: clampPercent(v) })"
                />
              </div>
            </div>
            <div class="field">
              <p class="field-label">岗位工作经历</p>
              <el-input
                size="small"
                :model-value="subject.params?.jobExperience || ''"
                placeholder="请填写岗位工作经历要求"
                @update:model-value="(v: string) => updateParams(subject.type, { jobExperience: v })"
              />
            </div>
          </template>

          <!-- 互评 -->
          <template v-else-if="subject.type === 'peer'">
            <div class="field-grid">
              <div class="field">
                <p class="field-label">互评人数</p>
                <el-input-number
                  size="small"
                  :min="1"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.peerCount || 3"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { peerCount: Math.max(1, v || 1) })"
                />
                <div v-if="(subject.params?.peerCount || 3) > 1" class="sub-field">
                  <p class="field-label">统计规则</p>
                  <el-select
                    size="small"
                    :model-value="subject.params?.aggregationRule || 'average'"
                    placeholder="选择统计规则"
                    @update:model-value="(v: string) => updateParams(subject.type, { aggregationRule: v })"
                  >
                    <el-option v-for="r in aggregationRules" :key="r.value" :label="r.label" :value="r.value" />
                  </el-select>
                </div>
              </div>
              <div class="field">
                <p class="field-label">评分权重 (%)</p>
                <el-input-number
                  size="small"
                  :min="0"
                  :max="100"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.weightPercent || 0"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { weightPercent: clampPercent(v) })"
                />
              </div>
            </div>
            <div class="field-grid">
              <div class="field">
                <p class="field-label">互评规则</p>
                <el-select
                  size="small"
                  :model-value="subject.params?.peerRule || ''"
                  placeholder="选择互评规则"
                  @update:model-value="(v: string) => updateParams(subject.type, { peerRule: v })"
                >
                  <el-option v-for="r in peerRules" :key="r.value" :label="r.label" :value="r.value" />
                </el-select>
              </div>
              <div class="field switch-field">
                <el-switch
                  :model-value="subject.params?.anonymous || false"
                  @update:model-value="(v: boolean) => updateParams(subject.type, { anonymous: v })"
                />
                <span class="switch-text">匿名评价</span>
              </div>
            </div>
          </template>

          <!-- 自评 -->
          <template v-else-if="subject.type === 'self'">
            <div class="field-grid">
              <div class="field">
                <p class="field-label">评分权重 (%)</p>
                <el-input-number
                  size="small"
                  :min="0"
                  :max="100"
                  :precision="0"
                  controls-position="right"
                  :model-value="subject.params?.weightPercent || 0"
                  @update:model-value="(v: number | undefined) => updateParams(subject.type, { weightPercent: clampPercent(v) })"
                />
              </div>
              <div class="field switch-field">
                <el-switch
                  :model-value="subject.params?.requiresReflection || false"
                  @update:model-value="(v: boolean) => updateParams(subject.type, { requiresReflection: v })"
                />
                <span class="switch-text">需要提交反思报告</span>
              </div>
            </div>
            <div v-if="subject.params?.requiresReflection" class="field">
              <p class="field-label">反思报告最少字数</p>
              <el-input-number
                size="small"
                :min="100"
                :precision="0"
                controls-position="right"
                :model-value="subject.params?.reflectionMinLength || 300"
                @update:model-value="(v: number | undefined) => updateParams(subject.type, { reflectionMinLength: Math.max(100, v || 100) })"
              />
            </div>
          </template>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 评价主体配置弹窗：对齐 React renderSubjectDialogContent。
 * 展示 teacher / enterprise_mentor / self / peer 四类主体，逐类参数与「一键平均权重」完全一致。
 * 取值回退链：methodEvalSubjects[method]（非空）→ config.evalSubjects（非空）→ DEFAULT_EVAL_RULE_SUBJECTS。
 */
import { computed } from 'vue';
import { ScaleToOriginal } from '@element-plus/icons-vue';
import {
  DEFAULT_EVAL_RULE_SUBJECTS,
  type EvalRuleConfig,
  type EvalRuleSubjectConfig
} from '@/views/lesson/lesson-edit-utils';
import { SUBJECT_DISPLAY_TYPES, SUBJECT_LABELS, methodLabelOf } from './types';

const props = defineProps<{
  modelValue: boolean;
  methodKey: string;
  config: EvalRuleConfig;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'patch', patch: Partial<EvalRuleConfig>): void;
}>();

const aggregationRules = [
  { value: 'average', label: '平均值' },
  { value: 'median', label: '中位数' },
  { value: 'max', label: '最高分' },
  { value: 'min', label: '最低分' }
];

const peerRules = [
  { value: 'random', label: '随机分配' },
  { value: 'adjacent', label: '相邻座位' },
  { value: 'free', label: '自由组合' },
  { value: 'grouped', label: '指定分组' }
];

const methodLabel = computed(() => methodLabelOf(props.methodKey));

const currentSubjects = computed<EvalRuleSubjectConfig[]>(() => {
  const ms = props.config.methodEvalSubjects[props.methodKey];
  if (ms && ms.length > 0) return ms;
  return props.config.evalSubjects && props.config.evalSubjects.length > 0
    ? props.config.evalSubjects
    : DEFAULT_EVAL_RULE_SUBJECTS;
});

const displaySubjects = computed(() =>
  currentSubjects.value.filter((s) => (SUBJECT_DISPLAY_TYPES as readonly string[]).includes(s.type))
);

function subjectLabel(type: string): string {
  return SUBJECT_LABELS[type] || type;
}

function clampPercent(v: number | undefined): number {
  return Math.max(0, Math.min(100, v || 0));
}

function updateSubject(type: string, updates: Partial<EvalRuleSubjectConfig>) {
  const next = currentSubjects.value.map((s) => (s.type === type ? { ...s, ...updates } : s));
  emit('patch', { methodEvalSubjects: { ...props.config.methodEvalSubjects, [props.methodKey]: next } });
}

function updateParams(type: string, params: Record<string, any>) {
  const target = currentSubjects.value.find((s) => s.type === type);
  updateSubject(type, { params: { ...(target?.params || {}), ...params } });
}

function distributeWeights() {
  const enabled = currentSubjects.value.filter(
    (s) => s.enabled && (SUBJECT_DISPLAY_TYPES as readonly string[]).includes(s.type)
  );
  const count = enabled.length;
  if (count === 0) return;
  const base = Math.floor(100 / count);
  const remainder = 100 % count;
  const idxMap = new Map(enabled.map((s, i) => [s.type, i]));
  const next = currentSubjects.value.map((s) => {
    if (!s.enabled || !(SUBJECT_DISPLAY_TYPES as readonly string[]).includes(s.type)) return s;
    const idx = idxMap.get(s.type) ?? 0;
    return { ...s, params: { ...s.params, weightPercent: base + (idx < remainder ? 1 : 0) } };
  });
  emit('patch', { methodEvalSubjects: { ...props.config.methodEvalSubjects, [props.methodKey]: next } });
}
</script>

<style scoped>
.dialog-header .dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.dialog-header .dialog-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.hint {
  margin: 0;
  font-size: 13px;
  color: #909399;
}
.subject-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.subject-card {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}
.subject-card.enabled {
  border-color: #409eff;
  background: #f9fcff;
}
.subject-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.subject-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.subject-label {
  font-size: 13px;
  font-weight: 500;
}
.subject-body {
  padding-left: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.field-label {
  margin: 0 0 3px;
  font-size: 11px;
  color: #909399;
}
.sub-field {
  margin-top: 6px;
}
.switch-field {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding-bottom: 4px;
}
.switch-text {
  font-size: 11px;
  color: #606266;
}
</style>

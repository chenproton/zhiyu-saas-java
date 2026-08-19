<template>
  <el-dialog
    :model-value="modelValue"
    width="1240px"
    top="4vh"
    append-to-body
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <template #header>
      <div class="dialog-header">
        <p class="dialog-title">评价标准配置</p>
        <p class="dialog-desc">配置 {{ methodLabel }} 的评价点与评分规则</p>
      </div>
    </template>

    <!-- ============ 编辑视图 ============ -->
    <div v-if="view === 'edit'" class="panel">
      <div class="top-actions">
        <el-button size="small" plain @click="view = 'template'">
          <el-icon><Files /></el-icon> 从模板库选择
        </el-button>
        <el-button size="small" link class="danger" @click="clearStandard">
          <el-icon><Delete /></el-icon> 清除评价标准
        </el-button>
      </div>

      <div class="box gray">
        <p class="box-title">评价标准信息</p>
        <div class="field">
          <p class="field-label">评价标准名称</p>
          <el-input v-model="stdDraft.name" placeholder="输入评价标准名称" />
        </div>
        <div class="field">
          <p class="field-label">评价标准类型</p>
          <div class="mode-row">
            <button
              type="button"
              class="mode-btn"
              :class="{ active: stdDraft.mode === 'rubric' }"
              @click="stdDraft.mode = 'rubric'"
            >
              <span class="radio" :class="{ on: stdDraft.mode === 'rubric' }"><i v-if="stdDraft.mode === 'rubric'" /></span>
              评价量规
            </button>
            <button
              type="button"
              class="mode-btn"
              :class="{ active: stdDraft.mode === 'score_rule' }"
              @click="switchToScoreRule"
            >
              <span class="radio" :class="{ on: stdDraft.mode === 'score_rule' }"><i v-if="stdDraft.mode === 'score_rule'" /></span>
              评分规则
            </button>
          </div>
        </div>
      </div>

      <!-- 评价量规配置表 -->
      <div v-if="stdDraft.mode === 'rubric'" class="box">
        <div class="box-head">
          <p class="box-title">评价量规配置表</p>
          <div class="box-head-actions">
            <el-button size="small" plain @click="distributePointWeights">
              <el-icon><RefreshLeft /></el-icon> 一键均分
            </el-button>
            <el-button size="small" plain @click="addPoint">
              <el-icon><Plus /></el-icon> 添加评价维度
            </el-button>
          </div>
        </div>

        <el-table v-if="evalPoints.length > 0" :data="evalPoints" size="small" class="rubric-table">
          <el-table-column label="序号" width="60">
            <template #default="{ $index }"><span class="dim">{{ $index + 1 }}</span></template>
          </el-table-column>
          <el-table-column label="评价维度名称/关联知识点/能力点" min-width="300">
            <template #default="{ row }">
              <MixedTagEditor
                :text="row.name"
                :knowledge-point-ids="row.knowledgePointIds || []"
                :ability-point-ids="row.abilityPointIds || []"
                :knowledge-points="knowledgePoints"
                :ability-points="abilityPoints"
                @change="(updates) => updatePoint(row.id, updates)"
                @open-kp="emit('open-kp', row.id, evalPointField)"
                @open-ab="emit('open-ab', row.id, evalPointField)"
              />
            </template>
          </el-table-column>
          <el-table-column label="评价等级" min-width="240">
            <template #default="{ row }">
              <button type="button" class="grade-btn" @click="openGradeDialog(row.id)">
                <template v-if="row.gradeMapping && row.gradeMapping.length">
                  <span v-for="gm in row.gradeMapping" :key="gm.id" class="grade-line" :title="gradeText(gm)">
                    {{ gradeText(gm) }}
                  </span>
                </template>
                <span v-else>点击配置评价等级</span>
              </button>
            </template>
          </el-table-column>
          <el-table-column label="权重(%)" width="110" align="center">
            <template #default="{ row }">
              <el-input-number
                :min="0"
                :max="100"
                :precision="0"
                size="small"
                controls-position="right"
                class="num-input"
                :model-value="row.weight || 0"
                @update:model-value="(v: number | undefined) => updatePoint(row.id, { weight: Math.max(0, Math.min(100, v || 0)) })"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center">
            <template #default="{ row }">
              <el-button link size="small" class="danger" @click="removePoint(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <button type="button" class="add-row" @click="addPoint">
          <el-icon><Plus /></el-icon> 添加评价维度
        </button>
        <div v-if="evalPoints.length > 0" class="total-row">
          <span class="dim">维度权重合计：</span>
          <span :class="pointWeightTotal === 100 ? 'ok' : 'bad'">{{ pointWeightTotal }}%</span>
          <span v-if="pointWeightTotal !== 100" class="bad">⚠️（需等于100%）</span>
        </div>
        <el-empty v-if="evalPoints.length === 0" description="尚未添加评价点，点击上方按钮添加第一个评价点" :image-size="60" />
      </div>

      <!-- 评分规则配置表 -->
      <div v-else class="box">
        <div class="box-head">
          <p class="box-title">评分规则配置表</p>
          <div class="box-head-actions">
            <el-button size="small" plain @click="distributeRuleWeights">
              <el-icon><RefreshLeft /></el-icon> 一键均分
            </el-button>
            <el-button size="small" plain @click="addScoreRule">
              <el-icon><Plus /></el-icon> 添加评价项
            </el-button>
          </div>
        </div>

        <el-table v-if="scoreRules.length > 0" :data="scoreRules" size="small">
          <el-table-column label="序号" width="60">
            <template #default="{ $index }"><span class="dim">{{ $index + 1 }}</span></template>
          </el-table-column>
          <el-table-column label="评价项/评分标准描述" min-width="240">
            <template #default="{ row }">
              <el-input
                type="textarea"
                :rows="2"
                placeholder="请输入评分描述"
                :model-value="row.name + (row.desc ? `\n${row.desc}` : '')"
                @update:model-value="(v: string) => updateRuleText(row.id, v)"
              />
            </template>
          </el-table-column>
          <el-table-column label="加减分规则" min-width="180">
            <template #default="{ row }">
              <el-input
                type="textarea"
                :rows="2"
                placeholder="输入加减分规则"
                :model-value="row.rule || ''"
                @update:model-value="(v: string) => updateScoreRule(row.id, { rule: v })"
              />
            </template>
          </el-table-column>
          <el-table-column label="分值" width="110" align="center">
            <template #default="{ row }">
              <el-input-number
                :min="0"
                :max="100"
                :precision="0"
                size="small"
                controls-position="right"
                class="num-input"
                :model-value="row.weight || 0"
                @update:model-value="(v: number | undefined) => updateScoreRule(row.id, { weight: Math.max(0, Math.min(100, v || 0)) })"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center">
            <template #default="{ row }">
              <el-button link size="small" class="danger" @click="removeScoreRule(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <button type="button" class="add-row" @click="addScoreRule">
          <el-icon><Plus /></el-icon> 添加评价项
        </button>
        <div v-if="scoreRules.length > 0" class="total-row">
          <span class="dim">分值合计：</span>
          <span :class="ruleWeightTotal === 100 ? 'ok' : 'bad'">{{ ruleWeightTotal }}%</span>
          <span v-if="ruleWeightTotal !== 100" class="bad">⚠️（需等于100%）</span>
        </div>
        <el-empty v-if="scoreRules.length === 0" description="尚未添加评价项，点击上方按钮添加第一个评价项" :image-size="60" />
      </div>

      <div class="save-actions">
        <el-button size="small" type="primary" :loading="isSavingStandard" @click="handleSaveStandard">
          {{ isSavingStandard ? '保存中…' : '保存' }}
        </el-button>
        <el-button size="small" plain @click="openSaveTemplate">保存到模板</el-button>
      </div>
    </div>

    <!-- ============ 模板库视图 ============ -->
    <div v-else class="panel">
      <div>
        <el-button size="small" link @click="view = 'edit'">
          <el-icon><ArrowLeft /></el-icon> 返回评价标准编辑
        </el-button>
      </div>
      <p class="box-title">选择评价标准模板进行覆盖</p>
      <el-empty v-if="rubricLibrary.length === 0" description="暂无评价标准模板" :image-size="60" />
      <div v-else class="template-list">
        <div v-for="scheme in rubricLibrary" :key="scheme.id" class="template-card" @click="applyScheme(scheme.id)">
          <div class="template-main">
            <div class="template-head">
              <p class="template-name">{{ scheme.name }}</p>
              <el-tag size="small" :type="scheme.mode === 'rubric' ? 'primary' : 'info'" disable-transitions>
                {{ scheme.mode === 'rubric' ? '评价量规' : '评分规则' }}
              </el-tag>
            </div>
            <p class="template-desc">{{ scheme.desc || '暂无描述' }}</p>
            <div class="template-tags">
              <el-tag
                v-for="type in scheme.types"
                :key="type"
                size="small"
                disable-transitions
                :color="subTypeColor(type)"
                style="color: #fff; border: none"
              >
                {{ subTypeLabel(type) }}
              </el-tag>
            </div>
            <p class="template-count">
              {{ scheme.mode === 'rubric' ? `${scheme.points.length} 个评价点` : `${scheme.scoreRuleItems?.length || 0} 个评价项` }}
            </p>
          </div>
          <el-button size="small" type="primary" @click.stop="applyScheme(scheme.id)">使用此模板</el-button>
        </div>
      </div>
    </div>

    <!-- 编辑评分等级 -->
    <el-dialog v-model="gradeDialogOpen" title="编辑评分等级" width="560px" append-to-body destroy-on-close>
      <template v-if="gradePoint">
        <div v-for="g in gradePoint.gradeMapping || []" :key="g.id" class="grade-item">
          <div class="grade-fields">
            <div class="grade-line-row">
              <el-input
                size="small"
                class="grade-input"
                placeholder="等级"
                :model-value="g.grade"
                @update:model-value="(v: string) => updateGrade(g.id, { grade: v })"
              />
              <el-input-number
                size="small"
                :min="0"
                :max="100"
                :precision="0"
                controls-position="right"
                class="score-input"
                :model-value="g.minScore"
                @update:model-value="(v: number | undefined) => updateGrade(g.id, { minScore: v || 0 })"
              />
              <span class="dim">-</span>
              <el-input-number
                size="small"
                :min="0"
                :max="100"
                :precision="0"
                controls-position="right"
                class="score-input"
                :model-value="g.maxScore"
                @update:model-value="(v: number | undefined) => updateGrade(g.id, { maxScore: v || 0 })"
              />
              <span class="dim">分</span>
            </div>
            <el-input
              size="small"
              placeholder="等级描述"
              :model-value="g.remark || ''"
              @update:model-value="(v: string) => updateGrade(g.id, { remark: v })"
            />
          </div>
          <el-button link size="small" class="danger" @click="removeGrade(g.id)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <el-button size="small" plain class="full-btn" @click="addGrade">
          <el-icon><Plus /></el-icon> 新增等级
        </el-button>
      </template>
      <template #footer>
        <el-button @click="gradeDialogOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 保存到模板 -->
    <el-dialog v-model="saveTemplateOpen" title="保存到模板" width="520px" append-to-body destroy-on-close>
      <div class="tpl-mode-row">
        <button
          type="button"
          class="tpl-mode-btn"
          :class="{ active: saveTemplateMode === 'new' }"
          @click="saveTemplateMode = 'new'"
        >
          新增模板
        </button>
        <button
          type="button"
          class="tpl-mode-btn"
          :class="{ active: saveTemplateMode === 'replace' }"
          @click="saveTemplateMode = 'replace'"
        >
          替换现有模板
        </button>
      </div>
      <div v-if="saveTemplateMode === 'new'" class="field">
        <p class="field-label">模板名称</p>
        <el-input v-model="stdDraft.name" placeholder="输入模板名称" />
      </div>
      <div v-else class="field">
        <p class="field-label">选择要替换的模板</p>
        <div class="replace-list">
          <div
            v-for="scheme in rubricLibrary"
            :key="scheme.id"
            class="replace-item"
            :class="{ active: selectedReplaceTemplateId === scheme.id }"
            @click="selectedReplaceTemplateId = scheme.id"
          >
            <p class="replace-name">{{ scheme.name }}</p>
            <p class="dim">{{ scheme.mode === 'rubric' ? '评价量规' : '评分规则' }}</p>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="saveTemplateOpen = false">取消</el-button>
        <el-button
          size="small"
          type="primary"
          :loading="savingTemplate"
          :disabled="saveTemplateMode === 'replace' && !selectedReplaceTemplateId"
          @click="handleSaveTemplate"
        >
          确认保存
        </el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 评价标准配置弹窗：逐项复刻 React EvaluationRulesEditor 的 methodDialogContent。
 * - 编辑视图：评价标准名称/类型（评价量规 | 评分规则）、量规配置表（维度名称+知识点/能力点绑定、
 *   评价等级、权重、一键均分）、评分规则配置表（评价项/加减分规则/分值），保存（回写任务）与保存到模板
 * - 模板库视图：列出 /scene/rubric-templates 模板并整体覆盖到当前任务表单（不保留引用）
 */
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Delete, Files, Plus, RefreshLeft } from '@element-plus/icons-vue';
import {
  uid,
  type EvalRuleConfig,
  type EvalRulePoint,
  type EvalRuleScoreRule,
  type GradeMapping,
  type KnowledgePointItem,
  type AbilityPointItem
} from '@/views/lesson/lesson-edit-utils';
import MixedTagEditor from './MixedTagEditor.vue';
import { rubricTemplateApi } from './api';
import {
  EVAL_POINT_FIELD_BY_METHOD,
  EVAL_SUB_TYPE_COLORS,
  EVAL_SUB_TYPE_LABELS,
  GRADE_COLORS,
  methodLabelOf,
  scoreRulesFieldOf,
  standardModeFieldOf,
  standardNameFieldOf,
  type EvalPointField,
  type RubricScheme,
  type StandardDraft
} from './types';

const props = defineProps<{
  modelValue: boolean;
  methodKey: string;
  config: EvalRuleConfig;
  knowledgePoints: KnowledgePointItem[];
  abilityPoints: AbilityPointItem[];
  persistStandard?: (methodKey: string, config: EvalRuleConfig) => Promise<void> | void;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'patch', patch: Partial<EvalRuleConfig>): void;
  (e: 'open-kp', pointId: string, field: EvalPointField): void;
  (e: 'open-ab', pointId: string, field: EvalPointField): void;
}>();

const view = ref<'edit' | 'template'>('edit');
const stdDraft = ref<StandardDraft>({ name: '', mode: 'rubric' });
const isSavingStandard = ref(false);
const rubricLibrary = ref<RubricScheme[]>([]);
const gradeDialogOpen = ref(false);
const gradePointId = ref<string | null>(null);
const saveTemplateOpen = ref(false);
const saveTemplateMode = ref<'new' | 'replace'>('new');
const selectedReplaceTemplateId = ref<string | null>(null);
const savingTemplate = ref(false);

const methodLabel = computed(() => methodLabelOf(props.methodKey));
const evalPointField = computed<EvalPointField>(
  () => EVAL_POINT_FIELD_BY_METHOD[props.methodKey] || 'randomDrawEvalPoints'
);
const nameField = computed(() => standardNameFieldOf(props.methodKey));
const modeField = computed(() => standardModeFieldOf(props.methodKey));
const rulesField = computed(() => scoreRulesFieldOf(props.methodKey));

const evalPoints = computed<EvalRulePoint[]>(
  () => ((props.config as any)[evalPointField.value] as EvalRulePoint[]) || []
);
const scoreRules = computed<EvalRuleScoreRule[]>(
  () => ((props.config as any)[rulesField.value] as EvalRuleScoreRule[]) || []
);

const pointWeightTotal = computed(() => evalPoints.value.reduce((sum, p) => sum + (p.weight || 0), 0));
const ruleWeightTotal = computed(() => scoreRules.value.reduce((sum, r) => sum + (r.weight || 0), 0));

const gradePoint = computed(() => evalPoints.value.find((p) => p.id === gradePointId.value) || null);

/** 打开弹窗时同步草稿（对齐 React openDialog('method') 内 setStdDraft） */
watch(
  () => [props.modelValue, props.methodKey] as const,
  ([open]) => {
    if (!open) return;
    view.value = 'edit';
    stdDraft.value = {
      name: ((props.config as any)[nameField.value] as string) || '',
      mode: (((props.config as any)[modeField.value] as 'rubric' | 'score_rule') || 'rubric')
    };
  },
  { immediate: true }
);

function subTypeLabel(type: string): string {
  return EVAL_SUB_TYPE_LABELS[type] || type;
}

function subTypeColor(type: string): string {
  return EVAL_SUB_TYPE_COLORS[type] || '#909399';
}

function gradeText(gm: GradeMapping): string {
  return `${gm.grade ?? ''} (${gm.minScore}-${gm.maxScore}分) ${gm.remark ?? ''}`;
}

/* ============ 评价点读写 ============ */

function setEvalPoints(points: EvalRulePoint[]) {
  emit('patch', { [evalPointField.value]: points } as unknown as Partial<EvalRuleConfig>);
}

function addPoint() {
  // React addEvalPoint(field, { name: '', types: undefined })：空名评价点不带默认等级映射
  setEvalPoints([
    ...evalPoints.value,
    {
      id: uid('ep'),
      name: '',
      desc: '',
      subType: undefined,
      types: undefined,
      knowledgePointIds: undefined,
      abilityPointIds: undefined,
      scoringMethod: 'level',
      gradeMapping: []
    }
  ]);
}

function updatePoint(id: string, updates: Partial<EvalRulePoint>) {
  setEvalPoints(evalPoints.value.map((p) => (p.id === id ? { ...p, ...updates } : p)));
}

function removePoint(id: string) {
  setEvalPoints(evalPoints.value.filter((p) => p.id !== id));
}

function distributePointWeights() {
  const count = evalPoints.value.length;
  if (count === 0) return;
  const base = Math.floor(100 / count);
  const remainder = 100 % count;
  setEvalPoints(evalPoints.value.map((p, i) => ({ ...p, weight: base + (i < remainder ? 1 : 0) })));
}

/* ============ 评分规则读写 ============ */

function setScoreRules(items: EvalRuleScoreRule[]) {
  emit('patch', { [rulesField.value]: items } as unknown as Partial<EvalRuleConfig>);
}

function addScoreRule() {
  setScoreRules([...scoreRules.value, { id: uid('sr'), name: '', desc: '', rule: '', weight: 0 }]);
}

function updateScoreRule(id: string, updates: Partial<EvalRuleScoreRule>) {
  setScoreRules(scoreRules.value.map((it) => (it.id === id ? { ...it, ...updates } : it)));
}

/** 第一行为评价项名称，其余行为评分标准描述（对齐 React 单 Textarea 拆分 name/desc） */
function updateRuleText(id: string, value: string) {
  const lines = value.split('\n');
  updateScoreRule(id, { name: lines[0] || '', desc: lines.slice(1).join('\n') });
}

function removeScoreRule(id: string) {
  setScoreRules(scoreRules.value.filter((it) => it.id !== id));
}

function distributeRuleWeights() {
  const count = scoreRules.value.length;
  if (count === 0) return;
  const base = Math.floor(100 / count);
  const remainder = 100 % count;
  setScoreRules(scoreRules.value.map((it, i) => ({ ...it, weight: base + (i < remainder ? 1 : 0) })));
}

function switchToScoreRule() {
  stdDraft.value.mode = 'score_rule';
  if (scoreRules.value.length === 0) addScoreRule();
}

function clearStandard() {
  stdDraft.value = { name: '', mode: 'rubric' };
  emit('patch', {
    [nameField.value]: undefined,
    [modeField.value]: undefined,
    [rulesField.value]: [],
    [evalPointField.value]: []
  } as unknown as Partial<EvalRuleConfig>);
}

/* ============ 评分等级 ============ */

function openGradeDialog(pointId: string) {
  gradePointId.value = pointId;
  gradeDialogOpen.value = true;
}

function updateGrade(gradeId: string, updates: Partial<GradeMapping>) {
  const point = gradePoint.value;
  if (!point) return;
  const next = (point.gradeMapping || []).map((g) => (g.id === gradeId ? { ...g, ...updates } : g));
  updatePoint(point.id, { gradeMapping: next });
}

function removeGrade(gradeId: string) {
  const point = gradePoint.value;
  if (!point) return;
  updatePoint(point.id, { gradeMapping: (point.gradeMapping || []).filter((g) => g.id !== gradeId) });
}

function addGrade() {
  const point = gradePoint.value;
  if (!point) return;
  const gm = point.gradeMapping || [];
  updatePoint(point.id, {
    gradeMapping: [
      ...gm,
      {
        id: uid('grade'),
        grade: '新等级',
        minScore: 0,
        maxScore: 100,
        color: GRADE_COLORS[gm.length % GRADE_COLORS.length],
        remark: ''
      }
    ]
  });
}

/* ============ 评价标准模板 ============ */

async function loadRubricTemplates() {
  try {
    const res = await rubricTemplateApi.list({ limit: 200 });
    rubricLibrary.value = ((res.items || []) as any[]).map((t) => ({
      id: t.id,
      name: t.name,
      types: t.types || [],
      desc: t.description || '',
      points: ((t.data?.points || []) as any[]).map((p) => ({
        id: p.id || uid('ep'),
        name: p.name,
        desc: p.description || '',
        subType: p.types?.[0],
        types: p.types || [],
        knowledgePointIds: p.knowledgePointIds || [],
        abilityPointIds: p.abilityPointIds || [],
        scoringMethod: p.scoringMethod || 'level',
        gradeMapping: p.gradeMapping || [],
        weight: p.weight || 0
      })),
      mode: t.mode || 'rubric',
      scoreRuleItems: t.data?.scoreRuleItems || []
    }));
  } catch (err) {
    ElMessage.error((err as Error).message || '加载评价标准模板列表失败');
  }
}

onMounted(loadRubricTemplates);

/** 使用模板 = 把模板内容完整复制到当前任务的评价标准表单，不保留任何引用 */
function applyScheme(schemeId: string) {
  const scheme = rubricLibrary.value.find((s) => s.id === schemeId);
  if (!scheme) return;
  stdDraft.value = { name: scheme.name, mode: scheme.mode };
  const patch: Record<string, any> = {
    [nameField.value]: scheme.name,
    [modeField.value]: scheme.mode
  };
  if (scheme.mode === 'rubric') {
    patch[evalPointField.value] = scheme.points.map((p) => ({ ...p, id: uid('ep') }));
    patch[rulesField.value] = [];
  } else {
    patch[evalPointField.value] = [];
    patch[rulesField.value] = (scheme.scoreRuleItems || []).map((it) => ({ ...it, id: uid('sr') }));
  }
  emit('patch', patch as unknown as Partial<EvalRuleConfig>);
  view.value = 'edit';
}

function buildTemplatePayload(mode: 'rubric' | 'score_rule') {
  return {
    name: stdDraft.value.name || '新建评价标准',
    mode,
    types: [] as string[],
    description: '',
    data:
      mode === 'score_rule'
        ? {
            scoreRuleItems: scoreRules.value.map((sr) => ({
              id: sr.id,
              name: sr.name,
              desc: sr.desc,
              rule: sr.rule || '',
              weight: sr.weight || 0
            }))
          }
        : {
            points: evalPoints.value.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.desc || '',
              types: p.types || (p.subType ? [p.subType] : []),
              weight: p.weight || 0,
              scoringMethod: p.scoringMethod || 'level',
              gradeMapping: p.gradeMapping || [],
              knowledgePointIds: p.knowledgePointIds || [],
              abilityPointIds: p.abilityPointIds || []
            }))
          }
  };
}

function openSaveTemplate() {
  saveTemplateOpen.value = true;
  saveTemplateMode.value = 'new';
  selectedReplaceTemplateId.value = null;
}

async function handleSaveTemplate() {
  savingTemplate.value = true;
  try {
    const payload = buildTemplatePayload(stdDraft.value.mode);
    if (saveTemplateMode.value === 'new') {
      const created = await rubricTemplateApi.create(payload);
      rubricLibrary.value = [
        ...rubricLibrary.value,
        {
          id: created.id,
          name: payload.name,
          types: [],
          desc: '',
          points: evalPoints.value.map((p) => ({ ...p })),
          mode: payload.mode as 'rubric' | 'score_rule',
          scoreRuleItems: (payload.data as any).scoreRuleItems
        }
      ];
    } else if (selectedReplaceTemplateId.value) {
      const id = selectedReplaceTemplateId.value;
      await rubricTemplateApi.update(id, payload);
      rubricLibrary.value = rubricLibrary.value.map((s) =>
        s.id === id
          ? {
              ...s,
              name: payload.name,
              types: [],
              desc: '',
              points: evalPoints.value.map((p) => ({ ...p })),
              mode: payload.mode as 'rubric' | 'score_rule',
              scoreRuleItems: (payload.data as any).scoreRuleItems
            }
          : s
      );
    }
    ElMessage.success('模板已保存');
    saveTemplateOpen.value = false;
  } catch (err) {
    ElMessage.error((err as Error).message || '模板保存失败');
  } finally {
    savingTemplate.value = false;
  }
}

/** 「保存」：把评价标准（名称/类型/量规或评分规则）立即关联到当前任务 × 当前测评方式 */
async function handleSaveStandard() {
  if (isSavingStandard.value) return;
  isSavingStandard.value = true;
  try {
    const patch = {
      [nameField.value]: stdDraft.value.name,
      [modeField.value]: stdDraft.value.mode
    } as unknown as Partial<EvalRuleConfig>;
    emit('patch', patch);
    await props.persistStandard?.(props.methodKey, { ...props.config, ...patch } as EvalRuleConfig);
    ElMessage.success('评价标准已保存');
  } catch (err) {
    ElMessage.error((err as Error).message || '评价标准保存失败');
  } finally {
    isSavingStandard.value = false;
  }
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
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.top-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.box {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 16px;
}
.box.gray {
  background: #fafafa;
}
.box-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.box-head .box-title {
  margin: 0;
}
.box-head-actions {
  display: flex;
  gap: 8px;
}
.field {
  margin-bottom: 12px;
}
.field-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #909399;
}
.mode-row {
  display: flex;
  gap: 12px;
}
.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  color: #909399;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.mode-btn:hover {
  border-color: #c0c4cc;
}
.mode-btn.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}
.radio {
  width: 14px;
  height: 14px;
  border: 1px solid #dcdfe6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.radio.on {
  border-color: #409eff;
}
.radio.on i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #409eff;
}
.rubric-table :deep(.el-table__cell) {
  vertical-align: top;
}
.num-input {
  width: 92px;
}
.grade-btn {
  border: none;
  background: transparent;
  color: #409eff;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  padding: 0;
  width: 100%;
}
.grade-btn:hover {
  text-decoration: underline;
}
.grade-line {
  display: block;
  line-height: 1.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.add-row {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: 2px dashed #e4e7ed;
  border-radius: 8px;
  background: transparent;
  color: #909399;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s;
}
.add-row:hover {
  border-color: #a0cfff;
  color: #409eff;
}
.total-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
}
.total-row .ok {
  color: #67c23a;
  font-weight: 600;
}
.total-row .bad {
  color: #f56c6c;
  font-weight: 600;
}
.dim {
  font-size: 12px;
  color: #909399;
}
.danger {
  color: #f56c6c;
}
.save-actions {
  display: flex;
  gap: 8px;
}
.template-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.template-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}
.template-card:hover {
  border-color: #a0cfff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.template-main {
  min-width: 0;
  flex: 1;
}
.template-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.template-name {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.template-desc {
  margin: 0 0 8px;
  font-size: 12px;
  color: #a8abb2;
}
.template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.template-count {
  margin: 6px 0 0;
  font-size: 12px;
  color: #a8abb2;
}
.grade-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
  margin-bottom: 12px;
}
.grade-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.grade-line-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grade-input {
  width: 76px;
}
.score-input {
  width: 96px;
}
.full-btn {
  width: 100%;
}
.tpl-mode-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tpl-mode-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s;
}
.tpl-mode-btn.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}
.replace-list {
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.replace-item {
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.replace-item.active {
  border-color: #409eff;
  background: #f7fbff;
}
.replace-name {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}
</style>

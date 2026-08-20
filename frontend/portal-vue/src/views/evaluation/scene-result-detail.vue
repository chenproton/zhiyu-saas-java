<template>
  <div>
    <div v-if="loading" class="loading-full">加载中...</div>

    <div v-else-if="!result" class="load-failed">
      <template v-if="loadError">
        <p class="failed-title">加载失败</p>
        <p class="failed-detail">{{ loadError }}</p>
      </template>
      <p v-else class="failed-title">记录不存在</p>
    </div>

    <template v-else>
      <div class="grading-page">
        <!-- 顶部导航 -->
        <div class="top-bar">
          <el-button size="small" text @click="goBack">
            <el-icon class="back-icon"><ArrowLeft /></el-icon>返回
          </el-button>
          <el-divider direction="vertical" class="top-divider" />
          <span class="top-title">评分详情</span>
        </div>

        <!-- 学生信息头部 -->
        <div class="student-bar">
          <div class="student-avatar" :class="saved ? 'avatar-graded' : 'avatar-pending'">
            {{ getInitials(studentName) }}
          </div>
          <div class="student-info">
            <div class="student-line">
              <h1 class="student-name">{{ studentName }}</h1>
              <span v-if="classInfo" class="student-class">
                <el-icon class="grad-icon"><School /></el-icon>{{ classInfo }}
              </span>
            </div>
            <div class="student-line2">
              <span class="usage-name-text">{{ taskName || '未知任务' }}</span>
              <el-tag size="small" class="method-tag" effect="dark" :color="methodColor(methodKey)">{{ methodName }}</el-tag>
              <el-tag v-if="saved" type="success" size="small">
                <el-icon class="tag-icon"><CircleCheck /></el-icon>已评分
              </el-tag>
              <el-tag v-else type="warning" size="small">
                <el-icon class="tag-icon"><Star /></el-icon>待评分
              </el-tag>
            </div>
          </div>
          <div class="current-total">
            <div class="total-label">当前总分</div>
            <div class="total-value">
              <span class="total-num" :class="saved || computedTotal > 0 ? 'total-green' : 'total-dim'">
                {{ saved || computedTotal > 0 ? computedTotal : '-' }}
              </span>
              <span class="total-max">/ {{ maxScore }}</span>
            </div>
          </div>
        </div>

        <!-- 试卷类评分（paper / question_bank / quiz）：全宽题目列表 -->
        <div v-if="isExamMethod" class="exam-wrap">
          <div class="exam-header">
            <div class="exam-head-row">
              <div class="head-left">
                <div class="head-icon"><el-icon><Document /></el-icon></div>
                <div>
                  <h2 class="head-title">{{ methodName }}评分</h2>
                  <p class="head-sub">共 {{ examQuestions.length }} 题（客观 {{ autoCount }} / 主观 {{ subjectiveCount }}）</p>
                </div>
              </div>
              <div class="final-total">
                <span class="final-label">最终总分</span>
                <span class="final-value">{{ computedTotal }}</span>
                <span class="final-max">/ {{ maxScore }}</span>
              </div>
            </div>
            <div class="score-summary">
              <div class="summary-item summary-auto">
                <span>客观题自动得分</span>
                <span class="summary-val">{{ examAutoTotal }} / {{ autoMaxScore }}</span>
              </div>
              <div class="summary-item summary-subjective">
                <span>主观题得分</span>
                <span class="summary-val" :class="examSubjectiveTotal > 0 ? 'val-amber-strong' : 'val-amber'">
                  {{ examSubjectiveTotal }} / {{ subjectiveMaxScore }}
                </span>
                <el-tag v-if="examSubjectiveTotal === 0 && !saved" size="small" effect="plain" class="pending-tag">待评分</el-tag>
              </div>
            </div>
          </div>

          <div class="questions-body">
            <div class="filter-row">
              <button class="filter-pill" :class="{ active: questionFilter === 'all' }" @click="questionFilter = 'all'">
                全部题目 ({{ examQuestions.length }})
              </button>
              <button class="filter-pill pill-amber" :class="{ active: questionFilter === 'pending' }" @click="questionFilter = 'pending'">
                待评分题目 ({{ pendingQuestions.length }})
              </button>
            </div>
            <div class="q-list">
              <QuestionGradingCard
                v-for="(q, idx) in displayedQuestions"
                :key="q.id"
                :question="q"
                :index="questionFilter === 'all' ? idx : examQuestions.indexOf(q)"
                :answer="objectiveAnswers[q.id]"
                :score="pointScores[q.id] ?? 0"
                :is-graded="saved"
                @score-change="handleScoreChange"
              />
              <div v-if="displayedQuestions.length === 0" class="q-empty">暂无待评分题目</div>
            </div>
          </div>
        </div>

        <!-- 非试卷类：左右分栏（现场问答 / 评审材料 + 评价点评分） -->
        <div v-else class="split-body">
          <!-- 左侧 -->
          <div class="left-panel">
            <!-- 现场问答（随机抽题 / 手动选题） -->
            <template v-if="isRandomDraw">
              <div class="panel-header">
                <h2 class="panel-title"><el-icon class="panel-icon icon-purple"><Document /></el-icon>现场问答题</h2>
                <div class="panel-actions">
                  <el-tag size="small" effect="plain">{{ rdQuestions.length }} 题</el-tag>
                  <el-button v-if="!saved" size="small" :disabled="drawPoolIds.length === 0" @click="drawQuestions">现场抽题</el-button>
                </div>
              </div>
              <div class="panel-body">
                <el-empty
                  v-if="rdQuestions.length === 0"
                  description="点击右上角「现场抽题」按钮，从题库中抽取本次问答题目"
                  :image-size="60"
                />
                <div v-else class="card-list">
                  <DrawnQuestionCard
                    v-for="(q, idx) in rdQuestions"
                    :key="q.id"
                    :question="q"
                    :index="idx"
                    :oral-answer="oralAnswers[q.id] || ''"
                    :is-graded="saved"
                    @oral-answer-change="handleOralAnswerChange"
                  />
                </div>
              </div>
            </template>

            <!-- 现场评审 / 成果 / 作业材料 -->
            <template v-else-if="isMaterialMethod">
              <div class="panel-header">
                <h2 class="panel-title"><el-icon class="panel-icon icon-amber"><Folder /></el-icon>{{ materialTitle }}</h2>
              </div>
              <div class="panel-body material-body">
                <!-- 评审步骤选择 -->
                <div v-if="isReview && enabledReviewSteps.length" class="material-block">
                  <div class="material-title">评审步骤（选择本次评价的步骤）</div>
                  <div
                    v-for="(step, idx) in enabledReviewSteps"
                    :key="step.id"
                    class="step-row"
                    :class="{ 'step-selected': stepSelected(step.id), 'step-locked': saved || stepCompleted(step.id) }"
                    @click="toggleStep(step.id)"
                  >
                    <span class="step-num" :class="{ 'step-num-active': stepSelected(step.id) }">{{ idx + 1 }}</span>
                    <div class="step-info">
                      <p class="step-label">{{ step.label }}</p>
                      <p v-if="step.description" class="step-desc">{{ step.description }}</p>
                    </div>
                    <el-tag v-if="stepCompleted(step.id)" size="small" type="success">已完成</el-tag>
                    <el-checkbox
                      v-else
                      :model-value="stepSelected(step.id)"
                      :disabled="saved"
                      @click.stop
                      @change="(v: string | number | boolean) => setStepSelected(step.id, !!v)"
                    />
                  </div>
                </div>

                <!-- 学生按评价点自评 -->
                <div v-if="hasSelfEval && evalPoints.length" class="material-block">
                  <div class="material-title">学生按评价点自评</div>
                  <div v-for="ep in evalPoints" :key="ep.id" class="self-eval-item">
                    <div class="self-eval-head">
                      <span class="self-eval-name">{{ ep.name }}</span>
                      <el-tag size="small" effect="plain">{{ ep.weight || 0 }} 分</el-tag>
                    </div>
                    <p class="self-eval-text">{{ selfEvalOf(ep.id) }}</p>
                  </div>
                </div>

                <!-- 学生提交内容 -->
                <div v-if="subjectiveText" class="material-block">
                  <div class="material-title">学生提交内容</div>
                  <pre class="sub-text">{{ subjectiveText }}</pre>
                </div>

                <!-- 材料附件 -->
                <div v-if="materialFiles.length" class="material-block">
                  <div class="material-title">附件</div>
                  <div v-for="(f, i) in materialFiles" :key="i" class="file-row">
                    <el-icon class="file-icon"><Folder /></el-icon>
                    <span class="file-name">{{ f.name }}</span>
                    <el-button size="small" text type="primary" @click="previewFile(f)">预览</el-button>
                    <el-button size="small" text @click="downloadFile(f)">下载</el-button>
                  </div>
                </div>

                <el-empty v-if="!subjectiveText && materialFiles.length === 0" description="学生未提交在线材料" :image-size="60" />
              </div>
            </template>
          </div>

          <!-- 右侧：评价点评分 -->
          <div class="right-panel">
            <div class="panel-header">
              <h2 class="panel-title"><el-icon class="panel-icon icon-amber"><Star /></el-icon>{{ rightTitle }}</h2>
              <div class="panel-total">
                已评分：<span class="panel-total-num">{{ evalPointTotal }} / {{ evalPointMaxTotal || 100 }}</span>
              </div>
            </div>
            <div class="panel-body">
              <template v-if="isScoreRuleMode">
                <div v-if="scoreRules.length" class="card-list">
                  <CriteriaGradingCard
                    v-for="sr in scoreRules"
                    :key="sr.id"
                    :item="criteriaOfRule(sr)"
                    :score="pointScores[sr.id] ?? 0"
                    :comment="pointComments[sr.id] ?? ''"
                    :is-graded="saved"
                    @change="handleEvalPointChange"
                  />
                </div>
                <el-empty v-else description="该任务未配置评分项" :image-size="60" />
              </template>
              <template v-else>
                <div v-if="evalPoints.length" class="card-list">
                  <CriteriaGradingCard
                    v-for="ep in evalPoints"
                    :key="ep.id"
                    :item="criteriaOfPoint(ep)"
                    :score="pointScores[ep.id] ?? 0"
                    :comment="pointComments[ep.id] ?? ''"
                    :is-graded="saved"
                    @change="handleEvalPointChange"
                  />
                </div>
                <el-empty v-else description="该任务未配置评价点" :image-size="60" />
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="bottom-bar">
        <div class="bb-final">
          <span class="bb-label">最终得分</span>
          <span class="bb-num" :class="saved || computedTotal > 0 ? 'total-green' : 'total-dim'">
            {{ saved || computedTotal > 0 ? computedTotal : '-' }}
          </span>
          <span class="bb-max">/ {{ maxScore }}</span>
        </div>
        <el-divider direction="vertical" class="bb-divider" />
        <div class="bb-comment">
          <el-input
            v-model="comment"
            type="textarea"
            :rows="1"
            :disabled="saved"
            placeholder="教师评语..."
            resize="none"
          />
        </div>
        <div v-if="saved && result.gradedAt" class="bb-graded-at">
          <div>评分时间</div>
          <div>{{ formatDateTime(result.gradedAt) }}</div>
        </div>
        <el-button size="small" @click="goBack">取消</el-button>
        <el-button
          v-if="!saved"
          size="small"
          type="primary"
          :loading="saving"
          :disabled="saving || !allScored"
          @click="handleSave"
        >
          <el-icon class="btn-icon"><Checked /></el-icon>{{ saving ? '保存中...' : '提交评分' }}
        </el-button>
        <span v-if="saveFailed" class="save-failed">保存失败，请重试</span>
        <el-button v-if="saved" size="small" disabled class="submitted-btn">
          <el-icon class="btn-icon"><CircleCheck /></el-icon>已提交
        </el-button>
      </div>

      <!-- 附件预览弹窗 -->
      <AttachmentPreviewDialog :attachment="previewAttachment" @close="previewAttachment = null" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Checked, CircleCheck, Document, Folder, School, Star } from '@element-plus/icons-vue';
import { evaluationResultApi, examApi, examResultApi, examUsageApi, randomDrawQuestionApi } from '@/api/evaluation';
import { scenarioApi, taskApi, taskEvaluationApi } from '@/api/scene';
import { userManagementApi } from '@/api/portal';
import { EVAL_METHOD_LABELS_GRADING } from '@/types/lesson';
import type { SceneEvaluationResult } from '@/types/evaluation';
import type { ScenarioSnapshot, TaskEvaluationMethod, TaskEvalPoint, TaskScoreRule } from '@/types/scene';
import QuestionGradingCard from './components/question-grading-card.vue';
import CriteriaGradingCard, { type GradingCriteria } from './components/criteria-grading-card.vue';
import DrawnQuestionCard, { type DrawnQuestion } from './components/drawn-question-card.vue';
import AttachmentPreviewDialog, { type PreviewAttachment } from './components/attachment-preview-dialog.vue';
import {
  computeTotalScore,
  examFromSnapshot,
  formatDateTime,
  getAutoScore,
  getInitials,
  isAutoQuestion,
  type ExamQuestionShape,
  type ExamShape
} from './components/grading-utils';

// ==================== 方法配色（对齐 React evalMethodColors 语义） ====================
const evalMethodColors: Record<string, string> = {
  random_draw: '#8b5cf6',
  review: '#e6a23c',
  paper: '#409eff',
  question_bank: '#6366f1',
  outcome: '#67c23a',
  homework: '#13c2c2',
  quiz: '#f56c6c'
};
function methodColor(key: string): string {
  return evalMethodColors[key] || '#909399';
}

// ==================== 快照 → 方法配置（对齐 React methodConfigFromSnapshot） ====================
function methodConfigFromSnapshot(
  snap: ScenarioSnapshot,
  taskId: string,
  methodKey: string
): TaskEvaluationMethod | null {
  const m = (snap.task_evaluation_methods || []).find(
    (x) => x.task_id === taskId && x.method_key === methodKey
  );
  if (!m) return null;
  return {
    id: m.id,
    taskId: m.task_id,
    methodKey: m.method_key,
    weight: m.weight ?? 0,
    evalObject: m.eval_object ?? '',
    evalSubjects: Array.isArray(m.eval_subjects) ? m.eval_subjects : [],
    standardName: m.standard_name,
    standardMode: m.standard_mode as TaskEvaluationMethod['standardMode'],
    resourceConfig: (m.resource_config || {}) as Record<string, any>,
    version: m.version ?? 0,
    isEnabled: m.is_enabled ?? true,
    evalPoints: (snap.task_eval_points || [])
      .filter((p) => p.config_id === m.id)
      .map((p) => ({
        id: p.id,
        configId: p.config_id,
        name: p.name,
        description: p.description,
        subType: p.sub_type,
        types: p.types,
        weight: p.weight ?? 0,
        scoringMethod: p.scoring_method ?? '',
        gradeMapping: (p.grade_mapping || {}) as Record<string, unknown>[],
        knowledgePointIds: p.knowledge_point_ids,
        abilityPointIds: p.ability_point_ids,
        sortOrder: p.sort_order ?? 0
      })),
    scoreRules: (snap.task_eval_score_rules || [])
      .filter((r) => r.config_id === m.id)
      .map((r) => ({
        id: r.id,
        configId: r.config_id,
        name: r.name,
        description: r.description,
        rule: typeof r.rule === 'string' ? r.rule : r.rule ? JSON.stringify(r.rule) : undefined,
        weight: r.weight ?? 0,
        sortOrder: r.sort_order ?? 0
      })),
    reviewSteps: (snap.task_review_steps || [])
      .filter((s) => s.config_id === m.id)
      .map((s) => ({
        id: s.id,
        configId: s.config_id,
        label: s.label,
        description: s.description,
        enabled: s.enabled ?? true,
        subjectType: s.subject_type,
        weight: s.weight ?? 0,
        sortOrder: s.sort_order ?? 0
      }))
  };
}

/** 全量分页拉取（对齐 React fetchAllPages / listAll） */
async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[] }>,
  pageSize = 100
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; ; page++) {
    const res = await fetchPage(page, pageSize);
    all.push(...(res.items || []));
    if ((res.items || []).length < pageSize) break;
  }
  return all;
}

// ==================== 页面状态 ====================
const route = useRoute();
const router = useRouter();
const id = String(route.params.id || '');

const result = ref<SceneEvaluationResult | null>(null);
const methodConfig = ref<TaskEvaluationMethod | null>(null);
const task = ref<{ id: string; name?: string } | null>(null);
const user = ref<{ id: string; name?: string; grade?: string; className?: string } | null>(null);
const exam = ref<ExamShape | null>(null);
const examResult = ref<{ score?: number; totalScore?: number } | null>(null);
const rdQuestions = ref<DrawnQuestion[]>([]);
const rdQuestionPool = ref<any[]>([]);
const questionFilter = ref<'all' | 'pending'>('all');
const previewAttachment = ref<PreviewAttachment | null>(null);

const pointScores = ref<Record<string, number>>({});
const pointComments = ref<Record<string, string>>({});
// 已提交过评分（含 0 分）的题目/评价点 id，用于区分“未评分”与“评 0 分”
const gradedIds = ref<Set<string>>(new Set());
const oralAnswers = ref<Record<string, string>>({});
const selectedReviewSteps = ref<Record<string, boolean>>({});
const comment = ref('');
const saving = ref(false);
const saved = ref(false);
const saveFailed = ref(false);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load() {
  try {
    const res = await evaluationResultApi.get(id);
    result.value = res;
    comment.value = res.comment || '';

    const eps = (res.evalPointScores || {}) as Record<string, any>;
    const scores: Record<string, number> = {};
    const comments: Record<string, string> = {};
    Object.entries(eps).forEach(([k, v]) => {
      if (typeof v === 'number') {
        scores[k] = v;
      } else if (v && typeof v === 'object') {
        scores[k] = typeof v.score === 'number' ? v.score : 0;
        comments[k] = v.comment || '';
      }
    });
    pointScores.value = scores;
    pointComments.value = comments;
    if (Object.keys(eps).length > 0) gradedIds.value = new Set(Object.keys(eps));

    const dq = (res.drawnQuestions || {}) as Record<string, any>;
    const oral: Record<string, string> = {};
    Object.entries(dq).forEach(([k, v]) => {
      oral[k] = typeof v === 'string' ? v : v?.oralAnswer || '';
    });
    oralAnswers.value = oral;

    const completedSteps = ((res.subjectiveContent || {}) as Record<string, any>)?.reviewSteps || [];
    const stepSelected: Record<string, boolean> = {};
    completedSteps.forEach((s: any) => {
      if (s.stepId) stepSelected[s.stepId] = true;
    });
    selectedReviewSteps.value = stepSelected;

    if (res.status === 'evaluated') saved.value = true;

    // 测评方法/评分点/任务信息按 result.version 从场景快照取；version 为空（历史数据）缺省最新快照。
    // 快照缺档/请求失败回退 live 读，兼容改造前数据（文档 8.2）。
    let taskData: { id: string; name?: string } | null = null;
    let cfg: TaskEvaluationMethod | null = null;
    let snapRdPool: any[] = [];
    let snapLoaded = false;
    if (res.sceneId) {
      try {
        const snap = await scenarioApi.getSnapshot(
          res.sceneId,
          res.version ? { version: res.version } : undefined
        );
        snapLoaded = true;
        const snapTask = (snap.scenario_tasks || []).find((x) => x.id === res.taskId);
        taskData = snapTask ? { id: snapTask.id, name: snapTask.name } : null;
        cfg = methodConfigFromSnapshot(snap, res.taskId, res.methodKey);
        snapRdPool = snap.random_draw_questions || [];
      } catch {
        snapLoaded = false;
      }
    }
    if (!snapLoaded) {
      const [liveTask, mRes] = await Promise.all([
        taskApi.get(res.taskId).catch(() => null),
        taskEvaluationApi.listMethods(res.taskId).catch(() => ({ methods: [] as TaskEvaluationMethod[] }))
      ]);
      taskData = liveTask;
      cfg = mRes.methods.find((m) => m.methodKey === res.methodKey) || null;
    }
    task.value = taskData;
    methodConfig.value = cfg;

    // 试卷类：按 resourceConfig 中固化的 paperId/examId 拉取快照与作答结果
    if (cfg && ['paper', 'question_bank', 'quiz'].includes(res.methodKey)) {
      const examId = cfg.resourceConfig?.paperId || cfg.resourceConfig?.examId;
      const usageId = cfg.resourceConfig?.usageId;
      if (examId) {
        try {
          const usageRes = await examUsageApi.list({ examId, limit: 50, scope: 'all' });
          const usage = (usageRes.items || []).find((u: any) => u.id === usageId) || (usageRes.items || [])[0];
          // 版本口径：学生作答的题目以考试安排固化的 examVersion 为准；
          // usage 缺档（历史数据）回退成绩行 version，再空缺省最新快照。
          const examVersion = usage?.examVersion || res.version || undefined;
          const snap = await examApi.getSnapshot(
            examId,
            examVersion ? { version: examVersion } : undefined
          );
          const examData = examFromSnapshot(snap);
          if (cfg.resourceConfig?.questionScores) {
            const qs = cfg.resourceConfig.questionScores as Record<string, number>;
            examData.questions = (examData.questions || []).map((q: ExamQuestionShape) => ({
              ...q,
              score: qs[q.questionId] ?? qs[q.id] ?? q.score ?? 0
            }));
          }
          exam.value = examData;
          if (usage) {
            const erRes = await examResultApi.list({ usageId: usage.id, limit: 500 });
            const found = (erRes.items || []).find((r: any) => r.userId === res.evaluateeId);
            if (found) examResult.value = found;
          }
        } catch {
          /* ignore */
        }
      }
    }

    // 现场问答：抽题内容优先 result.drawnQuestions 已存内容，否则从场景 bundle 按 id 取；
    // 仅快照缺档（历史数据）才回退 live 全表拉取（文档 8.2/13.D5）。
    if (res.methodKey === 'random_draw') {
      try {
        let pool = snapRdPool;
        if (pool.length === 0 && !snapLoaded) {
          pool = (await fetchAllPages((page, pageSize) =>
            randomDrawQuestionApi.list({ limit: pageSize, offset: page * pageSize })
          )) || [];
        }
        rdQuestionPool.value = pool;
        const drawnMap = (res.drawnQuestions || {}) as Record<string, any>;
        const drawnIds = Object.keys(drawnMap).filter(
          (k) => drawnMap[k] && typeof drawnMap[k] === 'object'
        );
        const selectedIds =
          drawnIds.length > 0 ? drawnIds : (cfg?.resourceConfig?.selectedQuestionIds as string[]) || [];
        const selected = (
          selectedIds.length > 0
            ? selectedIds.map((sid: string) => {
                const stored = drawnMap[sid];
                if (stored && (stored.name || stored.content)) return { id: sid, ...stored };
                return pool.find((q: any) => q.id === sid);
              })
            : pool
        ).filter(Boolean) as DrawnQuestion[];
        rdQuestions.value = selected;
      } catch {
        /* ignore */
      }
    }

    // 全量分页拉取反查姓名，避免超过 1000 用户时姓名缺失
    const users = await fetchAllPages((page, pageSize) =>
      userManagementApi.list({ limit: pageSize, offset: page * pageSize })
    ).catch(() => [] as any[]);
    const found = users.find((x: any) => x.id === res.evaluateeId);
    user.value = found ? { id: found.id, name: found.name, grade: found.grade, className: found.className } : null;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败';
  }
  loading.value = false;
}

onMounted(load);

// ==================== 计算属性 ====================
const methodKey = computed(() => result.value?.methodKey || '');
const methodName = computed(() => EVAL_METHOD_LABELS_GRADING[methodKey.value] || methodKey.value);
const isExamMethod = computed(() => ['paper', 'question_bank', 'quiz'].includes(methodKey.value));
const isRandomDraw = computed(() => methodKey.value === 'random_draw');
const isReview = computed(() => methodKey.value === 'review');
const isOutcome = computed(() => methodKey.value === 'outcome');
const isHomework = computed(() => methodKey.value === 'homework');
const isMaterialMethod = computed(() => isReview.value || isOutcome.value || isHomework.value);

const evalPoints = computed(() => methodConfig.value?.evalPoints || []);
const scoreRules = computed(() => methodConfig.value?.scoreRules || []);
const isScoreRuleMode = computed(
  () => methodConfig.value?.standardMode === 'score_rule' || scoreRules.value.length > 0
);
const reviewSteps = computed(() => methodConfig.value?.reviewSteps || []);
const enabledReviewSteps = computed(() => reviewSteps.value.filter((s) => s.enabled));
const subjectiveContent = computed(() => (result.value?.subjectiveContent || {}) as Record<string, any>);
const objectiveAnswers = computed(() => (result.value?.objectiveAnswers || {}) as Record<string, unknown>);
const examQuestions = computed(() => exam.value?.questions || []);

// 客观题自动分以提交时存储的客观答案为唯一依据，避免读取考试结果中的 score
// （该值可能被其他测评方式串用同步覆盖，也可能已包含教师评分导致重复累加）。
// 仅当试卷题目加载失败时才回退使用考试结果分数。
const examAutoTotal = computed(() => {
  const fromAnswers = examQuestions.value.reduce(
    (sum, q) => sum + getAutoScore(q, objectiveAnswers.value[q.id]),
    0
  );
  if (examQuestions.value.length > 0) return fromAnswers;
  if (examResult.value && typeof examResult.value.score === 'number') return examResult.value.score;
  return 0;
});

const examSubjectiveTotal = computed(() =>
  examQuestions.value.reduce((sum, q) => {
    if (isAutoQuestion(q)) return sum;
    return sum + (pointScores.value[q.id] ?? 0);
  }, 0)
);

const examTotal = computed(() => examAutoTotal.value + examSubjectiveTotal.value);
const examMaxScore = computed(() =>
  computeTotalScore(examResult.value?.totalScore, exam.value?.totalScore, examQuestions.value)
);

const evalPointTotal = computed(() => {
  if (isScoreRuleMode.value) {
    return scoreRules.value.reduce((sum, sr) => sum + (pointScores.value[sr.id] ?? 0), 0);
  }
  return evalPoints.value.reduce((sum, ep) => sum + (pointScores.value[ep.id] ?? 0), 0);
});

const evalPointMaxTotal = computed(() => {
  if (isScoreRuleMode.value) {
    return scoreRules.value.reduce((sum, sr) => sum + (sr.weight || 0), 0);
  }
  return evalPoints.value.reduce((sum, ep) => sum + (ep.weight || 0), 0);
});

const computedTotal = computed(() => (isExamMethod.value ? examTotal.value : evalPointTotal.value));
const maxScore = computed(
  () => (isExamMethod.value ? examMaxScore.value : evalPointMaxTotal.value) || result.value?.maxScore || 100
);

const allScored = computed(() => {
  if (isExamMethod.value) {
    return (
      examQuestions.value.length === 0 ||
      examQuestions.value
        .filter((q) => !isAutoQuestion(q))
        .every((q) => gradedIds.value.has(q.id) || q.score === 0)
    );
  }
  if (isScoreRuleMode.value) {
    return (
      scoreRules.value.length === 0 ||
      scoreRules.value.every((sr) => gradedIds.value.has(sr.id) || sr.weight === 0)
    );
  }
  if (isReview.value) {
    return (
      (evalPoints.value.length === 0 ||
        evalPoints.value.every((ep) => gradedIds.value.has(ep.id) || ep.weight === 0)) &&
      (reviewSteps.value.length === 0 || Object.values(selectedReviewSteps.value).some(Boolean))
    );
  }
  return (
    evalPoints.value.length === 0 ||
    evalPoints.value.every((ep) => gradedIds.value.has(ep.id) || ep.weight === 0)
  );
});

const pendingQuestions = computed(() =>
  examQuestions.value.filter(
    (q) => !isAutoQuestion(q) && !gradedIds.value.has(q.id) && (pointScores.value[q.id] ?? 0) === 0
  )
);
const displayedQuestions = computed(() =>
  questionFilter.value === 'all' ? examQuestions.value : pendingQuestions.value
);

const autoCount = computed(() => examQuestions.value.filter((q) => isAutoQuestion(q)).length);
const subjectiveCount = computed(() => examQuestions.value.filter((q) => !isAutoQuestion(q)).length);
const autoMaxScore = computed(() =>
  examQuestions.value.reduce((s, q) => s + (isAutoQuestion(q) ? q.score || 0 : 0), 0)
);
const subjectiveMaxScore = computed(() =>
  examQuestions.value.reduce((s, q) => s + (!isAutoQuestion(q) ? q.score || 0 : 0), 0)
);

const studentName = computed(() => user.value?.name || result.value?.evaluateeId || '未知');
const classInfo = computed(() => [user.value?.grade, user.value?.className].filter(Boolean).join(' · '));
const taskName = computed(() => task.value?.name || '');
const drawPoolIds = computed(() => (methodConfig.value?.resourceConfig?.selectedQuestionIds as string[]) || []);
const materialTitle = computed(() =>
  isReview.value ? '现场评审材料' : isOutcome.value ? '成果材料' : '作业材料'
);
const rightTitle = computed(() =>
  isRandomDraw.value || isReview.value ? '评价点评分' : isHomework.value ? '评价标准' : '评价点评分'
);

const subjectiveText = computed(() => {
  const t = subjectiveContent.value.text;
  return typeof t === 'string' ? t : '';
});
const materialFiles = computed(() => {
  const files = subjectiveContent.value.files;
  return Array.isArray(files)
    ? (files as { name?: string; url?: string; type?: string }[]).filter((f) => f && f.url)
    : [];
});
const hasSelfEval = computed(() => {
  const pse = subjectiveContent.value.pointSelfEval as Record<string, unknown> | undefined;
  return !!pse && Object.keys(pse).length > 0;
});

// ==================== 评分交互 ====================
function handleScoreChange(qid: string, score: number) {
  pointScores.value = { ...pointScores.value, [qid]: score };
  gradedIds.value = new Set([...gradedIds.value, qid]);
}

function handleEvalPointChange(id: string, score: number, c: string) {
  pointScores.value = { ...pointScores.value, [id]: score };
  pointComments.value = { ...pointComments.value, [id]: c };
  gradedIds.value = new Set([...gradedIds.value, id]);
}

function handleOralAnswerChange(qid: string, oralAnswer: string) {
  oralAnswers.value = { ...oralAnswers.value, [qid]: oralAnswer };
}

// 现场抽题：从 resourceConfig 固化的选题池按 drawCount 随机抽取（对齐 React）
function drawQuestions() {
  const poolIds = drawPoolIds.value;
  const drawCount = Math.max(
    1,
    Math.min(poolIds.length, (methodConfig.value?.resourceConfig?.drawCount as number) || poolIds.length || 1)
  );
  const shuffled = [...poolIds].sort(() => Math.random() - 0.5);
  const selectedIds = shuffled.slice(0, drawCount);
  rdQuestions.value = selectedIds
    .map((sid: string) => rdQuestionPool.value.find((q: any) => q.id === sid))
    .filter(Boolean) as DrawnQuestion[];
}

// 评审步骤
function stepCompleted(stepId: string): boolean {
  return ((subjectiveContent.value.reviewSteps as any[]) || []).some((s) => s.stepId === stepId);
}
function stepSelected(stepId: string): boolean {
  return !!selectedReviewSteps.value[stepId] || stepCompleted(stepId);
}
function setStepSelected(stepId: string, v: boolean) {
  selectedReviewSteps.value = { ...selectedReviewSteps.value, [stepId]: v };
}
function toggleStep(stepId: string) {
  if (saved.value || stepCompleted(stepId)) return;
  setStepSelected(stepId, !selectedReviewSteps.value[stepId]);
}

// 自评 / 评价点卡片数据映射
function selfEvalOf(pointId: string): string {
  const pse = subjectiveContent.value.pointSelfEval as Record<string, unknown> | undefined;
  const v = pse?.[pointId];
  return typeof v === 'string' ? v : '';
}
function criteriaOfPoint(ep: TaskEvalPoint): GradingCriteria {
  return { id: ep.id, name: ep.name, description: ep.description, weight: ep.weight };
}
function criteriaOfRule(sr: TaskScoreRule): GradingCriteria {
  return { id: sr.id, name: sr.name, description: sr.description, rule: sr.rule, weight: sr.weight };
}

// 附件
function previewFile(f: { name?: string; url?: string; type?: string }) {
  previewAttachment.value = { name: f.name || '附件', url: f.url || '', type: f.type };
}
function downloadFile(f: { name?: string; url?: string }) {
  if (!f.url) return;
  const a = document.createElement('a');
  a.href = f.url;
  a.download = f.name || '附件';
  a.click();
}

// ==================== 保存 ====================
async function handleSave() {
  if (!result.value) return;
  saving.value = true;
  try {
    const evalPointScoresPayload: Record<string, any> = {};
    Object.entries(pointScores.value).forEach(([k, v]) => {
      evalPointScoresPayload[k] = pointComments.value[k] ? { score: v, comment: pointComments.value[k] } : v;
    });

    // 总分不超过满分，防止异常累加导致超 100
    const payload: {
      score: number;
      comment?: string;
      evalPointScores: Record<string, unknown>;
      drawnQuestions?: Record<string, unknown>;
      subjectiveContent?: Record<string, unknown>;
    } = {
      score: Math.min(computedTotal.value, maxScore.value),
      comment: comment.value || undefined,
      evalPointScores: evalPointScoresPayload
    };
    if (isRandomDraw.value) {
      const drawn: Record<string, unknown> = {};
      rdQuestions.value.forEach((q) => {
        drawn[q.id] = { oralAnswer: oralAnswers.value[q.id] || '' };
      });
      payload.drawnQuestions = drawn;
    }
    if (isReview.value) {
      const existingSteps = ((result.value.subjectiveContent as Record<string, any>)?.reviewSteps || []) as any[];
      const newSteps = reviewSteps.value
        .filter(
          (s) => s.enabled && selectedReviewSteps.value[s.id] && !existingSteps.some((es: any) => es.stepId === s.id)
        )
        .map((s) => ({ stepId: s.id, completedAt: new Date().toISOString() }));
      payload.subjectiveContent = {
        ...((result.value.subjectiveContent as Record<string, any>) || {}),
        reviewSteps: [...existingSteps, ...newSteps]
      };
    }

    await evaluationResultApi.grade(result.value.id, payload);
    saved.value = true;
    // 重试成功后复位失败标记，避免同时展示「已提交」徽标与「保存失败」红字
    saveFailed.value = false;
  } catch {
    saveFailed.value = true;
  } finally {
    saving.value = false;
  }
}

function goBack() {
  const sceneId = result.value?.sceneId;
  router.push(sceneId ? { path: '/evaluation/scene-results', query: { sceneId } } : '/evaluation/scene-results');
}
</script>

<style scoped>
.loading-full {
  height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}
.load-failed {
  height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}
.failed-title {
  margin: 0 0 8px;
}
.failed-detail {
  margin: 0;
  font-size: 12px;
  color: #f56c6c;
}

.grading-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 90px;
}

/* 顶部导航 */
.top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 8px 16px;
}
.back-icon {
  margin-right: 2px;
}
.top-divider {
  height: 16px;
}
.top-title {
  font-size: 14px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 学生信息头部 */
.student-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px 16px;
}
.student-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}
.avatar-graded {
  background: #f0f9eb;
  color: #67c23a;
}
.avatar-pending {
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
}
.student-info {
  flex: 1;
  min-width: 0;
}
.student-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.student-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}
.student-class {
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 2px;
}
.grad-icon {
  font-size: 12px;
}
.student-line2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.usage-name-text {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}
.method-tag {
  border: none;
}
.current-total {
  text-align: right;
  flex-shrink: 0;
}
.total-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 2px;
}
.total-value {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 4px;
}
.total-num {
  font-size: 24px;
  font-weight: 700;
}
.total-green {
  color: #67c23a;
}
.total-dim {
  color: #c0c4cc;
}
.total-max {
  font-size: 14px;
  color: #c0c4cc;
}

/* 试卷评分头部 */
.exam-wrap {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}
.exam-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
}
.exam-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.head-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(64, 158, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #409eff;
}
.head-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}
.head-sub {
  font-size: 12px;
  color: #909399;
  margin: 2px 0 0;
}
.final-total {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  padding: 6px 12px;
}
.final-label {
  font-size: 13px;
  color: #909399;
}
.final-value {
  font-size: 18px;
  font-weight: 700;
  color: #409eff;
}
.final-max {
  font-size: 14px;
  color: #c0c4cc;
  font-weight: 500;
}
.score-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.summary-item {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  padding: 4px 10px;
  border: 1px solid;
  font-size: 12px;
}
.summary-auto {
  background: #f0f9eb;
  border-color: #e1f3d8;
}
.summary-subjective {
  background: #fdf6ec;
  border-color: #faecd8;
}
.summary-item span:first-child {
  color: #606266;
}
.summary-val {
  font-weight: 600;
  color: #67c23a;
}
.val-amber {
  color: #e6a23c;
}
.val-amber-strong {
  color: #b88230;
}
.pending-tag {
  margin-left: 2px;
}

/* 题目列表 */
.questions-body {
  padding: 16px;
}
.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.filter-pill {
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 9999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-pill:hover {
  background: #f5f7fa;
}
.filter-pill.active {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}
.pill-amber.active {
  background: #e6a23c;
  border-color: #e6a23c;
}
.q-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.q-empty {
  padding: 48px 0;
  text-align: center;
  color: #c0c4cc;
  font-size: 14px;
  background: #fff;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
}

/* 左右分栏（非试卷类） */
.split-body {
  display: flex;
  gap: 12px;
  align-items: stretch;
  height: calc(100vh - 300px);
  min-height: 420px;
}
.left-panel,
.right-panel {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.left-panel {
  flex: 1.2;
}
.right-panel {
  flex: 1;
}
.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-icon {
  font-size: 16px;
}
.icon-purple {
  color: #8b5cf6;
}
.icon-amber {
  color: #e6a23c;
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-total {
  font-size: 13px;
  color: #606266;
}
.panel-total-num {
  font-weight: 600;
  color: #303133;
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 材料区 */
.material-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.material-block {
  background: #f8fafc;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  padding: 12px;
}
.material-title {
  font-size: 12px;
  font-weight: 500;
  color: #909399;
  margin-bottom: 10px;
}
.step-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
  margin-bottom: 8px;
}
.step-row:hover {
  border-color: #a0cfff;
}
.step-row.step-selected {
  background: #f0f9eb;
  border-color: #e1f3d8;
}
.step-row.step-locked {
  cursor: default;
  opacity: 0.85;
}
.step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: #f5f7fa;
  color: #909399;
  border: 1px solid #dcdfe6;
}
.step-num-active {
  background: #67c23a;
  color: #fff;
  border-color: #67c23a;
}
.step-info {
  flex: 1;
  min-width: 0;
}
.step-label {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  margin: 0;
}
.step-desc {
  font-size: 12px;
  color: #909399;
  margin: 2px 0 0;
  line-height: 1.5;
}
.self-eval-item {
  background: #f8fafc;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.self-eval-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.self-eval-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.self-eval-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}
.sub-text {
  font-size: 13px;
  color: #606266;
  white-space: pre-wrap;
  font-family: inherit;
  background: #f8fafc;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0;
  line-height: 1.6;
}
.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px 12px;
  background: #fff;
  margin-bottom: 6px;
}
.file-icon {
  color: #909399;
  font-size: 16px;
  flex-shrink: 0;
}
.file-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部操作栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  padding: 10px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.bb-final {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 140px;
  flex-shrink: 0;
}
.bb-label {
  font-size: 13px;
  color: #909399;
}
.bb-num {
  font-size: 24px;
  font-weight: 700;
}
.bb-max {
  font-size: 13px;
  color: #c0c4cc;
}
.bb-divider {
  height: 32px;
}
.bb-comment {
  flex: 1;
  min-width: 0;
}
.bb-graded-at {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
  text-align: right;
}
.save-failed {
  font-size: 12px;
  color: #f56c6c;
  flex-shrink: 0;
}
.submitted-btn {
  color: #67c23a;
  background: #f0f9eb;
}
.btn-icon {
  margin-right: 3px;
  vertical-align: -2px;
}
.tag-icon {
  margin-right: 2px;
  vertical-align: -2px;
}
</style>

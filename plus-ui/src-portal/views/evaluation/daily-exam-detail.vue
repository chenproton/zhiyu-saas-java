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
          <el-button size="small" text @click="router.push('/evaluation/lesson-results/daily-exams')">
            <el-icon class="back-icon"><ArrowLeft /></el-icon>返回
          </el-button>
          <el-divider direction="vertical" class="top-divider" />
          <span class="top-title">{{ usageName || '日常考试' }} · 评分详情</span>
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
                <el-icon class="grad-icon"><User /></el-icon>{{ classInfo }}
              </span>
            </div>
            <div class="student-line2">
              <span class="usage-name-text">{{ usageName || '日常考试' }}</span>
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
              <span class="total-num" :class="saved || examTotal > 0 ? 'total-green' : 'total-dim'">
                {{ saved || examTotal > 0 ? examTotal : '-' }}
              </span>
              <span class="total-max">/ {{ examMaxScore }}</span>
            </div>
          </div>
        </div>

        <!-- 试卷评分 -->
        <div class="questions-wrap">
          <div class="questions-header">
            <div class="questions-head-row">
              <div class="head-left">
                <div class="head-icon"><el-icon><Document /></el-icon></div>
                <div>
                  <h2 class="head-title">试卷评分</h2>
                  <p class="head-sub">共 {{ examQuestions.length }} 题（客观 {{ autoCount }} / 主观 {{ subjectiveCount }}）</p>
                </div>
              </div>
              <div class="final-total">
                <span class="final-label">最终总分</span>
                <span class="final-value">{{ examTotal }}</span>
                <span class="final-max">/ {{ examMaxScore }}</span>
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
              <div
                v-for="(q, idx) in displayedQuestions"
                :key="q.id"
                class="q-card"
                :class="{ 'q-subjective': !isAutoQuestion(q) }"
              >
                <!-- 卡片头 -->
                <div class="q-header" @click="toggleExpanded(q.id)">
                  <div class="q-tag-group">
                    <span class="q-type-badge" :class="{ 'badge-subjective': !isAutoQuestion(q) }">
                      {{ questionTypeLabel(q.type) }}
                    </span>
                    <span class="q-index">第 {{ displayIndex(q, idx) + 1 }} 题</span>
                  </div>
                  <span class="q-content-preview">{{ q.content }}</span>
                  <div class="q-score-area" @click.stop>
                    <template v-if="isAutoQuestion(q)">
                      <span class="auto-score">{{ autoScore(q) }}</span>
                      <span class="auto-max">/ {{ q.score || 0 }}</span>
                      <el-tag v-if="isAnswerCorrect(q, objectiveAnswers[q.id])" type="success" size="small">
                        <el-icon class="tag-icon"><CircleCheck /></el-icon>正确
                      </el-tag>
                      <el-tag v-else type="danger" size="small">
                        <el-icon class="tag-icon"><CircleClose /></el-icon>错误
                      </el-tag>
                    </template>
                    <template v-else>
                      <div class="score-input-wrap">
                        <el-input
                          :model-value="localInputs[q.id]"
                          type="number"
                          :min="0"
                          :max="q.score || 0"
                          :step="0.5"
                          :disabled="isGraded"
                          class="score-input"
                          @input="onScoreInput(q.id, $event, q.score || 0)"
                          @blur="onScoreBlur(q.id, q.score || 0)"
                        />
                        <span class="score-max-label">/ {{ q.score || 0 }}</span>
                        <el-tooltip content="一键满分" placement="top">
                          <el-button size="small" text class="max-btn" :disabled="isGraded" @click="scoreMax(q.id)">
                            <el-icon><Trophy /></el-icon>
                          </el-button>
                        </el-tooltip>
                      </div>
                    </template>
                    <el-icon class="q-chevron" @click.stop="toggleExpanded(q.id)">
                      <ArrowUp v-if="expandedIds.has(q.id)" />
                      <ArrowDown v-else />
                    </el-icon>
                  </div>
                </div>

                <!-- 展开体 -->
                <div v-if="expandedIds.has(q.id)" class="q-body">
                  <p class="q-content">{{ q.content }}</p>

                  <div v-if="q.options && q.options.length" class="q-options">
                    <div v-for="(opt, oi) in q.options" :key="oi" class="opt-row" :class="optionClass(q, opt)">
                      <span class="opt-letter">{{ String.fromCharCode(65 + oi) }}</span>
                      <span class="opt-text">{{ opt }}</span>
                      <el-icon v-if="isOptionCorrect(q, opt)" class="opt-icon opt-icon-ok"><CircleCheck /></el-icon>
                      <el-icon v-else-if="isOptionSelected(q, opt)" class="opt-icon opt-icon-no"><CircleClose /></el-icon>
                    </div>
                  </div>

                  <template v-if="!isAutoQuestion(q)">
                    <div class="student-answer-box">
                      <div class="box-title">
                        <el-icon class="box-title-icon"><User /></el-icon>学生答案
                      </div>
                      <p class="answer-text">{{ getAnswerLabel(objectiveAnswers[q.id]) }}</p>
                    </div>
                    <div class="teacher-score-row">
                      <span class="teacher-label">教师评分</span>
                      <div class="score-input-wrap">
                        <el-input
                          :model-value="localInputs[q.id]"
                          type="number"
                          :min="0"
                          :max="q.score || 0"
                          :step="0.5"
                          :disabled="isGraded"
                          class="score-input"
                          @input="onScoreInput(q.id, $event, q.score || 0)"
                          @blur="onScoreBlur(q.id, q.score || 0)"
                        />
                        <span class="score-max-label">/ {{ q.score || 0 }}</span>
                        <el-tooltip content="一键满分" placement="top">
                          <el-button size="small" text class="max-btn" :disabled="isGraded" @click="scoreMax(q.id)">
                            <el-icon><Trophy /></el-icon>
                          </el-button>
                        </el-tooltip>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="answer-compare">
                      <div class="answer-pair">
                        <span class="a-label">学生答案：</span>
                        <span :class="isAnswerCorrect(q, objectiveAnswers[q.id]) ? 'a-correct' : 'a-wrong'">
                          {{ getAnswerLabel(objectiveAnswers[q.id]) }}
                        </span>
                      </div>
                      <div class="answer-pair">
                        <span class="a-label">正确答案：</span>
                        <span class="a-correct">{{ getAnswerLabel(q.answer) }}</span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <div v-if="displayedQuestions.length === 0" class="q-empty">暂无待评分题目</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="bottom-bar">
        <div class="bb-final">
          <span class="bb-label">最终得分</span>
          <span class="bb-num" :class="saved || examTotal > 0 ? 'total-green' : 'total-dim'">
            {{ saved || examTotal > 0 ? examTotal : '-' }}
          </span>
          <span class="bb-max">/ {{ examMaxScore }}</span>
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
        <el-button size="small" @click="router.push('/evaluation/lesson-results/daily-exams')">取消</el-button>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Checked,
  CircleCheck,
  CircleClose,
  Document,
  Star,
  Trophy,
  User
} from '@element-plus/icons-vue';
import { request } from '@/api/http';
import { examResultApi, examUsageApi } from '@/api/evaluation';
import type { ExamResult } from '@/types/evaluation';

// ==================== 快照结构与转换（对齐 React lib/exam-snapshot.ts） ====================

interface ExamSnapshotQuestion {
  id: string;
  exam_id: string;
  question_id?: string;
  type?: string;
  content: string;
  options?: string[];
  answer?: string | string[];
  analysis?: string;
  score?: number;
  sort_order?: number;
}

interface ExamSnapshot {
  exam: {
    id: string;
    name: string;
    description?: string;
    status?: string;
    total_score?: number;
    duration?: number;
    version?: string;
  };
  exam_questions: ExamSnapshotQuestion[];
}

interface ExamQuestionShape {
  id: string;
  questionId: string;
  type: string;
  content: string;
  options?: string[];
  answer: string | string[];
  analysis?: string;
  score: number;
  order: number;
}

interface ExamShape {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalScore: number;
  duration: number;
  ownerType: 'mine' | 'collaborate' | 'public';
  questions: ExamQuestionShape[];
  createdAt: string;
  updatedAt: string;
}

// 试卷快照行字段为 snake_case，映射为前端 Exam 形状
function examFromSnapshot(snap: ExamSnapshot): ExamShape {
  return {
    id: snap.exam.id,
    name: snap.exam.name,
    description: snap.exam.description,
    status: snap.exam.status || 'published',
    totalScore: snap.exam.total_score ?? 0,
    duration: snap.exam.duration ?? 0,
    ownerType: 'mine',
    questions: (snap.exam_questions || []).map(
      (q): ExamQuestionShape => ({
        id: q.id,
        questionId: q.question_id || q.id,
        type: q.type || 'single',
        content: q.content,
        options: q.options,
        answer: q.answer ?? '',
        analysis: q.analysis,
        score: q.score ?? 0,
        order: q.sort_order ?? 0
      })
    ),
    createdAt: '',
    updatedAt: ''
  };
}

// ==================== 自动判分逻辑（对齐 React question-grading-card.tsx） ====================

const QUESTION_TYPE_LABELS_SHORT: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  judgment: '判断',
  fill: '填空',
  fill_blank: '填空',
  essay: '论述',
  short_answer: '简答'
};

function questionTypeLabel(type: string): string {
  return QUESTION_TYPE_LABELS_SHORT[type] || type;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase());
  if (typeof v === 'string') return [v.toLowerCase()];
  return [];
}

function isAnswerCorrect(q: ExamQuestionShape, ans: unknown): boolean {
  const correct = toStringArray(q.answer);
  const type = q.type;
  if (type === 'single') {
    const s = typeof ans === 'string' ? ans.toLowerCase() : '';
    return correct.length > 0 && s === correct[0];
  }
  if (type === 'multiple') {
    const given = toStringArray(ans);
    if (given.length !== correct.length) return false;
    const m = new Map<string, number>();
    correct.forEach((c) => m.set(c, (m.get(c) || 0) + 1));
    for (const g of given) {
      const next = (m.get(g) || 0) - 1;
      if (next < 0) return false;
      m.set(g, next);
    }
    return true;
  }
  if (type === 'judge' || type === 'judgment') {
    // 判断题答案归一：兼容 '正确/错误/对/错/T/F/true/false/1/0' 等变体
    const normalize = (v: string): boolean | null => {
      const t = v.trim().toLowerCase();
      if (['正确', '对', 't', 'true', '1', '是'].includes(t)) return true;
      if (['错误', '错', 'f', 'false', '0', '否'].includes(t)) return false;
      return null;
    };
    const s = typeof ans === 'string' ? normalize(ans) : null;
    if (correct.length === 0 || s === null) return false;
    return s === normalize(String(correct[0]));
  }
  return false;
}

function getAutoScore(q: ExamQuestionShape, ans: unknown): number {
  const type = q.type;
  if (type === 'single' || type === 'multiple' || type === 'judge' || type === 'judgment') {
    return isAnswerCorrect(q, ans) ? q.score || 0 : 0;
  }
  return 0;
}

function isAutoQuestion(q: ExamQuestionShape): boolean {
  const type = q.type;
  return type === 'single' || type === 'multiple' || type === 'judge' || type === 'judgment';
}

function getAnswerLabel(ans: unknown): string {
  if (Array.isArray(ans)) return ans.join('、');
  if (typeof ans === 'string') return ans;
  return '未作答';
}

// ==================== 工具 ====================

function getInitials(name: string): string {
  if (!name || name === '未知') return '?';
  return name.slice(0, 2).toUpperCase();
}

/** 计算展示总分：考试结果分 > 考试总分 > 题目分数求和（对齐 React computeTotalScore） */
function computeTotalScore(
  examResultTotal: number | undefined,
  examTotal: number | undefined,
  questions: ExamQuestionShape[]
): number {
  return examResultTotal ?? examTotal ?? questions.reduce((sum, q) => sum + (q.score ?? 0), 0);
}

// ==================== 页面状态 ====================

const route = useRoute();
const router = useRouter();
const resultId = computed(() => String(route.params.resultId || ''));

const result = ref<ExamResult | null>(null);
const exam = ref<ExamShape | null>(null);
const usageName = ref('');
const loading = ref(true);
const loadError = ref<string | null>(null);
const saving = ref(false);
const saved = ref(false);
const saveFailed = ref(false);
const comment = ref('');
const pointScores = ref<Record<string, number>>({});
const gradedIds = ref<Set<string>>(new Set());
const questionFilter = ref<'all' | 'pending'>('all');
// 每题本地输入（失焦才提交；满分即时提交），与外部分数变化同步
const localInputs = ref<Record<string, string>>({});
const prevScores = ref<Record<string, number>>({});
const expandedIds = ref<Set<string>>(new Set());

async function load() {
  try {
    const res = await examResultApi.get(resultId.value);
    result.value = res;
    comment.value = res.gradingComment || '';
    if (res.gradingStatus === 'evaluated') saved.value = true;

    const gs = (res.gradingScores || {}) as Record<string, any>;
    const scores: Record<string, number> = {};
    Object.entries(gs).forEach(([k, v]) => {
      if (typeof v === 'number') scores[k] = v;
      else if (v && typeof v === 'object') scores[k] = typeof v.score === 'number' ? v.score : 0;
    });
    pointScores.value = scores;
    prevScores.value = { ...scores };
    if (Object.keys(gs).length > 0) gradedIds.value = new Set(Object.keys(gs));

    const usage = await examUsageApi.get(res.examUsageId).catch(() => null);
    usageName.value = usage?.name || '';
    if (usage) {
      // 版本口径：优先成绩行 version（交卷时服务端盖章），回退安排固化的 examVersion，再空缺省最新快照
      const examVersion = res.version || usage.examVersion || undefined;
      const snap = await request<ExamSnapshot>(
        `/evaluation/exams/${usage.examId}/snapshot${
          examVersion ? `?version=${encodeURIComponent(examVersion)}` : ''
        }`
      ).catch(() => null);
      exam.value = snap ? examFromSnapshot(snap) : null;
      // 初始化本地输入与展开态（主观题默认展开）
      const locals: Record<string, string> = {};
      const ids = new Set<string>();
      (exam.value?.questions || []).forEach((q) => {
        locals[q.id] = String(scores[q.id] ?? 0);
        if (!isAutoQuestion(q)) ids.add(q.id);
      });
      localInputs.value = locals;
      expandedIds.value = ids;
    }
  } catch (e) {
    console.error('[app-error] 加载评分详情:', e);
    loadError.value = e instanceof Error ? e.message : '加载失败';
  }
  loading.value = false;
}

load();

// 路由参数变化时重新加载（对齐 React useEffect 依赖 [resultId]；当前无详情→详情入口，属防御性对齐）
watch(
  () => route.params.resultId,
  () => {
    void load();
  }
);

// 父级外部更新该题分数（批量给满分/回填）时同步本地输入框（对齐 React 渲染期派生状态）
watch(
  pointScores,
  (scores) => {
    for (const [qid, num] of Object.entries(scores)) {
      if (prevScores.value[qid] !== num) {
        prevScores.value[qid] = num;
        localInputs.value[qid] = String(num);
      }
    }
  },
  { deep: true }
);

// ==================== 计算属性 ====================

const examQuestions = computed(() => exam.value?.questions || []);
const objectiveAnswers = computed(
  () => (result.value?.answers || {}) as Record<string, unknown>
);

const examAutoTotal = computed(() =>
  examQuestions.value.reduce(
    (sum, q) => sum + getAutoScore(q, objectiveAnswers.value[q.id]),
    0
  )
);

const examSubjectiveTotal = computed(() =>
  examQuestions.value.reduce((sum, q) => {
    if (isAutoQuestion(q)) return sum;
    return sum + (pointScores.value[q.id] ?? 0);
  }, 0)
);

const examTotal = computed(() => examAutoTotal.value + examSubjectiveTotal.value);
const examMaxScore = computed(() =>
  computeTotalScore(result.value?.totalScore, exam.value?.totalScore, examQuestions.value)
);

const autoCount = computed(() => examQuestions.value.filter((q) => isAutoQuestion(q)).length);
const subjectiveCount = computed(() => examQuestions.value.filter((q) => !isAutoQuestion(q)).length);
const autoMaxScore = computed(() =>
  examQuestions.value.reduce((s, q) => s + (isAutoQuestion(q) ? q.score || 0 : 0), 0)
);
const subjectiveMaxScore = computed(() =>
  examQuestions.value.reduce((s, q) => s + (!isAutoQuestion(q) ? q.score || 0 : 0), 0)
);

const pendingQuestions = computed(() =>
  // 与 allScored 口径一致：0 分主观题视为无需评分，不纳入待评分计数
  examQuestions.value.filter(
    (q) =>
      !isAutoQuestion(q) &&
      q.score !== 0 &&
      !gradedIds.value.has(q.id) &&
      (pointScores.value[q.id] ?? 0) === 0
  )
);

const displayedQuestions = computed(() =>
  questionFilter.value === 'all' ? examQuestions.value : pendingQuestions.value
);

const allScored = computed(
  () =>
    examQuestions.value.length === 0 ||
    examQuestions.value
      .filter((q) => !isAutoQuestion(q))
      .every((q) => gradedIds.value.has(q.id) || q.score === 0)
);

const studentName = computed(() => result.value?.studentName || '未知');
const classInfo = computed(() =>
  [result.value?.grade, result.value?.className].filter(Boolean).join(' · ')
);
const isGraded = computed(() => saved.value);

// ==================== 评分交互 ====================

function commitScore(qid: string, num: number) {
  pointScores.value = { ...pointScores.value, [qid]: num };
  gradedIds.value = new Set([...gradedIds.value, qid]);
  localInputs.value[qid] = String(num);
}

function onScoreInput(qid: string, val: string, max: number) {
  localInputs.value[qid] = val;
  // 仅当达到满分（含"一键满分"按钮）时同步提交，其余输入在失焦时提交
  if (val === String(max)) {
    const num = parseFloat(val);
    if (!Number.isNaN(num) && num >= 0 && num <= max) commitScore(qid, num);
  }
}

function onScoreBlur(qid: string, max: number) {
  const val = localInputs.value[qid];
  const num = parseFloat(val);
  if (!Number.isNaN(num) && num >= 0 && num <= max) {
    commitScore(qid, num);
  } else {
    localInputs.value[qid] = String(pointScores.value[qid] ?? 0);
  }
}

function scoreMax(qid: string) {
  const max = examQuestions.value.find((q) => q.id === qid)?.score || 0;
  commitScore(qid, max);
}

function toggleExpanded(qid: string) {
  const s = new Set(expandedIds.value);
  if (s.has(qid)) s.delete(qid);
  else s.add(qid);
  expandedIds.value = s;
}

function displayIndex(q: ExamQuestionShape, idx: number): number {
  return questionFilter.value === 'all' ? idx : examQuestions.value.indexOf(q);
}

function autoScore(q: ExamQuestionShape): number {
  return getAutoScore(q, objectiveAnswers.value[q.id]);
}

function isOptionCorrect(q: ExamQuestionShape, opt: string): boolean {
  return Array.isArray(q.answer) ? q.answer.includes(opt) : q.answer === opt;
}

function isOptionSelected(q: ExamQuestionShape, opt: string): boolean {
  const ans = objectiveAnswers.value[q.id];
  return Array.isArray(ans) ? ans.includes(opt) : ans === opt;
}

function optionClass(q: ExamQuestionShape, opt: string): string {
  if (isOptionCorrect(q, opt)) return 'opt-correct';
  if (isOptionSelected(q, opt)) return 'opt-wrong';
  return 'opt-plain';
}

// ==================== 保存 ====================

async function handleSave() {
  if (!result.value) return;
  saving.value = true;
  try {
    const scores: Record<string, unknown> = {};
    Object.entries(pointScores.value).forEach(([k, v]) => {
      scores[k] = { score: v };
    });
    await request<ExamResult>(`/evaluation/exam-results/${result.value.id}/grade`, {
      method: 'POST',
      body: JSON.stringify({ scores, comment: comment.value || undefined })
    });
    saved.value = true;
    // 重试成功后复位失败标记，避免同时展示「已提交」徽标与「保存失败」红字
    saveFailed.value = false;
  } catch (e) {
    console.error('[app-error] 保存评分:', e);
    saveFailed.value = true;
  } finally {
    saving.value = false;
  }
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

/* 试卷评分 */
.questions-wrap {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}
.questions-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
}
.questions-head-row {
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
.summary-auto span:first-child {
  color: #606266;
}
.summary-subjective {
  background: #fdf6ec;
  border-color: #faecd8;
}
.summary-subjective span:first-child {
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
.q-subjective .q-header {
  background: rgba(253, 246, 236, 0.5);
}
.q-subjective .q-header:hover {
  background: rgba(253, 246, 236, 0.75);
}
.q-header:hover {
  background: #fafafa;
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
.score-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.score-input {
  width: 72px;
}
.score-input :deep(.el-input__inner) {
  text-align: right;
  font-weight: 600;
  height: 32px;
}
.score-max-label {
  font-size: 12px;
  color: #c0c4cc;
}
.max-btn {
  color: #409eff;
  padding: 4px;
}
.q-chevron {
  color: #c0c4cc;
  cursor: pointer;
  margin-left: 2px;
}

/* 卡片展开体 */
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
  border-color: #ebeef5;
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
}
.opt-correct .opt-letter {
  background: #67c23a;
  color: #fff;
}
.opt-wrong .opt-letter {
  background: #f56c6c;
  color: #fff;
}
.opt-plain .opt-letter {
  background: #fff;
  color: #909399;
  border: 1px solid #dcdfe6;
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
.q-empty {
  padding: 48px 0;
  text-align: center;
  color: #c0c4cc;
  font-size: 14px;
  background: #fff;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
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

<template>
  <div class="exam-detail-page">
    <!-- ===== 加载中 ===== -->
    <div v-if="examLoading" class="ed-center">
      <el-icon :size="44" class="ed-loading-icon"><Clock /></el-icon>
      <p class="ed-loading-text">加载中...</p>
    </div>

    <!-- ===== 考试不存在 ===== -->
    <div v-else-if="!exam" class="ed-center">
      <el-icon :size="44" class="ed-loading-icon"><Warning /></el-icon>
      <p class="ed-loading-text">考试不存在或已删除</p>
      <router-link to="/evaluation/landing/exam-center" class="ed-back-link">
        <el-button size="small">返回考试中心</el-button>
      </router-link>
    </div>

    <!-- ===== 已交卷 ===== -->
    <div v-else-if="submitted" class="ed-submitted-wrap">
      <div class="ed-submitted">
        <el-icon :size="56" class="ed-submit-icon"><CircleCheck /></el-icon>
        <h2 class="ed-submit-title">试卷已提交</h2>
        <p class="ed-submit-desc">感谢您的参与，考试结果将在阅卷完成后公布。</p>
        <div class="ed-submit-actions">
          <router-link v-if="isSceneTask && sceneId" :to="`/scene/landing/${sceneId}/learn?task=${taskId}`">
            <el-button>返回学习页</el-button>
          </router-link>
          <router-link v-if="isCourseTask && courseId" :to="`/lesson/landing/${courseId}?node=${nodeId}`">
            <el-button>返回课程学习页</el-button>
          </router-link>
          <router-link to="/evaluation/landing/exam-center">
            <el-button>返回考试中心</el-button>
          </router-link>
        </div>
      </div>
    </div>

    <!-- ===== 答题中 ===== -->
    <div v-else-if="started" class="ed-answering">
      <div class="ed-answer-top">
        <h1 class="ed-answer-title">{{ exam.name }}</h1>
        <div class="ed-answer-status">
          <span :class="['ed-time-left', { urgent: timeLeft >= 0 && timeLeft < 300 }]">
            <el-icon><Clock /></el-icon>
            剩余 {{ timeLeft < 0 ? '不限时' : fmtTime(timeLeft) }}
          </span>
          <span class="ed-answered-count">已答 {{ answeredCount }} / {{ questions.length }} 题</span>
        </div>
      </div>

      <div class="ed-answer-body">
        <div class="ed-question-list">
          <div v-for="(q, idx) in questions" :key="q.id" class="ed-question-card">
            <div class="ed-question-head">
              <span class="ed-question-no">{{ idx + 1 }}.</span>
              <span class="ed-question-content">{{ q.content }}</span>
              <span class="ed-question-score">（{{ q.score }} 分）</span>
            </div>

            <!-- 单选 -->
            <el-radio-group
              v-if="q.type === 'single' && q.options"
              v-model="singleAnswers[q.id]"
              class="ed-options"
              @change="(v: string | number | boolean | undefined) => handleSingle(q.id, String(v ?? ''))"
            >
              <el-radio
                v-for="opt in q.options"
                :key="opt"
                :value="opt"
                class="ed-option"
                border
              >
                {{ opt }}
              </el-radio>
            </el-radio-group>

            <!-- 多选 -->
            <el-checkbox-group
              v-else-if="q.type === 'multiple' && q.options"
              v-model="multipleAnswers[q.id]"
              class="ed-options"
            >
              <el-checkbox
                v-for="opt in q.options"
                :key="opt"
                :value="opt"
                class="ed-option"
                border
              >
                {{ opt }}
              </el-checkbox>
            </el-checkbox-group>

            <!-- 判断 -->
            <div v-else-if="q.type === 'judge'" class="ed-judge">
              <button
                type="button"
                :class="['ed-judge-btn', { active: singleAnswers[q.id] === 'true' }]"
                @click="handleSingle(q.id, 'true')"
              >
                正确
              </button>
              <button
                type="button"
                :class="['ed-judge-btn', { active: singleAnswers[q.id] === 'false' }]"
                @click="handleSingle(q.id, 'false')"
              >
                错误
              </button>
            </div>

            <!-- 填空 -->
            <div v-else-if="q.type === 'fill'" class="ed-fill">
              <template v-for="(part, pi) in fillParts(q.content)" :key="pi">
                <span v-if="!part.blank" class="ed-fill-text">{{ part.text }}</span>
                <el-input
                  v-else
                  v-model="fillAnswers[q.id][part.index]"
                  class="ed-fill-input"
                  :placeholder="`空${part.index + 1}`"
                />
              </template>
            </div>

            <!-- 简答/问答 -->
            <el-input
              v-else-if="q.type === 'essay' || q.type === 'short_answer'"
              v-model="singleAnswers[q.id]"
              type="textarea"
              :rows="4"
              placeholder="请输入您的答案..."
              class="ed-essay"
            />
          </div>

          <div class="ed-submit-row">
            <el-button
              type="primary"
              size="large"
              class="ed-submit-btn"
              :loading="submitting"
              :disabled="!currentUsage || submitting"
              @click="handleSubmit"
            >
              <el-icon v-if="!submitting"><Promotion /></el-icon>
              {{ submitting ? '提交中...' : '提交试卷' }}
            </el-button>
          </div>
        </div>

        <!-- 答题卡 -->
        <div class="ed-answer-sheet">
          <h4 class="ed-sheet-title">答题卡</h4>
          <div class="ed-sheet-grid">
            <div
              v-for="(q, i) in questions"
              :key="q.id"
              :class="['ed-sheet-cell', { answered: isAnswered(q.id) }]"
            >
              {{ i + 1 }}
            </div>
          </div>
          <div class="ed-sheet-legend">
            <div class="ed-sheet-legend-row">
              <span class="ed-sheet-swatch answered" />已答 {{ answeredCount }} 题
            </div>
            <div class="ed-sheet-legend-row">
              <span class="ed-sheet-swatch" />未答 {{ questions.length - answeredCount }} 题
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 概览页 ===== -->
    <div v-else class="ed-overview">
      <div class="ed-overview-back">
        <router-link to="/evaluation/landing/exam-center" class="ed-back-link">
          <el-icon><ArrowLeft /></el-icon> 返回考试中心
        </router-link>
      </div>

      <!-- 主信息卡 -->
      <div class="ed-main-card">
        <div class="ed-main-head">
          <div class="ed-main-text">
            <h1 class="ed-main-title">{{ exam.name }}</h1>
            <p v-if="exam.description" class="ed-main-desc">{{ exam.description }}</p>
          </div>
          <div class="ed-main-actions">
            <el-button size="small" round :type="favorite ? 'primary' : 'default'" @click="toggleFavorite">
              <el-icon><Star /></el-icon>{{ favorite ? '已收藏试卷' : '收藏试卷' }}
            </el-button>
            <el-button size="small" round @click="copyShareLink">
              <el-icon><Share /></el-icon>分享
            </el-button>
          </div>
        </div>
        <div class="ed-stat-grid">
          <div class="ed-stat-box">
            <div class="ed-stat-icon-label"><el-icon><Clock /></el-icon>考试时长</div>
            <div class="ed-stat-value">{{ examDuration }} 分钟</div>
          </div>
          <div class="ed-stat-box">
            <div class="ed-stat-icon-label"><el-icon><List /></el-icon>题目数量</div>
            <div class="ed-stat-value">{{ questions.length }} 题</div>
          </div>
          <div class="ed-stat-box">
            <div class="ed-stat-icon-label"><el-icon><DataAnalysis /></el-icon>总分</div>
            <div class="ed-stat-value">{{ totalScore }} 分</div>
          </div>
          <div class="ed-stat-box clickable" @click="showAudienceDialog = true">
            <div class="ed-stat-icon-label"><el-icon><User /></el-icon>考试对象</div>
            <div class="ed-stat-value">
              学生（由考试安排指定）
              <el-icon class="ed-stat-info"><InfoFilled /></el-icon>
            </div>
            <div class="ed-stat-tip">点击查看范围详情</div>
          </div>
        </div>
      </div>

      <!-- 考试概览 + 考试须知 -->
      <div class="ed-two-col">
        <div class="ed-panel">
          <h3 class="ed-panel-title">
            <el-icon><Document /></el-icon> 考试概览
          </h3>
          <template v-if="questionTypeStats.length > 0">
            <div class="ed-pie-wrap">
              <DonutChart :data="questionTypeStats" :size="200" :thickness="30">
                <div class="donut-num">{{ questions.length }}</div>
                <div class="donut-label">总题数</div>
              </DonutChart>
            </div>
            <div class="ed-pie-legend">
              <div v-for="stat in questionTypeStats" :key="stat.name" class="ed-pie-legend-row">
                <span class="legend-dot" :style="{ background: stat.color }" />
                <span class="ed-pie-legend-name">{{ stat.name }}</span>
                <span class="ed-pie-legend-value">{{ stat.count }}题 / {{ stat.score }}分</span>
              </div>
            </div>
          </template>
          <div v-else class="ed-panel-empty">暂无题目数据</div>
        </div>

        <div class="ed-panel">
          <h3 class="ed-panel-title">
            <el-icon><Reading /></el-icon> 考试须知
          </h3>
          <div class="ed-notice">
            <p>1. 请在规定时间内完成所有题目，超时将自动提交。</p>
            <p>2. 单选题每题只有一个正确答案，多选题有多个正确答案。</p>
            <p>3. 答题过程中请勿刷新页面或关闭浏览器。</p>
            <p>4. 提交后无法修改答案，请确认后再提交。</p>
            <p>5. 考试期间系统将自动保存答题进度。</p>
            <p>6. 考试期间请勿切屏、退出全屏或复制试题，系统将强制提醒并记录次数。</p>
            <p v-if="currentUsage?.startTime || currentUsage?.endTime">
              开放时间：{{ formatDateTime(currentUsage?.startTime) }} ~ {{ formatDateTime(currentUsage?.endTime) }}
            </p>
          </div>
          <div class="ed-start-row">
            <el-button
              v-if="canStart"
              type="primary"
              size="large"
              class="ed-start-btn"
              @click="handleStart"
            >
              <el-icon><VideoPlay /></el-icon>开始考试
            </el-button>
            <el-button v-else size="large" class="ed-start-btn" disabled>
              <el-icon><VideoPlay /></el-icon>{{ startDisabledReason }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- 考试范围详情弹窗 -->
      <el-dialog v-model="showAudienceDialog" title="考试范围详情" width="460px">
        <p class="ed-dialog-desc">本次考试面向 学生：由考试安排指定</p>
        <div class="ed-dialog-body">参考人员名单由管理员在考试安排中指定，暂无明细数据。</div>
      </el-dialog>
    </div>

    <!-- 防作弊遮罩 -->
    <div v-if="warnMask" class="ed-warn-mask">
      <div class="ed-warn-card">
        <el-icon :size="52" class="ed-warn-icon"><Warning /></el-icon>
        <h3 class="ed-warn-title">{{ warnMask.reason === 'fullscreen' ? '请勿退出全屏' : '请勿切换屏幕' }}</h3>
        <p class="ed-warn-desc">
          {{
            warnMask.reason === 'fullscreen'
              ? '考试期间请保持全屏答题，退出全屏可能影响考试纪律。'
              : `已第 ${warnMask.count} 次离开答题页面，请勿切屏搜索答案，专注答题！`
          }}
        </p>
        <div class="ed-warn-actions">
          <el-button type="primary" @click="handleResume">
            <el-icon><VideoPlay /></el-icon>继续考试
          </el-button>
          <el-button type="danger" @click="handleEndExam">
            <el-icon><Promotion /></el-icon>结束考试
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  ArrowLeft,
  CircleCheck,
  Clock,
  DataAnalysis,
  Document,
  InfoFilled,
  List,
  Promotion,
  Reading,
  Share,
  Star,
  User,
  VideoPlay,
  Warning
} from '@element-plus/icons-vue';
import { examApi, examUsageApi } from '@/api/evaluation';
import { request } from '@/api/http';
import { favoriteApi } from '@/api/portal';
import type { Exam, ExamUsage } from '@/types/evaluation';
import { QUESTION_TYPE_LABELS } from '@/types/evaluation';
import DonutChart from './DonutChart.vue';
import { formatDateTime } from './evaluation-types';
import type { ExamSubmitRequest } from './evaluation-types';

const PIE_COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

const route = useRoute();
const examId = route.params.id as string;
const usageIdFromQuery = typeof route.query.usage === 'string' ? route.query.usage : '';
const taskId = typeof route.query.task === 'string' ? route.query.task : '';
const sceneId = typeof route.query.scene === 'string' ? route.query.scene : '';
const courseId = typeof route.query.course === 'string' ? route.query.course : '';
const nodeId = typeof route.query.node === 'string' ? route.query.node : '';
const methodKey = typeof route.query.method === 'string' ? route.query.method : '';

const isSceneTask = computed(() => !!taskId && !!methodKey);
const isCourseTask = computed(() => !!courseId && !!nodeId);

// ===== 状态 =====
const exam = ref<Exam | null>(null);
const examLoading = ref(true);
const currentUsage = ref<ExamUsage | null>(null);
const started = ref(false);
const submitted = ref(false);
const submitting = ref(false);
const timeLeft = ref(0);
const showAudienceDialog = ref(false);
const favorite = ref(false);

// 答案：单选/判断/简答用 string；多选用 string[]；填空用 string[]
const singleAnswers = reactive<Record<string, string>>({});
const multipleAnswers = reactive<Record<string, string[]>>({});
const fillAnswers = reactive<Record<string, string[]>>({});

const questions = computed(() => exam.value?.questions || []);

const examDuration = computed(() => currentUsage.value?.duration ?? exam.value?.duration ?? 0);

const usageWindowState = computed<'open' | 'not_started' | 'ended'>(() => {
  const u = currentUsage.value;
  if (!u) return 'open';
  const now = Date.now();
  if (u.startTime && now < new Date(u.startTime).getTime()) return 'not_started';
  if (u.endTime && now > new Date(u.endTime).getTime()) return 'ended';
  return 'open';
});

const canStart = computed(
  () =>
    (isSceneTask.value || exam.value?.status === 'published') &&
    !!currentUsage.value &&
    (currentUsage.value.status === 'published' || currentUsage.value.status === 'in_progress') &&
    usageWindowState.value === 'open'
);

const startDisabledReason = computed(() => {
  const u = currentUsage.value;
  if (!u) return '暂无考试安排';
  if (u.status === 'draft' || u.status === 'pending') return '考试未开放';
  if (usageWindowState.value === 'not_started') return `考试未开始（${formatDateTime(u.startTime)} 开放）`;
  if (usageWindowState.value === 'ended') return '考试已结束';
  if (
    !isSceneTask.value &&
    (exam.value?.status === 'draft' ||
      exam.value?.status === 'pending' ||
      exam.value?.status === 'rejected' ||
      exam.value?.status === 'approved')
  ) {
    return '考试未发布';
  }
  return '考试已结束';
});

const totalScore = computed(() => questions.value.reduce((s, q) => s + (q.score || 0), 0));

const answeredCount = computed(() => {
  let n = 0;
  for (const k of Object.keys(singleAnswers)) if (singleAnswers[k] !== '') n++;
  for (const k of Object.keys(multipleAnswers)) if ((multipleAnswers[k] || []).length > 0) n++;
  for (const k of Object.keys(fillAnswers)) if ((fillAnswers[k] || []).some((v) => v !== '')) n++;
  return n;
});

function isAnswered(qid: string): boolean {
  if (singleAnswers[qid] !== undefined && singleAnswers[qid] !== '') return true;
  if ((multipleAnswers[qid] || []).length > 0) return true;
  if ((fillAnswers[qid] || []).some((v) => v !== '')) return true;
  return false;
}

const questionTypeStats = computed(() => {
  const stats: Record<string, { count: number; score: number }> = {};
  questions.value.forEach((q) => {
    const label = QUESTION_TYPE_LABELS[q.type] || q.type;
    if (!stats[label]) stats[label] = { count: 0, score: 0 };
    stats[label].count += 1;
    stats[label].score += q.score;
  });
  return Object.entries(stats).map(([name, s], index) => ({
    name,
    count: s.count,
    score: s.score,
    value: s.count,
    color: PIE_COLORS[index % PIE_COLORS.length]
  }));
});

// ===== 加载 =====
async function load() {
  examLoading.value = true;
  // 考试安排按 examId 查询（scope=all：场景任务/课程节点的自动安排不在默认范围）
  try {
    const res = await examUsageApi.list({ examId, scope: 'all' });
    const items = res.items || [];
    currentUsage.value = items.find((u) => u.id === usageIdFromQuery) || items[0] || null;
  } catch {
    currentUsage.value = null;
  }
  try {
    // Vue 侧无快照 bundle 接口，走 live 试卷（含题目内容副本）
    exam.value = await examApi.get(examId);
    try {
      const fav = await favoriteApi.get('exam', examId);
      favorite.value = fav.isFavorite;
    } catch {
      /* 未登录等场景忽略收藏状态 */
    }
  } catch {
    exam.value = null;
  } finally {
    examLoading.value = false;
  }
}
onMounted(load);

// ===== 答题交互 =====
function handleSingle(qid: string, val: string) {
  singleAnswers[qid] = val;
}

// 填空/多选题目预置答案容器，保证 v-model 索引可写
watch(
  questions,
  (qs) => {
    qs.forEach((q) => {
      if (q.type === 'fill') {
        const blanks = (q.content.match(/\{\d+\}/g) || []).length;
        if (!fillAnswers[q.id]) fillAnswers[q.id] = Array(blanks).fill('');
      } else if (q.type === 'multiple') {
        if (!multipleAnswers[q.id]) multipleAnswers[q.id] = [];
      }
    });
  },
  { immediate: true }
);

function fillParts(content: string): { text: string; blank: boolean; index: number }[] {
  let blankIndex = -1;
  return content.split(/(\{\d+\})/).map((part) => {
    if (/\{\d+\}/.test(part)) {
      blankIndex++;
      return { text: part, blank: true, index: blankIndex };
    }
    return { text: part, blank: false, index: -1 };
  });
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ===== 开始 / 提交 =====
function handleStart() {
  started.value = true;
  // 时长为 0/未配置视为不限时（-1 表示不限时，不触发自动交卷）
  timeLeft.value = examDuration.value > 0 ? examDuration.value * 60 : -1;
  // 进入全屏（须由用户点击触发；移动端不支持则静默忽略）
  document.documentElement.requestFullscreen?.().catch(() => {});
}

const endingExam = ref(false);
const autoSubmitted = ref(false);

async function handleSubmit() {
  if (!currentUsage.value) return;
  endingExam.value = true;
  submitting.value = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  try {
    const answers: Record<string, string | string[]> = {
      ...singleAnswers,
      ...multipleAnswers,
      ...fillAnswers
    };
    const body: ExamSubmitRequest = {
      examUsageId: currentUsage.value.id,
      answers,
      ...(methodKey ? { methodKey } : {})
    };
    await request('/evaluation/exam-results', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    submitted.value = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : '请重试';
    ElMessage.error(`提交失败：${msg}`);
  } finally {
    submitting.value = false;
  }
}

// 倒计时 + 归零自动交卷
let timer: number | undefined;
watch([started, submitted], ([s, sub]) => {
  if (timer) {
    window.clearInterval(timer);
    timer = undefined;
  }
  if (s && !sub) {
    timer = window.setInterval(() => {
      if (timeLeft.value > 0) timeLeft.value -= 1;
    }, 1000);
  }
});

watch([started, submitted, timeLeft], () => {
  if (started.value && !submitted.value && !autoSubmitted.value && timeLeft.value === 0) {
    autoSubmitted.value = true;
    handleSubmit();
  }
});

// ===== 防作弊监控（仅答题期间生效） =====
const leavePageCount = ref(0);
const warnMask = ref<{ reason: 'leave' | 'fullscreen'; count: number } | null>(null);
const maskShown = ref(false);

function showWarnMask(reason: 'leave' | 'fullscreen') {
  if (maskShown.value) return;
  maskShown.value = true;
  warnMask.value = { reason, count: leavePageCount.value };
}

function dismissWarnMask() {
  maskShown.value = false;
  warnMask.value = null;
}

function handleResume() {
  dismissWarnMask();
  document.documentElement.requestFullscreen?.().catch(() => {});
}

function handleEndExam() {
  dismissWarnMask();
  handleSubmit();
}

let cleanupEvents: (() => void) | undefined;

watch([started, submitted], ([s, sub]) => {
  if (cleanupEvents) {
    cleanupEvents();
    cleanupEvents = undefined;
  }
  if (!s || sub) return;

  const warnLeave = () => {
    leavePageCount.value += 1;
    showWarnMask('leave');
  };
  const onVisibilityChange = () => {
    if (document.hidden) warnLeave();
  };
  const onWindowBlur = () => {
    if (!document.hidden) warnLeave();
  };
  const onCopy = (e: ClipboardEvent) => {
    e.preventDefault();
    const sel = window.getSelection()?.toString() || '';
    if (sel.trim()) {
      ElMessage.error('请勿复制题目！');
    }
  };
  const onContextMenu = (e: Event) => e.preventDefault();
  const onFullScreenChange = () => {
    if (!document.fullscreenElement && !endingExam.value) {
      showWarnMask('fullscreen');
    }
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('copy', onCopy);
  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('fullscreenchange', onFullScreenChange);
  window.addEventListener('beforeunload', onBeforeUnload);

  cleanupEvents = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('fullscreenchange', onFullScreenChange);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
  if (cleanupEvents) cleanupEvents();
});

// ===== 收藏 / 分享 =====
async function toggleFavorite() {
  try {
    const res = await favoriteApi.toggle('exam', examId);
    favorite.value = res.isFavorite;
    ElMessage.success(res.isFavorite ? '已收藏' : '已取消收藏');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function copyShareLink() {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success('链接已复制');
  } catch {
    ElMessage.info(`当前页面链接：${url}`);
  }
}
</script>

<style scoped>
.exam-detail-page {
  min-height: 100vh;
  background: #f5f6f7;
  padding: 16px;
  box-sizing: border-box;
}

/* ===== 通用 ===== */
.ed-center {
  max-width: 1400px;
  margin: 0 auto;
  text-align: center;
  padding: 80px 0;
  color: #8f959e;
}
.ed-loading-icon { margin: 0 auto 12px; opacity: 0.35; }
.ed-loading-text { font-size: 14px; color: #8f959e; }
.ed-back-link { text-decoration: none; }

/* ===== 已交卷 ===== */
.ed-submitted-wrap {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 0 24px;
}
.ed-submitted {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e6eb;
  padding: 32px;
  text-align: center;
}
.ed-submit-icon { color: #34c759; margin-bottom: 14px; }
.ed-submit-title { font-size: 22px; font-weight: 700; margin: 0 0 8px; color: #1f2329; }
.ed-submit-desc { color: #8f959e; font-size: 14px; margin: 0; }
.ed-submit-actions {
  margin-top: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

/* ===== 答题中 ===== */
.ed-answering {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 0 24px;
}
.ed-answer-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.ed-answer-title {
  font-size: 17px;
  font-weight: 700;
  margin: 0;
  color: #1f2329;
  min-width: 0;
}
.ed-answer-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  font-size: 13px;
}
.ed-time-left {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #8f959e;
}
.ed-time-left.urgent { color: #dc2626; }
.ed-answered-count { color: #8f959e; }

.ed-answer-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
@media (min-width: 1024px) {
  .ed-answer-body { flex-direction: row; align-items: flex-start; }
}
.ed-question-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.ed-question-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e6eb;
  padding: 20px;
}
.ed-question-head {
  margin-bottom: 14px;
  font-size: 14px;
}
.ed-question-no { font-weight: 600; color: #8f959e; }
.ed-question-content { font-weight: 600; color: #1f2329; white-space: pre-wrap; word-break: break-word; }
.ed-question-score { margin-left: 8px; font-size: 12px; color: #8f959e; }

.ed-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}
.ed-option {
  width: 100%;
  margin: 0;
  height: 44px;
  border-radius: 8px;
}
.ed-judge {
  display: flex;
  gap: 12px;
  padding-top: 4px;
}
.ed-judge-btn {
  padding: 8px 24px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.ed-judge-btn:hover { border-color: #2563eb; color: #2563eb; }
.ed-judge-btn.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
}
.ed-fill {
  font-size: 14px;
  line-height: 2.2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.ed-fill-text { white-space: pre-wrap; }
.ed-fill-input { width: 90px; }
.ed-fill-input :deep(.el-input__wrapper) { border-radius: 6px; text-align: center; }
.ed-essay { margin-top: 4px; }

.ed-submit-row {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}
.ed-submit-btn { gap: 6px; padding: 0 40px; }

/* 答题卡 */
.ed-answer-sheet {
  position: sticky;
  top: 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e6eb;
  padding: 18px;
  width: 100%;
  box-sizing: border-box;
}
@media (min-width: 1024px) {
  .ed-answer-sheet { width: 280px; flex-shrink: 0; }
}
.ed-sheet-title { font-size: 14px; font-weight: 600; margin: 0 0 12px; color: #1f2329; }
.ed-sheet-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.ed-sheet-cell {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  background: #f5f6f7;
  color: #646a73;
}
.ed-sheet-cell.answered {
  background: #3370ff;
  color: #fff;
}
.ed-sheet-legend {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #e5e6eb;
  font-size: 13px;
  color: #8f959e;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ed-sheet-legend-row { display: flex; align-items: center; gap: 8px; }
.ed-sheet-swatch {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: #f5f6f7;
  border: 1px solid #e5e6eb;
}
.ed-sheet-swatch.answered { background: #3370ff; border-color: #3370ff; }

/* ===== 概览 ===== */
.ed-overview {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 0 24px;
}
.ed-overview-back {
  margin-bottom: 16px;
}
.ed-back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
}
.ed-back-link:hover { color: var(--el-color-primary); }

.ed-main-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e6eb;
  overflow: hidden;
  margin-bottom: 20px;
}
.ed-main-head {
  padding: 20px 16px;
  background: linear-gradient(135deg, var(--el-color-primary-light-1), var(--el-color-primary));
  color: #fff;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.ed-main-text { min-width: 0; flex: 1; }
.ed-main-title { font-size: 21px; font-weight: 700; margin: 0 0 6px; color: #fff; }
.ed-main-desc { font-size: 13px; opacity: 0.92; margin: 0; }
.ed-main-actions { display: flex; gap: 8px; flex-shrink: 0; }

.ed-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
}
@media (min-width: 1024px) {
  .ed-stat-grid { grid-template-columns: repeat(4, 1fr); }
}
.ed-stat-box {
  text-align: center;
  padding: 14px 0;
  background: #f5f6f7;
  border-radius: 8px;
}
.ed-stat-box.clickable {
  background: #fff7ed;
  border: 1px dashed #f97316;
  cursor: pointer;
  transition: background 0.2s;
}
.ed-stat-box.clickable:hover { background: #ffedd5; }
.ed-stat-icon-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-color-primary);
  margin-bottom: 6px;
}
.ed-stat-box.clickable .ed-stat-icon-label { color: #f97316; }
.ed-stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #1f2329;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
}
.ed-stat-box.clickable .ed-stat-value { color: #ea580c; }
.ed-stat-info { font-size: 13px; opacity: 0.7; }
.ed-stat-tip { font-size: 11px; color: #f97316; margin-top: 4px; }

.ed-two-col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
@media (min-width: 900px) {
  .ed-two-col { grid-template-columns: 1fr 1fr; }
}
.ed-panel {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e6eb;
  padding: 22px;
}
.ed-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 14px;
  color: #1f2329;
}
.ed-panel-title .el-icon { color: #3370ff; }
.ed-pie-wrap { display: flex; justify-content: center; padding: 8px 0 14px; }
.ed-pie-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.ed-pie-legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px;
  background: #f5f6f7;
  border-radius: 8px;
  font-size: 13px;
}
.ed-pie-legend-name { color: #1f2329; }
.ed-pie-legend-value { font-size: 12px; color: #8f959e; margin-left: auto; }
.ed-panel-empty { text-align: center; font-size: 13px; color: #8f959e; padding: 20px; }

.ed-notice {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  color: #646a73;
  line-height: 1.7;
}
.ed-notice p { margin: 0; }
.ed-start-row {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
}
.ed-start-btn { gap: 6px; padding: 0 40px; }

.ed-dialog-desc { margin: 0 0 10px; font-size: 14px; color: #1f2329; }
.ed-dialog-body {
  padding: 20px 0;
  text-align: center;
  font-size: 13px;
  color: #8f959e;
}

/* ===== 防作弊遮罩 ===== */
.ed-warn-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.ed-warn-card {
  background: #fff;
  border-radius: 16px;
  max-width: 440px;
  width: 100%;
  padding: 32px 28px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
.ed-warn-icon { color: #f59e0b; margin-bottom: 14px; }
.ed-warn-title { font-size: 19px; font-weight: 700; color: #1f2329; margin: 0 0 8px; }
.ed-warn-desc {
  font-size: 13px;
  color: #646a73;
  line-height: 1.7;
  margin: 0 0 20px;
}
.ed-warn-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>

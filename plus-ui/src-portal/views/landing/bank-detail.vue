<template>
  <div class="bank-detail-page">
    <!-- 加载中 -->
    <div v-if="loading" class="bd-loading">
      <div class="bd-loading-hero" />
      <div class="bd-loading-body" />
    </div>

    <!-- 不存在 / 加载失败 -->
    <div v-else-if="!bank" class="bd-notfound">
      <template v-if="loadError">
        <div class="nf-icon nf-error"><el-icon :size="36"><Warning /></el-icon></div>
        <div class="nf-title">加载失败</div>
        <div class="nf-hint">{{ loadError }}</div>
        <el-button size="small" @click="reload">重试</el-button>
        <router-link to="/evaluation/landing" class="nf-back">返回测评首页</router-link>
      </template>
      <template v-else>
        <div class="nf-icon"><el-icon :size="36"><Collection /></el-icon></div>
        <div class="nf-title">题库不存在或暂未公开</div>
        <router-link to="/evaluation/landing" class="nf-back">返回测评首页</router-link>
      </template>
    </div>

    <!-- 主体 -->
    <template v-else>
      <!-- 头部 -->
      <div class="bd-head">
        <div class="bd-head-inner">
          <!-- 面包屑 -->
          <div class="bd-breadcrumb">
            <button type="button" class="bc-back" @click="goBack">
              <span class="bc-back-icon">←</span> 返回上一页
            </button>
            <span class="bc-sep">/</span>
            <router-link to="/evaluation/landing" class="bc-link">测评首页</router-link>
            <span class="bc-sep">/</span>
            <span class="bc-current">{{ bank.name }}</span>
          </div>

          <div class="bd-card-row">
            <!-- 主信息卡 -->
            <div class="bd-main-card">
              <div class="bd-cover" :style="coverStyle">
                <el-icon v-if="!bank.coverImage" :size="56" class="bd-cover-icon"><Collection /></el-icon>
                <span v-if="bank.version" class="bd-cover-version">{{ bank.version }}</span>
              </div>
              <div class="bd-info">
                <h1 class="bd-name">{{ bank.name }}</h1>
                <div class="bd-meta">
                  <span v-if="bank.creatorName">创建人：{{ bank.creatorName }}</span>
                  <span class="bd-meta-item"><el-icon><Clock /></el-icon>更新于 {{ formatDate(bank.updatedAt) }}</span>
                  <span class="bd-meta-item"><el-icon><Files /></el-icon>{{ bank.questionCount }} 题</span>
                </div>
                <p v-if="bank.description" class="bd-desc">{{ bank.description }}</p>
                <div class="bd-actions">
                  <el-button
                    :type="favorite ? 'primary' : 'default'"
                    size="small"
                    round
                    @click="toggleFavorite"
                  >
                    <el-icon><Star /></el-icon>{{ favorite ? '已收藏题库' : '收藏题库' }}
                  </el-button>
                  <el-button size="small" round @click="copyShareLink">
                    <el-icon><Share /></el-icon>分享
                  </el-button>
                  <div v-if="typeCountsList.length > 0" class="bd-type-chips">
                    <span
                      v-for="tc in typeCountsList"
                      :key="tc.type"
                      class="bd-type-chip"
                      :style="typeChipStyle(tc.type)"
                    >
                      {{ QUESTION_TYPE_LABELS[tc.type as QuestionType] || tc.type }} ×{{ tc.count }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 题库统计卡 -->
            <div class="bd-stats-card">
              <div class="bd-stats-title">
                <span class="bd-stats-icon"><el-icon><DataAnalysis /></el-icon></span>
                题库统计
              </div>
              <div v-if="pieData.length === 0" class="bd-stats-empty">暂无题目</div>
              <template v-else>
                <DonutChart :data="pieData" :size="180" :thickness="22">
                  <div class="donut-num">{{ questions.length }}</div>
                  <div class="donut-label">总题量</div>
                </DonutChart>
                <div class="bd-legend">
                  <div v-for="entry in pieData" :key="entry.name" class="legend-row">
                    <span class="legend-dot" :style="{ background: entry.color }" />
                    <span class="legend-name">{{ entry.name }}</span>
                    <span class="legend-value">{{ entry.value }} 题</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 题目列表 -->
      <main class="bd-main">
        <div class="bd-questions-card">
          <div class="bd-questions-head">
            <div class="bd-questions-left">
              <el-icon class="bd-questions-icon"><Document /></el-icon>
              <span class="bd-questions-title">题目列表（{{ filteredQuestions.length }} / {{ questions.length }} 题）</span>
              <button type="button" class="bd-toggle-answers" @click="showAllAnswers = !showAllAnswers">
                {{ showAllAnswers ? '隐藏全部答案' : '显示全部答案' }}
              </button>
            </div>
            <div class="bd-questions-tools">
              <el-input
                v-model="search"
                class="bd-search"
                placeholder="搜索题目内容或知识点"
                clearable
              />
              <el-select v-if="questionTypes.length > 1" v-model="typeFilter" class="bd-type-select">
                <el-option v-for="t in questionTypes" :key="t" :label="t === '全部' ? '全部题型' : (QUESTION_TYPE_LABELS[t as QuestionType] || t)" :value="t" />
              </el-select>
            </div>
          </div>

          <div class="bd-questions-body">
            <div v-if="questions.length === 0" class="bd-empty">
              <div class="bd-empty-icon"><el-icon :size="30"><Document /></el-icon></div>
              <div class="bd-empty-title">暂无题目</div>
              <div class="bd-empty-hint">该题库暂未收录题目</div>
            </div>
            <div v-else-if="filteredQuestions.length === 0" class="bd-empty">
              <div class="bd-empty-title">没有匹配的题目</div>
              <div class="bd-empty-hint">请调整搜索条件或筛选</div>
            </div>
            <div v-else class="bd-question-list">
              <div v-for="(q, idx) in filteredQuestions" :key="q.id" class="bd-question">
                <div class="bd-q-body">
                  <div class="bd-q-index">{{ idx + 1 }}</div>
                  <div class="bd-q-content-wrap">
                    <div class="bd-q-tags">
                      <span class="bd-q-type" :style="typeBadgeStyle(q.type)">
                        {{ QUESTION_TYPE_LABELS[q.type] || q.type }}
                      </span>
                      <span v-if="q.difficulty" class="bd-q-diff" :style="diffBadgeStyle(q.difficulty)">
                        {{ DIFFICULTY_LABELS[q.difficulty] || q.difficulty }}
                      </span>
                      <span class="bd-q-score">{{ q.score }} 分</span>
                    </div>
                    <p class="bd-q-content">{{ q.content }}</p>
                    <div v-if="q.options && q.options.length > 0" class="bd-q-options">
                      <div v-for="(opt, oi) in q.options" :key="oi" class="bd-q-option">
                        <span class="bd-q-option-letter">{{ String.fromCharCode(65 + oi) }}</span>
                        {{ opt }}
                      </div>
                    </div>
                    <div v-if="q.knowledgePoints && q.knowledgePoints.length > 0" class="bd-q-kps">
                      <span
                        v-for="kp in q.knowledgePoints.slice(0, 4)"
                        :key="kp"
                        class="bd-q-kp"
                      >
                        {{ knowledgePointMap[kp] || kp }}
                      </span>
                    </div>
                    <div v-if="showAllAnswers || q.type !== 'essay'" class="bd-q-answer">
                      <button type="button" class="bd-q-answer-toggle" @click="toggleAnswer(q.id)">
                        <el-icon><QuestionFilled /></el-icon>
                        {{ answerVisible[q.id] ? '隐藏答案' : '查看答案' }}
                      </button>
                      <div v-if="answerVisible[q.id]" class="bd-q-answer-body">
                        <span class="bd-q-answer-label">答案：</span>
                        <span class="bd-q-answer-text">
                          {{ Array.isArray(q.answer) ? q.answer.join('；') : q.answer }}
                        </span>
                        <div v-if="q.analysis" class="bd-q-analysis">
                          <span>解析：</span>{{ q.analysis }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Clock, Collection, DataAnalysis, Document, Files, QuestionFilled, Share, Star, Warning } from '@element-plus/icons-vue';
import { questionBankApi, questionApi } from '@/api/evaluation';
import { knowledgeApi } from '@/api/lesson';
import { favoriteApi } from '@/api/portal';
import type { Question, QuestionBank, QuestionType } from '@/types/evaluation';
import { QUESTION_TYPE_LABELS } from '@/types/evaluation';
import DonutChart from './DonutChart.vue';
import {
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_BADGE_COLORS,
  QUESTION_TYPE_CHART_COLORS,
  coverGradientFor,
  formatDate
} from './evaluation-types';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

const bank = ref<QuestionBank | null>(null);
const questions = ref<Question[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const reloadKey = ref(0);
const search = ref('');
const typeFilter = ref('全部');
const showAllAnswers = ref(false);
const knowledgePointMap = ref<Record<string, string>>({});
const favorite = ref(false);
const answerVisible = reactive<Record<string, boolean>>({});

// ===== 加载 =====
async function fetchAllQuestions(bankId: string): Promise<Question[]> {
  const PAGE = 500;
  const out: Question[] = [];
  for (let offset = 0; offset < 20000; offset += PAGE) {
    const res = await questionApi.list({ bankId, limit: PAGE, offset });
    out.push(...(res.items || []));
    if (!res.items || res.items.length < PAGE) break;
  }
  return out;
}

async function loadData() {
  loading.value = true;
  loadError.value = null;
  // 题库本身加载失败视为「不存在或未公开」（对齐 React 404 分支）
  let bankRes: QuestionBank | null = null;
  try {
    bankRes = await questionBankApi.get(id);
  } catch {
    bankRes = null;
  }
  bank.value = bankRes;
  if (bankRes) {
    try {
      const [allQuestions, kpRes] = await Promise.all([
        fetchAllQuestions(id),
        knowledgeApi.list({ limit: 1000 }).catch(() => ({ items: [] }))
      ]);
      questions.value = allQuestions;
      const map: Record<string, string> = {};
      (kpRes.items || []).forEach((kp: { id: string; name: string }) => {
        map[kp.id] = kp.name;
      });
      knowledgePointMap.value = map;
      try {
        const fav = await favoriteApi.get('question_bank', id);
        favorite.value = fav.isFavorite;
      } catch {
        /* 未登录等场景忽略收藏状态 */
      }
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : '加载失败';
    }
  }
  loading.value = false;
}

function reload() {
  reloadKey.value += 1;
  loadData();
}

onMounted(loadData);

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/evaluation/landing');
  }
}

async function toggleFavorite() {
  try {
    const res = await favoriteApi.toggle('question_bank', id);
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

// ===== 题目统计 =====
const questionTypes = computed(() => {
  const types = new Set(questions.value.map((q) => q.type));
  return ['全部', ...Array.from(types)];
});

const filteredQuestions = computed(() => {
  let list = questions.value;
  if (typeFilter.value !== '全部') list = list.filter((q) => q.type === typeFilter.value);
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(
      (item) =>
        item.content.toLowerCase().includes(q) ||
        (item.knowledgePoints || []).some((kp) => kp.toLowerCase().includes(q))
    );
  }
  return list;
});

const typeCountsList = computed(() => {
  const counts: Record<string, number> = {};
  questions.value.forEach((q) => {
    counts[q.type] = (counts[q.type] || 0) + 1;
  });
  return Object.entries(counts).map(([type, count]) => ({ type, count }));
});

const pieData = computed(() =>
  typeCountsList.value.map((tc) => ({
    name: QUESTION_TYPE_LABELS[tc.type as QuestionType] || tc.type,
    value: tc.count,
    color: QUESTION_TYPE_CHART_COLORS[tc.type] || '#94a3b8'
  }))
);

// ===== 样式助手 =====
const coverStyle = computed(() =>
  bank.value?.coverImage
    ? {
        backgroundImage: `url('${bank.value.coverImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    : { background: coverGradientFor(bank.value?.id || '') }
);

function typeChipStyle(type: string) {
  const c = QUESTION_TYPE_BADGE_COLORS[type] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
  return { background: c.bg, color: c.color, borderColor: c.border };
}

function typeBadgeStyle(type: string) {
  const c = QUESTION_TYPE_BADGE_COLORS[type] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
  return { background: c.bg, color: c.color, borderColor: c.border };
}

function diffBadgeStyle(difficulty: string) {
  const color = DIFFICULTY_COLORS[difficulty] || '#94a3b8';
  return { background: color + '15', color, borderColor: color + '30' };
}

function toggleAnswer(qid: string) {
  answerVisible[qid] = !answerVisible[qid];
}
</script>

<style scoped>
.bank-detail-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

/* ===== 加载 ===== */
.bd-loading { padding: 24px; }
.bd-loading-hero {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  height: 280px;
  animation: bd-pulse 1.6s ease-in-out infinite;
}
.bd-loading-body {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  height: 400px;
  margin-top: 16px;
  animation: bd-pulse 1.6s ease-in-out infinite;
}
@keyframes bd-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ===== 不存在 / 失败 ===== */
.bd-notfound {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  color: #94a3b8;
}
.nf-icon {
  width: 76px;
  height: 76px;
  margin-bottom: 18px;
  border-radius: 20px;
  background: #f1f5f9;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nf-icon.nf-error { background: #fef2f2; color: #f87171; }
.nf-title {
  font-size: 17px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}
.nf-hint {
  font-size: 13px;
  color: #94a3b8;
  max-width: 420px;
  text-align: center;
  margin-bottom: 14px;
}
.nf-back {
  margin-top: 12px;
  color: var(--el-color-primary);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
}

/* ===== 头部 ===== */
.bd-head {
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}
.bd-head-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
}
.bd-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 18px;
}
.bc-back {
  border: none;
  background: none;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
}
.bc-back:hover { color: var(--el-color-primary); }
.bc-back-icon {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.bc-sep { color: #cbd5e1; }
.bc-link {
  color: #64748b;
  text-decoration: none;
}
.bc-link:hover { color: var(--el-color-primary); }
.bc-current {
  color: #1e293b;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.bd-card-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@media (min-width: 1024px) {
  .bd-card-row { flex-direction: row; }
}
.bd-main-card {
  flex: 1;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
@media (min-width: 640px) {
  .bd-main-card { flex-direction: row; }
}
.bd-cover {
  width: 100%;
  height: 190px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}
@media (min-width: 640px) {
  .bd-cover { width: 280px; }
}
.bd-cover-icon { color: rgba(255, 255, 255, 0.85); }
.bd-cover-version {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.bd-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.bd-name {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bd-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 18px;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 12px;
}
.bd-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.bd-meta-item .el-icon { font-size: 13px; }
.bd-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #475569;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bd-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 12px;
}
.bd-type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.bd-type-chip {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid;
}

/* 统计卡 */
.bd-stats-card {
  width: 100%;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  padding: 16px;
  box-sizing: border-box;
}
@media (min-width: 1024px) {
  .bd-stats-card { width: 320px; flex-shrink: 0; }
}
.bd-stats-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 16px;
}
.bd-stats-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.bd-stats-empty {
  text-align: center;
  padding: 40px 0;
  color: #94a3b8;
  font-size: 13px;
}
.bd-legend {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ===== 题目列表 ===== */
.bd-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px 48px;
  width: 100%;
  box-sizing: border-box;
  flex: 1;
}
.bd-questions-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}
.bd-questions-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}
@media (min-width: 640px) {
  .bd-questions-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.bd-questions-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.bd-questions-icon { color: var(--el-color-primary); }
.bd-questions-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}
.bd-toggle-answers {
  border: none;
  background: none;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}
.bd-toggle-answers:hover { color: var(--el-color-primary); }
.bd-questions-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.bd-search { width: 100%; max-width: 260px; }
.bd-search :deep(.el-input__wrapper) {
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  background: #f8fafc;
}
.bd-type-select { width: 150px; }

.bd-questions-body {
  padding: 16px 20px;
  min-height: 400px;
}
.bd-empty { text-align: center; padding: 60px 0; color: #94a3b8; }
.bd-empty-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 12px;
  border-radius: 14px;
  background: #f8fafc;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bd-empty-title { font-size: 15px; font-weight: 500; color: #475569; }
.bd-empty-hint { font-size: 13px; margin-top: 4px; }

.bd-question-list { display: flex; flex-direction: column; gap: 12px; }
.bd-question {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.2s;
}
.bd-question:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  border-color: var(--el-color-primary-light-5);
}
.bd-q-body {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px;
}
.bd-q-index {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-1));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 3px 8px rgba(64, 158, 255, 0.25);
}
.bd-q-content-wrap { flex: 1; min-width: 0; }
.bd-q-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.bd-q-type {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid;
}
.bd-q-diff {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid;
}
.bd-q-score {
  font-size: 11px;
  color: #94a3b8;
}
.bd-q-content {
  margin: 0 0 8px;
  font-size: 14px;
  color: #334155;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.bd-q-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}
.bd-q-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
  padding-left: 4px;
}
.bd-q-option-letter {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #94a3b8;
  flex-shrink: 0;
}
.bd-q-kps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.bd-q-kp {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 6px;
  background: #f8fafc;
  color: #94a3b8;
  border: 1px solid #f1f5f9;
}
.bd-q-answer {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f8fafc;
}
.bd-q-answer-toggle {
  border: none;
  background: none;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
}
.bd-q-answer-toggle:hover { color: var(--el-color-primary); }
.bd-q-answer-body {
  margin-top: 6px;
  font-size: 12px;
}
.bd-q-answer-label { color: #94a3b8; }
.bd-q-answer-text { color: #334155; font-weight: 500; }
.bd-q-analysis {
  margin-top: 4px;
  color: #94a3b8;
}
.bd-q-analysis span { color: #94a3b8; }
</style>

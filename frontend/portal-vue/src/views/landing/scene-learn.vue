<template>
  <div class="landing">
    <!-- ===== 加载中 ===== -->
    <template v-if="loading">
      <div class="skeleton-block skeleton-header" />
      <main class="sl-main">
        <div class="skeleton-block" />
      </main>
    </template>

    <!-- ===== 场景不存在 ===== -->
    <div v-else-if="!scenario" class="sl-empty">
      <el-icon :size="64" class="sl-empty-icon"><Files /></el-icon>
      <p class="sl-empty-title">场景不存在或暂未公开</p>
      <router-link to="/scene/landing" class="sl-empty-link">返回场景列表</router-link>
    </div>

    <main v-else class="sl-main">
      <!-- 返回场景详情 -->
      <router-link :to="detailHref" replace class="sl-back">
        <el-icon><ArrowLeft /></el-icon> 返回场景详情
      </router-link>

      <div class="sl-layout">
        <!-- 任务列表侧栏 -->
        <aside class="sl-sidebar">
          <div class="sl-sidebar-head">
            <span>任务列表</span>
            <span class="sl-sidebar-count">{{ tasks.length }} 个任务</span>
          </div>
          <div v-if="tasks.length === 0" class="sl-sidebar-empty">暂无任务</div>
          <div v-else class="sl-sidebar-list">
            <div
              v-for="(task, idx) in tasks"
              :key="task.id"
              :class="['sl-task-item', { active: task.id === activeTaskId }]"
              @click="activeTaskId = task.id"
            >
              <div class="sl-task-no">{{ idx + 1 }}</div>
              <div class="sl-task-info">
                <div class="sl-task-name">{{ task.name }}</div>
                <div class="sl-task-meta">
                  {{ task.taskType === 'assessment' ? '考核' : '训练' }} · {{ task.estimatedHours || 0 }}h
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- 任务详情 -->
        <section class="sl-detail">
          <template v-if="!activeTask">
            <div class="sl-empty-inner">
              <el-icon :size="48" class="sl-empty-icon"><Tickets /></el-icon>
              <p class="sl-empty-title">选择一个任务开始学习</p>
              <p class="sl-empty-hint">从左侧任务列表中点击任务</p>
            </div>
          </template>

          <template v-else>
            <!-- 任务头 -->
            <div class="sl-task-head">
              <div class="sl-task-title">
                <h2>{{ activeTask.name }}</h2>
                <span class="task-type" :class="{ assessment: activeTask.taskType === 'assessment' }">
                  {{ activeTask.taskType === 'assessment' ? '考核' : '训练' }}
                </span>
              </div>
              <div class="sl-task-head-meta">
                <span><el-icon><Clock /></el-icon>{{ activeTask.estimatedHours || 0 }} 课时</span>
                <span><el-icon><DataLine /></el-icon>难度 Lv.{{ activeTask.difficulty }}</span>
              </div>
            </div>

            <!-- 任务说明书 -->
            <div class="sl-card">
              <h3 class="sl-card-title"><el-icon><Document /></el-icon>任务说明书</h3>
              <p v-if="activeTask.detailedDescription || activeTask.description" class="sl-desc">
                {{ activeTask.detailedDescription || activeTask.description }}
              </p>
              <p v-else class="sl-desc-empty">暂无任务说明书</p>
            </div>

            <!-- 知识点 -->
            <div v-if="activeKnowledge.length" class="sl-card">
              <h3 class="sl-card-title"><el-icon><Connection /></el-icon>关联知识点</h3>
              <div class="sl-tag-list">
                <span v-for="kp in activeKnowledge" :key="kp.id" class="sl-chip sl-chip-knowledge">
                  {{ kp.name }}<span v-if="kp.code" class="sl-chip-code">编码：{{ kp.code }}</span>
                </span>
              </div>
            </div>

            <!-- 能力点 -->
            <div v-if="activeAbilities.length" class="sl-card">
              <h3 class="sl-card-title"><el-icon><Collection /></el-icon>考查能力点</h3>
              <div class="sl-tag-list">
                <span v-for="ap in activeAbilities" :key="ap.id" class="sl-chip sl-chip-ability">
                  {{ ap.name }}
                </span>
              </div>
            </div>

            <!-- 学习资源 -->
            <div v-if="activeResources.length" class="sl-card">
              <h3 class="sl-card-title"><el-icon><FolderOpened /></el-icon>学习资源</h3>
              <div class="sl-res-list">
                <div v-for="r in activeResources" :key="r.id" class="sl-res-item">
                  <div class="sl-res-name">{{ r.name }}</div>
                  <div class="sl-res-meta">
                    <span class="res-type">{{ RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type }}</span>
                    <el-button v-if="r.url" size="small" text type="primary" @click="openResource(r.url)">
                      <el-icon><View /></el-icon>预览
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 任务测评 -->
            <div class="sl-card">
              <h3 class="sl-card-title"><el-icon><Aim /></el-icon>任务测评</h3>
              <div v-if="activeEvalMethods.length === 0" class="sl-desc-empty">该任务暂未设置评价方式</div>
              <div v-else class="sl-eval-list">
                <div v-for="m in activeEvalMethods" :key="m.id" class="sl-eval-item">
                  <div class="sl-eval-head">
                    <span class="eval-tag" :style="{ backgroundColor: EVAL_METHOD_COLORS[m.methodKey] || '#94a3b8' }">
                      {{ EVAL_METHOD_LABELS[m.methodKey] || m.methodKey }}
                    </span>
                    <span class="sl-eval-weight">权重 {{ Math.round(m.weight || 0) }}%</span>
                  </div>
                  <div v-if="m.evalPoints.length" class="sl-eval-points">
                    <div v-for="ep in m.evalPoints" :key="ep.id" class="sl-eval-point">
                      {{ ep.name }}（{{ ep.scoringMethod || '评分' }}，{{ Math.round(ep.weight || 0) }}分）
                    </div>
                  </div>
                  <div class="sl-eval-action">
                    <el-button
                      v-if="examHrefFor(m)"
                      type="primary"
                      size="small"
                      @click="goExam(m)"
                    >
                      <el-icon><EditPen /></el-icon>前往作答
                    </el-button>
                    <el-button
                      v-else
                      type="primary"
                      size="small"
                      :loading="submitting === m.id"
                      @click="submitMethod(m)"
                    >
                      <el-icon><Check /></el-icon>提交任务
                    </el-button>
                  </div>
                </div>
              </div>

              <!-- 我的评估结果 -->
              <div v-if="myResults.length" class="sl-results">
                <h4 class="sl-results-title">我的评估结果</h4>
                <div v-for="res in myResults" :key="res.id" class="sl-result-item">
                  <span class="sl-result-method">{{ EVAL_METHOD_LABELS[res.methodKey] || res.methodKey }}</span>
                  <span class="sl-result-status">{{ res.status === 'evaluated' ? '已评分' : '待评分' }}</span>
                  <span v-if="res.totalScore !== undefined" class="sl-result-score">
                    {{ res.totalScore }} / {{ res.maxScore ?? '-' }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Aim,
  ArrowLeft,
  Check,
  Clock,
  Collection,
  Connection,
  DataLine,
  Document,
  EditPen,
  Files,
  FolderOpened,
  Tickets,
  View
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { request } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { Scenario } from '@/types/scene';
import {
  EVAL_METHOD_COLORS,
  EVAL_METHOD_LABELS,
  RESOURCE_TYPE_SHORT_LABELS,
  mergeScenarioSnapshot,
  sceneExamHref,
  sceneLandingHref,
  snapshotAbilityMap,
  snapshotEvalMethods,
  snapshotKnowledgeMap,
  snapshotResourceMap,
  snapshotTask
} from './scene-types';
import type {
  SceneAbilityView,
  SceneEvalMethodView,
  SceneEvalResult,
  SceneKnowledgeView,
  SceneResourceView,
  SceneSnapshot,
  SceneTaskView
} from './scene-types';

// ===== 路由与登录态 =====
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loggedIn = computed(() => auth.isLoggedIn);
const id = computed(() => String(route.params.id || ''));
const targetTaskId = computed(() => (typeof route.query.task === 'string' ? route.query.task : null));
const versionParam = computed(() => (typeof route.query.v === 'string' ? route.query.v : undefined));

// ===== 数据状态 =====
const scenario = ref<Scenario | null>(null);
const tasks = ref<SceneTaskView[]>([]);
const resourceMap = ref<Map<string, SceneResourceView>>(new Map());
const knowledgeMap = ref<Map<string, SceneKnowledgeView>>(new Map());
const abilityMap = ref<Map<string, SceneAbilityView>>(new Map());
const evalMethodMap = ref<Map<string, SceneEvalMethodView[]>>(new Map());
const myResults = ref<SceneEvalResult[]>([]);
const loading = ref(true);
const activeTaskId = ref<string | null>(null);
const submitting = ref('');
const seq = ref(0);

// ===== 详情加载（快照 bundle，对齐 React 学生路径） =====
watch(
  [id, versionParam],
  async ([val, v]) => {
    if (!val) return;
    const mySeq = ++seq.value;
    loading.value = true;
    try {
      const qs = v ? `?v=${encodeURIComponent(v)}` : '';
      const snap = await request<SceneSnapshot>(`/scene/scenarios/${val}/snapshot${qs}`);
      if (mySeq !== seq.value) return;
      scenario.value = mergeScenarioSnapshot(null, snap.scenario);
      const taskList = snap.scenario_tasks.map(snapshotTask);
      tasks.value = taskList;
      resourceMap.value = snapshotResourceMap(snap.resource_library);
      knowledgeMap.value = snapshotKnowledgeMap(snap.knowledge_points);
      abilityMap.value = snapshotAbilityMap(snap.ability_points);
      evalMethodMap.value = new Map(taskList.map((t) => [t.id, snapshotEvalMethods(snap, t.id)]));
      const target = targetTaskId.value;
      if (target && taskList.find((t) => t.id === target)) {
        activeTaskId.value = target;
      } else if (taskList.length > 0 && !activeTaskId.value) {
        activeTaskId.value = taskList[0].id;
      }
    } catch {
      if (mySeq === seq.value) scenario.value = null;
    } finally {
      if (mySeq === seq.value) loading.value = false;
    }
  },
  { immediate: true }
);

const activeTask = computed(() => tasks.value.find((t) => t.id === activeTaskId.value));
const activeKnowledge = computed<SceneKnowledgeView[]>(() =>
  (activeTask.value?.knowledgePointIds || [])
    .map((kid) => knowledgeMap.value.get(kid))
    .filter((k): k is SceneKnowledgeView => Boolean(k))
);
const activeAbilities = computed<SceneAbilityView[]>(() =>
  (activeTask.value?.abilityPointIds || [])
    .map((aid) => abilityMap.value.get(aid))
    .filter((a): a is SceneAbilityView => Boolean(a))
);
const activeResources = computed<SceneResourceView[]>(() =>
  (activeTask.value?.resourceIds || [])
    .map((rid) => resourceMap.value.get(rid))
    .filter((r): r is SceneResourceView => Boolean(r))
);
const activeEvalMethods = computed<SceneEvalMethodView[]>(() =>
  activeTaskId.value ? evalMethodMap.value.get(activeTaskId.value) || [] : []
);

const pageVersion = computed(() => versionParam.value || scenario.value?.version || undefined);
const detailHref = computed(() => sceneLandingHref(id.value, pageVersion.value));

// ===== 我的评估结果（登录门槛，对齐 React 学习页） =====
watch(
  [activeTaskId, loggedIn],
  async ([taskId, lg]) => {
    if (!taskId) return;
    if (!lg || !auth.user?.id) {
      myResults.value = [];
      return;
    }
    try {
      const res = await request<ListResponse<SceneEvalResult>>(
        `/evaluation/results?taskId=${encodeURIComponent(taskId)}&evaluateeId=${encodeURIComponent(auth.user.id)}&limit=50`
      );
      myResults.value = res.items || [];
    } catch {
      myResults.value = [];
    }
  },
  { immediate: true }
);

// ===== 测评交互 =====
function examHrefFor(m: SceneEvalMethodView): string | undefined {
  const isExam = ['paper', 'question_bank', 'quiz'].includes(m.methodKey);
  if (!isExam) return undefined;
  const rc = m.resourceConfig as Record<string, unknown>;
  const examId = m.methodKey === 'paper' ? rc.paperId : rc.examId;
  if (!examId) return undefined;
  return sceneExamHref(String(examId), {
    task: activeTaskId.value,
    scene: id.value,
    method: m.methodKey,
    usage: rc.usageId ? String(rc.usageId) : undefined
  });
}

function goExam(m: SceneEvalMethodView) {
  const href = examHrefFor(m);
  if (href) router.push(href);
}

async function submitMethod(m: SceneEvalMethodView) {
  if (!loggedIn.value || !auth.user?.id) {
    ElMessage.warning('请先登录后再提交任务');
    return;
  }
  if (!activeTaskId.value) return;
  submitting.value = m.id;
  try {
    await request('/evaluation/results', {
      method: 'POST',
      body: JSON.stringify({
        taskId: activeTaskId.value,
        sceneId: id.value,
        expectedVersion: pageVersion.value,
        methodKey: m.methodKey,
        evaluateeId: auth.user.id,
        maxScore: m.weight || 100,
        subjectiveContent: {}
      })
    });
    ElMessage.success('提交成功');
    // 刷新我的评估结果
    const res = await request<ListResponse<SceneEvalResult>>(
      `/evaluation/results?taskId=${encodeURIComponent(activeTaskId.value)}&evaluateeId=${encodeURIComponent(auth.user.id)}&limit=50`
    );
    myResults.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '提交失败，请稍后重试');
  } finally {
    submitting.value = '';
  }
}

function openResource(url: string) {
  window.open(url, '_blank', 'noreferrer');
}
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

/* ===== 骨架屏 ===== */
.skeleton-block {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 14px;
  animation: pulse 1.6s ease-in-out infinite;
}
.skeleton-header {
  height: 200px;
  border-radius: 0;
  border-left: none;
  border-right: none;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ===== 空态 ===== */
.sl-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  min-height: 60vh;
}
.sl-empty-icon {
  color: #94a3b8;
  margin-bottom: 16px;
  opacity: 0.5;
}
.sl-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 12px;
}
.sl-empty-link {
  color: var(--el-color-primary);
  font-size: 14px;
  text-decoration: none;
}
.sl-empty-link:hover {
  text-decoration: underline;
}

/* ===== 主区 ===== */
.sl-main {
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
}
.sl-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #64748b;
  text-decoration: none;
  margin-bottom: 16px;
}
.sl-back:hover {
  color: var(--el-color-primary);
}
.sl-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@media (min-width: 900px) {
  .sl-layout {
    flex-direction: row;
    align-items: flex-start;
  }
}

/* ===== 侧栏 ===== */
.sl-sidebar {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  overflow: hidden;
}
@media (min-width: 900px) {
  .sl-sidebar {
    width: 300px;
    position: sticky;
    top: 16px;
  }
}
.sl-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
}
.sl-sidebar-count {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}
.sl-sidebar-empty {
  padding: 32px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.sl-sidebar-list {
  padding: 8px;
}
.sl-task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}
.sl-task-item:hover {
  background: #f8fafc;
}
.sl-task-item.active {
  background: var(--el-color-primary-light-9);
}
.sl-task-no {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.sl-task-item.active .sl-task-no {
  background: var(--el-color-primary);
  color: #fff;
}
.sl-task-info {
  min-width: 0;
}
.sl-task-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sl-task-item.active .sl-task-name {
  color: var(--el-color-primary);
}
.sl-task-meta {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

/* ===== 详情 ===== */
.sl-detail {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  padding: 24px;
  min-height: 500px;
}
.sl-empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}
.sl-empty-hint {
  font-size: 13px;
  color: #94a3b8;
  margin: 4px 0 0;
}
.sl-task-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
@media (min-width: 640px) {
  .sl-task-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.sl-task-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sl-task-title h2 {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}
.task-type {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
}
.task-type.assessment {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}
.sl-task-head-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #94a3b8;
}
.sl-task-head-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sl-card {
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
}
.sl-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 12px;
}
.sl-card-title .el-icon {
  color: var(--el-color-primary);
}
.sl-desc {
  font-size: 13px;
  color: #475569;
  line-height: 1.7;
  margin: 0;
  white-space: pre-wrap;
}
.sl-desc-empty {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}
.sl-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sl-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 999px;
}
.sl-chip-knowledge {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}
.sl-chip-ability {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
}
.sl-chip-code {
  font-size: 10px;
  opacity: 0.7;
  font-family: monospace;
}
.sl-res-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sl-res-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  background: #f8fafc;
  border-radius: 10px;
}
.sl-res-name {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sl-res-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.res-type {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
  font-size: 10px;
}

.sl-eval-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sl-eval-item {
  padding: 12px 14px;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
}
.sl-eval-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.eval-tag {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  color: #fff;
  font-weight: 500;
}
.sl-eval-weight {
  font-size: 12px;
  color: #64748b;
}
.sl-eval-points {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.sl-eval-point {
  font-size: 12px;
  color: #64748b;
}
.sl-eval-action {
  display: flex;
  justify-content: flex-end;
}
.sl-results {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #e2e8f0;
}
.sl-results-title {
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px;
}
.sl-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  font-size: 12px;
}
.sl-result-method {
  font-weight: 500;
  color: #1f2937;
}
.sl-result-status {
  color: #94a3b8;
}
.sl-result-score {
  margin-left: auto;
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>

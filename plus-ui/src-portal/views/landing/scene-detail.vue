<template>
  <div class="landing">
    <!-- ===== 加载中 ===== -->
    <template v-if="loading">
      <div class="skeleton-block skeleton-header" />
      <main class="sd-main">
        <div class="skeleton-block" />
      </main>
    </template>

    <!-- ===== 场景不存在 ===== -->
    <div v-else-if="!scenario" class="sd-empty">
      <el-icon :size="64" class="sd-empty-icon"><Files /></el-icon>
      <p class="sd-empty-title">场景不存在或暂未公开</p>
      <router-link to="/scene/landing" class="sd-empty-link">返回场景列表</router-link>
    </div>

    <template v-else>
      <!-- ===== 场景头部 ===== -->
      <header class="sd-header">
        <div class="sd-header-inner">
          <button type="button" class="sd-back" @click="goBack">
            <el-icon><ArrowLeft /></el-icon> 返回上一页
          </button>
          <span class="sd-crumb-sep">/</span>
          <span class="sd-crumb-name">{{ scenario.name }}</span>

          <div class="sd-layout">
            <!-- 左：封面 + 信息 -->
            <div class="sd-main-card">
              <div class="sd-cover-info">
                <div class="sd-cover" :style="coverStyle">
                  <el-icon v-if="!scenario.coverImage" :size="64" class="sd-cover-icon"><Files /></el-icon>
                  <span class="sd-cover-code">{{ scenario.code || '' }}</span>
                </div>
                <div class="sd-info">
                  <div class="sd-title-row">
                    <h1 class="sd-name">{{ scenario.name }}</h1>
                    <span class="sd-version">{{ scenario.version }}</span>
                  </div>

                  <div class="sd-meta">
                    <span class="sd-meta-item"><el-icon><User /></el-icon>创建人：{{ scenario.creatorName || '-' }}</span>
                    <span class="sd-meta-item"><el-icon><Clock /></el-icon>更新于 {{ formatDate(scenario.updatedAt) }}</span>
                    <span class="sd-meta-item"><el-icon><View /></el-icon>浏览 {{ scenario.viewCount ?? 0 }} 次</span>
                  </div>

                  <p v-if="scenario.background" class="sd-background">{{ scenario.background }}</p>

                  <div class="sd-tags">
                    <span v-if="scenario.industryNames?.length" class="sd-tag sd-tag-industry">
                      <el-icon><Location /></el-icon>面向行业：{{ (scenario.industryNames || []).slice(0, 3).join('、') }}
                    </span>
                    <span class="sd-tag sd-tag-diff" :style="diffTagStyle">
                      难度等级：{{ diff.label }}
                    </span>
                  </div>

                  <div class="sd-actions">
                    <el-button type="primary" class="sd-btn-learn" @click="handleStartLearning">
                      <el-icon><VideoPlay /></el-icon>开始学习
                    </el-button>
                    <el-button :class="['sd-btn-fav', { active: isFavorite }]" :loading="favLoading" @click="toggleFavorite">
                      <el-icon><Star :class="{ filled: isFavorite }" /></el-icon>
                      {{ isFavorite ? '已收藏场景' : '收藏场景' }}
                    </el-button>
                    <el-button class="sd-btn-share" @click="copyShareLink">
                      <el-icon><Share /></el-icon>分享
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右：课时统计 -->
            <div class="sd-stats-card">
              <div class="sd-stats-head">
                <el-icon><DataLine /></el-icon>
                <span>课时统计</span>
              </div>
              <div class="sd-donut-wrap">
                <div class="sd-donut">
                  <svg class="sd-donut-svg" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke="#f1f5f9" stroke-width="10" />
                    <circle
                      v-if="totalHours > 0"
                      cx="70" cy="70" r="58" fill="none"
                      stroke="var(--el-color-primary)" stroke-width="10" stroke-linecap="round"
                      :stroke-dasharray="`${(assessmentHours / totalHours) * 364.4} 364.4`"
                      transform="rotate(-90 70 70)"
                    />
                    <circle
                      v-if="totalHours > 0 && trainingHours > 0"
                      cx="70" cy="70" r="58" fill="none"
                      stroke="#22c55e" stroke-width="10" stroke-linecap="round"
                      :stroke-dasharray="`${(trainingHours / totalHours) * 364.4} 364.4`"
                      :stroke-dashoffset="`${-1 * (assessmentHours / totalHours) * 364.4}`"
                      transform="rotate(-90 70 70)"
                    />
                  </svg>
                  <div class="sd-donut-center">
                    <div class="sd-donut-value">{{ totalHours }}</div>
                    <div class="sd-donut-label">总课时</div>
                  </div>
                </div>
                <div class="sd-donut-legend">
                  <span class="sd-legend-item"><i class="sd-legend-dot" style="background: var(--el-color-primary)" />考核 {{ assessmentHours }} 课时</span>
                  <span class="sd-legend-item"><i class="sd-legend-dot" style="background: #22c55e" />训练 {{ trainingHours }} 课时</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- ===== 内容 Tab ===== -->
      <main class="sd-main">
        <div class="sd-tabs-card">
          <el-tabs v-model="activeTab" class="sd-tabs">
            <!-- 任务概览 -->
            <el-tab-pane name="tasks">
              <template #label>
                <span class="sd-tab-label"><el-icon><Tickets /></el-icon>任务概览
                  <span v-if="tasks.length" class="sd-tab-count">{{ tasks.length }}</span>
                </span>
              </template>
              <div v-if="tasks.length === 0" class="empty-big">暂无任务，该场景暂未配置任务</div>
              <div v-else class="task-list">
                <div v-for="(task, idx) in tasks" :key="task.id" class="task-item">
                  <div class="task-no">{{ idx + 1 }}</div>
                  <div class="task-body">
                    <div class="task-head">
                      <div class="task-name">{{ task.name }}</div>
                      <span class="task-type" :class="{ assessment: task.taskType === 'assessment' }">
                        {{ task.taskType === 'assessment' ? '考核' : '训练' }}
                      </span>
                      <span v-if="task.code" class="task-code">{{ task.code }}</span>
                    </div>
                    <div class="task-meta">
                      <span class="task-meta-item"><el-icon><Clock /></el-icon>{{ task.estimatedHours || 0 }} 课时</span>
                      <span class="task-meta-item"><el-icon><DataLine /></el-icon>Lv.{{ task.difficulty }}</span>
                      <span v-if="task.resourceIds.length" class="task-meta-item">
                        <el-icon><FolderOpened /></el-icon>{{ task.resourceIds.length }} 个资源
                      </span>
                      <span v-if="task.abilityPointIds.length" class="task-meta-item">
                        <el-icon><Collection /></el-icon>{{ task.abilityPointIds.length }} 个能力点
                      </span>
                      <span v-if="task.knowledgePointIds.length" class="task-meta-item">
                        <el-icon><Connection /></el-icon>{{ task.knowledgePointIds.length }} 个知识点
                      </span>
                    </div>
                    <p v-if="task.detailedDescription || task.description" class="task-desc">
                      {{ task.detailedDescription || task.description }}
                    </p>
                    <div v-if="(evalMethodMap.get(task.id)?.length || 0) > 0" class="task-eval-tags">
                      <span
                        v-for="m in (evalMethodMap.get(task.id) || [])"
                        :key="m.id"
                        class="eval-tag"
                        :style="{ backgroundColor: EVAL_METHOD_COLORS[m.methodKey] || '#94a3b8' }"
                      >
                        {{ EVAL_METHOD_LABELS[m.methodKey] || m.methodKey }}
                      </span>
                    </div>
                  </div>
                  <el-button size="small" type="primary" class="task-btn" @click="goLearn(task.id)">
                    <el-icon><VideoPlay /></el-icon>开始任务
                  </el-button>
                </div>
              </div>
            </el-tab-pane>

            <!-- 资源中心 -->
            <el-tab-pane name="resources">
              <template #label>
                <span class="sd-tab-label"><el-icon><FolderOpened /></el-icon>资源中心
                  <span v-if="totalResources" class="sd-tab-count">{{ totalResources }}</span>
                </span>
              </template>
              <div class="sd-count-line">共 {{ totalResources }} 个资源</div>
              <div v-if="totalResources === 0" class="empty-big">暂无关联资源，该场景暂未配置学习资源</div>
              <div v-else class="res-groups">
                <div v-for="task in tasksWithResources" :key="task.id" class="res-group">
                  <div class="res-group-title">
                    <el-icon><Reading /></el-icon>{{ task.name }}
                    <span class="res-group-count">({{ taskResourceCount(task.id) }})</span>
                  </div>
                  <div class="res-grid">
                    <div v-for="r in taskResources(task.id)" :key="r.id" class="res-item">
                      <div class="res-item-head">
                        <div class="res-item-name">{{ r.name }}</div>
                        <el-button v-if="r.url" size="small" text class="res-preview-btn" @click="openResource(r.url)">
                          <el-icon><View /></el-icon>预览
                        </el-button>
                      </div>
                      <div class="res-item-meta">
                        <span class="res-type">{{ RESOURCE_TYPE_SHORT_LABELS[r.type] || r.type }}</span>
                        <span v-if="r.size">{{ formatFileSize(r.size) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- 能力模型 -->
            <el-tab-pane name="abilities">
              <template #label>
                <span class="sd-tab-label"><el-icon><Collection /></el-icon>能力模型
                  <span v-if="uniqueAbilityIds.size" class="sd-tab-count">{{ uniqueAbilityIds.size }}</span>
                </span>
              </template>
              <div v-if="uniqueAbilityIds.size === 0" class="empty-big">暂无考查能力点，该场景暂未关联能力点</div>
              <div v-else class="ability-wrap">
                <div class="ability-intro">
                  <div class="ability-intro-title"><el-icon><MagicStick /></el-icon>能力模型说明</div>
                  <p class="ability-intro-text">
                    本场景基于真实企业场景标准，拆解为若干能力领域，每个能力领域下关联对应的能力点，帮助学生明确学习目标。
                  </p>
                </div>
                <div class="sd-count-line">共 {{ abilityGroups.length }} 个能力领域，{{ uniqueAbilityIds.size }} 个能力点</div>
                <div class="ability-grid">
                  <div v-for="g in abilityGroups" :key="g.name" class="ability-domain">
                    <div class="ability-domain-head"><el-icon><Aim /></el-icon>{{ g.name }}</div>
                    <div class="ability-domain-body">
                      <div
                        v-for="item in g.items"
                        :key="item.ap.id"
                        class="ability-item"
                        role="button"
                        tabindex="0"
                        @click="selectedAbility = item"
                        @keydown.enter="selectedAbility = item"
                      >
                        <div class="ability-item-name">
                          <span class="ability-item-name-text">{{ item.ap.name }}</span>
                          <span v-for="attr in item.ap.attributes" :key="attr" class="attr-badge" :style="attrStyle(attr)">
                            {{ attr }}
                          </span>
                        </div>
                        <span v-if="item.ap.code || item.ap.id" class="ability-item-code">ID：{{ item.ap.code || item.ap.id }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- 评价标准 -->
            <el-tab-pane name="evaluation">
              <template #label>
                <span class="sd-tab-label"><el-icon><Aim /></el-icon>评价标准
                  <span v-if="totalEvalConfigs" class="sd-tab-count">{{ totalEvalConfigs }}</span>
                </span>
              </template>
              <div v-if="totalEvalConfigs === 0" class="empty-big">暂未配置评价标准，该场景暂未设置评价方式</div>
              <div v-else>
                <div class="sd-count-line">共 {{ totalEvalConfigs }} 个评价配置</div>
                <div class="eval-grid">
                  <div v-for="task in tasksWithEval" :key="task.id" class="eval-card">
                    <div class="eval-card-head">
                      <div class="eval-card-name">{{ task.name }}</div>
                      <span class="task-type" :class="{ assessment: task.taskType === 'assessment' }">
                        {{ task.taskType === 'assessment' ? '考核' : '训练' }}
                      </span>
                    </div>
                    <div v-for="m in (evalMethodMap.get(task.id) || [])" :key="m.id" class="eval-method">
                      <div class="eval-method-row">
                        <span class="eval-tag" :style="{ backgroundColor: EVAL_METHOD_COLORS[m.methodKey] || '#94a3b8' }">
                          {{ EVAL_METHOD_LABELS[m.methodKey] || m.methodKey }}
                        </span>
                        <div class="eval-bar"><div class="eval-bar-fill" :style="{ width: `${Math.round(m.weight || 0)}%`, backgroundColor: EVAL_METHOD_COLORS[m.methodKey] || '#94a3b8' }" /></div>
                        <span class="eval-weight">{{ Math.round(m.weight || 0) }}%</span>
                      </div>
                      <div v-if="m.evalPoints.length" class="eval-points">
                        <div v-for="ep in m.evalPoints" :key="ep.id" class="eval-point">
                          <span class="eval-point-name">{{ ep.name }}</span>
                          <span class="eval-point-meta">{{ ep.scoringMethod || '评分' }} · {{ Math.round(ep.weight || 0) }}分</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- 知识图谱 -->
            <el-tab-pane name="knowledge">
              <template #label>
                <span class="sd-tab-label"><el-icon><Connection /></el-icon>知识图谱
                  <span v-if="totalKnowledge" class="sd-tab-count">{{ totalKnowledge }}</span>
                </span>
              </template>
              <div v-if="totalKnowledge === 0" class="empty-big">暂无关联知识点</div>
              <div v-else class="kg-wrap">
                <div class="kg-head">
                  <h3 class="kg-title"><el-icon><Connection /></el-icon>知识图谱</h3>
                  <p class="kg-desc">场景→任务→知识点→颗粒课的完整关联网络（知识点经任务绑定关联，颗粒课经知识点绑定关联）</p>
                </div>
                <div v-for="group in knowledgeGroups" :key="group.task.id" class="kg-group">
                  <div class="kg-group-title">
                    <el-icon><Tickets /></el-icon>{{ group.task.name }}
                    <span class="kg-group-count">({{ group.points.length }})</span>
                  </div>
                  <div class="kg-points">
                    <div v-for="kp in group.points" :key="kp.id" class="kg-point">
                      <span class="kg-point-name">{{ kp.name }}</span>
                      <span v-if="kp.code" class="kg-point-code">编码：{{ kp.code }}</span>
                      <span v-if="kp.description" class="kg-point-desc">{{ kp.description }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </main>
    </template>

    <!-- ===== 能力点详情弹窗 ===== -->
    <el-dialog v-model="abilityDialogOpen" width="520px" class="sd-dialog">
      <template #header><div class="dialog-title">能力点详情</div></template>
      <div v-if="selectedAbility" class="ability-detail">
        <div class="ability-detail-name">{{ selectedAbility.ap.name }}</div>
        <div v-if="selectedAbility.ap.code || selectedAbility.ap.id" class="ability-detail-code">
          ID：{{ selectedAbility.ap.code || selectedAbility.ap.id }}
        </div>
        <div class="ability-detail-row">
          <span class="ability-detail-label">能力属性：</span>
          <span>{{ selectedAbility.ap.attributes.length ? selectedAbility.ap.attributes.join('、') : '未配置' }}</span>
        </div>
        <div class="ability-detail-row">
          <span class="ability-detail-label">关联任务：</span>
          <span>{{ selectedAbility.taskNames.join('、') }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Aim,
  ArrowLeft,
  Clock,
  Collection,
  Connection,
  DataLine,
  Files,
  FolderOpened,
  MagicStick,
  Location,
  Reading,
  Share,
  Star,
  Tickets,
  User,
  VideoPlay,
  View
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { scenarioApi } from '@/api/scene';
import { favoriteApi } from '@/api/portal';
import { request } from '@/api/http';
import type { Scenario } from '@/types/scene';
import { formatDate, coverGradientFor } from './evaluation-types';
import {
  EVAL_METHOD_COLORS,
  EVAL_METHOD_LABELS,
  RESOURCE_TYPE_SHORT_LABELS,
  SCENE_DIFFICULTY,
  mergeScenarioSnapshot,
  sceneLearnHref,
  snapshotAbilityDomainMap,
  snapshotAbilityMap,
  snapshotEvalMethods,
  snapshotKnowledgeMap,
  snapshotResourceMap,
  snapshotTask
} from './scene-types';
import type {
  SceneAbilityView,
  SceneEvalMethodView,
  SceneKnowledgeView,
  SceneResourceView,
  SceneSnapshot,
  SceneTaskView
} from './scene-types';

const ATTRIBUTE_COLORS: Record<string, [string, string]> = {
  知识: ['#3b82f6', '#60a5fa'],
  素养: ['#f59e0b', '#fbbf24'],
  技能: ['#10b981', '#34d399']
};

// ===== 路由与登录态 =====
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loggedIn = computed(() => auth.isLoggedIn);
const id = computed(() => String(route.params.id || ''));
const versionParam = computed(() => (typeof route.query.v === 'string' ? route.query.v : undefined));

// ===== 数据状态 =====
const scenario = ref<Scenario | null>(null);
const tasks = ref<SceneTaskView[]>([]);
const resourceMap = ref<Map<string, SceneResourceView>>(new Map());
const knowledgeMap = ref<Map<string, SceneKnowledgeView>>(new Map());
const abilityMap = ref<Map<string, SceneAbilityView>>(new Map());
const abilityDomainMap = ref<Map<string, string>>(new Map());
const evalMethodMap = ref<Map<string, SceneEvalMethodView[]>>(new Map());
const loading = ref(true);
const activeTab = ref('tasks');
const seq = ref(0);

// ===== 详情加载（快照 bundle + live 元数据，对齐 React 学生路径） =====
watch(
  [id, versionParam],
  async ([val, v]) => {
    if (!val) return;
    const mySeq = ++seq.value;
    loading.value = true;
    try {
      const qs = v ? `?v=${encodeURIComponent(v)}` : '';
      const [snap, live] = await Promise.all([
        request<SceneSnapshot>(`/scene/scenarios/${val}/snapshot${qs}`),
        scenarioApi.get(val).catch(() => null)
      ]);
      if (mySeq !== seq.value) return;
      scenario.value = mergeScenarioSnapshot(live, snap.scenario);
      const taskList = snap.scenario_tasks.map(snapshotTask);
      tasks.value = taskList;
      resourceMap.value = snapshotResourceMap(snap.resource_library);
      knowledgeMap.value = snapshotKnowledgeMap(snap.knowledge_points);
      abilityMap.value = snapshotAbilityMap(snap.ability_points);
      abilityDomainMap.value = snapshotAbilityDomainMap(snap);
      evalMethodMap.value = new Map(taskList.map((t) => [t.id, snapshotEvalMethods(snap, t.id)]));
    } catch {
      if (mySeq === seq.value) scenario.value = null;
    } finally {
      if (mySeq === seq.value) loading.value = false;
    }
  },
  { immediate: true }
);

// ===== 收藏（对齐 React FavoriteButton，登录门槛） =====
const isFavorite = ref(false);
const favLoading = ref(false);

watch([loggedIn, scenario], async ([lg, sc]) => {
  if (!sc) return;
  if (!lg) {
    isFavorite.value = false;
    return;
  }
  try {
    const res = await favoriteApi.get('scene', sc.id);
    isFavorite.value = res.isFavorite;
  } catch {
    /* 收藏状态读取失败忽略 */
  }
});

async function toggleFavorite() {
  if (!loggedIn.value) {
    ElMessage.warning('请先登录后再收藏场景');
    return;
  }
  if (favLoading.value || !scenario.value) return;
  favLoading.value = true;
  try {
    const res = await favoriteApi.toggle('scene', scenario.value.id);
    isFavorite.value = res.isFavorite;
    ElMessage.success(res.isFavorite ? '已收藏' : '已取消收藏');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败，请稍后再试');
  } finally {
    favLoading.value = false;
  }
}

function copyShareLink() {
  const url = window.location.href;
  navigator.clipboard
    .writeText(url)
    .then(() => ElMessage.success('链接已复制'))
    .catch(() => ElMessage.info(`当前页面链接：${url}`));
}

// ===== 派生数据 =====
const assessmentHours = computed(() =>
  tasks.value.filter((t) => t.taskType === 'assessment').reduce((s, t) => s + (t.estimatedHours || 0), 0)
);
const trainingHours = computed(() =>
  tasks.value.filter((t) => t.taskType === 'training').reduce((s, t) => s + (t.estimatedHours || 0), 0)
);
const totalHours = computed(() => assessmentHours.value + trainingHours.value);
const totalResources = computed(() => tasks.value.reduce((s, t) => s + t.resourceIds.length, 0));
const totalKnowledge = computed(() => tasks.value.reduce((s, t) => s + t.knowledgePointIds.length, 0));
const uniqueAbilityIds = computed(() => {
  const ids = new Set<string>();
  tasks.value.forEach((t) => t.abilityPointIds.forEach((aid) => ids.add(aid)));
  return ids;
});
const totalEvalConfigs = computed(() =>
  tasks.value.reduce((s, t) => s + (evalMethodMap.value.get(t.id)?.length || 0), 0)
);

const diff = computed(() => SCENE_DIFFICULTY[scenario.value?.difficulty ?? 3] || SCENE_DIFFICULTY[3]);
const diffTagStyle = computed(() => ({
  backgroundColor: diff.value.bg,
  color: diff.value.color,
  borderColor: diff.value.border
}));
const coverStyle = computed(() =>
  scenario.value?.coverImage
    ? { backgroundImage: `url('${scenario.value.coverImage}')` }
    : { background: coverGradientFor(scenario.value?.id || '') }
);
const pageVersion = computed(() => versionParam.value || scenario.value?.version || undefined);

// 资源中心
const tasksWithResources = computed(() => tasks.value.filter((t) => t.resourceIds.length > 0));
function taskResources(taskId: string): SceneResourceView[] {
  return tasks.value
    .find((t) => t.id === taskId)
    ?.resourceIds.map((rid) => resourceMap.value.get(rid))
    .filter((r): r is SceneResourceView => Boolean(r)) ?? [];
}
function taskResourceCount(taskId: string): number {
  return taskResources(taskId).length;
}
function formatFileSize(size: string): string {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return size;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function openResource(url: string) {
  window.open(url, '_blank', 'noreferrer');
}

// 能力模型
const abilityGroups = computed(() => {
  const groups = new Map<string, { ap: SceneAbilityView; taskNames: string[] }[]>();
  tasks.value.forEach((task) => {
    task.abilityPointIds.forEach((aid) => {
      const ap = abilityMap.value.get(aid);
      if (!ap) return;
      const domain = abilityDomainMap.value.get(aid) || '其他';
      const list = groups.get(domain) || [];
      const existing = list.find((item) => item.ap.id === ap.id);
      if (existing) {
        if (!existing.taskNames.includes(task.name)) existing.taskNames.push(task.name);
      } else {
        list.push({ ap, taskNames: [task.name] });
      }
      groups.set(domain, list);
    });
  });
  return Array.from(groups.entries())
    .map(([name, items]) => ({ name, items }))
    .filter((g) => g.items.length > 0);
});

const selectedAbility = ref<{ ap: SceneAbilityView; taskNames: string[] } | null>(null);
const abilityDialogOpen = ref(false);
watch(selectedAbility, (v) => {
  abilityDialogOpen.value = Boolean(v);
});

function attrStyle(attr: string) {
  const colors = ATTRIBUTE_COLORS[attr] || ['#64748b', '#94a3b8'];
  return { background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`, borderColor: colors[0] };
}

// 评价标准
const tasksWithEval = computed(() =>
  tasks.value.filter((task) => (evalMethodMap.value.get(task.id)?.length || 0) > 0)
);

// 知识图谱
const knowledgeGroups = computed(() =>
  tasks.value
    .map((task) => ({
      task,
      points: task.knowledgePointIds
        .map((kid) => knowledgeMap.value.get(kid))
        .filter((k): k is SceneKnowledgeView => Boolean(k))
    }))
    .filter((g) => g.points.length > 0)
);

// ===== 交互 =====
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/scene/landing');
  }
}

function handleStartLearning() {
  router.push(sceneLearnHref(id.value, { version: pageVersion.value }));
}

function goLearn(taskId: string) {
  router.push(sceneLearnHref(id.value, { taskId, version: pageVersion.value }));
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
  height: 320px;
  border-radius: 0;
  border-left: none;
  border-right: none;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ===== 空态 ===== */
.sd-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  min-height: 60vh;
}
.sd-empty-icon {
  color: #94a3b8;
  margin-bottom: 16px;
  opacity: 0.5;
}
.sd-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 12px;
}
.sd-empty-link {
  color: var(--el-color-primary);
  font-size: 14px;
  text-decoration: none;
}
.sd-empty-link:hover {
  text-decoration: underline;
}

/* ===== 头部 ===== */
.sd-header {
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}
.sd-header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px;
  width: 100%;
  box-sizing: border-box;
}
.sd-back {
  border: none;
  background: none;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  margin-bottom: 16px;
}
.sd-back:hover {
  color: var(--el-color-primary);
}
.sd-crumb-sep {
  color: #cbd5e1;
  margin: 0 8px;
}
.sd-crumb-name {
  color: #1f2937;
  font-weight: 500;
  font-size: 14px;
}

.sd-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: stretch;
}
@media (min-width: 1024px) {
  .sd-layout {
    flex-direction: row;
    align-items: stretch;
  }
}
.sd-main-card {
  flex: 1;
  min-width: 0;
}
.sd-cover-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  height: 100%;
  box-sizing: border-box;
}
@media (min-width: 640px) {
  .sd-cover-info {
    flex-direction: row;
  }
}
.sd-cover {
  width: 100%;
  height: 190px;
  border-radius: 16px;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
@media (min-width: 640px) {
  .sd-cover {
    width: 280px;
  }
}
.sd-cover-icon {
  color: rgba(255, 255, 255, 0.85);
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
}
.sd-cover-code {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(6px);
  color: #fff;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.sd-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.sd-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.sd-name {
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.sd-version {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.sd-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 12px;
}
.sd-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sd-background {
  font-size: 14px;
  color: #475569;
  line-height: 1.6;
  margin: 0 0 16px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sd-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.sd-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 500;
  border: 1px solid transparent;
}
.sd-tag-industry {
  background: #fff7ed;
  color: #c2410c;
  border-color: #ffedd5;
}
.sd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: auto;
  padding-top: 20px;
}
.sd-btn-learn {
  height: 44px;
  border-radius: 12px;
  padding: 0 28px;
  font-weight: 600;
}
.sd-btn-fav.active {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.sd-btn-share {
  height: 44px;
  border-radius: 12px;
}
.sd-btn-fav :deep(.filled) {
  color: #f59e0b;
}

/* ===== 课时统计卡 ===== */
.sd-stats-card {
  width: 100%;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}
@media (min-width: 1024px) {
  .sd-stats-card {
    width: 320px;
  }
}
.sd-stats-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
}
.sd-stats-head .el-icon {
  color: var(--el-color-primary);
}
.sd-donut-wrap {
  padding: 20px;
}
.sd-donut {
  position: relative;
  width: 140px;
  height: 140px;
  margin: 0 auto 16px;
}
.sd-donut-svg {
  width: 100%;
  height: 100%;
}
.sd-donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.sd-donut-value {
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
}
.sd-donut-label {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
.sd-donut-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  font-size: 12px;
  color: #475569;
}
.sd-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sd-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

/* ===== 主区 ===== */
.sd-main {
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
}
.sd-tabs-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  padding: 8px 20px 24px;
}
.sd-tabs :deep(.el-tabs__content) {
  min-height: 400px;
}
.sd-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sd-tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  margin-left: 4px;
}
.sd-count-line {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 16px;
}
.empty-big {
  text-align: center;
  padding: 64px 0;
  color: #94a3b8;
  font-size: 14px;
}

/* ===== 任务列表 ===== */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.task-item {
  display: flex;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.2s;
}
.task-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}
.task-no {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-2));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);
}
.task-body {
  flex: 1;
  min-width: 0;
}
.task-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.task-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
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
.task-code {
  font-size: 11px;
  color: #94a3b8;
}
.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}
.task-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.task-desc {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 8px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.task-eval-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.eval-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  font-weight: 500;
}
.task-btn {
  align-self: center;
  flex-shrink: 0;
}

/* ===== 资源 ===== */
.res-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.res-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 12px;
}
.res-group-title .el-icon {
  color: var(--el-color-primary);
}
.res-group-count {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}
.res-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 640px) {
  .res-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .res-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.res-item {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  padding: 14px 16px;
  transition: all 0.2s;
}
.res-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.res-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.res-item-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.res-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}
.res-type {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  border: 1px solid var(--el-color-primary-light-7);
  font-size: 10px;
}

/* ===== 能力模型 ===== */
.ability-intro {
  background: linear-gradient(90deg, var(--el-color-primary-light-9), var(--el-color-primary-light-8));
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
}
.ability-intro-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-color-primary);
  font-weight: 700;
  margin-bottom: 8px;
}
.ability-intro-text {
  font-size: 13px;
  color: #475569;
  margin: 0;
  line-height: 1.6;
}
.ability-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .ability-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1200px) {
  .ability-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.ability-domain {
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  overflow: hidden;
}
.ability-domain-head {
  background: var(--el-color-primary-light-9);
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.ability-domain-body {
  padding: 8px;
}
.ability-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}
.ability-item:last-child {
  border-bottom: none;
}
.ability-item:hover {
  background: var(--el-color-primary-light-9);
}
.ability-item-name {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ability-item-name-text {
  font-size: 14px;
  color: #1f2937;
}
.attr-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
  border: 1px solid transparent;
}
.ability-item-code {
  font-size: 10px;
  color: #94a3b8;
  font-family: monospace;
}

/* ===== 评价标准 ===== */
.eval-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 1024px) {
  .eval-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.eval-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 20px;
}
.eval-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.eval-card-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eval-method {
  margin-bottom: 12px;
}
.eval-method:last-child {
  margin-bottom: 0;
}
.eval-method-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.eval-bar {
  flex: 1;
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}
.eval-bar-fill {
  height: 100%;
  border-radius: 999px;
}
.eval-weight {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  width: 40px;
  text-align: right;
}
.eval-points {
  padding-left: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.eval-point {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
  padding: 6px 10px;
  background: #f8fafc;
  border-radius: 8px;
}
.eval-point-name {
  font-weight: 500;
}
.eval-point-meta {
  color: #94a3b8;
}

/* ===== 知识图谱（简化：按任务分组列出知识点） ===== */
.kg-head {
  margin-bottom: 16px;
}
.kg-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px;
}
.kg-title .el-icon {
  color: var(--el-color-primary);
}
.kg-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}
.kg-group {
  margin-bottom: 20px;
}
.kg-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 12px;
}
.kg-group-title .el-icon {
  color: var(--el-color-primary);
}
.kg-group-count {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}
.kg-points {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 768px) {
  .kg-points {
    grid-template-columns: repeat(2, 1fr);
  }
}
.kg-point {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
}
.kg-point-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.kg-point-code {
  font-size: 11px;
  color: #94a3b8;
  font-family: monospace;
}
.kg-point-desc {
  font-size: 12px;
  color: #64748b;
}

/* ===== 弹窗 ===== */
.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}
.ability-detail-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}
.ability-detail-code {
  font-size: 12px;
  color: #94a3b8;
  font-family: monospace;
  margin-bottom: 12px;
}
.ability-detail-row {
  font-size: 12px;
  color: #475569;
  margin-bottom: 8px;
}
.ability-detail-label {
  font-weight: 500;
  color: #94a3b8;
}
</style>

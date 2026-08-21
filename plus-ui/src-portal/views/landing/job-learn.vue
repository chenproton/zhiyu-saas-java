<template>
  <div class="landing">
    <!-- ===== 加载中 ===== -->
    <template v-if="loading">
      <div class="skeleton-block skeleton-header" />
      <main class="jl-main">
        <div class="skeleton-block" />
      </main>
    </template>

    <!-- ===== 岗位不存在 ===== -->
    <div v-else-if="!position" class="jl-empty">
      <el-icon :size="64" class="jl-empty-icon"><Briefcase /></el-icon>
      <p class="jl-empty-title">岗位不存在或暂未公开</p>
      <router-link to="/job/landing" class="jl-empty-link">返回岗位列表</router-link>
    </div>

    <main v-else class="jl-main">
      <!-- 返回岗位详情 -->
      <router-link :to="`/job/landing/${id}`" replace class="jl-back">
        <el-icon><ArrowLeft /></el-icon> 返回岗位详情
      </router-link>

      <!-- 学习路径（登录可见，对齐 React LearningPath） -->
      <div class="jl-card">
        <LoginPrompt v-if="!loggedIn" text="学习路径需登录后查看" desc="登录账号后可查看岗位关联的学习路径" />
        <template v-else>
          <div v-if="steps.length === 0" class="lp-empty">
            <el-icon :size="48" class="lp-empty-icon"><Collection /></el-icon>
            <p class="lp-empty-title">暂无关联实践场景</p>
          </div>
          <div v-else class="lp-wrap">
            <!-- 标题 -->
            <div class="lp-head">
              <h2 class="lp-title">
                <el-icon><Guide /></el-icon>
                {{ road?.name || '岗位学习路径' }}
              </h2>
              <p class="lp-sub">
                {{ road?.description || '沿着学习路线，从起点站出发，逐步通关实践场景，抵达能力认证终点站' }}
              </p>
            </div>

            <!-- 站台轨道 -->
            <div class="lp-stage">
              <button
                type="button"
                class="lp-nav-btn"
                :disabled="activeIndex === 0"
                @click="navigate(-1)"
              >
                <el-icon><ArrowLeft /></el-icon>
              </button>
              <button
                type="button"
                class="lp-nav-btn lp-nav-right"
                :disabled="activeIndex === steps.length - 1"
                @click="navigate(1)"
              >
                <el-icon><ArrowRight /></el-icon>
              </button>

              <div ref="wrapperRef" class="lp-track-wrap" @scroll="onTrackScroll">
                <div ref="trackRef" class="lp-track">
                  <div class="lp-track-line" />

                  <div
                    v-for="(scenario, i) in steps"
                    :key="scenario.id"
                    class="lp-station"
                    :class="{ active: i === activeIndex }"
                    @click="activeIndex = i"
                  >
                    <div v-if="i === 0 || i === steps.length - 1" class="lp-station-label">
                      {{ i === 0 ? 'START · 起点' : 'GOAL · 终点' }}
                    </div>
                    <div v-else class="lp-station-label-spacer" />
                    <div
                      v-if="scenario.coverImage"
                      class="lp-station-cover"
                      :style="stationCoverStyle(scenario)"
                    >
                      <img :src="scenario.coverImage" :alt="scenario.name" class="lp-station-img" />
                    </div>
                    <div v-else class="lp-station-circle" :style="stationCircleStyle(i)">
                      <el-icon :size="28"><component :is="ROAD_ICONS[i % ROAD_ICONS.length]" /></el-icon>
                    </div>
                    <div class="lp-station-name" :title="scenario.name">{{ scenario.name }}</div>
                    <div class="lp-station-meta">
                      {{ stationTasks(scenario.id).length }} 任务 · {{ stationHours(scenario.id) }} 课时
                    </div>
                  </div>
                </div>

                <!-- 滚动指示条 -->
                <div class="lp-thumb-bar">
                  <div ref="thumbRef" class="lp-thumb" />
                </div>
              </div>
            </div>

            <!-- 当前站任务面板 -->
            <div class="lp-panel">
              <div class="lp-panel-head">
                <div class="lp-panel-name">
                  {{ steps[activeIndex]?.name }}
                  {{ activeIndex === 0 ? '（起点）' : activeIndex === steps.length - 1 ? '（终点）' : '' }}
                </div>
                <div class="lp-panel-meta">
                  {{ activeTasks.length }} 任务 · {{ activeHours }} 课时
                </div>
              </div>
              <p v-if="activeTasks.length === 0" class="lp-no-tasks">该场景暂无任务</p>
              <div v-else class="lp-tasks">
                <div v-for="(task, idx) in activeTasks" :key="task.id" class="lp-task">
                  <div class="lp-task-left">
                    <div class="lp-task-no">{{ idx + 1 }}</div>
                    <div>
                      <div class="lp-task-name">{{ task.name }}</div>
                      <div class="lp-task-tags">
                        <span class="task-tag">{{ task.taskType === 'assessment' ? '测评任务' : '训练任务' }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="lp-task-right">
                    <span class="lp-task-hours">{{ task.estimatedHours || 0 }}课时</span>
                    <button type="button" class="lp-task-btn" @click="goLearn(task.id)">
                      <el-icon><VideoPlay /></el-icon>去学习
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue';
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElIcon } from 'element-plus';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Collection,
  Flag,
  Guide,
  Iphone,
  Lock,
  Share,
  ShoppingCart,
  TrendCharts,
  Trophy,
  UserFilled,
  VideoPlay
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { learnRoadApi, publicPositionApi } from '@/api/job';
import { scenarioApi, taskApi } from '@/api/scene';
import type { CareerPosition, LearnRoad } from '@/types/job';
import type { Scenario, ScenarioTask } from '@/types/scene';

// ===== 常量（对齐 React LearningPath ICONS/COLORS） =====
const ROAD_ICONS = [Flag, ShoppingCart, Iphone, TrendCharts, Share, UserFilled, Trophy] as Component[];
const ROAD_COLORS = [
  'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'linear-gradient(135deg, #52c41a, #73d13d)',
  'linear-gradient(135deg, #f59e0b, #ffc53d)',
  'linear-gradient(135deg, #eb2f96, #f759ab)',
  'linear-gradient(135deg, #722ed1, #b37feb)',
  'linear-gradient(135deg, #fa541c, #ff7a45)',
  'linear-gradient(135deg, #fadb14, #ffec3d)'
];

// ===== 路由与登录态 =====
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loggedIn = computed(() => auth.isLoggedIn);
const id = computed(() => String(route.params.id || ''));

// ===== 数据状态 =====
const position = ref<CareerPosition | null>(null);
const loading = ref(true);
const roads = ref<LearnRoad[]>([]);
const scenarios = ref<Scenario[]>([]);
const scenarioTasks = ref<ScenarioTask[]>([]);
// 岗位内容加载请求序号：岗位快速切换时丢弃过期响应（与详情页一致）
const learnSeq = ref(0);

// ===== 岗位加载（对齐 React learn 页详情 effect） =====
watch(
  id,
  async (val) => {
    if (!val) return;
    const seq = ++learnSeq.value;
    loading.value = true;
    try {
      const pos = await publicPositionApi.get(val);
      if (seq !== learnSeq.value) return;
      position.value = pos;
    } catch {
      if (seq !== learnSeq.value) return;
      position.value = null;
    } finally {
      if (seq === learnSeq.value) loading.value = false;
    }
  },
  { immediate: true }
);

// ===== 关联数据加载（对齐 React learn 页关联数据 effect） =====
watch(
  [id, position, loggedIn],
  async ([val, pos, lg]) => {
    if (!val || !pos) return;
    const seq = ++learnSeq.value;

    scenarioApi
      .list({ careerPositionId: val, status: 'published', limit: 1000 })
      .then(async (res) => {
        const scens = res.items || [];
        if (seq !== learnSeq.value) return;
        scenarios.value = scens;
        const allTasks: ScenarioTask[] = [];
        // 逐任务容错：单个场景任务加载失败只记录错误，不清空已加载数据
        await Promise.all(
          scens.map(async (s: Scenario) => {
            try {
              const r = await taskApi.list({ scenarioId: s.id, limit: 1000 });
              allTasks.push(...(r.items || []));
            } catch (err) {
              console.error(`加载场景任务（${s.id}）`, err);
            }
          })
        );
        if (seq !== learnSeq.value) return;
        scenarioTasks.value = allTasks;
      })
      .catch(() => {
        if (seq === learnSeq.value) {
          scenarios.value = [];
          scenarioTasks.value = [];
        }
      });

    // 学习路径仅登录用户可读（/job/learn-roads 菜单授权）
    if (!lg) return;

    learnRoadApi
      .list({ limit: 100 })
      .then((roadRes) => {
        if (seq !== learnSeq.value) return;
        roads.value = (roadRes.items || []).filter((r: LearnRoad) => r.positionIds?.includes(val));
      })
      .catch((err) => {
        if (seq !== learnSeq.value) return;
        console.error('加载学习路径数据', err);
      });
  },
  { immediate: true }
);

// ===== 场景排序（对齐 React lib/learn-road-order.ts，与详情页共用同一规则） =====
function orderScenariosByLearnRoad(roads: LearnRoad[], scens: Scenario[]): Scenario[] {
  if (!scens.length) return [];
  const road = roads[0];
  if (!road?.steps?.length) return scens;
  const scenarioMap = new Map(scens.map((s) => [s.id, s]));
  const usedIds = new Set<string>();
  const result: Scenario[] = [];
  for (const step of road.steps) {
    if (step.scenarioId && scenarioMap.has(step.scenarioId) && !usedIds.has(step.scenarioId)) {
      const sc = scenarioMap.get(step.scenarioId)!;
      result.push(sc);
      usedIds.add(sc.id);
      continue;
    }
    // 兼容旧数据：按名称匹配
    const matched = scens.find((s) => s.name === step.name && !usedIds.has(s.id));
    if (matched) {
      result.push(matched);
      usedIds.add(matched.id);
    }
  }
  for (const sc of scens) {
    if (!usedIds.has(sc.id)) result.push(sc);
  }
  return result;
}

const orderedScenarios = computed(() => orderScenariosByLearnRoad(roads.value, scenarios.value));

// 当前岗位关联的第一条学习路径（标题/副标题展示）
const road = computed(() => roads.value[0]);

// ===== 站点步骤（对齐 React LearningPath steps：仅来自有序实践场景，空时展示空态） =====
interface LearnStep {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  scenarioId: string;
}

const steps = computed<LearnStep[]>(() =>
  orderedScenarios.value.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.background || '',
    scenarioId: s.id,
    coverImage: s.coverImage
  }))
);

// ===== 任务映射（对齐 React LearningPath taskMap） =====
const taskMap = computed(() => {
  const map = new Map<string, ScenarioTask[]>();
  scenarioTasks.value.forEach((t) => {
    const list = map.get(t.scenarioId) || [];
    list.push(t);
    map.set(t.scenarioId, list);
  });
  for (const list of map.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
});

function stationTasks(scenarioId: string): ScenarioTask[] {
  return taskMap.value.get(scenarioId) || [];
}
function stationHours(scenarioId: string): number {
  return stationTasks(scenarioId).reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
}

// ===== 站台交互（对齐 React LearningPath 导航与滚动） =====
const activeIndex = ref(0);
const trackRef = ref<HTMLElement | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);
const thumbRef = ref<HTMLElement | null>(null);

watch(steps, (list) => {
  if (activeIndex.value >= list.length && list.length > 0) {
    activeIndex.value = 0;
  }
});

function navigate(dir: number) {
  const next = activeIndex.value + dir;
  if (next >= 0 && next < steps.value.length) {
    activeIndex.value = next;
    const item = trackRef.value?.children[next] as HTMLElement | undefined;
    if (item) item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function onTrackScroll() {
  const wrapper = wrapperRef.value;
  const thumb = thumbRef.value;
  if (!wrapper || !thumb) return;
  const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
  const pct = maxScroll > 0 ? wrapper.scrollLeft / maxScroll : 0;
  thumb.style.transform = `translateX(${pct * 20}px)`;
}

// ===== 当前站任务面板 =====
const activeScenarioId = computed(() => orderedScenarios.value[activeIndex.value]?.id);
const activeTasks = computed(() =>
  activeScenarioId.value ? stationTasks(activeScenarioId.value) : []
);
const activeHours = computed(() =>
  activeScenarioId.value ? stationHours(activeScenarioId.value) : 0
);

function stationCoverStyle(scenario: LearnStep) {
  return scenario.coverImage
    ? {
        boxShadow: activeScenarioId.value === scenario.id
          ? '0 6px 24px rgba(245,158,11,0.35)'
          : '0 4px 16px rgba(0,0,0,0.2)'
      }
    : {};
}
function stationCircleStyle(i: number) {
  return {
    background: ROAD_COLORS[i % ROAD_COLORS.length],
    boxShadow: activeIndex.value === i ? '0 6px 24px rgba(245,158,11,0.35)' : '0 4px 16px rgba(0,0,0,0.2)'
  };
}

function goLearn(taskId: string) {
  // 场景学习页路由由后续对齐任务补齐，此处保持与 React 一致的跳转目标
  if (activeScenarioId.value) {
    router.push(`/scene/landing/${activeScenarioId.value}/learn?task=${taskId}`);
  }
}

// ===== 登录提示（对齐 React LoginPrompt） =====
const LoginPrompt = defineComponent({
  name: 'LoginPrompt',
  props: {
    text: { type: String, required: true },
    desc: { type: String, required: true }
  },
  setup(props) {
    return () =>
      h('div', { class: 'login-prompt' }, [
        h(ElIcon, { size: 48, class: 'login-prompt-icon' }, () => h(Lock)),
        h('p', { class: 'login-prompt-title' }, props.text),
        h('p', { class: 'login-prompt-desc' }, props.desc)
      ]);
  }
});
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
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

/* ===== 岗位不存在 ===== */
.jl-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  min-height: 60vh;
}
.jl-empty-icon {
  color: #94a3b8;
  margin-bottom: 16px;
  opacity: 0.5;
}
.jl-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 12px;
}
.jl-empty-link {
  color: var(--el-color-primary);
  font-size: 14px;
  text-decoration: none;
}
.jl-empty-link:hover {
  text-decoration: underline;
}

/* ===== 主区 ===== */
.jl-main {
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
}
.jl-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #64748b;
  text-decoration: none;
  margin-bottom: 16px;
}
.jl-back:hover {
  color: var(--el-color-primary);
}
.jl-card {
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(69, 26, 3, 0.06);
  padding: 20px 24px;
  min-height: 500px;
}
@media (max-width: 768px) {
  .jl-card { padding: 16px; }
}

/* ===== 登录提示 / 空态 ===== */
.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}
.login-prompt-icon {
  color: #94a3b8;
  opacity: 0.4;
  margin-bottom: 14px;
}
.login-prompt-title {
  font-size: 15px;
  font-weight: 600;
  color: #475569;
  margin: 0 0 6px;
}
.login-prompt-desc {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}
.lp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 0;
}
.lp-empty-icon {
  color: #94a3b8;
  opacity: 0.4;
  margin-bottom: 12px;
}
.lp-empty-title {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

/* ===== 学习路径 ===== */
.lp-head {
  text-align: center;
  margin-bottom: 20px;
}
.lp-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px;
}
.lp-title .el-icon {
  color: var(--el-color-primary);
}
.lp-sub {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

/* ===== 站台轨道 ===== */
.lp-stage {
  position: relative;
  padding: 0 40px 20px;
  overflow: hidden;
}
@media (max-width: 640px) {
  .lp-stage { padding: 0 32px 16px; }
}
.lp-nav-btn {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #e0e0e0;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.lp-nav-btn:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}
.lp-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.lp-nav-right {
  left: auto;
  right: 0;
}
.lp-track-wrap {
  overflow-x: auto;
  padding-bottom: 16px;
}
.lp-track-wrap::-webkit-scrollbar {
  display: none;
}
.lp-track {
  position: relative;
  display: flex;
  align-items: flex-start;
  min-width: max-content;
  padding: 16px 20px;
}
.lp-track-line {
  position: absolute;
  top: 80px;
  left: 80px;
  right: 80px;
  height: 3px;
  border-radius: 4px;
  background: linear-gradient(90deg, #3b82f6, #52c41a, #f59e0b, #eb2f96, #722ed1, #fa541c, #fadb14);
}
.lp-station {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 180px;
  padding: 0 24px 16px;
  cursor: pointer;
}
.lp-station-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
  white-space: nowrap;
  height: 16px;
  margin-bottom: 8px;
}
.lp-station-label-spacer {
  height: 16px;
  margin-bottom: 8px;
}
.lp-station-cover {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 16px;
  transition: all 0.2s;
}
.lp-station.active .lp-station-cover {
  transform: scale(1.1);
}
.lp-station-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lp-station-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 16px;
  transition: all 0.2s;
}
.lp-station.active .lp-station-circle {
  transform: scale(1.1);
}
.lp-station-name {
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1f2937;
}
.lp-station.active .lp-station-name {
  color: var(--el-color-primary);
}
.lp-station-meta {
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  white-space: nowrap;
}
.lp-thumb-bar {
  width: 40px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 4px;
  margin: 0 auto;
  overflow: hidden;
}
.lp-thumb {
  width: 20px;
  height: 100%;
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-3));
  border-radius: 4px;
  transition: transform 0.1s linear;
}

/* ===== 当前站任务面板 ===== */
.lp-panel {
  margin-top: 16px;
  padding: 20px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
}
.lp-panel-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
@media (min-width: 640px) {
  .lp-panel-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.lp-panel-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.lp-panel-meta {
  font-size: 12px;
  color: #64748b;
}
.lp-no-tasks {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}
.lp-tasks {
  display: flex;
  flex-direction: column;
}
.lp-task {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid #f1f5f9;
}
.lp-task:first-child {
  border-top: none;
}
.lp-task-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.lp-task-no {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.lp-task-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}
.lp-task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.task-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
}
.lp-task-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.lp-task-hours {
  font-size: 12px;
  color: #94a3b8;
}
.lp-task-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.lp-task-btn:hover {
  background: var(--el-color-primary-dark-2);
}
</style>

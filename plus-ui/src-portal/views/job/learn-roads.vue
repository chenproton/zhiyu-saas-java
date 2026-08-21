<template>
  <div class="learn-roads">
    <!-- 列表视图 -->
    <template v-if="view === 'list'">
      <div class="page-header">
        <div>
          <h2 class="page-title">岗位学习路径管理</h2>
          <p class="page-sub">按岗位管理学习路径中场景与任务的展示顺序</p>
        </div>
      </div>

      <el-card shadow="never" class="filter-card">
        <div class="filter-row">
          <el-input v-model="searchQuery" placeholder="搜索岗位名称、简称..." clearable style="max-width: 320px" />
          <el-select v-model="filterStatus" placeholder="全部状态" style="width: 140px">
            <el-option label="全部状态" value="all" />
            <el-option label="草稿" value="draft" />
            <el-option label="审批中" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
            <el-option label="已发布" value="published" />
          </el-select>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">岗位列表</span>
            <span class="card-sub">
              共 {{ filteredPositions.length }} 个岗位
              <el-icon v-if="listLoading || dataLoading" class="is-loading" style="vertical-align: middle"><Loading /></el-icon>
            </span>
          </div>
        </template>
        <el-table v-loading="listLoading" :data="filteredPositions" stripe>
          <el-table-column label="岗位名称" min-width="200">
            <template #default="{ row }">
              <div class="pos-name">{{ row.name }}</div>
              <div class="sub">{{ row.shortName }}</div>
            </template>
          </el-table-column>
          <el-table-column label="场景数" width="100">
            <template #default="{ row }">
              <el-tag>{{ sceneStats.get(row.id)?.sceneCount ?? 0 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="任务数" width="100">
            <template #default="{ row }">
              <el-tag type="info">{{ sceneStats.get(row.id)?.taskCount ?? 0 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="right">
            <template #default="{ row }">
              <el-button size="small" :disabled="editLoading" @click="handleEdit(row)">编辑学习路径</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <!-- 编辑视图 -->
    <template v-else>
      <div class="page-header edit-header">
        <div class="header-left">
          <el-button @click="handleBack" :disabled="editLoading">返回岗位列表</el-button>
          <div>
            <h2 class="page-title">{{ editingPosition?.name }}</h2>
            <p class="page-sub">{{ editingBatchName }} · {{ editingPosition?.shortName }}</p>
            <p class="page-sub-mini">
              已加载 {{ scenes.length }} 个场景，{{ totalTasks }} 个任务
            </p>
          </div>
        </div>
        <el-button type="primary" :loading="saving" :disabled="editLoading" @click="handleSave">
          {{ saved ? '已保存' : '保存顺序' }}
        </el-button>
      </div>

      <el-card shadow="never" v-loading="editLoading">
        <template #header>
          <div class="card-header">
            <span class="card-title">{{ editingPosition?.name }}学习路径</span>
            <span class="card-sub">点击上方阶段图标，查看该阶段的学习任务</span>
          </div>
        </template>

        <!-- 时间线 -->
        <div class="timeline">
          <button class="tl-scroll tl-left" @click="scrollTimeline(-1)"><el-icon><ArrowLeft /></el-icon></button>
          <button class="tl-scroll tl-right" @click="scrollTimeline(1)"><el-icon><ArrowRight /></el-icon></button>
          <div ref="timelineRef" class="tl-viewport">
            <div v-if="scenes.length > 0" class="tl-track">
              <div class="tl-line"></div>
              <button
                v-for="(scene, idx) in scenes"
                :key="scene.id"
                class="tl-node"
                :class="{ selected: selectedSceneId === scene.id }"
                @click="selectedSceneId = scene.id"
              >
                <div class="tl-label">{{ idx === 0 ? 'START · 第1站' : `第${idx + 1}站` }}</div>
                <div
                  class="tl-circle"
                  :style="scene.coverImage ? undefined : { background: nodeColors[idx % nodeColors.length] }"
                >
                  <img v-if="scene.coverImage" :src="scene.coverImage" :alt="scene.name" class="tl-img" />
                  <span v-else class="tl-index">{{ idx + 1 }}</span>
                </div>
                <div class="tl-name">{{ scene.name }}</div>
                <div class="tl-meta">{{ scene.tasks.length }} 任务 · {{ scene.hours }} 课时</div>
              </button>
            </div>
            <el-empty v-else-if="!editLoading" description="该岗位下暂无已发布场景，请先创建并发布场景" :image-size="60" />
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="order-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">场景顺序</span>
            <span class="card-sub">拖拽场景卡片可调整顺序，点击场景查看任务</span>
          </div>
        </template>
        <el-empty v-if="scenes.length === 0" description="暂无可排序的场景" :image-size="60" />
        <div v-else class="scene-list">
          <div
            v-for="(scene, index) in scenes"
            :key="scene.id"
            class="scene-item"
            :class="{
              selected: selectedSceneId === scene.id,
              dragging: draggingIndex === index,
              'drag-over': dragOverIndex === index && dragOverIndex !== draggingIndex
            }"
            draggable="true"
            @click="selectedSceneId = scene.id"
            @dragstart="handleDragStart(index)"
            @dragover="handleDragOver($event, index)"
            @drop="handleDrop($event, index)"
            @dragleave="dragOverIndex = null"
            @dragend="handleDragEnd"
          >
            <span class="scene-grip">⋮⋮</span>
            <img v-if="scene.coverImage" :src="scene.coverImage" :alt="scene.name" class="scene-cover" />
            <span v-else class="scene-index">{{ index + 1 }}</span>
            <div class="scene-info">
              <div class="scene-name">{{ scene.name }}</div>
              <div class="scene-meta">{{ scene.tasks.length }} 任务 · {{ scene.hours }} 课时</div>
            </div>
            <div class="scene-actions" @click.stop>
              <el-button size="small" :disabled="index === 0" @click="moveScene(index, -1)">上移</el-button>
              <el-button size="small" :disabled="index === scenes.length - 1" @click="moveScene(index, 1)">下移</el-button>
            </div>
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight, Loading } from '@element-plus/icons-vue';
import { positionApi, batchApi, learnRoadApi } from '@/api/job';
import { scenarioApi, taskApi } from '@/api/scene';
import type { CareerPosition, JobBatch, LearnRoad, LearnRoadStep } from '@/types/job';
import type { Scenario, ScenarioTask } from '@/types/scene';

interface SceneItem {
  id: string;
  name: string;
  coverImage?: string;
  hours: number;
  tasks: { id: string; name: string; estimatedHours?: number }[];
}

const nodeColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#a855f7', '#6366f1', '#f43f5e'];

const view = ref<'list' | 'edit'>('list');
const positions = ref<CareerPosition[]>([]);
const batches = ref<JobBatch[]>([]);
const allScenarios = ref<Scenario[]>([]);
const listLoading = ref(false);
const dataLoading = ref(false);
const editLoading = ref(false);
const saving = ref(false);
const saved = ref(false);

const searchQuery = ref('');
const filterStatus = ref('all');

const editingPosition = ref<CareerPosition | null>(null);
const scenes = ref<SceneItem[]>([]);
const selectedSceneId = ref<string | null>(null);
const learnRoadId = ref<string | null>(null);
let learnRoadsCache: LearnRoad[] | null = null;

const draggingIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const timelineRef = ref<HTMLDivElement | null>(null);

// 保存成功提示 2s 自动消失的定时器句柄（卸载时清理）
let savedTimer: ReturnType<typeof setTimeout> | null = null;
// 编辑加载请求序号：快速切换岗位时丢弃过期响应
let editSeq = 0;

const sceneStats = computed(() => {
  const m = new Map<string, { sceneCount: number; taskCount: number }>();
  for (const s of allScenarios.value) {
    if (!s.careerPositionId) continue;
    const cur = m.get(s.careerPositionId) ?? { sceneCount: 0, taskCount: 0 };
    cur.sceneCount += 1;
    cur.taskCount += s.taskCount ?? 0;
    m.set(s.careerPositionId, cur);
  }
  return m;
});

const filteredPositions = computed(() => {
  let result = positions.value;
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter((p) => p.name.toLowerCase().includes(q) || (p.shortName || '').toLowerCase().includes(q));
  }
  if (filterStatus.value !== 'all') {
    result = result.filter((p) => p.status === filterStatus.value);
  }
  return result;
});

const editingBatchName = computed(() => {
  const id = editingPosition.value?.batchId;
  if (!id) return '未关联批次';
  return batches.value.find((b) => b.id === id)?.name || '未关联批次';
});

const totalTasks = computed(() => scenes.value.reduce((sum, s) => sum + s.tasks.length, 0));

async function loadList() {
  listLoading.value = true;
  dataLoading.value = true;
  try {
    const [posRes, batchRes, roadRes, scenarioRes] = await Promise.all([
      positionApi.list({ limit: 1000 }),
      batchApi.list({ limit: 1000 }),
      learnRoadApi.list({ limit: 1000 }),
      scenarioApi.list({ limit: 1000 })
    ]);
    positions.value = posRes.items;
    batches.value = batchRes.items;
    learnRoadsCache = roadRes.items;
    allScenarios.value = scenarioRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    listLoading.value = false;
    dataLoading.value = false;
  }
}

function tasksToSceneItems(scenario: Scenario, tasks: ScenarioTask[]): SceneItem {
  const scenarioTasks = tasks
    .filter((t) => t.scenarioId === scenario.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({ id: t.id, name: t.name, estimatedHours: t.estimatedHours }));
  return {
    id: scenario.id,
    name: scenario.name,
    coverImage: scenario.coverImage,
    hours: scenarioTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
    tasks: scenarioTasks
  };
}

function orderScenesByRoad(roads: LearnRoad[], scenarios: Scenario[]): Scenario[] {
  const steps = (roads[0]?.steps || []) as LearnRoadStep[];
  const ordered: Scenario[] = [];
  const used = new Set<string>();
  for (const step of steps) {
    if (!step.scenarioId) continue;
    const s = scenarios.find((x) => x.id === step.scenarioId);
    if (s && !used.has(s.id)) {
      ordered.push(s);
      used.add(s.id);
    }
  }
  for (const s of scenarios) {
    if (!used.has(s.id)) ordered.push(s);
  }
  return ordered;
}

async function loadPositionScenes(positionId: string): Promise<{ scenarios: Scenario[]; tasks: ScenarioTask[] }> {
  const scenarioRes = await scenarioApi.list({ careerPositionId: positionId, limit: 1000 });
  const scens = (scenarioRes.items || []).filter((s) => s.status && s.status !== 'archived');
  const taskResults = scens.length
    ? await Promise.all(scens.map((s) => taskApi.list({ scenarioId: s.id, limit: 1000 })))
    : [];
  const allTasks = taskResults.flatMap((r) => r.items || []);
  return { scenarios: scens, tasks: allTasks };
}

async function handleEdit(position: CareerPosition) {
  const seq = ++editSeq;
  view.value = 'edit';
  editingPosition.value = position;
  saved.value = false;
  editLoading.value = true;
  try {
    const roadsPromise = learnRoadsCache
      ? Promise.resolve(learnRoadsCache)
      : learnRoadApi.list({ limit: 1000 }).then((res) => {
          learnRoadsCache = res.items;
          return res.items;
        });
    const [roads, { scenarios, tasks }] = await Promise.all([
      roadsPromise,
      loadPositionScenes(position.id)
    ]);
    if (seq !== editSeq) return;

    const existing = roads.find((r) => r.positionIds?.includes(position.id));
    learnRoadId.value = existing?.id || null;

    const ordered = existing ? orderScenesByRoad([existing], scenarios) : scenarios;
    scenes.value = ordered.map((s) => tasksToSceneItems(s, tasks));
    selectedSceneId.value = scenes.value[0]?.id || null;
  } catch (e) {
    if (seq !== editSeq) return;
    ElMessage.error((e as Error).message || '加载失败');
    scenes.value = [];
    selectedSceneId.value = null;
    learnRoadId.value = null;
  } finally {
    if (seq === editSeq) editLoading.value = false;
  }
}

function handleBack() {
  view.value = 'list';
  editingPosition.value = null;
  scenes.value = [];
  selectedSceneId.value = null;
  learnRoadId.value = null;
  saved.value = false;
}

function moveScene(index: number, direction: -1 | 1) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= scenes.value.length) return;
  const arr = [...scenes.value];
  const [moved] = arr.splice(index, 1);
  arr.splice(newIndex, 0, moved);
  scenes.value = arr;
  saved.value = false;
}

function handleDragStart(index: number) {
  draggingIndex.value = index;
}
function handleDragOver(e: DragEvent, index: number) {
  e.preventDefault();
  dragOverIndex.value = index;
}
function handleDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault();
  if (draggingIndex.value === null || draggingIndex.value === targetIndex) {
    draggingIndex.value = null;
    dragOverIndex.value = null;
    return;
  }
  const arr = [...scenes.value];
  const [moved] = arr.splice(draggingIndex.value, 1);
  arr.splice(targetIndex, 0, moved);
  scenes.value = arr;
  saved.value = false;
  draggingIndex.value = null;
  dragOverIndex.value = null;
}
function handleDragEnd() {
  draggingIndex.value = null;
  dragOverIndex.value = null;
}

function scrollTimeline(direction: -1 | 1) {
  timelineRef.value?.scrollBy({ left: direction * 200, behavior: 'smooth' });
}

async function handleSave() {
  const position = editingPosition.value;
  if (!position) return;
  const steps: LearnRoadStep[] = scenes.value.map((s) => ({
    name: s.name,
    scenarioId: s.id,
    tasks: s.tasks.map((t) => ({ id: t.id, name: t.name }))
  }));
  saving.value = true;
  try {
    let id = learnRoadId.value;
    if (!id) {
      const created = await learnRoadApi.create({
        name: `${position.name}学习路径`,
        positionIds: [position.id],
        steps
      });
      id = created.id;
      learnRoadId.value = id;
      learnRoadsCache = [created, ...(learnRoadsCache ?? [])];
    }
    const updated = await learnRoadApi.update(id, {
      name: `${position.name}学习路径`,
      positionIds: [position.id],
      steps
    });
    learnRoadsCache = (learnRoadsCache ?? []).map((r) => (r.id === updated.id ? updated : r));
    saved.value = true;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      saved.value = false;
    }, 2000);
    ElMessage.success('学习路径顺序已更新');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadList);
onBeforeUnmount(() => {
  if (savedTimer) clearTimeout(savedTimer);
});
</script>

<style scoped>
.learn-roads { padding: 16px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.edit-header { align-items: center; }
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 6px 0 0; }
.page-sub-mini { color: #c0c4cc; font-size: 12px; margin: 2px 0 0; }
.filter-card { margin-bottom: 16px; }
.filter-row { display: flex; gap: 12px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; }
.pos-name { font-weight: 600; }
.sub { color: #909399; font-size: 12px; }

/* 时间线 */
.timeline { position: relative; padding: 8px 0; }
.tl-scroll {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 20;
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid #e4e7ed; background: rgba(255,255,255,.85); color: #909399;
  cursor: pointer;
}
.tl-scroll:hover { background: #fff; color: #409eff; }
.tl-left { left: 0; }
.tl-right { right: 0; }
.tl-viewport { overflow-x: auto; padding: 0 40px; }
.tl-track { position: relative; display: flex; align-items: flex-start; min-width: max-content; padding: 8px 4px 16px; }
.tl-line {
  position: absolute; top: 42px; left: 0; right: 0; height: 6px; border-radius: 3px;
  background: linear-gradient(90deg, #3b82f6, #22c55e, #f59e0b, #ec4899, #a855f7, #f43f5e);
}
.tl-node {
  position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center;
  min-width: 150px; margin: 0 12px; background: transparent; border: none; cursor: pointer; padding: 0;
}
.tl-label { font-size: 12px; color: #c0c4cc; height: 20px; }
.tl-circle {
  position: relative; z-index: 2; display: flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; border-radius: 50%; overflow: hidden; margin-top: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.12); transition: transform .2s;
}
.tl-node.selected .tl-circle { transform: scale(1.1); box-shadow: 0 0 0 4px #fff, 0 0 0 6px #409eff; }
.tl-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.tl-index { color: #fff; font-weight: 700; font-size: 20px; }
.tl-name { margin-top: 12px; font-size: 14px; font-weight: 600; color: #303133; text-align: center; max-width: 140px; }
.tl-node.selected .tl-name { color: #409eff; }
.tl-meta { font-size: 12px; color: #909399; margin-top: 4px; }

/* 场景顺序 */
.order-card { margin-top: 16px; }
.scene-list { display: flex; flex-direction: column; gap: 8px; }
.scene-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border: 1px solid #e4e7ed; border-radius: 8px; cursor: pointer; transition: all .2s;
}
.scene-item:hover { background: #f5f7fa; }
.scene-item.selected { border-color: #409eff; background: #ecf5ff; }
.scene-item.dragging { opacity: .4; }
.scene-item.drag-over { border-color: #409eff; background: #ecf5ff; }
.scene-grip { color: #c0c4cc; cursor: grab; font-size: 16px; letter-spacing: -2px; }
.scene-cover { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid #e4e7ed; }
.scene-index { display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border-radius: 50%; background: #e4e7ed; color: #606266; font-weight: 600; flex-shrink: 0; }
.scene-item.selected .scene-index { background: #409eff; color: #fff; }
.scene-info { flex: 1; min-width: 0; }
.scene-name { font-weight: 600; }
.scene-meta { color: #909399; font-size: 12px; margin-top: 2px; }
.scene-actions { display: flex; gap: 4px; flex-shrink: 0; }
</style>

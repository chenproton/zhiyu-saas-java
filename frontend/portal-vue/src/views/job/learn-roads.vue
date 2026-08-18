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
            <span class="card-sub">共 {{ filteredPositions.length }} 个岗位</span>
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
          <el-table-column label="操作" width="140" align="right">
            <template #default="{ row }">
              <el-button size="small" :disabled="editLoading" @click="handleEdit(row)">编辑学习路径</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <!-- 编辑视图 -->
    <template v-else>
      <div class="page-header">
        <div class="header-left">
          <el-button @click="handleBack" :disabled="editLoading">返回岗位列表</el-button>
          <div>
            <h2 class="page-title">{{ editingPosition?.name }}</h2>
            <p class="page-sub">已加载 {{ scenes.length }} 个场景 · 点击场景查看任务</p>
          </div>
        </div>
        <el-button type="primary" :loading="saving" @click="handleSave">{{ saved ? '已保存' : '保存顺序' }}</el-button>
      </div>

      <el-card shadow="never" v-loading="editLoading">
        <template #header>
          <div class="card-header">
            <span class="card-title">场景顺序</span>
            <span class="card-sub">通过上移/下移调整场景顺序，点击场景查看任务</span>
          </div>
        </template>
        <el-empty v-if="scenes.length === 0" description="暂无可排序的场景" />
        <div v-else class="scene-list">
          <div
            v-for="(scene, index) in scenes"
            :key="scene.id"
            class="scene-item"
            :class="{ selected: selectedSceneId === scene.id }"
            @click="selectedSceneId = scene.id"
          >
            <span class="scene-index">{{ index + 1 }}</span>
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

      <el-card v-if="selectedScene" shadow="never" class="task-card">
        <template #header>
          <span class="card-title">{{ selectedScene.name }} · 任务列表</span>
        </template>
        <el-table :data="selectedScene.tasks" stripe>
          <el-table-column label="任务名称" prop="name" />
          <el-table-column label="课时" prop="estimatedHours" width="100" />
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { positionApi, batchApi, learnRoadApi } from '@/api/job';
import { scenarioApi, taskApi } from '@/api/scene';
import type { CareerPosition, LearnRoad, LearnRoadStep } from '@/types/job';
import type { Scenario, ScenarioTask } from '@/types/scene';

interface SceneItem {
  id: string;
  name: string;
  hours: number;
  tasks: { id: string; name: string; estimatedHours?: number }[];
}

const view = ref<'list' | 'edit'>('list');
const positions = ref<CareerPosition[]>([]);
const allScenarios = ref<Scenario[]>([]);
const listLoading = ref(false);
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

const selectedScene = computed(() => scenes.value.find((s) => s.id === selectedSceneId.value) || null);

async function loadList() {
  listLoading.value = true;
  try {
    const [posRes, roadRes, scenarioRes] = await Promise.all([
      positionApi.list({ limit: 1000 }),
      learnRoadApi.list({ limit: 1000 }),
      scenarioApi.list({ limit: 1000 })
    ]);
    positions.value = posRes.items;
    learnRoadsCache = roadRes.items;
    allScenarios.value = scenarioRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    listLoading.value = false;
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

async function handleEdit(position: CareerPosition) {
  view.value = 'edit';
  editingPosition.value = position;
  saved.value = false;
  editLoading.value = true;
  try {
    const scenarioRes = await scenarioApi.list({ careerPositionId: position.id, limit: 1000 });
    const scens = (scenarioRes.items || []).filter((s) => s.status && s.status !== 'archived');
    const taskResults = scens.length
      ? await Promise.all(scens.map((s) => taskApi.list({ scenarioId: s.id, limit: 1000 })))
      : [];
    const allTasks = taskResults.flatMap((r) => r.items || []);

    const roads = learnRoadsCache ?? (await learnRoadApi.list({ limit: 1000 })).items;
    learnRoadsCache = roads;
    const existing = roads.find((r) => r.positionIds?.includes(position.id));
    learnRoadId.value = existing?.id || null;

    const ordered = existing ? orderScenesByRoad([existing], scens) : scens;
    scenes.value = ordered.map((s) => tasksToSceneItems(s, allTasks));
    selectedSceneId.value = scenes.value[0]?.id || null;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
    scenes.value = [];
    selectedSceneId.value = null;
  } finally {
    editLoading.value = false;
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
      if (learnRoadsCache) learnRoadsCache = [created, ...learnRoadsCache];
    } else {
      await learnRoadApi.update(id, {
        name: `${position.name}学习路径`,
        positionIds: [position.id],
        steps
      });
    }
    saved.value = true;
    ElMessage.success('学习路径顺序已更新');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadList);
</script>

<style scoped>
.learn-roads { padding: 16px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.filter-card { margin-bottom: 16px; }
.filter-row { display: flex; gap: 12px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; }
.pos-name { font-weight: 600; }
.sub { color: #909399; font-size: 12px; }
.scene-list { display: flex; flex-direction: column; gap: 8px; }
.scene-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border: 1px solid #e4e7ed; border-radius: 8px; cursor: pointer; transition: all .2s;
}
.scene-item:hover { background: #f5f7fa; }
.scene-item.selected { border-color: #409eff; background: #ecf5ff; }
.scene-index { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 50%; background: #e4e7ed; color: #606266; font-weight: 600; }
.scene-item.selected .scene-index { background: #409eff; color: #fff; }
.scene-info { flex: 1; }
.scene-name { font-weight: 600; }
.scene-meta { color: #909399; font-size: 12px; margin-top: 2px; }
.scene-actions { display: flex; gap: 4px; }
.task-card { margin-top: 16px; }
</style>

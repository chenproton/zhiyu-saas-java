<template>
  <div class="scene-results">
    <div class="topbar">
      <h2 class="page-title">场景任务评价</h2>
      <p class="page-sub">选择场景与任务，查看学生提交并进行评分</p>
    </div>

    <div class="layout">
      <!-- 左侧场景列表（按岗位分组） -->
      <div class="side-col">
        <el-input v-model="searchQuery" placeholder="搜索场景..." clearable class="side-search" />
        <div class="scenario-list">
          <template v-for="group in filteredGroups" :key="group.positionName">
            <div class="pos-group-label">{{ group.positionName }}</div>
            <div
              v-for="sc in group.scenarios"
              :key="sc.scenarioId"
              class="scenario-item"
              :class="{ active: selectedScenarioId === sc.scenarioId }"
              @click="selectScenario(sc.scenarioId)"
            >
              <div class="scenario-main">
                <div class="scenario-name">{{ sc.scenarioName }}</div>
                <div class="scenario-code">{{ sc.scenarioCode }}</div>
              </div>
              <div class="scenario-badges">
                <span v-if="sc.pendingCount" class="badge pending">{{ sc.pendingCount }}</span>
                <span v-if="sc.gradedCount" class="badge graded">{{ sc.gradedCount }}</span>
              </div>
            </div>
          </template>
          <el-empty v-if="filteredGroups.length === 0" description="暂无已发布场景" :image-size="60" />
        </div>
      </div>

      <!-- 右侧任务结果 -->
      <div class="main-col">
        <template v-if="selectedScenario">
          <div class="main-header">
            <div>
              <h3 class="scenario-title">{{ selectedScenario.name }}</h3>
              <span class="scenario-count">{{ results.length }} 条提交记录</span>
            </div>
            <div v-if="taskGroups.length">
              <el-button size="small" @click="expandAll">全部展开</el-button>
              <el-button size="small" @click="collapseAll">全部收起</el-button>
            </div>
          </div>

          <el-empty v-if="taskGroups.length === 0" description="该场景下暂无学生提交记录" />
          <el-collapse v-else v-model="expandedTasks" class="task-collapse">
            <el-collapse-item v-for="task in taskGroups" :key="task.taskId" :name="task.taskId">
              <template #title>
                <div class="task-header">
                  <span class="task-name">{{ task.taskName }}</span>
                  <div class="task-stats">
                    <span>学生 {{ task.totalStudents }}</span>
                    <span class="pending">待评 {{ task.totalPending }}</span>
                    <span class="graded">已评 {{ task.totalGraded }}</span>
                    <el-tag v-if="task.totalGraded" size="small" type="info">均分 {{ task.taskScore.toFixed(1) }}</el-tag>
                  </div>
                </div>
              </template>

              <!-- 测评方法 tabs -->
              <el-tabs v-if="task.methods.length" v-model="activeMethod[task.taskId]" class="method-tabs">
                <el-tab-pane v-for="m in task.methods" :key="m.methodKey" :label="methodTabLabel(m)" :name="m.methodKey">
                  <template v-for="s in m.students" :key="s.studentId" class="student-list">
                    <div class="student-row">
                      <div class="student-info">
                        <span class="student-name">{{ s.studentName }}</span>
                        <span class="student-no">{{ s.studentNumber }}</span>
                      </div>
                      <div class="student-score">
                        <span v-if="s.result.status === 'pending'" class="pending">待评分</span>
                        <span v-else-if="s.result.totalScore != null" class="score">得分 {{ s.result.totalScore }}/{{ s.result.maxScore }}</span>
                      </div>
                      <div class="student-actions">
                        <el-button size="small" @click="$router.push(`/evaluation/scene-results/${s.result.id}`)">
                          {{ s.result.status === 'pending' ? '评分' : '查看' }}
                        </el-button>
                        <el-tag v-if="s.result.status !== 'pending'" size="small" type="success">已评分</el-tag>
                      </div>
                    </div>
                  </template>
                </el-tab-pane>
              </el-tabs>
              <el-empty v-else description="暂无学生提交记录" :image-size="50" />
            </el-collapse-item>
          </el-collapse>
        </template>
        <el-empty v-else description="请在左侧选择一个场景" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { scenarioApi, taskApi } from '@/api/scene';
import { positionApi } from '@/api/job';
import { evaluationResultApi } from '@/api/evaluation';
import { userManagementApi } from '@/api/portal';
import { EVAL_METHOD_LABELS_GRADING } from '@/types/lesson';
import type { Scenario } from '@/types/scene';
import type { CareerPosition } from '@/types/job';
import type { User } from '@/types/user';
import type { SceneEvaluationResult } from '@/types/evaluation';

interface TaskStudent {
  studentId: string;
  studentName: string;
  studentNumber: string;
  result: SceneEvaluationResult;
}
interface TaskGroup {
  taskId: string;
  taskName: string;
  totalStudents: number;
  totalPending: number;
  totalGraded: number;
  taskScore: number;
  methods: { methodKey: string; students: TaskStudent[]; pendingCount: number; gradedCount: number; weight: number }[];
}

const searchQuery = ref('');
const selectedScenarioId = ref<string | null>(null);
const scenarios = ref<Scenario[]>([]);
const results = ref<SceneEvaluationResult[]>([]);
const userMap = ref(new Map<string, User>());
const taskMap = ref(new Map<string, { id: string; name: string; evalData?: any }>());
const expandedTasks = ref<string[]>([]);
const activeMethod = reactive<Record<string, string>>({});
const loading = ref(true);

const scenarioGroups = computed(() => {
  const map = new Map<string, { positionName: string; scenarios: any[] }>();
  for (const s of scenarios.value) {
    const subs = s.id === selectedScenarioId.value ? results.value.filter((r) => r.taskId) : [];
    const item = {
      scenarioId: s.id,
      scenarioName: s.name,
      scenarioCode: s.code || '',
      pendingCount: subs.filter((r) => r.status === 'pending').length,
      gradedCount: subs.filter((r) => r.status === 'evaluated').length
    };
    const pos = (s as any).positionName || '未分类';
    if (!map.has(pos)) map.set(pos, { positionName: pos, scenarios: [] });
    map.get(pos)!.scenarios.push(item);
  }
  return Array.from(map.values());
});
const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return scenarioGroups.value;
  return scenarioGroups.value
    .map((g) => ({ ...g, scenarios: g.scenarios.filter((s) => s.scenarioName.toLowerCase().includes(q) || s.scenarioCode.toLowerCase().includes(q)) }))
    .filter((g) => g.scenarios.length > 0);
});
const selectedScenario = computed(() => scenarios.value.find((s) => s.id === selectedScenarioId.value) || null);

const taskGroups = computed<TaskGroup[]>(() => {
  const map = new Map<string, TaskGroup>();
  for (const sub of results.value) {
    const user = userMap.value.get(sub.evaluateeId);
    const student: TaskStudent = {
      studentId: sub.evaluateeId,
      studentName: user?.name || '未知',
      studentNumber: user?.studentNo || '-',
      result: sub
    };
    const taskInfo = taskMap.value.get(sub.taskId);
    const existing = map.get(sub.taskId);
    if (existing) {
      const method = existing.methods.find((m) => m.methodKey === sub.methodKey);
      if (method) {
        method.students.push(student);
        method.pendingCount += sub.status === 'pending' ? 1 : 0;
        method.gradedCount += sub.status === 'evaluated' ? 1 : 0;
      } else {
        existing.methods.push({ methodKey: sub.methodKey, students: [student], pendingCount: sub.status === 'pending' ? 1 : 0, gradedCount: sub.status === 'evaluated' ? 1 : 0, weight: 100 });
      }
    } else {
      map.set(sub.taskId, {
        taskId: sub.taskId,
        taskName: taskInfo?.name || sub.taskId,
        totalStudents: 0,
        totalPending: 0,
        totalGraded: 0,
        taskScore: 0,
        methods: [{ methodKey: sub.methodKey, students: [student], pendingCount: sub.status === 'pending' ? 1 : 0, gradedCount: sub.status === 'evaluated' ? 1 : 0, weight: 100 }]
      });
    }
  }
  map.forEach((g) => {
    g.totalStudents = new Set(results.value.filter((r) => r.taskId === g.taskId).map((r) => r.evaluateeId)).size;
    g.totalPending = g.methods.reduce((s, m) => s + m.pendingCount, 0);
    g.totalGraded = g.methods.reduce((s, m) => s + m.gradedCount, 0);
    // 任务均分：各测评方式加权
    let weighted = 0;
    let totalWeight = 0;
    for (const m of g.methods) {
      const graded = m.students.filter((s) => s.result.status === 'evaluated');
      if (!graded.length) continue;
      const methodScore = graded.reduce((acc, s) => acc + ((s.result.totalScore ?? 0) / (s.result.maxScore || 1)) * 100, 0) / graded.length;
      weighted += methodScore * (m.weight || 0);
      totalWeight += m.weight || 0;
    }
    g.taskScore = totalWeight > 0 ? weighted / totalWeight : 0;
  });
  return Array.from(map.values());
});

function methodTabLabel(m: { methodKey: string; pendingCount: number; gradedCount: number }) {
  const label = EVAL_METHOD_LABELS_GRADING[m.methodKey] || m.methodKey;
  return `${label}${m.pendingCount ? ` 待评${m.pendingCount}` : ''}${m.gradedCount ? ` 已评${m.gradedCount}` : ''}`;
}
function expandAll() { expandedTasks.value = taskGroups.value.map((t) => t.taskId); }
function collapseAll() { expandedTasks.value = []; }

async function load() {
  loading.value = true;
  try {
    const [scRes, userRes, posRes] = await Promise.all([
      scenarioApi.list({ limit: 200 }),
      userManagementApi.list({ limit: 1000 }),
      positionApi.list({ limit: 500 })
    ]);
    const pMap = new Map<string, string>();
    (posRes.items || []).forEach((p: CareerPosition) => pMap.set(p.id, p.name));
    scenarios.value = (scRes.items || [])
      .filter((s) => s.status === 'published')
      .map((s) => ({ ...s, positionName: pMap.get(s.careerPositionId || '') || '未分类' } as any));
    if (!selectedScenarioId.value) selectedScenarioId.value = scenarios.value[0]?.id || null;
    const m = new Map<string, User>();
    (userRes.items || []).forEach((u) => m.set(u.id, u));
    userMap.value = m;
  } catch {
    /* ignore */
  } finally {
    loading.value = false;
  }
}

async function selectScenario(id: string) {
  selectedScenarioId.value = id;
  results.value = [];
  taskMap.value = new Map();
  try {
    // 分页全量拉取结果 + 任务
    const allResults: SceneEvaluationResult[] = [];
    let offset = 0;
    const ps = 200;
    for (;;) {
      const r = await evaluationResultApi.list({ sceneId: id, limit: ps, offset });
      allResults.push(...r.items);
      if (r.items.length < ps || offset + ps >= (r.total || 0)) break;
      offset += ps;
    }
    const tasks: any[] = [];
    offset = 0;
    for (;;) {
      const r = await taskApi.list({ scenarioId: id, limit: ps, offset });
      tasks.push(...(r.items || []));
      if ((r.items || []).length < ps || offset + ps >= (r.total || 0)) break;
      offset += ps;
    }
    results.value = allResults;
    const tMap = new Map<string, any>();
    tasks.forEach((t) => { tMap.set(t.id, t); activeMethod[t.id] = ''; });
    taskMap.value = tMap;
  } catch {
    results.value = [];
    taskMap.value = new Map();
  }
}

onMounted(async () => {
  await load();
  if (selectedScenarioId.value) await selectScenario(selectedScenarioId.value);
});
</script>

<style scoped>
.scene-results { padding: 16px; height: calc(100vh - 90px); display: flex; flex-direction: column; }
.topbar { margin-bottom: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.layout { flex: 1; display: flex; gap: 16px; overflow: hidden; }
.side-col { width: 300px; flex-shrink: 0; background: #fff; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; }
.side-search { margin-bottom: 8px; }
.scenario-list { flex: 1; overflow-y: auto; }
.pos-group-label { font-size: 11px; color: #909399; text-transform: uppercase; padding: 8px 2px 4px; font-weight: 600; }
.scenario-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.scenario-item:hover { background: #f5f7fa; }
.scenario-item.active { background: #ecf5ff; border-color: #409eff; }
.scenario-name { font-size: 13px; font-weight: 600; color: #303133; }
.scenario-item.active .scenario-name { color: #409eff; }
.scenario-code { font-size: 11px; color: #909399; }
.scenario-badges { display: flex; gap: 4px; }
.badge { font-size: 10px; padding: 1px 6px; border-radius: 10px; }
.badge.pending { background: #fdf6ec; color: #e6a23c; }
.badge.graded { background: #f0f9eb; color: #67c23a; }
.main-col { flex: 1; overflow-y: auto; background: #fff; border-radius: 8px; padding: 16px; }
.main-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.scenario-title { font-size: 16px; font-weight: 700; margin: 0; }
.scenario-count { color: #909399; font-size: 12px; }
.task-collapse { border: none; }
.task-header { display: flex; align-items: center; justify-content: space-between; flex: 1; padding-right: 12px; }
.task-name { font-weight: 600; }
.task-stats { display: flex; gap: 10px; align-items: center; color: #909399; font-size: 12px; }
.pending { color: #e6a23c; }
.graded { color: #67c23a; }
.method-tabs { margin-top: 4px; }
.student-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #fafafa; }
.student-info { display: flex; align-items: center; gap: 8px; min-width: 0; }
.student-name { font-weight: 500; }
.student-no { color: #909399; font-size: 12px; }
.student-score .score { color: #606266; font-size: 12px; }
.student-actions { display: flex; align-items: center; gap: 8px; }
</style>

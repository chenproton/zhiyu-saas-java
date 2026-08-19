<!--
  混合课程评分弹窗：左侧混合课列表（有 courseId 的开课计划）+ 右侧「节点 → 班级 → 学生 → 测评结果」。
  对齐 React frontend/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx：
  - 打开时拉 /portal/workspace/dashboard?role=teacher 取 classPlans（仅保留有 courseId 的），
    未传 courseId 时默认选中第一个混合课；
  - 选中课程后并发拉 /lesson/nodes?courseId=&limit=1000、/lesson/course-node-evaluation-results?courseId=、
    /users?limit=1000，按节点分组统计待评分/已评分，按班级二次分组；
  - 学生按入学年份倒序 + 班级名升序排序；结果徽标点击进 /evaluation/lesson-results/{id}；
  - 切换左侧课程用请求序号守卫丢弃过期响应，避免旧课程数据覆盖新课程。
-->
<template>
  <el-dialog
    :model-value="open"
    width="90%"
    top="3vh"
    class="hybrid-grading-dialog"
    @update:model-value="handleOpenChange"
  >
    <template #header>
      <div class="dlg-head">
        <span class="dlg-title">
          <el-icon><School /></el-icon>
          混合课程评分
        </span>
        <p class="dlg-desc">{{ sessionTitle }} · {{ className || '全部学生' }}</p>
      </div>
    </template>

    <div class="dlg-body">
      <!-- 左侧课程列表 -->
      <div class="side">
        <div class="side-search">
          <el-input v-model="searchQuery" placeholder="搜索课程..." clearable :prefix-icon="Search" />
        </div>
        <el-scrollbar class="side-list">
          <button
            v-for="plan in filteredPlans"
            :key="plan.courseId || plan.id"
            type="button"
            class="side-item"
            :class="{ active: isActivePlan(plan) }"
            @click="selectPlan(plan)"
          >
            <el-icon class="side-icon"><Reading /></el-icon>
            <div class="side-text">
              <p class="side-name">{{ plan.course }}</p>
              <p class="side-meta">{{ plan.name }} · {{ plan.students }}人</p>
            </div>
          </button>
          <div v-if="filteredPlans.length === 0" class="empty-line">暂无混合课程计划</div>
        </el-scrollbar>
      </div>

      <!-- 右侧节点 + 学生测评 -->
      <div class="main">
        <div v-if="loading" class="main-loading">
          <el-icon class="is-loading" :size="24"><Loading /></el-icon>
          <p>加载测评数据中...</p>
        </div>
        <el-scrollbar v-else class="main-scroll">
          <div class="main-inner">
            <div class="main-head">
              <h2 class="main-title">{{ selectedPlan?.course || courseId }}</h2>
              <div class="main-tags">
                <el-tag v-if="selectedPlan" size="small" effect="plain">{{ selectedPlan.name }}</el-tag>
                <el-tag size="small" type="info" effect="light">{{ results.length }} 条提交</el-tag>
              </div>
            </div>

            <div v-if="nodeGroups.length === 0" class="empty-card">
              <el-icon :size="36"><Document /></el-icon>
              <p class="empty-title">该课程暂无学生测评提交记录</p>
              <router-link class="empty-link" :to="lessonResultsPath">
                前往课程节点评价页面 →
              </router-link>
            </div>

            <div v-else class="node-list">
              <div v-for="node in nodeGroups" :key="node.nodeId" class="node-card">
                <button type="button" class="node-head" @click="toggleNode(node.nodeId)">
                  <span class="node-icon"><el-icon><Document /></el-icon></span>
                  <span class="node-text">
                    <span class="node-name">{{ node.nodeName }}</span>
                    <span class="node-meta">
                      <span class="meta-gray">{{ node.students.length }} 位学生</span>
                      <span v-if="node.pendingCount > 0" class="meta-amber">
                        待评分 {{ node.pendingCount }}
                      </span>
                      <span v-if="node.gradedCount > 0" class="meta-green">
                        已评分 {{ node.gradedCount }}
                      </span>
                    </span>
                  </span>
                  <el-icon class="node-arrow">
                    <component :is="collapsedNodes.has(node.nodeId) ? ArrowDown : ArrowUp" />
                  </el-icon>
                </button>

                <div v-if="!collapsedNodes.has(node.nodeId)" class="node-body">
                  <div v-for="group in groupByClass(node)" :key="group.className" class="class-group">
                    <div class="class-head">
                      <el-icon><UserFilled /></el-icon>
                      <span class="class-name">{{ group.className }}</span>
                      <span class="class-count">（{{ group.students.length }}人）</span>
                    </div>
                    <div class="student-list">
                      <div
                        v-for="item in group.students"
                        :key="item.student.studentId"
                        class="student-row"
                      >
                        <div class="student-left">
                          <span class="student-avatar">{{ item.student.studentName.charAt(0) }}</span>
                          <span class="student-name">{{ item.student.studentName }}</span>
                          <span class="student-no">{{ item.student.studentNumber }}</span>
                        </div>
                        <div class="student-right">
                          <router-link
                            v-for="r in item.results"
                            :key="r.id"
                            class="result-chip"
                            :class="r.status === 'pending' ? 'pending' : 'graded'"
                            :to="`/evaluation/lesson-results/${r.id}`"
                          >
                            <el-icon>
                              <component :is="r.status === 'pending' ? EditPen : CircleCheck" />
                            </el-icon>
                            {{ methodLabel(r.methodKey) }} ·
                            {{
                              r.status === 'pending'
                                ? '待评分'
                                : `已评 ${r.totalScore ?? 0}/${r.maxScore ?? 100}`
                            }}
                          </router-link>
                          <el-button
                            size="small"
                            @click="goResult(item.results[0]?.id)"
                          >
                            <el-icon><View /></el-icon>查看
                          </el-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Document,
  EditPen,
  Loading,
  Reading,
  School,
  Search,
  UserFilled,
  View
} from '@element-plus/icons-vue';
import { courseNodeApi, nodeEvaluationResultApi } from '@/api/lesson';
import { userManagementApi } from '@/api/portal';
import { EVAL_METHOD_LABELS_GRADING, getHybridMethodLabel } from '@/types/lesson';
import type { NodeEvaluationResult, SystemCourseNode } from '@/types/lesson';
import type { User } from '@/types/user';
import { workspaceDashboardApi } from './workspace-api';
import type { WorkspaceClassPlan } from './workspace-api';

const props = defineProps<{
  open: boolean;
  sessionTitle: string;
  className?: string;
  courseId?: string;
}>();

const emit = defineEmits<{ 'update:open': [open: boolean] }>();

/** /users 返回的学生扩展字段（后端下发，Vue User 类型未收录，按可选读取） */
type UserWithClass = User & { className?: string; enrollmentYear?: number };

interface StudentInfo {
  studentId: string;
  studentName: string;
  studentNumber: string;
  className: string;
  enrollmentYear: number;
}

interface StudentEvalGroup {
  student: StudentInfo;
  results: NodeEvaluationResult[];
}

interface NodeEvalGroup {
  nodeId: string;
  nodeName: string;
  pendingCount: number;
  gradedCount: number;
  students: StudentEvalGroup[];
}

const router = useRouter();

const searchQuery = ref('');
const selectedPlanId = ref<string | null>(null);
const collapsedNodes = ref<Set<string>>(new Set());
const classPlans = ref<WorkspaceClassPlan[]>([]);
const nodes = ref<SystemCourseNode[]>([]);
const results = ref<NodeEvaluationResult[]>([]);
const userMap = ref<Map<string, UserWithClass>>(new Map());
const loading = ref(true);

// 请求序号守卫：快速切换左侧课程时丢弃过期响应
let courseSeq = 0;

async function loadCourseData(cid: string) {
  const seq = ++courseSeq;
  loading.value = true;
  try {
    const [nodeRes, resRes, userRes] = await Promise.all([
      courseNodeApi.list({ courseId: cid, limit: 1000 }).catch(() => ({ items: [], total: 0 })),
      nodeEvaluationResultApi.listByCourse(cid).catch(() => ({ items: [], total: 0 })),
      userManagementApi.list({ limit: 1000 }).catch(() => ({ items: [], total: 0 }))
    ]);
    if (seq !== courseSeq) return;
    nodes.value = nodeRes.items || [];
    results.value = resRes.items || [];
    const map = new Map<string, UserWithClass>();
    (userRes.items || []).forEach((u) => map.set(u.id, u as UserWithClass));
    userMap.value = map;
  } catch (e) {
    if (seq !== courseSeq) return;
    ElMessage.error((e as Error).message || '加载混合课测评数据失败');
  } finally {
    if (seq === courseSeq) loading.value = false;
  }
}

async function loadPlans() {
  try {
    const res = await workspaceDashboardApi.get({ role: 'teacher' });
    const plans = (res.classPlans || []).filter((p) => p.courseId);
    classPlans.value = plans;
    if (!props.courseId) {
      if (!selectedPlanId.value) selectedPlanId.value = plans[0]?.courseId || null;
    } else if (plans.some((p) => p.courseId === props.courseId)) {
      if (!selectedPlanId.value) selectedPlanId.value = props.courseId;
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '加载工作台班级/课时数据失败');
  }
}

watch(
  () => [props.open, props.courseId] as const,
  ([open, courseId]) => {
    if (!open) return;
    collapsedNodes.value = new Set();
    selectedPlanId.value = courseId || null;
    void loadPlans();
    if (courseId) {
      void loadCourseData(courseId);
    } else {
      // 无 courseId 时由左侧课程选择驱动，先结束加载态
      loading.value = false;
    }
  },
  { immediate: true }
);

const filteredPlans = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return classPlans.value;
  return classPlans.value.filter(
    (p) => p.course.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
  );
});

const selectedPlan = computed(
  () =>
    classPlans.value.find((p) => p.id === selectedPlanId.value) ||
    classPlans.value.find((p) => p.courseId === selectedPlanId.value)
);

const lessonResultsPath = computed(() =>
  props.courseId ? `/evaluation/lesson-results?courseId=${props.courseId}` : '/evaluation/lesson-results'
);

const nodeGroups = computed<NodeEvalGroup[]>(() => {
  const nodeNameMap = new Map(nodes.value.map((n) => [n.id, n.name]));
  const byNode = new Map<string, StudentEvalGroup[]>();
  for (const r of results.value) {
    const user = userMap.value.get(r.evaluateeId);
    const student: StudentInfo = {
      studentId: r.evaluateeId,
      studentName: user?.name || '未知',
      studentNumber: user?.studentNo || '-',
      className: user?.className || '-',
      enrollmentYear: user?.enrollmentYear || 0
    };
    const list = byNode.get(r.nodeId) || [];
    const existing = list.find((g) => g.student.studentId === r.evaluateeId);
    if (existing) existing.results.push(r);
    else list.push({ student, results: [r] });
    byNode.set(r.nodeId, list);
  }
  const groups: NodeEvalGroup[] = [];
  byNode.forEach((students, nodeId) => {
    let pendingCount = 0;
    let gradedCount = 0;
    students.forEach((g) =>
      g.results.forEach((r) => {
        if (r.status === 'pending') pendingCount++;
        else gradedCount++;
      })
    );
    groups.push({
      nodeId,
      nodeName: nodeNameMap.get(nodeId) || nodeId,
      pendingCount,
      gradedCount,
      students: students.sort((a, b) =>
        (a.student.enrollmentYear || 0) !== (b.student.enrollmentYear || 0)
          ? (b.student.enrollmentYear || 0) - (a.student.enrollmentYear || 0)
          : a.student.className.localeCompare(b.student.className, 'zh-CN')
      )
    });
  });
  return groups.sort((a, b) => a.nodeName.localeCompare(b.nodeName, 'zh-CN'));
});

function groupByClass(node: NodeEvalGroup) {
  const acc = new Map<string, StudentEvalGroup[]>();
  node.students.forEach((g) => {
    const key = g.student.className || '-';
    const list = acc.get(key) || [];
    list.push(g);
    acc.set(key, list);
  });
  return Array.from(acc.entries()).map(([className, students]) => ({ className, students }));
}

function isActivePlan(plan: WorkspaceClassPlan) {
  return selectedPlanId.value === plan.courseId || selectedPlanId.value === plan.id;
}

function selectPlan(plan: WorkspaceClassPlan) {
  selectedPlanId.value = plan.courseId || plan.id;
  // 切换课程时按新 courseId 重新拉取节点/结果/学生数据，防止展示错误课程数据
  if (plan.courseId) void loadCourseData(plan.courseId);
  collapsedNodes.value = new Set();
}

function toggleNode(nodeId: string) {
  const next = new Set(collapsedNodes.value);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  collapsedNodes.value = next;
}

function methodLabel(key: string): string {
  return getHybridMethodLabel(key, (k) => EVAL_METHOD_LABELS_GRADING[k] || k);
}

function goResult(id?: string) {
  if (!id) return;
  emit('update:open', false);
  void router.push(`/evaluation/lesson-results/${id}`);
}

function handleOpenChange(v: boolean) {
  emit('update:open', v);
}
</script>

<style scoped>
.dlg-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dlg-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}
.dlg-title :deep(.el-icon) {
  color: #d97706;
}
.dlg-desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
.dlg-body {
  display: flex;
  min-height: 0;
  height: 74vh;
  border-top: 1px solid #f3f4f6;
}

/* 左侧 */
.side {
  width: 256px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}
.side-search {
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
}
.side-list {
  flex: 1;
  padding: 8px;
}
.side-item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  margin-bottom: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.side-item:hover {
  background: #f9fafb;
  border-color: #e5e7eb;
}
.side-item.active {
  background: #fffbeb;
  border-color: #fcd34d;
}
.side-icon {
  margin-top: 2px;
  color: #9ca3af;
}
.side-item.active .side-icon {
  color: #d97706;
}
.side-text {
  min-width: 0;
  flex: 1;
}
.side-name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side-item.active .side-name {
  color: #b45309;
}
.side-meta {
  margin: 2px 0 0;
  font-size: 11px;
  color: #9ca3af;
}

/* 右侧 */
.main {
  flex: 1;
  min-width: 0;
  background: #f9fafb;
}
.main-loading {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 14px;
}
.main-scroll {
  height: 100%;
}
.main-inner {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.main-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}
.main-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 0;
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  color: #9ca3af;
}
.empty-title {
  margin: 0;
  font-size: 14px;
}
.empty-link {
  font-size: 12px;
  color: var(--el-color-primary);
}
.empty-link:hover {
  text-decoration: underline;
}
.empty-line {
  padding: 32px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}

/* 节点卡 */
.node-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.node-card {
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  overflow: hidden;
}
.node-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.node-head:hover {
  background: rgba(249, 250, 251, 0.6);
}
.node-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #fef3c7;
  color: #d97706;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.node-text {
  flex: 1;
  min-width: 0;
}
.node-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 12px;
}
.meta-gray { color: #9ca3af; }
.meta-amber { color: #d97706; font-weight: 500; }
.meta-green { color: #16a34a; font-weight: 500; }
.node-arrow {
  color: #9ca3af;
}
.node-body {
  border-top: 1px solid #f3f4f6;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.class-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  padding-left: 4px;
  font-size: 12px;
  color: #6b7280;
}
.class-head :deep(.el-icon) {
  color: #9ca3af;
}
.class-count {
  font-size: 10px;
  color: #9ca3af;
}
.student-list {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.student-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #f1f5f9;
}
.student-row:last-child {
  border-bottom: none;
}
.student-row:hover {
  background: rgba(248, 250, 252, 0.6);
}
.student-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.student-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #fef3c7;
  color: #d97706;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.student-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}
.student-no {
  font-size: 12px;
  color: #9ca3af;
}
.student-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.result-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid;
  transition: background-color 0.2s;
}
.result-chip.pending {
  background: #fffbeb;
  border-color: #fde68a;
  color: #d97706;
}
.result-chip.pending:hover {
  background: #fef3c7;
}
.result-chip.graded {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #16a34a;
}
.result-chip.graded:hover {
  background: #dcfce7;
}
</style>

<template>
  <div class="lesson-results">
    <div class="topbar">
      <h2 class="page-title">课程节点评价</h2>
      <p class="page-sub">选择课程与节点，查看学生提交并进行评分</p>
    </div>

    <div class="layout">
      <!-- 左侧课程列表 -->
      <div class="side-col">
        <el-input v-model="searchQuery" placeholder="搜索课程..." clearable class="side-search" />
        <div class="course-list">
          <div
            v-for="c in filteredCourses"
            :key="c.id"
            class="course-item"
            :class="{ active: selectedCourseId === c.id }"
            @click="selectCourse(c.id)"
          >
            <div class="course-name">{{ c.name }}</div>
            <div class="course-meta">{{ c.type === 'system' ? '体系课' : '混合课' }} · {{ c.nodeCount || 0 }} 节点</div>
          </div>
          <el-empty v-if="filteredCourses.length === 0" description="暂无已发布课程" :image-size="60" />
        </div>
      </div>

      <!-- 右侧节点结果 -->
      <div class="main-col">
        <template v-if="selectedCourseId">
          <div class="main-header">
            <div>
              <h3 class="course-title">{{ selectedCourseName }}</h3>
              <span class="course-count">{{ results.length }} 条提交记录</span>
            </div>
            <div v-if="nodeGroups.length">
              <el-button size="small" @click="expandAll">全部展开</el-button>
              <el-button size="small" @click="collapseAll">全部收起</el-button>
            </div>
          </div>

          <el-empty v-if="nodeGroups.length === 0" description="该课程下暂无学生测评提交记录" />
          <el-collapse v-else v-model="expandedNodes" class="node-collapse">
            <el-collapse-item v-for="node in nodeGroups" :key="node.nodeId" :name="node.nodeId">
              <template #title>
                <div class="node-header">
                  <span class="node-name">{{ node.nodeName }}</span>
                  <div class="node-stats">
                    <span>提交 {{ node.methods.reduce((s, m) => s + m.students.length, 0) }}</span>
                    <span class="pending">待评 {{ node.methods.reduce((s, m) => s + m.pendingCount, 0) }}</span>
                    <span class="graded">已评 {{ node.methods.reduce((s, m) => s + m.gradedCount, 0) }}</span>
                  </div>
                </div>
              </template>
              <div v-for="method in node.methods" :key="method.methodKey" class="method-block">
                <div class="method-head">
                  <el-tag size="small">{{ methodLabel(method.methodKey) }}</el-tag>
                  <span v-if="method.pendingCount" class="pending">待评 {{ method.pendingCount }}</span>
                  <span v-if="method.gradedCount" class="graded">已评 {{ method.gradedCount }}</span>
                </div>
                <div v-for="s in method.students" :key="s.studentId" class="student-row">
                  <div class="student-info">
                    <span class="student-name">{{ s.studentName }}</span>
                    <span class="student-no">{{ s.studentNumber }}</span>
                  </div>
                  <div class="student-score">
                    <span v-if="s.result.status === 'pending'" class="pending">待评分</span>
                    <span v-else-if="s.result.totalScore != null" class="score">得分 {{ s.result.totalScore }}/{{ s.result.maxScore }}</span>
                  </div>
                  <div class="student-actions">
                    <el-button size="small" @click="$router.push(`/evaluation/lesson-results/${s.result.id}`)">
                      {{ s.result.status === 'pending' ? '评分' : '查看' }}
                    </el-button>
                    <el-tag v-if="s.result.status !== 'pending'" size="small" type="success">已评分</el-tag>
                  </div>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </template>
        <el-empty v-else description="请在左侧选择一个课程" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { courseApi, courseNodeApi, nodeEvaluationResultApi } from '@/api/lesson';
import { userManagementApi } from '@/api/portal';
import { EVAL_METHOD_LABELS_GRADING, getHybridMethodLabel } from '@/types/lesson';
import type { Course, SystemCourseNode, NodeEvaluationResult } from '@/types/lesson';
import type { User } from '@/types/user';

interface NodeStudent {
  studentId: string;
  studentName: string;
  studentNumber: string;
  className: string;
  result: NodeEvaluationResult;
}
interface NodeGroup {
  nodeId: string;
  nodeName: string;
  methods: { methodKey: string; students: NodeStudent[]; pendingCount: number; gradedCount: number }[];
}

const searchQuery = ref('');
const selectedCourseId = ref<string | null>(null);
const courses = ref<Course[]>([]);
const nodes = ref<SystemCourseNode[]>([]);
const results = ref<NodeEvaluationResult[]>([]);
const userMap = ref(new Map<string, User>());
const expandedNodes = ref<string[]>([]);
const loading = ref(true);

const filteredCourses = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return courses.value;
  return courses.value.filter((c) => c.name.toLowerCase().includes(q) || (c.majorName || '').toLowerCase().includes(q));
});
const selectedCourseName = computed(() => courses.value.find((c) => c.id === selectedCourseId.value)?.name || '课程');

const nodeGroups = computed<NodeGroup[]>(() => {
  const map = new Map<string, NodeGroup>();
  for (const res of results.value) {
    const user = userMap.value.get(res.evaluateeId);
    const student: NodeStudent = {
      studentId: res.evaluateeId,
      studentName: user?.name || '未知',
      studentNumber: user?.studentNo || '-',
      className: (user as any)?.className || '-',
      result: res
    };
    const existing = map.get(res.nodeId);
    if (existing) {
      const method = existing.methods.find((m) => m.methodKey === res.methodKey);
      if (method) {
        method.students.push(student);
        method.pendingCount += res.status === 'pending' ? 1 : 0;
        method.gradedCount += res.status === 'evaluated' ? 1 : 0;
      } else {
        existing.methods.push({ methodKey: res.methodKey, students: [student], pendingCount: res.status === 'pending' ? 1 : 0, gradedCount: res.status === 'evaluated' ? 1 : 0 });
      }
    } else {
      map.set(res.nodeId, { nodeId: res.nodeId, nodeName: res.nodeId, methods: [{ methodKey: res.methodKey, students: [student], pendingCount: res.status === 'pending' ? 1 : 0, gradedCount: res.status === 'evaluated' ? 1 : 0 }] });
    }
  }
  const nameMap = new Map(nodes.value.map((n) => [n.id, n.name]));
  map.forEach((g) => { g.nodeName = nameMap.get(g.nodeId) || g.nodeId; });
  return Array.from(map.values());
});

function methodLabel(key: string) {
  return getHybridMethodLabel(key, (k) => EVAL_METHOD_LABELS_GRADING[k] || k);
}
function expandAll() { expandedNodes.value = nodeGroups.value.map((n) => n.nodeId); }
function collapseAll() { expandedNodes.value = []; }

async function loadCourses() {
  loading.value = true;
  try {
    const [courseRes, userRes] = await Promise.all([
      courseApi.list({ status: 'published', limit: 1000 }),
      userManagementApi.list({ limit: 1000 })
    ]);
    courses.value = (courseRes.items || []).filter((c) => c.type === 'system' || c.type === 'hybrid');
    if (!selectedCourseId.value) selectedCourseId.value = courses.value[0]?.id || null;
    const m = new Map<string, User>();
    (userRes.items || []).forEach((u) => m.set(u.id, u));
    userMap.value = m;
  } catch {
    /* ignore */
  } finally {
    loading.value = false;
  }
}

async function selectCourse(id: string) {
  selectedCourseId.value = id;
  nodes.value = [];
  results.value = [];
  try {
    const [nodeRes, resultRes] = await Promise.all([
      courseNodeApi.list({ courseId: id, limit: 1000 }),
      nodeEvaluationResultApi.listByCourse(id)
    ]);
    nodes.value = nodeRes.items || [];
    results.value = resultRes.items || [];
  } catch {
    nodes.value = [];
    results.value = [];
  }
}

onMounted(async () => {
  await loadCourses();
  if (selectedCourseId.value) await selectCourse(selectedCourseId.value);
});
</script>

<style scoped>
.lesson-results { padding: 16px; height: calc(100vh - 90px); display: flex; flex-direction: column; }
.topbar { margin-bottom: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.layout { flex: 1; display: flex; gap: 16px; overflow: hidden; }
.side-col { width: 280px; flex-shrink: 0; background: #fff; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; }
.side-search { margin-bottom: 8px; }
.course-list { flex: 1; overflow-y: auto; }
.course-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
.course-item:hover { background: #f5f7fa; }
.course-item.active { background: #ecf5ff; border-color: #409eff; }
.course-name { font-size: 13px; font-weight: 600; color: #303133; }
.course-item.active .course-name { color: #409eff; }
.course-meta { font-size: 11px; color: #909399; margin-top: 2px; }
.main-col { flex: 1; overflow-y: auto; background: #fff; border-radius: 8px; padding: 16px; }
.main-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.course-title { font-size: 16px; font-weight: 700; margin: 0; }
.course-count { color: #909399; font-size: 12px; }
.node-collapse { border: none; }
.node-header { display: flex; align-items: center; justify-content: space-between; flex: 1; padding-right: 12px; }
.node-name { font-weight: 600; }
.node-stats { display: flex; gap: 12px; color: #909399; font-size: 12px; }
.pending { color: #e6a23c; }
.graded { color: #67c23a; }
.method-block { padding: 8px 16px; border-bottom: 1px solid #f0f2f5; }
.method-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; }
.student-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #fafafa; }
.student-info { display: flex; align-items: center; gap: 8px; min-width: 0; }
.student-name { font-weight: 500; }
.student-no { color: #909399; font-size: 12px; }
.student-score .score { color: #606266; font-size: 12px; }
.student-actions { display: flex; align-items: center; gap: 8px; }
</style>

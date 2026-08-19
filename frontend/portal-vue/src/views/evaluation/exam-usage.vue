<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">考试管理</h2>
        <p class="page-sub">查看试卷在各模块的使用情况</p>
      </div>
      <el-button type="primary" @click="openCreate">创建考试使用</el-button>
    </div>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="6"><div class="stat"><div class="stat-value blue">{{ stats.total }}</div><div class="stat-label">考试总数</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value gray">{{ stats.draft }}</div><div class="stat-label">未开启</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value green">{{ stats.published }}</div><div class="stat-label">已开启</div></div></el-col>
      <el-col :span="6"><div class="stat"><div class="stat-value gray">{{ stats.finished }}</div><div class="stat-label">已结束</div></div></el-col>
    </el-row>

    <el-card shadow="never">
      <div class="filter-row">
        <el-input v-model="search" placeholder="搜索考试名称或关联试卷..." clearable style="max-width: 320px" />
        <el-select v-model="statusFilter" style="width: 140px">
          <el-option label="全部状态" value="all" />
          <el-option label="未开启" value="draft" />
          <el-option label="已开启" value="published" />
          <el-option label="已结束" value="finished" />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="filteredUsages" stripe>
        <el-table-column label="考试名称" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column label="关联试卷" min-width="160">
          <template #default="{ row }">{{ examName(row.examId) }}</template>
        </el-table-column>
        <el-table-column label="开放时间" min-width="150">
          <template #default="{ row }">
            <template v-if="row.startTime || row.endTime">
              <div>{{ row.startTime ? fmt(row.startTime) : '-' }}</div>
              <div>至 {{ row.endTime ? fmt(row.endTime) : '-' }}</div>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="目标类型" width="110">
          <template #default="{ row }">{{ targetTypeLabel(row.targetType) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canEdit(row)" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canPublish(row.status)" size="small" type="primary" @click="publish(row.id)">开启</el-button>
            <el-button v-if="canFinish(row.status)" size="small" type="warning" @click="finish(row.id)">停止</el-button>
            <el-button v-if="row.status === 'finished'" size="small" @click="$router.push(`/evaluation/exam-usage/results?usageId=${row.id}`)">查看考试结果</el-button>
            <el-button v-if="canDelete(row)" size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑弹窗 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑考试' : '创建考试使用'" width="560px">
      <el-form label-width="90px">
        <el-form-item v-if="!editing" label="选择试卷" required>
          <el-select v-model="form.examId" filterable placeholder="请选择一份试卷" style="width: 100%">
            <el-option v-for="e in publishedExams" :key="e.id" :label="e.name" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="考试名称" required><el-input v-model="form.name" placeholder="请输入考试名称" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="请输入描述（可选）" /></el-form-item>
        <el-form-item label="时长/分钟"><el-input-number v-model="form.duration" :min="0" placeholder="请输入考试时长" /></el-form-item>
        <el-form-item label="启用条件">
          <el-radio-group v-model="form.activationMode">
            <el-radio value="manual">手动启停</el-radio>
            <el-radio value="scheduled">定时</el-radio>
            <el-radio value="always">随时作答</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.activationMode === 'scheduled'" label="开放时间">
          <div class="time-col">
            <el-date-picker v-model="form.startTime" type="datetime" placeholder="开始时间" />
            <el-date-picker v-model="form.endTime" type="datetime" placeholder="结束时间" />
          </div>
        </el-form-item>
        <el-form-item label="参与班级" required>
          <el-tree-select
            v-model="form.classIds"
            :data="classTreeData"
            node-key="value"
            :props="{ label: 'label', children: 'children' }"
            placeholder="选择参与班级"
            check-strictly
            multiple
            show-checkbox
            default-expand-all
            style="width: 100%"
          />
          <div class="form-hint">仅所选班级的学生可见并可参加该考试</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!isFormValid" @click="save">{{ editing ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { examApi, examUsageApi } from '@/api/evaluation';
import { organizationApi, orgTypeApi } from '@/api/system';
import type { Exam, ExamUsage } from '@/types/evaluation';

const usages = ref<ExamUsage[]>([]);
const exams = ref<Exam[]>([]);
const classTreeData = ref<{ value: string; label: string; children?: any[] }[]>([]);
const loading = ref(false);
const saving = ref(false);
const search = ref('');
const statusFilter = ref('all');
const dialog = ref(false);
const editing = ref<ExamUsage | null>(null);

const form = reactive({
  examId: '', name: '', description: '', duration: undefined as number | undefined,
  startTime: '' as string, endTime: '' as string,
  activationMode: 'manual' as 'manual' | 'scheduled' | 'always',
  classIds: [] as string[]
});

const MANUAL_TYPES = ['class', 'major', 'department', 'public'];
const examMap = computed(() => new Map(exams.value.map((e) => [e.id, e])));
const publishedExams = computed(() => exams.value.filter((e) => e.status === 'published'));

const filteredUsages = computed(() =>
  usages.value.filter((u) => {
    const exam = examMap.value.get(u.examId);
    const matchSearch = u.name.toLowerCase().includes(search.value.toLowerCase()) ||
      (exam?.name || '').toLowerCase().includes(search.value.toLowerCase());
    const matchStatus =
      statusFilter.value === 'all' ||
      u.status === statusFilter.value ||
      (statusFilter.value === 'draft' && u.status === 'pending') ||
      (statusFilter.value === 'published' && u.status === 'in_progress');
    return matchSearch && matchStatus;
  })
);
const stats = computed(() => ({
  total: usages.value.length,
  draft: usages.value.filter((u) => u.status === 'draft' || u.status === 'pending').length,
  published: usages.value.filter((u) => u.status === 'published' || u.status === 'in_progress').length,
  finished: usages.value.filter((u) => u.status === 'finished').length
}));
const isFormValid = computed(() => {
  const nameOk = editing.value ? !!form.name.trim() : !!(form.examId && form.name.trim());
  const targetOk = form.classIds.length > 0 || editing.value?.targetType === 'public';
  return !!(nameOk && targetOk);
});

function examName(id: string) {
  return examMap.value.get(id)?.name || '-';
}
function statusLabel(s: string) {
  const labels: Record<string, string> = { draft: '未开启', pending: '未开启', published: '已开启', in_progress: '已开启', finished: '已结束', scheduled: '未开启' };
  return labels[s] || s;
}
function statusType(s: string) {
  if (s === 'published' || s === 'in_progress') return 'success';
  if (s === 'finished') return 'info';
  return 'warning';
}
function targetTypeLabel(t?: string) {
  const labels: Record<string, string> = { class: '手动创建', major: '手动创建', department: '手动创建', public: '手动创建', task: '场景任务', node: '课程节点', course: '课程' };
  return t ? labels[t] || '-' : '-';
}
function fmt(d?: string) {
  return d ? String(d).slice(0, 16).replace('T', ' ') : '-';
}
function canPublish(s: string) { return s === 'draft' || s === 'pending'; }
function canFinish(s: string) { return s === 'published' || s === 'in_progress'; }
function canDelete(u: ExamUsage) {
  return (u.status === 'draft' || u.status === 'finished') && (!u.targetType || MANUAL_TYPES.includes(u.targetType));
}
function canEdit(u: ExamUsage) {
  return (u.status === 'draft' || u.status === 'pending') && (!u.targetType || MANUAL_TYPES.includes(u.targetType));
}

async function load() {
  loading.value = true;
  try {
    const [usageRes, examRes, orgRes, orgTypeRes] = await Promise.all([
      examUsageApi.list({ limit: 200 }),
      examApi.list({ limit: 200 }),
      organizationApi.tree(),
      orgTypeApi.list({ limit: 200 })
    ]);
    usages.value = usageRes.items;
    exams.value = examRes.items;
    const classTypeIds = new Set((orgTypeRes.items || []).filter((t) => t.name === '班级').map((t) => t.id));
    const buildTree = (nodes: any[]): any[] => nodes.map((n) => ({ value: n.id, label: n.name, children: n.children ? buildTree(n.children) : [] }));
    const fullTree = buildTree(orgRes.items || []);
    const filterClassTree = (nodes: any[]): any[] =>
      nodes.map((n) => ({ ...n, children: filterClassTree(n.children || []) }))
        .filter((n) => n.children.length > 0 || classTypeIds.has(n.value));
    classTreeData.value = filterClassTree(fullTree);
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.examId = '';
  form.name = '';
  form.description = '';
  form.duration = undefined;
  form.startTime = '';
  form.endTime = '';
  form.activationMode = 'manual';
  form.classIds = [];
}
function openCreate() {
  editing.value = null;
  resetForm();
  dialog.value = true;
}
function openEdit(u: ExamUsage) {
  editing.value = u;
  form.examId = u.examId;
  form.name = u.name;
  form.description = u.description || '';
  form.duration = u.duration;
  form.startTime = u.startTime ? toLocal(u.startTime) : '';
  form.endTime = u.endTime ? toLocal(u.endTime) : '';
  form.activationMode = (u.activationMode as any) || 'manual';
  form.classIds = u.targetIds || [];
  dialog.value = true;
}
function toLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toRfc3339(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function save() {
  saving.value = true;
  try {
    const base = {
      name: form.name.trim(),
      description: form.description || undefined,
      duration: form.duration,
      startTime: form.activationMode === 'scheduled' ? toRfc3339(form.startTime) : undefined,
      endTime: form.activationMode === 'scheduled' ? toRfc3339(form.endTime) : undefined,
      activationMode: form.activationMode
    };
    if (editing.value) {
      await examUsageApi.update(editing.value.id, base);
      ElMessage.success('保存成功');
    } else {
      await examUsageApi.create({
        ...base,
        examId: form.examId,
        targetType: 'class',
        targetIds: form.classIds,
        status: form.activationMode === 'always' ? 'published' : 'draft'
      });
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function publish(id: string) {
  try { await examUsageApi.publish(id); load(); } catch (e) { ElMessage.error((e as Error).message || '开启考试失败'); }
}
async function finish(id: string) {
  try { await examUsageApi.finish(id); load(); } catch (e) { ElMessage.error((e as Error).message || '停止考试失败'); }
}
async function confirmDelete(u: ExamUsage) {
  try { await ElMessageBox.confirm('删除后无法恢复，确定要删除吗？', '删除考试使用', { type: 'warning' }); } catch { return; }
  try { await examUsageApi.delete(u.id); ElMessage.success('删除成功'); load(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.stats-row { margin-bottom: 16px; }
.stat { background: #fff; border-radius: 8px; padding: 16px; text-align: center; }
.stat-value { font-size: 24px; font-weight: 700; }
.stat-value.blue { color: #409eff; }
.stat-value.green { color: #67c23a; }
.stat-value.gray { color: #909399; }
.stat-label { color: #909399; font-size: 13px; margin-top: 4px; }
.filter-row { display: flex; gap: 12px; margin-bottom: 12px; }
.time-col { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.form-hint { color: #909399; font-size: 12px; margin-top: 4px; }
</style>

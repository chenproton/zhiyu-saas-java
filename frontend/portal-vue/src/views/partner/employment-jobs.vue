<template>
  <div class="list-page">
    <div class="page-header">
      <div class="header-main">
        <div>
          <h2 class="page-title">就业岗位</h2>
          <p class="page-sub">录入本企业岗位，可挂靠就业项目或作为独立岗位；仅绑定项目并发布后才会出现在学校供需大厅。</p>
        </div>
        <el-button type="primary" @click="router.push('/partner/employment-jobs/new/edit')">新建岗位</el-button>
      </div>
    </div>

    <div class="toolbar">
      <el-input
        v-model="search"
        placeholder="搜索岗位名称..."
        clearable
        style="max-width: 260px"
      />
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 160px" @change="reload">
        <el-option v-for="(label, key) in JOB_STATUS_LABELS" :key="key" :label="label" :value="key" />
      </el-select>
      <el-select
        v-model="projectFilter"
        placeholder="全部项目"
        clearable
        filterable
        style="width: 220px"
        @change="reload"
      >
        <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>
    </div>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="filtered" stripe>
        <el-table-column label="岗位名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/partner/employment-jobs/${row.id}`)">{{ row.title }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="所属项目" width="160">
          <template #default="{ row }">{{ row.projectName || '独立岗位' }}</template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ jobTypeLabel(row.jobType) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ jobStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="投递数" width="90">
          <template #default="{ row }">{{ row.applicationCount }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="150">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="router.push(`/partner/employment-jobs/${row.id}/edit`)">编辑</el-button>
            <el-button v-if="row.status === 'draft' || row.status === 'closed'" size="small" link type="primary" @click="openPublish(row)">发布</el-button>
            <el-button v-if="row.status === 'published'" size="small" link type="warning" @click="openClose(row)">关闭</el-button>
            <el-button v-if="row.status === 'draft'" size="small" link type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filtered.length === 0" description="暂无就业岗位。" />
    </el-card>

    <!-- 发布弹窗：选择绑定项目 -->
    <el-dialog v-model="publishDialog" title="发布岗位" width="480px">
      <p class="dialog-sub">{{ publishTarget?.title || '' }}</p>
      <el-form label-width="100px">
        <el-form-item label="绑定就业项目">
          <el-select
            v-model="publishProjectId"
            placeholder="不绑定项目"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <p class="muted">仅绑定项目后岗位才会出现在学校供需大厅。</p>
      <template #footer>
        <el-button @click="publishDialog = false">取消</el-button>
        <el-button type="primary" :loading="publishing" @click="handlePublish">发布</el-button>
      </template>
    </el-dialog>

    <!-- 关闭确认 -->
    <el-dialog v-model="closeDialog" title="确认关闭" width="440px">
      <p>确定要关闭岗位「{{ closeTarget?.title }}」吗？关闭后学生大厅将不再展示。</p>
      <template #footer>
        <el-button @click="closeDialog = false">取消</el-button>
        <el-button type="danger" :loading="closing" @click="handleClose">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { partnerRequest } from '@/api/http';
import { partnerEmploymentApi } from '@/api/partner';
import type { EmploymentJob, EmploymentProject } from '@/types/partner';

interface JobRow extends EmploymentJob {
  projectName?: string;
  applicationCount: number;
  createdAt: string;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  'full-time': '全职',
  'part-time': '兼职',
  internship: '实习',
  apprentice: '学徒'
};
const JOB_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '招聘中',
  closed: '已关闭'
};

const router = useRouter();
const items = ref<JobRow[]>([]);
const projects = ref<EmploymentProject[]>([]);
const search = ref('');
const statusFilter = ref('');
const projectFilter = ref('');
const loading = ref(false);

const publishDialog = ref(false);
const publishTarget = ref<JobRow | null>(null);
const publishProjectId = ref('');
const publishing = ref(false);

const closeDialog = ref(false);
const closeTarget = ref<JobRow | null>(null);
const closing = ref(false);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((j) => j.title.toLowerCase().includes(q));
});

function jobTypeLabel(t: string) { return JOB_TYPE_LABELS[t] || t; }
function jobStatusLabel(s: string) { return JOB_STATUS_LABELS[s] || s; }
function statusTagType(s: string): 'success' | 'warning' | 'info' {
  if (s === 'published') return 'success';
  if (s === 'closed') return 'info';
  return 'warning';
}
function fmt(d?: string) { return d ? String(d).slice(0, 10) : '-'; }

async function loadProjects() {
  try {
    const res = await partnerEmploymentApi.listProjects();
    projects.value = res.items || [];
  } catch {
    projects.value = [];
  }
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await partnerEmploymentApi.listJobs({
      projectId: projectFilter.value || undefined,
      status: statusFilter.value || undefined
    });
    items.value = (res.items || []) as JobRow[];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function reload() {
  loadItems();
}

function openPublish(row: JobRow) {
  publishProjectId.value = row.projectId ?? '';
  publishTarget.value = row;
  publishDialog.value = true;
}

async function setJobStatus(id: string, action: 'publish' | 'close', projectId?: string) {
  // 对齐 React partnerEmploymentApi.setJobStatus：POST /partner/employment-jobs/:id/status，body { action, projectId }
  await partnerRequest<{ id: string; status: string }>(`/partner/employment-jobs/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ action, projectId })
  });
}

async function handlePublish() {
  if (!publishTarget.value) return;
  publishing.value = true;
  try {
    await setJobStatus(publishTarget.value.id, 'publish', publishProjectId.value || undefined);
    ElMessage.success('已发布');
    publishDialog.value = false;
    publishTarget.value = null;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '发布失败');
  } finally {
    publishing.value = false;
  }
}

function openClose(row: JobRow) {
  closeTarget.value = row;
  closeDialog.value = true;
}

async function handleClose() {
  if (!closeTarget.value) return;
  closing.value = true;
  try {
    await setJobStatus(closeTarget.value.id, 'close');
    ElMessage.success('已关闭');
    closeDialog.value = false;
    closeTarget.value = null;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '关闭失败');
  } finally {
    closing.value = false;
  }
}

async function confirmDelete(row: JobRow) {
  try {
    await ElMessageBox.confirm(`确定要删除岗位「${row.title}」吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await partnerEmploymentApi.deleteJob(row.id);
    ElMessage.success('已删除');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(() => {
  loadProjects();
  loadItems();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.header-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.dialog-sub { color: #606266; margin: 0 0 12px; }
.muted { font-size: 12px; color: #909399; margin: 4px 0 0; }
</style>

<template>
  <div class="list-page">
    <div class="page-head">
      <div class="page-title">岗位与投递</div>
      <div class="page-sub">管理服务大厅岗位发布状态，查看学生投递记录。</div>
    </div>

    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="岗位" name="jobs">
          <div class="filters">
            <el-input v-model="jobSearch" placeholder="搜索岗位名称..." clearable style="max-width: 240px" @input="onJobSearchInput" @clear="reloadJobs" @keyup.enter="reloadJobs" />
            <el-select v-model="jobStatus" style="width: 120px" @change="onJobFilterChange">
              <el-option label="全部状态" value="all" />
              <el-option v-for="(label, v) in EMPLOYMENT_JOB_STATUS_LABELS" :key="v" :label="label" :value="v" />
            </el-select>
            <el-select v-model="jobProjectId" style="width: 160px" @change="onJobFilterChange">
              <el-option label="全部项目" value="all" />
              <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <el-select v-model="jobEnterpriseId" style="width: 160px" @change="onJobFilterChange">
              <el-option label="全部企业" value="all" />
              <el-option v-for="e in enterprises" :key="e.id" :label="e.name" :value="e.id" />
            </el-select>
          </div>

          <el-table v-loading="jobsLoading" :data="jobs" stripe>
            <el-table-column prop="title" label="岗位" min-width="160" show-overflow-tooltip />
            <el-table-column label="企业" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.enterpriseName || '-' }}</template></el-table-column>
            <el-table-column label="项目" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.projectName || '独立岗位' }}</template></el-table-column>
            <el-table-column label="类型" width="90"><template #default="{ row }">{{ EMPLOYMENT_JOB_TYPE_LABELS[row.jobType] ?? row.jobType }}</template></el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="jobStatusTagType(row.status)">{{ EMPLOYMENT_JOB_STATUS_LABELS[row.status] ?? row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="applicationCount" label="投递数" width="80" />
            <el-table-column label="创建时间" width="160"><template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <span v-if="row.status === 'draft'" class="muted">-</span>
                <el-button v-else size="small" text type="primary" @click="changeStatus(row)">{{ row.status === 'published' ? '下架' : '恢复' }}</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <span class="total-text">共 {{ jobTotal }} 条记录</span>
            <el-pagination
              v-if="jobTotal > JOB_PAGE_SIZE"
              v-model:current-page="jobPage"
              :page-size="JOB_PAGE_SIZE"
              :total="jobTotal"
              layout="prev, pager, next"
              @current-change="loadJobs"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="投递" name="applications">
          <div class="filters">
            <el-input v-model="appSearch" placeholder="搜索学生姓名..." clearable style="max-width: 240px" @input="onAppSearchInput" @clear="reloadApps" @keyup.enter="reloadApps" />
            <el-select v-model="appProjectId" style="width: 160px" @change="onAppFilterChange">
              <el-option label="全部项目" value="all" />
              <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
            <el-select v-model="appEnterpriseId" style="width: 160px" @change="onAppFilterChange">
              <el-option label="全部企业" value="all" />
              <el-option v-for="e in enterprises" :key="e.id" :label="e.name" :value="e.id" />
            </el-select>
          </div>

          <el-table v-loading="appsLoading" :data="apps" stripe>
            <el-table-column label="学生" min-width="120"><template #default="{ row }">{{ row.studentName || '-' }}</template></el-table-column>
            <el-table-column label="学号" min-width="120"><template #default="{ row }">{{ row.studentNo || '-' }}</template></el-table-column>
            <el-table-column label="专业" min-width="120" show-overflow-tooltip><template #default="{ row }">{{ row.majorName || '-' }}</template></el-table-column>
            <el-table-column label="班级" min-width="120" show-overflow-tooltip><template #default="{ row }">{{ row.className || '-' }}</template></el-table-column>
            <el-table-column label="岗位" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.jobTitle || '-' }}</template></el-table-column>
            <el-table-column label="企业" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.enterpriseName || '-' }}</template></el-table-column>
            <el-table-column label="项目" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.projectName || '-' }}</template></el-table-column>
            <el-table-column label="投递时间" width="160"><template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="viewing = row">查看</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <span class="total-text">共 {{ appTotal }} 条记录</span>
            <el-pagination
              v-if="appTotal > JOB_PAGE_SIZE"
              v-model:current-page="appPage"
              :page-size="JOB_PAGE_SIZE"
              :total="appTotal"
              layout="prev, pager, next"
              @current-change="loadApps"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="viewDialog" title="投递详情" width="520px">
      <el-descriptions v-if="viewing" :column="1" border>
        <el-descriptions-item label="学生">{{ viewing.studentName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="学号">{{ viewing.studentNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="专业">{{ viewing.majorName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="班级">{{ viewing.className || '-' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ viewing.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ viewing.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="岗位">{{ viewing.jobTitle || '-' }}</el-descriptions-item>
        <el-descriptions-item label="企业">{{ viewing.enterpriseName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="项目">{{ viewing.projectName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="投递时间">{{ formatDateTime(viewing.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="求职信"><span class="pre-wrap">{{ viewing.coverLetter || '-' }}</span></el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { portalRequest, buildQuery } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_JOB_STATUS_LABELS,
  formatDateTime,
} from './alliance-admin';
import type { EmploymentJob, EmploymentProject, EmploymentApplication, ListResponse } from './alliance-admin';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const JOB_PAGE_SIZE = 20;
const activeTab = ref('jobs');

const projects = ref<{ id: string; name: string }[]>([]);
const enterprises = ref<{ id: string; name: string }[]>([]);

// 岗位
const jobs = ref<EmploymentJob[]>([]);
const jobsLoading = ref(false);
const jobTotal = ref(0);
const jobPage = ref(1);
const jobSearch = ref('');
const jobStatus = ref('all');
const jobProjectId = ref('all');
const jobEnterpriseId = ref('all');

// 投递
const apps = ref<EmploymentApplication[]>([]);
const appsLoading = ref(false);
const appTotal = ref(0);
const appPage = ref(1);
const appSearch = ref('');
const appProjectId = ref('all');
const appEnterpriseId = ref('all');

const viewing = ref<EmploymentApplication | null>(null);
const viewDialog = ref(false);

function jobStatusTagType(s: string): 'success' | 'warning' | 'info' {
  if (s === 'published') return 'success';
  if (s === 'closed') return 'info';
  return 'warning';
}

async function loadRefs() {
  if (!tenantId.value) return;
  try {
    const [p, e] = await Promise.all([
      portalRequest<ListResponse<EmploymentProject>>('/alliance/employment-projects?limit=200'),
      portalRequest<ListResponse<{ id: string; name: string }>>('/alliance/enterprises?limit=200'),
    ]);
    projects.value = (p.items || []).map((x) => ({ id: x.id, name: x.name }));
    enterprises.value = (e.items || []).map((x) => ({ id: x.id, name: x.name }));
  } catch {
    // 筛选数据源加载失败不阻断主流程
  }
}

async function loadJobs() {
  if (!tenantId.value) return;
  jobsLoading.value = true;
  try {
    const res = await portalRequest<ListResponse<EmploymentJob>>(
      `/alliance/employment-jobs${buildQuery({
        limit: JOB_PAGE_SIZE,
        offset: (jobPage.value - 1) * JOB_PAGE_SIZE,
        search: jobSearch.value.trim() || undefined,
        status: jobStatus.value === 'all' ? undefined : jobStatus.value,
        projectId: jobProjectId.value === 'all' ? undefined : jobProjectId.value,
        enterpriseId: jobEnterpriseId.value === 'all' ? undefined : jobEnterpriseId.value,
      })}`,
    );
    jobs.value = res.items || [];
    jobTotal.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载岗位失败');
  } finally {
    jobsLoading.value = false;
  }
}

async function loadApps() {
  if (!tenantId.value) return;
  appsLoading.value = true;
  try {
    const res = await portalRequest<ListResponse<EmploymentApplication>>(
      `/alliance/employment-applications${buildQuery({
        limit: JOB_PAGE_SIZE,
        offset: (appPage.value - 1) * JOB_PAGE_SIZE,
        search: appSearch.value.trim() || undefined,
        projectId: appProjectId.value === 'all' ? undefined : appProjectId.value,
        enterpriseId: appEnterpriseId.value === 'all' ? undefined : appEnterpriseId.value,
      })}`,
    );
    apps.value = res.items || [];
    appTotal.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载投递失败');
  } finally {
    appsLoading.value = false;
  }
}

let jobTimer: ReturnType<typeof setTimeout> | undefined;
function onJobSearchInput() {
  if (jobTimer) clearTimeout(jobTimer);
  jobTimer = setTimeout(() => {
    jobPage.value = 1;
    loadJobs();
  }, 300);
}
function reloadJobs() {
  if (jobTimer) clearTimeout(jobTimer);
  jobPage.value = 1;
  loadJobs();
}
function onJobFilterChange() {
  jobPage.value = 1;
  loadJobs();
}

let appTimer: ReturnType<typeof setTimeout> | undefined;
function onAppSearchInput() {
  if (appTimer) clearTimeout(appTimer);
  appTimer = setTimeout(() => {
    appPage.value = 1;
    loadApps();
  }, 300);
}
function reloadApps() {
  if (appTimer) clearTimeout(appTimer);
  appPage.value = 1;
  loadApps();
}
function onAppFilterChange() {
  appPage.value = 1;
  loadApps();
}

async function changeStatus(job: EmploymentJob) {
  if (job.status === 'draft') return;
  const next = job.status === 'published' ? 'closed' : 'published';
  try {
    await portalRequest(`/alliance/employment-jobs/${job.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: next }),
    });
    ElMessage.success(next === 'closed' ? '已下架' : '已恢复');
    await loadJobs();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

onMounted(() => {
  loadRefs();
  loadJobs();
  loadApps();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.page-head { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 600; }
.page-sub { margin-top: 4px; font-size: 13px; color: #909399; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.pager-row { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
.total-text { font-size: 13px; color: #909399; }
.muted { font-size: 13px; color: #909399; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; }
</style>

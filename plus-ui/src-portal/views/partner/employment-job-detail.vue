<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <div class="card-title">{{ job?.title || '岗位详情' }}</div>
            <div v-if="job" class="card-sub">{{ jobTypeLabel(job.jobType) }}</div>
          </div>
          <div class="header-actions">
            <el-tag v-if="job" :type="statusTagType(job.status)">{{ jobStatusLabel(job.status) }}</el-tag>
            <el-button v-if="job" @click="router.push(`/partner/employment-jobs/${id}/edit`)">编辑</el-button>
            <el-button @click="router.push('/partner/employment-jobs')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="notFound" :description="notFoundMessage" />

      <el-tabs v-else v-model="activeTab">
        <el-tab-pane label="岗位详情" name="info">
          <el-descriptions v-if="job" :column="2" border>
            <el-descriptions-item label="岗位名称">{{ job.title }}</el-descriptions-item>
            <el-descriptions-item label="岗位类型">{{ jobTypeLabel(job.jobType) }}</el-descriptions-item>
            <el-descriptions-item label="所属就业项目">{{ job.projectName || '独立岗位' }}</el-descriptions-item>
            <el-descriptions-item label="工作地点">{{ job.location || '-' }}</el-descriptions-item>
            <el-descriptions-item label="薪资范围">{{ salaryText(job) }}</el-descriptions-item>
            <el-descriptions-item label="招聘人数">{{ job.headcount ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="学历要求">{{ job.education || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ job.contactPerson || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ job.contactPhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="截止日期">{{ formatDate(job.deadline) }}</el-descriptions-item>
            <el-descriptions-item label="投递数">{{ job.applicationCount }}</el-descriptions-item>
            <el-descriptions-item v-if="(job.suitableMajors ?? []).length" label="面向专业" :span="2">
              {{ (job.suitableMajors ?? []).join('、') }}
            </el-descriptions-item>
            <el-descriptions-item v-if="job.description" label="岗位介绍" :span="2">
              <span class="pre-wrap">{{ job.description }}</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="job.responsibilities" label="工作职责" :span="2">
              <span class="pre-wrap">{{ job.responsibilities }}</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="job.requirements" label="任职要求" :span="2">
              <span class="pre-wrap">{{ job.requirements }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane name="applications">
          <template #label>学生投递（{{ applications.length }}）</template>
          <el-table :data="applications" stripe>
            <el-table-column label="学生" min-width="100">
              <template #default="{ row }">
                <span class="student-name">{{ row.studentName || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="studentNo" label="学号" min-width="110" />
            <el-table-column prop="majorName" label="专业" min-width="130" />
            <el-table-column prop="className" label="班级" min-width="120" />
            <el-table-column prop="phone" label="电话" min-width="120" />
            <el-table-column prop="email" label="邮箱" min-width="150" />
            <el-table-column label="投递时间" width="160">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="selectedApp = row">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="applications.length === 0" description="暂无学生投递。" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="appDialog" title="投递详情" width="640px">
      <el-descriptions v-if="selectedApp" :column="2" border>
        <el-descriptions-item label="学生">{{ selectedApp.studentName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="学号">{{ selectedApp.studentNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="专业">{{ selectedApp.majorName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="班级">{{ selectedApp.className || '-' }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ selectedApp.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ selectedApp.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="应聘岗位">{{ selectedApp.jobTitle || '-' }}</el-descriptions-item>
        <el-descriptions-item label="投递时间">{{ formatDateTime(selectedApp.createdAt) }}</el-descriptions-item>
        <el-descriptions-item v-if="selectedApp.coverLetter" label="投递内容" :span="2">
          <span class="pre-wrap">{{ selectedApp.coverLetter }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerRequest } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { EmploymentJob } from '@/types/partner';

interface JobDetail extends EmploymentJob {
  projectName?: string;
  applicationCount: number;
}

interface EmploymentApplication {
  id: string;
  studentName?: string;
  studentNo?: string;
  majorName?: string;
  className?: string;
  phone?: string;
  email?: string;
  coverLetter?: string;
  jobTitle?: string;
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

function jobTypeLabel(t: string): string {
  return JOB_TYPE_LABELS[t] || t;
}
function jobStatusLabel(s: string): string {
  return JOB_STATUS_LABELS[s] || s;
}
function statusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'published') return 'success';
  if (s === 'closed') return 'info';
  return 'warning';
}
function formatDate(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function formatDateTime(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function salaryText(job: { salaryMin?: number; salaryMax?: number }): string {
  if (job.salaryMin == null && job.salaryMax == null) return '-';
  if (job.salaryMin != null && job.salaryMax != null) return `${job.salaryMin} ~ ${job.salaryMax} 千元/月`;
  return `${job.salaryMin ?? job.salaryMax} 千元/月`;
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

const job = ref<JobDetail | null>(null);
const applications = ref<EmploymentApplication[]>([]);
const loading = ref(false);
const loadError = ref('');
const activeTab = ref('info');
const selectedApp = ref<EmploymentApplication | null>(null);

const appDialog = computed({
  get: () => selectedApp.value !== null,
  set: (v: boolean) => {
    if (!v) selectedApp.value = null;
  }
});

const notFound = computed(() => !loading.value && !loadError.value && !job.value);
const notFoundMessage = computed(() => loadError.value || '岗位不存在');

async function loadJob() {
  loading.value = true;
  loadError.value = '';
  try {
    job.value = await partnerRequest<JobDetail>(`/partner/employment-jobs/${id}`);
  } catch (e) {
    loadError.value = (e as Error).message || '岗位不存在';
  } finally {
    loading.value = false;
  }
}

async function loadApplications() {
  try {
    const res = await partnerRequest<ListResponse<EmploymentApplication>>(
      `/partner/employment-jobs/${id}/applications`
    );
    applications.value = res.items || [];
  } catch {
    applications.value = [];
  }
}

onMounted(() => {
  loadJob();
  loadApplications();
});
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.header-left { min-width: 0; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.student-name { font-weight: 500; color: #409eff; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; }
</style>

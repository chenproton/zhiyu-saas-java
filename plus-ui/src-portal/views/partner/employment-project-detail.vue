<template>
  <div class="detail-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <div class="card-title">{{ project?.name || '就业项目详情' }}</div>
            <div v-if="project" class="card-sub">{{ projectTypeLabel(project.type) }}</div>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/partner/employment-projects')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="notFound" :description="notFoundMessage" />

      <el-tabs v-else v-model="activeTab">
        <el-tab-pane label="项目信息" name="info">
          <el-descriptions v-if="project" :column="2" border>
            <el-descriptions-item label="项目名称">{{ project.name }}</el-descriptions-item>
            <el-descriptions-item label="项目类型">{{ projectTypeLabel(project.type) }}</el-descriptions-item>
            <el-descriptions-item label="当前状态">{{ projectPhaseLabel(derivePhase(project)) }}</el-descriptions-item>
            <el-descriptions-item label="发起单位">{{ project.organizer || '-' }}</el-descriptions-item>
            <el-descriptions-item label="开始日期">{{ formatDate(project.startDate) }}</el-descriptions-item>
            <el-descriptions-item label="结束日期">{{ formatDate(project.endDate) }}</el-descriptions-item>
            <el-descriptions-item label="发布状态">{{ publishStatusLabel(project.publishStatus) }}</el-descriptions-item>
            <el-descriptions-item label="岗位数">{{ project.jobCount }}</el-descriptions-item>
            <el-descriptions-item label="投递数">{{ project.applicationCount }}</el-descriptions-item>
            <el-descriptions-item
              v-if="targetGroupsText"
              label="面向学生群体"
              :span="2"
            >
              {{ targetGroupsText }}
            </el-descriptions-item>
            <el-descriptions-item v-if="project.description" label="项目简介" :span="2">
              <span class="pre-wrap">{{ project.description }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane name="jobs">
          <template #label>本企业岗位（{{ jobs.length }}）</template>
          <div class="jobs-toolbar">
            <el-button type="primary" size="small" @click="router.push('/partner/employment-jobs')">
              在该项目下新建岗位
            </el-button>
          </div>
          <el-table :data="jobs" stripe>
            <el-table-column prop="title" label="岗位名称" min-width="160" show-overflow-tooltip />
            <el-table-column label="类型" width="100">
              <template #default="{ row }">{{ jobTypeLabel(row.jobType) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="jobStatusTagType(row.status)">{{ jobStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="applicationCount" label="投递数" width="90" />
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="router.push(`/partner/employment-jobs/${row.id}`)">查看</el-button>
                <el-button size="small" @click="router.push(`/partner/employment-jobs/${row.id}/edit`)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="jobs.length === 0" description="该项目下暂无本企业岗位。" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerRequest } from '@/api/http';
import { partnerEmploymentApi } from '@/api/partner';
import type { EmploymentProject, EmploymentJob } from '@/types/partner';

interface ProjectDetail extends EmploymentProject {
  targetGroups?: { majorName?: string }[];
}

interface JobRow extends EmploymentJob {
  applicationCount?: number;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  spring: '春季招聘',
  autumn: '秋季招聘',
  directed: '定向招聘',
  order: '订单班招聘'
};

const PROJECT_PHASE_LABELS: Record<string, string> = {
  preparing: '筹备中',
  ongoing: '进行中',
  ended: '已结束'
};

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布'
};

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

function projectTypeLabel(t: string): string {
  return PROJECT_TYPE_LABELS[t] || t;
}
function projectPhaseLabel(p: string): string {
  return PROJECT_PHASE_LABELS[p] || p;
}
function publishStatusLabel(s: string): string {
  return PUBLISH_STATUS_LABELS[s] || s;
}
function jobTypeLabel(t: string): string {
  return JOB_TYPE_LABELS[t] || t;
}
function jobStatusLabel(s: string): string {
  return JOB_STATUS_LABELS[s] || s;
}
function jobStatusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'published') return 'success';
  if (s === 'closed') return 'info';
  return 'warning';
}
function derivePhase(p: { startDate?: string; endDate?: string }): string {
  const today = new Date().toISOString().slice(0, 10);
  if (p.startDate && p.startDate > today) return 'preparing';
  if (p.endDate && p.endDate < today) return 'ended';
  return 'ongoing';
}
function formatDate(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

const project = ref<ProjectDetail | null>(null);
const jobs = ref<JobRow[]>([]);
const loading = ref(false);
const loadError = ref('');
const activeTab = ref('info');

const notFound = computed(() => !loading.value && !loadError.value && !project.value);
const notFoundMessage = computed(() => loadError.value || '项目不存在或未分配给本企业');
const targetGroupsText = computed(() =>
  (project.value?.targetGroups ?? []).map((g) => g.majorName).filter(Boolean).join('、')
);

async function loadProject() {
  loading.value = true;
  loadError.value = '';
  try {
    project.value = await partnerRequest<ProjectDetail>(`/partner/employment-projects/${id}`);
  } catch (e) {
    loadError.value = (e as Error).message || '项目不存在或未分配给本企业';
  } finally {
    loading.value = false;
  }
}

async function loadJobs() {
  try {
    const res = await partnerEmploymentApi.listJobs({ projectId: id });
    jobs.value = (res.items || []) as JobRow[];
  } catch (e) {
    jobs.value = [];
    ElMessage.error((e as Error).message || '加载岗位失败');
  }
}

onMounted(() => {
  loadProject();
  loadJobs();
});
</script>

<style scoped>
.detail-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.header-left { min-width: 0; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.jobs-toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.pre-wrap { white-space: pre-wrap; word-break: break-word; }
</style>

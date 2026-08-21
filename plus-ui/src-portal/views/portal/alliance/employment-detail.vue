<template>
  <div v-if="loading" class="loading-wrap"><el-skeleton :rows="8" animated /></div>
  <div v-else-if="error" class="loading-wrap">
    <el-empty :description="error" />
    <div class="retry-wrap"><el-button type="primary" @click="load">重试</el-button></div>
  </div>
  <div v-else-if="!project" class="loading-wrap"><el-empty description="项目不存在" /></div>
  <AllianceDetailShell
    v-else
    :breadcrumbs="breadcrumbs"
    back-href="/portal/alliance/employment"
    :icon="Briefcase"
    icon-gradient="linear-gradient(135deg, #409eff, rgba(64,158,255,0.7))"
    :title="project.name"
    :subtitle="typeLabel"
    :badges="badges"
    :stats="stats"
    :tabs="tabDefs"
  >
    <template #info>
      <div class="grid-3">
        <SectionCard title="项目简介" :icon="Briefcase" class="col-2">
          <img v-if="project.coverImage" :src="project.coverImage" :alt="project.name" class="cover-img" />
          <p class="prose">{{ project.description || '-' }}</p>
        </SectionCard>

        <SectionCard title="项目信息" :icon="Calendar" class="self-start">
          <div class="info-stack">
            <InfoBlock label="项目类型" :value="typeLabel" />
            <InfoBlock label="展示状态" :value="phaseLabel" />
            <InfoBlock label="发起单位" :value="project.organizer || '-'" />
            <InfoBlock label="起止日期" :value="`${project.startDate ? formatDate(project.startDate) : '-'} ~ ${project.endDate ? formatDate(project.endDate) : '-'}`" />
            <InfoBlock label="在招岗位" :value="String(jobs.length)" />
            <InfoBlock label="累计投递" :value="String(project.applicationCount ?? 0)" />
          </div>
        </SectionCard>
      </div>
    </template>

    <template #jobs>
      <SectionCard title="岗位列表">
        <div v-if="jobs.length" class="job-list">
          <router-link v-for="job in jobs" :key="job.id" :to="`/portal/alliance/employment/job/${job.id}`" class="job-row">
            <div class="job-icon"><el-icon><Briefcase /></el-icon></div>
            <div class="job-body">
              <h4 class="job-title">{{ job.title }}</h4>
              <div class="job-meta">
                <span class="job-meta-item"><el-icon><OfficeBuilding /></el-icon>{{ job.enterpriseName || '-' }}</span>
                <span v-if="job.jobType">{{ jobTypeLabel(job.jobType) }}</span>
                <span v-if="job.location" class="job-meta-item"><el-icon><Location /></el-icon>{{ job.location }}</span>
              </div>
            </div>
            <div v-if="salary(job)" class="job-salary">
              <p class="job-salary-v">{{ salary(job) }}</p>
              <p class="job-salary-l">千元/月</p>
            </div>
            <div class="job-headcount">
              <p class="job-headcount-v">{{ job.headcount ?? '-' }}</p>
              <p class="job-headcount-l">招聘人数</p>
            </div>
            <el-icon class="job-arrow"><Right /></el-icon>
          </router-link>
        </div>
        <el-empty v-else description="本项目暂无已发布岗位" :image-size="60" />
      </SectionCard>
    </template>
  </AllianceDetailShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Briefcase, Calendar, OfficeBuilding, Location, Right, User } from '@element-plus/icons-vue';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import AllianceDetailShell, { type DetailBadge, type DetailStat, type DetailTab } from './components/AllianceDetailShell.vue';
import SectionCard from './components/SectionCard.vue';
import InfoBlock from './components/InfoBlock.vue';
import {
  deriveEmploymentProjectPhase,
  EMPLOYMENT_JOB_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  formatDate,
  formatSalaryRange,
  type EmploymentJob,
  type EmploymentProject,
} from './shared';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const project = ref<EmploymentProject | null>(null);
const jobs = ref<EmploymentJob[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const typeLabel = computed(() =>
  project.value ? EMPLOYMENT_PROJECT_TYPE_LABELS[project.value.type] ?? project.value.type : '',
);
const phaseLabel = computed(() =>
  project.value ? EMPLOYMENT_PROJECT_PHASE_LABELS[deriveEmploymentProjectPhase(project.value)] : '',
);

const breadcrumbs = computed(() => [
  { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
  { label: '人才与岗位供需服务大厅', href: '/portal/alliance/employment' },
  { label: project.value?.name || '' },
]);

const badges = computed<DetailBadge[]>(() => {
  if (!project.value) return [];
  const phase = deriveEmploymentProjectPhase(project.value);
  const phaseBg = phase === 'ongoing' ? '#10b981' : phase === 'preparing' ? '#f59e0b' : '#64748b';
  return [
    { text: typeLabel.value },
    { text: EMPLOYMENT_PROJECT_PHASE_LABELS[phase], background: phaseBg, color: '#fff' },
    {
      text: `${project.value.startDate ? formatDate(project.value.startDate) : '-'} ~ ${project.value.endDate ? formatDate(project.value.endDate) : '-'}`,
    },
  ];
});

const stats = computed<DetailStat[]>(() => [
  { label: '在招岗位', value: jobs.value.length, icon: Briefcase, gradient: 'linear-gradient(135deg,#409eff,rgba(64,158,255,0.8))' },
  { label: '累计投递', value: project.value?.applicationCount ?? 0, icon: User, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))' },
]);

const tabDefs = computed<DetailTab[]>(() => [
  { value: 'info', label: '项目信息' },
  { value: 'jobs', label: '岗位列表', count: jobs.value.length },
]);

function jobTypeLabel(type: string) {
  return EMPLOYMENT_JOB_TYPE_LABELS[type] ?? type;
}
function salary(job: EmploymentJob) {
  return formatSalaryRange(job);
}

async function load() {
  if (!id || !tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const [proj, jobsRes] = await Promise.all([
      portalRequest<EmploymentProject>(`/alliance/public/employment-projects/${id}?tenantId=${tenantId.value}`),
      portalRequest<{ items: EmploymentJob[] }>(
        `/alliance/public/employment-projects/${id}/jobs?tenantId=${tenantId.value}`,
      ),
    ]);
    project.value = proj;
    jobs.value = jobsRes.items ?? [];
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.loading-wrap { max-width: 1280px; margin: 0 auto; padding: 24px; }
.retry-wrap { text-align: center; margin-top: 12px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.col-2 { grid-column: span 2; }
.self-start { align-self: start; }
.cover-img { width: 100%; max-height: 288px; object-fit: cover; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-bottom: 16px; }
.prose { color: #334155; line-height: 1.8; white-space: pre-wrap; }
.info-stack { display: flex; flex-direction: column; gap: 12px; }
.job-list { display: flex; flex-direction: column; }
.job-row { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s; text-decoration: none; color: inherit; }
.job-row:last-child { border-bottom: none; }
.job-row:hover { background: rgba(64,158,255,0.03); }
.job-icon { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, rgba(64,158,255,0.1), rgba(64,158,255,0.05)); display: flex; align-items: center; justify-content: center; color: #409eff; flex-shrink: 0; }
.job-body { flex: 1; min-width: 0; }
.job-title { font-weight: 500; font-size: 14px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.2s; }
.job-row:hover .job-title { color: #409eff; }
.job-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 12px; color: #64748b; flex-wrap: wrap; min-width: 0; }
.job-meta-item { display: inline-flex; align-items: center; gap: 4px; }
.job-salary { flex-shrink: 0; text-align: right; }
.job-salary-v { font-size: 16px; font-weight: 700; color: #409eff; line-height: 1.2; }
.job-salary-l { font-size: 10px; color: #94a3b8; margin-top: 2px; }
.job-headcount { flex-shrink: 0; text-align: right; }
.job-headcount-v { font-size: 14px; font-weight: 600; color: #334155; }
.job-headcount-l { font-size: 10px; color: #94a3b8; margin-top: 2px; }
.job-arrow { color: #cbd5e1; flex-shrink: 0; transition: color 0.2s, transform 0.2s; }
.job-row:hover .job-arrow { color: #409eff; transform: translate(2px, -2px); }
@media (max-width: 992px) { .grid-3 { grid-template-columns: 1fr; } .col-2 { grid-column: auto; } }
</style>

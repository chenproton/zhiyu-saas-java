<template>
  <div v-if="loading" class="loading-wrap"><el-skeleton :rows="8" animated /></div>
  <div v-else-if="error || !job" class="loading-wrap">
    <el-empty :description="error || '岗位不存在'" />
    <div class="retry-wrap"><el-button type="primary" @click="load">重试</el-button></div>
  </div>
  <AllianceDetailShell
    v-else
    :breadcrumbs="breadcrumbs"
    back-href="/portal/alliance/employment"
    :icon="Briefcase"
    icon-gradient="linear-gradient(135deg, #409eff, rgba(64,158,255,0.7))"
    :title="job.title"
    :subtitle="job.enterpriseName || '-'"
    :badges="badges"
    :stats="stats"
    :tabs="tabDefs"
  >
    <template #info>
      <div class="grid-3">
        <div class="col-2 stack">
          <SectionCard title="岗位介绍" :icon="Document">
            <p class="prose">{{ job.description || '-' }}</p>
          </SectionCard>
          <SectionCard v-if="job.responsibilities" title="岗位职责" :icon="List">
            <p class="prose">{{ job.responsibilities }}</p>
          </SectionCard>
          <SectionCard v-if="job.requirements" title="任职要求" :icon="Aim">
            <p class="prose">{{ job.requirements }}</p>
          </SectionCard>
        </div>

        <div class="stack self-start">
          <SectionCard v-if="isStudent" title="投递申请" :icon="Promotion">
            <el-button v-if="applied" type="info" disabled class="apply-btn"><el-icon><CircleCheckFilled /></el-icon>已投递</el-button>
            <el-button v-else type="primary" class="apply-btn" @click="dialogOpen = true"><el-icon><Promotion /></el-icon>立即投递</el-button>
            <router-link to="/portal/alliance/employment/mine" class="mine-link">我的投递 <el-icon><Right /></el-icon></router-link>
          </SectionCard>

          <SectionCard title="岗位信息" :icon="Briefcase">
            <div class="info-stack">
              <InfoBlock label="所属企业" :value="job.enterpriseName || '-'" />
              <InfoBlock label="岗位类型" :value="typeLabel" />
              <InfoBlock label="工作地点" :value="job.location || '-'" />
              <InfoBlock label="薪资（千元/月）" :value="salary ?? '-'" />
              <InfoBlock label="招聘人数" :value="job.headcount ?? '-'" />
              <InfoBlock label="学历要求" :value="job.education || '-'" />
              <InfoBlock label="面向专业" :value="majors.length ? majors.join('、') : '-'" />
              <InfoBlock label="联系人" :value="job.contactPerson || '-'" />
              <InfoBlock label="截止日期" :value="job.deadline ? formatDate(job.deadline) : '-'" />
            </div>
          </SectionCard>
        </div>
      </div>
    </template>
  </AllianceDetailShell>

  <el-dialog v-model="dialogOpen" title="确认投递" width="560px">
    <p class="dlg-subtitle">{{ job?.title }}{{ job?.enterpriseName ? ` · ${job.enterpriseName}` : '' }}</p>
    <div class="dlg-grid">
      <div class="readonly-field"><p class="rf-label">姓名</p><p class="rf-value">{{ user?.name || '-' }}</p></div>
      <div class="readonly-field"><p class="rf-label">专业</p><p class="rf-value">{{ majorName || '-' }}</p></div>
      <div class="readonly-field"><p class="rf-label">班级/组织</p><p class="rf-value">{{ orgName || '-' }}</p></div>
      <div v-if="studentNo" class="readonly-field"><p class="rf-label">学号</p><p class="rf-value">{{ studentNo }}</p></div>
    </div>
    <div class="dlg-field">
      <label class="dlg-label">求职信（选填）</label>
      <el-input v-model="coverLetter" type="textarea" :rows="4" placeholder="简单介绍你的求职意向与个人优势..." />
    </div>
    <div class="dlg-notice">
      <p class="notice-title">投递须知</p>
      <p>· 投递后可在「我的投递」中查看进度</p>
      <p>· 请确保联系方式准确，便于企业联系</p>
      <p>· 同一岗位仅可投递一次</p>
    </div>
    <template #footer>
      <el-button @click="dialogOpen = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleApply">{{ submitting ? '提交中...' : '确认投递' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Briefcase, Document, List, Aim, Promotion, CircleCheckFilled, Right, User } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { authedFetch, portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import AllianceDetailShell, { type BreadcrumbItem, type DetailBadge, type DetailStat, type DetailTab } from './components/AllianceDetailShell.vue';
import SectionCard from './components/SectionCard.vue';
import InfoBlock from './components/InfoBlock.vue';
import {
  EMPLOYMENT_JOB_STATUS_LABELS,
  EMPLOYMENT_JOB_TYPE_LABELS,
  formatDate,
  formatSalaryRange,
  type EmploymentApplication,
  type EmploymentJob,
} from './shared';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const job = ref<EmploymentJob | null>(null);
const applied = ref(false);
const loading = ref(true);
const error = ref<string | null>(null);
const dialogOpen = ref(false);
const coverLetter = ref('');
const submitting = ref(false);

const user = computed(() => auth.user as any);
const isStudent = computed(() => {
  const u = user.value;
  if (!u) return false;
  return (
    u.activeRoleCode === 'student' ||
    u.role === 'student' ||
    (Array.isArray(u.roles) && u.roles.some((r: any) => r?.code === 'student' || r === 'student'))
  );
});
const majorName = computed(() => user.value?.major?.name || user.value?.majorName || '');
const orgName = computed(() => user.value?.orgNode?.name || user.value?.orgNodeName || '');
const studentNo = computed(() => user.value?.studentNo || '');

const typeLabel = computed(() =>
  job.value ? EMPLOYMENT_JOB_TYPE_LABELS[job.value.jobType] ?? job.value.jobType : '',
);
const salary = computed(() => (job.value ? formatSalaryRange(job.value) : null));
const majors = computed(() => job.value?.suitableMajors ?? []);

const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const crumbs: BreadcrumbItem[] = [
    { label: '校企合作联盟首页', href: '/portal/alliance/landing' },
    { label: '人才与岗位供需服务大厅', href: '/portal/alliance/employment' },
  ];
  if (job.value?.projectId && job.value?.projectName) {
    crumbs.push({ label: job.value.projectName, href: `/portal/alliance/employment/${job.value.projectId}` });
  }
  crumbs.push({ label: job.value?.title || '' });
  return crumbs;
});

const badges = computed<DetailBadge[]>(() => {
  if (!job.value) return [];
  const list: DetailBadge[] = [{ text: typeLabel.value }];
  list.push({ text: EMPLOYMENT_JOB_STATUS_LABELS[job.value.status] ?? job.value.status });
  if (job.value.deadline) list.push({ text: `截止：${formatDate(job.value.deadline)}` });
  return list;
});

const stats = computed<DetailStat[]>(() => [
  { label: '招聘人数', value: job.value?.headcount ?? '-', icon: User, gradient: 'linear-gradient(135deg,#409eff,rgba(64,158,255,0.8))' },
  { label: '累计投递', value: job.value?.applicationCount ?? 0, icon: Document, gradient: 'linear-gradient(135deg,rgba(64,158,255,0.9),rgba(64,158,255,0.7))' },
]);

const tabDefs = computed<DetailTab[]>(() => [{ value: 'info', label: '岗位详情' }]);

async function load() {
  if (!id || !tenantId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const [jobData, apps] = await Promise.all([
      portalRequest<EmploymentJob>(`/alliance/public/employment-jobs/${id}?tenantId=${tenantId.value}`),
      isStudent.value
        ? portalRequest<{ items: EmploymentApplication[] }>('/alliance/public/employment-applications/mine').catch(() => ({ items: [] as EmploymentApplication[] }))
        : Promise.resolve({ items: [] as EmploymentApplication[] }),
    ]);
    job.value = jobData;
    applied.value = apps.items.some((a) => a.jobId === id);
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleApply() {
  if (!job.value) return;
  submitting.value = true;
  try {
    const res = await authedFetch(`/alliance/public/employment-jobs/${job.value.id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ coverLetter: coverLetter.value.trim() }),
    });
    if (res.ok) {
      ElMessage.success('投递成功');
      applied.value = true;
      dialogOpen.value = false;
    } else {
      let msg = `HTTP ${res.status}`;
      try {
        const d = await res.json();
        msg = d?.error || msg;
      } catch {
        /* ignore */
      }
      if (res.status === 409) {
        ElMessage.warning('您已投递过该岗位');
        applied.value = true;
        dialogOpen.value = false;
      } else if (res.status === 403) {
        ElMessage.error(msg || '暂不可投递');
      } else if (res.status === 404) {
        ElMessage.error('该岗位暂不可投递');
      } else {
        ElMessage.error(msg || '投递失败');
      }
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '投递失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.loading-wrap { max-width: 1280px; margin: 0 auto; padding: 24px; }
.retry-wrap { text-align: center; margin-top: 12px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.col-2 { grid-column: span 2; }
.stack { display: flex; flex-direction: column; gap: 24px; }
.self-start { align-self: start; }
.prose { color: #334155; line-height: 1.8; white-space: pre-wrap; }
.info-stack { display: flex; flex-direction: column; gap: 12px; }
.apply-btn { width: 100%; }
.mine-link { margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 14px; color: #409eff; text-decoration: none; transition: color 0.2s; }
.mine-link:hover { color: rgba(64,158,255,0.8); }
.dlg-subtitle { font-size: 14px; color: #64748b; margin-bottom: 16px; }
.dlg-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
.readonly-field { padding: 12px; border-radius: 12px; background: #f8fafc; }
.rf-label { font-size: 12px; color: #94a3b8; margin-bottom: 2px; }
.rf-value { font-size: 14px; font-weight: 500; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dlg-field { margin-bottom: 16px; }
.dlg-label { display: block; font-size: 14px; font-weight: 500; color: #334155; margin-bottom: 8px; }
.dlg-notice { border-radius: 12px; background: #f8fafc; padding: 12px; font-size: 12px; color: #64748b; line-height: 1.8; }
.notice-title { font-weight: 500; color: #475569; }
@media (max-width: 992px) { .grid-3 { grid-template-columns: 1fr; } .col-2 { grid-column: auto; } }
</style>

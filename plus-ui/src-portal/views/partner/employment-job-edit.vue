<template>
  <div class="edit-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ isCreate ? '新建就业岗位' : '编辑就业岗位' }}</div>
            <div class="card-sub">{{ headerSub }}</div>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/partner/employment-jobs')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="!isCreate && !loading && !job" description="岗位不存在" />

      <el-form v-else :model="form" label-width="120px" class="job-form" @submit.prevent="handleSave">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="岗位名称" required>
              <el-input v-model="form.title" placeholder="请输入岗位名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="岗位类型" required>
              <el-select v-model="form.jobType" placeholder="请选择岗位类型" style="width: 100%">
                <el-option v-for="(label, key) in JOB_TYPE_LABELS" :key="key" :label="label" :value="key" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="合作学校" :required="isCreate">
              <div v-if="!isCreate" class="readonly-text">{{ schoolName || job?.tenantId || '-' }}</div>
              <el-select
                v-else
                v-model="form.schoolTenantId"
                filterable
                placeholder="请选择合作学校"
                :disabled="schoolLocked"
                style="width: 100%"
                @change="onSchoolChange"
              >
                <el-option v-for="s in selectableSchools" :key="s.tenantId" :label="s.schoolName" :value="s.tenantId" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属就业项目">
              <template v-if="!isCreate">
                <div class="readonly-text">{{ job?.projectName || '独立岗位' }}</div>
                <div class="field-hint">项目绑定请通过岗位列表的「发布」操作修改</div>
              </template>
              <template v-else>
                <el-select
                  v-model="form.projectId"
                  filterable
                  clearable
                  placeholder="不绑定项目（独立岗位）"
                  :disabled="projectLocked || !form.schoolTenantId"
                  style="width: 100%"
                >
                  <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
                </el-select>
                <div class="field-hint">不选择则为独立岗位</div>
              </template>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="工作地点">
              <el-input v-model="form.location" placeholder="请输入工作地点" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="学历要求">
              <el-input v-model="form.education" placeholder="如：本科及以上" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="最低薪资(千元/月)">
              <el-input-number v-model="form.salaryMin" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最高薪资(千元/月)">
              <el-input-number v-model="form.salaryMax" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="招聘人数">
              <el-input-number v-model="form.headcount" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="面向专业">
          <el-input v-model="form.suitableMajors" placeholder="如：计算机科学与技术、软件工程" />
          <div class="field-hint">多个专业用逗号或顿号分隔</div>
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="联系人">
              <el-input v-model="form.contactPerson" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="截止日期">
              <el-date-picker
                v-model="form.deadline"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择截止日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="岗位介绍">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="工作职责">
          <el-input v-model="form.responsibilities" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="任职要求">
          <el-input v-model="form.requirements" type="textarea" :rows="3" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
          <el-button @click="onCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerRequest } from '@/api/http';
import { partnerEmploymentApi, partnerSchoolApi } from '@/api/partner';
import type { EmploymentJob, EmploymentProject, PartnerSchool } from '@/types/partner';

interface JobDetail extends EmploymentJob {
  projectName?: string;
  applicationCount: number;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  'full-time': '全职',
  'part-time': '兼职',
  internship: '实习',
  apprentice: '学徒'
};

function splitMajors(text: string): string[] {
  return text
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

// 新建模式：/partner/employment-jobs/new/edit（复用 :id/edit 路由，对齐 React /partner/employment-jobs/new）
const isCreate = id === 'new';
// 新建时可由 query 预填并锁定（对齐 React new 页的 projectId / schoolTenantId query）
const fixedProjectId = typeof route.query.projectId === 'string' ? route.query.projectId : '';
const fixedSchoolTenantId = typeof route.query.schoolTenantId === 'string' ? route.query.schoolTenantId : '';
// 编辑模式项目只读（改绑走岗位列表「发布」）；新建时随 query 锁定
const projectLocked = !isCreate || Boolean(fixedProjectId);
// 挂项目时随项目一并锁定合作学校（项目归属该校，避免换学校后提交校验失败）
const schoolLocked = Boolean(fixedProjectId);

const job = ref<JobDetail | null>(null);
const loading = ref(false);
const submitting = ref(false);
const schools = ref<PartnerSchool[]>([]);
const projects = ref<EmploymentProject[]>([]);

const form = reactive({
  title: '',
  schoolTenantId: '',
  projectId: '',
  jobType: '',
  location: '',
  salaryMin: undefined as number | undefined,
  salaryMax: undefined as number | undefined,
  headcount: undefined as number | undefined,
  education: '',
  suitableMajors: '',
  description: '',
  responsibilities: '',
  requirements: '',
  contactPerson: '',
  contactPhone: '',
  deadline: ''
});

// 合作学校：新建可选（仅 active），编辑只读展示名称
const selectableSchools = computed(() => schools.value.filter((s) => s.status === 'active'));
const schoolName = computed(
  () => schools.value.find((s) => s.tenantId === (isCreate ? form.schoolTenantId : job.value?.tenantId))?.schoolName
);

const headerSub = computed(() => {
  if (isCreate) return '保存后岗位为草稿状态，可在岗位列表中发布。';
  return job.value ? `岗位名称为「${job.value.title}」。` : '';
});

async function loadSchools() {
  try {
    const res = await partnerSchoolApi.list({ limit: 200 });
    schools.value = res.items || [];
  } catch {
    // 仅用于名称展示/下拉选项，失败不阻塞表单（对齐 React onError: () => true）
    schools.value = [];
  }
}

// 所属就业项目：仅随学校过滤（项目须归属同一合作学校）
async function loadProjects() {
  if (!form.schoolTenantId) {
    projects.value = [];
    return;
  }
  try {
    const res = await partnerEmploymentApi.listProjects(form.schoolTenantId);
    projects.value = res.items || [];
  } catch {
    projects.value = [];
  }
}

function onSchoolChange() {
  form.projectId = '';
  loadProjects();
}

async function loadJob() {
  loading.value = true;
  try {
    const data = await partnerRequest<JobDetail>(`/partner/employment-jobs/${id}`);
    job.value = data;
    form.title = data.title || '';
    form.schoolTenantId = data.tenantId || '';
    form.projectId = data.projectId || '';
    form.jobType = data.jobType || '';
    form.location = data.location || '';
    form.salaryMin = data.salaryMin;
    form.salaryMax = data.salaryMax;
    form.headcount = data.headcount;
    form.education = data.education || '';
    form.suitableMajors = (data.suitableMajors ?? []).join('、');
    form.description = data.description || '';
    form.responsibilities = data.responsibilities || '';
    form.requirements = data.requirements || '';
    form.contactPerson = data.contactPerson || '';
    form.contactPhone = data.contactPhone || '';
    form.deadline = data.deadline || '';
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写岗位名称');
    return;
  }
  if (!form.jobType) {
    ElMessage.warning('请选择岗位类型');
    return;
  }
  if (isCreate && !form.schoolTenantId) {
    ElMessage.warning('请选择合作学校');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      title: form.title.trim(),
      jobType: form.jobType,
      location: form.location.trim() || undefined,
      salaryMin: form.salaryMin,
      salaryMax: form.salaryMax,
      headcount: form.headcount,
      education: form.education.trim() || undefined,
      suitableMajors: splitMajors(form.suitableMajors),
      description: form.description.trim() || undefined,
      responsibilities: form.responsibilities.trim() || undefined,
      requirements: form.requirements.trim() || undefined,
      contactPerson: form.contactPerson.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      deadline: form.deadline || undefined
    };
    if (isCreate) {
      // 新建：额外携带 schoolTenantId + projectId（后端据此校验归属并落 draft 状态）
      const created = await partnerEmploymentApi.createJob({
        ...payload,
        schoolTenantId: form.schoolTenantId,
        projectId: form.projectId || undefined
      });
      ElMessage.success('已创建');
      router.push(`/partner/employment-jobs/${created.id}`);
      return;
    }
    // 编辑：不提交 schoolTenantId / projectId（学校不可改绑，项目绑定走列表「发布」）
    await partnerEmploymentApi.updateJob(id, payload);
    ElMessage.success('已保存');
    router.push(`/partner/employment-jobs/${id}`);
  } catch (e) {
    ElMessage.error((e as Error).message || (isCreate ? '创建失败' : '保存失败'));
  } finally {
    submitting.value = false;
  }
}

function onCancel() {
  if (isCreate) {
    router.push('/partner/employment-jobs');
    return;
  }
  router.push(`/partner/employment-jobs/${id}`);
}

onMounted(() => {
  loadSchools();
  if (isCreate) {
    form.schoolTenantId = fixedSchoolTenantId;
    form.projectId = fixedProjectId;
    if (form.schoolTenantId) loadProjects();
    return;
  }
  loadJob();
});
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.job-form { max-width: 860px; }
.readonly-text { flex-basis: 100%; font-size: 14px; color: #303133; line-height: 32px; }
.field-hint { flex-basis: 100%; margin-top: 4px; font-size: 12px; color: #909399; line-height: 1.4; }
</style>

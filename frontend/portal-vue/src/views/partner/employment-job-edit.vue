<template>
  <div class="edit-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">编辑就业岗位</div>
            <div class="card-sub">{{ job ? `岗位名称为「${job.title}」` : '' }}</div>
          </div>
          <div class="header-actions">
            <el-button @click="router.push('/partner/employment-jobs')">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-empty v-if="!loading && !job" description="岗位不存在" />

      <el-form v-else :model="form" label-width="120px" class="job-form" @submit.prevent="handleSave">
        <el-form-item label="所属就业项目">
          <el-input :model-value="job?.projectName || '独立岗位'" disabled />
        </el-form-item>

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
          <el-input v-model="form.suitableMajors" placeholder="如：计算机科学与技术、软件工程（多个用逗号或顿号分隔）" />
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
          <el-button @click="router.push(`/partner/employment-jobs/${id}`)">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerRequest } from '@/api/http';
import { partnerEmploymentApi } from '@/api/partner';
import type { EmploymentJob } from '@/types/partner';

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

const job = ref<JobDetail | null>(null);
const loading = ref(false);
const submitting = ref(false);

const form = reactive({
  title: '',
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

async function loadJob() {
  loading.value = true;
  try {
    const data = await partnerRequest<JobDetail>(`/partner/employment-jobs/${id}`);
    job.value = data;
    form.title = data.title || '';
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
    ElMessage.warning('岗位名称不能为空');
    return;
  }
  if (!form.jobType) {
    ElMessage.warning('请选择岗位类型');
    return;
  }
  submitting.value = true;
  try {
    await partnerEmploymentApi.updateJob(id, {
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
    });
    ElMessage.success('已保存');
    router.push(`/partner/employment-jobs/${id}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadJob);
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.job-form { max-width: 860px; }
</style>

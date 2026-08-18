<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ isNew ? '新建人培方案' : program?.name || '方案编辑' }}</div>
            <div class="card-sub">维护方案基本信息与课程设置，发布后可用于生成教学计划</div>
          </div>
          <div class="header-actions">
            <template v-if="!isNew && activeTab === 'courses'">
              <el-button size="small" @click="coursesRef?.openImport()">批量导入</el-button>
              <el-button size="small" @click="coursesRef?.addRow()">添加岗位/课程</el-button>
              <el-button
                size="small"
                type="primary"
                :loading="coursesBusy.saving"
                :disabled="coursesBusy.saving || coursesBusy.loading"
                @click="coursesRef?.handleSave()"
              >
                {{ coursesBusy.saving ? '保存中...' : '保存' }}
              </el-button>
            </template>
            <el-tag v-if="program" :type="statusTagType(program.status)">{{ contentStatusLabel(program.status) }}</el-tag>
            <el-button @click="onBack">返回列表</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本信息" name="basic">
          <el-form v-loading="loading" :model="form" label-width="90px" class="basic-form">
            <el-form-item label="名称"><el-input v-model="form.name" placeholder="方案名称" /></el-form-item>
            <el-form-item label="入学年份"><el-input-number v-model="form.entryYear" :min="2000" :max="2100" /></el-form-item>
            <el-form-item label="层次"><el-input v-model="form.level" placeholder="如 本科/专科" /></el-form-item>
            <el-form-item label="学制(年)"><el-input-number v-model="form.duration" :min="1" :max="8" /></el-form-item>
            <el-form-item label="总学分"><el-input-number v-model="form.totalCredits" :min="0" /></el-form-item>
            <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="3" placeholder="方案简介" /></el-form-item>
            <div class="form-actions">
              <el-button :disabled="saving" @click="onBack">取消</el-button>
              <el-button type="primary" :loading="saving" :disabled="!isFormValid" @click="onSaveBasic">
                {{ saving ? '保存中...' : isNew ? '创建方案' : '保存基本信息' }}
              </el-button>
            </div>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="课程设置" name="courses" :disabled="isNew">
          <ProgramCoursesTab
            v-if="!isNew"
            ref="coursesRef"
            :program-id="id"
            @busy-change="onCoursesBusyChange"
          />
          <el-empty v-else description="请先保存基本信息后再设置课程" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { programApi } from '@/api/affairs';
import type { TrainingProgram } from '@/types/affairs';
import { contentStatusLabel } from '@/types/content-status';
import ProgramCoursesTab from './program-courses-tab.vue';

interface CoursesTabExpose {
  handleSave: () => Promise<void>;
  addRow: () => void;
  openImport: () => void;
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';

const activeTab = ref('basic');
const program = ref<TrainingProgram | null>(null);
const loading = ref(false);
const loadError = ref(false);
const saving = ref(false);
const coursesBusy = reactive({ saving: false, loading: true });
const coursesRef = ref<CoursesTabExpose | null>(null);

const form = reactive({
  name: '',
  entryYear: new Date().getFullYear(),
  level: '',
  duration: 3,
  totalCredits: 0,
  description: ''
});

const isFormValid = computed(
  () => form.name.trim() !== '' && Number(form.entryYear) > 0 && !loadError.value
);

function statusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'published' || s === 'approved') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'danger';
  return 'info';
}

async function load() {
  loading.value = true;
  if (isNew) {
    loading.value = false;
    return;
  }
  loadError.value = false;
  try {
    const p = await programApi.get(id);
    program.value = p;
    form.name = p.name;
    form.entryYear = p.entryYear;
    form.level = p.level || '';
    form.duration = p.duration ?? 3;
    form.totalCredits = p.totalCredits ?? 0;
    form.description = p.description || '';
  } catch (e) {
    loadError.value = true;
    ElMessage.error((e as Error).message || '查询人培方案失败');
  } finally {
    loading.value = false;
  }
}

async function onSaveBasic() {
  if (!isFormValid.value) {
    ElMessage.warning('名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      entryYear: form.entryYear,
      level: form.level.trim() || undefined,
      duration: form.duration,
      totalCredits: form.totalCredits,
      description: form.description.trim() || undefined
    };
    if (isNew) {
      // 新建后跳转到真实 id，课程设置 Tab 随之启用
      const created = await programApi.create(payload);
      ElMessage.success('方案已创建');
      router.replace(`/affairs/programs/${created.id}/edit`);
    } else {
      const updated = await programApi.update(id, payload);
      program.value = updated;
      ElMessage.success('基本信息已保存');
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function onCoursesBusyChange(state: { saving: boolean; loading: boolean }) {
  coursesBusy.saving = state.saving;
  coursesBusy.loading = state.loading;
}

function onBack() {
  router.push('/affairs/programs');
}

onMounted(load);
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.basic-form { max-width: 640px; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>

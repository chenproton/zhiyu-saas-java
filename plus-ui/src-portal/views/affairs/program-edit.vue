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
            <el-form-item label="方案名称" required>
              <el-input v-model="form.name" placeholder="如：计算机应用技术人才培养方案（2025 级）" />
            </el-form-item>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="所属专业">
                  <el-select v-model="form.majorId" clearable placeholder="请选择专业" style="width: 100%">
                    <el-option
                      v-for="m in majors"
                      :key="m.id"
                      :label="m.code ? `${m.name}（${m.code}）` : m.name"
                      :value="m.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="入学年份" required>
                  <el-input-number v-model="form.entryYear" :min="2000" placeholder="如：2025" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="层次">
                  <el-select v-model="form.level" placeholder="请选择层次" style="width: 100%">
                    <el-option label="未设置" value="" />
                    <el-option v-for="l in LEVEL_OPTIONS" :key="l" :label="l" :value="l" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="学制（年）">
                  <el-input-number v-model="form.duration" :min="0" placeholder="如：3" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="方案描述">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="4"
                placeholder="培养目标、规格要求等（可选）"
              />
            </el-form-item>

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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { programApi } from '@/api/affairs';
import { majorApi } from '@/api/system';
import type { TrainingProgram } from '@/types/affairs';
import type { Major } from '@/types/system';
import { contentStatusLabel } from '@/types/content-status';
import ProgramCoursesTab from './program-courses-tab.vue';

// 与 React 编辑页一致：层次固定三档（LEVEL_OPTIONS = ['中专', '大专', '本科']）
const LEVEL_OPTIONS = ['中专', '大专', '本科'];

interface CoursesTabExpose {
  handleSave: () => Promise<void>;
  addRow: () => void;
  openImport: () => void;
}

const route = useRoute();
const router = useRouter();
// id / isNew 用 computed 绑定路由：新建保存后 router.replace 到真实 id 时，
// 组件被复用不会重跑 setup，必须让 id/isNew 响应式更新，课程设置 Tab 才会随之启用。
const id = computed(() => route.params.id as string);
const isNew = computed(() => route.query.new === 'true');

const activeTab = ref('basic');
const program = ref<TrainingProgram | null>(null);
const loading = ref(false);
const loadError = ref(false);
const saving = ref(false);
const coursesBusy = reactive({ saving: false, loading: true });
const coursesRef = ref<CoursesTabExpose | null>(null);
const majors = ref<Major[]>([]);

const form = reactive({
  name: '',
  majorId: undefined as string | undefined,
  entryYear: undefined as number | undefined,
  level: '',
  duration: undefined as number | undefined,
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
  if (isNew.value) {
    loading.value = false;
    return;
  }
  loadError.value = false;
  try {
    const p = await programApi.get(id.value);
    program.value = p;
    form.name = p.name;
    form.majorId = p.majorId || undefined;
    form.entryYear = p.entryYear;
    form.level = p.level || '';
    form.duration = p.duration ?? undefined;
    form.description = p.description || '';
  } catch (e) {
    loadError.value = true;
    ElMessage.error((e as Error).message || '查询人培方案失败');
  } finally {
    loading.value = false;
  }
}

async function loadMajors() {
  try {
    const res = await majorApi.list({ limit: 500 });
    majors.value = res.items.filter((m) => m.enabled);
  } catch {
    /* 选项加载失败不阻断 */
  }
}

async function onSaveBasic() {
  if (!isFormValid.value) {
    ElMessage.warning('名称不能为空');
    return;
  }
  saving.value = true;
  try {
    // 对齐 React payload：majorId 可空、duration 空则不发、不再发 totalCredits
    const payload = {
      name: form.name.trim(),
      entryYear: Number(form.entryYear),
      majorId: form.majorId || undefined,
      level: form.level || undefined,
      duration: form.duration ?? undefined,
      description: form.description.trim() || undefined
    };
    if (isNew.value) {
      // 新建后跳转到真实 id，课程设置 Tab 随之启用
      const created = await programApi.create(payload);
      ElMessage.success('方案已创建，可继续维护课程设置');
      router.replace(`/affairs/programs/${created.id}/edit`);
    } else {
      const updated = await programApi.update(id.value, payload);
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

onMounted(() => {
  void load();
  void loadMajors();
});

// 新建保存后（或切换方案 id）重新加载方案数据
watch(id, () => {
  void load();
});
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

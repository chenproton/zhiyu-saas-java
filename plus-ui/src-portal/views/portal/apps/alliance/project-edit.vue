<template>
  <div class="edit-page">
    <!-- 加载失败禁止以默认值渲染可保存表单（对齐 React EmptyState「项目不存在」），
         否则用户填写保存会用默认值整条覆盖真实项目，造成数据丢失 -->
    <el-card v-if="notFound" shadow="never">
      <el-empty description="项目不存在">
        <el-button @click="router.push('/portal/apps/alliance/projects')">返回列表</el-button>
      </el-empty>
    </el-card>

    <el-row v-else :gutter="16">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <div class="card-header-left">
                <el-button text :icon="ArrowLeft" @click="router.back()">返回</el-button>
                <span class="card-title">{{ isNew ? '新建合作项目' : '编辑合作项目' }}</span>
              </div>
            </div>
          </template>

          <el-form v-loading="loading" :model="form" label-width="100px">
            <div class="section-title">基本信息</div>
            <el-form-item label="项目名称" required>
              <el-input v-model="form.name" placeholder="请输入项目名称" />
            </el-form-item>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="合作类型">
                  <el-select v-model="typeValue" placeholder="请选择" style="width: 100%">
                    <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="项目阶段">
                  <el-select v-model="form.phase" style="width: 100%">
                    <el-option v-for="opt in phaseOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="预算">
              <el-input v-model="form.budget" placeholder="如：50万" />
            </el-form-item>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="开始日期">
                  <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="结束日期">
                  <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <div class="section-title">项目描述</div>
            <el-form-item label-width="0">
              <el-input v-model="form.description" type="textarea" :rows="5" placeholder="请输入项目描述" />
            </el-form-item>

            <div class="section-title">项目封面</div>
            <el-form-item label-width="0">
              <ImageUpload v-model="form.coverImage" label="项目封面" hint="上传项目封面图片" />
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header><span class="card-title">合作企业</span></template>
          <el-select v-model="form.enterpriseIds" multiple filterable placeholder="选择合作企业" style="width: 100%">
            <el-option v-for="e in enterprises" :key="e.value" :label="e.label" :value="e.value" />
          </el-select>
        </el-card>

        <el-card shadow="never" class="side-card">
          <template #header><span class="card-title">二级学院</span></template>
          <el-select v-model="form.secondaryColleges" multiple filterable placeholder="选择归属学院" style="width: 100%">
            <el-option v-for="name in secondaryColleges" :key="name" :label="name" :value="name" />
          </el-select>
        </el-card>

        <el-card shadow="never" class="side-card">
          <el-button type="primary" :loading="saving" style="width: 100%" @click="handleSave">
            {{ isNew ? '创建' : '保存' }}
          </el-button>
          <el-button style="width: 100%; margin-left: 0; margin-top: 10px" @click="onCancel">取消</el-button>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import {
  allianceProjectApi,
  enterpriseApi,
  loadSecondaryColleges,
  fetchAllianceDict,
  mergeDictOptions,
  type AllianceProject,
  type AllianceDictItem,
} from './crud-shared';
import { useAllianceEditPage } from './crud-pages';
import ImageUpload from './components/ImageUpload.vue';

interface FormState {
  name: string;
  type: string;
  phase: string;
  startDate: string;
  endDate: string;
  budget: string;
  description: string;
  coverImage: string;
  enterpriseIds: string[];
  secondaryColleges: string[];
}

const PHASE_OPTIONS = [
  { value: 'initiation', label: '启动' },
  { value: 'execution', label: '执行中' },
  { value: 'acceptance', label: '验收' },
  { value: 'closure', label: '关闭' },
  { value: 'archived', label: '已归档' },
  { value: 'terminated', label: '已终止' },
];

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const { route, router, isNew, id, loading, saving, notFound, submit, onCancel } =
  useAllianceEditPage<AllianceProject>({
    listPath: '/portal/apps/alliance/projects',
    detailPath: (detailId) => `/portal/apps/alliance/projects/${detailId}`,
    fetchEntity: (fetchId) => allianceProjectApi.get(fetchId),
    fillForm,
    loadOptions,
  });

const loaded = ref<AllianceProject | null>(null);
const typeItems = ref<AllianceDictItem[]>([]);
const enterprises = ref<{ label: string; value: string }[]>([]);
const secondaryColleges = ref<string[]>([]);

const form = reactive<FormState>({
  name: '',
  type: 'talent_training',
  phase: 'initiation',
  startDate: '',
  endDate: '',
  budget: '',
  description: '',
  coverImage: '',
  enterpriseIds: route.query.enterpriseId ? [String(route.query.enterpriseId)] : [],
  secondaryColleges: [],
});

const typeOptions = computed(() => mergeDictOptions(typeItems.value, form.type));
const phaseOptions = PHASE_OPTIONS;

// 合作类型：存量项目 type 为空时退化为字典首项（对齐 React edit 页
// `item.type || projectTypeItems[0]?.code || ''`）；保存时按展示值提交，避免存空值。
const typeValue = computed<string>({
  get: () => form.type || typeItems.value[0]?.code || '',
  set: (v: string) => {
    form.type = v;
  },
});

function fillForm(p: AllianceProject) {
  loaded.value = p;
  form.name = p.name || '';
  form.type = p.type || '';
  form.phase = p.phase || 'initiation';
  form.startDate = p.startDate || '';
  form.endDate = p.endDate || '';
  form.budget = p.budget || '';
  form.description = p.description || '';
  form.coverImage = p.coverImage || '';
  form.enterpriseIds = p.enterpriseIds || [];
  form.secondaryColleges = p.secondaryColleges || [];
}

async function loadOptions() {
  try {
    const res = await enterpriseApi.list({ limit: 200 });
    enterprises.value = (res.items || [])
      .filter((e) => e.status !== 'terminated')
      .map((e) => ({ label: e.name, value: e.id }));
  } catch {
    ElMessage.warning('企业列表加载失败，可稍后重试');
  }
  typeItems.value = await fetchAllianceDict('project_type');
  secondaryColleges.value = await loadSecondaryColleges(tenantId.value);
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('项目名称不能为空');
    return;
  }
  await submit(async () => {
    const common = {
      name: form.name.trim(),
      type: typeValue.value,
      phase: form.phase,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budget: form.budget,
      description: form.description,
      coverImage: form.coverImage,
      enterpriseIds: form.enterpriseIds,
      secondaryColleges: form.secondaryColleges,
    };
    if (isNew.value) {
      const data = await allianceProjectApi.create({ ...common, isPublic: false });
      ElMessage.success('项目已创建');
      router.push(`/portal/apps/alliance/projects/${data.id}`);
    } else if (id && loaded.value) {
      await allianceProjectApi.update(id, { ...loaded.value, ...common });
      ElMessage.success('项目已保存');
      router.push(`/portal/apps/alliance/projects/${id}`);
    }
  });
}
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-header-left { display: flex; align-items: center; gap: 8px; }
.card-title { font-size: 16px; font-weight: 600; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin: 16px 0 12px; }
.side-card { margin-top: 16px; }
</style>

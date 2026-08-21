<template>
  <div class="edit-page">
    <!-- 加载失败禁止以默认值渲染可保存表单（对齐 React EmptyState「成果不存在」，
         否则用户填写保存会用默认值整条覆盖真实成果，造成数据丢失） -->
    <el-card v-if="notFound" shadow="never">
      <el-empty description="成果不存在">
        <el-button @click="router.push('/portal/apps/alliance/achievements')">返回列表</el-button>
      </el-empty>
    </el-card>

    <el-row v-else :gutter="16">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <div class="card-header-left">
                <el-button text :icon="ArrowLeft" @click="router.back()">返回</el-button>
                <span class="card-title">{{ isNew ? '新建合作成果' : '编辑合作成果' }}</span>
              </div>
            </div>
          </template>

          <el-form v-loading="loading" :model="form" label-width="100px">
            <div class="section-title">基本信息</div>
            <el-form-item label="成果名称" required>
              <el-input v-model="form.title" placeholder="请输入成果名称" />
            </el-form-item>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="成果类型">
                  <el-select v-model="form.type" placeholder="请选择" style="width: 100%">
                    <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="成果日期">
                  <el-date-picker v-model="form.achievementDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <div class="section-title">成果描述</div>
            <el-form-item label-width="0">
              <el-input v-model="form.description" type="textarea" :rows="5" placeholder="请输入成果描述" />
            </el-form-item>

            <div class="section-title">成果封面</div>
            <el-form-item label-width="0">
              <ImageUpload v-model="form.coverImage" label="成果封面" hint="上传成果封面图片" />
            </el-form-item>

            <template v-if="!isNew">
              <div class="section-title">展示设置</div>
              <el-form-item label="引用原因 / 核心亮点">
                <el-input v-model="form.citationReason" type="textarea" :rows="4" />
              </el-form-item>
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="成果归属人">
                    <el-select
                      :model-value="form.ownerPersons"
                      multiple
                      filterable
                      allow-create
                      default-first-option
                      :reserve-keyword="false"
                      placeholder="输入姓名后回车"
                      style="width: 100%"
                      @update:model-value="(v: string[]) => (form.ownerPersons = normalizeTags(v))"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="成果共建人">
                    <el-select
                      :model-value="form.coBuilders"
                      multiple
                      filterable
                      allow-create
                      default-first-option
                      :reserve-keyword="false"
                      placeholder="输入姓名后回车"
                      style="width: 100%"
                      @update:model-value="(v: string[]) => (form.coBuilders = normalizeTags(v))"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="成果佐证材料">
                <ImageUpload v-model="form.attachments" multiple label="佐证材料" hint="上传佐证图片（可多选）" />
              </el-form-item>
            </template>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header><span class="card-title">归属项目</span></template>
          <el-select v-model="form.projectIds" multiple filterable placeholder="选择归属项目（可多选）" style="width: 100%">
            <el-option v-for="p in projects" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-card>

        <el-card shadow="never" class="side-card">
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
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import {
  achievementApi,
  listAllEnterprises,
  listAllProjects,
  loadSecondaryColleges,
  fetchAllianceDict,
  mergeDictOptions,
  type AllianceAchievement,
  type AllianceDictItem,
} from './crud-shared';
import ImageUpload from './components/ImageUpload.vue';

interface FormState {
  title: string;
  type: string;
  description: string;
  achievementDate: string;
  coverImage: string;
  isPublic: boolean;
  enterpriseIds: string[];
  projectIds: string[];
  secondaryColleges: string[];
  citationReason: string;
  ownerPersons: string[];
  coBuilders: string[];
  attachments: string[];
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const isNew = computed(() => !route.params.id);
const id = route.params.id as string | undefined;

const loaded = ref<AllianceAchievement | null>(null);
const loading = ref(false);
const saving = ref(false);
const notFound = ref(false);
const typeItems = ref<AllianceDictItem[]>([]);
const enterprises = ref<{ label: string; value: string }[]>([]);
const projects = ref<{ label: string; value: string }[]>([]);
const secondaryColleges = ref<string[]>([]);

const form = reactive<FormState>({
  title: '',
  type: 'custom',
  description: '',
  achievementDate: '',
  coverImage: '',
  isPublic: false,
  enterpriseIds: route.query.enterpriseId ? [String(route.query.enterpriseId)] : [],
  projectIds: route.query.projectId ? [String(route.query.projectId)] : [],
  secondaryColleges: [],
  citationReason: '',
  ownerPersons: [],
  coBuilders: [],
  attachments: [],
});

const typeOptions = computed(() => mergeDictOptions(typeItems.value, form.type));

/** 自由标签规范化（对齐 React TagInput：逗号/换行拆分 + 去重 + 去空白） */
function normalizeTags(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    for (const part of String(raw).split(/[,，\n]/)) {
      const s = part.trim();
      if (s && !out.includes(s)) out.push(s);
    }
  }
  return out;
}

function fillForm(a: AllianceAchievement) {
  form.title = a.title || '';
  form.type = a.type || 'custom';
  form.description = a.description || '';
  form.achievementDate = a.achievementDate || '';
  form.coverImage = a.coverImage || '';
  form.isPublic = !!a.isPublic;
  form.enterpriseIds = a.enterpriseIds || [];
  form.projectIds = a.projectIds || [];
  form.secondaryColleges = a.secondaryColleges || [];
  form.citationReason = a.citationReason || '';
  form.ownerPersons = a.ownerPersons || [];
  form.coBuilders = a.coBuilders || [];
  form.attachments = a.attachments || [];
}

async function loadOptions() {
  try {
    const [ents, projs] = await Promise.all([listAllEnterprises(), listAllProjects()]);
    enterprises.value = ents
      .filter((e) => e.status !== 'terminated')
      .map((e) => ({ label: e.name, value: e.id }));
    projects.value = projs.map((p) => ({ label: p.name, value: p.id }));
  } catch {
    ElMessage.warning('企业或项目列表加载失败，可稍后重试');
  }
  typeItems.value = await fetchAllianceDict('achievement_type');
  secondaryColleges.value = await loadSecondaryColleges(tenantId.value);
}

async function load() {
  if (!isNew.value && id) {
    loading.value = true;
    try {
      const a = await achievementApi.get(id);
      loaded.value = a;
      fillForm(a);
    } catch (e) {
      notFound.value = true;
      ElMessage.error((e as Error).message || '加载失败');
    } finally {
      loading.value = false;
    }
  }
}

async function handleSave() {
  if (!form.title.trim()) {
    ElMessage.warning('成果标题不能为空');
    return;
  }
  saving.value = true;
  try {
    if (isNew.value) {
      const data = await achievementApi.create({
        title: form.title.trim(),
        type: form.type,
        description: form.description,
        achievementDate: form.achievementDate || undefined,
        coverImage: form.coverImage,
        isPublic: form.isPublic,
        enterpriseIds: form.enterpriseIds,
        projectIds: form.projectIds,
        secondaryColleges: form.secondaryColleges,
      });
      ElMessage.success('成果已创建');
      router.push(`/portal/apps/alliance/achievements/${data.id}`);
    } else if (id && loaded.value) {
      await achievementApi.update(id, {
        ...loaded.value,
        title: form.title.trim(),
        type: form.type,
        description: form.description,
        achievementDate: form.achievementDate || undefined,
        coverImage: form.coverImage,
        isPublic: form.isPublic,
        enterpriseIds: form.enterpriseIds,
        projectIds: form.projectIds,
        secondaryColleges: form.secondaryColleges,
        citationReason: form.citationReason,
        ownerPersons: form.ownerPersons,
        coBuilders: form.coBuilders,
        attachments: form.attachments,
      });
      ElMessage.success('成果已更新');
      router.push(`/portal/apps/alliance/achievements/${id}`);
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function onCancel() {
  if (isNew.value) {
    router.push('/portal/apps/alliance/achievements');
  } else if (id) {
    router.push(`/portal/apps/alliance/achievements/${id}`);
  } else {
    router.back();
  }
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      // 忽略
    }
  }
  await Promise.all([loadOptions(), load()]);
});
</script>

<style scoped>
.edit-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-header-left { display: flex; align-items: center; gap: 8px; }
.card-title { font-size: 16px; font-weight: 600; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin: 16px 0 12px; }
.side-card { margin-top: 16px; }
</style>

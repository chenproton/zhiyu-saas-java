<template>
  <div class="edit-page">
    <!-- 加载失败禁止以默认值渲染可保存表单（对齐 React EmptyState「协议不存在」），
         否则用户填写保存会用默认值整条覆盖真实协议，造成数据丢失 -->
    <el-card v-if="notFound" shadow="never">
      <el-empty description="协议不存在">
        <el-button @click="router.push('/portal/apps/alliance/agreements')">返回列表</el-button>
      </el-empty>
    </el-card>

    <el-row v-else :gutter="16">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <div class="card-header-left">
                <el-button text :icon="ArrowLeft" @click="router.back()">返回</el-button>
                <span class="card-title">{{ isNew ? '新建合作协议' : '编辑合作协议' }}</span>
              </div>
            </div>
          </template>

          <el-form v-loading="loading" :model="form" label-width="100px">
            <div class="section-title">基本信息</div>
            <el-form-item label="协议名称" required>
              <el-input v-model="form.name" placeholder="请输入协议名称" />
            </el-form-item>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="协议类型">
                  <el-select v-model="form.type" placeholder="请选择协议类型" style="width: 100%">
                    <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="协议状态">
                  <el-select v-model="form.status" style="width: 100%">
                    <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="生效日期" required>
                  <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="到期日期" required>
                  <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>

            <div class="section-title">协议概要</div>
            <el-form-item label-width="0">
              <el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入协议概要" />
            </el-form-item>
            <el-form-item label="前台展示">
              <el-switch v-model="form.isPublic" />
            </el-form-item>

            <div class="section-title">协议附件</div>
            <el-form-item label-width="0">
              <ImageUpload v-model="form.attachments" multiple label="附件" hint="上传附件图片（可多选）" />
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
          <template #header><span class="card-title">关联项目</span></template>
          <el-select v-model="form.projectIds" multiple filterable placeholder="选择关联项目（可选）" style="width: 100%">
            <el-option v-for="p in projects" :key="p.value" :label="p.label" :value="p.value" />
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
  allianceAgreementApi,
  listAllEnterprises,
  listAllProjects,
  fetchAllianceDict,
  mergeDictOptions,
  syncAgreementProjectLinks,
  type AllianceDictItem,
} from './crud-shared';
import ImageUpload from './components/ImageUpload.vue';

interface FormState {
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  content: string;
  isPublic: boolean;
  enterpriseIds: string[];
  projectIds: string[];
  attachments: string[];
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isNew = computed(() => !route.params.id);
const id = route.params.id as string | undefined;

const loading = ref(false);
const saving = ref(false);
const notFound = ref(false);
const typeItems = ref<AllianceDictItem[]>([]);
const statusItems = ref<AllianceDictItem[]>([]);
const enterprises = ref<{ label: string; value: string }[]>([]);
const projects = ref<{ label: string; value: string }[]>([]);

const form = reactive<FormState>({
  name: '',
  type: 'strategic',
  status: 'draft',
  startDate: '',
  endDate: '',
  content: '',
  isPublic: false,
  enterpriseIds: route.query.enterpriseId ? [String(route.query.enterpriseId)] : [],
  projectIds: route.query.projectId ? [String(route.query.projectId)] : [],
  attachments: [],
});

const typeOptions = computed(() => mergeDictOptions(typeItems.value, form.type));
const statusOptions = computed(() => mergeDictOptions(statusItems.value, form.status));

function fillForm(a: {
  name?: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  content?: string;
  isPublic?: boolean;
  enterpriseIds?: string[];
  projectIds?: string[];
  attachments?: string[];
}) {
  form.name = a.name || '';
  form.type = a.type || 'strategic';
  form.status = a.status || 'draft';
  form.startDate = a.startDate || '';
  form.endDate = a.endDate || '';
  form.content = a.content || '';
  form.isPublic = !!a.isPublic;
  form.enterpriseIds = a.enterpriseIds || [];
  form.projectIds = a.projectIds || [];
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
  typeItems.value = await fetchAllianceDict('agreement_type');
  statusItems.value = await fetchAllianceDict('agreement_status');
}

async function load() {
  if (!isNew.value && id) {
    loading.value = true;
    try {
      const a = await allianceAgreementApi.get(id);
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
  if (!form.name.trim()) {
    // 新建对齐 React new 页文案「协议名称不能为空」，编辑对齐 React edit 页「请填写协议名称」
    ElMessage.warning(isNew.value ? '协议名称不能为空' : '请填写协议名称');
    return;
  }
  // 日期必填仅在新建校验（对齐 React：new 页拦截，edit 页不拦截，避免存量空日期协议无法保存）
  if (isNew.value && (!form.startDate || !form.endDate)) {
    ElMessage.warning('生效日期与到期日期必填');
    return;
  }
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    ElMessage.warning('到期日期不能早于生效日期');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      startDate: form.startDate,
      endDate: form.endDate,
      content: form.content,
      isPublic: form.isPublic,
      enterpriseIds: form.enterpriseIds,
      projectIds: form.projectIds,
      attachments: form.attachments,
    };
    const isCreate = isNew.value;
    let agreementId: string;
    if (isCreate) {
      const data = await allianceAgreementApi.create(payload);
      agreementId = data.id;
    } else {
      agreementId = id as string;
      await allianceAgreementApi.update(agreementId, payload);
    }
    try {
      // 双向同步：协议.project_ids ↔ 项目.agreement_ids
      await syncAgreementProjectLinks(agreementId, form.projectIds);
    } catch {
      // 协议已保存成功，仅关联同步失败：单独提示，避免误报「保存失败」诱导重复提交
      ElMessage.error(isCreate ? '协议已创建，但项目关联同步失败' : '协议已保存，但项目关联同步失败');
      router.push(`/portal/apps/alliance/agreements/${agreementId}`);
      return;
    }
    ElMessage.success(isCreate ? '协议已创建' : '协议已更新');
    router.push(`/portal/apps/alliance/agreements/${agreementId}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function onCancel() {
  if (isNew.value) {
    router.push('/portal/apps/alliance/agreements');
  } else if (id) {
    router.push(`/portal/apps/alliance/agreements/${id}`);
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

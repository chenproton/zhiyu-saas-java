<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ isNew ? '新建岗位' : '编辑岗位' }}</span>
          <div>
            <el-button @click="onBack">返回</el-button>
            <el-button type="primary" :loading="saving" @click="onSaveDraft">保存草稿</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" v-loading="loading">
        <!-- 基本信息 -->
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="form" label-width="90px" class="basic-form">
            <el-form-item label="名称">
              <el-input v-model="form.name" placeholder="岗位名称" />
            </el-form-item>
            <el-form-item label="简称">
              <el-input v-model="form.shortName" placeholder="岗位简称" />
            </el-form-item>
            <el-form-item label="类型">
              <el-select v-model="form.positionType" style="width: 200px">
                <el-option label="企业岗位" value="enterprise" />
                <el-option label="教学岗位" value="teaching" />
              </el-select>
            </el-form-item>
            <el-form-item label="所属行业">
              <el-select v-model="form.industryId" style="width: 100%" placeholder="选择行业">
                <el-option v-for="i in industries" :key="i.id" :label="i.name" :value="i.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="适用专业">
              <el-select v-model="form.majorIds" multiple style="width: 100%" placeholder="选择专业">
                <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="批次">
              <el-select v-model="form.batchId" clearable style="width: 100%" placeholder="选择批次">
                <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="共建人">
              <el-select v-model="form.collaborators" multiple filterable style="width: 100%" placeholder="选择共建人">
                <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="薪资范围">
              <div class="salary-row">
                <el-input-number v-model="form.salaryMin" :min="0" placeholder="最低" />
                <span class="sep">-</span>
                <el-input-number v-model="form.salaryMax" :min="0" placeholder="最高" />
              </div>
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="form.description" type="textarea" :rows="3" placeholder="岗位描述" />
            </el-form-item>
            <el-form-item label="任职要求">
              <el-input v-model="form.requirementsText" type="textarea" :rows="4" placeholder="每行一条要求" />
            </el-form-item>
            <el-form-item label="发展路径">
              <el-input v-model="form.careerPath" type="textarea" :rows="2" placeholder="职业发展路径" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 岗位职责 -->
        <el-tab-pane label="岗位职责" name="responsibilities">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="openRespDialog()">新增职责</el-button>
          </div>
          <el-table :data="responsibilities" stripe>
            <el-table-column prop="name" label="职责名称" min-width="200" />
            <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button size="small" @click="openRespDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="removeResp(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 证书 -->
        <el-tab-pane label="证书" name="certificates">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="openCertDialog()">新增证书</el-button>
          </div>
          <el-table :data="certificates" stripe>
            <el-table-column prop="name" label="证书名称" min-width="160" />
            <el-table-column prop="url" label="链接" min-width="180" show-overflow-tooltip />
            <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button size="small" @click="openCertDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="removeCert(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 能力绑定 -->
        <el-tab-pane label="能力绑定" name="bindings">
          <div class="tab-toolbar">
            <el-button type="primary" size="small" @click="openBindingDialog()">新增绑定</el-button>
          </div>
          <el-table :data="bindings" stripe>
            <el-table-column label="职责" min-width="160">
              <template #default="{ row }">{{ respName(row.responsibilityId) }}</template>
            </el-table-column>
            <el-table-column label="能力点" min-width="160">
              <template #default="{ row }">{{ row.abilityName || abilityName(row.abilityPointId) }}</template>
            </el-table-column>
            <el-table-column prop="requiredLevel" label="等级" width="100" />
            <el-table-column prop="rubricDescription" label="量规" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" type="danger" @click="removeBinding(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 职责弹窗 -->
    <el-dialog v-model="respDialog" :title="editingResp ? '编辑职责' : '新增职责'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="respForm.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="respForm.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="respDialog = false">取消</el-button>
        <el-button type="primary" @click="saveResp">保存</el-button>
      </template>
    </el-dialog>

    <!-- 证书弹窗 -->
    <el-dialog v-model="certDialog" :title="editingCert ? '编辑证书' : '新增证书'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="certForm.name" /></el-form-item>
        <el-form-item label="链接"><el-input v-model="certForm.url" placeholder="https://..." /></el-form-item>
        <el-form-item label="描述"><el-input v-model="certForm.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="certDialog = false">取消</el-button>
        <el-button type="primary" @click="saveCert">保存</el-button>
      </template>
    </el-dialog>

    <!-- 能力绑定弹窗 -->
    <el-dialog v-model="bindingDialog" title="新增能力绑定" width="480px">
      <el-form label-width="90px">
        <el-form-item label="职责">
          <el-select v-model="bindingForm.responsibilityId" style="width: 100%">
            <el-option v-for="r in responsibilities" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="能力点">
          <el-select v-model="bindingForm.abilityPointId" filterable style="width: 100%">
            <el-option v-for="a in abilities" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="等级"><el-input v-model="bindingForm.requiredLevel" placeholder="如 L1/L2" /></el-form-item>
        <el-form-item label="量规"><el-input v-model="bindingForm.rubricDescription" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindingDialog = false">取消</el-button>
        <el-button type="primary" @click="saveBinding">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { positionApi, positionResponsibilityApi, positionCertificateApi, abilityApi, batchApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import type {
  CareerPosition,
  PositionResponsibility,
  PositionCertificate,
  AbilityPoint,
  PositionAbilityBinding
} from '@/types/job';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';

const loading = ref(false);
const saving = ref(false);
const activeTab = ref('basic');

const form = reactive({
  name: '',
  shortName: '',
  positionType: 'enterprise' as CareerPosition['positionType'],
  industryId: '',
  majorIds: [] as string[],
  batchId: '',
  collaborators: [] as string[],
  salaryMin: undefined as number | undefined,
  salaryMax: undefined as number | undefined,
  description: '',
  requirementsText: '',
  careerPath: '',
  version: '1.0'
});

const responsibilities = ref<PositionResponsibility[]>([]);
const certificates = ref<PositionCertificate[]>([]);
const bindings = ref<PositionAbilityBinding[]>([]);
const abilities = ref<AbilityPoint[]>([]);
const industries = ref<{ id: string; name: string }[]>([]);
const majors = ref<{ id: string; name: string }[]>([]);
const batches = ref<{ id: string; name: string }[]>([]);
const users = ref<{ id: string; name: string }[]>([]);

const respDialog = ref(false);
const editingResp = ref<PositionResponsibility | null>(null);
const respForm = reactive({ name: '', description: '' });

const certDialog = ref(false);
const editingCert = ref<PositionCertificate | null>(null);
const certForm = reactive({ name: '', url: '', description: '' });

const bindingDialog = ref(false);
const bindingForm = reactive({ responsibilityId: '', abilityPointId: '', requiredLevel: '', rubricDescription: '' });

async function loadAll() {
  loading.value = true;
  try {
    const [pos, respRes, certRes, bindingRes, abilityRes, indRes, majorRes, batchRes, userRes] = await Promise.all([
      positionApi.get(id),
      positionResponsibilityApi.list({ careerPositionId: id, limit: 1000 }),
      positionCertificateApi.list({ careerPositionId: id, limit: 1000 }),
      abilityApi.listBindings({ careerPositionId: id }),
      abilityApi.list({ limit: 1000 }),
      industryApi.list({ limit: 500 }),
      majorApi.list({ limit: 500 }),
      batchApi.list({ limit: 200 }),
      userManagementApi.list({ limit: 1000 })
    ]);
    form.name = pos.name;
    form.shortName = pos.shortName || '';
    form.positionType = pos.positionType;
    form.industryId = pos.industryId || '';
    form.majorIds = pos.majorIds || [];
    form.batchId = pos.batchId || '';
    form.collaborators = pos.collaborators || [];
    form.salaryMin = pos.salaryMin;
    form.salaryMax = pos.salaryMax;
    form.description = pos.description || '';
    form.requirementsText = (pos.requirements || []).join('\n');
    form.careerPath = pos.careerPath || '';
    form.version = pos.version || '1.0';
    responsibilities.value = respRes.items;
    certificates.value = certRes.items;
    bindings.value = bindingRes.items;
    abilities.value = abilityRes.items;
    industries.value = indRes.items;
    majors.value = majorRes.items;
    batches.value = batchRes.items;
    users.value = userRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function respName(id: string) {
  return responsibilities.value.find((r) => r.id === id)?.name || id;
}
function abilityName(id: string) {
  return abilities.value.find((a) => a.id === id)?.name || id;
}

// 职责
function openRespDialog(row?: PositionResponsibility) {
  editingResp.value = row || null;
  respForm.name = row?.name || '';
  respForm.description = row?.description || '';
  respDialog.value = true;
}
function saveResp() {
  if (!respForm.name.trim()) {
    ElMessage.warning('职责名称不能为空');
    return;
  }
  if (editingResp.value) {
    Object.assign(editingResp.value, { name: respForm.name.trim(), description: respForm.description.trim() });
  } else {
    responsibilities.value.push({
      id: `resp-${Date.now()}`,
      careerPositionId: id,
      name: respForm.name.trim(),
      description: respForm.description.trim(),
      sortOrder: responsibilities.value.length
    });
  }
  respDialog.value = false;
}
function removeResp(row: PositionResponsibility) {
  responsibilities.value = responsibilities.value.filter((r) => r.id !== row.id);
}

// 证书
function openCertDialog(row?: PositionCertificate) {
  editingCert.value = row || null;
  certForm.name = row?.name || '';
  certForm.url = row?.url || '';
  certForm.description = row?.description || '';
  certDialog.value = true;
}
function saveCert() {
  if (!certForm.name.trim()) {
    ElMessage.warning('证书名称不能为空');
    return;
  }
  if (editingCert.value) {
    Object.assign(editingCert.value, { name: certForm.name.trim(), url: certForm.url.trim(), description: certForm.description.trim() });
  } else {
    certificates.value.push({
      id: `cert-${Date.now()}`,
      careerPositionId: id,
      certificateLibraryId: '',
      name: certForm.name.trim(),
      url: certForm.url.trim() || undefined,
      description: certForm.description.trim() || undefined
    });
  }
  certDialog.value = false;
}
function removeCert(row: PositionCertificate) {
  certificates.value = certificates.value.filter((c) => c.id !== row.id);
}

// 能力绑定
function openBindingDialog() {
  bindingForm.responsibilityId = '';
  bindingForm.abilityPointId = '';
  bindingForm.requiredLevel = '';
  bindingForm.rubricDescription = '';
  bindingDialog.value = true;
}
function saveBinding() {
  if (!bindingForm.responsibilityId || !bindingForm.abilityPointId) {
    ElMessage.warning('请选择职责和能力点');
    return;
  }
  bindings.value.push({
    id: `binding-${Date.now()}`,
    careerPositionId: id,
    responsibilityId: bindingForm.responsibilityId,
    abilityPointId: bindingForm.abilityPointId,
    abilityName: abilityName(bindingForm.abilityPointId),
    source: 'public',
    requiredLevel: bindingForm.requiredLevel,
    rubricDescription: bindingForm.rubricDescription,
    attributes: [],
    weight: 0
  });
  bindingDialog.value = false;
}
function removeBinding(row: PositionAbilityBinding) {
  bindings.value = bindings.value.filter((b) => b.id !== row.id);
}

async function onSaveDraft() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const requirements = form.requirementsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    await positionApi.saveFull(id, {
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      industry: form.industryId || undefined,
      majors: form.majorIds,
      positionType: form.positionType,
      salaryRange: [form.salaryMin ?? 0, form.salaryMax ?? 0],
      batchId: form.batchId || undefined,
      description: form.description.trim(),
      requirements,
      careerPath: form.careerPath.trim(),
      version: form.version,
      collaborators: form.collaborators,
      responsibilities: responsibilities.value.map((r) => ({ id: r.id, name: r.name, description: r.description })),
      certificates: certificates.value.map((c) => ({ id: c.id, name: c.name, url: c.url, description: c.description })),
      abilityBindings: bindings.value.map((b) => ({
        id: b.id,
        responsibilityId: b.responsibilityId,
        abilityPointId: b.abilityPointId,
        name: b.abilityName || '',
        level: b.requiredLevel,
        rubricDescription: b.rubricDescription
      })),
      abilityDomains: []
    });
    ElMessage.success('草稿已保存');
    router.push('/job/positions');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function onBack() {
  router.push('/job/positions');
}

onMounted(loadAll);
</script>

<style scoped>
.edit-page {
  padding: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.basic-form {
  max-width: 640px;
}
.tab-toolbar {
  margin-bottom: 12px;
}
.salary-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sep {
  color: #909399;
}
</style>

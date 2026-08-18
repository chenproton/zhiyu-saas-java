<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ isNew ? '新建共建岗位' : '编辑共建岗位' }}</div>
            <div class="card-sub">保存后状态回写为草稿，发布由学校端进行（含学校授权资源）。</div>
          </div>
          <div class="header-actions">
            <el-tag v-if="position" :type="statusTagType(meta.status)">{{ contentStatusLabel(meta.status) }}</el-tag>
            <el-button @click="onBack">返回</el-button>
            <el-button type="primary" :loading="saving" :disabled="!detailsLoaded" @click="onSave">
              {{ saving ? '保存中...' : '保存' }}
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" v-loading="loading">
        <!-- 基本信息 -->
        <el-tab-pane label="基本信息" name="basic">
          <div class="basic-layout">
            <el-form :model="form" label-width="90px" class="basic-form">
              <el-form-item label="名称" required>
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

            <div class="side-card">
              <div class="side-block">
                <div class="side-label">岗位封面</div>
                <div class="cover-uploader">
                  <div v-if="form.coverImage" class="cover-preview">
                    <img :src="form.coverImage" alt="岗位封面" />
                    <el-button size="small" type="danger" :loading="coverUploading" @click="form.coverImage = ''">
                      移除
                    </el-button>
                  </div>
                  <div v-else class="cover-placeholder" @click="triggerFile">
                    {{ coverUploading ? '上传中...' : '点击上传封面' }}
                  </div>
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    style="display: none"
                    @change="onFileChange"
                  />
                </div>
              </div>

              <div class="side-block">
                <div class="side-label">合作学校</div>
                <div class="side-value">{{ meta.schoolName || '-' }}</div>
              </div>

              <div class="side-block">
                <div class="side-label">创建人</div>
                <div class="side-value">{{ meta.createdByName || '当前用户' }}</div>
              </div>

              <div class="side-block">
                <div class="side-label">共建人</div>
                <el-select
                  v-model="collaborators"
                  multiple
                  filterable
                  clearable
                  placeholder="点击选择共建人"
                  style="width: 100%"
                >
                  <el-option
                    v-for="u in coBuilders"
                    :key="u.id"
                    :label="u.group === 'expert' ? `${u.name}（企业专家）` : u.name"
                    :value="u.id"
                  />
                </el-select>
              </div>

              <div class="side-block">
                <div class="side-label">当前版本号</div>
                <div class="side-value">{{ form.version }}</div>
              </div>
            </div>
          </div>
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
import { partnerRequest, authedFetch } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { partnerCobuildPositionApi } from '@/api/partner';
import type { CoBuildPosition } from '@/types/partner';
import type {
  PositionResponsibility,
  PositionCertificate,
  AbilityPoint,
  PositionAbilityBinding,
  AbilityDomain
} from '@/types/job';
import { contentStatusLabel } from '@/types/content-status';

interface CoBuildUserOption {
  id: string;
  name: string;
  group: 'teacher' | 'expert';
  title?: string;
  expertId?: string;
  enterpriseName?: string;
}

// 以下端点 Vue api/partner.ts 尚未收录，按 React 前端 /partner/co-build/* 路径直连（禁止改 api/*.ts）
function saveFull(id: string, req: Record<string, unknown>) {
  return partnerRequest<CoBuildPosition>(`/partner/co-build/positions/${id}/save-full`, {
    method: 'POST',
    body: JSON.stringify(req)
  });
}
function listResponsibilities(id: string) {
  return partnerRequest<ListResponse<PositionResponsibility>>(
    `/partner/co-build/positions/${id}/responsibilities`
  );
}
function listCertificates(id: string) {
  return partnerRequest<ListResponse<PositionCertificate>>(
    `/partner/co-build/positions/${id}/certificates`
  );
}
function listAbilityBindings(id: string) {
  return partnerRequest<ListResponse<PositionAbilityBinding>>(
    `/partner/co-build/positions/${id}/ability-bindings`
  );
}
function listAbilityDomains(id: string) {
  return partnerRequest<ListResponse<AbilityDomain>>(
    `/partner/co-build/positions/${id}/ability-domains`
  );
}
function schoolAbilities(tenantId: string) {
  return partnerRequest<ListResponse<AbilityPoint>>(
    `/partner/co-build/schools/${tenantId}/abilities`
  );
}
function schoolCoBuilders(tenantId: string) {
  return partnerRequest<ListResponse<CoBuildUserOption>>(
    `/partner/co-build/schools/${tenantId}/co-builders`
  );
}
async function uploadCover(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await authedFetch('/files/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';
const hasSaved = ref(false);

const loading = ref(false);
const detailsLoading = ref(false);
const detailsLoaded = ref(false);
const saving = ref(false);
const coverUploading = ref(false);
const activeTab = ref('basic');
const fileInput = ref<HTMLInputElement | null>(null);

const position = ref<CoBuildPosition | null>(null);

const form = reactive({
  name: '',
  shortName: '',
  positionType: 'enterprise' as CoBuildPosition['positionType'],
  salaryMin: undefined as number | undefined,
  salaryMax: undefined as number | undefined,
  description: '',
  requirementsText: '',
  careerPath: '',
  version: '1.0',
  coverImage: ''
});

const meta = reactive({
  schoolTenantId: '',
  schoolName: '',
  status: 'draft',
  createdByName: ''
});

const collaborators = ref<string[]>([]);
const responsibilities = ref<PositionResponsibility[]>([]);
const certificates = ref<PositionCertificate[]>([]);
const bindings = ref<PositionAbilityBinding[]>([]);
const abilityDomains = ref<AbilityDomain[]>([]);
const abilities = ref<AbilityPoint[]>([]);
const coBuilders = ref<CoBuildUserOption[]>([]);

const respDialog = ref(false);
const editingResp = ref<PositionResponsibility | null>(null);
const respForm = reactive({ name: '', description: '' });

const certDialog = ref(false);
const editingCert = ref<PositionCertificate | null>(null);
const certForm = reactive({ name: '', url: '', description: '' });

const bindingDialog = ref(false);
const bindingForm = reactive({ responsibilityId: '', abilityPointId: '', requiredLevel: '', rubricDescription: '' });

function statusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'published' || s === 'approved') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'danger';
  return 'info';
}

async function loadAll() {
  loading.value = true;
  try {
    const pos = await partnerCobuildPositionApi.get(id);
    position.value = pos;
    form.name = pos.name || '';
    form.shortName = pos.shortName || '';
    form.positionType = pos.positionType || 'enterprise';
    form.salaryMin = pos.salaryMin;
    form.salaryMax = pos.salaryMax;
    form.description = pos.description || '';
    form.requirementsText = (pos.requirements || []).join('\n');
    form.careerPath = pos.careerPath || '';
    form.version = pos.version || '1.0';
    form.coverImage = pos.coverImage || '';
    meta.schoolTenantId = pos.schoolTenantId || '';
    meta.schoolName = pos.schoolName || '';
    meta.status = pos.status || 'draft';
    meta.createdByName = pos.createdByName || '';
    collaborators.value = (pos.collaborators || []).filter((c) => c !== pos.createdBy);
    await loadDetails();
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadDetails() {
  detailsLoading.value = true;
  try {
    const [respRes, certRes, bindingRes, domainRes] = await Promise.all([
      listResponsibilities(id),
      listCertificates(id),
      listAbilityBindings(id),
      listAbilityDomains(id)
    ]);
    responsibilities.value = respRes.items || [];
    certificates.value = certRes.items || [];
    bindings.value = bindingRes.items || [];
    abilityDomains.value = domainRes.items || [];

    if (meta.schoolTenantId) {
      const [abilityRes, coBuilderRes] = await Promise.all([
        schoolAbilities(meta.schoolTenantId),
        schoolCoBuilders(meta.schoolTenantId)
      ]);
      abilities.value = abilityRes.items || [];
      coBuilders.value = coBuilderRes.items || [];
    }
    detailsLoaded.value = true;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载详情失败');
  } finally {
    detailsLoading.value = false;
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
    Object.assign(editingCert.value, {
      name: certForm.name.trim(),
      url: certForm.url.trim(),
      description: certForm.description.trim()
    });
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

// 封面上传
function triggerFile() {
  fileInput.value?.click();
}
async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  coverUploading.value = true;
  try {
    form.coverImage = await uploadCover(file);
    ElMessage.success('封面上传成功');
  } catch (err) {
    ElMessage.error((err as Error).message || '封面上传失败');
  } finally {
    coverUploading.value = false;
    input.value = '';
  }
}

async function onSave() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  if (!detailsLoaded.value) {
    ElMessage.warning('详情加载中，请稍候');
    return;
  }
  saving.value = true;
  try {
    const requirements = form.requirementsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    await saveFull(id, {
      batchId: position.value?.batchId || '',
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      industry: position.value?.industryId || '',
      majors: position.value?.majorIds || [],
      positionType: form.positionType,
      salaryRange: [form.salaryMin ?? 0, form.salaryMax ?? 0],
      coverImage: form.coverImage || undefined,
      description: form.description.trim() || undefined,
      requirements,
      careerPath: form.careerPath.trim() || undefined,
      version: form.version,
      collaborators: collaborators.value,
      responsibilities: responsibilities.value.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description
      })),
      certificates: certificates.value.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        description: c.description
      })),
      abilityBindings: bindings.value.map((b) => ({
        id: b.id,
        responsibilityId: b.responsibilityId,
        abilityPointId: b.abilityPointId,
        name: b.abilityName || '',
        level: b.requiredLevel,
        rubricDescription: b.rubricDescription
      })),
      abilityDomains: abilityDomains.value.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        bindingIds: d.bindingIds
      }))
    });
    hasSaved.value = true;
    ElMessage.success('已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onBack() {
  if (isNew && !hasSaved.value) {
    try {
      await partnerCobuildPositionApi.delete(id);
    } catch {
      // 忽略删除未保存草稿的失败
    }
  }
  router.push('/partner/co-build/positions');
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
.card-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.basic-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.basic-form {
  flex: 1;
  max-width: 640px;
}
.side-card {
  width: 320px;
  border-left: 1px solid #ebeef5;
  padding-left: 24px;
}
.side-block {
  margin-bottom: 20px;
}
.side-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.side-value {
  font-weight: 500;
  color: #303133;
}
.cover-uploader {
  width: 100%;
}
.cover-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cover-preview img {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}
.cover-placeholder {
  height: 120px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  cursor: pointer;
}
.cover-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
}
.salary-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sep {
  color: #909399;
}
.tab-toolbar {
  margin-bottom: 12px;
}
</style>

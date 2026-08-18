<template>
  <div class="edit-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ isNew ? '新建共建场景' : '编辑共建场景' }}</div>
            <div class="card-sub">填写场景基础信息，保存后状态回写为草稿，发布由学校端进行。</div>
          </div>
          <div class="header-actions">
            <el-tag v-if="!dataLoading" :type="statusTagType(scenarioStatus)">{{ contentStatusLabel(scenarioStatus) }}</el-tag>
            <el-button @click="onBack">返回</el-button>
            <el-button type="primary" :loading="saving" :disabled="!scenarioName.trim()" @click="onSaveDraft">
              {{ saving ? '保存中...' : '保存' }}
            </el-button>
          </div>
        </div>
      </template>

      <div v-loading="dataLoading" class="edit-body">
        <el-empty v-if="loadFailed" description="加载失败，请刷新重试">
          <el-button type="primary" @click="loadData">重新加载</el-button>
        </el-empty>

        <div v-else class="layout">
          <div class="main">
            <el-card shadow="never">
              <el-form label-width="120px" class="basic-form">
                <el-form-item label="场景名称" required>
                  <el-input v-model="scenarioName" placeholder="请输入场景名称" />
                </el-form-item>

                <el-form-item v-if="industryNames.length > 0 || professionNames.length > 0" label="面向行业/适用专业">
                  <span class="readonly-text">{{ [...industryNames, ...professionNames].join('、') || '-' }}</span>
                </el-form-item>

                <el-form-item label="难度等级">
                  <div class="difficulty-row">
                    <el-rate v-model="difficulty" :max="5" />
                    <span class="difficulty-label">{{ difficultyLabel(difficulty) }}</span>
                  </div>
                </el-form-item>

                <el-form-item label="场景介绍">
                  <el-input
                    v-model="background"
                    type="textarea"
                    :rows="6"
                    placeholder="描述该场景的背景、意义和学习目标..."
                  />
                </el-form-item>
              </el-form>
            </el-card>
          </div>

          <div class="side">
            <el-card shadow="never">
              <div class="side-block">
                <div class="side-label">场景封面</div>
                <div class="cover-uploader">
                  <div v-if="coverImage" class="cover-preview">
                    <img :src="coverImage" alt="场景封面" />
                    <el-button size="small" type="danger" :loading="coverUploading" @click="coverImage = ''">
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
                <div class="side-label">目标岗位</div>
                <el-select v-model="positionId" clearable placeholder="请选择岗位" style="width: 100%">
                  <el-option v-for="p in coBuildPositions" :key="p.id" :label="p.name" :value="p.id" />
                </el-select>
                <div class="side-hint">仅可选择本企业为该学校共建的岗位</div>
              </div>

              <div class="side-block">
                <div class="side-label">当前状态</div>
                <el-tag :type="statusTagType(scenarioStatus)">{{ contentStatusLabel(scenarioStatus) }}</el-tag>
              </div>

              <div class="side-block">
                <div class="side-label">创建人</div>
                <div class="side-value">{{ creatorName || '当前用户' }}</div>
              </div>

              <div class="side-block">
                <div class="side-label">共建人/共建部门</div>
                <el-select
                  v-model="coBuilderIds"
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
                <div class="side-value">{{ version }}</div>
              </div>
            </el-card>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { partnerRequest, authedFetch } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { partnerCobuildScenarioApi, partnerCobuildPositionApi } from '@/api/partner';
import type { CoBuildScenario, CoBuildPosition } from '@/types/partner';
import { contentStatusLabel } from '@/types/content-status';

interface CoBuildUserOption {
  id: string;
  name: string;
  group: 'teacher' | 'expert';
  title?: string;
  expertId?: string;
  enterpriseName?: string;
}

// 共建人候选端点 Vue api/partner.ts 尚未收录，按 React /partner/co-build/schools/{tenantId}/co-builders 直连
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

const dataLoading = ref(false);
const loadFailed = ref(false);
const saving = ref(false);
const coverUploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const coBuildPositions = ref<CoBuildPosition[]>([]);
const coBuilders = ref<CoBuildUserOption[]>([]);
const schoolTenantId = ref('');
const creatorId = ref('');

const scenarioName = ref('');
const positionId = ref('');
const difficulty = ref(3);
const background = ref('');
const creatorName = ref('');
const version = ref('V1.0');
const coverImage = ref('');
const scenarioStatus = ref('draft');
const industryNames = ref<string[]>([]);
const professionNames = ref<string[]>([]);
const coBuilderIds = ref<string[]>([]);

function statusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'published' || s === 'approved') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'danger';
  return 'info';
}

function difficultyLabel(level: number): string {
  const map: Record<number, string> = { 1: '入门', 2: '基础', 3: '中级', 4: '高级', 5: '专家' };
  return map[level] || String(level);
}

async function loadData() {
  dataLoading.value = true;
  loadFailed.value = false;
  try {
    const scenario = await partnerCobuildScenarioApi.get(id) as CoBuildScenario & { tenantId?: string };
    const tenantId = scenario.schoolTenantId || scenario.tenantId || '';
    schoolTenantId.value = tenantId;
    creatorId.value = scenario.creatorId || '';

    // 目标岗位下拉：仅本企业在该学校的共建岗位
    if (tenantId) {
      const [posRes, coBuilderRes] = await Promise.all([
        partnerCobuildPositionApi.list({ schoolTenantId: tenantId, limit: 200 }),
        schoolCoBuilders(tenantId)
      ]);
      coBuildPositions.value = posRes.items || [];
      coBuilders.value = coBuilderRes.items || [];
    }

    scenarioName.value = scenario.name || '';
    positionId.value = scenario.careerPositionId || '';
    difficulty.value = scenario.difficulty || 3;
    background.value = scenario.background || '';
    creatorName.value = scenario.creatorName || '';
    version.value = scenario.version || 'V1.0';
    coverImage.value = scenario.coverImage || '';
    scenarioStatus.value = scenario.status || 'draft';
    industryNames.value = scenario.industryNames || [];
    professionNames.value = scenario.professionNames || [];
    coBuilderIds.value = (scenario.coBuilderIds || []).filter((c) => c !== scenario.creatorId);
  } catch (e) {
    loadFailed.value = true;
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    dataLoading.value = false;
  }
}

function triggerFile() {
  fileInput.value?.click();
}
async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  coverUploading.value = true;
  try {
    coverImage.value = await uploadCover(file);
    ElMessage.success('封面上传成功');
  } catch (err) {
    ElMessage.error((err as Error).message || '封面上传失败');
  } finally {
    coverUploading.value = false;
    input.value = '';
  }
}

async function onSaveDraft() {
  if (!scenarioName.value.trim()) {
    ElMessage.warning('场景名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const updated = await partnerCobuildScenarioApi.update(id, {
      name: scenarioName.value.trim(),
      careerPositionId: positionId.value || undefined,
      difficulty: difficulty.value,
      background: background.value || undefined,
      version: version.value,
      coverImage: coverImage.value || undefined,
      coBuilderIds: coBuilderIds.value
    });
    hasSaved.value = true;
    if (updated.status && updated.status !== scenarioStatus.value) {
      scenarioStatus.value = updated.status;
    }
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
      await partnerCobuildScenarioApi.delete(id);
    } catch {
      // 忽略删除未保存草稿的失败
    }
  }
  router.push('/partner/co-build/scenes');
}

onMounted(loadData);
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
.edit-body {
  min-height: 240px;
}
.layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.main {
  flex: 1;
}
.basic-form {
  max-width: 640px;
}
.readonly-text {
  color: #606266;
}
.difficulty-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.difficulty-label {
  font-size: 13px;
  color: #606266;
}
.side {
  width: 340px;
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
.side-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
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
</style>

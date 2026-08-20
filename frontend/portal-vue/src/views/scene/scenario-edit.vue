<template>
  <!-- 场景编辑页·基础信息（完整复刻原 React 版） -->
  <EditorShell
    back-text="取消"
    :step="1"
    step-label="基础信息编辑"
    :is-saving="isSaving"
    :save-disabled="!scenarioName"
    can-next
    :next-text="isSaving ? '保存中...' : '下一步'"
    :next-disabled="!scenarioName"
    title="编辑实践场景"
    subtitle="填写场景基础信息，完成后进入任务链配置"
    @back="handleBack"
    @save-draft="handleSaveDraft"
    @preview="isPreviewConfirmOpen = true"
    @next="handleProceed"
  >
    <div v-if="dataLoading" class="page-loading">
      <p class="loading-text">加载中...</p>
    </div>

    <div v-else class="basic-grid">
      <!-- 左侧：基础信息表单 -->
      <div class="basic-main">
        <el-card shadow="never" class="form-card">
          <el-form label-position="top" @submit.prevent>
            <el-form-item required class="form-row">
              <template #label>
                <span class="field-label">场景名称</span>
              </template>
              <div class="field-body">
                <el-input v-model="scenarioName" placeholder="请输入场景名称" />
              </div>
            </el-form-item>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item class="form-row">
                  <template #label>
                    <span class="field-label">面向行业</span>
                  </template>
                  <div class="field-body">
                    <el-select
                      v-model="industryIds"
                      multiple
                      filterable
                      collapse-tags
                      collapse-tags-tooltip
                      placeholder="选择行业"
                      style="width: 100%"
                    >
                      <el-option v-for="i in industries" :key="i.id" :label="i.name" :value="i.id" />
                    </el-select>
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item class="form-row">
                  <template #label>
                    <span class="field-label">适用专业</span>
                  </template>
                  <div class="field-body">
                    <el-select
                      v-model="professionIds"
                      multiple
                      filterable
                      collapse-tags
                      collapse-tags-tooltip
                      placeholder="选择适用专业"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="m in majors"
                        :key="m.id"
                        :label="m.code ? `${m.name} (${m.code})` : m.name"
                        :value="m.id"
                      />
                    </el-select>
                  </div>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item class="form-row">
              <template #label>
                <span class="field-label">难度等级</span>
              </template>
              <div class="field-body">
                <el-rate
                  v-model="difficulty"
                  :max="5"
                  :allow-half="false"
                  :texts="DIFFICULTY_TEXTS"
                  show-text
                  size="large"
                  void-color="#e5e7eb"
                  text-color="#6b7280"
                />
              </div>
            </el-form-item>

            <el-form-item class="form-row">
              <template #label>
                <span class="field-label">场景介绍</span>
              </template>
              <div class="field-body">
                <el-input
                  v-model="background"
                  type="textarea"
                  :rows="8"
                  resize="vertical"
                  placeholder="描述该场景的背景、意义和学习目标..."
                />
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </div>

      <!-- 右侧：封面 / 目标岗位 / 批次 / 创建人 / 共建人 / 版本号 -->
      <div class="basic-side">
        <el-card shadow="never" class="side-card">
          <CoverImageUpload
            :image-url="coverImage"
            :uploading="coverUploading"
            label="场景封面"
            alt="场景封面"
            @upload="handleCoverUpload"
            @remove="coverImage = ''"
          />
        </el-card>

        <el-card shadow="never" class="side-card">
          <div class="side-block">
            <div class="side-label side-label-strong">目标岗位</div>
            <el-select v-model="positionId" clearable placeholder="请选择岗位" style="width: 100%">
              <el-option-group v-for="g in positioningGroups" :key="g.label" :label="g.label">
                <el-option v-for="p in g.positions" :key="p.id" :label="p.name" :value="p.id" />
              </el-option-group>
            </el-select>
          </div>

          <div class="side-block">
            <div class="side-label side-label-strong">所属批次</div>
            <el-select v-model="batchId" clearable placeholder="请选择批次" style="width: 100%">
              <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
            </el-select>
          </div>

          <div class="side-block">
            <div class="side-label">创建人</div>
            <p class="side-value">{{ creatorName || '当前用户' }}</p>
          </div>

          <div class="side-block">
            <div class="side-label side-label-strong">共建人/共建部门</div>
            <UserSelector
              :model-value="coBuilderIds"
              multiple
              placeholder="点击选择共建人"
              :exclude-user-ids="creatorId ? [creatorId] : []"
              show-enterprise-experts
              @update:model-value="onCoBuildersChange"
            />
          </div>

          <div class="side-block side-block-divider">
            <div class="side-label">当前版本号</div>
            <p class="side-value">{{ version }}</p>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 预览前确认（对齐 React ConfirmDialog） -->
    <el-dialog v-model="isPreviewConfirmOpen" title="即将离开当前页面" width="420px">
      <p class="dialog-desc">请确认是否已经保存数据</p>
      <template #footer>
        <el-button @click="isPreviewConfirmOpen = false">取消</el-button>
        <el-button type="primary" @click="goPreview">跳转预览</el-button>
      </template>
    </el-dialog>
  </EditorShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { scenarioApi, sceneBatchApi } from '@/api/scene';
import { positionApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { fileApi } from '@/api/import-export';
import type { CareerPosition } from '@/types/job';
import type { Industry, Major } from '@/types/system';
import EditorShell from '../job/position-builder/EditorShell.vue';
import CoverImageUpload from '../job/position-builder/CoverImageUpload.vue';
import UserSelector from '../job/position-builder/UserSelector.vue';

/** 难度等级文案（1-5 星，对齐 React 星级右侧标签） */
const DIFFICULTY_TEXTS = ['入门', '基础', '中级', '高级', '专家'];

interface BatchOption {
  id: string;
  name: string;
}

const route = useRoute();
const router = useRouter();
const scenarioId = String(route.params.id ?? '');
const isNewScenario = route.query.new === 'true';
const hasSaved = ref(false);

const allPositions = ref<CareerPosition[]>([]);
const industries = ref<Industry[]>([]);
const majors = ref<Major[]>([]);
const batches = ref<BatchOption[]>([]);
const dataLoading = ref(true);
const isSaving = ref(false);

const scenarioName = ref('');
const positionId = ref('');
const professionIds = ref<string[]>([]);
const batchId = ref('');
const industryIds = ref<string[]>([]);
const difficulty = ref(3);
const background = ref('');
// 从后端回填真实创建人姓名；新建场景（无 creatorName）回退展示「当前用户」
const creatorName = ref('');
const creatorId = ref('');
const coBuilderIds = ref<string[]>([]);
const version = ref('V1.0');
const coverImage = ref('');
const coverUploading = ref(false);
const scenarioStatus = ref('draft');

const isPreviewConfirmOpen = ref(false);

// ===== 数据加载（并行拉取岗位/行业/批次/专业/场景详情） =====
async function loadData() {
  dataLoading.value = true;
  try {
    const [posRes, indRes, batchRes, majRes, scenario] = await Promise.all([
      positionApi.list({ limit: 1000 }),
      industryApi.list({ limit: 1000 }),
      sceneBatchApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 }),
      scenarioApi.get(scenarioId)
    ]);
    allPositions.value = posRes.items || [];
    industries.value = indRes.items || [];
    batches.value = ((batchRes.items || []) as BatchOption[]).map((b) => ({
      id: b.id,
      name: b.name
    }));
    majors.value = (majRes.items || []).filter((m) => m.enabled);

    scenarioName.value = scenario.name || '';
    positionId.value = scenario.careerPositionId || '';
    professionIds.value = scenario.professionIds || [];
    batchId.value = scenario.batchId || '';
    industryIds.value = scenario.industryIds || [];
    difficulty.value = scenario.difficulty || 3;
    background.value = scenario.background || '';
    creatorId.value = scenario.creatorId || '';
    creatorName.value = scenario.creatorName || '';
    coBuilderIds.value = (scenario.coBuilderIds || []).filter((uid) => uid !== scenario.creatorId);
    version.value = scenario.version || 'V1.0';
    coverImage.value = scenario.coverImage || '';
    scenarioStatus.value = scenario.status || 'draft';
  } catch (e) {
    console.error('[scenario-edit] 加载场景表单数据失败', e);
    ElMessage.error((e as Error).message || '请刷新页面重试');
  } finally {
    dataLoading.value = false;
  }
}

/** 岗位按所属行业分组（无行业归入「其他」，对齐 React positioningGroups） */
const positioningGroups = computed(() => {
  const map = new Map<string, { id: string; name: string }[]>();
  allPositions.value.forEach((p) => {
    const key = industries.value.find((i) => i.id === p.industryId)?.name || '其他';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ id: p.id, name: p.name });
  });
  const groups: { label: string; positions: { id: string; name: string }[] }[] = [];
  map.forEach((positions, label) => groups.push({ label, positions }));
  return groups;
});

function onCoBuildersChange(ids: string[]) {
  coBuilderIds.value = ids.filter((uid) => uid !== creatorId.value);
}

// ===== 保存 / 下一步 / 取消 / 预览 =====
function buildPayload() {
  return {
    name: scenarioName.value.trim(),
    careerPositionId: positionId.value || null,
    batchId: batchId.value || null,
    industryIds: industryIds.value.length > 0 ? industryIds.value : null,
    professionIds: professionIds.value.length > 0 ? professionIds.value : null,
    difficulty: difficulty.value,
    background: background.value || null,
    version: version.value,
    coBuilderIds: coBuilderIds.value,
    coverImage: coverImage.value || null
  };
}

/** 下一步：保存基础信息后进入任务链配置 */
async function handleProceed() {
  if (!scenarioName.value.trim()) return;
  isSaving.value = true;
  try {
    await scenarioApi.update(scenarioId, buildPayload() as never);
    hasSaved.value = true;
    ElMessage.success('保存成功');
    router.push(`/scene/scenarios/${scenarioId}/edit/tasks`);
  } catch (e) {
    ElMessage.error((e as Error).message || '请稍后重试');
  } finally {
    isSaving.value = false;
  }
}

/** 保存草稿：全量写入 + 非 draft 状态回写 draft；保存后停留当前页 */
async function handleSaveDraft() {
  if (!scenarioName.value.trim()) return;
  isSaving.value = true;
  try {
    await scenarioApi.update(scenarioId, buildPayload() as never);
    hasSaved.value = true;
    if (scenarioStatus.value !== 'draft') {
      await scenarioApi.saveDraft(scenarioId);
      scenarioStatus.value = 'draft';
    }
    ElMessage.success('草稿已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '请稍后重试');
  } finally {
    isSaving.value = false;
  }
}

/** 取消：新建（?new=true）且未保存过 → 先删除草稿再返回列表 */
async function handleBack() {
  if (isNewScenario && !hasSaved.value) {
    try {
      await scenarioApi.delete(scenarioId);
    } catch (e) {
      console.error('[scenario-edit] 删除未保存的场景草稿失败', e);
    }
  }
  router.push('/scene/scenarios');
}

function goPreview() {
  isPreviewConfirmOpen.value = false;
  router.push(`/scene/landing/${scenarioId}`);
}

async function handleCoverUpload(file: File) {
  coverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    coverImage.value = res.url;
    ElMessage.success('封面上传成功');
  } catch (e) {
    console.error('[scenario-edit] 上传封面失败', e);
    ElMessage.error((e as Error).message || '请稍后重试');
  } finally {
    coverUploading.value = false;
  }
}

onMounted(() => {
  void loadData();
});
</script>

<style scoped>
.page-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}
.loading-text {
  margin: 0;
  font-size: 14px;
  color: #909399;
}
.basic-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
  align-items: flex-start;
}
.basic-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.basic-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.side-card {
  border-radius: 10px;
}
.form-card {
  border-radius: 10px;
}
.form-row {
  margin-bottom: 18px;
}
.field-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  line-height: 1.4;
}
.field-body {
  width: 100%;
  border-radius: 6px;
}
.side-block {
  margin-bottom: 16px;
  border-radius: 6px;
}
.side-block:last-child {
  margin-bottom: 0;
}
.side-block-divider {
  padding-top: 14px;
  border-top: 1px solid #f0f2f5;
}
.side-label {
  margin-bottom: 6px;
  font-size: 12px;
  color: #909399;
}
.side-label-strong {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.side-value {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.dialog-desc {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #909399;
}
@media (max-width: 1200px) {
  .basic-grid {
    grid-template-columns: 1fr;
  }
}
</style>

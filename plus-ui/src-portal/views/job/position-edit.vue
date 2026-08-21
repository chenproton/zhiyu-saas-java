<template>
  <!-- 岗位编辑页（完整复刻原 React 版） -->
  <div v-if="loading" class="page-state">
    <el-icon class="is-loading" :size="32"><Loading /></el-icon>
  </div>
  <div v-else-if="!position" class="page-state">
    <p class="state-text">岗位不存在</p>
  </div>
  <EditorShell
    v-else
    back-text="取消"
    :step="currentStepIndex + 1"
    :step-label="currentStep.label"
    :is-saving="isSaving"
    :can-prev="canGoPrev"
    :can-next="canGoNext"
    submit-text="完成配置"
    :loading-text="detailsLoading ? '加载详情中' : ''"
    :title="position.name"
    @back="handleBack"
    @save-draft="handleSave"
    @preview="previewConfirmOpen = true"
    @prev="handlePrev"
    @next="handleNext"
    @submit="handleFinish"
  >
    <!-- 步骤一：基础信息（左表单 + 右侧栏） -->
    <div v-if="activeStep === 'basic'" class="basic-grid">
      <div class="basic-main">
        <StepBasicInfo :position="position" hide-position-type @update="updatePositionData" />
      </div>

      <div class="basic-side">
        <el-card shadow="never" class="side-card">
          <CoverImageUpload
            :image-url="position.coverImage || ''"
            :uploading="coverUploading"
            label="岗位封面"
            alt="岗位封面"
            @upload="handleCoverUpload"
            @remove="updatePositionData({ coverImage: '' })"
          />
        </el-card>

        <el-card shadow="never" class="side-card">
          <div class="side-block">
            <div class="side-label">所属批次</div>
            <el-select
              :model-value="position.batchId || ''"
              placeholder="请选择批次"
              style="width: 100%"
              @update:model-value="(v: string) => updatePositionData({ batchId: v })"
            >
              <el-option label="未选择批次" value="" />
              <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
            </el-select>
          </div>

          <div class="side-block">
            <div class="side-label">创建人</div>
            <p class="side-value">{{ currentUserName || '-' }}</p>
          </div>

          <div class="side-block">
            <div class="side-label">共建人</div>
            <UserSelector
              :model-value="collaboratorIds"
              multiple
              placeholder="点击选择共建人"
              :exclude-user-ids="position.createdBy ? [position.createdBy] : []"
              show-enterprise-experts
              @update:model-value="onCollaboratorsChange"
            />
          </div>

          <div class="side-block side-block-divider">
            <div class="side-label">当前版本号</div>
            <p class="side-value">{{ position.version }}</p>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 步骤二 / 步骤三 -->
    <div v-else class="step-body">
      <StepAbilityModeling
        v-if="activeStep === 'ability'"
        :position="position"
        @update="updatePositionData"
      />
      <StepResultTable
        v-else-if="activeStep === 'competency'"
        :position="position"
        @update="updatePositionData"
      />
    </div>

    <!-- 预览前确认（对齐 React ConfirmDialog） -->
    <el-dialog v-model="previewConfirmOpen" title="即将离开当前页面" width="420px">
      <p class="dialog-desc">请确认是否已经保存数据</p>
      <template #footer>
        <el-button @click="previewConfirmOpen = false">取消</el-button>
        <el-button type="primary" @click="goPreview">跳转预览</el-button>
      </template>
    </el-dialog>
  </EditorShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import {
  abilityApi,
  batchApi,
  positionApi,
  positionCertificateApi,
  positionResponsibilityApi
} from '@/api/job';
import { fileApi } from '@/api/import-export';
import { useAuthStore } from '@/stores/auth';
import EditorShell from './position-builder/EditorShell.vue';
import CoverImageUpload from './position-builder/CoverImageUpload.vue';
import UserSelector from './position-builder/UserSelector.vue';
import StepBasicInfo from './position-builder/StepBasicInfo.vue';
import StepAbilityModeling from './position-builder/StepAbilityModeling.vue';
import StepResultTable from './position-builder/StepResultTable.vue';
import {
  convertApiAbilityBindingToLocal,
  convertApiAbilityDomainToLocal,
  convertApiAbilityToLocal,
  convertApiCertificateToLocal,
  convertApiResponsibilityToLocal,
  convertCareerPositionToLocal,
  fetchAllPages,
  localId,
  type LocalPosition
} from './position-builder/types';

type StepId = 'basic' | 'ability' | 'competency';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

// 路由参数取响应式值：同一路由换 :id 复用组件时也能正确重载（对齐 React useParams）
const id = computed(() => String(route.params.id ?? ''));
const isNewPosition = computed(() => route.query.new === 'true');

const loading = ref(true);
const detailsLoading = ref(false);
const detailsLoaded = ref(false);
const isSaving = ref(false);
const coverUploading = ref(false);
const previewConfirmOpen = ref(false);
const hasSaved = ref(false);
const position = ref<LocalPosition | null>(null);
const batches = ref<{ id: string; name: string }[]>([]);

const steps: { id: StepId; label: string; description: string }[] = [
  { id: 'basic', label: '基础信息', description: '填写岗位基本信息' },
  { id: 'ability', label: '能力建模', description: '构建能力图谱' },
  { id: 'competency', label: '能力模型汇总', description: '设置达标要求' }
];

// ?step=2 → 能力建模；?step=3 → 能力模型汇总（对齐 React searchParams 处理）
function stepFromQuery(raw: unknown): StepId | null {
  if (raw === '2') return 'ability';
  if (raw === '3') return 'competency';
  return null;
}
const activeStep = ref<StepId>(stepFromQuery(route.query.step) ?? 'basic');
// 地址栏 ?step 变化时同步切换步骤（对齐 React useEffect([searchParams])）
watch(
  () => route.query.step,
  (raw) => {
    const target = stepFromQuery(raw);
    if (target) activeStep.value = target;
  }
);

const currentStepIndex = computed(() => steps.findIndex((s) => s.id === activeStep.value));
const currentStep = computed(() => steps[currentStepIndex.value] ?? steps[0]);
const canGoNext = computed(() => currentStepIndex.value < steps.length - 1);
const canGoPrev = computed(() => currentStepIndex.value > 0);

const currentUserName = computed(() => auth.user?.name || auth.user?.username || '');
const collaboratorIds = computed(() =>
  (position.value?.collaborators || []).filter((cid) => cid !== position.value?.createdBy)
);

function updatePositionData(data: Partial<LocalPosition>) {
  if (!position.value) return;
  Object.assign(position.value, data);
}

function onCollaboratorsChange(ids: string[]) {
  if (!position.value) return;
  updatePositionData({ collaborators: ids.filter((cid) => cid !== position.value?.createdBy) });
}

/** 与 React 一致：拉全量岗位列表后定位当前岗位（列表接口带 JOIN 字段） */
async function loadPosition() {
  loading.value = true;
  try {
    const items = await fetchAllPages((page, pageSize) =>
      positionApi.list({ limit: pageSize, offset: page * pageSize })
    );
    const found = items.find((p) => p.id === id.value);
    position.value = found ? convertCareerPositionToLocal(found) : null;
  } catch (e) {
    ElMessage.error((e as Error).message || '请稍后重试');
  } finally {
    loading.value = false;
  }
  if (position.value) await loadDetails();
}

/** 并行加载职责/证书/能力绑定/能力域/能力点，并补充绑定的名称与描述 */
async function loadDetails() {
  if (!position.value || detailsLoaded.value) return;
  detailsLoading.value = true;
  try {
    const [respRes, certRes, bindingRes, domainRes, abilityRes] = await Promise.all([
      positionResponsibilityApi.list({ careerPositionId: id.value, limit: 1000 }),
      positionCertificateApi.list({ careerPositionId: id.value, limit: 1000 }),
      abilityApi.listBindings({ careerPositionId: id.value }),
      abilityApi.listDomains(id.value),
      abilityApi.list({ limit: 1000 })
    ]);
    const abilityMap = new Map(
      (abilityRes.items || []).map((a) => [a.id, convertApiAbilityToLocal(a)])
    );
    const responsibilities = (respRes.items || []).map(convertApiResponsibilityToLocal);
    const certificates = (certRes.items || []).map(convertApiCertificateToLocal);
    const abilityBindings = (bindingRes.items || []).map((b) => {
      const local = convertApiAbilityBindingToLocal(b);
      // 绑定接口已 JOIN 返回能力点名称；列表未命中时补充描述等详情
      const ability = abilityMap.get(b.abilityPointId);
      if (ability) {
        if (!local.name) local.name = ability.name;
        if (!local.description) local.description = ability.description;
        if (!local.attributes || local.attributes.length === 0) local.attributes = ability.attributes;
      }
      return local;
    });
    const abilityDomains = (domainRes.items || []).map(convertApiAbilityDomainToLocal);

    const next: Partial<LocalPosition> = {
      responsibilities,
      certificates,
      abilityBindings,
      abilityDomains
    };
    // 空数据初始化（对齐 React：至少一条空职责 / 一条空要求）
    if (responsibilities.length === 0) {
      next.responsibilities = [{ id: localId('resp'), name: '', description: '' }];
    }
    if ((position.value.requirements || []).length === 0) {
      next.requirements = [''];
    }
    updatePositionData(next);
    detailsLoaded.value = true;
  } catch (e) {
    ElMessage.error((e as Error).message || '请稍后重试');
  } finally {
    detailsLoading.value = false;
  }
}

async function loadBatches() {
  try {
    const res = await batchApi.list({ limit: 1000 });
    batches.value = (res.items || []).map((b) => ({ id: b.id, name: b.name }));
  } catch {
    batches.value = [];
  }
}

/** 保存草稿：save-full 全量写入 + 非 draft 状态回写 draft；保存后停留当前页 */
async function handleSave(): Promise<boolean> {
  const cur = position.value;
  if (!cur) return false;
  isSaving.value = true;
  try {
    await positionApi.saveFull(cur.id, {
      batchId: cur.batchId,
      name: cur.name,
      shortName: cur.shortName,
      industry: cur.industry,
      majors: cur.majors,
      positionType: cur.positionType,
      salaryRange: cur.salaryRange,
      coverImage: cur.coverImage,
      description: cur.description,
      requirements: cur.requirements,
      careerPath: cur.careerPath,
      version: cur.version,
      collaborators: cur.collaborators,
      responsibilities: cur.responsibilities,
      certificates: cur.certificates,
      abilityBindings: cur.abilityBindings,
      abilityDomains: cur.abilityDomains
    });
    if (cur.status !== 'draft') {
      await positionApi.saveDraft(cur.id);
    }
    hasSaved.value = true;
    updatePositionData({ status: 'draft' });
    ElMessage.success('草稿已保存');
    return true;
  } catch (e) {
    ElMessage.error((e as Error).message || '请稍后重试');
    return false;
  } finally {
    isSaving.value = false;
  }
}

async function handleFinish() {
  const ok = await handleSave();
  if (ok) router.push('/job/positions');
}

async function handleCoverUpload(file: File) {
  coverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    updatePositionData({ coverImage: res.url });
    ElMessage.success('封面上传成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '请稍后重试');
  } finally {
    coverUploading.value = false;
  }
}

function handleNext() {
  const next = currentStepIndex.value + 1;
  if (next < steps.length) activeStep.value = steps[next].id;
}

function handlePrev() {
  const prev = currentStepIndex.value - 1;
  if (prev >= 0) activeStep.value = steps[prev].id;
}

/** 取消：新建且未保存过 → 先删除草稿再返回列表 */
async function handleBack() {
  if (isNewPosition.value && !hasSaved.value && position.value) {
    try {
      await positionApi.delete(position.value.id);
    } catch {
      // 删除未保存的岗位草稿失败不阻塞返回
    }
  }
  router.push('/job/positions');
}

function goPreview() {
  previewConfirmOpen.value = false;
  router.push(`/job/landing/${id.value}`);
}

watch(id, () => {
  position.value = null;
  detailsLoaded.value = false;
  hasSaved.value = false;
  activeStep.value = stepFromQuery(route.query.step) ?? 'basic';
  void loadPosition();
});

onMounted(() => {
  void loadPosition();
  void loadBatches();
});
</script>

<style scoped>
.page-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #909399;
}
.state-text {
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
}
.basic-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.side-card {
  border-radius: 10px;
}
.side-block {
  margin-bottom: 16px;
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
.side-value {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.step-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.dialog-desc {
  margin: 0;
  font-size: 13px;
  color: #909399;
}
@media (max-width: 1200px) {
  .basic-grid {
    grid-template-columns: 1fr;
  }
}
</style>

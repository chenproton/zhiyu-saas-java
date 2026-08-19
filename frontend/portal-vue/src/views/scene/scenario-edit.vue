<template>
  <!-- 场景编辑页·基础信息（完整复刻 React frontend/edu/app/scene/scenarios/[id]/edit/page.tsx） -->
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
        <!-- AI 辅助编写入口 -->
        <div class="ai-entry">
          <p class="ai-entry-text">填写基础信息后，点击「AI 辅助编写」让大模型帮您润色与补齐</p>
          <el-button plain class="ai-outline-btn" :disabled="aiRunning" @click="startAiAssist">
            <el-icon><MagicStick /></el-icon>
            AI 辅助编写
          </el-button>
        </div>

        <!-- AI 覆盖内容常驻撤销横幅 -->
        <div v-if="updatedCount > 0" class="ai-banner">
          <div class="ai-banner-text">
            <el-icon><MagicStick /></el-icon>
            <span class="ai-banner-msg">AI 已更新 {{ updatedCount }} 项内容，可逐项恢复上版或全部撤销</span>
          </div>
          <el-button size="small" plain class="ai-outline-btn" @click="handleRestoreAll">
            <el-icon><RefreshLeft /></el-icon>
            全部撤销
          </el-button>
        </div>

        <el-card shadow="never" class="form-card" :class="{ 'ai-flash': basicFlash }">
          <el-form label-position="top" @submit.prevent>
            <el-form-item required class="form-row" :class="{ 'ai-flash': flashKey === 'name' }">
              <template #label>
                <span class="field-label">
                  场景名称
                  <ScenarioFieldAiControls
                    :updated="aiUpdated('name')"
                    :running="aiRunning"
                    :loading="polishRunning"
                    @restore="restoreField('name')"
                    @generate="handlePolishField('name')"
                  />
                </span>
              </template>
              <div class="field-body">
                <el-input v-model="scenarioName" placeholder="请输入场景名称" />
              </div>
            </el-form-item>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item class="form-row" :class="{ 'ai-flash': flashKey === 'industry' }">
                  <template #label>
                    <span class="field-label">
                      面向行业
                      <el-tag v-if="aiUpdated('industry')" size="small" class="ai-badge" disable-transitions>
                        已更新
                      </el-tag>
                    </span>
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
                <el-form-item class="form-row" :class="{ 'ai-flash': flashKey === 'profession' }">
                  <template #label>
                    <span class="field-label">
                      适用专业
                      <el-tag v-if="aiUpdated('profession')" size="small" class="ai-badge" disable-transitions>
                        已更新
                      </el-tag>
                    </span>
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

            <el-form-item class="form-row" :class="{ 'ai-flash': flashKey === 'difficulty' }">
              <template #label>
                <span class="field-label">
                  难度等级
                  <ScenarioFieldAiControls
                    :updated="aiUpdated('difficulty')"
                    :running="aiRunning"
                    :loading="polishRunning"
                    @restore="restoreField('difficulty')"
                    @generate="handlePolishField('difficulty')"
                  />
                </span>
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

            <el-form-item class="form-row" :class="{ 'ai-flash': flashKey === 'background' }">
              <template #label>
                <span class="field-label">
                  场景介绍
                  <ScenarioFieldAiControls
                    :updated="aiUpdated('background')"
                    :running="aiRunning"
                    :loading="polishRunning"
                    @restore="restoreField('background')"
                    @generate="handlePolishField('background')"
                  />
                </span>
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
          <div class="side-block" :class="{ 'ai-flash': flashKey === 'position' }">
            <div class="side-label side-label-strong">
              <span class="field-label">
                目标岗位
                <template v-if="aiUpdated('position')">
                  <el-tag size="small" class="ai-badge" disable-transitions>已更新</el-tag>
                  <el-button text size="small" class="ai-restore" @click="restoreField('position')">
                    <el-icon><RefreshLeft /></el-icon>
                    恢复上版
                  </el-button>
                </template>
              </span>
            </div>
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

    <!-- AI 辅助编写进度弹窗；运行中关闭弹窗视为取消流水线 -->
    <AiProgressDialog
      :open="pipeline.open.value"
      title="AI 辅助编写"
      description="大模型正在阅读场景信息并生成润色与补齐结果"
      :steps="AI_ASSIST_STEPS"
      :current-step="pipeline.phase.value"
      :progress="pipeline.progress.value"
      @close="pipeline.handleClose"
    />

    <!-- 快速补全必填信息弹窗 -->
    <el-dialog v-model="quickFillOpen" width="520px" top="8vh" class="ai-dialog">
      <template #header>
        <div class="dialog-header">
          <el-icon class="dialog-header-icon"><MagicStick /></el-icon>
          <span class="dialog-header-title">快速补全必填信息</span>
        </div>
      </template>
      <p class="dialog-desc">以下必填字段尚未填写，请补充后继续使用 AI 辅助编写。</p>
      <el-form label-position="top">
        <el-form-item v-if="!scenarioName.trim()" label="场景名称" required>
          <el-input v-model="quickFill.name" placeholder="例如：电商平台全栈开发实战" />
        </el-form-item>
        <el-form-item v-if="!background.trim()" label="场景介绍" required>
          <el-input
            v-model="quickFill.background"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="一句话描述该场景的背景与目标..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quickFillOpen = false">取消</el-button>
        <el-button
          type="primary"
          class="ai-primary-btn"
          :disabled="quickFillInvalid"
          @click="confirmQuickFillAndStartAi"
        >
          <el-icon><MagicStick /></el-icon>
          开始 AI 辅助编写
        </el-button>
      </template>
    </el-dialog>

    <!-- AI 未配置引导弹窗（对齐 React AiNotConfiguredDialog） -->
    <el-dialog v-model="notConfiguredOpen" width="460px">
      <template #header>
        <div class="dialog-header">
          <el-icon class="dialog-header-icon primary"><Setting /></el-icon>
          <span class="dialog-header-title">尚未配置 AI 服务</span>
        </div>
      </template>
      <p class="dialog-desc">请先在 系统管理 &gt; 租户信息 中配置 AI 服务，再使用 AI 辅助编写</p>
      <template #footer>
        <el-button @click="notConfiguredOpen = false">取消</el-button>
        <el-button type="primary" @click="goAiConfig">前往配置</el-button>
      </template>
    </el-dialog>

    <!-- 每次 AI 辅助编写前的意图确认弹窗 -->
    <el-dialog v-model="confirmRegenOpen" width="520px" class="ai-dialog">
      <template #header>
        <div class="dialog-header">
          <el-icon class="dialog-header-icon"><MagicStick /></el-icon>
          <span class="dialog-header-title">确认重新生成全部内容？</span>
        </div>
      </template>
      <p class="dialog-desc">
        AI 将基于当前填写的场景信息重新生成并直接覆盖：场景名称、场景介绍、难度等级，并建议面向行业与适用专业（命中的字典项直接选中）。每个字段均可单独「恢复上版」，也可全部撤销。
      </p>
      <template #footer>
        <el-button @click="confirmRegenOpen = false">取消</el-button>
        <el-button type="primary" class="ai-primary-btn" @click="confirmRegenAndRun">
          <el-icon><MagicStick /></el-icon>
          确认生成
        </el-button>
      </template>
    </el-dialog>

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
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { MagicStick, RefreshLeft, Setting } from '@element-plus/icons-vue';
import { scenarioApi, sceneBatchApi } from '@/api/scene';
import { positionApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { fileApi } from '@/api/import-export';
import type { CareerPosition } from '@/types/job';
import type { Industry, Major } from '@/types/system';
import EditorShell from '../job/position-builder/EditorShell.vue';
import CoverImageUpload from '../job/position-builder/CoverImageUpload.vue';
import UserSelector from '../job/position-builder/UserSelector.vue';
import AiProgressDialog from '../job/position-builder/AiProgressDialog.vue';
import {
  isAiNotConfigured,
  useAiFieldWriter,
  useAiPipeline
} from '../job/position-builder/ai';
import ScenarioFieldAiControls from './ScenarioFieldAiControls.vue';
import {
  scenarioAiAssist,
  type AIScenarioAssistResponse,
  type AIScenarioSuggestion
} from './scenario-ai';

/** AI 辅助编写一键流程的步骤（与字段顺序一一对应） */
const AI_ASSIST_STEPS = ['阅读场景基础信息', '生成场景基础信息'];

/** 难度等级文案（1-5 星，对齐 React 星级右侧标签） */
const DIFFICULTY_TEXTS = ['入门', '基础', '中级', '高级', '专家'];

/** AI 可直接写入的字段键（3 个文本/枚举字段 + 2 个字典建议字段 + 目标岗位），各含 1 级撤销历史 */
type AiWriteKey = 'name' | 'background' | 'difficulty' | 'industry' | 'profession' | 'position';

const AI_WRITE_KEYS: AiWriteKey[] = [
  'name',
  'background',
  'difficulty',
  'industry',
  'profession',
  'position'
];

/** 基础信息中可由 AI 单独填充的字段（polish 一次返回 3 个，按目标字段单独应用） */
type PolishFieldKey = 'name' | 'background' | 'difficulty';

/** AI 写入分发的草稿快照（与页面分散 ref 对应的聚合视图） */
interface ScenarioDraft {
  name: string;
  background: string;
  difficulty: number;
  industryIds: string[];
  professionIds: string[];
  positionId: string;
}

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

// ===== AI 辅助编写状态（复用岗位侧 Vue 底座：字段级写入保护 / 串行流水线） =====

/** 某字段被 AI 覆盖前的快照（1 级历史用） */
function snapshotField(key: AiWriteKey): Partial<ScenarioDraft> {
  switch (key) {
    case 'name':
      return { name: scenarioName.value };
    case 'background':
      return { background: background.value };
    case 'difficulty':
      return { difficulty: difficulty.value };
    case 'industry':
      return { industryIds: [...industryIds.value] };
    case 'profession':
      return { professionIds: [...professionIds.value] };
    case 'position':
      return { positionId: positionId.value };
  }
}

/** AI 写入分发：Partial<ScenarioDraft> → 页面分散 ref */
function applyAiUpdate(data: Partial<ScenarioDraft>) {
  if (data.name !== undefined) scenarioName.value = data.name;
  if (data.background !== undefined) background.value = data.background;
  if (data.difficulty !== undefined) difficulty.value = data.difficulty;
  if (data.industryIds !== undefined) industryIds.value = [...data.industryIds];
  if (data.professionIds !== undefined) professionIds.value = [...data.professionIds];
  if (data.positionId !== undefined) positionId.value = data.positionId;
}

const writer = useAiFieldWriter<AiWriteKey, Partial<ScenarioDraft>>(
  AI_WRITE_KEYS,
  applyAiUpdate,
  snapshotField
);
const { flashKey, aiUpdated, writeField, restoreField, restoreAll } = writer;
const updatedCount = computed(() => writer.updatedCount.value);
/** 基础信息卡片整体高亮（对齐 React Card 的 ai-write-flash 判定） */
const basicFlash = computed(
  () => !!flashKey.value && ['name', 'background', 'difficulty'].includes(flashKey.value)
);

const notConfiguredOpen = ref(false);
const quickFillOpen = ref(false);
const confirmRegenOpen = ref(false);
const quickFill = reactive({ name: '', background: '' });

const pipeline = useAiPipeline<undefined, AIScenarioAssistResponse>({
  steps: () => AI_ASSIST_STEPS,
  request: (_task, signal) =>
    scenarioAiAssist(
      {
        field: 'polish',
        scenario: {
          name: scenarioName.value,
          background: background.value,
          difficulty: difficulty.value,
          industryNames: resolveIndustryNames(industryIds.value),
          professionNames: resolveMajorNames(professionIds.value),
          positionId: positionId.value,
          positionName: positionId.value
            ? allPositions.value.find((p) => p.id === positionId.value)?.name || ''
            : '',
          taskName: '',
          taskBackground: '',
          taskDescription: '',
          taskDifficulty: 0,
          existingTasks: [],
          intention: ''
        }
      },
      signal
    ),
  onError: (err) => {
    if (isAiNotConfigured(err)) {
      notConfiguredOpen.value = true;
      return true;
    }
    const message = err instanceof Error && err.message ? `AI 生成失败：${err.message}` : 'AI 生成失败';
    ElMessage.error(message);
    return true;
  }
});

const aiRunning = computed(() => pipeline.isRunning.value);
const polishRunning = computed(
  () => pipeline.isRunning.value && pipeline.runningId.value === 'polish'
);

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

// ===== AI 辅助编写逻辑 =====

function resolveIndustryNames(ids: string[]): string[] {
  return ids.map((id) => industries.value.find((i) => i.id === id)?.name || '').filter(Boolean);
}

function resolveMajorNames(ids: string[]): string[] {
  return ids.map((id) => majors.value.find((m) => m.id === id)?.name || '').filter(Boolean);
}

function polishFieldLabel(key: PolishFieldKey): string {
  return { name: '场景名称', background: '场景介绍', difficulty: '难度等级' }[key];
}

/** 追加去重写入字典建议（引用优先：仅 matchedId 命中项写入） */
function applyDictSuggestions(
  key: 'industry' | 'profession',
  suggestions: AIScenarioSuggestion[] | undefined,
  currentIds: string[]
) {
  if (!suggestions || suggestions.length === 0) return;
  const matched = suggestions.filter((s) => s.matchedId);
  const unmatched = suggestions.filter((s) => !s.matchedId);
  if (matched.length > 0) {
    const next = [...currentIds];
    for (const s of matched) {
      if (s.matchedId && !next.includes(s.matchedId)) next.push(s.matchedId);
    }
    writeField(key, key === 'industry' ? { industryIds: next } : { professionIds: next });
  }
  if (unmatched.length > 0) {
    ElMessage.warning(
      `以下${key === 'industry' ? '行业' : '专业'}未在字典中找到，请手动选择：${unmatched
        .map((s) => s.name)
        .join('、')}`
    );
  }
}

/** 目标岗位建议：命中系统已有岗位则自动选中（计入 AI 更新历史，可恢复上版）；未命中仅提示不写入 */
function applyPositionSuggestion(suggestion?: AIScenarioSuggestion) {
  if (!suggestion) return;
  if (suggestion.matchedId) {
    writeField('position', { positionId: suggestion.matchedId });
    return;
  }
  ElMessage.warning(`AI 建议的目标岗位「${suggestion.name}」未在系统中找到，请手动选择`);
}

/** 应用 polish 结果：3 个字段逐项写入（各自独立历史/高亮）；未生成项提示保留原值 */
function applyPolish(res: AIScenarioAssistResponse) {
  const p = res.polish;
  if (!p) return;
  const skipped: string[] = [];
  if (p.name.trim()) writeField('name', { name: p.name.trim() });
  else skipped.push(polishFieldLabel('name'));
  if (p.background.trim()) writeField('background', { background: p.background.trim() });
  else skipped.push(polishFieldLabel('background'));
  if (p.difficulty >= 1 && p.difficulty <= 5) writeField('difficulty', { difficulty: p.difficulty });
  else skipped.push(polishFieldLabel('difficulty'));
  if (skipped.length > 0) {
    ElMessage.info(`AI 未生成：${skipped.join('、')}，已保留原内容`);
  }
  applyDictSuggestions('industry', res.industrySuggestions, industryIds.value);
  applyDictSuggestions('profession', res.professionSuggestions, professionIds.value);
  applyPositionSuggestion(res.positionSuggestion);
}

/** 基础信息单字段生成：调 polish 一次，仅应用目标字段（不弹进度弹窗） */
function handlePolishField(target: PolishFieldKey) {
  void pipeline.run(
    [
      {
        id: 'polish',
        meta: undefined,
        apply: (res) => {
          const p = res.polish;
          if (!p) return;
          if (target === 'name' && p.name.trim()) {
            writeField('name', { name: p.name.trim() });
            return;
          }
          if (target === 'background' && p.background.trim()) {
            writeField('background', { background: p.background.trim() });
            return;
          }
          if (target === 'difficulty' && p.difficulty >= 1 && p.difficulty <= 5) {
            writeField('difficulty', { difficulty: p.difficulty });
            return;
          }
          ElMessage.info(`AI 未生成${polishFieldLabel(target)}，已保留原内容`);
        }
      }
    ],
    { showDialog: false }
  );
}

function getMissingFields(): string[] {
  const missing: string[] = [];
  if (!scenarioName.value.trim()) missing.push('场景名称');
  if (!background.value.trim()) missing.push('场景介绍');
  return missing;
}

const quickFillInvalid = computed(
  () =>
    (!scenarioName.value.trim() && !quickFill.name.trim()) ||
    (!background.value.trim() && !quickFill.background.trim())
);

function openQuickFill() {
  quickFill.name = scenarioName.value;
  quickFill.background = background.value;
  quickFillOpen.value = true;
}

function confirmQuickFillAndStartAi() {
  if (quickFill.name.trim()) scenarioName.value = quickFill.name.trim();
  if (quickFill.background.trim()) background.value = quickFill.background.trim();
  quickFillOpen.value = false;
  // Vue 侧 ref 同步生效，AI 请求（pipeline.request）读取的即为刚补全的值，
  // 不会像 React 那样出现「formRef 未同步、用旧上下文覆盖补全内容」的问题
  runAiAssist();
}

/** 一键流程：polish 一次生成全部可写字段（3 文本字段 + 行业/专业/岗位建议），进度弹窗展示 */
function runAiAssist() {
  void pipeline.run([{ id: 'polish', meta: undefined, apply: applyPolish }]);
}

function startAiAssist() {
  if (getMissingFields().length > 0) {
    openQuickFill();
    return;
  }
  // 每次点击均先弹确认，明确「将重新生成全部内容」的意图
  confirmRegenOpen.value = true;
}

function confirmRegenAndRun() {
  confirmRegenOpen.value = false;
  runAiAssist();
}

function handleRestoreAll() {
  restoreAll(() => ElMessage.success('已全部恢复 AI 覆盖前的内容'));
}

function goAiConfig() {
  notConfiguredOpen.value = false;
  router.push('/portal/apps/system/tenant');
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
.ai-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.ai-entry-text {
  margin: 0;
  font-size: 13px;
  color: #909399;
}
.ai-outline-btn {
  flex-shrink: 0;
  border-color: #e0cffc;
  color: #7e22ce;
  background: #faf5ff;
}
.ai-outline-btn:hover {
  border-color: #c084fc;
  color: #6b21a8;
  background: #f3e8ff;
}
.ai-primary-btn {
  background: #9333ea;
  border-color: #9333ea;
}
.ai-primary-btn:hover {
  background: #7e22ce;
  border-color: #7e22ce;
}
.ai-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid #e0cffc;
  border-radius: 8px;
  background: #faf5ff;
}
.ai-banner-text {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: #581c87;
}
.ai-banner-text .el-icon {
  flex-shrink: 0;
  color: #9333ea;
}
.ai-banner-msg {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.field-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  line-height: 1.4;
}
.ai-badge {
  height: 18px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 18px;
  border-color: #e0cffc;
  color: #7e22ce;
  background: #faf5ff;
}
.ai-restore {
  height: 22px;
  padding: 0 4px;
  font-size: 11px;
  color: #7e22ce;
}
.ai-restore:hover {
  color: #6b21a8;
  background: #faf5ff;
}
.field-body {
  width: 100%;
  border-radius: 6px;
}
.ai-flash {
  animation: ai-flash 1.4s ease;
}
@keyframes ai-flash {
  0% {
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.6);
  }
  100% {
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0);
  }
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
.dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dialog-header-icon {
  color: #a855f7;
}
.dialog-header-icon.primary {
  color: #409eff;
}
.dialog-header-title {
  font-size: 16px;
  font-weight: 600;
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

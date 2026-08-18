<template>
  <div class="edit-page">
    <!-- 顶部操作栏：取消 / 步骤 / 保存草稿 / 预览 / 下一步（对齐 React EditorShell） -->
    <el-card shadow="never" class="header-card">
      <div class="header-bar">
        <div class="header-left">
          <el-button @click="onBack">取消</el-button>
          <el-divider direction="vertical" />
          <el-tag type="primary" effect="dark">步骤 1</el-tag>
          <span class="step-label">基础信息编辑</span>
        </div>
        <div class="header-right">
          <el-button :disabled="saving || !canSave" @click="onSaveDraft">
            {{ saving ? '保存中...' : '保存草稿' }}
          </el-button>
          <el-button @click="openPreview">预览</el-button>
          <el-button type="primary" :disabled="!canSave" @click="onNext">下一步</el-button>
        </div>
      </div>
    </el-card>

    <!-- 标题 -->
    <div class="page-title">
      <h1>编辑实践场景</h1>
      <p>填写场景基础信息，完成后进入任务链配置</p>
    </div>

    <div v-loading="loading" class="page-body">
      <template v-if="!loading">
        <div class="layout">
          <!-- 左侧：主表单 -->
          <div class="main-col">
            <!-- AI 辅助编写入口 -->
            <div class="ai-entry">
              <span class="ai-entry-text">填写基础信息后，点击「AI 辅助编写」让大模型帮您润色与补齐</span>
              <el-button plain class="ai-entry-btn" :disabled="aiRunning" @click="startAiAssist">
                <el-icon><MagicStick /></el-icon>
                AI 辅助编写
              </el-button>
            </div>

            <!-- AI 覆盖内容常驻撤销横幅 -->
            <div v-if="updatedCount > 0" class="ai-banner">
              <div class="ai-banner-text">
                <el-icon><MagicStick /></el-icon>
                <span>AI 已更新 {{ updatedCount }} 项内容，可逐项恢复上版或全部撤销</span>
              </div>
              <el-button size="small" plain class="ai-banner-btn" @click="handleRestoreAll">
                <el-icon><RefreshLeft /></el-icon>
                全部撤销
              </el-button>
            </div>

            <el-card shadow="never">
              <el-form label-position="top" class="basic-form">
                <el-form-item required>
                  <template #label>
                    <div class="field-label">
                      <span>场景名称</span>
                      <template v-if="aiUpdated('name')">
                        <el-tag size="small" class="ai-badge">已更新</el-tag>
                        <el-button size="small" text type="primary" class="ai-restore" @click="restoreField('name')">
                          <el-icon><RefreshLeft /></el-icon>
                          恢复上版
                        </el-button>
                      </template>
                      <el-button
                        size="small"
                        text
                        type="primary"
                        class="ai-gen"
                        :disabled="aiRunning"
                        title="AI 生成"
                        @click="handlePolishField('name')"
                      >
                        <el-icon :class="{ 'is-loading': polishTarget === 'name' }"><MagicStick /></el-icon>
                      </el-button>
                    </div>
                  </template>
                  <div :class="['field-body', { 'ai-flash': flashKey === 'name' }]">
                    <el-input v-model="form.name" placeholder="请输入场景名称" />
                  </div>
                </el-form-item>

                <el-row :gutter="16">
                  <el-col :span="12">
                    <el-form-item>
                      <template #label>
                        <div class="field-label">
                          <span>面向行业</span>
                          <el-tag v-if="aiUpdated('industry')" size="small" class="ai-badge">已更新</el-tag>
                        </div>
                      </template>
                      <div :class="['field-body', { 'ai-flash': flashKey === 'industry' }]">
                        <el-select
                          v-model="form.industryIds"
                          multiple
                          filterable
                          collapse-tags
                          style="width: 100%"
                          placeholder="选择行业"
                        >
                          <el-option v-for="i in industries" :key="i.id" :label="i.name" :value="i.id" />
                        </el-select>
                      </div>
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item>
                      <template #label>
                        <div class="field-label">
                          <span>适用专业</span>
                          <el-tag v-if="aiUpdated('profession')" size="small" class="ai-badge">已更新</el-tag>
                        </div>
                      </template>
                      <div :class="['field-body', { 'ai-flash': flashKey === 'profession' }]">
                        <el-select
                          v-model="form.professionIds"
                          multiple
                          filterable
                          collapse-tags
                          style="width: 100%"
                          placeholder="选择适用专业"
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

                <el-form-item>
                  <template #label>
                    <div class="field-label">
                      <span>难度等级</span>
                      <template v-if="aiUpdated('difficulty')">
                        <el-tag size="small" class="ai-badge">已更新</el-tag>
                        <el-button size="small" text type="primary" class="ai-restore" @click="restoreField('difficulty')">
                          <el-icon><RefreshLeft /></el-icon>
                          恢复上版
                        </el-button>
                      </template>
                      <el-button
                        size="small"
                        text
                        type="primary"
                        class="ai-gen"
                        :disabled="aiRunning"
                        title="AI 生成"
                        @click="handlePolishField('difficulty')"
                      >
                        <el-icon :class="{ 'is-loading': polishTarget === 'difficulty' }"><MagicStick /></el-icon>
                      </el-button>
                    </div>
                  </template>
                  <div :class="['field-body', { 'ai-flash': flashKey === 'difficulty' }]">
                    <el-rate v-model="form.difficulty" :max="5" :allow-half="false" :texts="difficultyTexts" show-text />
                  </div>
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <div class="field-label">
                      <span>场景介绍</span>
                      <template v-if="aiUpdated('background')">
                        <el-tag size="small" class="ai-badge">已更新</el-tag>
                        <el-button size="small" text type="primary" class="ai-restore" @click="restoreField('background')">
                          <el-icon><RefreshLeft /></el-icon>
                          恢复上版
                        </el-button>
                      </template>
                      <el-button
                        size="small"
                        text
                        type="primary"
                        class="ai-gen"
                        :disabled="aiRunning"
                        title="AI 生成"
                        @click="handlePolishField('background')"
                      >
                        <el-icon :class="{ 'is-loading': polishTarget === 'background' }"><MagicStick /></el-icon>
                      </el-button>
                    </div>
                  </template>
                  <div :class="['field-body', { 'ai-flash': flashKey === 'background' }]">
                    <el-input v-model="form.background" type="textarea" :rows="7" placeholder="描述该场景的背景、意义和学习目标..." />
                  </div>
                </el-form-item>

                <el-form-item label="交付目标">
                  <el-input v-model="form.deliveryGoal" type="textarea" :rows="3" placeholder="交付目标" />
                </el-form-item>
              </el-form>
            </el-card>
          </div>

          <!-- 右侧：封面 + 岗位/批次/创建人/共建人/版本 -->
          <div class="side-col">
            <el-card shadow="never">
              <div class="cover-block">
                <div class="block-label">场景封面</div>
                <div class="cover-box" :class="{ uploading: coverUploading }" @click="triggerCover">
                  <img v-if="coverImage" :src="coverImage" alt="场景封面" class="cover-img" />
                  <div v-else class="cover-empty">
                    <el-icon v-if="coverUploading" class="is-loading" size="28"><Loading /></el-icon>
                    <el-icon v-else size="28"><UploadFilled /></el-icon>
                    <span>{{ coverUploading ? '上传中...' : '点击上传封面' }}</span>
                  </div>
                  <input ref="coverInput" type="file" accept="image/*" style="display: none" @change="onCoverChange" />
                </div>
                <el-button v-if="coverImage" size="small" text type="danger" class="cover-remove" @click="coverImage = ''">
                  移除封面
                </el-button>
              </div>
            </el-card>

            <el-card shadow="never" class="side-card">
              <el-form label-position="top">
                <el-form-item>
                  <template #label>
                    <div class="field-label">
                      <span>目标岗位</span>
                      <template v-if="aiUpdated('position')">
                        <el-tag size="small" class="ai-badge">已更新</el-tag>
                        <el-button size="small" text type="primary" class="ai-restore" @click="restoreField('position')">
                          <el-icon><RefreshLeft /></el-icon>
                          恢复上版
                        </el-button>
                      </template>
                    </div>
                  </template>
                  <div :class="['field-body', { 'ai-flash': flashKey === 'position' }]">
                    <el-select v-model="form.careerPositionId" clearable style="width: 100%" placeholder="请选择岗位">
                      <el-option-group v-for="g in positionGroups" :key="g.label" :label="g.label">
                        <el-option v-for="p in g.positions" :key="p.id" :label="p.name" :value="p.id" />
                      </el-option-group>
                    </el-select>
                  </div>
                </el-form-item>

                <el-form-item label="所属批次">
                  <el-select v-model="form.batchId" clearable style="width: 100%" placeholder="请选择批次">
                    <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
                  </el-select>
                </el-form-item>

                <div class="info-row">
                  <span class="info-label">创建人</span>
                  <span class="info-value">{{ creatorName || '当前用户' }}</span>
                </div>

                <el-form-item label="共建人/共建部门">
                  <el-select
                    v-model="form.coBuilderIds"
                    multiple
                    filterable
                    collapse-tags
                    style="width: 100%"
                    placeholder="点击选择共建人"
                  >
                    <el-option v-for="u in coBuilderOptions" :key="u.id" :label="u.name" :value="u.id" />
                  </el-select>
                </el-form-item>

                <div class="info-row">
                  <span class="info-label">当前版本号</span>
                  <span class="info-value">{{ version }}</span>
                </div>
              </el-form>
            </el-card>
          </div>
        </div>
      </template>
    </div>

    <!-- 快速补全必填信息弹窗 -->
    <el-dialog v-model="quickFillOpen" title="快速补全必填信息" width="520px">
      <p class="dialog-desc">以下必填字段尚未填写，请补充后继续使用 AI 辅助编写。</p>
      <el-form label-position="top">
        <el-form-item v-if="!form.name.trim()" required label="场景名称">
          <el-input v-model="quickFill.name" placeholder="例如：电商平台全栈开发实战" />
        </el-form-item>
        <el-form-item v-if="!form.background.trim()" required label="场景介绍">
          <el-input v-model="quickFill.background" type="textarea" :rows="3" placeholder="一句话描述该场景的背景与目标..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quickFillOpen = false">取消</el-button>
        <el-button
          type="primary"
          class="ai-entry-btn"
          :disabled="(!form.name.trim() && !quickFill.name.trim()) || (!form.background.trim() && !quickFill.background.trim())"
          @click="confirmQuickFillAndStartAi"
        >
          <el-icon><MagicStick /></el-icon>
          开始 AI 辅助编写
        </el-button>
      </template>
    </el-dialog>

    <!-- 每次 AI 辅助编写前的意图确认弹窗 -->
    <el-dialog v-model="confirmRegenOpen" title="确认重新生成全部内容？" width="480px">
      <p class="dialog-desc">
        AI 将基于当前填写的场景信息重新生成并直接覆盖：场景名称、场景介绍、难度等级，并建议面向行业与适用专业（命中的字典项直接选中）。每个字段均可单独「恢复上版」，也可全部撤销。
      </p>
      <template #footer>
        <el-button @click="confirmRegenOpen = false">取消</el-button>
        <el-button type="primary" class="ai-entry-btn" @click="confirmRegenAndRun">
          <el-icon><MagicStick /></el-icon>
          确认生成
        </el-button>
      </template>
    </el-dialog>

    <!-- AI 辅助编写进度弹窗 -->
    <el-dialog
      v-model="aiOpen"
      title="AI 辅助编写"
      width="420px"
      :close-on-click-modal="false"
      @close="onAiDialogClose"
    >
      <div class="ai-progress">
        <el-icon class="is-loading ai-progress-icon" size="28"><Loading /></el-icon>
        <p class="ai-progress-text">大模型正在阅读场景信息并生成润色与补齐结果</p>
        <p class="ai-step-text">当前步骤：{{ aiPhase === 0 ? '阅读场景基础信息' : '生成场景基础信息' }}</p>
        <el-progress :percentage="aiProgress" :show-text="false" />
      </div>
      <template #footer>
        <el-button @click="cancelAi">取消</el-button>
      </template>
    </el-dialog>

    <!-- AI 未配置引导弹窗 -->
    <el-dialog v-model="notConfiguredOpen" title="尚未配置 AI 服务" width="420px">
      <p class="dialog-desc">请先在 系统管理 &gt; 租户信息 中配置 AI 服务，再使用 AI 辅助编写</p>
      <template #footer>
        <el-button @click="notConfiguredOpen = false">取消</el-button>
        <el-button type="primary" @click="notConfiguredOpen = false">前往配置</el-button>
      </template>
    </el-dialog>

    <!-- 预览确认弹窗 -->
    <el-dialog v-model="previewConfirmOpen" title="即将离开当前页面" width="420px">
      <p class="dialog-desc">请确认是否已经保存数据</p>
      <template #footer>
        <el-button @click="previewConfirmOpen = false">取消</el-button>
        <el-button type="primary" @click="goPreview">跳转预览</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Loading, MagicStick, RefreshLeft, UploadFilled } from '@element-plus/icons-vue';
import { scenarioApi, sceneBatchApi } from '@/api/scene';
import { positionApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import { authedFetch, request } from '@/api/http';

// ===== AI 辅助编写相关类型（对齐 frontend/packages/api-client/src/types/ai.ts，Vue 侧内联避免改 types/*.ts） =====
type AiWriteKey = 'name' | 'background' | 'difficulty' | 'industry' | 'profession' | 'position';
type PolishFieldKey = 'name' | 'background' | 'difficulty';
const AI_WRITE_KEYS: AiWriteKey[] = ['name', 'background', 'difficulty', 'industry', 'profession', 'position'];

interface ScenarioDraft {
  name: string;
  background: string;
  difficulty: number;
  industryIds: string[];
  professionIds: string[];
  careerPositionId: string;
}

interface AIScenarioSuggestion {
  name: string;
  description?: string;
  type?: string;
  matchedId?: string;
  matchedName?: string;
}

interface AIScenarioPolish {
  name: string;
  background: string;
  difficulty: number;
}

interface AIScenarioAssistResponse {
  field: string;
  polish?: AIScenarioPolish;
  industrySuggestions?: AIScenarioSuggestion[];
  professionSuggestions?: AIScenarioSuggestion[];
  positionSuggestion?: AIScenarioSuggestion;
}

interface AIScenarioAssistBody {
  field: string;
  scenario: {
    name: string;
    background: string;
    difficulty: number;
    industryNames: string[];
    professionNames: string[];
    positionId: string;
    positionName: string;
    taskName: string;
    taskBackground: string;
    taskDescription: string;
    taskDifficulty: number;
    existingTasks: { name: string; type: string; difficulty: number }[];
    intention: string;
  };
}

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isNew = route.query.new === 'true';

const loading = ref(false);
const saving = ref(false);

const form = reactive({
  name: '',
  difficulty: 3,
  careerPositionId: '',
  industryIds: [] as string[],
  professionIds: [] as string[],
  batchId: '',
  background: '',
  deliveryGoal: '',
  coBuilderIds: [] as string[]
});

const coverImage = ref('');
const coverUploading = ref(false);
const version = ref('V1.0');
const creatorId = ref('');
const creatorName = ref('');
const scenarioStatus = ref<string>('draft');
const hasSaved = ref(false);

const positions = ref<{ id: string; name: string; industryId?: string }[]>([]);
const industries = ref<{ id: string; name: string }[]>([]);
const majors = ref<{ id: string; name: string; code?: string }[]>([]);
const batches = ref<{ id: string; name: string }[]>([]);
const users = ref<{ id: string; name: string }[]>([]);

const difficultyTexts = ['入门', '基础', '中级', '高级', '专家'];

const canSave = computed(() => !!form.name.trim());

const coBuilderOptions = computed(() => users.value.filter((u) => u.id !== creatorId.value));

const positionGroups = computed(() => {
  const map = new Map<string, { id: string; name: string }[]>();
  positions.value.forEach((p) => {
    const key = industries.value.find((i) => i.id === p.industryId)?.name || '其他';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ id: p.id, name: p.name });
  });
  const groups: { label: string; positions: { id: string; name: string }[] }[] = [];
  map.forEach((items, label) => groups.push({ label, positions: items }));
  return groups;
});

// ===== 加载数据 =====
async function loadAll() {
  loading.value = true;
  try {
    const [scenario, posRes, indRes, majorRes, batchRes, userRes] = await Promise.all([
      scenarioApi.get(id),
      positionApi.list({ limit: 1000 }),
      industryApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 }),
      sceneBatchApi.list({ limit: 1000 }),
      userManagementApi.list({ limit: 1000 })
    ]);
    form.name = scenario.name || '';
    form.careerPositionId = scenario.careerPositionId || '';
    form.industryIds = scenario.industryIds || [];
    form.professionIds = scenario.professionIds || [];
    form.batchId = scenario.batchId || '';
    form.difficulty = scenario.difficulty || 3;
    form.background = scenario.background || '';
    form.deliveryGoal = scenario.deliveryGoal || '';
    creatorId.value = scenario.creatorId || '';
    creatorName.value = scenario.creatorName || '';
    form.coBuilderIds = (scenario.coBuilderIds || []).filter((u) => u !== scenario.creatorId);
    version.value = scenario.version || 'V1.0';
    coverImage.value = scenario.coverImage || '';
    scenarioStatus.value = scenario.status || 'draft';
    positions.value = posRes.items;
    industries.value = indRes.items;
    majors.value = majorRes.items.filter((m) => m.enabled);
    batches.value = batchRes.items;
    users.value = userRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

// ===== 保存草稿 / 下一步 / 预览 =====
function buildPayload() {
  return {
    name: form.name.trim(),
    careerPositionId: form.careerPositionId || null,
    batchId: form.batchId || null,
    industryIds: form.industryIds.length > 0 ? form.industryIds : null,
    professionIds: form.professionIds.length > 0 ? form.professionIds : null,
    difficulty: form.difficulty,
    background: form.background || null,
    deliveryGoal: form.deliveryGoal || null,
    version: version.value,
    coBuilderIds: form.coBuilderIds,
    coverImage: coverImage.value || null
  };
}

async function onSaveDraft() {
  if (!form.name.trim()) {
    ElMessage.warning('场景名称不能为空');
    return;
  }
  saving.value = true;
  try {
    await scenarioApi.update(id, buildPayload() as never);
    hasSaved.value = true;
    if (scenarioStatus.value !== 'draft') {
      await scenarioApi.saveDraft(id);
      scenarioStatus.value = 'draft';
    }
    ElMessage.success('草稿已保存');
  } catch (e) {
    ElMessage.error((e as Error).message || '请稍后重试');
  } finally {
    saving.value = false;
  }
}

async function onNext() {
  if (!form.name.trim()) {
    ElMessage.warning('场景名称不能为空');
    return;
  }
  saving.value = true;
  try {
    await scenarioApi.update(id, buildPayload() as never);
    hasSaved.value = true;
    ElMessage.success('保存成功');
    router.push(`/scene/scenarios/${id}/edit/tasks`);
  } catch (e) {
    ElMessage.error((e as Error).message || '请稍后重试');
  } finally {
    saving.value = false;
  }
}

const previewConfirmOpen = ref(false);
function openPreview() {
  previewConfirmOpen.value = true;
}
function goPreview() {
  previewConfirmOpen.value = false;
  router.push(`/scene/landing/${id}`);
}

async function onBack() {
  if (isNew && !hasSaved.value) {
    try {
      await scenarioApi.delete(id);
    } catch {
      // 忽略删除失败，直接返回列表
    }
  }
  router.push('/scene/scenarios');
}

// ===== 封面上传（直连 /files/upload，对齐 React fileApi.upload） =====
const coverInput = ref<HTMLInputElement | null>(null);
function triggerCover() {
  if (!coverUploading.value) coverInput.value?.click();
}
function onCoverChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) handleCoverUpload(file);
}
async function handleCoverUpload(file: File) {
  coverUploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await authedFetch('/files/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { url: string };
    coverImage.value = data.url;
    ElMessage.success('封面上传成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '上传封面失败');
  } finally {
    coverUploading.value = false;
  }
}

// ===== AI 辅助编写逻辑（直连 /ai/scenario-assist，禁止前端直连 LLM） =====
const aiHistories = ref<Partial<Record<AiWriteKey, Partial<ScenarioDraft>>>>({});
const flashKey = ref<AiWriteKey | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const aiRunning = ref(false);
const aiOpen = ref(false);
const aiPhase = ref(0);
const aiProgress = ref(3);
const polishTarget = ref<PolishFieldKey | null>(null);
let aiAbort: AbortController | null = null;

const notConfiguredOpen = ref(false);
const quickFillOpen = ref(false);
const confirmRegenOpen = ref(false);
const quickFill = reactive({ name: '', background: '' });

const updatedCount = computed(() => AI_WRITE_KEYS.filter((k) => aiHistories.value[k] !== undefined).length);

function aiUpdated(key: AiWriteKey): boolean {
  return aiHistories.value[key] !== undefined;
}

function flashField(key: AiWriteKey) {
  flashKey.value = key;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashKey.value = null;
  }, 1400);
}

function snapshotField(key: AiWriteKey): Partial<ScenarioDraft> {
  switch (key) {
    case 'name':
      return { name: form.name };
    case 'background':
      return { background: form.background };
    case 'difficulty':
      return { difficulty: form.difficulty };
    case 'industry':
      return { industryIds: [...form.industryIds] };
    case 'profession':
      return { professionIds: [...form.professionIds] };
    case 'position':
      return { careerPositionId: form.careerPositionId };
  }
}

function applyAiUpdate(data: Partial<ScenarioDraft>) {
  if (data.name !== undefined) form.name = data.name;
  if (data.background !== undefined) form.background = data.background;
  if (data.difficulty !== undefined) form.difficulty = data.difficulty;
  if (data.industryIds !== undefined) form.industryIds = [...data.industryIds];
  if (data.professionIds !== undefined) form.professionIds = [...data.professionIds];
  if (data.careerPositionId !== undefined) form.careerPositionId = data.careerPositionId;
}

function writeField(key: AiWriteKey, values: Partial<ScenarioDraft>) {
  if (aiHistories.value[key] === undefined) {
    aiHistories.value = { ...aiHistories.value, [key]: snapshotField(key) };
  }
  applyAiUpdate(values);
  flashField(key);
}

function restoreField(key: AiWriteKey) {
  const snap = aiHistories.value[key];
  if (snap !== undefined) applyAiUpdate(snap);
  const next = { ...aiHistories.value };
  delete next[key];
  aiHistories.value = next;
}

function handleRestoreAll() {
  const snaps = AI_WRITE_KEYS.map((k) => aiHistories.value[k]).filter(
    (s): s is Partial<ScenarioDraft> => s !== undefined
  );
  if (snaps.length > 0) {
    applyAiUpdate(Object.assign({}, ...snaps) as Partial<ScenarioDraft>);
  }
  aiHistories.value = {};
  ElMessage.success('已全部恢复 AI 覆盖前的内容');
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function markNotConfigured(err: unknown): boolean {
  if (err instanceof Error && err.message === 'ai_not_configured') {
    notConfiguredOpen.value = true;
    return true;
  }
  return false;
}

function resolveIndustryNames(ids: string[]): string[] {
  return ids.map((id) => industries.value.find((i) => i.id === id)?.name || '').filter(Boolean);
}

function resolveMajorNames(ids: string[]): string[] {
  return ids.map((id) => majors.value.find((m) => m.id === id)?.name || '').filter(Boolean);
}

function buildAiBody(): AIScenarioAssistBody {
  return {
    field: 'polish',
    scenario: {
      name: form.name,
      background: form.background,
      difficulty: form.difficulty,
      industryNames: resolveIndustryNames(form.industryIds),
      professionNames: resolveMajorNames(form.professionIds),
      positionId: form.careerPositionId,
      positionName: form.careerPositionId
        ? positions.value.find((p) => p.id === form.careerPositionId)?.name || ''
        : '',
      taskName: '',
      taskBackground: '',
      taskDescription: '',
      taskDifficulty: 0,
      existingTasks: [],
      intention: ''
    }
  };
}

async function scenarioAiAssist(body: AIScenarioAssistBody, signal?: AbortSignal) {
  return request<AIScenarioAssistResponse>('/ai/scenario-assist', {
    method: 'POST',
    body: JSON.stringify(body),
    ...(signal ? { signal } : {})
  });
}

function applyDictSuggestions(key: 'industry' | 'profession', suggestions?: AIScenarioSuggestion[]) {
  if (!suggestions || suggestions.length === 0) return;
  const matched = suggestions.filter((s) => s.matchedId);
  const unmatched = suggestions.filter((s) => !s.matchedId);
  if (matched.length > 0) {
    const current = key === 'industry' ? form.industryIds : form.professionIds;
    const next = [...current];
    for (const s of matched) {
      if (s.matchedId && !next.includes(s.matchedId)) next.push(s.matchedId);
    }
    writeField(key, key === 'industry' ? { industryIds: next } : { professionIds: next });
  }
  if (unmatched.length > 0) {
    ElMessage.warning(
      `以下${key === 'industry' ? '行业' : '专业'}未在字典中找到，请手动选择：${unmatched.map((s) => s.name).join('、')}`
    );
  }
}

function applyPositionSuggestion(suggestion?: AIScenarioSuggestion) {
  if (!suggestion) return;
  if (suggestion.matchedId) {
    writeField('position', { careerPositionId: suggestion.matchedId });
    return;
  }
  ElMessage.warning(`AI 建议的目标岗位「${suggestion.name}」未在系统中找到，请手动选择`);
}

function polishFieldLabel(key: PolishFieldKey): string {
  return { name: '场景名称', background: '场景介绍', difficulty: '难度等级' }[key];
}

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
  applyDictSuggestions('industry', res.industrySuggestions);
  applyDictSuggestions('profession', res.professionSuggestions);
  applyPositionSuggestion(res.positionSuggestion);
}

/** 一键流程：polish 一次生成全部可写字段（3 文本字段 + 行业/专业建议），进度弹窗展示 */
async function runAiAssist() {
  notConfiguredOpen.value = false;
  aiAbort = new AbortController();
  aiRunning.value = true;
  aiOpen.value = true;
  aiPhase.value = 0;
  aiProgress.value = 3;
  try {
    const res = await scenarioAiAssist(buildAiBody(), aiAbort.signal);
    aiPhase.value = 1;
    aiProgress.value = 100;
    applyPolish(res);
  } catch (err) {
    if (isAbortError(err) || aiAbort.signal.aborted) return;
    if (markNotConfigured(err)) return;
    ElMessage.error((err as Error).message || 'AI 生成失败');
  } finally {
    aiRunning.value = false;
    aiOpen.value = false;
    aiAbort = null;
  }
}

/** 基础信息单字段生成：调 polish 一次，仅应用目标字段（不弹进度弹窗） */
async function handlePolishField(target: PolishFieldKey) {
  polishTarget.value = target;
  aiRunning.value = true;
  try {
    const res = await scenarioAiAssist(buildAiBody());
    const p = res.polish;
    if (!p) {
      ElMessage.info(`AI 未生成${polishFieldLabel(target)}，已保留原内容`);
      return;
    }
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
  } catch (err) {
    if (markNotConfigured(err)) return;
    ElMessage.error((err as Error).message || 'AI 生成失败');
  } finally {
    aiRunning.value = false;
    polishTarget.value = null;
  }
}

function cancelAi() {
  if (aiAbort) aiAbort.abort();
}

function onAiDialogClose() {
  // 运行中关闭弹窗视为取消流水线（对齐 React useAiPipeline.handleOpenChange）
  if (aiRunning.value) cancelAi();
}

function getMissingFields(): string[] {
  const missing: string[] = [];
  if (!form.name.trim()) missing.push('场景名称');
  if (!form.background.trim()) missing.push('场景介绍');
  return missing;
}

function startAiAssist() {
  if (getMissingFields().length > 0) {
    quickFill.name = form.name;
    quickFill.background = form.background;
    quickFillOpen.value = true;
    return;
  }
  confirmRegenOpen.value = true;
}

function confirmQuickFillAndStartAi() {
  if (quickFill.name.trim()) form.name = quickFill.name.trim();
  if (quickFill.background.trim()) form.background = quickFill.background.trim();
  quickFillOpen.value = false;
  runAiAssist();
}

function confirmRegenAndRun() {
  confirmRegenOpen.value = false;
  runAiAssist();
}

onMounted(loadAll);
</script>

<style scoped>
.edit-page {
  padding: 16px;
}
.header-card {
  margin-bottom: 16px;
}
.header-card :deep(.el-card__body) {
  padding: 12px 16px;
}
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}
.page-title h1 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}
.page-title p {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 16px;
}
.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 1024px) {
  .layout {
    grid-template-columns: 2fr 1fr;
    align-items: start;
  }
}
.main-col,
.side-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ai-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.ai-entry-text {
  font-size: 13px;
  color: #6b7280;
}
.ai-entry-btn {
  flex-shrink: 0;
  border-color: #d8b4fe;
  color: #7e22ce;
  background: #faf5ff;
}
.ai-entry-btn:hover {
  background: #f3e8ff;
  border-color: #c084fc;
  color: #6b21a8;
}
.ai-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #d8b4fe;
  background: #faf5ff;
  border-radius: 8px;
  padding: 12px 16px;
}
.ai-banner-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #581c87;
  min-width: 0;
}
.ai-banner-text .el-icon {
  color: #9333ea;
  flex-shrink: 0;
}
.ai-banner-btn {
  border-color: #d8b4fe;
  color: #7e22ce;
  flex-shrink: 0;
}
.basic-form {
  max-width: none;
}
.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ai-badge {
  border-color: #d8b4fe;
  color: #7e22ce;
  background: #faf5ff;
}
.ai-restore,
.ai-gen {
  padding: 0 4px;
  height: 20px;
  color: #7e22ce;
}
.field-body {
  width: 100%;
  border-radius: 6px;
  transition: box-shadow 0.3s ease;
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
.block-label {
  font-size: 14px;
  color: #374151;
  margin-bottom: 12px;
}
.cover-box {
  position: relative;
  aspect-ratio: 16 / 9;
  border: 2px dashed #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}
.cover-box:hover {
  background: #f3f4f6;
}
.cover-box.uploading {
  pointer-events: none;
}
.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 13px;
}
.cover-remove {
  margin-top: 8px;
}
.side-card :deep(.el-card__body) {
  padding: 16px;
}
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.info-label {
  font-size: 12px;
  color: #6b7280;
}
.info-value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}
.dialog-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0 0 8px;
}
.ai-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}
.ai-progress-icon {
  color: #9333ea;
}
.ai-progress-text {
  font-size: 13px;
  color: #374151;
  margin: 0;
}
.ai-step-text {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
}
.ai-progress :deep(.el-progress) {
  width: 100%;
}
</style>

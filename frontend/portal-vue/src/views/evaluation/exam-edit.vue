<template>
  <div class="composer-page">
    <!-- 返回按钮 -->
    <div class="back-bar">
      <el-button link @click="onBack">
        <el-icon><ArrowLeft /></el-icon>{{ isPreview ? '返回' : '返回组卷列表' }}
      </el-button>
    </div>

    <!-- 加载 / 错误 / 不存在 -->
    <div v-if="loading" v-loading="true" class="state-panel" />
    <div v-else-if="loadError && !exam" class="state-panel">
      <p class="state-title">加载失败</p>
      <p class="state-desc">{{ loadError }}</p>
      <el-button type="primary" @click="loadExam">重试</el-button>
    </div>
    <div v-else-if="!exam" class="state-panel">
      <p class="state-title">试卷不存在</p>
      <p class="state-desc">该试卷可能已被删除</p>
      <el-button @click="onBack">返回组卷列表</el-button>
    </div>

    <template v-else>
      <!-- 试卷信息卡片 -->
      <el-card shadow="never" class="info-card">
        <div class="info-head">
          <div class="info-left">
            <img v-if="exam.coverImage" :src="exam.coverImage" class="cover" alt="封面" />
            <div v-else class="cover cover-empty">暂无封面</div>
            <div class="info-main">
              <div class="info-title-row">
                <span class="info-title">{{ exam.name }}</span>
                <el-tag size="small" type="info">{{ exam.version }}</el-tag>
              </div>
              <p class="info-desc">{{ exam.description || '暂无描述' }}</p>
            </div>
          </div>
          <div v-if="!isPreview" class="info-actions">
            <el-button v-if="canEdit" size="small" @click="openForm">编辑信息</el-button>
            <el-button v-if="canPublish" size="small" type="primary" @click="onPublish">发布</el-button>
          </div>
        </div>
        <div class="info-meta">
          <span>创建人：<strong>{{ exam.creatorName || exam.creatorId || '-' }}</strong></span>
          <span>题目数量：<strong>{{ (exam.questions || []).length }}</strong></span>
          <span>总分：<strong>{{ totalScore }} 分</strong></span>
          <span>创建时间：{{ formatDate(exam.createdAt) }}</span>
          <span>更新时间：{{ formatDate(exam.updatedAt) }}</span>
        </div>
        <div v-if="collaboratorNames.length || collaboratorDeptNames.length" class="info-collab">
          <div v-if="collaboratorNames.length" class="collab-row">
            <span class="collab-label">共建人：</span>
            <el-tag v-for="(name, i) in collaboratorNames" :key="i" size="small" type="info">{{ name }}</el-tag>
          </div>
          <div v-if="collaboratorDeptNames.length" class="collab-row">
            <span class="collab-label">共建部门：</span>
            <el-tag v-for="(name, i) in collaboratorDeptNames" :key="i" size="small">{{ name }}</el-tag>
          </div>
        </div>
      </el-card>

      <!-- 工具栏 -->
      <div class="toolbar">
        <div>
          <h3 class="toolbar-title">试卷题目</h3>
          <p class="toolbar-hint">{{ canEdit ? '拖拽调整顺序，点击分值可修改' : '查看试卷题目' }}</p>
        </div>
        <div v-if="canEdit" class="toolbar-actions">
          <el-dropdown trigger="click" @command="onScoreCommand">
            <el-button size="small"><el-icon><Operation /></el-icon>分数配置</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="even">
                  <div><div>均匀分配</div><div class="dd-desc">将 100 分均匀分给每道题，余数从第一题起依次加 1 分</div></div>
                </el-dropdown-item>
                <el-dropdown-item command="type">
                  <div><div>题型分配</div><div class="dd-desc">为每种题型分配总分（合计 100），各题型内均匀分配</div></div>
                </el-dropdown-item>
                <el-dropdown-item command="proportional">
                  <div><div>等比分配</div><div class="dd-desc">按当前每题分数的比例缩放至总分 100 分</div></div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button size="small" @click="randomDialogOpen = true">自动抽题</el-button>
          <el-button size="small" @click="manualDialogOpen = true">手动抽题</el-button>
          <el-dropdown trigger="click" @command="onNewQuestionType">
            <el-button size="small">新增题目<el-icon><ArrowDown /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="t in QUESTION_TYPES" :key="t" :command="t">{{ QUESTION_TYPE_LABELS[t] }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button size="small" disabled title="批量导入题目功能开发中">批量导入题目</el-button>
        </div>
      </div>

      <!-- 题目列表 -->
      <div class="q-area">
        <el-empty v-if="(exam.questions || []).length === 0" description="暂无题目，点击上方按钮抽取或新增题目" :image-size="80" />
        <div v-else class="q-list">
          <div
            v-for="(q, index) in exam.questions"
            :key="q.id"
            class="q-row"
            :class="{ dragging: draggedIndex === index }"
            :draggable="canEdit"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent="onDragOver($event, index)"
            @dragend="onDragEnd"
          >
            <span v-if="canEdit" class="q-grip">⠿</span>
            <span class="q-idx">{{ index + 1 }}.</span>
            <p class="q-content">{{ q.content }}</p>
            <el-tag size="small" :color="typeColor(q.type)" style="color: #fff; border: none">{{ typeLabel(q.type) }}</el-tag>
            <div v-if="canEdit" class="q-score">
              <el-input-number
                :model-value="editScores[q.questionId] ?? q.score"
                :min="0.5"
                :step="0.5"
                size="small"
                controls-position="right"
                @update:model-value="(v: number | undefined) => onScoreInput(q.questionId, v)"
                @change="() => commitScore(q.questionId)"
              />
              <span class="q-score-unit">分</span>
            </div>
            <span v-else class="q-score-text">{{ q.score }} 分</span>
            <el-button link size="small" @click="previewQuestion = q">预览</el-button>
            <el-button v-if="canEdit" link type="danger" size="small" @click="deleteConfirm = q">移除</el-button>
          </div>
        </div>
      </div>
    </template>

    <!-- 编辑信息弹窗 -->
    <el-dialog v-model="formOpen" title="编辑试卷" width="560px" append-to-body @open="initForm">
      <el-form label-width="90px">
        <el-form-item label="试卷名称" required>
          <el-input v-model="form.name" placeholder="请输入试卷名称" />
        </el-form-item>
        <el-form-item label="试卷简介">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入试卷简介（可选）" />
        </el-form-item>
        <el-form-item label="时长(分)">
          <el-input-number v-model="form.duration" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="封面">
          <div class="cover-uploader">
            <img v-if="form.coverUrl" :src="form.coverUrl" class="cover-preview" alt="封面" />
            <div v-else class="cover-preview cover-empty">暂无封面</div>
            <div class="cover-actions">
              <el-button size="small" :loading="formCoverUploading" @click="triggerCoverInput">上传封面</el-button>
              <el-button v-if="form.coverUrl" size="small" @click="form.coverUrl = ''">移除</el-button>
            </div>
            <input ref="coverInput" type="file" accept="image/*" style="display: none" @change="onCoverChange" />
          </div>
        </el-form-item>
        <el-form-item label="共建人">
          <UserSelector v-model="form.collaboratorIds" :exclude-user-ids="exam?.creatorId ? [exam.creatorId] : []" placeholder="点击选择共建人" />
        </el-form-item>
        <el-form-item label="所属批次">
          <el-select v-model="form.batchId" clearable placeholder="选择所属批次" style="width: 100%">
            <el-option v-for="b in formBatches" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="exam" label="当前版本号">
          <el-input :model-value="exam.version" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!form.name.trim()" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 题目预览 -->
    <QuestionPreview v-model="previewOpen" :question="previewQuestion" />

    <!-- 移除确认 -->
    <el-dialog v-model="deleteConfirmOpen" title="移除题目" width="420px" append-to-body>
      <p>确定要从试卷中移除这道题目吗？</p>
      <template #footer>
        <el-button @click="deleteConfirm = null">取消</el-button>
        <el-button type="danger" @click="onRemoveQuestion">移除</el-button>
      </template>
    </el-dialog>

    <!-- 抽题 / 建题 / 分值弹窗 -->
    <RandomQuestionDialog v-model="randomDialogOpen" :selected-question-ids="selectedQuestionIds" @add-questions="handleAddQuestions" />
    <ManualQuestionDialog v-model="manualDialogOpen" :selected-question-ids="selectedQuestionIds" @add-questions="handleAddQuestions" />
    <QuestionFormDialog v-model="questionFormOpen" :default-type="defaultQuestionType" @submit="handleCreateQuestion" />
    <ScoreConfigDialog v-model="scoreTypeDialogOpen" :questions="scoreConfigQuestions" @apply="handleTypeDistribution" />
  </div>
</template>

<script setup lang="ts">
// 组卷页：对齐 React frontend/edu/app/evaluation/exams/[id]/page.tsx（ExamComposerPage）
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowDown, ArrowLeft, Operation } from '@element-plus/icons-vue';
import { examApi, questionApi, questionBankApi, evaluationBatchApi } from '@/api/evaluation';
import { fileApi } from '@/api/import-export';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, QUESTION_TYPE_COLORS } from '@/types/evaluation';
import type { Exam, ExamQuestion, QuestionBank, QuestionFormData, QuestionType } from '@/types/evaluation';
import QuestionPreview from './components/question-preview.vue';
import ScoreConfigDialog from './components/score-config-dialog.vue';
import RandomQuestionDialog from './components/random-question-dialog.vue';
import ManualQuestionDialog from './components/manual-question-dialog.vue';
import QuestionFormDialog from './components/question-form-dialog.vue';
import UserSelector from '@/views/job/position-builder/UserSelector.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const isPreview = route.query.mode === 'preview';

const loading = ref(false);
const loadError = ref<string | null>(null);
const exam = ref<Exam | null>(null);
const banks = ref<QuestionBank[]>([]);
const draftPoolBank = computed(() => banks.value.find((b) => b.isDraftPool === true));

const formOpen = ref(false);
const previewQuestion = ref<ExamQuestion | null>(null);
const deleteConfirm = ref<ExamQuestion | null>(null);
const previewOpen = computed({
  get: () => !!previewQuestion.value,
  set: (v: boolean) => {
    if (!v) previewQuestion.value = null;
  }
});
const deleteConfirmOpen = computed({
  get: () => !!deleteConfirm.value,
  set: (v: boolean) => {
    if (!v) deleteConfirm.value = null;
  }
});
const draggedIndex = ref<number | null>(null);
const randomDialogOpen = ref(false);
const manualDialogOpen = ref(false);
const questionFormOpen = ref(false);
const defaultQuestionType = ref<QuestionType>('single');
const scoreTypeDialogOpen = ref(false);
const editScores = ref<Record<string, number>>({});
const savingScoreId = ref<string | null>(null);

const selectedQuestionIds = computed(() => (exam.value?.questions || []).map((q) => q.questionId));
const totalScore = computed(() => (exam.value?.questions || []).reduce((sum, q) => sum + (q.score || 0), 0));
const scoreConfigQuestions = computed(() =>
  (exam.value?.questions || []).map((q) => ({ questionId: q.questionId, type: q.type }))
);

const collaboratorNames = computed(() =>
  (exam.value?.collaboratorNames || exam.value?.collaboratorIds || []).filter(Boolean)
);
const collaboratorDeptNames = computed(() => (exam.value?.collaboratorDeptIds || []).filter(Boolean));

const canEdit = computed(
  () => !isPreview && !!exam.value && ['draft', 'rejected', 'approved', 'published', 'archived'].includes(exam.value.status)
);
const canPublish = computed(() => !isPreview && !!exam.value && exam.value.status === 'approved');

async function loadExam() {
  loading.value = true;
  loadError.value = null;
  try {
    const data = await examApi.get(id);
    exam.value = data;
  } catch (e) {
    loadError.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

async function loadBanks() {
  try {
    const res = await questionBankApi.list({ limit: 200 });
    banks.value = res.items;
  } catch {
    banks.value = [];
  }
}

async function init() {
  await Promise.all([loadExam(), loadBanks()]);
}

// ─── 编辑信息 ──────────────────────────────────────────────
const form = reactive({ name: '', description: '', duration: 60, coverUrl: '', collaboratorIds: [] as string[], batchId: '' });
const formBatches = ref<{ id: string; name: string }[]>([]);
const formCoverUploading = ref(false);
const coverInput = ref<HTMLInputElement | null>(null);

function openForm() {
  formOpen.value = true;
}

function initForm() {
  if (!exam.value) return;
  form.name = exam.value.name;
  form.description = exam.value.description || '';
  form.duration = exam.value.duration || 60;
  form.coverUrl = exam.value.coverImage || '';
  form.collaboratorIds = exam.value.collaboratorIds || [];
  form.batchId = exam.value.batchId || '';
  loadFormBatches();
}

async function loadFormBatches() {
  try {
    const res = await evaluationBatchApi.list({ limit: 1000 });
    formBatches.value = res.items.map((b) => ({ id: b.id, name: b.name }));
  } catch {
    formBatches.value = [];
  }
}

function triggerCoverInput() {
  coverInput.value?.click();
}

async function onCoverChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 5MB');
    return;
  }
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件');
    return;
  }
  formCoverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    form.coverUrl = res.url;
  } catch (err) {
    ElMessage.error((err as Error).message || '封面上传失败');
  } finally {
    formCoverUploading.value = false;
    input.value = '';
  }
}

async function submitForm() {
  if (!form.name.trim()) return;
  try {
    await examApi.update(id, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      duration: form.duration || 60,
      coverImage: form.coverUrl || undefined,
      collaboratorIds: form.collaboratorIds.length > 0 ? form.collaboratorIds : undefined,
      batchId: form.batchId || undefined
    });
    formOpen.value = false;
    ElMessage.success('保存成功');
    await loadExam();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  }
}

// ─── 发布 ──────────────────────────────────────────────────
async function onPublish() {
  try {
    await examApi.publish(id);
    ElMessage.success('发布成功');
    await loadExam();
  } catch (e) {
    ElMessage.error((e as Error).message || '发布失败');
  }
}

// ─── 题目操作 ──────────────────────────────────────────────
async function handleAddQuestions(questions: { id: string; score?: number }[]) {
  try {
    await Promise.all(questions.map((q) => examApi.addQuestion(id, q.id, q.score ?? 1)));
    await loadExam();
  } catch (e) {
    ElMessage.error((e as Error).message || '添加题目失败');
  }
}

async function handleCreateQuestion(data: QuestionFormData) {
  if (!draftPoolBank.value) {
    ElMessage.warning('草稿题库不存在');
    return;
  }
  try {
    const created = await questionApi.create({
      ...data,
      bankId: draftPoolBank.value.id,
      status: 'draft'
    } as Record<string, unknown> as Parameters<typeof questionApi.create>[0]);
    await examApi.addQuestion(id, created.id, created.score ?? 0);
    await loadExam();
  } catch (e) {
    ElMessage.error((e as Error).message || '创建题目失败');
  }
}

async function onRemoveQuestion() {
  if (!deleteConfirm.value) return;
  try {
    await examApi.removeQuestion(id, deleteConfirm.value.questionId);
    deleteConfirm.value = null;
    await loadExam();
  } catch (e) {
    ElMessage.error((e as Error).message || '移除题目失败');
  }
}

function onScoreInput(questionId: string, v?: number) {
  editScores.value = { ...editScores.value, [questionId]: v ?? 0 };
}

async function commitScore(questionId: string) {
  const raw = editScores.value[questionId];
  if (raw === undefined || raw <= 0) return;
  if (savingScoreId.value === questionId) return;
  savingScoreId.value = questionId;
  try {
    await examApi.updateQuestionScore(id, questionId, raw);
    const next = { ...editScores.value };
    delete next[questionId];
    editScores.value = next;
    await loadExam();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存分值失败');
  } finally {
    savingScoreId.value = null;
  }
}

// ─── 拖拽排序 ──────────────────────────────────────────────
let dragTargetRef: number | null = null;

function onDragStart(e: DragEvent, index: number) {
  draggedIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }
}

async function onDragOver(e: DragEvent, index: number) {
  e.preventDefault();
  if (draggedIndex.value === null || draggedIndex.value === index) return;
  if (dragTargetRef === index) return;
  dragTargetRef = index;
  if (!exam.value?.questions) return;

  const list = [...exam.value.questions];
  const [dragged] = list.splice(draggedIndex.value, 1);
  list.splice(index, 0, dragged);

  // 乐观更新本地顺序
  exam.value.questions = list;
  draggedIndex.value = index;

  try {
    const ordered = list.map((q, i) => ({ ...q, order: i + 1 }));
    await examApi.update(id, {
      name: exam.value.name,
      description: exam.value.description,
      duration: exam.value.duration,
      coverImage: exam.value.coverImage,
      questions: ordered
    } as Record<string, unknown> as Parameters<typeof examApi.update>[1]);
  } catch (e) {
    ElMessage.error((e as Error).message || '排序保存失败');
  }
}

function onDragEnd() {
  draggedIndex.value = null;
  dragTargetRef = null;
}

// ─── 分数分配 ──────────────────────────────────────────────
function onScoreCommand(cmd: string) {
  if (cmd === 'even') handleEvenDistribution();
  else if (cmd === 'type') scoreTypeDialogOpen.value = true;
  else if (cmd === 'proportional') handleProportionalDistribution();
}

async function handleEvenDistribution() {
  const qs = exam.value?.questions || [];
  if (qs.length === 0) return;
  const n = qs.length;
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  const scores: Record<string, number> = {};
  qs.forEach((q, i) => {
    scores[q.questionId] = base + (i < remainder ? 1 : 0);
  });
  await applyBulkScores(scores);
}

async function handleProportionalDistribution() {
  const qs = exam.value?.questions || [];
  if (qs.length === 0) return;
  const total = qs.reduce((sum, q) => sum + (q.score || 0), 0);
  if (total <= 0) {
    await handleEvenDistribution();
    return;
  }
  const raw = qs.map((q) => ((q.score || 0) / total) * 100);
  const floored = raw.map((r) => Math.floor(r));
  let sumFloored = floored.reduce((s, v) => s + v, 0);
  const remainders = raw.map((r, i) => ({ idx: i, rem: r - Math.floor(r) }));
  remainders.sort((a, b) => b.rem - a.rem);
  let ri = 0;
  while (sumFloored < 100 && ri < remainders.length) {
    floored[remainders[ri].idx]++;
    sumFloored++;
    ri++;
  }
  const scores: Record<string, number> = {};
  qs.forEach((q, i) => {
    scores[q.questionId] = floored[i];
  });
  await applyBulkScores(scores);
}

async function handleTypeDistribution(scores: Record<string, number>) {
  await applyBulkScores(scores);
}

async function applyBulkScores(scores: Record<string, number>) {
  try {
    await examApi.updateQuestionScores(id, scores);
    await loadExam();
  } catch (e) {
    ElMessage.error((e as Error).message || '分数分配失败');
  }
}

// ─── 新增题目 ──────────────────────────────────────────────
function onNewQuestionType(t: string | number | object) {
  defaultQuestionType.value = t as QuestionType;
  questionFormOpen.value = true;
}

// ─── 工具 ─────────────────────────────────────────────────
function typeLabel(t: QuestionType): string {
  return QUESTION_TYPE_LABELS[t] || t;
}
function typeColor(t: QuestionType): string {
  return QUESTION_TYPE_COLORS[t] || '#909399';
}
function formatDate(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function onBack() {
  router.push('/evaluation/exams');
}

init();
</script>

<style scoped>
.composer-page {
  padding: 12px 16px 24px;
}
.back-bar {
  margin-bottom: 8px;
}
.state-panel {
  min-height: 40vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.state-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.state-desc {
  color: #909399;
  margin: 0 0 8px;
}
.info-card {
  margin-bottom: 12px;
}
.info-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.info-left {
  display: flex;
  gap: 14px;
  flex: 1;
  min-width: 0;
}
.cover {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #909399;
  font-size: 12px;
}
.info-main {
  flex: 1;
  min-width: 0;
}
.info-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.info-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.info-desc {
  margin: 8px 0 0;
  color: #909399;
  font-size: 13px;
}
.info-actions {
  display: flex;
  gap: 8px;
}
.info-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin-top: 12px;
  font-size: 13px;
  color: #909399;
}
.info-meta strong {
  color: #303133;
}
.info-collab {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
}
.collab-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.collab-label {
  font-size: 13px;
  color: #909399;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 12px;
}
.toolbar-title {
  margin: 0;
  font-size: 15px;
  color: #303133;
}
.toolbar-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
}
.dd-desc {
  font-size: 11px;
  color: #909399;
}
.q-area {
  min-height: 200px;
}
.q-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.q-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px 12px;
  transition: all 0.2s;
}
.q-row:hover {
  border-color: #a0cfff;
}
.q-row.dragging {
  opacity: 0.5;
}
.q-grip {
  color: #c0c4cc;
  cursor: move;
}
.q-idx {
  width: 20px;
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}
.q-content {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.q-score {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.q-score :deep(.el-input-number) {
  width: 90px;
}
.q-score-unit {
  font-size: 12px;
  color: #909399;
}
.q-score-text {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}
.cover-uploader {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cover-preview {
  width: 96px;
  height: 72px;
  border-radius: 6px;
  object-fit: cover;
}
.cover-actions {
  display: flex;
  gap: 8px;
}
</style>

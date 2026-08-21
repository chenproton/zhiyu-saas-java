<template>
  <div class="bank-page">
    <!-- 返回按钮 -->
    <div class="back-bar">
      <el-button link @click="onBack"><el-icon><ArrowLeft /></el-icon>返回题库列表</el-button>
    </div>

    <div v-if="loading" v-loading="true" class="state-panel" />
    <div v-else-if="!bank" class="state-panel">
      <p class="state-title">题库不存在</p>
      <p class="state-desc">该题库可能已被删除</p>
      <el-button @click="onBack">返回题库列表</el-button>
    </div>

    <template v-else>
      <!-- 题库信息卡片 -->
      <el-card shadow="never" class="info-card">
        <div class="info-head">
          <div class="info-left">
            <img v-if="bank.coverImage" :src="bank.coverImage" class="cover" alt="封面" />
            <div v-else class="cover cover-empty">暂无封面</div>
            <div class="info-main">
              <div class="info-title-row">
                <span class="info-title">{{ bank.name }}</span>
                <el-tag v-if="isDraftPool" size="small" type="warning">草稿库</el-tag>
                <el-tag size="small" type="info">{{ bank.version }}</el-tag>
              </div>
              <p class="info-desc">{{ bank.description || '暂无描述' }}</p>
            </div>
          </div>
          <div class="info-actions">
            <el-button v-if="!isDraftPool" size="small" @click="bankFormOpen = true">编辑信息</el-button>
          </div>
        </div>
        <div class="info-meta">
          <span>创建人：<strong>{{ bank.creatorName || bank.creatorId || '-' }}</strong></span>
          <span>题目数量：<strong>{{ questions.length }}</strong></span>
          <span>创建时间：{{ formatDate(bank.createdAt) }}</span>
          <span>更新时间：{{ formatDate(bank.updatedAt) }}</span>
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

      <!-- 题目列表标题 + 类型筛选 + 操作 -->
      <div class="list-head">
        <div class="list-head-left">
          <h3 class="list-title">题目列表</h3>
          <el-radio-group v-model="typeFilter" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button v-for="t in QUESTION_TYPES" :key="t" :value="t">{{ QUESTION_TYPE_LABELS[t] }}</el-radio-button>
          </el-radio-group>
        </div>
        <div class="list-head-actions">
          <el-button size="small" @click="importDialogOpen = true"><el-icon><Upload /></el-icon>导入题目</el-button>
          <el-dropdown trigger="click" @command="onAddQuestionType">
            <el-button size="small" type="primary">添加题目<el-icon><ArrowDown /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="t in QUESTION_TYPES" :key="t" :command="t">{{ QUESTION_TYPE_LABELS[t] }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 搜索 + 创建人筛选 + 批量操作 -->
      <div class="filter-bar">
        <div class="filter-left">
          <el-input v-model="search" placeholder="搜索题目内容..." clearable style="width: 260px" />
          <el-select v-if="creators.length > 0" v-model="creatorFilter" placeholder="全部创建人" style="width: 160px">
            <el-option label="全部创建人" value="all" />
            <el-option v-for="c in creators" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </div>
        <div class="filter-actions">
          <el-button size="small" :disabled="selectedQuestions.length === 0 || isExporting" @click="handleBatchExport">
            {{ isExporting ? '导出中...' : '批量导出' }}
          </el-button>
          <el-button size="small" :disabled="selectedQuestions.length === 0" @click="handleBatchCopy">批量复制</el-button>
          <el-button size="small" :disabled="selectedQuestions.length === 0" @click="batchMoveOpen = true">批量移动</el-button>
          <el-button size="small" type="danger" :disabled="selectedQuestions.length === 0" @click="batchDeleteConfirm = true">批量删除</el-button>
        </div>
      </div>

      <!-- 题目表格 -->
      <el-table :data="filteredQuestions" stripe border>
        <el-table-column v-if="canEdit" width="46">
          <template #header>
            <el-checkbox
              :model-value="filteredQuestions.length > 0 && selectedQuestions.length === filteredQuestions.length"
              @change="(v: boolean | string | number) => handleSelectAll(!!v)"
            />
          </template>
          <template #default="{ row }">
            <el-checkbox
              :model-value="selectedQuestions.includes(row.id)"
              @change="(v: boolean | string | number) => handleSelectQuestion(row.id, !!v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="题目内容" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.content }}</template>
        </el-table-column>
        <el-table-column label="题型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :color="typeColor(row.type)" style="color: #fff; border: none">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="难度" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.difficulty" size="small" type="info">{{ difficultyLabel(row.difficulty) }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="添加来源" width="100">
          <template #default="{ row }">{{ row.source || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="previewQuestion = row">预览</el-button>
            <template v-if="canEdit">
              <el-button link type="primary" size="small" @click="handleCopyQuestion(row)">复制</el-button>
              <el-button link type="primary" size="small" @click="handleQuestionEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="deleteConfirm = row">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <!-- 编辑题库信息弹窗 -->
    <el-dialog v-model="bankFormOpen" title="编辑题库" width="560px" append-to-body @open="initBankForm">
      <el-form label-width="90px">
        <el-form-item label="题库名称" required>
          <el-input v-model="bankForm.name" placeholder="请输入题库名称" />
        </el-form-item>
        <el-form-item label="题库简介">
          <el-input v-model="bankForm.description" type="textarea" :rows="3" placeholder="请输入题库简介（可选）" />
        </el-form-item>
        <el-form-item label="封面">
          <div class="cover-uploader">
            <img v-if="bankForm.coverUrl" :src="bankForm.coverUrl" class="cover-preview" alt="封面" />
            <div v-else class="cover-preview cover-empty">暂无封面</div>
            <div class="cover-actions">
              <el-button size="small" :loading="bankCoverUploading" @click="triggerBankCoverInput">上传封面</el-button>
              <el-button v-if="bankForm.coverUrl" size="small" @click="bankForm.coverUrl = ''">移除</el-button>
            </div>
            <input ref="bankCoverInput" type="file" accept="image/*" style="display: none" @change="onBankCoverChange" />
          </div>
        </el-form-item>
        <el-form-item label="共建人">
          <UserSelector v-model="bankForm.collaboratorIds" :exclude-user-ids="bank?.creatorId ? [bank.creatorId] : []" placeholder="点击选择共建人" />
        </el-form-item>
        <el-form-item label="所属批次">
          <el-select v-model="bankForm.batchId" clearable placeholder="选择所属批次" style="width: 100%">
            <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="bank" label="当前版本号">
          <el-input :model-value="bank.version" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bankFormOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!bankForm.name.trim()" @click="submitBankForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 题目编辑弹窗 -->
    <QuestionFormDialog v-model="questionFormOpen" :question="editingQuestion" :default-type="defaultQuestionType" @submit="handleQuestionSubmit" />

    <!-- 题目预览 -->
    <QuestionPreview v-model="previewOpen" :question="previewQuestion" />

    <!-- 删除确认 -->
    <el-dialog v-model="deleteConfirmOpen" title="确认删除" width="420px" append-to-body>
      <p>删除后将无法恢复。确定要删除这道题目吗？</p>
      <template #footer>
        <el-button @click="deleteConfirm = null">取消</el-button>
        <el-button type="danger" @click="handleQuestionDelete">删除</el-button>
      </template>
    </el-dialog>

    <!-- 批量删除确认 -->
    <el-dialog v-model="batchDeleteConfirmOpen" title="批量删除" width="420px" append-to-body>
      <p>确定要删除选中的 {{ selectedQuestions.length }} 道题目吗？此操作不可撤销。</p>
      <template #footer>
        <el-button @click="batchDeleteConfirm = false">取消</el-button>
        <el-button type="danger" @click="handleBatchDelete">删除</el-button>
      </template>
    </el-dialog>

    <!-- 批量移动弹窗 -->
    <el-dialog v-model="batchMoveOpen" title="批量移动题目" width="520px" append-to-body>
      <p class="move-hint">选择目标题库，将选中的 {{ selectedQuestions.length }} 道题目移动过去</p>
      <el-input v-model="moveSearch" placeholder="搜索题库名称..." clearable style="margin-bottom: 10px" />
      <div class="move-list">
        <el-empty v-if="moveCandidates.length === 0" description="暂无其他题库" :image-size="60" />
        <div v-for="b in moveCandidates" :key="b.id" class="move-item" @click="handleBatchMove(b.id)">
          <div class="move-item-icon">📚</div>
          <div>
            <div class="move-item-name">{{ b.name }}</div>
            <div class="move-item-count">{{ b.questionCount ?? 0 }} 题</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="batchMoveOpen = false; moveSearch = ''">取消</el-button>
      </template>
    </el-dialog>

    <!-- 导入弹窗 -->
    <el-dialog v-model="importDialogOpen" title="导入题目" width="520px" append-to-body @closed="resetImport">
      <div class="import-guide">
        <p>1. 点击下方按钮下载最新的导入模板（含系统字典数据）</p>
        <p>2. 参照模板中各 Sheet 的填写说明，填入题目数据</p>
        <p>3. 完成后上传文件</p>
      </div>
      <div class="import-download">
        <el-button :loading="isDownloading" @click="handleDownloadTemplate">下载题目批量导入模板</el-button>
      </div>
      <div class="import-file-pick">
        <input ref="importInput" type="file" accept=".xlsx" style="display: none" @change="onImportFileChange" />
        <el-button @click="importInput?.click()">点击选择已填写的 Excel (.xlsx) 文件</el-button>
        <div v-if="importFiles.length" class="import-file">
          <span>{{ importFiles[0].name }}</span>
          <el-button link type="danger" @click="importFiles = []">移除</el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="importDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="isImporting" :disabled="importFiles.length === 0" @click="handleImport">开始导入</el-button>
      </template>
    </el-dialog>

    <!-- 导入重复确认 -->
    <el-dialog v-model="importConfirmOpen" title="检测到重复题目" width="520px" append-to-body>
      <p class="import-summary">
        成功 {{ importPreview?.created ?? 0 }} 条，重复 {{ importPreview?.duplicates ?? 0 }} 条，失败 {{ importPreview?.failed ?? 0 }} 条
      </p>
      <ul v-if="(importPreview?.duplicateItems || []).length" class="import-dup-list">
        <li v-for="(item, i) in (importPreview?.duplicateItems || []).slice(0, 10)" :key="i">{{ item.name }}</li>
        <li v-if="(importPreview?.duplicateItems || []).length > 10">… 等共 {{ importPreview?.duplicates }} 条</li>
      </ul>
      <template #footer>
        <el-button @click="executeImport('skip')">跳过重复</el-button>
        <el-button @click="executeImport('new')">保留为新题目</el-button>
        <el-button type="primary" @click="executeImport('overwrite')">覆盖已有</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// 题库题目管理页：对齐原 React 版 question-banks/[id]/page.tsx
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowDown, ArrowLeft, Upload } from '@element-plus/icons-vue';
import { questionBankApi, questionApi, evaluationBatchApi } from '@/api/evaluation';
import { fileApi, importExportApi } from '@/api/import-export';
import type { ImportExcelPreviewResult } from '@/api/import-export';
import { downloadBlob } from '@/components/common/content-list-page.types';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, QUESTION_TYPE_COLORS, DIFFICULTY_LABELS } from '@/types/evaluation';
import type { Question, QuestionBank, QuestionFormData, QuestionType } from '@/types/evaluation';
import QuestionPreview from './components/question-preview.vue';
import QuestionFormDialog from './components/question-form-dialog.vue';
import UserSelector from '@/views/job/position-builder/UserSelector.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

const loading = ref(false);
const bank = ref<QuestionBank | null>(null);
const questions = ref<Question[]>([]);
const batches = ref<{ id: string; name: string }[]>([]);
const allBanks = ref<QuestionBank[]>([]);

const search = ref('');
const typeFilter = ref<QuestionType | 'all'>('all');
const creatorFilter = ref('all');
const selectedQuestions = ref<string[]>([]);

const bankFormOpen = ref(false);
const questionFormOpen = ref(false);
const editingQuestion = ref<Question | null>(null);
const defaultQuestionType = ref<QuestionType>('single');
const previewQuestion = ref<Question | null>(null);
const deleteConfirm = ref<Question | null>(null);
const batchDeleteConfirm = ref(false);
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
const batchDeleteConfirmOpen = computed({
  get: () => batchDeleteConfirm.value,
  set: (v: boolean) => {
    batchDeleteConfirm.value = v;
  }
});
const batchMoveOpen = ref(false);
const moveSearch = ref('');
const isExporting = ref(false);

const importDialogOpen = ref(false);
const importFiles = ref<File[]>([]);
const isImporting = ref(false);
const isDownloading = ref(false);
const importConfirmOpen = ref(false);
const importPreview = ref<ImportExcelPreviewResult | null>(null);
const importInput = ref<HTMLInputElement | null>(null);

const isDraftPool = computed(() => bank.value?.isDraftPool === true);
const canEdit = computed(() => !!bank.value && bank.value.status !== 'archived');

const collaboratorNames = computed(() =>
  (bank.value?.collaboratorNames || bank.value?.collaboratorIds || []).filter(Boolean)
);
const collaboratorDeptNames = computed(() => (bank.value?.collaboratorDeptIds || []).filter(Boolean));

const creators = computed(() => {
  const ids = new Set(questions.value.map((q) => q.creatorId).filter(Boolean));
  return Array.from(ids).map((cid) => ({ id: cid as string, name: cid as string }));
});

const filteredQuestions = computed(() =>
  questions.value
    .filter((q) => {
      const matchSearch = q.content.toLowerCase().includes(search.value.toLowerCase());
      const matchType = typeFilter.value === 'all' || q.type === typeFilter.value;
      const matchCreator = creatorFilter.value === 'all' || q.creatorId === creatorFilter.value;
      return matchSearch && matchType && matchCreator;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
);

const moveCandidates = computed(() =>
  allBanks.value.filter(
    (b) => b.id !== id && b.name.toLowerCase().includes(moveSearch.value.toLowerCase())
  )
);

async function loadAll() {
  loading.value = true;
  try {
    const [bankRes, qRes, batchRes, banksRes] = await Promise.all([
      questionBankApi.get(id),
      questionApi.list({ bankId: id, limit: 500 }),
      evaluationBatchApi.list({ limit: 200 }),
      questionBankApi.list({ limit: 200 })
    ]);
    bank.value = bankRes;
    questions.value = qRes.items;
    batches.value = batchRes.items.map((b) => ({ id: b.id, name: b.name }));
    allBanks.value = banksRes.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadQuestions() {
  try {
    const res = await questionApi.list({ bankId: id, limit: 500 });
    questions.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载题目失败');
  }
}

// ─── 题库信息编辑 ──────────────────────────────────────────
const bankForm = reactive({ name: '', description: '', coverUrl: '', collaboratorIds: [] as string[], batchId: '' });
const bankCoverUploading = ref(false);
const bankCoverInput = ref<HTMLInputElement | null>(null);

function initBankForm() {
  if (!bank.value) return;
  bankForm.name = bank.value.name;
  bankForm.description = bank.value.description || '';
  bankForm.coverUrl = bank.value.coverImage || '';
  bankForm.collaboratorIds = bank.value.collaboratorIds || [];
  bankForm.batchId = bank.value.batchId || '';
}

function triggerBankCoverInput() {
  bankCoverInput.value?.click();
}

async function onBankCoverChange(e: Event) {
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
  bankCoverUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    bankForm.coverUrl = res.url;
  } catch (err) {
    ElMessage.error((err as Error).message || '封面上传失败');
  } finally {
    bankCoverUploading.value = false;
    input.value = '';
  }
}

async function submitBankForm() {
  if (!bankForm.name.trim()) return;
  try {
    await questionBankApi.update(id, {
      name: bankForm.name.trim(),
      description: bankForm.description.trim() || undefined,
      coverImage: bankForm.coverUrl || undefined,
      collaboratorIds: bankForm.collaboratorIds.length > 0 ? bankForm.collaboratorIds : undefined,
      batchId: bankForm.batchId || undefined
    });
    bankFormOpen.value = false;
    ElMessage.success('保存成功');
    await loadAll();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  }
}

// ─── 题目增改删 ────────────────────────────────────────────
function onAddQuestionType(t: string | number | object) {
  editingQuestion.value = null;
  defaultQuestionType.value = t as QuestionType;
  questionFormOpen.value = true;
}

function handleQuestionEdit(q: Question) {
  editingQuestion.value = q;
  defaultQuestionType.value = q.type;
  questionFormOpen.value = true;
}

async function handleQuestionSubmit(data: QuestionFormData) {
  try {
    if (editingQuestion.value) {
      await questionApi.update(editingQuestion.value.id, { ...data, bankId: id } as Record<string, unknown> as Parameters<typeof questionApi.update>[1]);
    } else {
      await questionApi.create({ ...data, bankId: id, status: 'draft' } as Record<string, unknown> as Parameters<typeof questionApi.create>[0]);
    }
    editingQuestion.value = null;
    await loadQuestions();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  }
}

async function handleQuestionDelete() {
  if (!deleteConfirm.value) return;
  try {
    await questionApi.delete(deleteConfirm.value.id);
    deleteConfirm.value = null;
    ElMessage.success('删除成功');
    await loadQuestions();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function handleCopyQuestion(q: Question) {
  try {
    await questionApi.create({
      type: q.type,
      content: q.content + ' (复制)',
      options: q.options,
      answer: q.answer,
      analysis: q.analysis,
      score: q.score,
      difficulty: q.difficulty,
      knowledgePoints: q.knowledgePoints,
      bankId: id
    } as Record<string, unknown> as Parameters<typeof questionApi.create>[0]);
    await loadQuestions();
  } catch (e) {
    ElMessage.error((e as Error).message || '复制失败');
  }
}

// ─── 选择 ─────────────────────────────────────────────────
function handleSelectAll(checked: boolean) {
  selectedQuestions.value = checked ? filteredQuestions.value.map((q) => q.id) : [];
}
function handleSelectQuestion(qid: string, checked: boolean) {
  selectedQuestions.value = checked
    ? [...selectedQuestions.value, qid]
    : selectedQuestions.value.filter((x) => x !== qid);
}

// ─── 批量操作 ──────────────────────────────────────────────
async function handleBatchDelete() {
  const ids = [...selectedQuestions.value];
  if (ids.length === 0) return;
  const results = await Promise.allSettled(ids.map((qid) => questionApi.delete(qid)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  selectedQuestions.value = [];
  batchDeleteConfirm.value = false;
  if (failed === 0) {
    ElMessage.success(`已批量删除 ${ids.length} 道题目`);
  } else {
    ElMessage.error(`批量删除部分失败：成功 ${ids.length - failed} 道，失败 ${failed} 道`);
  }
  await loadQuestions();
}

async function handleBatchCopy() {
  const toCopy = selectedQuestions.value
    .map((qid) => questions.value.find((q) => q.id === qid))
    .filter((q): q is Question => !!q);
  if (toCopy.length === 0) return;
  const results = await Promise.allSettled(
    toCopy.map((q) =>
      questionApi.create({
        type: q.type,
        content: q.content + ' (复制)',
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        score: q.score,
        difficulty: q.difficulty,
        knowledgePoints: q.knowledgePoints,
        bankId: id
      } as Record<string, unknown> as Parameters<typeof questionApi.create>[0])
    )
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  selectedQuestions.value = [];
  if (failed === 0) {
    ElMessage.success(`已批量复制 ${toCopy.length} 道题目`);
  } else {
    ElMessage.error(`批量复制部分失败：成功 ${toCopy.length - failed} 道，失败 ${failed} 道`);
  }
  await loadQuestions();
}

async function handleBatchMove(targetBankId: string) {
  const ids = [...selectedQuestions.value];
  try {
    await Promise.all(
      ids.map((qid) => {
        const q = questions.value.find((item) => item.id === qid);
        if (!q) return Promise.resolve();
        return questionApi.update(qid, {
          type: q.type,
          content: q.content,
          options: q.options,
          answer: q.answer,
          analysis: q.analysis,
          score: q.score,
          difficulty: q.difficulty,
          knowledgePoints: q.knowledgePoints,
          bankId: targetBankId
        } as Record<string, unknown> as Parameters<typeof questionApi.update>[1]);
      })
    );
    selectedQuestions.value = [];
    batchMoveOpen.value = false;
    moveSearch.value = '';
    ElMessage.success('移动成功');
    await loadQuestions();
  } catch (e) {
    ElMessage.error((e as Error).message || '批量移动失败');
  }
}

async function handleBatchExport() {
  if (selectedQuestions.value.length === 0) return;
  isExporting.value = true;
  try {
    const res = await importExportApi.exportQuestionsExcel(id, selectedQuestions.value);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    downloadBlob(blob, `题目导出_${id}.xlsx`);
    ElMessage.success(`已导出 ${selectedQuestions.value.length} 道题目`);
  } catch (e) {
    ElMessage.error((e as Error).message || '导出失败');
  } finally {
    isExporting.value = false;
  }
}

// ─── Excel 导入 ────────────────────────────────────────────
function onImportFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) importFiles.value = [file];
  input.value = '';
}

function resetImport() {
  importFiles.value = [];
  importPreview.value = null;
  importConfirmOpen.value = false;
}

async function handleDownloadTemplate() {
  isDownloading.value = true;
  try {
    const res = await importExportApi.downloadQuestionTemplate(id);
    downloadBlob(await res.blob(), '题目批量导入模板.xlsx');
  } catch (e) {
    ElMessage.error((e as Error).message || '下载模板失败');
  } finally {
    isDownloading.value = false;
  }
}

async function handleImport() {
  const file = importFiles.value[0];
  if (!file) return;
  isImporting.value = true;
  try {
    const preview = await importExportApi.importExcelPreview(`question-banks/${id}/questions`, file);
    if (preview.duplicates > 0) {
      importPreview.value = preview;
      importConfirmOpen.value = true;
      isImporting.value = false;
      return;
    }
    await executeImport('skip');
  } catch (e) {
    ElMessage.error((e as Error).message || '导入失败');
    isImporting.value = false;
  }
}

async function executeImport(mode: 'skip' | 'overwrite' | 'new') {
  const file = importFiles.value[0];
  if (!file) return;
  isImporting.value = true;
  try {
    const result = await importExportApi.importExcel(
      `question-banks/${id}/questions`,
      file,
      mode === 'overwrite',
      mode === 'new'
    );
    const errorHint = result.errors && result.errors.length > 0 ? `，错误：${result.errors.slice(0, 3).join(';')}` : '';
    const permissionHint = result.permissionSkipped && result.permissionSkipped > 0 ? `，${result.permissionSkipped} 个题目非本人创建，已跳过覆盖` : '';
    ElMessage.success(
      `导入完成：成功 ${result.created} 条，失败 ${result.failed || 0} 条，跳过 ${result.skipped || 0} 条${permissionHint}${errorHint}`
    );
    resetImport();
    importDialogOpen.value = false;
    await loadQuestions();
  } catch (e) {
    ElMessage.error((e as Error).message || '导入失败');
  } finally {
    isImporting.value = false;
  }
}

// ─── 工具 ─────────────────────────────────────────────────
function typeLabel(t: QuestionType): string {
  return QUESTION_TYPE_LABELS[t] || t;
}
function typeColor(t: QuestionType): string {
  return QUESTION_TYPE_COLORS[t] || '#909399';
}
function difficultyLabel(d: string): string {
  return DIFFICULTY_LABELS[d] || d;
}
function formatDate(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function onBack() {
  router.push('/evaluation/question-banks');
}

loadAll();
</script>

<style scoped>
.bank-page {
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
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.list-head-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.list-title {
  margin: 0;
  font-size: 15px;
  color: #303133;
}
.list-head-actions {
  display: flex;
  gap: 8px;
}
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 10px;
}
.filter-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-actions {
  display: flex;
  gap: 8px;
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
.move-hint {
  margin: 0 0 8px;
  color: #909399;
  font-size: 13px;
}
.move-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.move-item {
  display: flex;
  gap: 10px;
  align-items: center;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.move-item:hover {
  border-color: #a0cfff;
  background: #f7fbff;
}
.move-item-icon {
  font-size: 18px;
}
.move-item-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.move-item-count {
  font-size: 12px;
  color: #909399;
}
.import-guide {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.import-guide p {
  margin: 0 0 4px;
  font-size: 13px;
  color: #606266;
}
.import-guide p:last-child {
  margin-bottom: 0;
}
.import-download {
  margin-bottom: 12px;
}
.import-file-pick {
  display: flex;
  align-items: center;
  gap: 12px;
}
.import-file {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}
.import-summary {
  font-size: 14px;
  color: #303133;
}
.import-dup-list {
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  padding-left: 18px;
  color: #606266;
  font-size: 13px;
}
</style>

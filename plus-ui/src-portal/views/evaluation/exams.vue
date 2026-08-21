<template>
  <ContentListPage :config="config">
    <template #list="slot">
      <el-card shadow="never" class="exam-table-card">
        <el-table :data="slot.items" stripe>
          <el-table-column width="46">
            <template #header>
              <el-checkbox
                :model-value="allSelected(slot)"
                :indeterminate="someSelected(slot)"
                @change="slot.handleSelectAll($event as boolean)"
              />
            </template>
            <template #default="{ row }">
              <el-checkbox
                :model-value="slot.selectedIds.includes(row.id)"
                @change="slot.handleSelectId(row.id, $event as boolean)"
              />
            </template>
          </el-table-column>

          <el-table-column label="试卷名称" min-width="180">
            <template #default="{ row }">
              <router-link :to="`/evaluation/exams/${row.id}/edit`" class="name-link">
                {{ row.name }}
              </router-link>
              <el-tag v-if="row.isDraftPool" size="small" type="warning" class="draft-tag">草稿库</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="试卷编码" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.code || String(row.id).slice(0, 8) }}</template>
          </el-table-column>

          <el-table-column label="试卷简介" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.description || '-' }}</template>
          </el-table-column>

          <el-table-column label="题目数量" width="90">
            <template #default="{ row }">{{ row.questionCount ?? 0 }} 题</template>
          </el-table-column>

          <el-table-column label="总分" width="90">
            <template #default="{ row }">{{ row.totalScore ?? 0 }} 分</template>
          </el-table-column>

          <el-table-column label="所属批次" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ batchName(slot, row) }}</template>
          </el-table-column>

          <el-table-column label="创建人" width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.creatorName || row.creatorId || '-' }}</template>
          </el-table-column>

          <el-table-column label="共建人" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ collaboratorNames(row) }}</template>
          </el-table-column>

          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ contentStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="更新时间" width="140">
            <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
          </el-table-column>

          <el-table-column label="操作" min-width="360" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button link type="primary" size="small" @click="goEdit(row)">编辑</el-button>
                <template v-if="slot.activeTab !== 'public'">
                  <el-button v-if="canSubmit(row.status)" link type="primary" size="small" @click="slot.handleSubmitApproval(row)">提交审批</el-button>
                  <el-button v-if="canWithdraw(row.status)" link size="small" @click="slot.handleWithdrawApproval(row)">撤回审批</el-button>
                  <el-button v-if="row.status === 'rejected'" link type="warning" size="small" @click="slot.handleViewRejectReason(row)">驳回原因</el-button>
                  <el-button v-if="canPublish(row.status)" link type="success" size="small" @click="slot.handlePublish(row)">发布</el-button>
                  <el-button v-if="canUnpublish(row.status)" link size="small" @click="slot.handleUnpublish(row)">取消发布</el-button>
                  <el-button v-if="canArchive(row.status)" link size="small" @click="slot.handleArchive(row)">归档</el-button>
                  <el-button link type="primary" size="small" @click="slot.handleInviteCoBuild(row)">协作人</el-button>
                  <el-button link size="small" @click="slot.handleClone(row)">克隆</el-button>
                  <el-button v-if="canDelete(row.status)" link type="danger" size="small" @click="slot.handleDelete(row)">删除</el-button>
                </template>
                <template v-else>
                  <el-button link size="small" @click="slot.handleClone(row)">克隆</el-button>
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </ContentListPage>

  <!-- 新建试卷对话框（对齐 React ExamFormDialog 的核心字段） -->
  <el-dialog v-model="createDialogOpen" title="新建试卷" width="520px" @closed="resetCreateForm">
    <el-form label-width="90px">
      <el-form-item label="试卷名称" required>
        <el-input v-model="createForm.name" placeholder="请输入试卷名称" />
      </el-form-item>
      <el-form-item label="试卷简介">
        <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="请输入试卷简介（可选）" />
      </el-form-item>
      <el-form-item label="时长(分)">
        <el-input-number v-model="createForm.duration" :min="1" style="width: 100%" />
      </el-form-item>
      <el-form-item label="所属批次">
        <el-select v-model="createForm.batchId" clearable placeholder="选择所属批次" style="width: 100%">
          <el-option v-for="b in createBatches" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createDialogOpen = false">取消</el-button>
      <el-button type="primary" :loading="creating" :disabled="!createForm.name.trim()" @click="handleCreateExam">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import ContentListPage from '@/components/common/content-list-page.vue';
import type {
  ContentApi,
  ContentApprovalApi,
  ContentBatchApi,
  ContentImportExportApi,
  ContentListItem,
  ContentListPageConfig,
  ListSlotProps
} from '@/components/common/content-list-page.types';
import { examApi, evaluationBatchApi } from '@/api/evaluation';
import { approvalApi } from '@/api/approval';
import { importExportApi } from '@/api/import-export';
import { contentStatusLabel } from '@/types/content-status';
import type { Exam } from '@/types/evaluation';

const router = useRouter();

// ─── 状态筛选选项（对齐 React STATUS_FILTER_OPTIONS） ────────────────────────
const STATUS_FILTER_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '审批中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' }
];

// ─── 映射（对齐 React mapExamItem / mapBatch） ───────────────────────────────
function mapExamItem(backend: unknown): ContentListItem {
  const exam = backend as Exam;
  return {
    id: exam.id,
    name: exam.name,
    status: exam.status,
    batchId: exam.batchId,
    creatorId: exam.creatorId,
    coCreatorIds: exam.collaboratorIds || [],
    code: exam.code || '',
    description: exam.description || '',
    questionCount: exam.questionCount ?? (exam.questions || []).length,
    totalScore: exam.totalScore || 0,
    collaboratorNames: exam.collaboratorNames || [],
    creatorName: exam.creatorName || exam.creatorId || '',
    updatedAt: exam.updatedAt
  };
}

function mapBatch(backend: unknown) {
  const b = backend as { id: string; name: string; workflowId?: string };
  return { id: b.id, name: b.name, workflowId: b.workflowId };
}

function createPayload(userId: string): Record<string, unknown> {
  return {
    name: '',
    description: '',
    duration: 60,
    coverImage: '',
    collaboratorIds: [],
    batchId: '',
    status: 'draft',
    ownerType: 'mine',
    version: 'V1.0',
    questions: []
  };
}

const config: ContentListPageConfig = {
  title: '试卷资源管理',
  subtitle: '维护试卷资源，支持组卷、审批、发布与批次分组管理',
  entityLabel: '试卷',
  addHref: '/evaluation/exams',
  permissionModule: 'evaluation',
  permissionResource: 'exams',
  itemApi: examApi as unknown as ContentApi,
  batchApi: evaluationBatchApi as unknown as ContentBatchApi,
  approvalApi: approvalApi as unknown as ContentApprovalApi,
  importExportApi: importExportApi as unknown as ContentImportExportApi,
  approvalTargetType: 'exam',
  importEntityName: 'exams',
  exportEntityName: 'exams',
  importExcelEntity: 'exams',
  coBuilderField: 'collaboratorIds',
  statusFilterOptions: STATUS_FILTER_OPTIONS,
  mapItem: mapExamItem,
  mapBatch,
  createPayload,
  createRedirectUrl: (id: string) => `/evaluation/exams/${id}/edit?new=true`,
  onCreate: () => openCreateDialog()
};

// ─── 新建试卷对话框 ──────────────────────────────────────────────────────────
const createDialogOpen = ref(false);
const creating = ref(false);
const createBatches = ref<{ id: string; name: string }[]>([]);
const createForm = reactive({ name: '', description: '', duration: 60, batchId: '' });

async function openCreateDialog() {
  createDialogOpen.value = true;
  try {
    const res = await evaluationBatchApi.list({ limit: 1000 });
    createBatches.value = res.items.map((b) => ({ id: b.id, name: b.name }));
  } catch {
    createBatches.value = [];
  }
}

function resetCreateForm() {
  createForm.name = '';
  createForm.description = '';
  createForm.duration = 60;
  createForm.batchId = '';
}

async function handleCreateExam() {
  if (!createForm.name.trim()) return;
  creating.value = true;
  try {
    const created = (await examApi.create({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      duration: createForm.duration || 60,
      coverImage: '',
      collaboratorIds: [],
      batchId: createForm.batchId || undefined,
      status: 'draft',
      ownerType: 'mine',
      version: 'V1.0',
      questions: []
    })) as { id: string };
    createDialogOpen.value = false;
    resetCreateForm();
    await router.push(`/evaluation/exams/${created.id}/edit?new=true`);
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败');
  } finally {
    creating.value = false;
  }
}

// ─── 列表展示辅助 ────────────────────────────────────────────────────────────
function batchName(slot: ListSlotProps, row: ContentListItem): string {
  if (!row.batchId) return '-';
  return slot.batchMap[row.batchId] || row.batchId;
}

function collaboratorNames(row: ContentListItem): string {
  const names = ((row as Record<string, unknown>).collaboratorNames as string[] | undefined) || [];
  return names.length > 0 ? names.join('、') : '-';
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function allSelected(slot: { items: ContentListItem[]; selectedIds: string[] }): boolean {
  return slot.items.length > 0 && slot.items.every((i) => slot.selectedIds.includes(i.id));
}

function someSelected(slot: { items: ContentListItem[]; selectedIds: string[] }): boolean {
  return slot.items.some((i) => slot.selectedIds.includes(i.id)) && !allSelected(slot);
}

// ─── 行操作可见性（对齐 React StatusActionBar） ─────────────────────────────
function canSubmit(status: string): boolean {
  return status === 'draft' || status === 'rejected';
}
function canWithdraw(status: string): boolean {
  return status === 'pending';
}
function canPublish(status: string): boolean {
  return status === 'approved';
}
function canUnpublish(status: string): boolean {
  return status === 'published';
}
function canArchive(status: string): boolean {
  return ['draft', 'rejected', 'approved', 'published'].includes(status);
}
function canDelete(status: string): boolean {
  return ['draft', 'rejected', 'archived'].includes(status);
}

function statusTagType(status: string): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  switch (status) {
    case 'published':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'pending':
      return 'primary';
    case 'approved':
      return 'warning';
    default:
      return 'info';
  }
}

function goEdit(row: ContentListItem) {
  router.push(`/evaluation/exams/${row.id}/edit`);
}
</script>

<style scoped>
.exam-table-card :deep(.el-card__body) {
  padding: 0;
}
.name-link {
  display: inline-block;
  color: #409eff;
  text-decoration: none;
  font-weight: 500;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name-link:hover {
  text-decoration: underline;
}
.draft-tag {
  margin-left: 6px;
}
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
}
.row-actions :deep(.el-button + .el-button) {
  margin-left: 8px;
}
</style>

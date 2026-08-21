<template>
  <ContentListPage :config="config">
    <template #list="slot">
      <el-card shadow="never" class="bank-table-card">
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
                :disabled="row.isDraftPool === true"
                @change="slot.handleSelectId(row.id, $event as boolean)"
              />
            </template>
          </el-table-column>

          <el-table-column label="题库名称" min-width="180">
            <template #default="{ row }">
              <router-link :to="`/evaluation/question-banks/${row.id}/edit`" class="name-link">
                {{ row.name }}
              </router-link>
              <el-tag v-if="row.isDraftPool === true" size="small" type="warning" class="draft-tag">草稿库</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="题库编码" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.code || String(row.id).slice(0, 8) }}</template>
          </el-table-column>

          <el-table-column label="题库简介" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.description || '-' }}</template>
          </el-table-column>

          <el-table-column label="题目数量" width="90">
            <template #default="{ row }">{{ row.questionCount ?? 0 }} 题</template>
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
                <template v-if="row.isDraftPool === true">
                  <el-button link type="primary" size="small" @click="goEdit(row)">查看</el-button>
                </template>
                <template v-else>
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
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </ContentListPage>

  <!-- 新建题库对话框（对齐 React BankFormDialog 的核心字段） -->
  <el-dialog v-model="createDialogOpen" title="新建题库" width="520px" @closed="resetCreateForm">
    <el-form label-width="90px">
      <el-form-item label="题库名称" required>
        <el-input v-model="createForm.name" placeholder="请输入题库名称" />
      </el-form-item>
      <el-form-item label="题库简介">
        <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="请输入题库简介（可选）" />
      </el-form-item>
      <el-form-item label="所属批次">
        <el-select v-model="createForm.batchId" clearable placeholder="选择所属批次" style="width: 100%">
          <el-option v-for="b in createBatches" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createDialogOpen = false">取消</el-button>
      <el-button type="primary" :loading="creating" :disabled="!createForm.name.trim()" @click="handleCreateBank">创建</el-button>
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
import { questionBankApi, evaluationBatchApi } from '@/api/evaluation';
import { approvalApi } from '@/api/approval';
import { importExportApi } from '@/api/import-export';
import { contentStatusLabel } from '@/types/content-status';

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

// ─── 映射（对齐 React mapBankItem / mapBatch） ───────────────────────────────
function mapBankItem(backend: any): ContentListItem {
  return {
    id: backend.id,
    name: backend.name,
    status: backend.status,
    batchId: backend.batchId ?? undefined,
    creatorId: backend.creatorId ?? undefined,
    coCreatorIds: backend.collaboratorIds || [],
    code: backend.code || '',
    description: backend.description || '',
    questionCount: backend.questionCount || 0,
    collaboratorNames: backend.collaboratorNames || [],
    creatorName: backend.creatorName || backend.creatorId || '',
    isDraftPool: backend.isDraftPool,
    updatedAt: backend.updatedAt
  };
}

function mapBatch(backend: unknown) {
  const b = backend as { id: string; name: string; workflowId?: string };
  return { id: b.id, name: b.name, workflowId: b.workflowId };
}

function createPayload(): Record<string, unknown> {
  return {
    name: '',
    description: '',
    coverImage: '',
    collaboratorIds: [],
    batchId: '',
    status: 'draft',
    ownerType: 'mine',
    version: 'V1.0'
  };
}

const config: ContentListPageConfig = {
  title: '题库资源管理',
  subtitle: '维护题库及题目资源，支持审批、发布与批次分组管理',
  entityLabel: '题库',
  addHref: '/evaluation/question-banks',
  permissionModule: 'evaluation',
  permissionResource: 'question-banks',
  itemApi: questionBankApi as unknown as ContentApi,
  batchApi: evaluationBatchApi as unknown as ContentBatchApi,
  approvalApi: approvalApi as unknown as ContentApprovalApi,
  importExportApi: importExportApi as unknown as ContentImportExportApi,
  approvalTargetType: 'question_bank',
  importEntityName: 'question_banks',
  exportEntityName: 'question_banks',
  importExcelEntity: 'question-banks',
  coBuilderField: 'collaboratorIds',
  statusFilterOptions: STATUS_FILTER_OPTIONS,
  mapItem: mapBankItem,
  mapBatch,
  createPayload,
  createRedirectUrl: (id: string) => `/evaluation/question-banks/${id}/edit?new=true`,
  onCreate: () => openCreateDialog()
};

// ─── 新建题库对话框 ──────────────────────────────────────────────────────────
const createDialogOpen = ref(false);
const creating = ref(false);
const createBatches = ref<{ id: string; name: string }[]>([]);
const createForm = reactive({ name: '', description: '', batchId: '' });

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
  createForm.batchId = '';
}

async function handleCreateBank() {
  if (!createForm.name.trim()) return;
  creating.value = true;
  try {
    const created = (await questionBankApi.create({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      coverImage: '',
      collaboratorIds: [],
      batchId: createForm.batchId || undefined,
      status: 'draft',
      ownerType: 'mine',
      version: 'V1.0'
    })) as { id: string };
    createDialogOpen.value = false;
    resetCreateForm();
    await router.push(`/evaluation/question-banks/${created.id}/edit?new=true`);
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
  const selectable = slot.items.filter((i) => (i as Record<string, unknown>).isDraftPool !== true);
  return selectable.length > 0 && selectable.every((i) => slot.selectedIds.includes(i.id));
}

function someSelected(slot: { items: ContentListItem[]; selectedIds: string[] }): boolean {
  const selectable = slot.items.filter((i) => (i as Record<string, unknown>).isDraftPool !== true);
  return selectable.some((i) => slot.selectedIds.includes(i.id)) && !allSelected(slot);
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
  router.push(`/evaluation/question-banks/${row.id}/edit`);
}
</script>

<style scoped>
.bank-table-card :deep(.el-card__body) {
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

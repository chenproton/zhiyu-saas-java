<template>
  <ContentListPage :config="config">
    <template #list="slot">
      <el-card shadow="never" class="programs-table-card">
        <el-table :data="slot.items" stripe>
          <el-table-column width="50">
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

          <el-table-column label="方案名称" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="prog-name">{{ row.name }}</div>
              <div v-if="row.code" class="prog-code">{{ row.code }}</div>
            </template>
          </el-table-column>

          <el-table-column label="专业" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.majorName || '-' }}</template>
          </el-table-column>

          <el-table-column label="年级" width="90">
            <template #default="{ row }">{{ row.entryYear }}级</template>
          </el-table-column>

          <el-table-column label="课程数" width="90">
            <template #default="{ row }">{{ row.courseCount ?? '-' }}</template>
          </el-table-column>

          <el-table-column label="批次" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ batchName(slot, row) }}</template>
          </el-table-column>

          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">
                {{ contentStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="操作" min-width="300" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="canEdit(row.status)"
                link
                type="primary"
                size="small"
                @click="goEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                v-for="act in slot.rowActions(row)"
                :key="act.key"
                link
                :type="act.type"
                size="small"
                @click="act.handler"
              >
                {{ act.label }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </ContentListPage>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
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
import { programApi, affairsBatchApi } from '@/api/affairs';
import { approvalApi } from '@/api/approval';
import { importExportApi } from '@/api/import-export';
import type { TrainingProgram } from '@/types/affairs';
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

// ─── 映射（对齐 React mapProgram / mapBatch） ────────────────────────────────
function mapProgram(backend: unknown): ContentListItem {
  const p = backend as TrainingProgram;
  return {
    ...p,
    id: p.id,
    name: p.name,
    status: p.status,
    batchId: p.batchId,
    creatorId: p.createdBy || '',
    coCreatorIds: p.collaborators || [],
    code: p.code,
    majorName: p.majorName,
    entryYear: p.entryYear,
    courseCount: p.courseCount,
    batchName: p.batchName
  };
}

function mapBatch(backend: unknown) {
  const b = backend as { id: string; name: string; workflowId?: string };
  return { id: b.id, name: b.name, workflowId: b.workflowId };
}

function createPayload(): Record<string, unknown> {
  return {
    name: '新建人培方案',
    entryYear: new Date().getFullYear(),
    level: '本科',
    duration: 4,
    totalCredits: 0,
    status: 'draft',
    collaborators: []
  };
}

const config: ContentListPageConfig = {
  title: '人才培养方案',
  subtitle: '维护专业人才培养方案及课程设置，发布后可生成学期教学计划',
  entityLabel: '人培方案',
  addHref: '/affairs/programs',
  permissionModule: 'affairs',
  permissionResource: 'programs',
  itemApi: programApi as unknown as ContentApi,
  batchApi: affairsBatchApi as unknown as ContentBatchApi,
  approvalApi: approvalApi as unknown as ContentApprovalApi,
  importExportApi: importExportApi as unknown as ContentImportExportApi,
  approvalTargetType: 'training_program',
  coBuilderField: 'collaborators',
  createRedirectUrl: (id: string) => `/affairs/programs/${id}/edit`,
  statusFilterOptions: STATUS_FILTER_OPTIONS,
  mapItem: mapProgram,
  mapBatch,
  createPayload
};

// ─── 行展示辅助 ────────────────────────────────────────────────────────────
function batchName(slot: ListSlotProps, row: ContentListItem): string {
  if (!row.batchId) return '-';
  const name = (row as { batchName?: string }).batchName;
  return slot.batchMap[row.batchId] || name || row.batchId;
}

function allSelected(slot: { items: ContentListItem[]; selectedIds: string[] }): boolean {
  return slot.items.length > 0 && slot.items.every((i) => slot.selectedIds.includes(i.id));
}

function someSelected(slot: { items: ContentListItem[]; selectedIds: string[] }): boolean {
  return slot.items.some((i) => slot.selectedIds.includes(i.id)) && !allSelected(slot);
}

// ─── 行操作可见性（对齐 React StatusActionBar 的 EDITABLE_STATUSES） ─────────
const EDITABLE_STATUSES = ['draft', 'rejected', 'approved'];
function canEdit(status: string): boolean {
  return EDITABLE_STATUSES.includes(status);
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

// ─── 导航（对齐 React：详情跳转；Vue 路由为 /affairs/programs/:id/edit） ────
function goEdit(row: ContentListItem) {
  router.push(`/affairs/programs/${row.id}/edit`);
}
</script>

<style scoped>
.programs-table-card :deep(.el-card__body) {
  padding: 0;
}
.prog-name {
  font-weight: 500;
  color: #303133;
}
.prog-code {
  font-size: 12px;
  color: #909399;
}
</style>

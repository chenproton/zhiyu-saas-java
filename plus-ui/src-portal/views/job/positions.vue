<template>
  <ContentListPage :config="config">
    <template #list="slot">
      <el-card shadow="never" class="positions-table-card">
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

          <el-table-column label="岗位名称" min-width="220">
            <template #default="{ row }">
              <router-link class="pos-name" :to="`/job/positions/${row.id}/edit`">
                {{ row.name }}
              </router-link>
              <div class="pos-meta">
                <el-tag :type="statusTagType(row.status)" size="small">
                  {{ contentStatusLabel(row.status) }}
                </el-tag>
                <el-tag v-if="row.sourceType === 'enterprise'" size="small" type="info">
                  企业共建
                </el-tag>
                <span class="pos-version">{{ row.version }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="岗位编码" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.code || String(row.id).slice(0, 8) }}</template>
          </el-table-column>

          <el-table-column label="所属行业" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ industryName(row) }}</template>
          </el-table-column>

          <el-table-column label="所属专业" width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ majorNames(row) }}</template>
          </el-table-column>

          <el-table-column label="所属批次分组" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ batchName(slot, row) }}</template>
          </el-table-column>

          <el-table-column label="共建人员" width="90">
            <template #default="{ row }">{{ collaboratorCount(row) }}</template>
          </el-table-column>

          <el-table-column label="职责数" width="80" align="center">
            <template #default>0</template>
          </el-table-column>

          <el-table-column label="能力绑定" width="80" align="center">
            <template #default="{ row }">{{ row.abilityCount ?? 0 }}</template>
          </el-table-column>

          <el-table-column label="收藏" width="70" align="center">
            <template #default="{ row }">{{ row.favoriteCount ?? 0 }}</template>
          </el-table-column>

          <el-table-column label="操作" min-width="500">
            <template #default="{ row }">
              <template v-if="slot.activeTab === 'public'">
                <el-button link type="primary" size="small" @click="viewDetail(row)">查看详情</el-button>
                <el-button link size="small" @click="slot.handleClone(row)">克隆</el-button>
              </template>
              <template v-else>
                <el-button link type="primary" size="small" @click="viewDetail(row)">查看详情</el-button>
                <el-button v-if="canEdit(row.status)" link size="small" @click="configure(row)">配置能力</el-button>
                <el-button v-if="canEdit(row.status)" link size="small" @click="editPosition(row)">编辑</el-button>
                <el-button link size="small" @click="slot.handleClone(row)">克隆</el-button>
                <el-button v-if="canSubmit(row.status)" link type="primary" size="small" @click="slot.handleSubmitApproval(row)">提交审批</el-button>
                <el-button v-if="canWithdraw(row.status)" link type="warning" size="small" @click="slot.handleWithdrawApproval(row)">撤回审批</el-button>
                <el-button v-if="row.status === 'rejected'" link type="danger" size="small" @click="slot.handleViewRejectReason(row)">查看驳回原因</el-button>
                <el-button v-if="canPublish(row.status)" link type="primary" size="small" @click="slot.handlePublish(row)">发布</el-button>
                <el-button v-if="canUnpublish(row.status)" link type="danger" size="small" @click="slot.handleUnpublish(row)">取消发布</el-button>
                <el-button v-if="canArchive(row.status)" link type="primary" size="small" @click="slot.handleArchive(row)">归档</el-button>
                <el-button link type="primary" size="small" @click="slot.handleInviteCoBuild(row)">邀请共建</el-button>
                <el-button v-if="canDelete(row.status)" link type="danger" size="small" @click="slot.handleDelete(row)">删除</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </ContentListPage>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
import { positionApi, batchApi } from '@/api/job';
import { approvalApi } from '@/api/approval';
import { importExportApi } from '@/api/import-export';
import { industryApi, majorApi } from '@/api/system';
import type { CareerPosition, JobBatch } from '@/types/job';
import type { Industry, Major } from '@/types/system';
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

// ─── 行业 / 专业字典（用于列表展示） ────────────────────────────────────────
const industryMap = ref<Record<string, string>>({});
const majorMap = ref<Record<string, string>>({});

onMounted(async () => {
  try {
    const [indRes, majRes] = await Promise.all([
      industryApi.list({ limit: 1000 }),
      majorApi.list({ limit: 1000 })
    ]);
    const im: Record<string, string> = {};
    (indRes.items as Industry[]).forEach((i) => {
      im[i.id] = i.name;
    });
    industryMap.value = im;
    const mm: Record<string, string> = {};
    (majRes.items as Major[]).forEach((m) => {
      mm[m.id] = m.name;
    });
    majorMap.value = mm;
  } catch {
    // 字典加载失败不阻塞列表
  }
});

// ─── 映射（对齐 React convertCareerPositionToPosition / convertJobBatchToBatch） ─
function mapPosition(backend: unknown): ContentListItem {
  const cp = backend as CareerPosition;
  return {
    id: cp.id,
    name: cp.name,
    status: cp.status,
    batchId: cp.batchId,
    creatorId: cp.createdBy,
    coCreatorIds: cp.collaborators || [],
    code: cp.code,
    version: cp.version,
    shortName: cp.shortName,
    industryId: cp.industryId,
    majorIds: cp.majorIds || [],
    positionType: cp.positionType,
    sourceType: cp.sourceType,
    favoriteCount: cp.favoriteCount ?? 0,
    abilityCount: cp.abilityCount ?? 0,
    collaborators: cp.collaborators || []
  };
}

function mapBatch(backend: unknown) {
  const b = backend as JobBatch;
  return { id: b.id, name: b.name, workflowId: b.workflowId };
}

function draftSuffix(): string {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return `${ds}_${c[Math.floor(Math.random() * 36)]}${c[Math.floor(Math.random() * 36)]}`;
}

function createPayload(userId: string): Record<string, unknown> {
  return {
    name: `新建岗位_${draftSuffix()}`,
    shortName: '新岗位',
    majorIds: [],
    positionType: 'teaching',
    salaryMin: 0,
    salaryMax: 0,
    description: '',
    requirements: [],
    careerPath: '',
    version: 'V1.0',
    status: 'draft',
    createdBy: userId,
    collaborators: []
  };
}

const config: ContentListPageConfig = {
  title: '岗位资源管理',
  subtitle: '维护岗位信息、能力模型等岗位资源管理功能',
  entityLabel: '岗位',
  addHref: '/job/positions',
  permissionModule: 'job',
  permissionResource: 'positions',
  itemApi: positionApi as unknown as ContentApi,
  batchApi: batchApi as unknown as ContentBatchApi,
  approvalApi: approvalApi as unknown as ContentApprovalApi,
  importExportApi: importExportApi as unknown as ContentImportExportApi,
  approvalTargetType: 'career_position',
  importEntityName: 'career_positions',
  exportEntityName: 'career_positions',
  importExcelEntity: 'positions',
  createRedirectUrl: (id: string) => `/job/positions/${id}/edit?new=true`,
  coBuilderField: 'collaborators',
  statusFilterOptions: STATUS_FILTER_OPTIONS,
  mapItem: mapPosition,
  mapBatch,
  createPayload,
  listParams: { positionType: 'teaching' }
};

// ─── 行展示辅助 ────────────────────────────────────────────────────────────
function industryName(row: ContentListItem): string {
  const id = (row as Record<string, unknown>).industryId as string | undefined;
  return id ? industryMap.value[id] || '-' : '-';
}

function majorNames(row: ContentListItem): string {
  const ids = ((row as Record<string, unknown>).majorIds as string[] | undefined) || [];
  if (ids.length === 0) return '-';
  return ids.map((id) => majorMap.value[id] || id).join('，');
}

function batchName(slot: ListSlotProps, row: ContentListItem): string {
  if (!row.batchId) return '-';
  return slot.batchMap[row.batchId] || row.batchId;
}

function collaboratorCount(row: ContentListItem): string {
  const collab = (row as Record<string, unknown>).collaborators as string[] | undefined;
  const n = collab?.length || 0;
  return n > 0 ? `${n}人` : '-';
}

function allSelected(slot: { items: ContentListItem[]; selectedIds: string[] }): boolean {
  return slot.items.length > 0 && slot.items.every((i) => slot.selectedIds.includes(i.id));
}

function someSelected(slot: { items: ContentListItem[]; selectedIds: string[] }): boolean {
  return slot.items.some((i) => slot.selectedIds.includes(i.id)) && !allSelected(slot);
}

// ─── 行操作可见性（对齐 React StatusActionBar） ─────────────────────────────
const EDITABLE_STATUSES = ['draft', 'rejected', 'approved'];

function canEdit(status: string): boolean {
  return EDITABLE_STATUSES.includes(status);
}
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

// ─── 导航（对齐 React：详情 / 编辑 / 配置能力） ─────────────────────────────
function viewDetail(row: ContentListItem) {
  router.push(`/job/landing/${row.id}`);
}
function editPosition(row: ContentListItem) {
  router.push(`/job/positions/${row.id}/edit`);
}
function configure(row: ContentListItem) {
  router.push(`/job/positions/${row.id}/edit?step=2`);
}
</script>

<style scoped>
.positions-table-card :deep(.el-card__body) {
  padding: 0;
}
.pos-name {
  font-weight: 500;
  color: #303133;
  text-decoration: none;
}
.pos-name:hover {
  color: #409eff;
}
.pos-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.pos-version {
  font-size: 12px;
  color: #909399;
}
</style>

<template>
  <ContentListPage :config="config">
    <template
      #list="{
        activeTab,
        items,
        selectedIds,
        handleSelectId,
        handleSelectAll,
        handleClone,
        handleDelete,
        handleSubmitApproval,
        handleWithdrawApproval,
        handleViewRejectReason,
        handlePublish,
        handleUnpublish,
        handleArchive,
        handleInviteCoBuild
      }"
    >
      <el-table :data="items" stripe class="scene-table">
        <el-table-column width="46">
          <template #header>
            <el-checkbox
              :model-value="isAllSelected(items, selectedIds)"
              :indeterminate="isSomeSelected(items, selectedIds)"
              @change="(v: any) => handleSelectAll(v === true)"
            />
          </template>
          <template #default="{ row }">
            <el-checkbox
              :model-value="selectedIds.includes(row.id)"
              @change="(v: any) => handleSelectId(row.id, v === true)"
            />
          </template>
        </el-table-column>

        <el-table-column label="场景名称" min-width="180">
          <template #default="{ row }">
            <router-link :to="`/scene/scenarios/${row.id}/edit`" class="name-link">
              {{ row.name }}
            </router-link>
            <div class="name-badges">
              <el-tag :type="statusTagType(row.status)" size="small" effect="light">
                {{ statusLabel(row.status) }}
              </el-tag>
              <el-tag v-if="row.sourceType === 'enterprise'" size="small" type="info" effect="plain">
                企业共建
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="场景编码" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>

        <el-table-column label="版本" width="70" align="center">
          <template #default="{ row }">{{ row.version || '-' }}</template>
        </el-table-column>

        <el-table-column label="所属岗位" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.positionName || '-' }}</template>
        </el-table-column>

        <el-table-column label="所属批次分组" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.batchName || '-' }}</template>
        </el-table-column>

        <el-table-column label="创建人" width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.creatorName || '-' }}</template>
        </el-table-column>

        <el-table-column label="发布时间" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.publishTime || '-' }}</template>
        </el-table-column>

        <el-table-column label="任务数" width="80" align="center">
          <template #default="{ row }">
            <router-link :to="`/scene/scenarios/${row.id}/edit/tasks`" class="task-link">
              {{ row.taskCount ?? 0 }}
            </router-link>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="470" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button size="small" link type="primary" @click="goLanding(row)">详情</el-button>

              <template v-if="activeTab !== 'public'">
                <el-button v-if="isEditable(row.status)" size="small" link type="primary" @click="goTasks(row)">
                  编排任务
                </el-button>
                <el-button v-if="isEditable(row.status)" size="small" link @click="goEdit(row)">编辑</el-button>
                <el-button size="small" link @click="handleClone(row)">克隆</el-button>
                <el-button
                  v-if="row.status === 'draft' || row.status === 'rejected'"
                  size="small"
                  link
                  type="primary"
                  @click="handleSubmitApproval(row)"
                >
                  提交审批
                </el-button>
                <el-button v-if="row.status === 'pending'" size="small" link @click="handleWithdrawApproval(row)">
                  撤回审批
                </el-button>
                <el-button v-if="row.status === 'rejected'" size="small" link type="warning" @click="handleViewRejectReason(row)">
                  查看驳回原因
                </el-button>
                <el-button v-if="row.status === 'approved'" size="small" link type="success" @click="handlePublish(row)">
                  发布
                </el-button>
                <el-button v-if="row.status === 'published'" size="small" link @click="handleUnpublish(row)">
                  取消发布
                </el-button>
                <el-button
                  v-if="['draft', 'rejected', 'approved', 'published'].includes(row.status)"
                  size="small"
                  link
                  @click="handleArchive(row)"
                >
                  归档
                </el-button>
                <el-button size="small" link type="primary" @click="handleInviteCoBuild(row)">邀请共建</el-button>
                <el-button
                  v-if="['draft', 'rejected', 'archived'].includes(row.status)"
                  size="small"
                  link
                  type="danger"
                  @click="handleDelete(row)"
                >
                  删除
                </el-button>
              </template>

              <template v-else>
                <el-button size="small" link @click="handleClone(row)">克隆</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </ContentListPage>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ContentListPage from '@/components/common/content-list-page.vue';
import type {
  ContentApi,
  ContentApprovalApi,
  ContentBatch,
  ContentBatchApi,
  ContentImportExportApi,
  ContentListItem,
  ContentListPageConfig
} from '@/components/common/content-list-page.types';
import { scenarioApi, sceneBatchApi } from '@/api/scene';
import { approvalApi } from '@/api/approval';
import { importExportApi } from '@/api/import-export';

// ─── 对齐原 React 版 scene/page.tsx 的映射与 payload ──────────────

function generateCode(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}

function draftSuffix(): string {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return `${ds}_${c[Math.floor(Math.random() * 36)]}${c[Math.floor(Math.random() * 36)]}`;
}

function mapScenario(backend: any, _currentUserId: string): ContentListItem {
  return {
    id: backend.id,
    name: backend.name,
    code: backend.code,
    version: backend.version,
    status: backend.status,
    sourceType: backend.sourceType,
    batchId: backend.batchId,
    positionName: '-',
    batchName: undefined,
    creatorName: '-',
    creatorId: backend.creatorId,
    coCreatorIds: backend.coBuilderIds || [],
    publishTime: backend.publishTime,
    taskCount: backend.taskCount || 0
  };
}

function mapSceneBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId };
}

const STATUS_FILTER_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '审批中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' }
];

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending: '审核中',
  approved: '已通过',
  rejected: '已驳回',
  published: '已发布',
  archived: '已归档'
};

const STATUS_TAG_TYPES: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
  draft: 'info',
  pending: 'warning',
  approved: 'primary',
  rejected: 'danger',
  published: 'success',
  archived: 'info'
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function statusTagType(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  return STATUS_TAG_TYPES[status] || 'info';
}

function isEditable(status: string): boolean {
  return ['draft', 'rejected', 'approved'].includes(status);
}

function isAllSelected(items: unknown[], selectedIds: string[]): boolean {
  const list = items as Array<{ id: string }>;
  return list.length > 0 && list.every((i) => selectedIds.includes(i.id));
}

function isSomeSelected(items: unknown[], selectedIds: string[]): boolean {
  const list = items as Array<{ id: string }>;
  return list.some((i) => selectedIds.includes(i.id)) && !isAllSelected(items, selectedIds);
}

const config: ContentListPageConfig = {
  title: '场景大厅',
  subtitle: '管理场景建设资源，支持场景创建、编辑、任务配置、审批发布等全流程管理',
  entityLabel: '场景',
  addHref: '/scene/scenarios',
  permissionModule: 'scene',
  permissionResource: 'scenarios',
  itemApi: scenarioApi as unknown as ContentApi,
  batchApi: sceneBatchApi as unknown as ContentBatchApi,
  approvalApi: approvalApi as unknown as ContentApprovalApi,
  importExportApi: importExportApi as unknown as ContentImportExportApi,
  approvalTargetType: 'scenario',
  importEntityName: 'scenarios',
  exportEntityName: 'scenarios',
  importExcelEntity: 'scenarios',
  statusFilterOptions: STATUS_FILTER_OPTIONS,
  mapItem: mapScenario,
  mapBatch: mapSceneBatch,
  afterLoad: async (items, batches) => {
    const batchMap = new Map(batches.map((b) => [b.id, b.name]));
    return items.map((item) => ({
      ...item,
      batchName: item.batchId ? batchMap.get(item.batchId) || '-' : undefined
    }));
  },
  createRedirectUrl: (id) => `/scene/scenarios/${id}/edit?new=true`,
  coBuilderField: 'coBuilderIds',
  createPayload: (uid) => ({
    name: `新建场景_${draftSuffix()}`,
    code: generateCode('SC'),
    difficulty: 1,
    version: 'V1.0',
    status: 'draft',
    creatorId: uid,
    coBuilderIds: []
  })
};

const router = useRouter();

function goLanding(row: { id: string }) {
  router.push(`/scene/landing/${row.id}`);
}

function goEdit(row: { id: string }) {
  router.push(`/scene/scenarios/${row.id}/edit`);
}

function goTasks(row: { id: string }) {
  router.push(`/scene/scenarios/${row.id}/edit/tasks`);
}
</script>

<style scoped>
.scene-table :deep(.el-table__cell) {
  padding: 8px 0;
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
.name-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.task-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 0 8px;
  height: 22px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #409eff;
  background: rgba(64, 158, 255, 0.08);
  text-decoration: none;
}
.task-link:hover {
  background: rgba(64, 158, 255, 0.16);
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

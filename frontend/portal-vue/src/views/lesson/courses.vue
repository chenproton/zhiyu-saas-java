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
      <el-table :data="items" stripe class="course-table">
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

        <el-table-column label="课程名称" min-width="180">
          <template #default="{ row }">
            <router-link :to="editPath(row)" class="name-link">{{ row.name }}</router-link>
            <div class="name-badges">
              <el-tag :type="statusTagType(row.status)" size="small" effect="light">
                {{ statusLabel(row.status) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="课程编码" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>

        <el-table-column label="版本" width="70" align="center">
          <template #default="{ row }">{{ row.version || '-' }}</template>
        </el-table-column>

        <el-table-column label="所属行业" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.industry || '-' }}</template>
        </el-table-column>

        <el-table-column label="适用专业" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.major || '-' }}</template>
        </el-table-column>

        <el-table-column label="所属批次分组" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.batchName || '-' }}</template>
        </el-table-column>

        <el-table-column label="创建人" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.creator || '-' }}</template>
        </el-table-column>

        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="460" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button size="small" link type="primary" @click="goLanding(row)">查看详情</el-button>

              <template v-if="activeTab !== 'public'">
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
                <el-button v-if="row.status === 'pending'" size="small" link type="warning" @click="handleWithdrawApproval(row)">
                  撤回审批
                </el-button>
                <el-button
                  v-if="row.status === 'rejected'"
                  size="small"
                  link
                  type="danger"
                  @click="handleViewRejectReason(row)"
                >
                  查看驳回原因
                </el-button>
                <el-button v-if="row.status === 'approved'" size="small" link type="primary" @click="handlePublish(row)">
                  发布
                </el-button>
                <el-button v-if="row.status === 'published'" size="small" link type="danger" @click="handleUnpublish(row)">
                  取消发布
                </el-button>
                <el-button
                  v-if="['draft', 'rejected', 'approved', 'published'].includes(row.status)"
                  size="small"
                  link
                  type="primary"
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
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
import { courseApi, lessonBatchApi } from '@/api/lesson';
import { approvalApi } from '@/api/approval';
import { importExportApi } from '@/api/import-export';
import type { CourseType } from '@/types/lesson';

// ─── 类型参数化（对齐 React /lesson/admin/{granular|hybrid|system}） ──────────
// React 三个 page.tsx 复用同一个 CourseAdminPage，仅 title/subtitle/courseType/addHref/
// importExcelEntity 不同；Vue 侧由 router 的 props.routeQueryType 传入（routes 不变），
// 同时兼容 URL ?type= 指定（/lesson/courses 无类型时为「全部课程」）。
const props = defineProps<{ routeQueryType?: string }>();
const route = useRoute();
const router = useRouter();

const courseType = computed<CourseType | undefined>(() => {
  const t = props.routeQueryType || (route.query.type as string | undefined);
  return t === 'granular' || t === 'hybrid' || t === 'system' ? t : undefined;
});

/** 新建/编辑跳转的编辑页（对齐 React CourseList.editPath） */
const addHref = computed(() => {
  if (courseType.value === 'granular') return '/lesson/admin/granular/add';
  if (courseType.value === 'hybrid') return '/lesson/admin/hybrid/add';
  return '/lesson/admin/system/add';
});

const PAGE_TEXT: Record<CourseType, { title: string; subtitle: string; label: string }> = {
  granular: {
    title: '颗粒课管理',
    subtitle: '维护颗粒课信息，包含颗粒课创建、提交审批、颗粒课发布等功能',
    label: '颗粒课'
  },
  hybrid: {
    title: '混合课模板管理',
    subtitle: '维护线上线下混合式课程模板，支持课程创建、大纲设计、资源组课，开课后自动归档至历史档案库',
    label: '混合课'
  },
  system: {
    title: '体系课管理',
    subtitle: '维护体系课课程及节点信息，包含课程创建、配置课程节点、提交审批、课程发布等功能',
    label: '体系课'
  }
};

const pageText = computed(() =>
  courseType.value
    ? PAGE_TEXT[courseType.value]
    : {
        title: '课程管理',
        subtitle: '维护全部课程信息，包含课程创建、提交审批、课程发布等功能',
        label: '课程'
      }
);

// ─── 映射与 payload（对齐 React course-admin-page.tsx mapCourse/createPayload） ─
function draftSuffix(): string {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return `${ds}_${c[Math.floor(Math.random() * 36)]}${c[Math.floor(Math.random() * 36)]}`;
}

function mapCourse(backend: any, currentUserId: string): ContentListItem {
  return {
    id: backend.id,
    code: backend.code,
    name: backend.name,
    type: backend.type,
    category: backend.category,
    major: backend.majorName || '',
    industry: backend.industryName || '',
    version: backend.version || 'V1.0',
    updateDate: backend.updatedAt,
    nodeCount: backend.nodeCount,
    resourceCount: backend.resourceCount,
    studyCount: backend.studyCount,
    status: backend.status,
    courseTag: backend.courseTag || undefined,
    creator:
      backend.creatorName ||
      (currentUserId && backend.creatorId === currentUserId
        ? '杭州知与未来科技有限公司'
        : backend.creatorId),
    creatorId: backend.creatorId,
    createDate: backend.createdAt,
    coCreatorIds: backend.coCreatorIds || [],
    batchId: backend.batchId || undefined,
    batchName: backend.batchName || undefined
  };
}

function mapCourseBatch(backend: any): ContentBatch {
  return { id: backend.id, name: backend.name, workflowId: backend.workflowId };
}

// 对齐 React @zhiyu/shared-types STATUS_FILTER_OPTIONS
const STATUS_FILTER_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'pending', label: '审批中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' }
];

// 对齐 React StatusBadge（@zhiyu/shared-types STATUS_MAP）
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

/** 可编辑状态（对齐 React StatusActionBar EDITABLE_STATUSES） */
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

const config = computed<ContentListPageConfig>(() => ({
  title: pageText.value.title,
  subtitle: pageText.value.subtitle,
  entityLabel: pageText.value.label,
  addHref: addHref.value,
  permissionModule: 'lesson',
  permissionResource: 'courses',
  itemApi: courseApi as unknown as ContentApi,
  batchApi: lessonBatchApi as unknown as ContentBatchApi,
  approvalApi: approvalApi as unknown as ContentApprovalApi,
  importExportApi: importExportApi as unknown as ContentImportExportApi,
  approvalTargetType: 'course',
  importEntityName: 'courses',
  exportEntityName: 'courses',
  // React：granular 用 granular-courses 模板，hybrid/system 用 courses
  importExcelEntity: courseType.value === 'granular' ? 'granular-courses' : 'courses',
  listParams: courseType.value ? { type: courseType.value } : {},
  coBuilderField: 'coCreatorIds',
  statusFilterOptions: STATUS_FILTER_OPTIONS,
  mapItem: mapCourse,
  mapBatch: mapCourseBatch,
  // 后端未回传 batchName 时用批次列表补全（React 直接取 backend.batchName）
  afterLoad: (items, batches) => {
    const batchNameMap = new Map(batches.map((b) => [b.id, b.name]));
    return items.map((item) => ({
      ...item,
      batchName: item.batchName || (item.batchId ? batchNameMap.get(item.batchId) || '-' : undefined)
    }));
  },
  createPayload: (uid, label) => ({
    name: `新建${label}_${draftSuffix()}`,
    type: courseType.value || 'system',
    category: 'default',
    status: 'draft',
    creatorId: uid || '',
    coCreatorIds: []
  })
}));

// ─── 行内跳转（对齐 React CourseList：viewHref → landing，editPath → 编辑页） ──
function editPath(row: { id: string; type?: string }): string {
  const kind = courseType.value || row.type;
  if (kind === 'granular') return `/lesson/admin/granular/add?id=${row.id}`;
  if (kind === 'hybrid') return `/lesson/admin/hybrid/add?id=${row.id}`;
  return `/lesson/admin/system/add?id=${row.id}`;
}

function goEdit(row: { id: string; type?: string }) {
  router.push(editPath(row));
}

function goLanding(row: { id: string }) {
  router.push(`/lesson/landing/${row.id}`);
}
</script>

<style scoped>
.course-table :deep(.el-table__cell) {
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
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
}
.row-actions :deep(.el-button + .el-button) {
  margin-left: 8px;
}
</style>

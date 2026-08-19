<template>
  <div class="clp">
    <!-- 页头：标题/副标题/统计/新建/导入 -->
    <el-card shadow="never" class="clp__header">
      <div class="clp__header-top">
        <div class="clp__header-text">
          <div class="clp__title">{{ config.title }}</div>
          <div class="clp__subtitle">{{ config.subtitle }}</div>
        </div>
        <div class="clp__header-actions">
          <slot name="extra-header-actions" />
          <el-button v-if="hasImport" @click="openImportDialog">
            <el-icon class="clp__btn-icon"><Upload /></el-icon>批量导入{{ config.entityLabel }}
          </el-button>
          <el-button type="primary" @click="handleCreate">
            <el-icon class="clp__btn-icon"><Plus /></el-icon>新建{{ config.entityLabel }}
          </el-button>
        </div>
      </div>

      <div v-if="activeTab !== 'public'" class="clp__stats">
        <div class="clp__stat">
          <div class="clp__stat-value">{{ stats.total }}</div>
          <div class="clp__stat-label">{{ config.entityLabel }}总数</div>
        </div>
        <div class="clp__stat">
          <div class="clp__stat-value">{{ stats.draft }}</div>
          <div class="clp__stat-label">未提交</div>
        </div>
        <div class="clp__stat">
          <div class="clp__stat-value">{{ stats.pending }}</div>
          <div class="clp__stat-label">审批中</div>
        </div>
        <div class="clp__stat">
          <div class="clp__stat-value">{{ stats.rejected }}</div>
          <div class="clp__stat-label">已驳回</div>
        </div>
        <div class="clp__stat">
          <div class="clp__stat-value">{{ stats.published }}</div>
          <div class="clp__stat-label">已发布</div>
        </div>
      </div>
    </el-card>

    <!-- 标签页 + 视图切换 -->
    <div class="clp__toolbar">
      <el-radio-group v-model="activeTab" @change="onTabChange">
        <el-radio-button value="my">我的{{ config.entityLabel }}</el-radio-button>
        <el-radio-button value="collab">共建{{ config.entityLabel }}</el-radio-button>
        <el-radio-button value="public">公共{{ config.entityLabel }}</el-radio-button>
        <el-radio-button v-if="canViewAll" value="all">全部{{ config.entityLabel }}</el-radio-button>
      </el-radio-group>

      <el-radio-group v-model="viewMode" size="small">
        <el-radio-button value="list">资源列表</el-radio-button>
        <el-radio-button value="group">批次分组</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 筛选 + 批量操作 -->
    <el-card shadow="never" class="clp__filters">
      <div class="clp__filter-row">
        <el-input
          v-model="searchQuery"
          :placeholder="`搜索${config.entityLabel}名称`"
          clearable
          class="clp__search"
        />
        <el-select v-model="selectedBatchId" placeholder="按批次筛选" clearable class="clp__select clp__select--batch">
          <el-option v-for="b in batches" :key="b.id" :label="b.name" :value="b.id" />
        </el-select>
        <el-select v-model="selectedStatus" placeholder="按状态筛选" clearable class="clp__select clp__select--status">
          <el-option v-for="o in config.statusFilterOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select
          v-if="config.groupStatusFilterOptions && config.groupStatusFilterOptions.length > 0"
          v-model="selectedGroupStatus"
          placeholder="按排课状态筛选"
          clearable
          class="clp__select clp__select--status"
        >
          <el-option
            v-for="o in config.groupStatusFilterOptions"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
        <el-button @click="handleResetFilters">
          <el-icon class="clp__btn-icon"><RefreshLeft /></el-icon>重置
        </el-button>
      </div>

      <div class="clp__batch-actions">
        <span class="clp__batch-hint" :class="{ 'is-active': hasSelected }">
          {{ hasSelected ? `已选择 ${selectedIds.length} 项：` : `请选择${config.entityLabel}：` }}
        </span>
        <template v-if="activeTab !== 'public'">
          <el-button v-if="hasPermission('submit_approval')" size="small" :disabled="!canBatchSubmit" @click="handleBatchSubmitApproval">提交审批</el-button>
          <el-button v-if="hasPermission('withdraw_approval')" size="small" :disabled="!canBatchWithdraw" @click="handleBatchWithdrawApproval">撤回审批</el-button>
          <el-button v-if="hasPermission('publish')" size="small" type="success" :disabled="!canBatchPublish" @click="handleBatchPublish">发布</el-button>
          <el-button v-if="hasPermission('unpublish')" size="small" :disabled="!canBatchUnpublish" @click="handleBatchUnpublish">取消发布</el-button>
          <el-button size="small" :disabled="!canBatchArchive" @click="handleBatchArchive">归档</el-button>
          <el-button v-if="hasPermission('delete')" size="small" type="danger" :disabled="!canBatchDelete" @click="openBatchDeleteConfirm">删除</el-button>
        </template>
        <el-button v-if="config.enableClone !== false" size="small" :disabled="!hasSelected" @click="handleBatchClone">克隆</el-button>
        <el-button v-if="activeTab !== 'public'" size="small" :disabled="!hasSelected" @click="handleBatchMove">调整批次分组</el-button>
        <el-button v-if="config.enableBatchExport !== false" size="small" :disabled="!hasSelected" @click="handleBatchExport">导出</el-button>
      </div>
    </el-card>

    <!-- 列表视图 -->
    <template v-if="!isLoading && filtered.length > 0 && viewMode === 'list'">
      <slot name="list" v-bind="listSlotProps" />
    </template>

    <!-- 分组视图 -->
    <div v-if="!isLoading && filtered.length > 0 && viewMode === 'group'" class="clp__groups">
      <el-collapse v-model="expandedBatches">
        <el-collapse-item v-for="entry in groupedEntries" :key="entry[0]" :name="entry[0]">
          <template #title>
            <div class="clp__group-title">
              <span class="clp__group-name">{{ batchMap[entry[0]] || entry[0] }}</span>
              <el-tag size="small" type="info">{{ entry[1].length }} 个{{ config.entityLabel }}</el-tag>
            </div>
          </template>
          <slot name="list" v-bind="{ ...listSlotProps, items: entry[1] }" />
        </el-collapse-item>
      </el-collapse>

      <div v-if="uncategorized.length > 0" class="clp__uncat">
        <div class="clp__uncat-head">
          <span class="clp__group-name">未分类</span>
          <el-tag size="small" type="info">{{ uncategorized.length }} 个{{ config.entityLabel }}</el-tag>
        </div>
        <div class="clp__uncat-body">
          <slot name="list" v-bind="{ ...listSlotProps, items: uncategorized }" />
        </div>
      </div>
    </div>

    <!-- 错误态 -->
    <div v-if="!isLoading && loadError" class="clp__state">
      <el-icon class="clp__state-icon is-error"><CircleCloseFilled /></el-icon>
      <h3>{{ config.entityLabel }}加载失败</h3>
      <p>{{ loadError }}</p>
      <el-button @click="refresh">重试</el-button>
    </div>

    <!-- 空态 -->
    <div v-if="!isLoading && !loadError && filtered.length === 0" class="clp__state">
      <el-icon class="clp__state-icon"><Search /></el-icon>
      <h3>暂无{{ config.entityLabel }}</h3>
      <p>当前筛选条件下没有{{ config.entityLabel }}数据</p>
      <el-button type="primary" @click="handleCreate">
        <el-icon class="clp__btn-icon"><Plus /></el-icon>新建{{ config.entityLabel }}
      </el-button>
    </div>

    <!-- 加载态 -->
    <div v-if="isLoading" class="clp__state" v-loading="isLoading" element-loading-text="加载中...">
      <div style="height: 80px" />
    </div>

    <!-- ============ 对话框 ============ -->

    <!-- 导入对话框 -->
    <el-dialog v-model="importDialogOpen" :title="`导入${config.entityLabel}`" width="560px" @closed="onImportDialogClosed">
      <div class="clp__import-guide">
        <p v-if="hasExcel">1. 点击下方按钮下载最新的导入模板（含系统字典数据）</p>
        <p v-if="hasExcel">2. 参照模板中各 Sheet 的填写说明，填入{{ config.entityLabel }}数据</p>
        <p>3. 选择已填写的{{ hasExcel ? 'Excel (.xlsx)' : 'CSV (.csv)' }}文件并开始导入</p>
      </div>

      <div class="clp__import-actions">
        <el-button v-if="hasExcel" :loading="isDownloading" @click="handleDownloadTemplate">下载{{ config.entityLabel }}批量导入模板</el-button>
        <input
          ref="fileInputRef"
          type="file"
          :accept="hasExcel ? '.xlsx' : '.csv'"
          class="clp__file-input"
          @change="handleFileInputChange"
        />
        <el-button @click="fileInputRef?.click()">选择文件</el-button>
        <div v-if="importFiles.length > 0" class="clp__file-list">
          <div v-for="(f, i) in importFiles" :key="i" class="clp__file-item">
            <span>{{ f.name }}</span>
            <el-icon class="clp__file-remove" @click="handleRemoveFile(i)"><Close /></el-icon>
          </div>
        </div>
      </div>

      <!-- 预览结果 -->
      <div v-if="importPreview && importPreview.rows && importPreview.rows.length > 0" class="clp__preview">
        <el-alert
          type="info"
          :closable="false"
          :title="`预览：共 ${importPreview.total ?? importPreview.rows.length} 条，有效 ${importPreview.valid ?? '-'}，无效 ${importPreview.invalid ?? 0}`"
        />
        <el-table :data="importPreview.rows" stripe max-height="240" size="small">
          <el-table-column prop="row" label="行号" width="70" />
          <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="code" label="编码" width="120" show-overflow-tooltip />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.conflict" type="warning">冲突</el-tag>
              <el-tag v-else-if="row.error" type="danger">错误</el-tag>
              <el-tag v-else type="success">有效</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="error" label="说明" min-width="140" show-overflow-tooltip />
        </el-table>
        <div class="clp__preview-opts">
          <el-checkbox v-model="importOverwrite">覆盖已有数据</el-checkbox>
          <el-checkbox v-model="importRename">重名时新增</el-checkbox>
        </div>
      </div>

      <template #footer>
        <el-button @click="importDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="isImporting" :disabled="importFiles.length === 0" @click="handleImportClick">{{ importPreview ? '确认导入' : '开始导入' }}</el-button>
      </template>
    </el-dialog>

    <!-- 归档/删除确认 -->
    <el-dialog
      v-model="confirmDialogOpen"
      :title="confirmAction?.type === 'archive' ? '确认归档' : '确认删除'"
      width="440px"
    >
      <p>
        {{ confirmAction?.type === 'archive'
          ? `确定要归档${config.entityLabel}「${confirmAction?.item.name}」吗？`
          : `确定要删除${config.entityLabel}「${confirmAction?.item.name}」吗？` }}
      </p>
      <template #footer>
        <el-button @click="confirmDialogOpen = false">取消</el-button>
        <el-button :type="confirmAction?.type === 'delete' ? 'danger' : 'primary'" :loading="confirmPending" @click="handleConfirmAction">确认</el-button>
      </template>
    </el-dialog>

    <!-- 批量删除确认 -->
    <el-dialog v-model="batchDeleteConfirmOpen" title="确认批量删除" width="460px">
      <p>确定要删除选中的 {{ selectedIds.length }} 项{{ config.entityLabel }}吗？仅删除草稿、已驳回或已归档的内容，删除后不可恢复。</p>
      <template #footer>
        <el-button @click="batchDeleteConfirmOpen = false">取消</el-button>
        <el-button type="danger" :loading="confirmPending" @click="handleBatchDelete">删除</el-button>
      </template>
    </el-dialog>

    <!-- 调整批次分组 / 绑定并提交审批 -->
    <el-dialog v-model="batchMoveDialogOpen" :title="batchMoveMode === 'bindThenSubmit' ? '提交审批' : '调整批次分组'" width="520px">
      <p class="clp__dialog-desc">
        {{ batchMoveMode === 'bindThenSubmit'
          ? `已选中 ${batchSubmitEligibleIds.length} 个可提交的${config.entityLabel}，其中 ${unboundEligibleCount} 个未关联批次，请选择批次分组或审批流程后提交审批`
          : `将选中的 ${selectedIds.length} 个${config.entityLabel}移动到指定批次` }}
      </p>

      <template v-if="batchMoveMode === 'bindThenSubmit'">
        <el-radio-group v-model="batchSubmitTab" class="clp__submit-tabs">
          <el-radio-button value="batch">按批次分组提交</el-radio-button>
          <el-radio-button value="workflow">按审批流程提交</el-radio-button>
        </el-radio-group>
        <BatchSelector
          v-if="batchSubmitTab === 'batch'"
          :batches="moveFilteredBatches"
          :majors="majors"
          :selected-major-id="moveSelectedMajorId"
          :selected-batch-id="moveTargetBatchId"
          @update:selected-major-id="moveSelectedMajorId = $event"
          @update:selected-batch-id="moveTargetBatchId = $event"
        />
        <WorkflowSelector
          v-else
          :workflows="activeWorkflows"
          :selected-workflow-id="batchSubmitWorkflowId"
          @update:selected-workflow-id="batchSubmitWorkflowId = $event"
        />
      </template>
      <template v-else>
        <BatchSelector
          :batches="moveFilteredBatches"
          :majors="majors"
          :selected-major-id="moveSelectedMajorId"
          :selected-batch-id="moveTargetBatchId"
          @update:selected-major-id="moveSelectedMajorId = $event"
          @update:selected-batch-id="moveTargetBatchId = $event"
        />
      </template>

      <template #footer>
        <el-button @click="batchMoveDialogOpen = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="batchMoveMode === 'bindThenSubmit'
            ? (batchSubmitTab === 'batch' ? !moveTargetBatchId : !batchSubmitWorkflowId)
            : !moveTargetBatchId"
          @click="handleConfirmMove"
        >
          {{ batchMoveMode === 'bindThenSubmit' ? '确认并提交审批' : '确认移动' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 单项提交审批（未关联批次） -->
    <el-dialog v-model="submitBatchDialogOpen" title="提交审批" width="520px">
      <p class="clp__dialog-desc">
        {{ config.entityLabel }}「{{ submitBatchTarget?.name ?? '' }}」未关联批次分组，请选择批次分组或审批流程后提交审批
      </p>
      <el-radio-group v-model="submitTab" class="clp__submit-tabs">
        <el-radio-button value="batch">按批次分组提交</el-radio-button>
        <el-radio-button value="workflow">按审批流程提交</el-radio-button>
      </el-radio-group>
      <BatchSelector
        v-if="submitTab === 'batch'"
        :batches="submitFilteredBatches"
        :majors="majors"
        :selected-major-id="submitSelectedMajorId"
        :selected-batch-id="submitSelectedBatchId"
        @update:selected-major-id="submitSelectedMajorId = $event"
        @update:selected-batch-id="submitSelectedBatchId = $event"
      />
      <WorkflowSelector
        v-else
        :workflows="activeWorkflows"
        :selected-workflow-id="submitWorkflowId"
        @update:selected-workflow-id="submitWorkflowId = $event"
      />
      <template #footer>
        <el-button @click="submitBatchDialogOpen = false">取消</el-button>
        <el-button type="primary" :disabled="submitTab === 'batch' ? !submitSelectedBatchId : !submitWorkflowId" @click="handleConfirmSubmit">
          确认并提交审批
        </el-button>
      </template>
    </el-dialog>

    <!-- 克隆重命名 -->
    <el-dialog v-model="cloneRenameDialogOpen" :title="`克隆${config.entityLabel}`" width="460px">
      <p class="clp__dialog-desc">为克隆的{{ config.entityLabel }}命名</p>
      <el-input v-model="cloneRenameValue" placeholder="输入新名称" />
      <template #footer>
        <el-button @click="cloneRenameDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmClone">确认克隆</el-button>
      </template>
    </el-dialog>

    <!-- 驳回原因 -->
    <el-dialog v-model="rejectReasonDialogOpen" title="驳回原因" width="500px">
      <p class="clp__dialog-desc">
        {{ config.entityLabel }}「{{ rejectReasonItem?.name ?? '' }}」的审批被驳回，驳回原因如下：
      </p>
      <div class="clp__reject-box">
        {{ rejectReasonItem?.rejectReason || `审批人已驳回此${config.entityLabel}的提交申请，请根据审批意见修改后重新提交。` }}
      </div>
      <template #footer>
        <el-button @click="rejectReasonDialogOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 调整共建人 -->
    <el-dialog v-model="inviteDialogOpen" title="调整共建人" width="640px">
      <p class="clp__dialog-desc">选择参与共建「{{ inviteTarget?.name ?? '' }}」的用户</p>
      <UserSelector
        v-model="inviteSelectedIds"
        multiple
        placeholder="点击选择共建人"
        :exclude-user-ids="inviteTarget?.creatorId ? [inviteTarget.creatorId] : []"
        show-enterprise-experts
      />
      <template #footer>
        <el-button @click="inviteDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="handleInviteConfirm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  CircleCloseFilled,
  Close,
  Plus,
  RefreshLeft,
  Search,
  Upload
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { majorApi, workflowApi } from '@/api/system';
import { authedFetch } from '@/api/http';
import type { Workflow, Major } from '@/types/system';
import UserSelector from '@/views/job/position-builder/UserSelector.vue';
import BatchSelector from './batch-selector.vue';
import WorkflowSelector from './workflow-selector.vue';
import {
  downloadBlob,
  fetchAllPages,
  type ContentBatch,
  type ContentListItem,
  type ContentListPageConfig,
  type ImportPreviewResult,
  type ListSlotProps,
  type RowAction,
  type TabType,
  type ViewMode
} from './content-list-page.types';

const props = defineProps<{ config: ContentListPageConfig }>();
const config = computed(() => props.config);

const router = useRouter();
const auth = useAuthStore();

const currentUserId = computed(() => auth.user?.id ?? '');
const tenantId = computed(() => {
  const u = auth.user as { tenantId?: string } | null;
  return u?.tenantId ?? '';
});
const activeRoleCode = computed(() => {
  const u = auth.user as { roleCodes?: string[]; role?: string } | null;
  return u?.roleCodes?.[0] ?? u?.role ?? '';
});
const canViewAll = computed(
  () => activeRoleCode.value === 'school_admin' || activeRoleCode.value === 'platform_admin',
);

// ─── 数据状态 ────────────────────────────────────────────────────────────
const frontItems = ref<ContentListItem[]>([]);
const batches = ref<ContentBatch[]>([]);
const majors = ref<Major[]>([]);
const workflows = ref<Workflow[]>([]);
const isLoading = ref(true);
const loadError = ref<string | null>(null);
let loadSeq = 0;

const activeTab = ref<TabType>('my');
const viewMode = ref<ViewMode>('list');
const searchQuery = ref('');
const selectedBatchId = ref<string | null>(null);
const selectedStatus = ref<string | null>(null);
const selectedGroupStatus = ref<string | null>(null);
const selectedIds = ref<string[]>([]);
const expandedBatches = ref<string[]>([]);

// ─── 对话框状态 ──────────────────────────────────────────────────────────
const importDialogOpen = ref(false);
const importFiles = ref<File[]>([]);
const isImporting = ref(false);
const isDownloading = ref(false);
const importPreview = ref<ImportPreviewResult | null>(null);
const importOverwrite = ref(false);
const importRename = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const confirmAction = ref<{ type: 'archive' | 'delete'; item: ContentListItem } | null>(null);
const confirmDialogOpen = ref(false);
const confirmPending = ref(false);
const batchDeleteConfirmOpen = ref(false);

const batchMoveDialogOpen = ref(false);
const batchMoveMode = ref<'move' | 'bindThenSubmit'>('move');
const moveTargetBatchId = ref('');
const moveSelectedMajorId = ref('all');
const batchSubmitEligibleIds = ref<string[]>([]);
const batchSubmitTab = ref<'batch' | 'workflow'>('batch');
const batchSubmitWorkflowId = ref('');

const submitBatchDialogOpen = ref(false);
const submitBatchTarget = ref<ContentListItem | null>(null);
const submitSelectedBatchId = ref('');
const submitSelectedMajorId = ref('all');
const submitTab = ref<'batch' | 'workflow'>('batch');
const submitWorkflowId = ref('');

const cloneRenameDialogOpen = ref(false);
const cloneRenameValue = ref('');
const cloneTarget = ref<ContentListItem | null>(null);

const rejectReasonDialogOpen = ref(false);
const rejectReasonItem = ref<ContentListItem | null>(null);

const inviteDialogOpen = ref(false);
const inviteTarget = ref<ContentListItem | null>(null);
const inviteSelectedIds = ref<string[]>([]);

const hasExcel = computed(() => !!config.value.importExcelEntity);
const hasImport = computed(() => hasExcel.value || !!config.value.importEntityName);

// ─── 权限 ────────────────────────────────────────────────────────────────
function hasPermission(action: string): boolean {
  const perms = (auth.user as { permissions?: unknown } | null)?.permissions as
    | Record<string, unknown>
    | undefined;
  // 无权限数据时放行（对齐当前 Vue 视图无鉴权门禁；有数据时按 React 语义判定）
  if (!perms || Object.keys(perms).length === 0) return true;
  if (perms.admin === true) return true;
  const mod = perms[config.value.permissionModule] as Record<string, unknown> | undefined;
  if (!mod) return false;
  const p = mod[config.value.permissionResource] as string[] | { buttons?: string[] } | undefined;
  if (!p) return false;
  if (Array.isArray(p)) return p.includes(action);
  if (Array.isArray(p.buttons)) return p.buttons.includes(action);
  return false;
}

// ─── 数据加载 ────────────────────────────────────────────────────────────
async function loadData() {
  const seq = ++loadSeq;
  isLoading.value = true;
  loadError.value = null;
  try {
    const [items, batchItems] = await Promise.all([
      fetchAllPages<unknown>((page, pageSize) =>
        config.value.itemApi.list({
          limit: pageSize,
          offset: page * pageSize,
          ...(config.value.listParams || {}),
        }),
      ),
      fetchAllPages<unknown>((page, pageSize) =>
        config.value.batchApi.list({ limit: pageSize, offset: page * pageSize }),
      ),
    ]);
    const mappedBatches = batchItems.map((b) => config.value.mapBatch(b));

    if (tenantId.value) {
      try {
        const [majorsResp, workflowsResp] = await Promise.all([
          majorApi.list({ tenantId: tenantId.value, limit: 1000 }),
          workflowApi.list({ limit: 1000 }),
        ]);
        if (seq === loadSeq) {
          majors.value = (majorsResp.items as Major[]).filter((m) => m.enabled);
          workflows.value = workflowsResp.items as Workflow[];
        }
      } catch {
        // 专业与审批流配置加载失败不阻塞列表
      }
    }

    let front = items.map((i) => config.value.mapItem(i, currentUserId.value));
    if (config.value.afterLoad) front = await config.value.afterLoad(front, mappedBatches);

    // 加载已驳回项的驳回原因
    const rejectedItems = front.filter((item) => item.status === 'rejected');
    if (rejectedItems.length > 0) {
      try {
        const approvalsResp = await config.value.approvalApi.list({
          targetType: config.value.approvalTargetType,
          status: 'rejected',
          limit: 1000,
        });
        const reasonMap = new Map<string, string>();
        for (const record of approvalsResp.items as {
          targetId: string;
          history?: { action?: string; status?: string; remark?: string; comment?: string }[];
        }[]) {
          if (reasonMap.has(record.targetId)) continue;
          const history = record.history || [];
          for (let i = history.length - 1; i >= 0; i--) {
            const h = history[i];
            const action = h.action || h.status;
            const remark = h.remark || h.comment;
            if (action === 'rejected' && remark) {
              reasonMap.set(record.targetId, remark);
              break;
            }
          }
        }
        front = front.map((item) => {
          if (item.status === 'rejected' && reasonMap.has(item.id)) {
            return { ...item, rejectReason: reasonMap.get(item.id) };
          }
          return item;
        });
      } catch {
        // 驳回原因加载失败不阻塞列表
      }
    }

    if (seq !== loadSeq) return;
    batches.value = mappedBatches;
    expandedBatches.value = mappedBatches.map((b) => b.id);
    frontItems.value = front;
  } catch (err) {
    if (seq !== loadSeq) return;
    loadError.value = err instanceof Error ? err.message : `加载${config.value.entityLabel}列表失败`;
  } finally {
    if (seq === loadSeq) isLoading.value = false;
  }
}

async function refresh() {
  await loadData();
}

onMounted(loadData);

// listParams 内容变化时重新加载（等价 React 的 listParamsKey 监听）
watch(
  () => JSON.stringify(config.value.listParams || {}),
  () => {
    void loadData();
  },
);

function onTabChange() {
  selectedIds.value = [];
  selectedBatchId.value = null;
}

// ─── 过滤 / 统计 ─────────────────────────────────────────────────────────
const tabFiltered = computed(() => {
  switch (activeTab.value) {
    case 'my':
      return frontItems.value.filter((i) => i.creatorId === currentUserId.value);
    case 'collab':
      return frontItems.value.filter(
        (i) => i.creatorId !== currentUserId.value && (i.coCreatorIds || []).includes(currentUserId.value),
      );
    case 'all':
      return frontItems.value;
    default:
      return frontItems.value.filter((i) => i.status === 'published');
  }
});

const filtered = computed(() => {
  let result = tabFiltered.value;
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    result = result.filter((i) => i.name.toLowerCase().includes(q));
  }
  if (selectedBatchId.value) {
    result = result.filter((i) => i.batchId === selectedBatchId.value);
  }
  if (selectedStatus.value) {
    result = result.filter((i) => i.status === selectedStatus.value);
  } else {
    result = result.filter((i) => i.status !== 'archived');
  }
  if (selectedGroupStatus.value) {
    const group = config.value.groupStatusFilterOptions?.find((o) => o.value === selectedGroupStatus.value);
    if (group) {
      result = result.filter((i) => group.statuses.includes(i.status));
    }
  }
  return result;
});

const stats = computed(() => ({
  total: filtered.value.length,
  draft: filtered.value.filter((i) => i.status === 'draft').length,
  pending: filtered.value.filter((i) => i.status === 'pending').length,
  rejected: filtered.value.filter((i) => i.status === 'rejected').length,
  published: filtered.value.filter((i) => i.status === 'published').length,
}));

const batchMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  batches.value.forEach((b) => {
    map[b.id] = b.name;
  });
  return map;
});

const itemsByBatch = computed<Record<string, ContentListItem[]>>(() => {
  const groups: Record<string, ContentListItem[]> = {};
  filtered.value.forEach((item) => {
    if (!item.batchId) return;
    if (!groups[item.batchId]) groups[item.batchId] = [];
    groups[item.batchId].push(item);
  });
  return groups;
});

const groupedEntries = computed(() => Object.entries(itemsByBatch.value));

const uncategorized = computed(() => filtered.value.filter((i) => !i.batchId));

const activeWorkflows = computed(() => workflows.value.filter((w) => w.status === 'active'));

const moveFilteredBatches = computed(() =>
  moveSelectedMajorId.value === 'all'
    ? batches.value
    : batches.value.filter((b) => {
        const wf = workflows.value.find((w) => w.id === b.workflowId);
        return wf && (wf.majorIds || []).includes(moveSelectedMajorId.value);
      }),
);

const submitFilteredBatches = computed(() =>
  submitSelectedMajorId.value === 'all'
    ? batches.value
    : batches.value.filter((b) => {
        const wf = workflows.value.find((w) => w.id === b.workflowId);
        return wf && (wf.majorIds || []).includes(submitSelectedMajorId.value);
      }),
);

// ─── 选择 ────────────────────────────────────────────────────────────────
const selectedFront = computed(() => frontItems.value.filter((i) => selectedIds.value.includes(i.id)));
const hasSelected = computed(() => selectedIds.value.length > 0);

const canBatchSubmit = computed(() => selectedFront.value.some((i) => i.status === 'draft' || i.status === 'rejected'));
const canBatchWithdraw = computed(() => selectedFront.value.some((i) => i.status === 'pending'));
const canBatchUnpublish = computed(() => selectedFront.value.some((i) => i.status === 'published'));
const canBatchPublish = computed(() => selectedFront.value.some((i) => i.status === 'approved'));
const canBatchDelete = computed(() =>
  selectedFront.value.some((i) => ['draft', 'rejected', 'archived'].includes(i.status)),
);
const canBatchArchive = computed(() =>
  selectedFront.value.some((i) => ['draft', 'rejected', 'approved', 'published'].includes(i.status)),
);

function handleSelectId(id: string, checked: boolean) {
  selectedIds.value = checked
    ? [...selectedIds.value, id]
    : selectedIds.value.filter((sid) => sid !== id);
}

function handleSelectAll(checked: boolean) {
  selectedIds.value = checked ? filtered.value.map((i) => i.id) : [];
}

const unboundEligibleCount = computed(
  () =>
    batchSubmitEligibleIds.value.filter((id) => {
      const item = frontItems.value.find((i) => i.id === id);
      return item && !item.batchId;
    }).length,
);

// ─── 批量操作（加锁防重复提交） ──────────────────────────────────────────
let batchSubmitLock = false;

async function doBatchSubmit(submitItems: { id: string; batchId: string }[]) {
  if (batchSubmitLock) return;
  batchSubmitLock = true;
  try {
    for (const { id, batchId } of submitItems) {
      const batch = batches.value.find((b) => b.id === batchId);
      if (!batch) continue;
      try {
        await config.value.itemApi.submit(id);
        await config.value.approvalApi.create({
          targetType: config.value.approvalTargetType,
          targetId: id,
          workflowId: batch.workflowId,
        });
      } catch (err) {
        ElMessage.error((err as Error).message || '提交审批失败，请稍后重试');
      }
    }
  } finally {
    batchSubmitLock = false;
  }
}

async function handleBatchSubmitApproval() {
  const eligibleItems = selectedIds.value
    .map((id) => frontItems.value.find((i) => i.id === id))
    .filter((item): item is ContentListItem => !!item && (item.status === 'draft' || item.status === 'rejected'));
  const hasUnbound = eligibleItems.some((item) => !item.batchId);
  if (hasUnbound) {
    batchMoveMode.value = 'bindThenSubmit';
    batchSubmitEligibleIds.value = eligibleItems.map((item) => item.id);
    moveSelectedMajorId.value = 'all';
    moveTargetBatchId.value = '';
    batchSubmitTab.value = 'batch';
    batchSubmitWorkflowId.value = '';
    batchMoveDialogOpen.value = true;
    return;
  }
  await doBatchSubmit(eligibleItems.map((item) => ({ id: item.id, batchId: item.batchId as string })));
  selectedIds.value = [];
  await refresh();
}

async function handleBatchWithdrawApproval() {
  for (const id of selectedIds.value) {
    const item = frontItems.value.find((i) => i.id === id);
    if (item && item.status === 'pending') {
      try {
        await config.value.itemApi.withdraw(id);
      } catch (err) {
        ElMessage.error((err as Error).message || '撤回审批失败，请稍后重试');
      }
    }
  }
  selectedIds.value = [];
  await refresh();
}

async function handleBatchUnpublish() {
  for (const id of selectedIds.value) {
    const item = frontItems.value.find((i) => i.id === id);
    if (item && item.status === 'published') {
      try {
        await config.value.itemApi.unpublish(id);
      } catch (err) {
        ElMessage.error((err as Error).message || '取消发布失败，请稍后重试');
      }
    }
  }
  selectedIds.value = [];
  await refresh();
}

async function handleBatchPublish() {
  for (const id of selectedIds.value) {
    const item = frontItems.value.find((i) => i.id === id);
    if (item && item.status === 'approved') {
      try {
        await config.value.itemApi.publish(id);
      } catch (err) {
        ElMessage.error((err as Error).message || '发布失败，请稍后重试');
      }
    }
  }
  selectedIds.value = [];
  await refresh();
}

async function handleBatchArchive() {
  for (const id of selectedIds.value) {
    const item = frontItems.value.find((i) => i.id === id);
    if (item && ['draft', 'rejected', 'approved', 'published'].includes(item.status)) {
      try {
        await config.value.itemApi.archive(id);
      } catch (err) {
        ElMessage.error((err as Error).message || '归档失败，请稍后重试');
      }
    }
  }
  selectedIds.value = [];
  await refresh();
}

function openBatchDeleteConfirm() {
  batchDeleteConfirmOpen.value = true;
}

async function handleBatchDelete() {
  batchDeleteConfirmOpen.value = false;
  confirmPending.value = true;
  try {
    for (const id of selectedIds.value) {
      const item = frontItems.value.find((i) => i.id === id);
      if (item && ['draft', 'rejected', 'archived'].includes(item.status)) {
        try {
          await config.value.itemApi.delete(id);
        } catch (err) {
          ElMessage.error((err as Error).message || '删除失败，请稍后重试');
        }
      }
    }
    selectedIds.value = [];
    await refresh();
  } finally {
    confirmPending.value = false;
  }
}

async function handleBatchClone() {
  let failed = 0;
  for (const id of selectedIds.value) {
    const item = frontItems.value.find((i) => i.id === id);
    if (!item) continue;
    try {
      if (config.value.itemApi.clone) {
        await config.value.itemApi.clone(item.id, { name: `${item.name}-copy` });
      } else {
        await config.value.itemApi.create({
          ...config.value.createPayload(currentUserId.value, config.value.entityLabel),
          name: `${item.name}-copy`,
          batchId: item.batchId,
        });
      }
    } catch {
      failed++;
    }
  }
  if (failed > 0) {
    ElMessage.error(`${failed} 项克隆失败，请稍后重试`);
  }
  selectedIds.value = [];
  await refresh();
}

async function handleBatchExport() {
  try {
    if (config.value.importExcelEntity) {
      const res = await authedFetch(`/export/${config.value.importExcelEntity}/excel`, {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds.value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `导出失败（HTTP ${res.status}）`);
      }
      downloadBlob(await res.blob(), `${config.value.entityLabel}导出.xlsx`);
    } else {
      const blob = await config.value.importExportApi.export(config.value.exportEntityName || '');
      downloadBlob(blob, `${config.value.exportEntityName || 'export'}-export.csv`);
    }
  } catch (err) {
    ElMessage.error((err as Error).message || '导出失败');
  }
  selectedIds.value = [];
}

function handleBatchMove() {
  batchMoveMode.value = 'move';
  batchSubmitEligibleIds.value = [];
  moveSelectedMajorId.value = 'all';
  moveTargetBatchId.value = '';
  batchMoveDialogOpen.value = true;
}

async function handleConfirmMove() {
  if (batchMoveMode.value === 'bindThenSubmit') {
    if (batchSubmitTab.value === 'workflow') {
      if (!batchSubmitWorkflowId.value || batchSubmitLock) return;
      batchSubmitLock = true;
      try {
        for (const id of batchSubmitEligibleIds.value) {
          try {
            await config.value.itemApi.submit(id);
            await config.value.approvalApi.create({
              targetType: config.value.approvalTargetType,
              targetId: id,
              workflowId: batchSubmitWorkflowId.value,
            });
          } catch (err) {
            ElMessage.error((err as Error).message || '提交审批失败，请稍后重试');
          }
        }
      } finally {
        batchSubmitLock = false;
      }
      batchSubmitEligibleIds.value = [];
      batchMoveMode.value = 'move';
      batchMoveDialogOpen.value = false;
      batchSubmitWorkflowId.value = '';
      selectedIds.value = [];
      await refresh();
      return;
    }
    if (!moveTargetBatchId.value) return;
    const submitItems = batchSubmitEligibleIds.value
      .map((id) => {
        const item = frontItems.value.find((i) => i.id === id);
        return { id, batchId: item?.batchId || moveTargetBatchId.value };
      })
      .filter((it) => it.batchId);
    const unboundIds = batchSubmitEligibleIds.value.filter((id) => {
      const item = frontItems.value.find((i) => i.id === id);
      return item && !item.batchId;
    });
    for (const id of unboundIds) {
      try {
        await config.value.itemApi.update(id, { batchId: moveTargetBatchId.value });
      } catch (err) {
        ElMessage.error((err as Error).message || '绑定批次失败，请稍后重试');
      }
    }
    await doBatchSubmit(submitItems);
    batchSubmitEligibleIds.value = [];
    batchMoveMode.value = 'move';
    batchMoveDialogOpen.value = false;
    moveTargetBatchId.value = '';
    selectedIds.value = [];
    await refresh();
    return;
  }
  if (!moveTargetBatchId.value) return;
  for (const id of selectedIds.value) {
    try {
      await config.value.itemApi.update(id, { batchId: moveTargetBatchId.value });
    } catch (err) {
      ElMessage.error((err as Error).message || '调整批次失败，请稍后重试');
    }
  }
  selectedIds.value = [];
  batchMoveDialogOpen.value = false;
  moveTargetBatchId.value = '';
  await refresh();
}

// ─── 行操作 ──────────────────────────────────────────────────────────────
function handleClone(item: ContentListItem) {
  cloneTarget.value = item;
  cloneRenameValue.value = `${item.name} (克隆)`;
  cloneRenameDialogOpen.value = true;
}

async function handleConfirmClone() {
  const target = cloneTarget.value;
  if (!target) return;
  const name = cloneRenameValue.value.trim();
  if (!name) {
    ElMessage.warning('请输入克隆名称');
    return;
  }
  try {
    if (config.value.itemApi.clone) {
      await config.value.itemApi.clone(target.id, { name });
    } else {
      await config.value.itemApi.create({
        ...config.value.createPayload(currentUserId.value, config.value.entityLabel),
        name,
        batchId: target.batchId,
      });
    }
    cloneRenameDialogOpen.value = false;
    cloneTarget.value = null;
    cloneRenameValue.value = '';
    await refresh();
  } catch (err) {
    ElMessage.error((err as Error).message || '克隆失败，请稍后重试');
  }
}

function handleDelete(item: ContentListItem) {
  confirmAction.value = { type: 'delete', item };
  confirmDialogOpen.value = true;
}

function handleArchive(item: ContentListItem) {
  confirmAction.value = { type: 'archive', item };
  confirmDialogOpen.value = true;
}

async function handleConfirmAction() {
  if (!confirmAction.value || confirmPending.value) return;
  const { type, item } = confirmAction.value;
  confirmPending.value = true;
  try {
    if (type === 'archive') {
      await config.value.itemApi.archive(item.id);
    } else {
      await config.value.itemApi.delete(item.id);
    }
    await refresh();
  } catch (err) {
    ElMessage.error(type === 'archive' ? (err as Error).message || '归档失败' : (err as Error).message || '删除失败');
  } finally {
    confirmAction.value = null;
    confirmDialogOpen.value = false;
    confirmPending.value = false;
  }
}

async function handleSubmitApproval(item: ContentListItem) {
  if (!item.batchId) {
    submitBatchTarget.value = item;
    submitSelectedMajorId.value = 'all';
    submitSelectedBatchId.value = '';
    submitTab.value = 'batch';
    submitWorkflowId.value = '';
    submitBatchDialogOpen.value = true;
    return;
  }
  const batch = batches.value.find((b) => b.id === item.batchId);
  if (!batch) {
    ElMessage.warning(`该${config.value.entityLabel}未关联批次，无法提交审批`);
    return;
  }
  try {
    await config.value.itemApi.submit(item.id);
    await config.value.approvalApi.create({
      targetType: config.value.approvalTargetType,
      targetId: item.id,
      workflowId: batch.workflowId,
    });
    await refresh();
  } catch (err) {
    ElMessage.error((err as Error).message || '提交审批失败，请稍后重试');
  }
}

async function handleConfirmSubmit() {
  if (!submitBatchTarget.value) return;
  if (submitTab.value === 'batch') {
    if (!submitSelectedBatchId.value) return;
    const batch = batches.value.find((b) => b.id === submitSelectedBatchId.value);
    if (!batch) return;
    try {
      await config.value.itemApi.update(submitBatchTarget.value.id, { batchId: submitSelectedBatchId.value });
      await config.value.itemApi.submit(submitBatchTarget.value.id);
      await config.value.approvalApi.create({
        targetType: config.value.approvalTargetType,
        targetId: submitBatchTarget.value.id,
        workflowId: batch.workflowId,
      });
      submitBatchDialogOpen.value = false;
      submitBatchTarget.value = null;
      submitSelectedBatchId.value = '';
      submitSelectedMajorId.value = 'all';
      await refresh();
    } catch (err) {
      ElMessage.error((err as Error).message || '提交审批失败，请稍后重试');
    }
  } else {
    if (!submitWorkflowId.value) return;
    try {
      await config.value.itemApi.submit(submitBatchTarget.value.id);
      await config.value.approvalApi.create({
        targetType: config.value.approvalTargetType,
        targetId: submitBatchTarget.value.id,
        workflowId: submitWorkflowId.value,
      });
      submitBatchDialogOpen.value = false;
      submitBatchTarget.value = null;
      submitWorkflowId.value = '';
      await refresh();
    } catch (err) {
      ElMessage.error((err as Error).message || '提交审批失败，请稍后重试');
    }
  }
}

async function handleWithdrawApproval(item: ContentListItem) {
  try {
    await config.value.itemApi.withdraw(item.id);
    await refresh();
  } catch (err) {
    ElMessage.error((err as Error).message || '撤回审批失败，请稍后重试');
  }
}

async function handlePublish(item: ContentListItem) {
  try {
    await config.value.itemApi.publish(item.id);
    await refresh();
  } catch (err) {
    ElMessage.error((err as Error).message || '发布失败，请稍后重试');
  }
}

async function handleUnpublish(item: ContentListItem) {
  try {
    await config.value.itemApi.unpublish(item.id);
    await refresh();
  } catch (err) {
    ElMessage.error((err as Error).message || '取消发布失败，请稍后重试');
  }
}

function handleInviteCoBuild(item: ContentListItem) {
  inviteTarget.value = item;
  inviteSelectedIds.value = (item.coCreatorIds || []).filter((id) => id !== item.creatorId);
  inviteDialogOpen.value = true;
}

async function handleInviteConfirm() {
  if (!inviteTarget.value) return;
  try {
    const field = config.value.coBuilderField || 'coCreatorIds';
    await config.value.itemApi.update(inviteTarget.value.id, { [field]: inviteSelectedIds.value });
    inviteDialogOpen.value = false;
    inviteTarget.value = null;
    await refresh();
  } catch (err) {
    ElMessage.error((err as Error).message || '调整共建人失败，请稍后重试');
  }
}

function handleViewRejectReason(item: ContentListItem) {
  rejectReasonItem.value = item;
  rejectReasonDialogOpen.value = true;
}

function handleResetFilters() {
  searchQuery.value = '';
  selectedBatchId.value = null;
  selectedStatus.value = null;
  selectedGroupStatus.value = null;
}

// ─── 新建 ────────────────────────────────────────────────────────────────
async function handleCreate() {
  if (config.value.onCreate) {
    config.value.onCreate();
    return;
  }
  try {
    const newItem = await config.value.itemApi.create(
      config.value.createPayload(currentUserId.value, config.value.entityLabel),
    );
    const id = (newItem as { id: string }).id;
    const url = config.value.createRedirectUrl
      ? config.value.createRedirectUrl(id)
      : `${config.value.addHref}?id=${id}&new=true`;
    await router.push(url);
  } catch (err) {
    ElMessage.error((err as Error).message || '创建失败');
  }
}

// ─── 导入导出 ────────────────────────────────────────────────────────────
function openImportDialog() {
  importDialogOpen.value = true;
}

function onImportDialogClosed() {
  importFiles.value = [];
  importPreview.value = null;
  importOverwrite.value = false;
  importRename.value = false;
}

function handleFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    const arr = Array.from(files);
    const existing = new Set(importFiles.value.map((f) => `${f.name}_${f.size}`));
    importFiles.value = [...importFiles.value, ...arr.filter((f) => !existing.has(`${f.name}_${f.size}`))];
  }
  if (input) input.value = '';
}

function handleRemoveFile(index: number) {
  importFiles.value = importFiles.value.filter((_, i) => i !== index);
}

async function handleDownloadTemplate() {
  if (!config.value.importExcelEntity) return;
  isDownloading.value = true;
  try {
    const res = await authedFetch(`/templates/${config.value.importExcelEntity}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `下载失败（HTTP ${res.status}）`);
    }
    downloadBlob(await res.blob(), `${config.value.entityLabel}批量导入模板.xlsx`);
  } catch (err) {
    ElMessage.error((err as Error).message || '模板下载失败');
  } finally {
    isDownloading.value = false;
  }
}

async function doPreview(file: File): Promise<ImportPreviewResult | null> {
  try {
    if (config.value.importExcelEntity) {
      const form = new FormData();
      form.append('file', file);
      const res = await authedFetch(`/import/${config.value.importExcelEntity}/preview`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `预览失败（HTTP ${res.status}）`);
      }
      return (await res.json()) as ImportPreviewResult;
    }
    return await config.value.importExportApi.importPreview(config.value.importEntityName || '', file);
  } catch (err) {
    ElMessage.error((err as Error).message || '预览失败');
    return null;
  }
}

async function doImportExec(file: File): Promise<void> {
  if (config.value.importExcelEntity) {
    const form = new FormData();
    form.append('file', file);
    const res = await authedFetch(
      `/import/${config.value.importExcelEntity}/excel?overwrite=${importOverwrite.value}&rename=${importRename.value}`,
      { method: 'POST', body: form },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `导入失败（HTTP ${res.status}）`);
    }
    const result = (await res.json()) as {
      created: number;
      failed: number;
      skipped?: number;
      permissionSkipped?: number;
      errors?: string[];
    };
    const skippedMsg = result.skipped != null ? `，跳过 ${result.skipped} 条` : '';
    const permissionMsg =
      result.permissionSkipped && result.permissionSkipped > 0
        ? `，${result.permissionSkipped} 个资源非本人创建/未参与共建，已跳过覆盖`
        : '';
    const errorMsg = result.errors && result.errors.length > 0 ? `，错误：${result.errors.slice(0, 3).join(';')}` : '';
    ElMessage.success(`导入完成：成功 ${result.created} 条，失败 ${result.failed} 条${skippedMsg}${permissionMsg}${errorMsg}`);
  } else {
    const result = await config.value.importExportApi.import(
      config.value.importEntityName || '',
      file,
      importOverwrite.value,
      importRename.value,
    );
    const skippedMsg = result.skipped != null ? `，跳过 ${result.skipped} 条` : '';
    const permissionMsg =
      result.permissionSkipped && result.permissionSkipped > 0
        ? `，${result.permissionSkipped} 个资源非本人创建/未参与共建，已跳过覆盖`
        : '';
    ElMessage.success(`导入完成：成功 ${result.created} 条，失败 ${result.failed} 条${skippedMsg}${permissionMsg}`);
  }
}

async function handleImportClick() {
  if (importFiles.value.length === 0) return;
  // 已有预览（含冲突/无效行）时，按用户勾选的覆盖/重名策略执行导入
  if (importPreview.value) {
    await executeImportAndClose();
    return;
  }
  // 先预览，无冲突/无效行时直接导入
  await previewThenMaybeExecute();
}

async function previewThenMaybeExecute() {
  const file = importFiles.value[0];
  isImporting.value = true;
  try {
    const preview = await doPreview(file);
    if (preview && hasPreviewConflict(preview)) {
      importPreview.value = preview;
      return;
    }
    importPreview.value = null;
    await doImportExec(file);
    await resetImportAndRefresh();
  } catch (err) {
    ElMessage.error((err as Error).message || '导入失败');
  } finally {
    isImporting.value = false;
  }
}

async function executeImportAndClose() {
  if (importFiles.value.length === 0) return;
  isImporting.value = true;
  try {
    await doImportExec(importFiles.value[0]);
    await resetImportAndRefresh();
  } catch (err) {
    ElMessage.error((err as Error).message || '导入失败');
  } finally {
    isImporting.value = false;
  }
}

async function resetImportAndRefresh() {
  importFiles.value = [];
  importPreview.value = null;
  importOverwrite.value = false;
  importRename.value = false;
  importDialogOpen.value = false;
  await refresh();
}

function hasPreviewConflict(preview: ImportPreviewResult): boolean {
  if (preview.duplicates != null && preview.duplicates > 0) return true;
  if (preview.invalid != null && preview.invalid > 0) return true;
  const rows = preview.rows || [];
  return rows.some((r) => r.conflict || r.error);
}

// ─── 列表插槽 props ──────────────────────────────────────────────────────
function rowActions(item: ContentListItem): RowAction[] {
  const actions: RowAction[] = [];
  if (item.status === 'draft' || item.status === 'rejected') {
    actions.push({ key: 'submit', label: '提交审批', type: 'primary', handler: () => handleSubmitApproval(item) });
  }
  if (item.status === 'pending') {
    actions.push({ key: 'withdraw', label: '撤回审批', type: 'default', handler: () => handleWithdrawApproval(item) });
  }
  if (item.status === 'approved') {
    actions.push({ key: 'publish', label: '发布', type: 'success', handler: () => handlePublish(item) });
  }
  if (item.status === 'published') {
    actions.push({ key: 'unpublish', label: '取消发布', type: 'default', handler: () => handleUnpublish(item) });
  }
  if (['draft', 'rejected', 'approved', 'published'].includes(item.status)) {
    actions.push({ key: 'archive', label: '归档', type: 'default', handler: () => handleArchive(item) });
  }
  if (item.status === 'rejected') {
    actions.push({ key: 'rejectReason', label: '驳回原因', type: 'warning', handler: () => handleViewRejectReason(item) });
  }
  if (config.value.enableClone !== false) {
    actions.push({ key: 'clone', label: '克隆', type: 'default', handler: () => handleClone(item) });
  }
  if (activeTab.value !== 'public') {
    actions.push({ key: 'invite', label: '协作人', type: 'default', handler: () => handleInviteCoBuild(item) });
  }
  if (['draft', 'rejected', 'archived'].includes(item.status)) {
    actions.push({ key: 'delete', label: '删除', type: 'danger', handler: () => handleDelete(item) });
  }
  return actions;
}

const listSlotProps = computed<ListSlotProps>(() => ({
  activeTab: activeTab.value,
  items: filtered.value,
  selectedIds: selectedIds.value,
  batchMap: batchMap.value,
  loading: isLoading.value,
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
  handleInviteCoBuild,
  rowActions,
}));

defineExpose({ refresh });
</script>

<style scoped>
.clp {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.clp__header {
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.clp__header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.clp__title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.clp__subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #909399;
}
.clp__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.clp__btn-icon {
  margin-right: 4px;
}
.clp__stats {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.clp__stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.clp__stat-label {
  font-size: 12px;
  color: #909399;
}
.clp__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.clp__filters {
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.clp__filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.clp__search {
  flex: 1;
  min-width: 200px;
}
.clp__select {
  width: 160px;
}
.clp__select--batch {
  width: 200px;
}
.clp__select--status {
  width: 140px;
}
.clp__batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f2f5;
}
.clp__batch-hint {
  font-size: 13px;
  color: #c0c4cc;
  margin-right: 4px;
}
.clp__batch-hint.is-active {
  color: #606266;
  font-weight: 500;
}
.clp__groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.clp__group-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.clp__group-name {
  font-weight: 500;
  color: #303133;
}
.clp__uncat {
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}
.clp__uncat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fafafa;
}
.clp__uncat-body {
  padding: 16px;
}
.clp__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  text-align: center;
}
.clp__state-icon {
  font-size: 48px;
  color: #c0c4cc;
}
.clp__state-icon.is-error {
  color: #f56c6c;
}
.clp__state h3 {
  margin: 0;
  font-size: 16px;
  color: #606266;
}
.clp__state p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}
.clp__import-guide {
  font-size: 13px;
  color: #606266;
  margin-bottom: 16px;
}
.clp__import-guide p {
  margin: 4px 0;
}
.clp__import-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.clp__file-input {
  display: none;
}
.clp__file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  margin-top: 8px;
}
.clp__file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #606266;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 6px 10px;
}
.clp__file-remove {
  cursor: pointer;
  color: #909399;
}
.clp__file-remove:hover {
  color: #f56c6c;
}
.clp__preview {
  margin-top: 16px;
}
.clp__preview-opts {
  margin-top: 12px;
  display: flex;
  gap: 16px;
}
.clp__dialog-desc {
  font-size: 13px;
  color: #606266;
  margin: 0 0 12px;
}
.clp__submit-tabs {
  margin-bottom: 12px;
}
.clp__reject-box {
  background: #fef0f0;
  color: #f56c6c;
  border-radius: 6px;
  padding: 12px;
  font-size: 13px;
  white-space: pre-wrap;
}
</style>

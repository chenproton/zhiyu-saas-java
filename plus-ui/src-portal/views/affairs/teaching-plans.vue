<template>
  <ContentListPage :config="config">
    <template #list="slot">
      <el-card shadow="never" class="plans-table-card">
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

          <el-table-column label="人培方案" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.programName || '-' }}</template>
          </el-table-column>

          <el-table-column label="学期" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.termName || '-' }}</template>
          </el-table-column>

          <el-table-column label="专业" width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.majorName || '-' }}</template>
          </el-table-column>

          <el-table-column label="年级" width="90">
            <template #default="{ row }">{{ row.entryYear }}级</template>
          </el-table-column>

          <el-table-column label="条目数" width="90">
            <template #default="{ row }">{{ row.entryCount ?? '-' }}</template>
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

          <el-table-column label="操作" min-width="360" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="goDetail(row)">详情</el-button>
              <el-button link size="small" :loading="exportingId === row.id" @click="exportExcel(row)">
                {{ exportingId === row.id ? '导出中...' : '导出' }}
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

  <!-- 生成教学计划弹窗（对齐 React GeneratePlanDialog） -->
  <el-dialog v-model="generateDialog" title="从人培方案生成教学计划" width="480px">
    <p class="gen-desc">选择已发布的人培方案与目标学期，系统将按方案课程自动生成教学条目</p>
    <el-form label-width="110px">
      <el-form-item label="人培方案（已发布）">
        <el-select v-model="generateForm.programId" style="width: 100%" placeholder="请选择人培方案">
          <el-option
            v-for="p in programs"
            :key="p.id"
            :label="`${p.name}（${p.entryYear} 级）`"
            :value="p.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="目标学期">
        <el-select v-model="generateForm.termId" style="width: 100%" placeholder="请选择学期">
          <el-option
            v-for="t in terms"
            :key="t.id"
            :label="t.isCurrent ? `${t.name}（当前学期）` : t.name"
            :value="t.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="generateDialog = false">取消</el-button>
      <el-button
        type="primary"
        :loading="generating"
        :disabled="!generateForm.programId || !generateForm.termId"
        @click="generate"
      >
        生成教学计划
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
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
import { teachingPlanApi, programApi, termApi, affairsBatchApi } from '@/api/affairs';
import { approvalApi } from '@/api/approval';
import { importExportApi } from '@/api/import-export';
import type { TeachingPlan, TrainingProgram, AffairsTerm } from '@/types/affairs';
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

// ─── 生成弹窗状态 ────────────────────────────────────────────────────────────
const generateDialog = ref(false);
const generating = ref(false);
const programs = ref<TrainingProgram[]>([]);
const terms = ref<AffairsTerm[]>([]);
const generateForm = reactive({ programId: '', termId: '' });
const exportingId = ref<string | null>(null);

// ─── 映射（对齐 React mapPlan：以 方案+学期+专业 拼装 name；createdBy 空时兜底当前用户） ──
function mapPlan(backend: unknown, currentUserId: string): ContentListItem {
  const p = backend as TeachingPlan;
  return {
    ...p,
    id: p.id,
    name: `${p.programName || '教学计划'} · ${p.termName || ''} · ${p.majorName || ''}`,
    status: p.status,
    batchId: p.batchId,
    creatorId: p.createdBy || currentUserId,
    coCreatorIds: p.collaborators || [],
    programName: p.programName,
    termName: p.termName,
    majorName: p.majorName,
    entryYear: p.entryYear,
    entryCount: p.entryCount
  };
}

function mapBatch(backend: unknown) {
  const b = backend as { id: string; name: string; workflowId?: string };
  return { id: b.id, name: b.name, workflowId: b.workflowId };
}

const config: ContentListPageConfig = {
  title: '教学计划',
  subtitle: '从已发布的人培方案按学期生成教学计划，审批发布后进入排课',
  entityLabel: '教学计划',
  addHref: '/affairs/teaching-plans',
  permissionModule: 'affairs',
  permissionResource: 'teaching-plans',
  itemApi: teachingPlanApi as unknown as ContentApi,
  batchApi: affairsBatchApi as unknown as ContentBatchApi,
  approvalApi: approvalApi as unknown as ContentApprovalApi,
  importExportApi: importExportApi as unknown as ContentImportExportApi,
  approvalTargetType: 'teaching_plan',
  coBuilderField: 'collaborators',
  statusFilterOptions: STATUS_FILTER_OPTIONS,
  groupStatusFilterOptions: [
    { value: 'unplanned', label: '未排课', statuses: ['draft', 'pending', 'approved', 'rejected'] },
    { value: 'published', label: '已排课', statuses: ['published'] }
  ],
  mapItem: mapPlan,
  mapBatch,
  createPayload: () => ({ programId: '', termId: '' }),
  enableClone: false,
  enableBatchExport: false,
  onCreate: () => {
    generateForm.programId = '';
    generateForm.termId = '';
    generateDialog.value = true;
  }
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

// ─── 生成教学计划（对齐 React GeneratePlanDialog：仅加载已发布方案） ────────
async function loadOptions() {
  try {
    const [pRes, tRes] = await Promise.all([
      programApi.list({ status: 'published', limit: 200 }),
      termApi.list({ limit: 100 })
    ]);
    programs.value = pRes.items;
    terms.value = tRes.items;
  } catch {
    /* 选项加载失败不阻断 */
  }
}

async function generate() {
  if (!generateForm.programId || !generateForm.termId) {
    ElMessage.warning('请选择人培方案和学期');
    return;
  }
  generating.value = true;
  try {
    const plan = await teachingPlanApi.generate({
      programId: generateForm.programId,
      termId: generateForm.termId
    });
    ElMessage.success(`教学计划已生成（共 ${plan.entries?.length ?? 0} 个教学条目）`);
    generateDialog.value = false;
    router.push(`/affairs/teaching-plans/${plan.id}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '生成失败');
  } finally {
    generating.value = false;
  }
}

// ─── 导出（对齐 React 行内导出） ────────────────────────────────────────────
async function exportExcel(row: ContentListItem) {
  exportingId.value = row.id;
  try {
    await teachingPlanApi.exportExcel(row.id);
    ElMessage.success(`导出成功：${row.programName || '教学计划'}`);
  } catch (e) {
    ElMessage.error((e as Error).message || '导出失败');
  } finally {
    exportingId.value = null;
  }
}

function goDetail(row: ContentListItem) {
  router.push(`/affairs/teaching-plans/${row.id}`);
}

onMounted(loadOptions);
</script>

<style scoped>
.plans-table-card :deep(.el-card__body) {
  padding: 0;
}
.gen-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}
</style>

<template>
  <div class="list-page">
    <!-- 页头：标题 + 副标题 + 新建批次 -->
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ title }}</h2>
        <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
      </div>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新建批次
      </el-button>
    </div>

    <!-- 搜索 / 状态筛选 -->
    <el-card shadow="never" class="filter-card">
      <div class="filter-row">
        <el-input
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          clearable
          class="search-input"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filterStatus" class="status-select">
          <el-option label="全部状态" value="all" />
          <el-option label="开放中" value="open" />
          <el-option label="已截止" value="closed" />
        </el-select>
        <el-button v-if="searchQuery || filterStatus !== 'all'" @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          重置
        </el-button>
      </div>
    </el-card>

    <!-- 批次列表 -->
    <el-card shadow="never">
      <template #header>
        <div class="table-header">
          <span class="card-title">批次列表</span>
          <span class="count">共 {{ filteredBatches.length }} 个批次分组</span>
        </div>
      </template>
      <el-table v-loading="loading" :data="filteredBatches" stripe>
        <el-table-column label="分组名称" min-width="180">
          <template #default="{ row }">
            <router-link v-if="detailHref" :to="detailHref(row.id)" class="name-link">
              {{ row.name }}
            </router-link>
            <span v-else>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="批次编号" width="150">
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>
        <el-table-column label="审批流程" width="180">
          <template #default="{ row }">
            <el-tag v-if="row.workflowName" type="info" effect="plain">{{ row.workflowName }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'open' ? 'success' : 'info'">
              {{ row.status === 'open' ? '开放中' : '已截止' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="canToggleStatus" size="small" @click="toggleStatus(row)">
              {{ row.status === 'open' ? '截止批次' : '重新开放' }}
            </el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建 / 编辑批次对话框 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑批次' : '新增批次'" width="520px">
      <el-form label-position="top">
        <el-form-item label="分组名称" required>
          <el-input v-model="form.name" :placeholder="namePlaceholder || '请输入批次名称'" />
        </el-form-item>
        <el-form-item label="关联审批流" required>
          <el-tabs v-if="majors.length > 0" v-model="selectedMajorId" class="major-tabs">
            <el-tab-pane label="全部专业" name="all" />
            <el-tab-pane v-for="m in majors" :key="m.id" :label="m.name" :name="m.id" />
          </el-tabs>
          <div class="workflow-list">
            <el-empty v-if="filteredWorkflows.length === 0" description="暂无审批流程" :image-size="60" />
            <div
              v-for="wf in filteredWorkflows"
              :key="wf.id"
              class="workflow-item"
              :class="{ selected: form.workflowId === wf.id }"
              @click="form.workflowId = wf.id"
            >
              <div class="workflow-main">
                <div class="workflow-name">{{ wf.name }}</div>
                <div v-if="wf.description" class="workflow-desc">{{ wf.description }}</div>
                <div class="workflow-steps">{{ (wf.steps || []).length }} 个审批步骤</div>
              </div>
              <el-icon v-if="form.workflowId === wf.id" class="check-icon"><Check /></el-icon>
            </div>
          </div>
          <p v-if="workflowHint" class="workflow-hint">{{ workflowHint }}</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!form.name.trim() || !form.workflowId"
          @click="save"
        >
          {{ editing ? '保存修改' : '创建批次' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Check, Plus, RefreshLeft, Search } from '@element-plus/icons-vue';
import { majorApi, workflowApi } from '@/api/system';
import type { Major, Workflow } from '@/types/system';

interface BatchApi {
  list: (params?: Record<string, string | number | boolean | undefined>) => Promise<{ items: any[]; total?: number }>;
  create: (req: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, req: Record<string, unknown>) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
  updateStatus?: (id: string, status: string) => Promise<unknown>;
}

const props = defineProps<{
  title: string;
  subtitle?: string;
  api: BatchApi;
  namePlaceholder?: string;
  workflowHint?: string;
  searchPlaceholder?: string;
  detailHref?: (id: string) => string;
}>();

const batches = ref<any[]>([]);
const workflows = ref<Workflow[]>([]);
const majors = ref<Major[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const filterStatus = ref<'all' | 'open' | 'closed'>('all');
const dialogVisible = ref(false);
const saving = ref(false);
const editing = ref<any | null>(null);
const form = reactive({ name: '', workflowId: '' });
const selectedMajorId = ref('all');

const canToggleStatus = computed(() => typeof props.api.updateStatus === 'function');

const filteredWorkflows = computed(() => {
  if (selectedMajorId.value === 'all') return workflows.value;
  return workflows.value.filter((wf) => (wf.majorIds || []).includes(selectedMajorId.value));
});

const filteredBatches = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return batches.value.filter((batch) => {
    const matchesSearch =
      !q ||
      String(batch.name || '').toLowerCase().includes(q) ||
      String(batch.code || '').toLowerCase().includes(q);
    const matchesStatus = filterStatus.value === 'all' || batch.status === filterStatus.value;
    return matchesSearch && matchesStatus;
  });
});

async function loadMajors() {
  try {
    const res = await majorApi.list({ limit: 1000 });
    majors.value = res.items.filter((m) => m.enabled);
  } catch {
    majors.value = [];
  }
}

async function loadData() {
  loading.value = true;
  try {
    const [batchRes, wfRes] = await Promise.all([
      props.api.list({ limit: 1000 }),
      workflowApi.list({ limit: 1000 })
    ]);
    workflows.value = wfRes.items;
    const wfMap = new Map(wfRes.items.map((w) => [w.id, w.name]));
    batches.value = (batchRes.items as any[]).map((b) => ({
      ...b,
      workflowName: b.workflowId ? wfMap.get(b.workflowId) : undefined
    }));
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.name = '';
  form.workflowId = '';
  selectedMajorId.value = 'all';
  editing.value = null;
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editing.value = row;
  form.name = row.name || '';
  form.workflowId = row.workflowId || '';
  selectedMajorId.value = 'all';
  dialogVisible.value = true;
}

async function save() {
  if (!form.name.trim() || !form.workflowId) return;
  saving.value = true;
  try {
    const code =
      editing.value?.code ??
      'BG-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      code,
      workflowId: form.workflowId,
      status: editing.value?.status ?? 'open'
    };
    if (editing.value) {
      await props.api.update(editing.value.id, payload);
      ElMessage.success('保存成功');
    } else {
      await props.api.create(payload);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: any) {
  if (!props.api.updateStatus) return;
  const newStatus = row.status === 'open' ? 'closed' : 'open';
  try {
    await props.api.updateStatus(row.id, newStatus);
    ElMessage.success(newStatus === 'open' ? '批次已重新开放' : '批次已截止');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function confirmDelete(row: any) {
  try {
    await ElMessageBox.confirm('确定删除该批次吗？', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await props.api.delete(row.id);
    ElMessage.success('删除成功');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

function resetFilters() {
  searchQuery.value = '';
  filterStatus.value = 'all';
}

onMounted(() => {
  loadMajors();
  loadData();
});
</script>

<style scoped>
.list-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}
.page-subtitle {
  font-size: 13px;
  color: #909399;
  margin: 4px 0 0;
}
.filter-card :deep(.el-card__body) {
  padding: 16px;
}
.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.search-input {
  flex: 1;
  min-width: 220px;
}
.status-select {
  width: 140px;
}
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.count {
  font-size: 13px;
  color: #909399;
}
.name-link {
  color: #409eff;
  text-decoration: none;
}
.name-link:hover {
  text-decoration: underline;
}
.major-tabs {
  margin-bottom: 8px;
}
.workflow-list {
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
}
.workflow-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #ebeef5;
}
.workflow-item:last-child {
  border-bottom: none;
}
.workflow-item:hover {
  background: #f5f7fa;
}
.workflow-item.selected {
  background: #ecf5ff;
}
.workflow-main {
  min-width: 0;
}
.workflow-name {
  font-size: 14px;
  font-weight: 500;
}
.workflow-item.selected .workflow-name {
  color: #409eff;
}
.workflow-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workflow-steps {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}
.check-icon {
  color: #409eff;
  flex-shrink: 0;
  margin-top: 2px;
}
.workflow-hint {
  font-size: 12px;
  color: #909399;
  margin: 8px 0 0;
}
</style>

<template>
  <div class="archive-page">
    <!-- 页头 -->
    <div class="page-header">
      <h2 class="page-title">{{ pageTitle }}</h2>
      <p v-if="pageDescription" class="page-subtitle">{{ pageDescription }}</p>
    </div>

    <div class="archive-body">
      <!-- 侧栏：专业 / 类型筛选 -->
      <el-card v-if="sidebarItems.length > 0" shadow="never" class="sidebar-card">
        <div class="sidebar-title">{{ sidebarTitle }}</div>
        <el-scrollbar max-height="500px">
          <div class="sidebar-list">
            <div
              class="sidebar-item"
              :class="{ active: sidebarSelectedId === null }"
              @click="onSidebarSelect(null)"
            >
              全部专业
            </div>
            <div
              v-for="item in sidebarItems"
              :key="item.id"
              class="sidebar-item"
              :class="{ active: sidebarSelectedId === item.id }"
              @click="onSidebarSelect(item.id)"
            >
              {{ item.name }}
            </div>
          </div>
        </el-scrollbar>
      </el-card>

      <!-- 主区 -->
      <div class="archive-main">
        <!-- 搜索 -->
        <el-card shadow="never" class="search-card">
          <el-input
            :model-value="searchValue"
            :placeholder="searchPlaceholder"
            clearable
            @update:model-value="onSearchChange"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-card>

        <!-- 批量操作条 -->
        <div v-if="hasBatchOps && selectedIds.length > 0" class="batch-bar">
          <span class="batch-tip">已选择 {{ selectedIds.length }} 个{{ entityLabel }}</span>
          <div class="batch-actions">
            <el-button v-if="onBatchRestore" size="small" :loading="busy" @click="handleBatchRestore">
              <el-icon><RefreshLeft /></el-icon>
              批量恢复
            </el-button>
            <el-button
              v-if="onBatchDelete"
              size="small"
              type="danger"
              plain
              @click="batchDeleteVisible = true"
            >
              <el-icon><Delete /></el-icon>
              批量删除
            </el-button>
          </div>
        </div>

        <!-- 列表 -->
        <el-card shadow="never" class="table-card">
          <el-table v-loading="loading" :data="items" stripe @selection-change="onSelectionChange">
            <el-table-column v-if="hasBatchOps" type="selection" width="46" />

            <el-table-column
              v-for="col in columns"
              :key="col.prop || col.label"
              :prop="col.prop"
              :label="col.label"
              :width="col.width"
              :min-width="col.minWidth"
            >
              <template #default="{ row }">
                <CellRenderer :content="resolveCell(col, row)" />
              </template>
            </el-table-column>

            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag type="info" effect="plain">{{ renderStatus(row) }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="190" fixed="right">
              <template #default="{ row }">
                <router-link v-if="detailHref" :to="detailHref(row)" class="action-link">查看</router-link>
                <el-button size="small" type="primary" link :disabled="busy" @click="handleRestore(row)">
                  恢复
                </el-button>
                <el-button
                  v-if="onDelete"
                  size="small"
                  type="danger"
                  link
                  :disabled="busy"
                  @click="handleDelete(row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!loading && items.length === 0" :description="emptyMessage" />
        </el-card>
      </div>
    </div>

    <!-- 删除确认 -->
    <el-dialog v-model="deleteDialogVisible" title="确认删除" width="420px">
      <span>{{ deleteDescription }}</span>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="busy" @click="confirmDelete">删除</el-button>
      </template>
    </el-dialog>

    <!-- 批量删除确认 -->
    <el-dialog v-model="batchDeleteVisible" title="确认批量删除" width="420px">
      <span>确定删除选中的 {{ selectedIds.length }} 个{{ entityLabel }}吗？删除后不可恢复。</span>
      <template #footer>
        <el-button @click="batchDeleteVisible = false">取消</el-button>
        <el-button type="danger" :loading="busy" @click="confirmBatchDelete">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, h, ref, type VNode } from 'vue';
import { Delete, RefreshLeft, Search } from '@element-plus/icons-vue';
import { contentStatusLabel } from '@/types/content-status';

export interface ArchiveColumn {
  label: string;
  prop?: string;
  width?: string | number;
  minWidth?: string | number;
  formatter?: (row: Record<string, any>) => string;
  cell?: (row: Record<string, any>) => VNode | string;
}

type Row = Record<string, any>;

const props = withDefaults(
  defineProps<{
    entityLabel: string;
    pageTitle: string;
    pageDescription?: string;
    sidebarTitle?: string;
    sidebarItems?: { id: string; name: string }[];
    sidebarSelectedId?: string | null;
    onSidebarSelect?: (id: string | null) => void;
    items: Row[];
    loading?: boolean;
    onRestore: (item: Row) => Promise<void>;
    onDelete?: (item: Row) => Promise<void>;
    onBatchRestore?: (ids: string[]) => Promise<void>;
    onBatchDelete?: (ids: string[]) => Promise<void>;
    detailHref?: (item: Row) => string;
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    columns: ArchiveColumn[];
    renderStatus?: (item: Row) => string;
    emptyMessage?: string;
  }>(),
  {
    pageDescription: '',
    sidebarTitle: '筛选',
    sidebarItems: () => [],
    sidebarSelectedId: null,
    onSidebarSelect: () => {},
    loading: false,
    onDelete: undefined,
    onBatchRestore: undefined,
    onBatchDelete: undefined,
    detailHref: undefined,
    searchPlaceholder: '搜索...',
    searchValue: '',
    onSearchChange: () => {},
    renderStatus: (item: Row) => contentStatusLabel(String(item?.status || 'archived')),
    emptyMessage: '暂无归档数据'
  }
);

const selectedIds = ref<string[]>([]);
const deleteTarget = ref<Row | null>(null);
const deleteDialogVisible = ref(false);
const batchDeleteVisible = ref(false);
const busy = ref(false);

const hasBatchOps = computed(() => !!(props.onBatchRestore || props.onBatchDelete));

const deleteDescription = computed(() =>
  deleteTarget.value ? `确定永久删除「${deleteTarget.value.name}」吗？此操作不可恢复。` : ''
);

// 轻量渲染器：将 cell()/formatter() 返回的 VNode 或字符串渲染进表格单元格。
const CellRenderer = (p: { content: VNode | string | number }) =>
  typeof p.content === 'string' || typeof p.content === 'number' ? h('span', String(p.content)) : p.content;

function resolveCell(col: ArchiveColumn, row: Row): VNode | string {
  if (col.cell) return col.cell(row);
  if (col.formatter) return col.formatter(row);
  const v = col.prop ? row[col.prop] : '';
  return v == null || v === '' ? '-' : String(v);
}

function onSelectionChange(selection: Row[]) {
  selectedIds.value = selection.map((it) => String(it.id));
}

async function handleRestore(row: Row) {
  if (busy.value) return;
  busy.value = true;
  try {
    await props.onRestore(row);
  } finally {
    busy.value = false;
  }
}

function handleDelete(row: Row) {
  deleteTarget.value = row;
  deleteDialogVisible.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value || !props.onDelete || busy.value) return;
  busy.value = true;
  try {
    await props.onDelete(deleteTarget.value);
    selectedIds.value = selectedIds.value.filter((id) => id !== deleteTarget.value!.id);
    deleteTarget.value = null;
    deleteDialogVisible.value = false;
  } finally {
    busy.value = false;
  }
}

async function handleBatchRestore() {
  if (!props.onBatchRestore || selectedIds.value.length === 0 || busy.value) return;
  busy.value = true;
  try {
    await props.onBatchRestore([...selectedIds.value]);
    selectedIds.value = [];
  } finally {
    busy.value = false;
  }
}

async function confirmBatchDelete() {
  if (!props.onBatchDelete || selectedIds.value.length === 0 || busy.value) return;
  busy.value = true;
  try {
    await props.onBatchDelete([...selectedIds.value]);
    selectedIds.value = [];
    batchDeleteVisible.value = false;
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.archive-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-header {
  margin-bottom: 4px;
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
.archive-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.sidebar-card {
  width: 256px;
  flex-shrink: 0;
}
.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sidebar-item {
  padding: 6px 8px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  color: #606266;
}
.sidebar-item:hover {
  background: #f5f7fa;
}
.sidebar-item.active {
  background: #409eff;
  color: #fff;
}
.archive-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.search-card :deep(.el-card__body) {
  padding: 16px;
}
.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}
.batch-tip {
  font-size: 13px;
  color: #909399;
}
.batch-actions {
  display: flex;
  gap: 8px;
}
.table-card :deep(.el-card__body) {
  padding: 0;
}
.action-link {
  margin-right: 12px;
  color: #409eff;
  text-decoration: none;
  font-size: 13px;
}
.action-link:hover {
  text-decoration: underline;
}
</style>

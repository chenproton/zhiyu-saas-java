<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="720px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="desc">共 {{ total }} 个零引用{{ entityLabel }}，可按距今天数区间筛选</p>

    <div class="filter-row">
      <span class="filter-text">距今</span>
      <el-input v-model="minDaysInput" type="number" :min="0" placeholder="最小" class="days-input" @input="onDaysInput" />
      <span class="filter-sep">~</span>
      <el-input v-model="maxDaysInput" type="number" :min="0" placeholder="最大" class="days-input" @input="onDaysInput" />
      <span class="filter-text">天</span>
      <el-button v-if="minDays !== undefined || maxDays !== undefined" text @click="clearFilter">清除筛选</el-button>
      <el-button
        v-if="selectedIds.length"
        type="danger"
        size="small"
        class="batch-delete"
        :disabled="deleting"
        @click="confirmBatchDelete"
      >
        删除选中（{{ selectedIds.length }}）
      </el-button>
    </div>

    <el-table v-loading="loading" :data="items" stripe @selection-change="onSelectionChange">
      <el-table-column type="selection" width="40" />
      <el-table-column label="名称" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.name }}</template>
      </el-table-column>
      <el-table-column label="上传时间" width="150">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="距今" width="90" align="right">
        <template #default="{ row }">{{ daysAgo(row.createdAt) }} 天</template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="totalPages > 1"
      v-model:current-page="page"
      :page-size="PAGE_SIZE"
      :total="total"
      layout="prev, pager, next, total"
      class="pagination"
      @current-change="load"
    />

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UncitedItem } from './types';
import { addDays, formatDateTime, toYMD } from './format';

const PAGE_SIZE = 20;

const props = defineProps<{
  modelValue: boolean;
  title: string;
  entityLabel: string;
  fetchUncited: (params: {
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }) => Promise<{ items: UncitedItem[]; total: number }>;
  deleteItem: (id: string) => Promise<unknown>;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'deleted'): void;
}>();

const minDaysInput = ref('');
const maxDaysInput = ref('');
const items = ref<UncitedItem[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const selectedIds = ref<string[]>([]);
const deleting = ref(false);
const nowMs = ref(0);

const minDays = computed(() => (minDaysInput.value === '' ? undefined : Math.max(0, Math.floor(Number(minDaysInput.value)))));
const maxDays = computed(() => (maxDaysInput.value === '' ? undefined : Math.max(0, Math.floor(Number(maxDaysInput.value)))));
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      nowMs.value = Date.now();
      page.value = 1;
      void load(1);
    }
  }
);

async function load(targetPage: number): Promise<void> {
  loading.value = true;
  try {
    const base = nowMs.value || Date.now();
    const params: { startDate?: string; endDate?: string; limit: number; offset: number } = {
      limit: PAGE_SIZE,
      offset: (targetPage - 1) * PAGE_SIZE
    };
    if (maxDays.value !== undefined) params.startDate = toYMD(addDays(base, -maxDays.value));
    if (minDays.value !== undefined) params.endDate = toYMD(addDays(base, -minDays.value));
    const res = await props.fetchUncited(params);
    items.value = res.items || [];
    total.value = res.total || 0;
    selectedIds.value = [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onDaysInput(): void {
  page.value = 1;
  void load(1);
}

function clearFilter(): void {
  minDaysInput.value = '';
  maxDaysInput.value = '';
  page.value = 1;
  void load(1);
}

function onSelectionChange(rows: UncitedItem[]): void {
  selectedIds.value = rows.map((r) => r.id);
}

function daysAgo(createdAt: string): number {
  const diff = nowMs.value - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

async function confirmBatchDelete(): Promise<void> {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 个${props.entityLabel}吗？此操作不可恢复。`,
      '确认批量删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }
  deleting.value = true;
  try {
    await Promise.all(selectedIds.value.map((id) => props.deleteItem(id)));
    ElMessage.success(`已批量删除 ${selectedIds.value.length} 个${props.entityLabel}`);
    emit('deleted');
  } catch (e) {
    ElMessage.error((e as Error).message || '批量删除失败');
  } finally {
    // 无论成败均重载当前页：部分失败时已删除项也要移除，避免残留与分页失真
    const remainingPages = Math.max(1, Math.ceil((total.value - selectedIds.value.length) / PAGE_SIZE));
    const nextPage = Math.min(page.value, remainingPages);
    page.value = nextPage;
    await load(nextPage);
    deleting.value = false;
  }
}
</script>

<style scoped>
.desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #94a3b8;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.filter-text {
  font-size: 13px;
  color: #64748b;
  white-space: nowrap;
}
.filter-sep {
  color: #cbd5e1;
}
.days-input {
  width: 96px;
}
.batch-delete {
  margin-left: auto;
}
.pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>

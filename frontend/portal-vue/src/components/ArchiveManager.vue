<template>
  <archive-list-page
    :entity-label="resolvedEntityLabel"
    :page-title="title"
    :page-description="pageDescription"
    :sidebar-title="filterLabel"
    :sidebar-items="sidebarItems"
    :sidebar-selected-id="selectedFilterId"
    :on-sidebar-select="onSidebarSelect"
    :items="filtered"
    :loading="loading"
    :on-restore="restore"
    :on-delete="remove"
    :on-batch-restore="batchRestore"
    :on-batch-delete="batchDelete"
    :search-placeholder="searchPlaceholder"
    :search-value="searchValue"
    :on-search-change="onSearchChange"
    :columns="resolvedColumns"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import ArchiveListPage from '@/components/archive-list-page.vue';

interface ArchiveApi {
  list: (params?: Record<string, string | number | boolean | undefined>) => Promise<{ items: any[]; total?: number }>;
  saveDraft?: (id: string) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
}

// 与 archive-list-page.vue 的 ArchiveColumn 保持一致（避免跨 .vue 类型导入的复杂度）。
interface ArchiveColumn {
  label: string;
  prop?: string;
  width?: string | number;
  minWidth?: string | number;
  formatter?: (row: Record<string, any>) => string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    api: ArchiveApi;
    entityLabel?: string;
    pageDescription?: string;
    filterField?: string;
    filterLabel?: string;
    searchPlaceholder?: string;
    columns?: ArchiveColumn[];
  }>(),
  {
    entityLabel: '',
    pageDescription: '查看已归档的内容记录，支持恢复为草稿继续编辑',
    filterField: '',
    filterLabel: '筛选',
    searchPlaceholder: '搜索名称 / 编码',
    columns: undefined
  }
);

const items = ref<any[]>([]);
const loading = ref(false);
const searchValue = ref('');
const selectedFilterId = ref<string | null>(null);

// 未显式指定 entityLabel 时，从标题推导（如「岗位归档」→「岗位」）。
const resolvedEntityLabel = computed(() => props.entityLabel || props.title.replace(/归档$/, '') || '内容');

const sidebarItems = computed(() => {
  if (!props.filterField) return [];
  const set = new Set<string>();
  for (const it of items.value) {
    const v = it[props.filterField];
    if (Array.isArray(v)) {
      v.forEach((x: unknown) => set.add(String(x)));
    } else if (v != null && v !== '') {
      set.add(String(v));
    }
  }
  return Array.from(set)
    .sort()
    .map((name) => ({ id: name, name }));
});

const filtered = computed(() => {
  let result = items.value;
  if (selectedFilterId.value && props.filterField) {
    result = result.filter((it) => {
      const v = it[props.filterField!];
      if (Array.isArray(v)) return v.map(String).includes(selectedFilterId.value!);
      return String(v) === selectedFilterId.value;
    });
  }
  const q = searchValue.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (it) =>
        String(it.name || '').toLowerCase().includes(q) ||
        String(it.code || '').toLowerCase().includes(q)
    );
  }
  return result;
});

const defaultColumns: ArchiveColumn[] = [
  { label: '名称', prop: 'name', minWidth: '180' },
  { label: '编码', prop: 'code', width: '120' },
  { label: '版本', prop: 'version', width: '90' }
];

const resolvedColumns = computed(() => props.columns ?? defaultColumns);

async function loadItems() {
  loading.value = true;
  try {
    const res = await props.api.list({ status: 'archived', limit: 500 });
    items.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onSidebarSelect(id: string | null) {
  selectedFilterId.value = id;
}

function onSearchChange(value: string) {
  searchValue.value = value;
}

async function restore(row: Record<string, any>) {
  if (!props.api.saveDraft) {
    ElMessage.warning('当前内容类型不支持恢复');
    return;
  }
  try {
    await props.api.saveDraft(row.id);
    ElMessage.success('已恢复为草稿');
    await loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '恢复失败');
    throw e;
  }
}

async function remove(row: Record<string, any>) {
  try {
    await props.api.delete(row.id);
    ElMessage.success('删除成功');
    await loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
    throw e;
  }
}

async function batchRestore(ids: string[]) {
  if (!props.api.saveDraft) {
    ElMessage.warning('当前内容类型不支持恢复');
    return;
  }
  const results = await Promise.allSettled(ids.map((id) => props.api.saveDraft!(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await loadItems();
  if (failed === 0) {
    ElMessage.success(`已批量恢复 ${ids.length} 个${resolvedEntityLabel.value}`);
  } else {
    ElMessage.error(`批量恢复部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}

async function batchDelete(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => props.api.delete(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await loadItems();
  if (failed === 0) {
    ElMessage.success(`已批量删除 ${ids.length} 个${resolvedEntityLabel.value}`);
  } else {
    ElMessage.error(`批量删除部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}

onMounted(loadItems);
</script>

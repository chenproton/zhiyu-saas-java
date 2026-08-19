<template>
  <ArchiveListPage
    entity-label="人培方案"
    page-title="人培方案归档"
    page-description="查看已归档的人培方案，支持恢复为草稿继续编辑"
    sidebar-title="按专业归档"
    :sidebar-items="sidebarItems"
    :sidebar-selected-id="selectedMajor"
    :on-sidebar-select="setSelectedMajor"
    :items="filtered"
    :loading="loading"
    :on-restore="handleRestore"
    :on-delete="handleDelete"
    :on-batch-restore="handleBatchRestore"
    :on-batch-delete="handleBatchDelete"
    :detail-href="detailHref"
    search-placeholder="搜索方案名称 / 专业"
    :search-value="search"
    :on-search-change="setSearch"
    :columns="columns"
  />
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, type VNode } from 'vue';
import { ElMessage } from 'element-plus';
import ArchiveListPage from '@/components/archive-list-page.vue';
import { fetchAllPages } from '@/components/common/content-list-page.types';
import { programApi, affairsBatchApi } from '@/api/affairs';
import type { TrainingProgram } from '@/types/affairs';

interface ArchiveColumn {
  label: string;
  prop?: string;
  width?: string | number;
  minWidth?: string | number;
  formatter?: (row: Record<string, any>) => string;
  cell?: (row: Record<string, any>) => VNode | string;
}

const programs = ref<TrainingProgram[]>([]);
const batchMap = ref<Record<string, string>>({});
const loading = ref(false);
const search = ref('');
const selectedMajor = ref<string | null>(null);

function setSearch(value: string) {
  search.value = value;
}

function setSelectedMajor(id: string | null) {
  selectedMajor.value = id;
}

async function load() {
  loading.value = true;
  try {
    const [progArr, batchArr] = await Promise.all([
      fetchAllPages((page, pageSize) =>
        programApi.list({ status: 'archived', limit: pageSize, offset: page * pageSize })
      ),
      fetchAllPages((page, pageSize) =>
        affairsBatchApi.list({ limit: pageSize, offset: page * pageSize })
      )
    ]);
    programs.value = progArr as TrainingProgram[];
    const map: Record<string, string> = {};
    (batchArr as { id: string; name: string }[]).forEach((b) => {
      map[b.id] = b.name;
    });
    batchMap.value = map;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

// ─── 筛选 / 侧栏 ────────────────────────────────────────────────────────────
function batchNameOf(p: TrainingProgram): string {
  if (p.batchName) return p.batchName;
  if (!p.batchId) return '-';
  return batchMap.value[p.batchId] || '-';
}

const sidebarItems = computed(() => {
  const set = new Set<string>();
  programs.value.forEach((p) => {
    if (p.majorName) set.add(p.majorName);
  });
  return Array.from(set)
    .sort()
    .map((name) => ({ id: name, name }));
});

const filtered = computed(() => {
  let result = programs.value;
  if (selectedMajor.value) {
    result = result.filter((p) => p.majorName === selectedMajor.value);
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.majorName || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q)
    );
  }
  return result;
});

function formatDate(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const columns = computed<ArchiveColumn[]>(() => [
  {
    label: '方案名称',
    minWidth: 220,
    cell: (row) =>
      h('div', { class: 'arc-name' }, [
        h('span', { class: 'arc-name-title' }, String(row.name || '')),
        row.code
          ? h('p', { class: 'arc-name-sub' }, String(row.code))
          : h('p', { class: 'arc-name-sub' }, String((row as TrainingProgram).majorName || '-'))
      ])
  },
  { label: '专业', width: 140, formatter: (row) => (row as TrainingProgram).majorName || '-' },
  { label: '年级', width: 90, formatter: (row) => `${(row as TrainingProgram).entryYear}级` },
  {
    label: '课程数',
    width: 90,
    formatter: (row) => String((row as TrainingProgram).courseCount ?? '-')
  },
  { label: '批次', width: 140, formatter: (row) => batchNameOf(row as TrainingProgram) },
  {
    label: '归档时间',
    width: 140,
    formatter: (row) => formatDate((row as TrainingProgram).updatedAt)
  }
]);

// ─── 操作 ────────────────────────────────────────────────────────────────────
function detailHref(item: Record<string, any>): string {
  return `/affairs/programs/${item.id}/edit`;
}

async function handleRestore(row: Record<string, any>) {
  try {
    await programApi.saveDraft(row.id);
    ElMessage.success('已恢复');
  } catch (e) {
    ElMessage.error((e as Error).message || '恢复失败');
    throw e;
  } finally {
    await load();
  }
}

async function handleDelete(row: Record<string, any>) {
  try {
    await programApi.delete(row.id);
    ElMessage.success('已删除');
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
    throw e;
  } finally {
    await load();
  }
}

async function handleBatchRestore(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => programApi.saveDraft(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await load();
  if (failed === 0) {
    ElMessage.success(`已批量恢复 ${ids.length} 个人培方案`);
  } else {
    ElMessage.error(`批量恢复部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}

async function handleBatchDelete(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => programApi.delete(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await load();
  if (failed === 0) {
    ElMessage.success(`已批量删除 ${ids.length} 个人培方案`);
  } else {
    ElMessage.error(`批量删除部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}

onMounted(load);
</script>

<style scoped>
.arc-name {
  max-width: 220px;
}
.arc-name-title {
  font-weight: 500;
  color: #303133;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arc-name-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<template>
  <ArchiveListPage
    entity-label="岗位"
    page-title="岗位历史档案库"
    page-description="查看已归档的岗位记录，支持恢复为草稿继续编辑"
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
    search-placeholder="搜索岗位名称 / 简称 / 行业 / 专业"
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
import { positionApi, batchApi } from '@/api/job';
import { industryApi, majorApi } from '@/api/system';
import type { CareerPosition, JobBatch } from '@/types/job';
import type { Industry, Major } from '@/types/system';

interface ArchiveColumn {
  label: string;
  prop?: string;
  width?: string | number;
  minWidth?: string | number;
  formatter?: (row: Record<string, any>) => string;
  cell?: (row: Record<string, any>) => VNode | string;
}

const positions = ref<CareerPosition[]>([]);
const batches = ref<JobBatch[]>([]);
const loading = ref(false);
const search = ref('');
const selectedMajor = ref<string | null>(null);

function setSearch(value: string) {
  search.value = value;
}

function setSelectedMajor(id: string | null) {
  selectedMajor.value = id;
}

const industryMap = ref<Record<string, string>>({});
const majorMap = ref<Record<string, string>>({});

async function loadDicts() {
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
}

async function load() {
  loading.value = true;
  try {
    const [posArr, batchArr] = await Promise.all([
      fetchAllPages((page, pageSize) =>
        positionApi.list({ status: 'archived', limit: pageSize, offset: page * pageSize })
      ),
      fetchAllPages((page, pageSize) =>
        batchApi.list({ limit: pageSize, offset: page * pageSize })
      )
    ]);
    positions.value = posArr as CareerPosition[];
    batches.value = batchArr as JobBatch[];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

// ─── 字典 / 筛选 ────────────────────────────────────────────────────────────
function industryNameOf(p: CareerPosition): string {
  return p.industryId ? industryMap.value[p.industryId] || '-' : '-';
}

function majorNamesOf(p: CareerPosition): string {
  const ids = p.majorIds || [];
  if (ids.length === 0) return '-';
  return ids.map((id) => majorMap.value[id] || id).join('，');
}

function batchNameOf(p: CareerPosition): string {
  if (!p.batchId) return '-';
  const b = batches.value.find((x) => x.id === p.batchId);
  return b?.name || '-';
}

const sidebarItems = computed(() => {
  const set = new Set<string>();
  positions.value.forEach((p) => {
    (p.majorIds || []).forEach((id) => {
      const name = majorMap.value[id];
      if (name) set.add(name);
    });
  });
  return Array.from(set)
    .sort()
    .map((name) => ({ id: name, name }));
});

const filtered = computed(() => {
  let result = positions.value;
  if (selectedMajor.value) {
    result = result.filter((p) =>
      (p.majorIds || []).some((id) => majorMap.value[id] === selectedMajor.value)
    );
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.shortName || '').toLowerCase().includes(q) ||
        industryNameOf(p).toLowerCase().includes(q) ||
        (p.majorIds || []).some((id) => (majorMap.value[id] || '').toLowerCase().includes(q))
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
    label: '岗位名称',
    minWidth: 200,
    cell: (row) =>
      h('div', { class: 'arc-name' }, [
        h('span', { class: 'arc-name-title' }, String(row.name || '')),
        h(
          'p',
          { class: 'arc-name-sub' },
          `${industryNameOf(row as CareerPosition)} · ${majorNamesOf(row as CareerPosition)}`
        )
      ])
  },
  { label: '简称', width: 120, formatter: (row) => row.shortName || '-' },
  { label: '版本', width: 90, formatter: (row) => row.version || '-' },
  { label: '所属行业', width: 130, formatter: (row) => industryNameOf(row as CareerPosition) },
  { label: '适用专业', width: 160, formatter: (row) => majorNamesOf(row as CareerPosition) },
  { label: '所属批次分组', width: 140, formatter: (row) => batchNameOf(row as CareerPosition) },
  { label: '归档时间', width: 140, formatter: (row) => formatDate((row as CareerPosition).updatedAt) }
]);

// ─── 操作 ────────────────────────────────────────────────────────────────────
function detailHref(item: Record<string, any>): string {
  return `/job/positions/${item.id}/edit`;
}

async function handleRestore(row: Record<string, any>) {
  try {
    await positionApi.saveDraft(row.id);
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
    await positionApi.delete(row.id);
    ElMessage.success('已删除');
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
    throw e;
  } finally {
    await load();
  }
}

async function handleBatchRestore(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => positionApi.saveDraft(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await load();
  if (failed === 0) {
    ElMessage.success(`已批量恢复 ${ids.length} 个岗位`);
  } else {
    ElMessage.error(`批量恢复部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}

async function handleBatchDelete(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => positionApi.delete(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await load();
  if (failed === 0) {
    ElMessage.success(`已批量删除 ${ids.length} 个岗位`);
  } else {
    ElMessage.error(`批量删除部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}

onMounted(() => {
  loadDicts();
  load();
});
</script>

<style scoped>
.arc-name {
  max-width: 200px;
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

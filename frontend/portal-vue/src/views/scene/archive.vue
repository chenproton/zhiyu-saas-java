<template>
  <ArchiveListPage
    entity-label="场景"
    page-title="场景历史档案库"
    page-description="查看已归档的场景记录，支持恢复为草稿继续编辑"
    sidebar-title="按专业归档"
    :sidebar-items="professions"
    :sidebar-selected-id="selectedProfession"
    :on-sidebar-select="onSidebarSelect"
    :items="filtered"
    :loading="loading"
    :on-restore="restore"
    :on-delete="remove"
    :on-batch-restore="batchRestore"
    :on-batch-delete="batchDelete"
    :detail-href="(item) => `/scene/scenarios/${item.id}/edit`"
    search-placeholder="搜索场景名称 / 编码 / 专业 / 行业"
    :search-value="search"
    :on-search-change="onSearchChange"
    :columns="columns"
  />
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, type VNode } from 'vue';
import { ElMessage } from 'element-plus';
import ArchiveListPage from '@/components/archive-list-page.vue';
import { fetchAllPages } from '@/components/common/content-list-page.types';
import { scenarioApi, sceneBatchApi } from '@/api/scene';
import type { Scenario } from '@/types/scene';

type Row = Record<string, any>;

// 与 archive-list-page.vue 的 ArchiveColumn 结构保持一致（避免跨 .vue 类型导入的复杂度）。
interface ArchiveColumn {
  label: string;
  prop?: string;
  width?: string | number;
  minWidth?: string | number;
  formatter?: (row: Row) => string;
  cell?: (row: Row) => VNode | string;
}

// ─── 数据加载：全量拉取归档场景 + 全量批次（对齐 React archive/page.tsx） ────
const scenarios = ref<Scenario[]>([]);
const batches = ref<any[]>([]);
const loading = ref(false);

const search = ref('');
const selectedProfession = ref<string | null>(null);

async function loadData() {
  loading.value = true;
  try {
    const [scenarioRes, batchRes] = await Promise.all([
      fetchAllPages<Scenario>((page, pageSize) =>
        scenarioApi.list({ status: 'archived', limit: pageSize, offset: page * pageSize })
      ),
      fetchAllPages<any>((page, pageSize) =>
        sceneBatchApi.list({ limit: pageSize, offset: page * pageSize })
      )
    ]);
    scenarios.value = scenarioRes;
    batches.value = batchRes;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

// ─── 专业侧栏 / 过滤（对齐 React：按 professionNames||professionIds 归类） ────
function namesOf(s: Scenario): string[] {
  return (s.professionNames || s.professionIds || []) as string[];
}

const professions = computed(() => {
  const set = new Set<string>();
  for (const s of scenarios.value) {
    namesOf(s).forEach((n) => set.add(n));
  }
  return Array.from(set).sort().map((name) => ({ id: name, name }));
});

function onSidebarSelect(id: string | null) {
  selectedProfession.value = id;
}

function onSearchChange(value: string) {
  search.value = value;
}

const filtered = computed<Scenario[]>(() => {
  let result = scenarios.value;
  if (selectedProfession.value) {
    result = result.filter((s) => namesOf(s).includes(selectedProfession.value!));
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q) ||
        namesOf(s).some((v) => (v || '').toLowerCase().includes(q)) ||
        (s.industryNames || s.industryIds || []).some((v) => String(v).toLowerCase().includes(q))
    );
  }
  return result;
});

const batchMap = computed(() => new Map(batches.value.map((b) => [b.id, b])));

function formatDate(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function joinNames(arr: string[] | undefined): string {
  return (arr || []).join('、') || '-';
}

// ─── 列定义（对齐 React：名称/编码/版本/行业/专业/批次/归档时间） ────
const columns = computed<ArchiveColumn[]>(() => [
  {
    label: '场景名称',
    width: 176,
    cell: (row: Row) =>
      h('div', { style: 'max-width:176px;overflow:hidden;' }, [
        h(
          'span',
          {
            style:
              'display:block;font-weight:500;color:#303133;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
          },
          String(row.name ?? '')
        ),
        h(
          'p',
          {
            style:
              'margin:2px 0 0;font-size:12px;color:#909399;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
          },
          `${joinNames(row.professionNames || row.professionIds)} · ${joinNames(row.industryNames || row.industryIds)}`
        )
      ])
  },
  {
    label: '场景编码',
    prop: 'code',
    width: 112
  },
  {
    label: '版本',
    prop: 'version',
    width: 80
  },
  {
    label: '所属行业',
    width: 96,
    formatter: (row: Row) => joinNames(row.industryNames || row.industryIds)
  },
  {
    label: '适用专业',
    width: 128,
    formatter: (row: Row) => joinNames(row.professionNames || row.professionIds)
  },
  {
    label: '所属批次分组',
    width: 112,
    formatter: (row: Row) =>
      row.batchId ? (batchMap.value.get(row.batchId)?.name as string) || '-' : '-'
  },
  {
    label: '归档时间',
    width: 96,
    formatter: (row: Row) => formatDate(row.updatedAt)
  }
]);

// ─── 操作（对齐 React：saveDraft 恢复 / delete 删除 / 批量恢复 / 批量删除） ────
async function restore(item: Row) {
  try {
    await scenarioApi.saveDraft(item.id);
    ElMessage.success('已恢复');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '恢复失败');
  }
}

async function remove(item: Row) {
  try {
    await scenarioApi.delete(item.id);
    ElMessage.success('已删除');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function batchRestore(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => scenarioApi.saveDraft(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await loadData();
  if (failed === 0) {
    ElMessage.success(`已批量恢复 ${ids.length} 个场景`);
  } else {
    ElMessage.error(`批量恢复部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}

async function batchDelete(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => scenarioApi.delete(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await loadData();
  if (failed === 0) {
    ElMessage.success(`已批量删除 ${ids.length} 个场景`);
  } else {
    ElMessage.error(`批量删除部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}
</script>

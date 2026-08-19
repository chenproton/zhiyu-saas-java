<template>
  <ArchiveListPage
    entity-label="试卷"
    page-title="试卷历史档案库"
    page-description="查看已归档的试卷记录，支持恢复为草稿继续编辑"
    :items="filtered"
    :loading="loading"
    :on-restore="restore"
    :on-delete="remove"
    :on-batch-restore="batchRestore"
    :on-batch-delete="batchDelete"
    :detail-href="(item) => `/evaluation/exams/${item.id}/edit`"
    search-placeholder="搜索试卷名称 / 编码"
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
import { examApi } from '@/api/evaluation';
import type { Exam } from '@/types/evaluation';

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

// ─── 数据加载：全量拉取归档试卷（对齐 React archive 页面 fetchAllPages 模式） ────
const exams = ref<Exam[]>([]);
const loading = ref(false);
const search = ref('');

async function loadData() {
  loading.value = true;
  try {
    exams.value = await fetchAllPages<Exam>((page, pageSize) =>
      examApi.list({ status: 'archived', limit: pageSize, offset: page * pageSize })
    );
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

function onSearchChange(value: string) {
  search.value = value;
}

const filtered = computed<Exam[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return exams.value;
  return exams.value.filter(
    (e) =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.code || '').toLowerCase().includes(q)
  );
});

function formatDate(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 列定义（对齐 React 试卷列表核心字段：名称/编码/简介/题目数/总分/归档时间） ────
const columns = computed<ArchiveColumn[]>(() => [
  {
    label: '试卷名称',
    minWidth: 220,
    cell: (row: Row) =>
      h('div', { class: 'arc-name' }, [
        h('span', { class: 'arc-name-title' }, String(row.name ?? '')),
        h('p', { class: 'arc-name-sub' }, String(row.description || '-'))
      ])
  },
  { label: '试卷编码', prop: 'code', width: 140 },
  { label: '题目数量', width: 90, formatter: (row: Row) => `${row.questionCount ?? 0} 题` },
  { label: '总分', width: 80, formatter: (row: Row) => `${row.totalScore ?? 0} 分` },
  { label: '归档时间', width: 140, formatter: (row: Row) => formatDate(row.updatedAt) }
]);

// ─── 操作（对齐 React：saveDraft 恢复 / delete 删除 / 批量恢复 / 批量删除） ────
async function restore(item: Row) {
  try {
    await examApi.saveDraft(item.id);
    ElMessage.success('已恢复为草稿');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '恢复失败');
    throw e;
  }
}

async function remove(item: Row) {
  try {
    await examApi.delete(item.id);
    ElMessage.success('已删除');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
    throw e;
  }
}

async function batchRestore(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => examApi.saveDraft(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await loadData();
  if (failed === 0) {
    ElMessage.success(`已批量恢复 ${ids.length} 个试卷`);
  } else {
    ElMessage.error(`批量恢复部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}

async function batchDelete(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => examApi.delete(id)));
  const failed = results.filter((r) => r.status === 'rejected').length;
  await loadData();
  if (failed === 0) {
    ElMessage.success(`已批量删除 ${ids.length} 个试卷`);
  } else {
    ElMessage.error(`批量删除部分失败：成功 ${ids.length - failed} 个，失败 ${failed} 个`);
  }
}
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

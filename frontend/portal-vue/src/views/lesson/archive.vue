<template>
  <!-- 对齐 React frontend/edu/app/lesson/admin/archive/page.tsx（ArchiveListPage 用法） -->
  <ArchiveListPage
    entity-label="课程"
    page-title="课程历史档案库"
    page-description="查看已归档的课程记录，支持恢复为草稿继续编辑"
    sidebar-title="按专业归档"
    :sidebar-items="majors"
    :sidebar-selected-id="selectedMajor"
    :on-sidebar-select="onSidebarSelect"
    :items="filtered"
    :loading="loading"
    :on-restore="restore"
    :detail-href="detailHref"
    search-placeholder="搜索课程名称 / 编码 / 专业 / 分类"
    :search-value="search"
    :on-search-change="onSearchChange"
    :columns="columns"
    :render-status="renderStatus"
  />
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref, type VNode } from 'vue';
import { ElMessage } from 'element-plus';
import ArchiveListPage from '@/components/archive-list-page.vue';
import { fetchAllPages } from '@/components/common/content-list-page.types';
import { courseApi, lessonBatchApi } from '@/api/lesson';
import type { Course } from '@/types/lesson';

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

// ─── 数据加载：全量拉取归档课程 + 全量批次（对齐 React archive/page.tsx） ──────
const courses = ref<Course[]>([]);
const batches = ref<any[]>([]);
const loading = ref(false);

const search = ref('');
const selectedMajor = ref<string | null>(null);

async function loadData() {
  loading.value = true;
  try {
    const [courseRes, batchRes] = await Promise.all([
      fetchAllPages<Course>((page, pageSize) =>
        courseApi.list({ status: 'archived', limit: pageSize, offset: page * pageSize })
      ),
      fetchAllPages<any>((page, pageSize) =>
        lessonBatchApi.list({ limit: pageSize, offset: page * pageSize })
      )
    ]);
    courses.value = courseRes;
    batches.value = batchRes;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

// ─── 专业侧栏 / 过滤（对齐 React：按 majorName 归类去重排序） ─────────────────
const majors = computed(() => {
  const set = new Set<string>();
  for (const c of courses.value) {
    if (c.majorName) set.add(c.majorName);
  }
  return Array.from(set)
    .sort()
    .map((name) => ({ id: name, name }));
});

function onSidebarSelect(id: string | null) {
  selectedMajor.value = id;
}

function onSearchChange(value: string) {
  search.value = value;
}

const filtered = computed<Course[]>(() => {
  let result = courses.value;
  if (selectedMajor.value) {
    result = result.filter((c) => c.majorName === selectedMajor.value);
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q) ||
        (c.majorName || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q)
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

const COURSE_TYPE_TEXT: Record<string, string> = {
  system: '体系课',
  granular: '颗粒课',
  hybrid: '混合课'
};

function courseTypeText(type?: string): string {
  return type ? COURSE_TYPE_TEXT[type] || '混合课' : '混合课';
}

// 对齐 React StatusBadge（archived → 已归档）
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending: '审核中',
  approved: '已通过',
  rejected: '已驳回',
  published: '已发布',
  archived: '已归档'
};

function renderStatus(row: Row): string {
  return STATUS_LABELS[String(row.status)] || String(row.status ?? '-');
}

// ─── 列定义（对齐 React：名称/编码/类型/版本/专业/批次/归档时间） ─────────────
const columns = computed<ArchiveColumn[]>(() => [
  {
    label: '课程名称',
    minWidth: 200,
    cell: (row: Row) =>
      h('div', { style: 'max-width:200px;overflow:hidden;' }, [
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
          `${row.category || '-'} · ${row.majorName || '-'}`
        )
      ])
  },
  {
    label: '课程编码',
    prop: 'code',
    width: 120
  },
  {
    label: '课程类型',
    width: 100,
    formatter: (row: Row) => courseTypeText(row.type)
  },
  {
    label: '版本',
    prop: 'version',
    width: 80
  },
  {
    label: '适用专业',
    width: 120,
    formatter: (row: Row) => row.majorName || '-'
  },
  {
    label: '所属批次分组',
    width: 140,
    formatter: (row: Row) =>
      row.batchId ? (batchMap.value.get(row.batchId)?.name as string) || String(row.batchId) : '-'
  },
  {
    label: '归档时间',
    width: 120,
    formatter: (row: Row) => formatDate(row.updatedAt)
  }
]);

// ─── 操作（对齐 React：查看跳编辑页 / saveDraft 恢复为草稿） ──────────────────
function editHref(type: string | undefined, id: string): string {
  if (type === 'system') return `/lesson/admin/system/add?id=${id}`;
  if (type === 'granular') return `/lesson/admin/granular/add?id=${id}`;
  return `/lesson/admin/hybrid/add?id=${id}`;
}

function detailHref(item: Row): string {
  return editHref(item.type as string | undefined, String(item.id));
}

async function restore(item: Row) {
  try {
    await courseApi.saveDraft(String(item.id));
    ElMessage.success('已恢复');
    await loadData();
  } catch (e) {
    ElMessage.error((e as Error).message || '恢复失败');
  }
}
</script>

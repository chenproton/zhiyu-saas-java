<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">操作日志查看</h1>
        <p class="page-desc">查看用户操作记录</p>
      </div>
      <div class="header-actions">
        <el-button :loading="loading" @click="loadLogs">刷新</el-button>
        <el-button disabled title="即将上线">批量导出</el-button>
      </div>
    </div>

    <el-input
      v-model="searchTerm"
      placeholder="搜索用户、模块或操作..."
      clearable
      style="max-width: 320px; margin-bottom: 16px"
      @input="onSearchInput"
      @clear="onSearchInput"
    />

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 16px">
      <template #default>
        <el-button size="small" text type="primary" @click="loadLogs">重试</el-button>
      </template>
    </el-alert>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="displayLogs" stripe :empty-text="loading ? '加载中...' : '暂无操作日志'">
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">
            <div class="cell-strong">{{ row.userName || '-' }}</div>
            <div class="cell-mono">{{ row.userId || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="模块" min-width="120">
          <template #default="{ row }">{{ row.module || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="140">
          <template #default="{ row }">{{ row.action }}</template>
        </el-table-column>
        <el-table-column label="操作对象" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ formatTarget(row) }}</template>
        </el-table-column>
        <el-table-column label="IP地址" min-width="130">
          <template #default="{ row }">
            <span class="cell-mono">{{ row.ip || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
              {{ row.status === 'success' ? '成功' : row.status || '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作时间" min-width="160">
          <template #default="{ row }">{{ row.createdAt }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <div class="page-footer">
      <span class="footer-text">共 {{ searching ? searchFiltered.length : total }} 条记录</span>
      <el-pagination
        layout="prev, pager, next"
        :current-page="page"
        :page-size="PAGE_SIZE"
        :total="searching ? searchFiltered.length : total"
        :disabled="loading"
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { portalRequest, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';

interface OperationLog {
  id: string;
  tenantId: string;
  userId?: string;
  userName?: string;
  module?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  ip?: string;
  status?: string;
  createdAt: string;
}

const PAGE_SIZE = 20;

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const logs = ref<OperationLog[]>([]);
const total = ref(0);
const loading = ref(true);
const error = ref('');
const searchTerm = ref('');
const debouncedSearch = ref('');
const page = ref(1);
let seqRef = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchAllPages(
  fetcher: (page: number, pageSize: number) => Promise<{ items: OperationLog[] }>
): Promise<OperationLog[]> {
  const all: OperationLog[] = [];
  const pageSize = 200;
  for (let p = 0; p < 1000; p++) {
    const res = await fetcher(p, pageSize);
    const items = res.items || [];
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

async function loadLogs() {
  if (!tenantId.value) return;
  const seq = ++seqRef;
  loading.value = true;
  error.value = '';
  try {
    const searching = debouncedSearch.value.trim() !== '';
    if (searching) {
      const all = await fetchAllPages((pg, ps) =>
        portalRequest<ListResponse<OperationLog>>(
          `/logs/operation${buildQuery({ tenantId: tenantId.value, limit: ps, offset: pg * ps })}`
        )
      );
      if (seq !== seqRef) return;
      logs.value = all;
      total.value = all.length;
    } else {
      const res = await portalRequest<ListResponse<OperationLog>>(
        `/logs/operation${buildQuery({
          tenantId: tenantId.value,
          limit: PAGE_SIZE,
          offset: (page.value - 1) * PAGE_SIZE
        })}`
      );
      if (seq !== seqRef) return;
      logs.value = res.items;
      total.value = res.total;
    }
  } catch (e) {
    if (seq !== seqRef) return;
    error.value = (e as Error).message || '加载操作日志失败';
  } finally {
    if (seq === seqRef) loading.value = false;
  }
}

const searching = computed(() => searchTerm.value.trim() !== '');

const searchFiltered = computed<OperationLog[]>(() => {
  const keyword = searchTerm.value.trim();
  if (!keyword) return logs.value;
  return logs.value.filter(
    (log) =>
      (log.userName || '').includes(keyword) ||
      (log.userId || '').includes(keyword) ||
      (log.module || '').includes(keyword) ||
      log.action.includes(keyword)
  );
});

const displayLogs = computed<OperationLog[]>(() => {
  if (!searching.value) return searchFiltered.value;
  return searchFiltered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE);
});

function formatTarget(log: OperationLog): string {
  if (log.detail) return log.detail;
  const parts = [log.targetType, log.targetId].filter(Boolean);
  return parts.length ? parts.join(': ') : '-';
}

function onSearchInput() {
  page.value = 1;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedSearch.value = searchTerm.value;
  }, 300);
}

function onPageChange(newPage: number) {
  page.value = newPage;
  if (!searching.value) loadLogs();
}

watch(debouncedSearch, () => loadLogs());

onMounted(loadLogs);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title { font-size: 20px; font-weight: 600; margin: 0; }
.page-desc { color: #909399; font-size: 13px; margin: 4px 0 0; }
.header-actions { display: flex; gap: 8px; }
.page-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}
.footer-text { color: #909399; font-size: 13px; }
.cell-strong { font-weight: 500; }
.cell-mono { font-family: monospace; font-size: 12px; color: #909399; }
</style>

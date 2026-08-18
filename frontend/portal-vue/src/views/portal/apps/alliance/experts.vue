<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">专家资源库</div>
            <div class="card-sub">已引入企业维护的专家档案，学校端只读。</div>
          </div>
        </div>
      </template>

      <div class="toolbar">
        <el-input
          v-model="search"
          placeholder="搜索姓名、头衔或行业..."
          clearable
          style="max-width: 320px"
          @input="onSearchInput"
          @clear="onSearchClear"
          @keyup.enter="reloadList"
        />
        <el-select v-model="enterpriseFilter" placeholder="按所属企业筛选" style="width: 200px" @change="onFilterChange">
          <el-option label="全部企业" value="all" />
          <el-option v-for="e in enterprises" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="姓名" min-width="120">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="goDetail(row.id)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.isPublic || false" @change="(v: any) => togglePublic(row, Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column label="头衔" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.title || '-' }}</template>
        </el-table-column>
        <el-table-column label="职位" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.position || '-' }}</template>
        </el-table-column>
        <el-table-column label="所属企业" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ enterpriseName(row.enterpriseId) || row.organization || '-' }}</template>
        </el-table-column>
        <el-table-column label="行业" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.industry || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ allianceLabel('expertStatus', row.status) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goDetail(row.id)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next, total"
        class="pagination"
        @current-change="loadList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { portalRequest, buildQuery } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { allianceLabel } from './alliance-admin';
import type { AllianceExpert, ListResponse } from './alliance-admin';

const router = useRouter();
const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const PAGE_SIZE = 20;
const items = ref<AllianceExpert[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = PAGE_SIZE;
const search = ref('');
const enterpriseFilter = ref('all');
const enterprises = ref<{ id: string; name: string }[]>([]);

function enterpriseName(id?: string): string | undefined {
  return enterprises.value.find((e) => e.id === id)?.name;
}

async function loadList() {
  if (!tenantId.value) return;
  loading.value = true;
  try {
    const res = await portalRequest<ListResponse<AllianceExpert>>(
      `/alliance/experts${buildQuery({
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE,
        search: search.value.trim() || undefined,
        enterpriseId: enterpriseFilter.value === 'all' ? undefined : enterpriseFilter.value,
      })}`,
    );
    items.value = res.items || [];
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadEnterprises() {
  if (!tenantId.value) return;
  try {
    const res = await portalRequest<ListResponse<{ id: string; name: string }>>('/alliance/enterprises?limit=200');
    enterprises.value = (res.items || []).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    // 企业筛选数据源加载失败不阻断主流程
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadList();
  }, 300);
}
function onSearchClear() {
  page.value = 1;
  loadList();
}
function reloadList() {
  if (searchTimer) clearTimeout(searchTimer);
  page.value = 1;
  loadList();
}
function onFilterChange() {
  page.value = 1;
  loadList();
}

function goDetail(id: string) {
  router.push(`/portal/apps/alliance/experts/${id}`);
}

async function togglePublic(item: AllianceExpert, v: boolean) {
  try {
    await portalRequest(`/alliance/experts/${item.id}/display`, {
      method: 'PUT',
      body: JSON.stringify({ isPublic: v }),
    });
    item.isPublic = v;
    ElMessage.success(v ? '已开启前台展示' : '已取消前台展示');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

onMounted(() => {
  loadList();
  loadEnterprises();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>

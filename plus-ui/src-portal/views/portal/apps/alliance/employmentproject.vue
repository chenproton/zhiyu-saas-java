<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">就业项目管理</div>
            <div class="card-sub">管理人才与岗位供需服务大厅的就业项目。</div>
          </div>
          <el-button type="primary" size="small" @click="router.push('/portal/apps/alliance/employmentproject/new')">新建项目</el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-input v-model="search" placeholder="搜索项目名称..." clearable style="max-width: 280px" @input="onSearchInput" @clear="reloadList" @keyup.enter="reloadList" />
        <el-select v-model="publishStatus" style="width: 140px" @change="onFilterChange">
          <el-option label="全部发布状态" value="all" />
          <el-option label="已发布" value="published" />
          <el-option label="草稿" value="draft" />
        </el-select>
        <el-select v-model="typeFilter" style="width: 140px" @change="onFilterChange">
          <el-option label="全部类型" value="all" />
          <el-option v-for="(label, v) in EMPLOYMENT_PROJECT_TYPE_LABELS" :key="v" :label="label" :value="v" />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="项目名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="goDetail(row.id)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="120"><template #default="{ row }">{{ employmentTypeLabel(row.type) }}</template></el-table-column>
        <el-table-column label="发起单位" min-width="140" show-overflow-tooltip><template #default="{ row }">{{ row.organizer || '-' }}</template></el-table-column>
        <el-table-column label="起止日期" width="200"><template #default="{ row }">{{ formatDate(row.startDate) }} ~ {{ formatDate(row.endDate) }}</template></el-table-column>
        <el-table-column label="展示状态" width="100">
          <template #default="{ row }">
            <el-tag :type="phaseTagType(deriveEmploymentProjectPhase(row))">{{ EMPLOYMENT_PROJECT_PHASE_LABELS[deriveEmploymentProjectPhase(row)] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.publishStatus === 'published' ? 'success' : 'info'">{{ row.publishStatus === 'published' ? '已发布' : '草稿' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goDetail(row.id)">编辑</el-button>
            <el-button size="small" text type="primary" @click="togglePublish(row)">{{ row.publishStatus === 'published' ? '取消发布' : '发布' }}</el-button>
            <el-button size="small" text type="danger" @click="confirmDelete(row)">删除</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import { portalRequest, buildQuery } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  EMPLOYMENT_PROJECT_TYPE_LABELS,
  EMPLOYMENT_PROJECT_PHASE_LABELS,
  deriveEmploymentProjectPhase,
  formatDate,
  employmentTypeLabel,
} from './alliance-admin';
import type { EmploymentProject, ListResponse } from './alliance-admin';

const router = useRouter();
const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const PAGE_SIZE = 20;
const items = ref<EmploymentProject[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = PAGE_SIZE;
const search = ref('');
const publishStatus = ref('all');
const typeFilter = ref('all');

function phaseTagType(phase: string): 'success' | 'warning' | 'info' {
  if (phase === 'ongoing') return 'success';
  if (phase === 'ended') return 'info';
  return 'warning';
}

async function loadList() {
  if (!tenantId.value) return;
  loading.value = true;
  try {
    const res = await portalRequest<ListResponse<EmploymentProject>>(
      `/alliance/employment-projects${buildQuery({
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE,
        search: search.value.trim() || undefined,
        publishStatus: publishStatus.value === 'all' ? undefined : publishStatus.value,
        type: typeFilter.value === 'all' ? undefined : typeFilter.value,
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

let searchTimer: ReturnType<typeof setTimeout> | undefined;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadList();
  }, 300);
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
  router.push(`/portal/apps/alliance/employmentproject/${id}`);
}

async function togglePublish(p: EmploymentProject) {
  const next = p.publishStatus === 'published' ? 'draft' : 'published';
  try {
    await portalRequest(`/alliance/employment-projects/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ publishStatus: next }),
    });
    ElMessage.success(next === 'published' ? '已发布' : '已取消发布');
    await loadList();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function confirmDelete(p: EmploymentProject) {
  try {
    await ElMessageBox.confirm(`确定要删除就业项目 ${p.name} 吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await portalRequest(`/alliance/employment-projects/${p.id}`, { method: 'DELETE' });
    ElMessage.success('已删除');
    await loadList();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(loadList);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>

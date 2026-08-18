<template>
  <div class="list-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">合作项目管理</h1>
        <p class="page-sub">管理校企合作项目，追踪项目阶段与里程碑。</p>
      </div>
      <el-button type="primary" @click="router.push('/portal/apps/alliance/projects/new')">
        <el-icon><Plus /></el-icon>
        新建项目
      </el-button>
    </div>

    <el-card shadow="never">
      <el-input
        v-model="search"
        placeholder="搜索项目名称..."
        clearable
        style="max-width: 320px; margin-bottom: 12px"
        @input="onSearch"
        @clear="onSearch"
      />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="项目名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="router.push(`/portal/apps/alliance/projects/${row.id}`)">
              {{ row.name }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="100">
          <template #default="{ row }">
            <el-switch :model-value="row.isPublic || false" @change="togglePublic(row)" />
          </template>
        </el-table-column>
        <el-table-column label="合作企业" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ enterpriseNames(row) }}</template>
        </el-table-column>
        <el-table-column label="合作类型" width="120">
          <template #default="{ row }">{{ row.type || '-' }}</template>
        </el-table-column>
        <el-table-column label="起止时间" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.startDate) }} ~ {{ formatDate(row.endDate) }}</template>
        </el-table-column>
        <el-table-column label="里程碑进度" width="180">
          <template #default="{ row }">
            <div class="progress-cell">
              <el-progress :percentage="progressOf(row)" :stroke-width="8" style="flex: 1" />
              <span class="progress-text">{{ progressOf(row) }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="阶段" width="110">
          <template #default="{ row }">{{ phaseLabel(row.phase) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="120">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="router.push(`/portal/apps/alliance/projects/${row.id}`)">查看</el-button>
            <el-button link type="primary" size="small" @click="router.push(`/portal/apps/alliance/projects/${row.id}/edit`)">编辑</el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
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
        @current-change="loadItems"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import {
  allianceProjectApi,
  enterpriseApi,
  milestoneApi,
  allianceLabel,
  formatDate,
  type AllianceProject,
  type AllianceEnterprise,
  type AllianceProjectMilestone,
} from './crud-shared';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');
const router = useRouter();

const items = ref<AllianceProject[]>([]);
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const enterprises = ref<AllianceEnterprise[]>([]);
const milestones = ref<Record<string, AllianceProjectMilestone[]>>({});

async function loadEnterprises() {
  try {
    const res = await enterpriseApi.list({ limit: 200 });
    enterprises.value = res.items || [];
  } catch {
    // 忽略
  }
}

function enterpriseNames(row: AllianceProject): string {
  const ids = (row.enterpriseIds || []).map(String);
  if (ids.length === 0) return '-';
  return ids
    .map((eid) => enterprises.value.find((e) => e.id === eid)?.name || eid)
    .join('、');
}

function phaseLabel(v?: string): string {
  return allianceLabel('projectPhase', v);
}

function progressOf(row: AllianceProject): number {
  const ms = milestones.value[row.id] || [];
  if (ms.length === 0) return 0;
  const done = ms.filter((m) => m.isCompleted).length;
  return Math.round((done / ms.length) * 100);
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await allianceProjectApi.list({
      search: search.value.trim() || undefined,
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    });
    items.value = res.items;
    total.value = res.total ?? 0;

    const map: Record<string, AllianceProjectMilestone[]> = {};
    const results = await Promise.all(
      res.items.map((p) => milestoneApi.list(p.id).catch(() => ({ items: [] as AllianceProjectMilestone[] }))),
    );
    res.items.forEach((p, i) => {
      map[p.id] = results[i].items || [];
    });
    milestones.value = map;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  loadItems();
}

async function togglePublic(row: AllianceProject) {
  const next = !row.isPublic;
  try {
    await allianceProjectApi.update(row.id, { isPublic: next });
    row.isPublic = next;
    ElMessage.success(next ? '已设为前台展示' : '已取消前台展示');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function confirmDelete(row: AllianceProject) {
  try {
    await ElMessageBox.confirm(`确定要删除项目 ${row.name} 吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await allianceProjectApi.delete(row.id);
    ElMessage.success('已删除');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(async () => {
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      // 忽略
    }
  }
  loadEnterprises();
  loadItems();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; }
.page-sub { margin: 4px 0 0; font-size: 13px; color: #909399; }
.pagination { margin-top: 16px; justify-content: flex-end; }
.progress-cell { display: flex; align-items: center; gap: 8px; }
.progress-text { font-size: 12px; color: #909399; }
</style>

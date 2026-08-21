<template>
  <div class="list-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">合作项目管理</h1>
        <p class="page-sub">管理校企合作项目，追踪项目阶段与里程碑。</p>
      </div>
      <div>
        <el-button style="margin-right: 8px" @click="importDialog = true">批量导入</el-button>
        <el-button type="primary" @click="router.push('/portal/apps/alliance/projects/new')">
          <el-icon><Plus /></el-icon>
          新建项目
        </el-button>
      </div>
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

    <!-- 批量导入（对齐 React importConfig：alliance-projects，走 Java 泛化导入 /import/{entity}/excel） -->
    <el-dialog v-model="importDialog" title="批量导入合作项目" width="560px">
      <ImportExport entity="alliance-projects" :on-imported="loadItems" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import ImportExport from '@/components/ImportExport.vue';
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
import { useAllianceListPage } from './crud-pages';

const importDialog = ref(false);
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

const {
  router,
  items,
  loading,
  search,
  page,
  pageSize,
  total,
  loadItems,
  resetAndLoad: onSearch,
  togglePublic,
  confirmDelete,
} = useAllianceListPage<AllianceProject>({
  fetchList: (query) => allianceProjectApi.list(query),
  afterLoaded: async (list) => {
    const map: Record<string, AllianceProjectMilestone[]> = {};
    const results = await Promise.all(
      list.map((p) => milestoneApi.list(p.id).catch(() => ({ items: [] as AllianceProjectMilestone[] }))),
    );
    list.forEach((p, i) => {
      map[p.id] = results[i].items || [];
    });
    milestones.value = map;
  },
  togglePublic: {
    update: (row, next) => allianceProjectApi.update(row.id, { isPublic: next }),
    apply: (row, next) => {
      row.isPublic = next;
    },
    successText: (next) => (next ? '已设为前台展示' : '已取消前台展示'),
  },
  remove: {
    confirmText: (row) => `确定要删除项目 ${row.name} 吗？`,
    deleteRow: (row) => allianceProjectApi.delete(row.id),
    successText: '已删除',
  },
  onMountedExtras: () => {
    loadEnterprises();
  },
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

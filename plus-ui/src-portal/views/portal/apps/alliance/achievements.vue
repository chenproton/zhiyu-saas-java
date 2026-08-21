<template>
  <div class="list-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">合作成果管理</h1>
        <p class="page-sub">管理校企合作产出的各类成果</p>
      </div>
      <div>
        <el-button style="margin-right: 8px" @click="importDialog = true">批量导入</el-button>
        <el-button type="primary" @click="router.push('/portal/apps/alliance/achievements/new')">
          <el-icon><Plus /></el-icon>
          新建成果
        </el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-input
        v-model="search"
        placeholder="搜索成果名称..."
        clearable
        style="max-width: 320px; margin-bottom: 12px"
        @input="onSearch"
        @clear="onSearch"
      />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="成果名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="router.push(`/portal/apps/alliance/achievements/${row.id}`)">
              {{ row.title }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="100">
          <template #default="{ row }">
            <el-switch :model-value="row.isPublic || false" @change="togglePublic(row)" />
          </template>
        </el-table-column>
        <el-table-column label="合作企业" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ enterpriseNames(row) }}</template>
        </el-table-column>
        <el-table-column label="关联项目" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ projectName(row) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">{{ typeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="router.push(`/portal/apps/alliance/achievements/${row.id}`)">查看</el-button>
            <el-button link type="primary" size="small" @click="router.push(`/portal/apps/alliance/achievements/${row.id}/edit`)">编辑</el-button>
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

    <!-- 批量导入（对齐 React importConfig：alliance-achievements，走 Java 泛化导入 /import/{entity}/excel） -->
    <el-dialog v-model="importDialog" title="批量导入合作成果" width="560px">
      <ImportExport entity="alliance-achievements" :on-imported="loadItems" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import ImportExport from '@/components/ImportExport.vue';
import {
  achievementApi,
  listAllEnterprises,
  listAllProjects,
  fetchAllianceDict,
  allianceLabel,
  type AllianceAchievement,
  type AllianceEnterprise,
  type AllianceProject,
} from './crud-shared';
import { useAllianceListPage } from './crud-pages';

const importDialog = ref(false);
const enterprises = ref<AllianceEnterprise[]>([]);
const projects = ref<AllianceProject[]>([]);
const typeDict = ref<{ code: string; name: string }[]>([]);

async function loadRefs() {
  try {
    const [ents, projs] = await Promise.all([listAllEnterprises(), listAllProjects()]);
    enterprises.value = ents;
    projects.value = projs;
  } catch {
    // 名称映射失败仅退化为原始 id，不阻塞列表
  }
}

function typeLabel(v?: string): string {
  const d = typeDict.value.find((x) => x.code === v);
  if (d) return d.name;
  return allianceLabel('achievementType', v);
}

function enterpriseNames(row: AllianceAchievement): string {
  const ids = (row.enterpriseIds || []).map(String);
  if (ids.length === 0) return '-';
  return ids
    .map((eid) => enterprises.value.find((e) => e.id === eid)?.name || eid)
    .join('、');
}

function projectName(row: AllianceAchievement): string {
  const pid = (row.projectIds || [])[0];
  if (!pid) return '-';
  return projects.value.find((p) => p.id === pid)?.name || '-';
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
} = useAllianceListPage<AllianceAchievement>({
  fetchList: (query) => achievementApi.list(query),
  togglePublic: {
    update: (row, next) => achievementApi.update(row.id, { ...row, isPublic: next }),
    apply: (row, next) => {
      row.isPublic = next;
    },
    successText: (next) => (next ? '已开启前台展示' : '已取消前台展示'),
  },
  remove: {
    confirmText: (row) => `确定要删除成果「${row.title}」吗？`,
    deleteRow: (row) => achievementApi.delete(row.id),
    successText: '成果已删除',
  },
  onMountedExtras: () => {
    loadRefs();
    fetchAllianceDict('achievement_type').then((list) => {
      typeDict.value = list.map((d) => ({ code: d.code, name: d.name }));
    });
  },
});
</script>

<style scoped>
.list-page { padding: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; }
.page-sub { margin: 4px 0 0; font-size: 13px; color: #909399; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>

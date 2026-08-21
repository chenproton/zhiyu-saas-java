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
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
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

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');
const router = useRouter();

const items = ref<AllianceAchievement[]>([]);
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const total = ref(0);
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

async function loadItems() {
  loading.value = true;
  try {
    const res = await achievementApi.list({
      search: search.value.trim() || undefined,
      limit: pageSize,
      offset: (page.value - 1) * pageSize,
    });
    items.value = res.items;
    total.value = res.total ?? 0;
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

async function togglePublic(row: AllianceAchievement) {
  const next = !row.isPublic;
  try {
    await achievementApi.update(row.id, { ...row, isPublic: next });
    row.isPublic = next;
    ElMessage.success(next ? '已开启前台展示' : '已取消前台展示');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function confirmDelete(row: AllianceAchievement) {
  try {
    await ElMessageBox.confirm(`确定要删除成果「${row.title}」吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await achievementApi.delete(row.id);
    ElMessage.success('成果已删除');
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
      // 未登录态由路由守卫兜底，此处忽略
    }
  }
  loadRefs();
  fetchAllianceDict('achievement_type').then((list) => {
    typeDict.value = list.map((d) => ({ code: d.code, name: d.name }));
  });
  loadItems();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; }
.page-sub { margin: 4px 0 0; font-size: 13px; color: #909399; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>

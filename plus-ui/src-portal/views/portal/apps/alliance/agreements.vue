<template>
  <div class="list-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">合作协议管理</h1>
        <p class="page-sub">管理校企合作协议的独立记录</p>
      </div>
      <div>
        <el-button style="margin-right: 8px" @click="importDialog = true">批量导入</el-button>
        <el-button type="primary" @click="router.push('/portal/apps/alliance/agreements/new')">
          <el-icon><Plus /></el-icon>
          新建协议
        </el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-input
        v-model="search"
        placeholder="搜索协议名称..."
        clearable
        style="max-width: 320px; margin-bottom: 12px"
        @input="onSearch"
        @clear="onSearch"
      />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="协议名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="router.push(`/portal/apps/alliance/agreements/${row.id}`)">
              {{ row.name }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="合作企业" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ enterpriseNames(row) }}</template>
        </el-table-column>
        <el-table-column label="关联项目" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ projectName(row) }}</template>
        </el-table-column>
        <el-table-column label="生效日期" width="120">
          <template #default="{ row }">{{ formatDate(row.startDate) }}</template>
        </el-table-column>
        <el-table-column label="到期日期" width="160">
          <template #default="{ row }">
            <span :class="{ 'expiring': isExpiring(row.endDate) }">{{ formatDate(row.endDate) }}</span>
            <span v-if="isExpiring(row.endDate)" class="expiring-hint">（即将到期）</span>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="100">
          <template #default="{ row }">
            <el-switch :model-value="row.isPublic || false" @change="togglePublic(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="router.push(`/portal/apps/alliance/agreements/${row.id}`)">查看</el-button>
            <el-button link type="primary" size="small" @click="router.push(`/portal/apps/alliance/agreements/${row.id}/edit`)">编辑</el-button>
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

    <!-- 批量导入（对齐 React importConfig：alliance-agreements，走 Java 泛化导入 /import/{entity}/excel） -->
    <el-dialog v-model="importDialog" title="批量导入合作协议" width="560px">
      <ImportExport entity="alliance-agreements" :on-imported="loadItems" />
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
  allianceAgreementApi,
  listAllEnterprises,
  listAllProjects,
  formatDate,
  type AllianceAgreement,
  type AllianceEnterprise,
  type AllianceProject,
} from './crud-shared';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');
const router = useRouter();

const items = ref<AllianceAgreement[]>([]);
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const importDialog = ref(false);
const enterprises = ref<AllianceEnterprise[]>([]);
const projects = ref<AllianceProject[]>([]);

async function loadRefs() {
  try {
    const [ents, projs] = await Promise.all([listAllEnterprises(), listAllProjects()]);
    enterprises.value = ents;
    projects.value = projs;
  } catch {
    // 忽略
  }
}

function enterpriseNames(row: AllianceAgreement): string {
  const ids = (row.enterpriseIds || []).map(String);
  if (ids.length === 0) return '-';
  return ids
    .map((eid) => enterprises.value.find((e) => e.id === eid)?.name || eid)
    .join('、');
}

function projectName(row: AllianceAgreement): string {
  const pid = (row.projectIds || [])[0];
  if (!pid) return '-';
  return projects.value.find((p) => p.id === pid)?.name || '-';
}

function isExpiring(endDate?: string): boolean {
  if (!endDate) return false;
  const days = (new Date(endDate).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 90;
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await allianceAgreementApi.list({
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

async function togglePublic(row: AllianceAgreement) {
  const next = !row.isPublic;
  try {
    await allianceAgreementApi.update(row.id, { ...row, isPublic: next });
    row.isPublic = next;
    ElMessage.success(next ? '已开启前台展示' : '已取消前台展示');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function confirmDelete(row: AllianceAgreement) {
  try {
    await ElMessageBox.confirm(`确定要删除协议「${row.name}」吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await allianceAgreementApi.delete(row.id);
    ElMessage.success('协议已删除');
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
  loadRefs();
  loadItems();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; }
.page-sub { margin: 4px 0 0; font-size: 13px; color: #909399; }
.pagination { margin-top: 16px; justify-content: flex-end; }
.expiring { color: #e6a23c; font-weight: 500; }
.expiring-hint { margin-left: 4px; font-size: 12px; }
</style>

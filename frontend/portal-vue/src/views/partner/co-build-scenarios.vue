<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">场景共建</div>
            <div class="card-sub">为合作学校创建或编辑场景资源，保存后状态为草稿，由学校端审核发布。</div>
          </div>
          <el-button type="primary" @click="openCreateDialog">新建场景</el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-input
          v-model="search"
          placeholder="搜索场景名称..."
          clearable
          style="width: 260px"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-select
          v-model="schoolFilter"
          placeholder="选择合作学校"
          clearable
          style="width: 220px"
          @change="onSchoolFilterChange"
        >
          <el-option label="全部学校" value="" />
          <el-option v-for="s in activeSchools" :key="s.tenantId" :label="s.schoolName" :value="s.tenantId" />
        </el-select>
        <el-button type="primary" plain @click="onSearch">搜索</el-button>
      </div>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span>{{ row.name }}</span>
            <el-tag
              v-if="row.sourceType !== 'enterprise'"
              size="small"
              type="primary"
              effect="plain"
              style="margin-left: 6px"
            >
              学校授权
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="合作学校" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.schoolName || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ contentStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="goEdit(row)">编辑</el-button>
            <el-button
              v-if="row.sourceType === 'enterprise' && (row.status === 'draft' || row.status === 'rejected')"
              size="small"
              type="danger"
              @click="confirmDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && activeSchools.length === 0"
        description="暂无已确认合作的学校，无法共建场景。"
      >
        <el-button type="primary" @click="goSchools">前往合作学校页确认合作</el-button>
      </el-empty>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="loadItems"
        />
      </div>
    </el-card>

    <el-dialog v-model="createDialog" title="新建场景" width="440px">
      <el-form label-width="90px">
        <el-form-item label="合作学校">
          <el-select v-model="createForm.schoolTenantId" placeholder="选择合作学校" style="width: 100%">
            <el-option v-for="s in activeSchools" :key="s.tenantId" :label="s.schoolName" :value="s.tenantId" />
          </el-select>
        </el-form-item>
        <p v-if="activeSchools.length === 0" class="muted">
          暂无已确认合作的学校，请先在合作学校页确认合作。
        </p>
        <p class="muted">创建后将生成草稿「未命名场景」，并跳转到编辑页完善内容。</p>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { partnerRequest } from '@/api/http';
import { partnerCobuildScenarioApi, partnerSchoolApi } from '@/api/partner';
import type { CoBuildScenario, PartnerSchool } from '@/types/partner';
import { contentStatusLabel } from '@/types/content-status';

const router = useRouter();

const items = ref<CoBuildScenario[]>([]);
const activeSchools = ref<PartnerSchool[]>([]);
const loading = ref(false);
const creating = ref(false);
const createDialog = ref(false);
const createForm = ref({ schoolTenantId: '' });

const search = ref('');
const schoolFilter = ref('');
const page = ref(1);
const pageSize = 20;
const total = ref(0);

function formatDateTime(s?: string): string {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusTagType(s: string): 'success' | 'warning' | 'danger' | 'info' {
  if (s === 'published' || s === 'approved') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected') return 'danger';
  return 'info';
}

async function loadActiveSchools() {
  try {
    const res = await partnerSchoolApi.list({ limit: 200 });
    activeSchools.value = (res.items || []).filter((s) => s.status === 'active');
  } catch (e) {
    ElMessage.error((e as Error).message || '加载合作学校失败');
  }
}

async function loadItems() {
  loading.value = true;
  try {
    const res = await partnerCobuildScenarioApi.list({
      schoolTenantId: schoolFilter.value || undefined,
      search: search.value.trim() || undefined,
      limit: pageSize,
      offset: (page.value - 1) * pageSize
    });
    items.value = res.items || [];
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

function onSchoolFilterChange() {
  page.value = 1;
  loadItems();
}

function goEdit(row: CoBuildScenario) {
  router.push(`/partner/co-build/scenes/${row.id}/edit`);
}

function goSchools() {
  router.push('/partner/schools');
}

function openCreateDialog() {
  createForm.value.schoolTenantId = '';
  createDialog.value = true;
}

async function onCreate() {
  if (!createForm.value.schoolTenantId) {
    ElMessage.warning('请选择合作学校');
    return;
  }
  creating.value = true;
  try {
    // React 共建场景 create 只需 schoolTenantId + name（Vue api 的 create 签名误加了 difficulty），直连端点照抄
    const created = await partnerRequest<CoBuildScenario>('/partner/co-build/scenes', {
      method: 'POST',
      body: JSON.stringify({ schoolTenantId: createForm.value.schoolTenantId, name: '未命名场景' })
    });
    createDialog.value = false;
    router.push(`/partner/co-build/scenes/${created.id}/edit?new=true`);
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败');
  } finally {
    creating.value = false;
  }
}

async function confirmDelete(row: CoBuildScenario) {
  try {
    await ElMessageBox.confirm(`确定要删除场景「${row.name}」吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await partnerCobuildScenarioApi.delete(row.id);
    ElMessage.success('已删除');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(() => {
  loadActiveSchools();
  loadItems();
});
</script>

<style scoped>
.list-page {
  padding: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.card-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.muted {
  font-size: 12px;
  color: #909399;
  margin: 4px 0;
}
</style>

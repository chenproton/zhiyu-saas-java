<template>
  <div class="crud-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">雇主品牌管理</h1>
        <p class="page-desc">从合作企业库引用或新增独立雇主企业，维护雇主品牌展示</p>
      </div>
      <div class="head-actions">
        <BatchImport brand-type="employer" entity-label="雇主品牌" @success="load" />
        <el-button size="small" @click="openCreate">
          <el-icon class="mr-4"><OfficeBuilding /></el-icon>
          新增独立雇主企业
        </el-button>
        <el-button type="primary" size="small" @click="openRefer">
          <el-icon class="mr-4"><Link /></el-icon>
          从合作企业库引用
        </el-button>
      </div>
    </div>

    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索企业名称..." clearable class="toolbar__search" />
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="filteredItems" style="width: 100%">
        <el-table-column label="企业名称" min-width="180">
          <template #default="{ row }">
            <span class="cell-strong">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="110" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.isPublic" @change="(v: boolean | string | number) => toggleField(row, 'isPublic', Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column label="推荐" width="90" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.isFeatured" @change="(v: boolean | string | number) => toggleField(row, 'isFeatured', Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column label="来源" width="110">
          <template #default="{ row }">
            <el-tag :type="row.enterpriseId ? 'primary' : 'warning'" size="small" effect="light">
              {{ row.enterpriseId ? '合作企业' : '独立雇主' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="行业" min-width="120">
          <template #default="{ row }">
            {{ row.enterpriseIndustry || enterpriseInfoOf(row).industry || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="关联岗位" width="90" align="center">
          <template #default="{ row }">{{ positionsOf(row).length }}</template>
        </el-table-column>
        <el-table-column label="已招聘学生" width="110" align="center">
          <template #default="{ row }">{{ hiredStudentsOf(row).length }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">查看</el-button>
            <el-button v-if="!row.enterpriseId" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无雇主品牌数据" :image-size="60" />
        </template>
      </el-table>
    </div>

    <!-- 从合作企业库引用 -->
    <el-dialog v-model="referOpen" title="从合作企业库引用" width="520px">
      <el-input v-model="referSearch" placeholder="搜索企业名称或行业..." clearable class="mb-12" />
      <div v-loading="enterprisesLoading" class="refer-list">
        <div v-if="referable.length === 0" class="refer-empty">没有可引用的合作企业</div>
        <div
          v-for="e in referable"
          :key="e.id"
          class="refer-item"
          :class="{ 'refer-item--active': referSelected?.id === e.id }"
          @click="referSelected = e"
        >
          <div class="refer-item__main">
            <p class="refer-item__name">{{ e.name }}</p>
            <p class="refer-item__sub">{{ e.industry || '-' }} · {{ e.region || '-' }}</p>
          </div>
          <span v-if="referSelected?.id === e.id" class="refer-item__dot" />
        </div>
      </div>
      <template #footer>
        <el-button @click="referOpen = false">取消</el-button>
        <el-button type="primary" :loading="referSubmitting" :disabled="!referSelected" @click="confirmRefer">
          确认引用
        </el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑独立雇主企业 -->
    <el-dialog v-model="editOpen" :title="editTarget ? '编辑独立雇主企业' : '新增独立雇主企业'" width="640px">
      <el-form :model="editInfo" label-width="120px" class="enterprise-form">
        <el-form-item label="企业名称" required>
          <el-input v-model="editInfo.name" placeholder="企业名称" />
        </el-form-item>
        <el-form-item label="统一社会信用代码">
          <el-input v-model="editInfo.unifiedSocialCreditCode" placeholder="统一社会信用代码" />
        </el-form-item>
        <el-form-item label="企业类型">
          <el-select v-model="editInfo.enterpriseType" placeholder="请选择" style="width: 100%">
            <el-option label="合作企业" value="cooperation" />
            <el-option label="第三方雇主企业" value="third-party" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属行业">
          <el-input v-model="editInfo.industry" placeholder="如：信息技术" />
        </el-form-item>
        <el-form-item label="所在地区">
          <el-input v-model="editInfo.region" placeholder="如：深圳" />
        </el-form-item>
        <el-form-item label="成立年份">
          <el-input v-model.number="editInfo.establishedYear" type="number" placeholder="如：2010" />
        </el-form-item>
        <el-form-item label="企业规模（人数）">
          <el-input v-model.number="editInfo.employeeCount" type="number" placeholder="如：500" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="editInfo.contactPerson" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="editInfo.contactPhone" />
        </el-form-item>
        <el-form-item label="联系邮箱">
          <el-input v-model="editInfo.contactEmail" />
        </el-form-item>
        <el-form-item label="详细地址">
          <el-input v-model="editInfo.address" />
        </el-form-item>
        <el-form-item label="企业 Logo">
          <ImageUpload v-model="editInfo.logoUrl" />
        </el-form-item>
        <el-form-item label="企业简介">
          <el-input v-model="editInfo.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="saveIndependent">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { OfficeBuilding, Link } from '@element-plus/icons-vue';
import { allianceBrandApi } from '@/api/alliance';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import {
  fetchAllPages,
  enterpriseInfoOf,
  positionsOf,
  hiredStudentsOf,
  type AllianceBrand,
  type EmployerBrand,
  type AllianceEnterprise,
  type EnterpriseInfo,
} from './shared';
import BatchImport from './components/BatchImport.vue';
import ImageUpload from './components/ImageUpload.vue';

const brandType = 'employer';

const auth = useAuthStore();
const router = useRouter();
const tenantId = () => (auth.user?.tenantId as string) || '';

const items = ref<EmployerBrand[]>([]);
const loading = ref(false);
const keyword = ref('');

const filteredItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return items.value;
  return items.value.filter((b) => {
    const name = b.name || b.enterpriseName || '';
    return name.toLowerCase().includes(kw);
  });
});

async function load() {
  if (!tenantId()) return;
  loading.value = true;
  try {
    const data = await fetchAllPages<EmployerBrand>((page, pageSize) =>
      allianceBrandApi.list({ brandType, limit: pageSize, offset: page * pageSize }),
    );
    items.value = data;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function toggleField(item: EmployerBrand, field: 'isPublic' | 'isFeatured', value: boolean) {
  try {
    await allianceBrandApi.update(item.id, { [field]: value } as any);
    ElMessage.success('已更新');
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败');
  }
}

function viewDetail(item: EmployerBrand) {
  router.push(`/portal/apps/alliance/brands/${item.id}`);
}

async function confirmDelete(item: EmployerBrand) {
  try {
    await ElMessageBox.confirm(`确定要删除雇主品牌「${item.name}」吗？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await allianceBrandApi.delete(item.id);
    ElMessage.success('品牌已删除');
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

// ── 从合作企业库引用 ─────────────────────────────
const referOpen = ref(false);
const referSearch = ref('');
const referSelected = ref<AllianceEnterprise | null>(null);
const referSubmitting = ref(false);
const enterprises = ref<AllianceEnterprise[]>([]);
const enterprisesLoading = ref(false);

const referencedIds = computed(() => {
  const ids = new Set<string>();
  for (const b of items.value) if (b.enterpriseId) ids.add(b.enterpriseId);
  return ids;
});

const referable = computed(() => {
  const list = enterprises.value.filter((e) => !referencedIds.value.has(e.id));
  const kw = referSearch.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter(
    (e) => e.name.toLowerCase().includes(kw) || (e.industry || '').toLowerCase().includes(kw),
  );
});

async function openRefer() {
  referOpen.value = true;
  referSearch.value = '';
  referSelected.value = null;
  enterprisesLoading.value = true;
  try {
    enterprises.value = await fetchAllPages<AllianceEnterprise>((page, pageSize) =>
      portalRequest<{ items: AllianceEnterprise[] }>(
        `/alliance/enterprises?limit=${pageSize}&offset=${page * pageSize}`,
      ),
    );
  } catch {
    enterprises.value = [];
  } finally {
    enterprisesLoading.value = false;
  }
}

async function confirmRefer() {
  if (!referSelected.value) return;
  referSubmitting.value = true;
  try {
    await allianceBrandApi.create({
      brandType,
      name: referSelected.value.name,
      enterpriseId: referSelected.value.id,
      status: 'draft',
      data: {},
    } as any);
    ElMessage.success('已引用合作企业');
    referOpen.value = false;
    referSelected.value = null;
    referSearch.value = '';
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '引用失败');
  } finally {
    referSubmitting.value = false;
  }
}

// ── 新增/编辑独立雇主企业 ────────────────────────
const editTarget = ref<EmployerBrand | null>(null);
const editOpen = ref(false);
const editInfo = ref<EnterpriseInfo>({});
const editSubmitting = ref(false);

function openCreate() {
  editTarget.value = null;
  editInfo.value = { enterpriseType: 'third-party' };
  editOpen.value = true;
}

function openEdit(item: EmployerBrand) {
  editTarget.value = item;
  editInfo.value = enterpriseInfoOf(item);
  editOpen.value = true;
}

async function saveIndependent() {
  if (!editInfo.value.name?.trim()) {
    ElMessage.warning('企业名称不能为空');
    return;
  }
  editSubmitting.value = true;
  try {
    if (editTarget.value) {
      await allianceBrandApi.update(editTarget.value.id, {
        name: editInfo.value.name,
        data: { ...(editTarget.value.data || {}), enterpriseInfo: editInfo.value },
      } as any);
      ElMessage.success('企业资料已更新');
    } else {
      await allianceBrandApi.create({
        brandType,
        name: editInfo.value.name,
        status: 'draft',
        data: { enterpriseInfo: editInfo.value },
      } as any);
      ElMessage.success('独立雇主企业已创建');
    }
    editOpen.value = false;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    editSubmitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.crud-page {
  min-height: 100%;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}
.page-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mr-4 {
  margin-right: 4px;
}
.mb-12 {
  margin-bottom: 12px;
}
.toolbar {
  margin-bottom: 16px;
}
.toolbar__search {
  max-width: 360px;
}
.table-card {
  border: 1px solid #e7e5e4;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.cell-strong {
  font-weight: 500;
}
.refer-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.refer-empty {
  padding: 32px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.refer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e7e5e4;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.refer-item:hover {
  border-color: #bfdbfe;
}
.refer-item--active {
  border-color: #409eff;
  background: #f5f9ff;
}
.refer-item__name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.refer-item__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #94a3b8;
}
.refer-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #409eff;
  flex-shrink: 0;
}
</style>

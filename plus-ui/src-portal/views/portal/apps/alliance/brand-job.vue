<template>
  <div class="crud-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">岗位品牌管理</h1>
        <p class="page-desc">引用职业岗位库或新增独立岗位，维护岗位品牌展示</p>
      </div>
      <div class="head-actions">
        <BatchImport brand-type="job" entity-label="岗位品牌" @success="load" />
        <el-button size="small" @click="openCreate">
          <el-icon class="mr-4"><Plus /></el-icon>
          新增独立岗位
        </el-button>
        <el-button type="primary" size="small" @click="openRefer">
          <el-icon class="mr-4"><Link /></el-icon>
          引用职业岗位库
        </el-button>
      </div>
    </div>

    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索岗位名称..." clearable class="toolbar__search" />
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="filteredItems" style="width: 100%">
        <el-table-column label="岗位名称" min-width="180">
          <template #default="{ row }">
            <span class="cell-strong">{{ row.name || row.positionName || '-' }}</span>
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
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.positionType === 'teaching' ? 'primary' : 'warning'" size="small" effect="light">
              {{ positionTypeLabel(row.positionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="薪资范围" width="120">
          <template #default="{ row }">{{ salaryText(row) }}</template>
        </el-table-column>
        <el-table-column label="面向专业" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ (row.majorNames || []).join('、') || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">查看</el-button>
            <el-button
              v-if="row.positionType !== 'teaching' && row.positionId"
              link
              type="primary"
              size="small"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无岗位品牌数据" :image-size="60" />
        </template>
      </el-table>
    </div>

    <!-- 引用职业岗位库 -->
    <el-dialog v-model="referOpen" title="引用职业岗位库" width="520px">
      <p class="dialog-tip">从岗位库中选择教学岗位，关联为岗位品牌（仅关联，岗位内容不可修改）</p>
      <el-input v-model="referSearch" placeholder="搜索岗位名称..." clearable class="mb-12" />
      <div v-loading="positionsLoading" class="refer-list">
        <div v-if="referable.length === 0" class="refer-empty">没有可引用的教学岗位</div>
        <div
          v-for="p in referable"
          :key="p.id"
          class="refer-item"
          :class="{ 'refer-item--active': isSelected(p.id) }"
          @click="toggleSelect(p)"
        >
          <div class="refer-item__main">
            <p class="refer-item__name">{{ p.name }}</p>
            <p class="refer-item__sub">{{ salaryText(p) }} · {{ (p.majorNames || []).join('、') || '-' }}</p>
          </div>
          <span class="refer-item__check" :class="{ 'refer-item__check--on': isSelected(p.id) }" />
        </div>
      </div>
      <template #footer>
        <el-button @click="referOpen = false">取消</el-button>
        <el-button type="primary" :loading="referSubmitting" :disabled="referSelected.length === 0" @click="confirmRefer">
          确认引用 ({{ referSelected.length }})
        </el-button>
      </template>
    </el-dialog>

    <!-- 新增独立岗位 / 编辑企业岗位 -->
    <el-dialog v-model="editOpen" :title="editTarget && editTarget.id ? '编辑企业岗位' : '新增独立岗位'" width="640px">
      <p class="dialog-tip">企业岗位仅在岗位品牌模块中可见和管理，不进入职业岗位库</p>
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="岗位名称" required>
          <el-input v-model="editForm.name" placeholder="岗位名称" />
        </el-form-item>
        <el-form-item label="所属行业">
          <el-input v-model="editForm.industry" placeholder="如：信息技术" />
        </el-form-item>
        <el-form-item label="薪资范围（K）">
          <div class="salary-row">
            <el-input v-model.number="editForm.salaryMin" type="number" placeholder="最低" />
            <span class="salary-sep">-</span>
            <el-input v-model.number="editForm.salaryMax" type="number" placeholder="最高" />
          </div>
        </el-form-item>
        <el-form-item label="面向专业">
          <el-input v-model="editForm.majorNamesText" placeholder="多个专业用顿号分隔" />
        </el-form-item>
        <el-form-item label="岗位简介">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="任职要求">
          <el-input v-model="editForm.requirementsText" type="textarea" :rows="3" placeholder="每行一条" />
        </el-form-item>
        <el-form-item label="发展路径">
          <el-input v-model="editForm.careerPath" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="savePosition">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Link } from '@element-plus/icons-vue';
import { allianceBrandApi } from '@/api/alliance';
import { portalRequest } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { fetchAllPages, salaryText, positionTypeLabel, type JobBrand } from './shared';
import BatchImport from './components/BatchImport.vue';

const brandType = 'job';

const auth = useAuthStore();
const router = useRouter();
const tenantId = () => (auth.user?.tenantId as string) || '';

interface CareerPosition {
  id: string;
  name: string;
  positionType?: string;
  salaryMin?: number;
  salaryMax?: number;
  majorNames?: string[];
}

const items = ref<JobBrand[]>([]);
const loading = ref(false);
const keyword = ref('');

const filteredItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return items.value;
  return items.value.filter((b) => {
    const name = b.name || b.positionName || '';
    return name.toLowerCase().includes(kw);
  });
});

async function load() {
  if (!tenantId()) return;
  loading.value = true;
  try {
    items.value = await fetchAllPages<JobBrand>((page, pageSize) =>
      allianceBrandApi.list({ brandType, limit: pageSize, offset: page * pageSize }),
    );
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function toggleField(item: JobBrand, field: 'isPublic' | 'isFeatured', value: boolean) {
  try {
    await allianceBrandApi.update(item.id, { [field]: value } as any);
    ElMessage.success('已更新');
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败');
  }
}

function viewDetail(item: JobBrand) {
  router.push(`/portal/apps/alliance/brands/${item.id}`);
}

async function onDeleteBrand(item: JobBrand) {
  if (item.positionType === 'enterprise' && item.positionId) {
    await portalRequest(`/job/positions/${item.positionId}`, { method: 'DELETE' });
  }
  await allianceBrandApi.delete(item.id);
}

async function confirmDelete(item: JobBrand) {
  try {
    await ElMessageBox.confirm(`确定要删除岗位品牌「${item.name}」吗？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await onDeleteBrand(item);
    ElMessage.success('品牌已删除');
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

// ── 引用职业岗位库 ─────────────────────────────
const referOpen = ref(false);
const referSearch = ref('');
const referSelected = ref<CareerPosition[]>([]);
const referSubmitting = ref(false);
const positions = ref<CareerPosition[]>([]);
const positionsLoading = ref(false);

const referencedIds = computed(() => {
  const ids = new Set<string>();
  for (const b of items.value) if (b.positionId) ids.add(b.positionId);
  return ids;
});

const referable = computed(() => {
  const list = positions.value.filter((p) => !referencedIds.value.has(p.id));
  const kw = referSearch.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter((p) => p.name.toLowerCase().includes(kw));
});

function isSelected(id: string) {
  return referSelected.value.some((x) => x.id === id);
}

function toggleSelect(p: CareerPosition) {
  referSelected.value = isSelected(p.id)
    ? referSelected.value.filter((x) => x.id !== p.id)
    : [...referSelected.value, p];
}

async function openRefer() {
  referOpen.value = true;
  referSearch.value = '';
  referSelected.value = [];
  positionsLoading.value = true;
  try {
    const res = await portalRequest<{ items: CareerPosition[] }>(
      '/job/positions?positionType=teaching&limit=200',
    );
    positions.value = res.items || [];
  } catch {
    positions.value = [];
  } finally {
    positionsLoading.value = false;
  }
}

async function confirmRefer() {
  if (referSelected.value.length === 0) return;
  referSubmitting.value = true;
  try {
    await Promise.all(
      referSelected.value.map((p) =>
        allianceBrandApi.create({
          brandType,
          name: p.name,
          positionId: p.id,
          isPublic: false,
        } as any),
      ),
    );
    ElMessage.success(`已引用 ${referSelected.value.length} 个岗位`);
    referSelected.value = [];
    referSearch.value = '';
    referOpen.value = false;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '引用失败');
  } finally {
    referSubmitting.value = false;
  }
}

// ── 新增独立岗位 / 编辑企业岗位 ──────────────────
interface EditForm {
  name: string;
  industry: string;
  salaryMin?: number;
  salaryMax?: number;
  majorNamesText: string;
  description: string;
  requirementsText: string;
  careerPath: string;
}

const editTarget = ref<JobBrand | null>(null);
const editOpen = ref(false);
const editSubmitting = ref(false);
const editForm = ref<EditForm>(emptyEditForm());

function emptyEditForm(): EditForm {
  return {
    name: '',
    industry: '',
    salaryMin: undefined,
    salaryMax: undefined,
    majorNamesText: '',
    description: '',
    requirementsText: '',
    careerPath: '',
  };
}

function openCreate() {
  editTarget.value = null;
  editForm.value = emptyEditForm();
  editOpen.value = true;
}

async function openEdit(item: JobBrand) {
  editTarget.value = item;
  editForm.value = emptyEditForm();
  editSubmitting.value = true;
  editOpen.value = true;
  try {
    if (item.positionId) {
      const cp = await portalRequest<CareerPosition>(`/job/positions/${item.positionId}`).catch(
        () => null,
      );
      if (cp) {
        editForm.value = {
          name: item.name || cp.name || '',
          industry: (cp as any).industry || '',
          salaryMin: item.salaryMin ?? cp.salaryMin,
          salaryMax: item.salaryMax ?? cp.salaryMax,
          majorNamesText: (cp.majorNames || []).join('、'),
          description: (cp as any).description || '',
          requirementsText: ((cp as any).requirements || []).join('\n'),
          careerPath: (cp as any).careerPath || '',
        };
      }
    }
  } catch {
    // 忽略加载失败，保留空表单
  } finally {
    editSubmitting.value = false;
  }
}

async function savePosition() {
  if (!editForm.value.name.trim()) {
    ElMessage.warning('岗位名称不能为空');
    return;
  }
  editSubmitting.value = true;
  const isEdit = !!editTarget.value?.id;
  const name = editForm.value.name.trim();
  const majorNames = editForm.value.majorNamesText
    .split('、')
    .map((s) => s.trim())
    .filter(Boolean);
  const requirements = editForm.value.requirementsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const saveFullPayload = {
    name,
    industry: editForm.value.industry,
    majors: majorNames,
    positionType: 'enterprise',
    salaryRange: [editForm.value.salaryMin ?? 0, editForm.value.salaryMax ?? 0],
    description: editForm.value.description,
    requirements,
    careerPath: editForm.value.careerPath,
    responsibilities: [] as any[],
    certificates: [] as any[],
    abilityBindings: [] as any[],
    abilityDomains: [] as any[],
  };
  try {
    if (isEdit && editTarget.value?.positionId) {
      await portalRequest(`/job/positions/${editTarget.value.positionId}/save-full`, {
        method: 'PUT',
        body: JSON.stringify(saveFullPayload),
      });
      await allianceBrandApi.update(editTarget.value.id, { name } as any);
      ElMessage.success('岗位品牌已更新');
    } else {
      const created = await portalRequest<CareerPosition>('/job/positions', {
        method: 'POST',
        body: JSON.stringify({ name, positionType: 'enterprise' }),
      });
      await portalRequest(`/job/positions/${created.id}/save-full`, {
        method: 'PUT',
        body: JSON.stringify(saveFullPayload),
      });
      await allianceBrandApi.create({
        brandType,
        name,
        positionId: created.id,
        isPublic: false,
      } as any);
      ElMessage.success('独立岗位已创建');
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
.dialog-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #64748b;
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
}
.refer-item__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #94a3b8;
}
.refer-item__check {
  width: 16px;
  height: 16px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  flex-shrink: 0;
}
.refer-item__check--on {
  border-color: #409eff;
  background: #409eff;
}
.salary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.salary-sep {
  color: #94a3b8;
}
</style>

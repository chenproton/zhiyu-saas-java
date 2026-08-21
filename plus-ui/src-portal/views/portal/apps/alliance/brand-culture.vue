<template>
  <div class="crud-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">文化思政品牌管理</h1>
        <p class="page-desc">管理典型案例、思政资源与文化活动</p>
      </div>
      <div class="head-actions">
        <BatchImport brand-type="culture" entity-label="文化思政品牌" @success="load" />
        <el-button type="primary" size="small" @click="openCreate">
          <el-icon class="mr-4"><Plus /></el-icon>
          新建品牌
        </el-button>
      </div>
    </div>

    <div class="toolbar">
      <el-input
        v-model="search"
        placeholder="搜索品牌名称..."
        clearable
        class="toolbar__search"
        @input="onSearch"
        @clear="onSearch"
      />
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="items" style="width: 100%">
        <el-table-column label="名称" min-width="200">
          <template #default="{ row }">
            <span class="cell-strong">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="120" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.isPublic" @change="(v: boolean | string | number) => toggleField(row, 'isPublic', Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column label="推荐" width="100" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.isFeatured" @change="(v: boolean | string | number) => toggleField(row, 'isFeatured', Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">查看</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无文化思政品牌数据" :image-size="60" />
        </template>
      </el-table>
    </div>

    <div class="pager">
      <span class="pager__total">共 {{ total }} 条记录</span>
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="load"
      />
    </div>

    <el-dialog v-model="dialogOpen" :title="formItem.id ? '编辑文化思政品牌' : '新增文化思政品牌'" width="520px">
      <el-form :model="formItem" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="formItem.name" placeholder="品牌名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formItem.description" type="textarea" :rows="3" placeholder="品牌描述" />
        </el-form-item>
        <el-form-item label="封面图">
          <ImageUpload v-model="formItem.coverImage" label="" hint="" />
        </el-form-item>
        <el-form-item label="前台展示">
          <el-switch v-model="formItem.isPublic" />
        </el-form-item>
        <el-form-item label="推荐">
          <el-switch v-model="formItem.isFeatured" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { allianceBrandApi } from '@/api/alliance';
import { useAuthStore } from '@/stores/auth';
import type { AllianceBrand } from './shared';
import BatchImport from './components/BatchImport.vue';
import ImageUpload from './components/ImageUpload.vue';

const brandType = 'culture';

const auth = useAuthStore();
const router = useRouter();
const tenantId = () => (auth.user?.tenantId as string) || '';

interface FormItem {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  isPublic: boolean;
  isFeatured: boolean;
}

const items = ref<AllianceBrand[]>([]);
const total = ref(0);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const search = ref('');

const dialogOpen = ref(false);
const saving = ref(false);
const formItem = ref<FormItem>(emptyForm());

function emptyForm(): FormItem {
  return { id: '', name: '', description: '', coverImage: '', isPublic: false, isFeatured: false };
}

async function load() {
  if (!tenantId()) return;
  loading.value = true;
  try {
    const data = await allianceBrandApi.list({
      brandType,
      page: page.value,
      limit: pageSize,
      search: search.value.trim() || undefined,
    });
    items.value = (data.items || []) as AllianceBrand[];
    total.value = data.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  load();
}

async function toggleField(item: AllianceBrand, field: 'isPublic' | 'isFeatured', value: boolean) {
  try {
    await allianceBrandApi.update(item.id, { [field]: value } as any);
    ElMessage.success('已更新');
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败');
  }
}

function viewDetail(item: AllianceBrand) {
  router.push(`/portal/apps/alliance/brands/${item.id}`);
}

function openCreate() {
  formItem.value = emptyForm();
  dialogOpen.value = true;
}

function openEdit(item: AllianceBrand) {
  formItem.value = {
    id: item.id,
    name: item.name || '',
    description: item.description || '',
    coverImage: item.coverImage || '',
    isPublic: item.isPublic || false,
    isFeatured: item.isFeatured || false,
  };
  dialogOpen.value = true;
}

async function save() {
  if (!formItem.value.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload: any = {
      brandType,
      name: formItem.value.name,
      description: formItem.value.description,
      coverImage: formItem.value.coverImage,
      isPublic: formItem.value.isPublic,
      isFeatured: formItem.value.isFeatured,
    };
    if (formItem.value.id) {
      await allianceBrandApi.update(formItem.value.id, payload);
    } else {
      await allianceBrandApi.create(payload);
    }
    ElMessage.success(formItem.value.id ? '品牌已更新' : '品牌已创建');
    dialogOpen.value = false;
    await load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(item: AllianceBrand) {
  try {
    await ElMessageBox.confirm(`确定要删除品牌「${item.name}」吗？`, '确认删除', {
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
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.pager__total {
  font-size: 13px;
  color: #64748b;
}
</style>

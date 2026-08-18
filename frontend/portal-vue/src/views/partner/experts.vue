<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">企业专家</span>
          <el-button type="primary" @click="openAdd">新建专家</el-button>
        </div>
      </template>

      <el-input v-model="searchQuery" placeholder="搜索专家姓名..." clearable style="max-width: 320px; margin-bottom: 12px" @input="onSearch" @clear="onSearch" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="姓名" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="职称" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.title || '-' }}</template>
        </el-table-column>
        <el-table-column label="职位" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.position || '-' }}</template>
        </el-table-column>
        <el-table-column label="所属企业" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.enterpriseName || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next, total" class="pagination" @current-change="loadItems" />
    </el-card>

    <el-dialog v-model="dialogOpen" :title="editingItem ? '编辑专家' : '新建专家'" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="姓名"><el-input v-model="form.name" placeholder="专家姓名" /></el-form-item>
        <el-form-item label="职称"><el-input v-model="form.title" placeholder="职称" /></el-form-item>
        <el-form-item label="职位"><el-input v-model="form.position" placeholder="职位" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { partnerExpertApi } from '@/api/partner';
import type { PartnerExpert } from '@/types/partner';

const PAGE_SIZE = 200;
const items = ref<PartnerExpert[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const dialogOpen = ref(false);
const editingItem = ref<PartnerExpert | null>(null);
const submitting = ref(false);
const form = reactive({ name: '', title: '', position: '' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await partnerExpertApi.list({
      ...(searchQuery.value ? { search: searchQuery.value } : {}),
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE
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
function openAdd() {
  editingItem.value = null;
  Object.assign(form, { name: '', title: '', position: '' });
  dialogOpen.value = true;
}
function openEdit(item: PartnerExpert) {
  editingItem.value = item;
  Object.assign(form, { name: item.name, title: item.title || '', position: item.position || '' });
  dialogOpen.value = true;
}
async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('姓名不能为空');
    return;
  }
  submitting.value = true;
  try {
    const payload = { name: form.name.trim(), title: form.title.trim() || undefined, position: form.position.trim() || undefined };
    if (editingItem.value) {
      await partnerExpertApi.update(editingItem.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await partnerExpertApi.create(payload);
      ElMessage.success('创建成功');
    }
    dialogOpen.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}
async function confirmDelete(item: PartnerExpert) {
  try {
    await ElMessageBox.confirm('确定要删除该专家吗？此操作不可恢复。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await partnerExpertApi.delete(item.id);
    ElMessage.success('删除成功');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>

<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">联盟项目</span>
          <el-button type="primary" @click="openAdd">新建项目</el-button>
        </div>
      </template>

      <el-input v-model="searchQuery" placeholder="搜索项目名称..." clearable style="max-width: 320px; margin-bottom: 12px" @input="onSearch" @clear="onSearch" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="阶段" width="120">
          <template #default="{ row }">{{ row.phase || '-' }}</template>
        </el-table-column>
        <el-table-column label="发布状态" width="110">
          <template #default="{ row }">{{ row.publishStatus || '-' }}</template>
        </el-table-column>
        <el-table-column label="进度" width="100">
          <template #default="{ row }">{{ row.progress != null ? row.progress + '%' : '-' }}</template>
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

    <el-dialog v-model="dialogOpen" :title="editingItem ? '编辑项目' : '新建项目'" width="520px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="项目名称" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.type" placeholder="项目类型" /></el-form-item>
        <el-form-item label="阶段"><el-input v-model="form.phase" placeholder="项目阶段" /></el-form-item>
        <el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
        <el-form-item label="预算"><el-input v-model="form.budget" placeholder="项目预算" /></el-form-item>
        <el-form-item label="公开"><el-switch v-model="form.isPublic" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="项目简介" /></el-form-item>
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
import { allianceProjectApi } from '@/api/alliance';
import type { AllianceProject } from '@/types/alliance';

const PAGE_SIZE = 200;
const items = ref<AllianceProject[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const dialogOpen = ref(false);
const editingItem = ref<AllianceProject | null>(null);
const submitting = ref(false);
const form = reactive({ name: '', type: '', phase: '', startDate: '', endDate: '', budget: '', isPublic: false, description: '' });

async function loadItems() {
  loading.value = true;
  try {
    const res = await allianceProjectApi.list({
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
  Object.assign(form, { name: '', type: '', phase: '', startDate: '', endDate: '', budget: '', isPublic: false, description: '' });
  dialogOpen.value = true;
}
function openEdit(item: AllianceProject) {
  editingItem.value = item;
  Object.assign(form, {
    name: item.name,
    type: item.type || '',
    phase: item.phase || '',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    budget: item.budget || '',
    isPublic: item.isPublic ?? false,
    description: item.description || ''
  });
  dialogOpen.value = true;
}
async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      type: form.type.trim() || undefined,
      phase: form.phase.trim() || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budget: form.budget.trim() || undefined,
      isPublic: form.isPublic,
      description: form.description.trim() || undefined
    };
    if (editingItem.value) {
      await allianceProjectApi.update(editingItem.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      await allianceProjectApi.create(payload);
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
async function confirmDelete(item: AllianceProject) {
  try {
    await ElMessageBox.confirm('确定要删除该项目吗？此操作不可恢复。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await allianceProjectApi.delete(item.id);
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

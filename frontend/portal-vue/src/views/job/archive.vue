<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">岗位归档</span>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="updatedAt" label="归档时间" width="180" />
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="restore(row)">恢复</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { positionApi } from '@/api/job';
import type { CareerPosition } from '@/types/job';

const items = ref<CareerPosition[]>([]);
const loading = ref(false);

async function loadItems() {
  loading.value = true;
  try {
    const res = await positionApi.list({ status: 'archived', limit: 500 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
async function restore(row: CareerPosition) {
  try {
    await positionApi.saveDraft(row.id);
    ElMessage.success('已恢复为草稿');
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '操作失败'); }
}
async function confirmDelete(row: CareerPosition) {
  try { await ElMessageBox.confirm('确定要永久删除该岗位吗？此操作不可恢复。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await positionApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>

<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">题库管理</span>
          <el-button type="primary" @click="openAdd">新建题库</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="questionCount" label="题目数" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ contentStatusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="goEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next, total" class="pagination" @current-change="loadItems" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { questionBankApi } from '@/api/evaluation';
import type { QuestionBank } from '@/types/evaluation';
import { contentStatusLabel } from '@/types/content-status';

const PAGE_SIZE = 200;
const router = useRouter();
const items = ref<QuestionBank[]>([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;

async function loadItems() {
  loading.value = true;
  try {
    const res = await questionBankApi.list({ limit: PAGE_SIZE, offset: (page.value - 1) * PAGE_SIZE });
    items.value = res.items;
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function goEdit(row: QuestionBank) {
  router.push(`/evaluation/question-banks/${row.id}/edit`);
}
async function openAdd() {
  try {
    const { value } = await ElMessageBox.prompt('请输入题库名称', '新建题库', { confirmButtonText: '创建', cancelButtonText: '取消' });
    const created = await questionBankApi.create({ name: value.trim() });
    ElMessage.success('创建成功');
    router.push(`/evaluation/question-banks/${created.id}/edit`);
  } catch {
    /* 取消 */
  }
}
async function confirmDelete(row: QuestionBank) {
  try {
    await ElMessageBox.confirm('确定要删除该题库吗？此操作不可恢复。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await questionBankApi.delete(row.id);
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

<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">就业项目</span>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="organizer" label="主办方" min-width="140" show-overflow-tooltip />
        <el-table-column label="起止" width="200">
          <template #default="{ row }">{{ row.startDate || '-' }} ~ {{ row.endDate || '-' }}</template>
        </el-table-column>
        <el-table-column prop="jobCount" label="岗位数" width="90" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ row.publishStatus === 'published' ? '已发布' : '草稿' }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { partnerEmploymentApi } from '@/api/partner';
import type { EmploymentProject } from '@/types/partner';

const items = ref<EmploymentProject[]>([]);
const loading = ref(false);

async function loadItems() {
  loading.value = true;
  try {
    const res = await partnerEmploymentApi.listProjects();
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}
onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
</style>

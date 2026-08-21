<template>
  <div class="list-page">
    <div class="page-header">
      <h2 class="page-title">测评任务</h2>
      <p class="page-sub">打分在学校端进行；此处展示本企业专家被学校分配的测评任务，便于专家跟进。</p>
    </div>

    <el-card shadow="never">
      <el-input v-model="keyword" placeholder="搜索任务名称、专家或学校..." clearable style="max-width: 300px; margin-bottom: 12px" />
      <el-table v-loading="loading" :data="filteredTasks" stripe>
        <el-table-column label="任务名称" prop="taskName" min-width="160" show-overflow-tooltip />
        <el-table-column label="评审步骤" prop="stepLabel" width="120">
          <template #default="{ row }">{{ row.stepLabel || '-' }}</template>
        </el-table-column>
        <el-table-column label="负责专家" prop="expertName" width="110" />
        <el-table-column label="所属学校" prop="schoolName" min-width="140" />
        <el-table-column label="评分进度" width="140">
          <template #default="{ row }">
            <span v-if="(row.assignedCount ?? 0) === 0">暂无评分对象</span>
            <span v-else-if="(row.gradedCount ?? 0) >= (row.assignedCount ?? 0)">已完成（{{ row.assignedCount }}/{{ row.assignedCount }}）</span>
            <span v-else>待评分 {{ row.gradedCount ?? 0 }}/{{ row.assignedCount ?? 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="120">
          <template #default="{ row }">{{ fmt(row.updatedAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { partnerMentorTaskApi } from '@/api/partner';
import type { PartnerMentorTask } from '@/types/partner';

const tasks = ref<PartnerMentorTask[]>([]);
const keyword = ref('');
const loading = ref(true);

const filteredTasks = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return tasks.value;
  return tasks.value.filter((t) =>
    t.taskName.toLowerCase().includes(q) || t.expertName.toLowerCase().includes(q) || t.schoolName.toLowerCase().includes(q)
  );
});

function fmt(d?: string) {
  return d ? String(d).slice(0, 10) : '-';
}

async function load() {
  loading.value = true;
  try {
    const res = await partnerMentorTaskApi.list();
    tasks.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 0; }
</style>

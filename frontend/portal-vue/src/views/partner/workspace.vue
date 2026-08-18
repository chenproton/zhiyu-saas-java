<template>
  <div class="workspace">
    <el-row :gutter="16" v-loading="loading">
      <el-col v-for="card in cards" :key="card.label" :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { partnerWorkspaceApi } from '@/api/partner';
import type { PartnerDashboard } from '@/types/partner';

const loading = ref(false);
const data = ref<PartnerDashboard | null>(null);

const cards = computed(() => {
  const d = data.value;
  return [
    { label: '专家数', value: d?.expertCount ?? 0 },
    { label: '合作学校数', value: d?.schoolCount ?? 0 },
    { label: '成员数', value: d?.memberCount ?? 0 },
    { label: '共建岗位数', value: d?.coBuildPositionCount ?? 0 }
  ];
});

async function load() {
  loading.value = true;
  try {
    data.value = await partnerWorkspaceApi.dashboard();
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.workspace { padding: 16px; }
.stat-card { text-align: center; }
.stat-value { font-size: 28px; font-weight: 700; color: #409eff; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
</style>

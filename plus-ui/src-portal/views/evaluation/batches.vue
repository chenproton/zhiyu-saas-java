<template>
  <BatchGroupPage
    title="批次分组管理"
    subtitle="管理测评资源建设批次分组，关联审批流程"
    :api="batchApi"
    name-placeholder="例如：2026春季测评资源建设批次"
    workflow-hint="批次内所有测评资源将强制使用相同的审批流程"
  />
</template>

<script setup lang="ts">
import BatchGroupPage from '@/components/batch-group-page.vue';
import { evaluationBatchApi } from '@/api/evaluation';
import { request } from '@/api/http';

// Vue 侧 evaluationBatchApi 缺少 updateStatus（React evaluationBatchApi 有），
// 用 request() 直连同一后端端点 POST /evaluation/batches/{id}/status 补齐。
const batchApi = {
  ...evaluationBatchApi,
  updateStatus: (id: string, status: string) =>
    request(`/evaluation/batches/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    })
};
</script>

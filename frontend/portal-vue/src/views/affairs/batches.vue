<template>
  <BatchGroupPage
    title="批次分组管理"
    subtitle="管理教务批次分组，关联审批流程"
    :api="batchApi"
    name-placeholder="例如：2025秋季人才培养方案建设"
    workflow-hint="批次内所有人培方案将使用相同的审批流程"
  />
</template>

<script setup lang="ts">
import BatchGroupPage from '@/components/batch-group-page.vue';
import { affairsBatchApi } from '@/api/affairs';
import { request } from '@/api/http';

// 对齐 React affairsBatchApi.updateStatus：直连 POST /affairs/batches/:id/status
const batchApi = {
  ...affairsBatchApi,
  updateStatus: (id: string, status: string) =>
    request(`/affairs/batches/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    })
};
</script>

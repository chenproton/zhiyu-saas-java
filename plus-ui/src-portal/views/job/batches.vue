<template>
  <BatchGroupPage
    title="批次分组管理"
    subtitle="管理岗位建设批次分组，关联审批流程"
    :api="batchApi"
    name-placeholder="例如：2026春季电商实训岗位开发"
    workflow-hint="批次内所有岗位将强制使用相同的审批流程"
  />
</template>

<script setup lang="ts">
import BatchGroupPage from '@/components/batch-group-page.vue';
import { batchApi } from '@/api/job';
</script>

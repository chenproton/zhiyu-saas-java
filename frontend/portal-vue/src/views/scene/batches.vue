<template>
  <BatchGroupPage
    title="批次分组管理"
    subtitle="管理场景建设批次分组，关联审批流程"
    :api="sceneBatchApi"
    name-placeholder="例如：2026春季电商实训场景开发"
    workflow-hint="批次内所有场景将强制使用相同的审批流程"
  />
</template>

<script setup lang="ts">
import BatchGroupPage from '@/components/batch-group-page.vue';
import { sceneBatchApi } from '@/api/scene';
</script>

<template>
  <!-- 对齐原 React 版 lesson/admin/batches/page.tsx（BatchGroupPage 用法） -->
  <BatchGroupPage
    title="批次分组管理"
    subtitle="管理课程建设批次分组，关联审批流程"
    :api="lessonBatchApi"
    name-placeholder="例如：2026春季电商实训课程开发"
    workflow-hint="批次内所有课程将强制使用相同的审批流程"
    search-placeholder="搜索批次名称、编号..."
  />
</template>

<script setup lang="ts">
import BatchGroupPage from '@/components/batch-group-page.vue';
import { lessonBatchApi } from '@/api/lesson';
</script>

<template>
  <batch-group-page
    :title="title"
    :subtitle="subtitle"
    :api="api"
    :name-placeholder="namePlaceholder"
    :workflow-hint="workflowHint"
    :detail-href="detailHref"
  />
</template>

<script setup lang="ts">
import BatchGroupPage from '@/components/batch-group-page.vue';

interface BatchApi {
  list: (params?: Record<string, string | number | boolean | undefined>) => Promise<{ items: any[]; total?: number }>;
  create: (req: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, req: Record<string, unknown>) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
  updateStatus?: (id: string, status: string) => Promise<unknown>;
}

withDefaults(
  defineProps<{
    title: string;
    api: BatchApi;
    subtitle?: string;
    namePlaceholder?: string;
    workflowHint?: string;
    detailHref?: (id: string) => string;
  }>(),
  {
    subtitle: '',
    namePlaceholder: '请输入批次名称',
    workflowHint: ''
  }
);
</script>

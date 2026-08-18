<template>
  <BatchManager title="测评批次" :api="evaluationBatchApi" />
</template>

<script setup lang="ts">
import BatchManager from '@/components/BatchManager.vue';
import { evaluationBatchApi } from '@/api/evaluation';
</script>

<template>
  <BatchManager title="场景批次" :api="sceneBatchApi" />
</template>

<script setup lang="ts">
import BatchManager from '@/components/BatchManager.vue';
import { sceneBatchApi } from '@/api/scene';
</script>

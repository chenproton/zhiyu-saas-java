<template>
  <BatchManager title="教务批次" :api="affairsBatchApi" />
</template>

<script setup lang="ts">
import BatchManager from '@/components/BatchManager.vue';
import { affairsBatchApi } from '@/api/affairs';
</script>

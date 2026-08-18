<template>
  <BatchManager title="课程批次" :api="lessonBatchApi" />
</template>

<script setup lang="ts">
import BatchManager from '@/components/BatchManager.vue';
import { lessonBatchApi } from '@/api/lesson';
</script>

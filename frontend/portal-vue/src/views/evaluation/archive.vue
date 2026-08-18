<template>
  <ArchiveManager title="试卷归档" :api="examApi" />
</template>

<script setup lang="ts">
import ArchiveManager from '@/components/ArchiveManager.vue';
import { examApi } from '@/api/evaluation';
</script>

<template>
  <ArchiveManager title="方案归档" :api="programApi" />
</template>

<script setup lang="ts">
import ArchiveManager from '@/components/ArchiveManager.vue';
import { programApi } from '@/api/affairs';
</script>

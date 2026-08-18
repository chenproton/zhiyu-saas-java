<template>
  <ArchiveManager title="课程归档" :api="courseApi" />
</template>

<script setup lang="ts">
import ArchiveManager from '@/components/ArchiveManager.vue';
import { courseApi } from '@/api/lesson';
</script>

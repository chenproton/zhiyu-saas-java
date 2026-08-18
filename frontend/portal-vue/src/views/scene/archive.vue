<template>
  <ArchiveManager title="场景归档" :api="scenarioApi" />
</template>

<script setup lang="ts">
import ArchiveManager from '@/components/ArchiveManager.vue';
import { scenarioApi } from '@/api/scene';
</script>

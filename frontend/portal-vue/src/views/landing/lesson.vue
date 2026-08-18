<template>
  <LandingGrid title="课程广场" :api="courseApi" name-field="name" subtitle-field="description"
    :detail-fields="[{key:'type',label:'类型'},{key:'category',label:'分类'},{key:'status',label:'状态'}]" />
</template>

<script setup lang="ts">
import LandingGrid from '@/components/LandingGrid.vue';
import { courseApi } from '@/api/lesson';
</script>

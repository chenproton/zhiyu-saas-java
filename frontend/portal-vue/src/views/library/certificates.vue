<template>
  <SimpleCrud title="证书库管理" :api="certificateLibraryApi" :fields="fields" />
</template>

<script setup lang="ts">
import SimpleCrud from '@/components/SimpleCrud.vue';
import { certificateLibraryApi } from '@/api/job';

const fields = [
  { key: 'name', label: '名称' },
  { key: 'url', label: '链接' },
  { key: 'description', label: '描述' }
];
</script>

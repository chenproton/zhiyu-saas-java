<template>
  <SimpleCrud title="专业管理" :api="majorApi" :fields="fields" />
</template>

<script setup lang="ts">
import SimpleCrud from '@/components/SimpleCrud.vue';
import { majorApi } from '@/api/system';

const fields = [
  { key: 'code', label: '编码' },
  { key: 'name', label: '名称' },
  { key: 'alias', label: '别名' }
];
</script>

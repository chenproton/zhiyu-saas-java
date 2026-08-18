<template>
  <SimpleCrud title="知识点管理" :api="knowledgeApi" :fields="fields" />
</template>

<script setup lang="ts">
import SimpleCrud from '@/components/SimpleCrud.vue';
import { knowledgeApi } from '@/api/lesson';

const fields = [
  { key: 'code', label: '编码' },
  { key: 'name', label: '名称' },
  { key: 'description', label: '描述' }
];
</script>

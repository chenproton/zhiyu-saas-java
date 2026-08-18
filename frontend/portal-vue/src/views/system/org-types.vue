<template>
  <SimpleCrud title="组织类型" :api="orgTypeApi" :fields="fields" />
</template>

<script setup lang="ts">
import SimpleCrud from '@/components/SimpleCrud.vue';
import { orgTypeApi } from '@/api/system';

const fields = [
  { key: 'name', label: '名称' },
  { key: 'category', label: '分类' }
];
</script>

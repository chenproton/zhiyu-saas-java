<template>
  <SimpleCrud title="能力点管理" :api="abilityApi" :fields="fields" />
</template>

<script setup lang="ts">
import SimpleCrud from '@/components/SimpleCrud.vue';
import { abilityApi } from '@/api/job';

const fields = [
  { key: 'code', label: '编码' },
  { key: 'name', label: '名称' },
  { key: 'description', label: '描述' }
];
</script>

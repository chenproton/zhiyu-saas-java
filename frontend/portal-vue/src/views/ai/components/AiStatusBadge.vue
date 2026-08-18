<template>
  <el-tag :type="tagType" size="small" effect="plain">{{ label }}</el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { aiStatusLabel, aiStatusTagType } from '../ai-api';

const props = defineProps<{ status: string }>();

const label = computed(() => aiStatusLabel(props.status));
const tagType = computed(() => aiStatusTagType(props.status));
</script>

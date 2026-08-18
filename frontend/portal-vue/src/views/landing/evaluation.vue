<template>
  <LandingGrid title="测评广场" :api="examApi" name-field="name" subtitle-field="description"
    :detail-fields="[{key:'totalScore',label:'总分'},{key:'duration',label:'时长(分)'},{key:'status',label:'状态'}]" />
</template>

<script setup lang="ts">
import LandingGrid from '@/components/LandingGrid.vue';
import { examApi } from '@/api/evaluation';
</script>

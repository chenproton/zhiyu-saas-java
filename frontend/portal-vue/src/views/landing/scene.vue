<template>
  <LandingGrid title="场景广场" :api="scenarioApi" name-field="name" subtitle-field="background"
    :detail-fields="[{key:'difficulty',label:'难度'},{key:'version',label:'版本'},{key:'status',label:'状态'}]" />
</template>

<script setup lang="ts">
import LandingGrid from '@/components/LandingGrid.vue';
import { scenarioApi } from '@/api/scene';
</script>

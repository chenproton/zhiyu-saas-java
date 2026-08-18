<template>
  <LandingGrid title="岗位广场" :api="publicPositionApi" name-field="name" subtitle-field="description"
    :detail-fields="[{key:'shortName',label:'简称'},{key:'positionType',label:'类型'},{key:'version',label:'版本'},{key:'status',label:'状态'}]" />
</template>

<script setup lang="ts">
import LandingGrid from '@/components/LandingGrid.vue';
import { publicPositionApi } from '@/api/job';
</script>

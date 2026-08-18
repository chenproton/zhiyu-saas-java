<template>
  <LandingGrid title="资源广场" :api="resourceLibraryApi" name-field="name" subtitle-field="description"
    :detail-fields="[{key:'resourceType',label:'类型'},{key:'uploaderName',label:'上传人'}]" />
</template>

<script setup lang="ts">
import LandingGrid from '@/components/LandingGrid.vue';
import { resourceLibraryApi } from '@/api/library';
</script>

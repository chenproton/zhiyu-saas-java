<template>
  <div class="subh">
    <div class="subh-left">
      <span class="bar" />
      <h3 class="subh-title">{{ title }}</h3>
    </div>
    <router-link :to="href" class="subh-link">查看全部 <el-icon><Right /></el-icon></router-link>
  </div>
</template>

<script setup lang="ts">
import { Right } from '@element-plus/icons-vue';
defineProps<{ title: string; href: string }>();
</script>

<style scoped>
.subh { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 24px; }
.subh-left { display: flex; align-items: center; gap: 12px; }
.bar { width: 6px; height: 24px; border-radius: 9999px; background: linear-gradient(to bottom, rgba(64,158,255,0.8), rgba(64,158,255,0.6)); }
.subh-title { font-size: 18px; font-weight: 600; color: #1e293b; }
.subh-link { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 500; color: #409eff; text-decoration: none; transition: color 0.2s; }
.subh-link:hover { color: rgba(64,158,255,0.8); }
</style>

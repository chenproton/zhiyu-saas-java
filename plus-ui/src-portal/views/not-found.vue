<template>
  <div class="not-found">
    <p class="code">404</p>
    <p class="desc">页面不存在或已被移除</p>
    <el-button @click="$router.push('/portal/workspace')">返回工作台</el-button>
  </div>
</template>

<script setup lang="ts">
// 对齐 React app/not-found.tsx：未命中路由展示 404 页
</script>

<style scoped>
.not-found {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
  padding: 0 16px;
}
.code {
  font-size: 48px;
  font-weight: 700;
  margin: 0;
  color: #303133;
}
.desc {
  font-size: 14px;
  color: #909399;
  margin: 0;
}
</style>

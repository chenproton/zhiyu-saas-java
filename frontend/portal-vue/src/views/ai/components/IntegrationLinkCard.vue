<template>
  <div class="integration-card" @click="open">
    <span class="icon-box">{{ item.icon || '🔗' }}</span>
    <div class="info">
      <div class="name-row">
        <span class="name">{{ item.name }}</span>
        <el-tag v-if="item.category" size="small" type="info">{{ item.category }}</el-tag>
      </div>
      <span class="desc">{{ item.description || '无描述' }}</span>
    </div>
    <el-icon class="ext"><TopRight /></el-icon>
  </div>
</template>

<script setup lang="ts">
import { TopRight } from '@element-plus/icons-vue';
import type { AIIntegration } from '@/types/ai';

const props = defineProps<{ item: AIIntegration }>();

function open() {
  window.open(props.item.url, '_blank', 'noopener');
}
</script>

<style scoped>
.integration-card {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #e7e5e4;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s;
}
.integration-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(14, 165, 233, 0.04));
  border: 1px solid rgba(14, 165, 233, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}
.info {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.desc {
  display: block;
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ext {
  color: #909399;
  flex-shrink: 0;
}
</style>

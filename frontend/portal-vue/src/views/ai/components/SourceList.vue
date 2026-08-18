<template>
  <div v-if="sources && sources.length" class="source-list">
    <el-button text size="small" class="source-toggle" @click="open = !open">
      <el-icon><component :is="open ? ArrowDown : ArrowRight" /></el-icon>
      参考来源（{{ sources.length }}）
    </el-button>
    <ul v-if="open" class="source-items">
      <li v-for="(s, i) in sources" :key="`${s.docId}-${s.seq}-${i}`" class="source-item">
        <div class="source-head">
          <el-icon class="file-icon"><Document /></el-icon>
          <span class="source-name">{{ s.docName }}</span>
          <span class="source-seq">第 {{ s.seq }} 段</span>
        </div>
        <p class="source-snippet">{{ s.snippet }}</p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ArrowDown, ArrowRight, Document } from '@element-plus/icons-vue';
import type { AIMessageSource } from '../ai-api';

defineProps<{ sources: AIMessageSource[] }>();
const open = ref(false);
</script>

<style scoped>
.source-list {
  margin-top: 8px;
  border-top: 1px solid #f0f0f0;
  padding-top: 8px;
}
.source-toggle {
  color: #909399;
  font-size: 12px;
  padding: 0;
}
.source-items {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.source-item {
  border: 1px solid #f0f0f0;
  background: #fafafa;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}
.source-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #303133;
}
.file-icon {
  color: #909399;
}
.source-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-seq {
  color: #909399;
  flex-shrink: 0;
}
.source-snippet {
  margin: 6px 0 0;
  color: #909399;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

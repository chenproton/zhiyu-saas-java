<template>
  <!-- 字段级 AI 控件（逐字对齐 React scene/scenarios/[id]/edit/page.tsx renderFieldAiControls） -->
  <span class="field-ai">
    <template v-if="updated">
      <el-tag size="small" class="ai-badge" disable-transitions>已更新</el-tag>
      <el-button text size="small" class="ai-restore" @click.stop.prevent="emit('restore')">
        <el-icon><RefreshLeft /></el-icon>
        恢复上版
      </el-button>
    </template>
    <el-button
      text
      size="small"
      class="ai-gen"
      :disabled="running"
      title="AI 生成"
      @click.stop.prevent="emit('generate')"
    >
      <el-icon v-if="loading" class="is-loading"><Loading /></el-icon>
      <el-icon v-else><MagicStick /></el-icon>
    </el-button>
  </span>
</template>

<script setup lang="ts">
import { Loading, MagicStick, RefreshLeft } from '@element-plus/icons-vue';

withDefaults(
  defineProps<{
    /** 该字段已被 AI 覆盖（存在 1 级快照）→ 显示「已更新」+「恢复上版」 */
    updated?: boolean;
    /** 流水线运行中 → 生成按钮禁用（对齐 React disabled={pipeline.isRunning}） */
    running?: boolean;
    /** 当前正在跑 polish 任务 → 生成按钮转 loading 图标 */
    loading?: boolean;
  }>(),
  { updated: false, running: false, loading: false }
);

const emit = defineEmits<{
  (e: 'restore'): void;
  (e: 'generate'): void;
}>();
</script>

<style scoped>
.field-ai {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ai-badge {
  height: 18px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 18px;
  border-color: #e0cffc;
  color: #7e22ce;
  background: #faf5ff;
}
.ai-restore {
  height: 22px;
  padding: 0 4px;
  font-size: 11px;
  color: #7e22ce;
}
.ai-restore:hover {
  color: #6b21a8;
  background: #faf5ff;
}
.ai-gen {
  height: 22px;
  padding: 0 4px;
  color: #9333ea;
}
.ai-gen:hover {
  color: #6b21a8;
  background: #faf5ff;
}
</style>

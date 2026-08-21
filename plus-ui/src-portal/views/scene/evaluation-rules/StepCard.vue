<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="step-card"
    :class="[tone === 'success' ? 'success' : '', clickable ? 'clickable' : '']"
    @click="clickable ? emit('click') : undefined"
  >
    <span class="step-no">{{ step }}</span>
    <div class="step-head">
      <div class="step-icon">
        <el-icon :size="16"><component :is="icon" /></el-icon>
      </div>
      <span class="step-title">{{ title }}</span>
      <el-tag v-if="badge" size="small" type="info" disable-transitions class="step-badge">{{ badge }}</el-tag>
      <el-icon v-else-if="configured" class="step-check" :size="15"><CircleCheckFilled /></el-icon>
    </div>
    <p class="step-summary" :title="summary">{{ summary }}</p>
    <p class="step-desc">{{ description }}</p>
  </component>
</template>

<script setup lang="ts">
// 四步配置卡片：对齐 React EvaluationRulesEditor 内部 StepCard（序号/图标/标题/摘要/描述/已配置勾选）
import { CircleCheckFilled } from '@element-plus/icons-vue';

defineProps<{
  step: number;
  title: string;
  icon: string;
  summary: string;
  description: string;
  badge?: string;
  configured?: boolean;
  tone?: 'default' | 'success';
  clickable?: boolean;
}>();

const emit = defineEmits<{ (e: 'click'): void }>();
</script>

<style scoped>
.step-card {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  font: inherit;
  transition: all 0.2s;
}
.step-card.clickable {
  cursor: pointer;
}
.step-card.clickable:hover {
  border-color: #a0cfff;
  background: #f7fbff;
}
.step-card.success.clickable:hover {
  border-color: #b3e19d;
  background: #f6fdf3;
}
.step-no {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #d9ecff;
}
.step-card.success .step-no {
  background: #f0f9eb;
  color: #67c23a;
  border-color: #e1f3d8;
}
.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.step-icon {
  padding: 5px;
  border-radius: 6px;
  background: #ecf5ff;
  color: #409eff;
  display: flex;
}
.step-card.success .step-icon {
  background: #f0f9eb;
  color: #67c23a;
}
.step-title {
  font-size: 12px;
  color: #606266;
  font-weight: 500;
}
.step-badge {
  margin-left: auto;
}
.step-check {
  margin-left: auto;
  color: #409eff;
}
.step-card.success .step-check {
  color: #67c23a;
}
.step-summary {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  padding-right: 24px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.step-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

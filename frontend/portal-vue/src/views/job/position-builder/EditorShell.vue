<template>
  <!-- 全屏编辑外壳（对齐 React frontend/edu/components/shared/editor-shell.tsx mode="fullscreen"） -->
  <div class="editor-shell">
    <div class="shell-header">
      <div class="header-left">
        <el-button text class="back-btn" @click="emit('back')">
          <el-icon><Close /></el-icon>
          {{ backText }}
        </el-button>
        <el-divider direction="vertical" />
        <el-tag type="primary" effect="dark" class="step-tag">步骤 {{ step }}</el-tag>
        <span class="step-label">{{ stepLabel }}</span>
      </div>
      <div class="header-right">
        <span v-if="loadingText" class="loading-text">
          <el-icon class="is-loading"><Loading /></el-icon>
          {{ loadingText }}
        </span>
        <el-button :disabled="isSaving || saveDisabled" @click="emit('save-draft')">
          <el-icon><Files /></el-icon>
          {{ isSaving ? '保存中...' : '保存草稿' }}
        </el-button>
        <el-button @click="emit('preview')">
          <el-icon><View /></el-icon>
          预览
        </el-button>
        <el-button v-if="canPrev" @click="emit('prev')">
          <el-icon><ArrowLeft /></el-icon>
          上一步
        </el-button>
        <el-button v-if="canNext" type="primary" :disabled="nextDisabled" @click="emit('next')">
          {{ nextText }}
          <el-icon><ArrowRight /></el-icon>
        </el-button>
        <el-button v-else type="primary" @click="emit('submit')">
          <el-icon><Check /></el-icon>
          {{ submitText }}
        </el-button>
      </div>
    </div>

    <div class="shell-body">
      <div v-if="title" class="page-title">
        <h1>{{ title }}</h1>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Close,
  Files,
  Loading,
  View
} from '@element-plus/icons-vue';

withDefaults(
  defineProps<{
    backText?: string;
    step: number;
    stepLabel: string;
    isSaving?: boolean;
    saveDisabled?: boolean;
    canPrev?: boolean;
    canNext?: boolean;
    /** 下一步按钮文案（对齐 React EditorShell nextText，缺省「下一步」） */
    nextText?: string;
    /** 下一步按钮禁用（对齐 React EditorShell nextDisabled） */
    nextDisabled?: boolean;
    submitText?: string;
    loadingText?: string;
    title?: string;
    subtitle?: string;
  }>(),
  {
    backText: '取消',
    isSaving: false,
    saveDisabled: false,
    canPrev: false,
    canNext: false,
    nextText: '下一步',
    nextDisabled: false,
    submitText: '完成配置',
    loadingText: '',
    title: '',
    subtitle: ''
  }
);

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'save-draft'): void;
  (e: 'preview'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'submit'): void;
}>();
</script>

<style scoped>
.editor-shell {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: auto;
  background: #f5f7fa;
}
.shell-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}
.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.back-btn {
  font-size: 14px;
}
.step-tag {
  flex-shrink: 0;
}
.step-label {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.loading-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
}
.shell-body {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}
.page-title h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.page-title p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}
.page-title {
  margin-bottom: 24px;
}
</style>

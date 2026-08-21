<template>
  <!-- 封面上传（对齐原 React 版 cover-image-upload） -->
  <div>
    <div class="cover-label">{{ label }}</div>
    <div class="cover-box" role="button" tabindex="0" @click="triggerUpload" @keydown.enter.prevent="triggerUpload">
      <input ref="inputRef" type="file" accept="image/*" class="cover-input" @change="onFileSelect" />
      <template v-if="imageUrl">
        <img :src="imageUrl" :alt="alt" class="cover-img" />
        <div class="cover-mask">
          <el-button size="small" :loading="uploading" @click.stop="triggerUpload">更换封面</el-button>
          <el-button size="small" :disabled="uploading" @click.stop="emit('remove')">移除封面</el-button>
        </div>
      </template>
      <div v-else class="cover-empty">
        <el-icon v-if="uploading" class="is-loading" :size="28"><Loading /></el-icon>
        <el-icon v-else :size="28"><UploadFilled /></el-icon>
        <span class="cover-tip">{{ uploading ? '上传中...' : `点击上传${label}` }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Loading, UploadFilled } from '@element-plus/icons-vue';

const props = defineProps<{
  imageUrl: string;
  uploading: boolean;
  label: string;
  alt: string;
}>();

const emit = defineEmits<{
  (e: 'upload', file: File): void;
  (e: 'remove'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);

function triggerUpload() {
  if (!props.uploading) inputRef.value?.click();
}

/** HEIC/HEIF 浏览器无法解码，与 React image-upload-utils.isUndecodableImage 一致直接拒绝 */
function isUndecodableImage(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (isUndecodableImage(file)) {
    ElMessage.error('暂不支持 HEIC/HEIF 格式，请先转换后再上传');
    return;
  }
  emit('upload', file);
}
</script>

<style scoped>
.cover-label {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}
.cover-box {
  position: relative;
  aspect-ratio: 16 / 9;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  background: #f5f7fa;
  transition: background 0.2s;
}
.cover-box:hover {
  background: #f0f2f5;
}
.cover-input {
  display: none;
}
.cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s;
}
.cover-box:hover .cover-mask {
  opacity: 1;
}
.cover-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #909399;
}
.cover-tip {
  font-size: 13px;
}
</style>

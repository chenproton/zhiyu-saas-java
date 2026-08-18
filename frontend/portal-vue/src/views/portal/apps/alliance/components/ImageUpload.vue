<template>
  <div class="image-upload">
    <div v-if="label" class="image-upload__label">{{ label }}</div>
    <div class="image-upload__grid">
      <div v-for="(url, idx) in urls" :key="idx" class="image-upload__item">
        <el-image :src="url" fit="cover" class="image-upload__img" />
        <el-button
          size="small"
          circle
          type="danger"
          class="image-upload__remove"
          :disabled="uploading"
          @click.stop="removeAt(idx)"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <el-upload
        v-if="multiple || urls.length === 0"
        :auto-upload="false"
        :show-file-list="false"
        accept="image/*"
        :disabled="uploading"
        :multiple="false"
        @change="onFileChange"
      >
        <div class="image-upload__empty">
          <el-icon v-if="!uploading" class="image-upload__plus"><Plus /></el-icon>
          <span v-if="uploading">上传中...</span>
          <span v-else>上传</span>
        </div>
      </el-upload>
    </div>
    <div class="image-upload__hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Close } from '@element-plus/icons-vue';
import type { UploadFile } from 'element-plus';
import { fileApi } from '@/api/import-export';

const props = withDefaults(
  defineProps<{
    modelValue?: string | string[];
    multiple?: boolean;
    label?: string;
    hint?: string;
  }>(),
  {
    multiple: false,
    label: '',
    hint: '',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | string[]): void;
}>();

const uploading = ref(false);

const urls = computed<string[]>(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue.filter(Boolean);
  return props.modelValue ? [props.modelValue] : [];
});

function emitValue(next: string[]) {
  emit('update:modelValue', props.multiple ? next : next[0] ?? '');
}

async function onFileChange(uploadFile: UploadFile): Promise<void> {
  const f = uploadFile.raw;
  if (!f) return;
  uploading.value = true;
  try {
    const res = await fileApi.upload(f);
    if (props.multiple) {
      emitValue([...urls.value, res.url]);
    } else {
      emitValue([res.url]);
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '上传失败');
  } finally {
    uploading.value = false;
  }
}

function removeAt(idx: number) {
  const next = urls.value.filter((_, i) => i !== idx);
  emitValue(next);
}
</script>

<style scoped>
.image-upload__label {
  font-size: 13px;
  color: #475569;
  margin-bottom: 8px;
}
.image-upload__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.image-upload__item {
  position: relative;
  width: 96px;
  height: 96px;
}
.image-upload__img {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.image-upload__remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  padding: 0;
}
.image-upload__empty {
  width: 96px;
  height: 96px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 12px;
  cursor: pointer;
  gap: 4px;
}
.image-upload__empty:hover {
  border-color: #409eff;
  color: #409eff;
}
.image-upload__plus {
  font-size: 18px;
}
.image-upload__hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 6px;
}
</style>

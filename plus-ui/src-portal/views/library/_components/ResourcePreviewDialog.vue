<template>
  <el-dialog
    :model-value="modelValue"
    :title="resource?.name || '资源预览'"
    width="72%"
    top="5vh"
    class="resource-preview-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="preview-body">
      <iframe
        v-if="previewSrc"
        :src="previewSrc"
        :title="resource?.name"
        class="preview-iframe"
        allowfullscreen
        loading="lazy"
      />
      <div v-else-if="resource?.url && isSafeLinkUrl(resource.url)" class="preview-fallback">
        <span>该链接无法内嵌预览，请点击右上角「新窗口打开」</span>
        <el-button type="primary" @click="openExternal">新窗口打开</el-button>
      </div>
      <div v-else-if="loading" class="preview-fallback">
        <span>加载中…</span>
      </div>
      <div v-else class="preview-fallback">
        <span>暂无预览内容</span>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      <el-button v-if="resource?.url && isSafeLinkUrl(resource.url)" type="primary" @click="openExternal">
        新窗口打开
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { request } from '@/api/http';
import { isSafeLinkUrl } from '@/utils/format';
import type { ResourceLibraryItem } from '@/types/library';

const props = defineProps<{
  modelValue: boolean;
  resource: ResourceLibraryItem | null;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const previewSrc = ref<string | null>(null);
const loading = ref(false);

function mayNeedSignUrl(url: string): boolean {
  return url.startsWith('/uploads/');
}

function buildKkFileViewUrl(fileUrl: string): string {
  const origin =
    typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '';
  return `/kkfileview/onlinePreview?url=${btoa(`${origin}${fileUrl}`)}`;
}

async function loadPreview(): Promise<void> {
  const url = props.resource?.url;
  previewSrc.value = null;
  if (!url) {
    loading.value = false;
    return;
  }
  if (mayNeedSignUrl(url)) {
    loading.value = true;
    try {
      const data = await request<{ url: string }>(
        `/files/sign-url?name=${encodeURIComponent(url)}`
      );
      previewSrc.value = buildKkFileViewUrl(data.url);
    } catch {
      previewSrc.value = null;
    } finally {
      loading.value = false;
    }
  } else {
    loading.value = false;
    previewSrc.value = null;
  }
}

function openExternal(): void {
  if (props.resource?.url && isSafeLinkUrl(props.resource.url)) {
    window.open(props.resource.url, '_blank', 'noopener,noreferrer');
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) void loadPreview();
  }
);
</script>

<style scoped>
.preview-body {
  height: 70vh;
  min-height: 360px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
}
.preview-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
.preview-fallback {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9ca3af;
  font-size: 14px;
}
</style>

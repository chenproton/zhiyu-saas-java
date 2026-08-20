<template>
  <el-dialog
    :model-value="!!attachment"
    :title="attachment?.name || '附件预览'"
    width="72%"
    top="5vh"
    @update:model-value="(v: boolean) => !v && emit('close')"
  >
    <div class="preview-body">
      <img v-if="isImage" :src="attachment?.url" :alt="attachment?.name" class="preview-media" />
      <video v-else-if="isVideo" :src="attachment?.url" controls class="preview-media" />
      <div v-else class="preview-fallback">
        <el-icon class="fallback-icon"><Folder /></el-icon>
        <span>该类型文件暂不支持在线预览</span>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('close')">关闭</el-button>
      <el-button v-if="attachment?.url" type="primary" @click="openExternal">新窗口打开</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Folder } from '@element-plus/icons-vue';
import { isSafeLinkUrl } from '@/utils/format';

// 附件预览弹窗（对齐 React scene-results/[id] AttachmentPreview：图片/视频内嵌，其余空态兜底）
export interface PreviewAttachment {
  name: string;
  url: string;
  type?: string;
}

const props = defineProps<{ attachment: PreviewAttachment | null }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const isImage = computed(() => !!props.attachment?.type?.startsWith('image'));
const isVideo = computed(() => !!props.attachment?.type?.startsWith('video'));

function openExternal(): void {
  const url = props.attachment?.url;
  if (url && isSafeLinkUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
</script>

<style scoped>
.preview-body {
  min-height: 300px;
  max-height: calc(90vh - 160px);
  overflow: auto;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.preview-media {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.preview-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #c0c4cc;
  font-size: 14px;
  min-height: 240px;
}
.fallback-icon {
  font-size: 40px;
  opacity: 0.5;
}
</style>

<template>
  <div class="description-editor">
    <el-tabs v-model="mode" class="desc-tabs">
      <el-tab-pane :label="richTextLabel" name="rich_text" />
      <el-tab-pane :label="pdfTabLabel" name="pdf" />
    </el-tabs>

    <div v-if="mode === 'rich_text'" class="rich-mode">
      <p class="hint">{{ textHint }}</p>
      <div class="textarea-box" :style="{ minHeight: minHeight + 'px' }">
        <div class="textarea-body">
          <el-input
            v-model="localValue"
            type="textarea"
            resize="none"
            :rows="Math.max(8, Math.round((minHeight - 40) / 22))"
            class="plain-textarea"
            :placeholder="placeholder || defaultPlaceholder"
          />
        </div>
        <div class="textarea-footer">
          <span>纯文本模式</span>
          <span>{{ localValue.length }} 字符</span>
        </div>
      </div>
    </div>

    <div v-else class="pdf-mode" @click="!pdfUploading && fileInput?.click()" @dragover.prevent @drop.prevent="onPdfDrop">
      <input ref="fileInput" type="file" accept="application/pdf" class="hidden-input" @change="onFileChange" />
      <template v-if="pdfUrl">
        <div class="pdf-preview pointer-events-none">
          <div class="pdf-icon">
            <el-icon :size="40" color="#f56c6c"><Document /></el-icon>
            <span class="pdf-badge">PDF</span>
          </div>
          <p class="pdf-name">{{ pdfFileName }}</p>
        </div>
        <div class="pdf-actions" @click.stop>
          <el-button size="small" @click="pdfPreviewOpen = true">预览</el-button>
          <el-button size="small" :disabled="pdfUploading" @click="fileInput?.click()">重新上传</el-button>
          <el-button size="small" @click="emitPdf(null)">移除文件</el-button>
        </div>
      </template>
      <template v-else>
        <div class="upload-icon">
          <el-icon :size="32" color="#909399">
            <Loading v-if="pdfUploading" class="is-loading" />
            <UploadFilled v-else />
          </el-icon>
        </div>
        <div class="upload-text">
          <p class="upload-title">{{ pdfUploading ? '上传中...' : uploadHint }}</p>
          <p class="upload-sub">支持 PDF 格式，最大 10MB</p>
        </div>
      </template>
    </div>

    <el-dialog v-model="pdfPreviewOpen" :title="pdfFileName || '文件预览'" width="80%" top="5vh" destroy-on-close>
      <div class="pdf-frame">
        <iframe v-if="pdfUrl" :src="pdfUrl" class="pdf-iframe" :title="pdfFileName || 'PDF 预览'" />
        <div v-else class="no-file">暂无文件</div>
      </div>
      <template #footer>
        <el-button @click="pdfPreviewOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fileApi } from '@/api/import-export';

const props = withDefaults(
  defineProps<{
    value: string;
    placeholder?: string;
    minHeight?: number;
    pdfUrl?: string | null;
    richTextLabel?: string;
    pdfTabLabel?: string;
    uploadHint?: string;
    textHint?: string;
  }>(),
  {
    placeholder: '',
    minHeight: 300,
    pdfUrl: null,
    richTextLabel: '自定义编辑',
    pdfTabLabel: '上传自定义文件',
    uploadHint: '点击或拖拽上传课程说明书',
    textHint: '可编写详细的学习目标（纯文本）',
  }
);

const emit = defineEmits<{
  (e: 'update:value', v: string): void;
  (e: 'update:pdfUrl', v: string | null): void;
}>();

const mode = ref<'rich_text' | 'pdf'>('rich_text');
const pdfUploading = ref(false);
const pdfPreviewOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const localValue = computed({
  get: () => props.value,
  set: (v: string) => emit('update:value', v)
});

const pdfFileName = computed(() => {
  if (!props.pdfUrl) return '';
  return props.pdfUrl.split('/').pop() || props.pdfUrl;
});

const defaultPlaceholder = `课程目标

学生通过本课程学习，将能够：

• 掌握 [核心知识点/技能] 的基本概念与原理
• 能够独立完成 [具体任务/操作]
• 理解 [相关理论/方法] 的适用场景与局限性
• 具备 [某种能力/素养]

学习要求

• 课前预习：[预习材料/视频]
• 课堂参与：积极参与讨论与练习
• 课后作业：按时完成并提交
• 考核方式：[测验/项目/考试]

评价标准

• 知识掌握（40%）：理解核心概念，能正确运用
• 实践能力（30%）：能独立完成操作任务
• 团队协作（15%）：积极参与小组活动
• 创新思维（15%）：能提出有见地的问题或方案`;

function emitPdf(url: string | null) {
  emit('update:pdfUrl', url);
}

async function handlePdfUpload(file: File) {
  if (file.type !== 'application/pdf') {
    ElMessage.error('请上传 PDF 文件');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小超过 10MB');
    return;
  }
  pdfUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    emitPdf(res.url);
    ElMessage.success('上传成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '上传失败');
  } finally {
    pdfUploading.value = false;
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void handlePdfUpload(file);
  input.value = '';
}

function onPdfDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file) void handlePdfUpload(file);
}
</script>

<style scoped>
.desc-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
.hint {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
.textarea-box {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.textarea-body {
  padding: 16px;
  flex: 1;
  background: #fff;
}
.plain-textarea :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  resize: none;
  padding: 0;
  font-size: 14px;
  line-height: 1.7;
  min-height: 100%;
}
.textarea-footer {
  background: #fafafa;
  border-top: 1px solid #e4e7ed;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #c0c4cc;
}
.pdf-mode {
  border: 2px dashed #e4e7ed;
  border-radius: 12px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: border-color 0.2s;
  min-height: 240px;
  justify-content: center;
}
.pdf-mode:hover {
  border-color: #a0cfff;
  background: #fafcff;
}
.hidden-input {
  display: none;
}
.pdf-icon {
  width: 96px;
  height: 128px;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}
.pdf-badge {
  font-size: 10px;
  color: #f56c6c;
  font-weight: 600;
  margin-top: 4px;
}
.pdf-name {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}
.pdf-actions {
  display: flex;
  gap: 8px;
}
.upload-icon {
  width: 64px;
  height: 64px;
  background: #f5f7fa;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-text {
  text-align: center;
}
.upload-title {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}
.upload-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.pdf-frame {
  height: 65vh;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #f5f7fa;
  overflow: hidden;
}
.pdf-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
.no-file {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}
</style>

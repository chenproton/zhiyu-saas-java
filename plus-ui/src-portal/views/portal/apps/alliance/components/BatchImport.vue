<template>
  <el-button size="small" :loading="loading" @click="open">
    <el-icon class="mr-4"><Upload /></el-icon>
    批量导入
  </el-button>

  <el-dialog v-model="dialogOpen" :title="`导入${entityLabel}`" width="480px">
    <div class="batch-import">
      <p class="batch-import__tip">
        下载导入模板，按模板填写后上传 Excel (.xlsx) 文件进行批量导入。
      </p>
      <div class="batch-import__row">
        <el-button size="small" :loading="downloading" @click="downloadTemplate">
          <el-icon class="mr-4"><Download /></el-icon>
          下载模板
        </el-button>
      </div>
      <el-upload
        :auto-upload="false"
        :show-file-list="true"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="onFileChange"
        :on-remove="onFileRemove"
        :file-list="fileList"
      >
        <el-button size="small">选择文件</el-button>
      </el-upload>
      <p v-if="result" class="batch-import__result">{{ result }}</p>
    </div>
    <template #footer>
      <el-button @click="dialogOpen = false">取消</el-button>
      <el-button type="primary" :loading="importing" :disabled="!selectedFile" @click="doImport">
        开始导入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Upload, Download } from '@element-plus/icons-vue';
import type { UploadFile, UploadUserFile } from 'element-plus';
import { authedFetch } from '@/api/http';

const props = defineProps<{
  brandType: string;
  entityLabel: string;
}>();

const emit = defineEmits<{
  (e: 'success'): void;
}>();

const dialogOpen = ref(false);
const loading = ref(false);
const downloading = ref(false);
const importing = ref(false);
const selectedFile = ref<File | null>(null);
const fileList = ref<UploadUserFile[]>([]);
const result = ref('');

function open() {
  result.value = '';
  selectedFile.value = null;
  fileList.value = [];
  dialogOpen.value = true;
}

function onFileChange(uploadFile: UploadFile) {
  selectedFile.value = uploadFile.raw ?? null;
  fileList.value = uploadFile.raw ? [uploadFile] : [];
}

function onFileRemove() {
  selectedFile.value = null;
  fileList.value = [];
}

async function downloadTemplate() {
  downloading.value = true;
  try {
    const res = await authedFetch(`/templates/alliance-brands?brandType=${encodeURIComponent(props.brandType)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.entityLabel}批量导入模板.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    ElMessage.error((e as Error).message || '模板下载失败');
  } finally {
    downloading.value = false;
  }
}

async function doImport() {
  if (!selectedFile.value) return;
  importing.value = true;
  try {
    const form = new FormData();
    form.append('file', selectedFile.value);
    const res = await authedFetch(
      `/import/alliance-brands/excel?overwrite=false&rename=false&brandType=${encodeURIComponent(props.brandType)}`,
      { method: 'POST', body: form },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const created = (data as { created?: number }).created ?? 0;
    const failed = (data as { failed?: number }).failed ?? 0;
    const skipped = (data as { skipped?: number }).skipped ?? 0;
    result.value = `成功 ${created} 条，失败 ${failed} 条，跳过 ${skipped} 条`;
    ElMessage.success('导入完成');
    selectedFile.value = null;
    fileList.value = [];
    emit('success');
  } catch (e) {
    ElMessage.error((e as Error).message || '导入失败');
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.mr-4 {
  margin-right: 4px;
}
.batch-import {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.batch-import__tip {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}
.batch-import__result {
  margin: 0;
  font-size: 13px;
  color: #16a34a;
}
</style>

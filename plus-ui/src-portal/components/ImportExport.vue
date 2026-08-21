<template>
  <div class="import-export">
    <el-space direction="vertical" style="width: 100%">
      <div>
        <el-button type="primary" :loading="downloading" @click="onDownloadTemplate">下载导入模板</el-button>
      </div>
      <div>
        <el-upload :auto-upload="false" :limit="1" :on-change="onFileChange" :file-list="fileList" accept=".xlsx,.xls,.csv">
          <el-button type="success">选择文件导入</el-button>
        </el-upload>
      </div>

      <!-- 预览结果（对齐 React import 向导：新增/已存在/校验失败 + 冲突示例 + 错误列表） -->
      <div v-if="preview">
        <el-alert
          type="info"
          :closable="false"
          :title="`预览：可新增 ${preview.created} 条，已存在 ${preview.duplicates} 条，校验失败 ${preview.failed} 条`"
        />
        <template v-if="preview.duplicateItems.length > 0">
          <div class="preview-subtitle">已存在记录示例（前 {{ Math.min(preview.duplicateItems.length, 10) }} 条）</div>
          <el-table :data="preview.duplicateItems.slice(0, 10)" stripe max-height="220" style="margin-top: 8px">
            <el-table-column prop="rowNum" label="行号" width="80" />
            <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
            <el-table-column prop="key" label="业务键" min-width="120" show-overflow-tooltip />
          </el-table>
        </template>
        <template v-if="preview.errors.length > 0">
          <div class="preview-subtitle">校验错误</div>
          <ul class="error-list">
            <li v-for="(err, i) in preview.errors.slice(0, 10)" :key="i">{{ err }}</li>
          </ul>
        </template>
        <div style="margin-top: 12px">
          <el-checkbox v-model="overwrite">覆盖已有数据</el-checkbox>
          <el-checkbox v-model="rename" style="margin-left: 16px">重名时新增</el-checkbox>
        </div>
        <div style="margin-top: 12px">
          <el-button type="primary" :loading="importing" @click="onConfirmImport">确认导入</el-button>
          <el-button @click="reset">取消</el-button>
        </div>
      </div>
    </el-space>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { importExportApi } from '@/api/import-export';
import type { ImportExcelPreviewResult } from '@/api/import-export';

const props = defineProps<{ entity: string; onImported?: () => void }>();

const fileList = ref<UploadFile[]>([]);
const preview = ref<ImportExcelPreviewResult | null>(null);
const overwrite = ref(false);
const rename = ref(false);
const importing = ref(false);
const downloading = ref(false);
let currentFile: File | null = null;

function onFileChange(file: UploadFile) {
  currentFile = file.raw || null;
  if (currentFile) {
    doPreview(currentFile);
  }
}

async function doPreview(file: File) {
  try {
    preview.value = await importExportApi.importExcelPreview(props.entity, file);
  } catch (e) {
    ElMessage.error((e as Error).message || '预览失败');
    preview.value = null;
  }
}

function templateFilename(res: Response): string {
  const disposition = res.headers.get('Content-Disposition') || '';
  const starMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (starMatch) return decodeURIComponent(starMatch[1].trim());
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch) return decodeURIComponent(plainMatch[1].trim());
  return `${props.entity}-template.xlsx`;
}

async function onDownloadTemplate() {
  downloading.value = true;
  try {
    const res = await importExportApi.downloadTemplate(props.entity);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFilename(res);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    ElMessage.error((e as Error).message || '模板下载失败');
  } finally {
    downloading.value = false;
  }
}

async function onConfirmImport() {
  if (!currentFile) return;
  importing.value = true;
  try {
    const res = await importExportApi.importExcel(props.entity, currentFile, overwrite.value, rename.value);
    const parts = [`成功 ${res.created}`, `失败 ${res.failed || 0}`, `跳过 ${res.skipped || 0}`];
    if (res.permissionSkipped) parts.push(`${res.permissionSkipped} 条无权限跳过`);
    ElMessage.success(`导入完成：${parts.join('，')}`);
    reset();
    props.onImported?.();
  } catch (e) {
    ElMessage.error((e as Error).message || '导入失败');
  } finally {
    importing.value = false;
  }
}

function reset() {
  preview.value = null;
  fileList.value = [];
  currentFile = null;
  overwrite.value = false;
  rename.value = false;
}
</script>

<style scoped>
.import-export {
  padding: 16px;
}
.preview-subtitle {
  margin-top: 12px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}
.error-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #f56c6c;
  font-size: 13px;
  max-height: 160px;
  overflow: auto;
}
</style>

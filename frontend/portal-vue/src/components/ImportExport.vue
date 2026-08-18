<template>
  <div class="import-export">
    <el-space direction="vertical" style="width: 100%">
      <div>
        <el-button type="primary" @click="onExport">下载导入模板</el-button>
      </div>
      <div>
        <el-upload :auto-upload="false" :limit="1" :on-change="onFileChange" :file-list="fileList" accept=".xlsx,.xls,.csv">
          <el-button type="success">选择文件导入</el-button>
        </el-upload>
      </div>

      <!-- 预览结果 -->
      <div v-if="preview">
        <el-alert type="info" :closable="false" :title="`预览：共 ${preview.total} 条，有效 ${preview.valid}，无效 ${preview.invalid}`" />
        <el-table :data="preview.rows" stripe max-height="260" style="margin-top: 8px">
          <el-table-column prop="row" label="行号" width="80" />
          <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="code" label="编码" width="120" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.conflict" type="warning">冲突</el-tag>
              <el-tag v-else-if="row.error" type="danger">错误</el-tag>
              <el-tag v-else type="success">有效</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="error" label="说明" min-width="160" show-overflow-tooltip />
        </el-table>
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
import type { ImportPreviewResult } from '@/api/import-export';

const props = defineProps<{ entity: string; onImported?: () => void }>();

const fileList = ref<UploadFile[]>([]);
const preview = ref<ImportPreviewResult | null>(null);
const overwrite = ref(false);
const rename = ref(false);
const importing = ref(false);
let currentFile: File | null = null;

function onFileChange(file: UploadFile) {
  currentFile = file.raw || null;
  if (currentFile) {
    doPreview(currentFile);
  }
}

async function doPreview(file: File) {
  try {
    preview.value = await importExportApi.importPreview(props.entity, file);
  } catch (e) {
    ElMessage.error((e as Error).message || '预览失败');
    preview.value = null;
  }
}

async function onExport() {
  try {
    const blob = await importExportApi.export(props.entity);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.entity}-template.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    ElMessage.error((e as Error).message || '下载失败');
  }
}

async function onConfirmImport() {
  if (!currentFile) return;
  importing.value = true;
  try {
    const res = await importExportApi.import(props.entity, currentFile, overwrite.value, rename.value);
    ElMessage.success(`导入完成：成功 ${res.created}，失败 ${res.failed}`);
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
</style>

<template>
  <el-dialog
    :model-value="modelValue"
    title="批量上传资源"
    width="560px"
    :close-on-click-modal="!uploading"
    :close-on-press-escape="!uploading"
    :show-close="!uploading"
    @update:model-value="onClose"
  >
    <p class="desc">支持同时选择多个文件，自动以文件名作为资源名称</p>

    <div v-if="!resourceType" class="type-row">
      <span class="type-label">资源类型</span>
      <el-select v-model="selectType" :disabled="uploading" style="flex: 1">
        <el-option
          v-for="(label, key) in RESOURCE_TYPE_LABELS"
          :key="key"
          :label="label"
          :value="key"
          :disabled="!fileTypesWithUpload.includes(key)"
        />
      </el-select>
    </div>

    <div
      class="drop-zone"
      :class="{ disabled: uploading }"
      role="button"
      tabindex="0"
      @click="!uploading && fileInputRef?.click()"
      @keydown.enter.prevent="!uploading && fileInputRef?.click()"
      @keydown.space.prevent="!uploading && fileInputRef?.click()"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInputRef"
        type="file"
        multiple
        :accept="resourceTypeAccept[submitType]"
        class="hidden-input"
        @change="onFileInputChange"
      />
      <div class="drop-icon">⬆</div>
      <p class="drop-title">点击或拖拽批量选择文件</p>
      <p class="drop-sub">
        支持 Office 文档、PDF、图片、CAD 图纸、音视频、压缩包、代码文件、电子书 等常见格式，单文件最大 10MB。
      </p>
    </div>

    <div v-if="files.length" class="file-list">
      <div v-for="(f, i) in files" :key="f.name + '-' + i" class="file-item">
        <span class="file-name">{{ f.name }}</span>
        <span class="file-size">{{ formatSize(f.size) }}</span>
        <el-button v-if="!uploading" link type="danger" @click="removeFile(i)">移除</el-button>
      </div>
    </div>

    <template #footer>
      <div v-if="uploading" class="uploading-hint">正在上传 {{ uploadedCount }}/{{ files.length }}...</div>
      <template v-else>
        <el-button @click="onClose(false)">取消</el-button>
        <el-button type="primary" :disabled="files.length === 0" @click="handleImport">
          开始导入（{{ files.length }}）
        </el-button>
      </template>
    </template>
  </el-dialog>

  <!-- 重名确认弹窗 -->
  <el-dialog
    v-model="duplicateOpen"
    title="发现重名资源"
    width="480px"
    append-to-body
    @closed="duplicateItems = null"
  >
    <p class="desc">
      共 {{ files.length }} 个文件，其中 {{ (duplicateItems || []).length }} 个与现有资源重名，{{ createdCount }} 个为新资源。
    </p>
    <div v-if="(duplicateItems || []).length" class="dup-list">
      <div v-for="d in duplicateItems" :key="d.id" class="dup-item">{{ d.name }}</div>
    </div>
    <template #footer>
      <el-button @click="confirmDuplicate('new')">保留为新资源</el-button>
      <el-button @click="confirmDuplicate('skip')">跳过重名</el-button>
      <el-button type="primary" @click="confirmDuplicate('overwrite')">覆盖同名</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { fileApi } from '@/api/import-export';
import { resourceLibraryApi } from '@/api/library';
import { RESOURCE_TYPE_LABELS } from '@/types/library';
import type { ResourceLibraryItem } from '@/types/library';
import { useAuthStore } from '@/stores/auth';
import { formatSize } from '@/utils/format';
import { fileTypesWithUpload, resourceTypeAccept, validateResourceFile } from './resource-types';

const props = defineProps<{
  modelValue: boolean;
  resourceType?: string;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'imported'): void;
}>();

const auth = useAuthStore();
const currentUserId = computed(() => auth.user?.id || '');

const fileInputRef = ref<HTMLInputElement | null>(null);
const files = ref<File[]>([]);
const selectType = ref('document');
const uploading = ref(false);
const uploadedCount = ref(0);
const duplicateItems = ref<ResourceLibraryItem[] | null>(null);
const duplicateOpen = ref(false);

const submitType = computed(() => props.resourceType || selectType.value);
const createdCount = computed(() => files.value.length - (duplicateItems.value?.length || 0));

function addFiles(incoming: File[]): void {
  if (!fileTypesWithUpload.includes(submitType.value)) return;
  const accepted: File[] = [];
  let skipped = 0;
  for (const file of incoming) {
    const err = validateResourceFile(file, submitType.value);
    if (err) skipped += 1;
    else accepted.push(file);
  }
  if (accepted.length > 0) files.value = [...files.value, ...accepted];
  if (skipped > 0) {
    ElMessage.error(`${skipped} 个文件格式不支持或超过 10MB，已跳过`);
  }
}

function onDrop(e: DragEvent): void {
  if (!uploading.value) addFiles(Array.from(e.dataTransfer?.files || []));
}

function onFileInputChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (!uploading.value) addFiles(Array.from(target.files || []));
  target.value = '';
}

function removeFile(i: number): void {
  files.value = files.value.filter((_, idx) => idx !== i);
}

function reset(): void {
  files.value = [];
  uploadedCount.value = 0;
  duplicateItems.value = null;
}

function onClose(v: boolean): void {
  if (uploading.value) return;
  emit('update:modelValue', v);
  if (!v) reset();
}

async function previewImport(names: string[]): Promise<ResourceLibraryItem[]> {
  const res = await request<ListResponse<ResourceLibraryItem>>('/library/resources/import/preview', {
    method: 'POST',
    body: JSON.stringify({ names, resourceType: submitType.value })
  });
  return res.items || [];
}

async function runImport(mode: 'skip' | 'overwrite' | 'new', existing: ResourceLibraryItem[]): Promise<void> {
  const existingByName = new Map(existing.map((item) => [item.name, item]));
  duplicateItems.value = null;
  uploading.value = true;
  uploadedCount.value = 0;
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let permissionSkipped = 0;
  for (let i = 0; i < files.value.length; i++) {
    const file = files.value[i];
    const existingItem = existingByName.get(file.name);
    if (existingItem && mode === 'skip') {
      skipped += 1;
      uploadedCount.value = i + 1;
      continue;
    }
    if (existingItem && mode === 'overwrite' && existingItem.uploadedBy !== currentUserId.value) {
      permissionSkipped += 1;
      uploadedCount.value = i + 1;
      continue;
    }
    try {
      const res = await fileApi.upload(file);
      const payload: Record<string, unknown> = {
        name: file.name,
        resourceType: submitType.value,
        url: res.url,
        thumbnail: submitType.value === 'image' ? res.url : undefined,
        fileSize: res.size
      };
      if (existingItem && mode === 'overwrite') {
        await resourceLibraryApi.update(existingItem.id, payload as never);
      } else {
        if (existingItem) {
          payload.name = `${file.name}-${Math.floor(1000 + Math.random() * 9000)}`;
        }
        await resourceLibraryApi.create(payload as never);
      }
      success += 1;
    } catch {
      failed += 1;
    }
    uploadedCount.value = i + 1;
  }
  uploading.value = false;

  const skippedMsg = skipped > 0 ? `，跳过 ${skipped} 个同名资源` : '';
  const permissionMsg = permissionSkipped > 0 ? `，${permissionSkipped} 个资源非本人创建，已跳过覆盖` : '';
  if (failed > 0) {
    ElMessage.error(`批量上传完成：成功 ${success} 个，失败 ${failed} 个${skippedMsg}${permissionMsg}`);
  } else {
    ElMessage.success(`批量上传成功：成功导入 ${success} 个资源${skippedMsg}${permissionMsg}`);
  }
  emit('imported');
  emit('update:modelValue', false);
  reset();
}

async function handleImport(): Promise<void> {
  if (files.value.length === 0) return;
  if (!fileTypesWithUpload.includes(submitType.value)) return;
  let existing: ResourceLibraryItem[] = [];
  try {
    existing = await previewImport(files.value.map((f) => f.name));
  } catch {
    /* 重名校验失败时按普通导入执行，容忍小概率异常 */
  }
  if (existing.length > 0) {
    duplicateItems.value = existing;
    duplicateOpen.value = true;
    return;
  }
  await runImport('skip', []);
}

async function confirmDuplicate(mode: 'skip' | 'overwrite' | 'new'): Promise<void> {
  duplicateOpen.value = false;
  await runImport(mode, duplicateItems.value || []);
}
</script>

<style scoped>
.desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #94a3b8;
}
.type-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.type-label {
  font-size: 13px;
  color: #334155;
  flex-shrink: 0;
}
.drop-zone {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.drop-zone:hover {
  border-color: #409eff;
  background: #f9fafb;
}
.drop-zone.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.drop-icon {
  font-size: 24px;
  color: #9ca3af;
  margin-bottom: 8px;
}
.drop-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}
.drop-sub {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
  word-break: break-word;
}
.hidden-input {
  display: none;
}
.file-list {
  margin-top: 12px;
  max-height: 200px;
  overflow-y: auto;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  background: #f8fafc;
  margin-bottom: 6px;
}
.file-name {
  flex: 1;
  font-size: 13px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-size {
  font-size: 12px;
  color: #9ca3af;
}
.uploading-hint {
  font-size: 13px;
  color: #6b7280;
}
.dup-list {
  max-height: 200px;
  overflow-y: auto;
  margin-top: 8px;
}
.dup-item {
  padding: 6px 8px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
  color: #374151;
}
</style>

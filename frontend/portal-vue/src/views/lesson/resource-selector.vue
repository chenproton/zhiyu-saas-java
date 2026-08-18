<template>
  <div class="resource-selector">
    <!-- 已选标签 -->
    <div v-if="selectedResources.length > 0" class="selected-tags">
      <el-tag
        v-for="r in selectedResources"
        :key="r.id"
        type="primary"
        effect="plain"
        closable
        class="res-tag"
        @close="toggleResource(r.id)"
      >
        {{ r.name }}
      </el-tag>
    </div>

    <el-button plain class="add-btn" @click="openDialog">
      <el-icon><Plus /></el-icon>
      添加课程资源
    </el-button>

    <!-- 选择对话框 -->
    <el-dialog v-model="dialogOpen" title="添加课程资源" width="1000px" top="6vh" append-to-body destroy-on-close>
      <div class="selector-body">
        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="type-chips">
            <el-button
              v-for="t in allTypes"
              :key="t"
              size="small"
              :type="resType === t ? 'primary' : 'default'"
              :plain="resType !== t"
              class="type-chip"
              @click="resType = t"
            >
              {{ typeLabel(t) }}
            </el-button>
          </div>
          <div class="toolbar-row">
            <el-input v-model="resSearchName" placeholder="搜索资源名称..." clearable class="toolbar-input">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-input v-model="resSearchProvider" placeholder="搜索资源提供者..." clearable class="toolbar-input">
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
            <el-button size="small" @click="resetFilters">
              <el-icon><RefreshRight /></el-icon> 重置
            </el-button>
            <el-button size="small" type="primary" @click="openTypePicker">
              <el-icon><Upload /></el-icon> 上传资源
            </el-button>
          </div>
        </div>

        <div class="content">
          <!-- 左：资源卡片 -->
          <div class="res-list">
            <div class="res-list-head">
              <span>资源列表 ({{ filteredRes.length }})</span>
              <el-icon v-if="loadingPool" class="is-loading"><Loading /></el-icon>
            </div>
            <div class="res-grid">
              <el-empty v-if="filteredRes.length === 0" description="未找到匹配的资源" :image-size="64" />
              <div
                v-for="r in filteredRes"
                :key="r.id"
                class="res-card"
                :class="{ selected: selectedIds.includes(r.id) }"
                @click="toggleResource(r.id)"
              >
                <div class="res-thumb">
                  <img v-if="r.thumbnail && r.type === 'image'" :src="r.thumbnail" :alt="r.name" class="res-img" />
                  <div v-else class="res-thumb-icon">
                    <el-icon :size="22" :color="typeColor(r.type)"><component :is="typeIcon(r.type)" /></el-icon>
                  </div>
                  <el-icon v-if="selectedIds.includes(r.id)" class="res-checked" color="#fff" :size="14">
                    <CircleCheckFilled />
                  </el-icon>
                  <el-tag size="small" class="res-type-badge" disable-transitions>{{ typeShortLabel(r.type) }}</el-tag>
                </div>
                <div class="res-info">
                  <p class="res-name" :title="r.name">{{ r.name }}</p>
                  <p class="res-provider">{{ r.uploadedBy || '-' }}</p>
                </div>
                <div class="res-actions">
                  <el-button v-if="r.url" link type="primary" size="small" @click.stop="previewResource(r)">预览</el-button>
                  <el-button
                    link
                    :type="selectedIds.includes(r.id) ? 'info' : 'primary'"
                    size="small"
                    @click.stop="toggleResource(r.id)"
                  >
                    {{ selectedIds.includes(r.id) ? '已选择' : '选择' }}
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 右：已选资源 -->
          <div class="selected-panel">
            <div class="selected-head">
              <span class="selected-title">已选资源</span>
              <el-tag size="small" type="info" disable-transitions>{{ selectedIds.length }}</el-tag>
            </div>
            <div class="selected-list">
              <el-empty v-if="selectedIds.length === 0" description="请从左侧选择资源" :image-size="48" />
              <div v-for="rid in selectedIds" :key="rid" class="selected-item">
                <div class="selected-icon">
                  <el-icon :size="16" :color="typeColor(typeOf(rid))"><component :is="typeIcon(typeOf(rid))" /></el-icon>
                </div>
                <span class="selected-name" :title="nameOf(rid)">{{ nameOf(rid) }}</span>
                <el-icon class="selected-close" @click="toggleResource(rid)"><Close /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="dialogOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 上传类型选择 -->
    <el-dialog v-model="showUploadTypePicker" title="选择资源类型" width="520px" append-to-body>
      <div class="type-picker-grid">
        <div
          v-for="t in uploadTypes"
          :key="t"
          class="type-picker-item"
          @click="pickUploadType(t)"
        >
          <div class="type-picker-icon">
            <el-icon :size="20" :color="typeColor(t)"><component :is="typeIcon(t)" /></el-icon>
          </div>
          <span class="type-picker-label">{{ typeShortLabel(t) }}</span>
        </div>
      </div>
    </el-dialog>

    <!-- 上传资源 -->
    <el-dialog v-model="showUpload" title="上传资源" width="520px" append-to-body destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="资源名称" required>
          <el-input v-model="newResName" placeholder="输入资源名称" />
        </el-form-item>
        <template v-if="newResType === 'link'">
          <el-form-item label="URL 地址" required>
            <el-input v-model="newResUrl" placeholder="https://..." />
          </el-form-item>
        </template>
        <template v-else-if="newResType === 'venue'">
          <el-form-item label="场地地址">
            <el-input v-model="newResAddress" placeholder="输入场地详细地址" />
          </el-form-item>
          <el-form-item label="开放时间">
            <el-input v-model="newResOpenTime" placeholder="例如：周一至周五 09:00-18:00" />
          </el-form-item>
          <el-form-item label="容纳人数">
            <el-input v-model="newResCapacity" placeholder="例如：50人" />
          </el-form-item>
          <el-form-item label="联系人/电话">
            <el-input v-model="newResContact" placeholder="输入联系人或电话" />
          </el-form-item>
        </template>
        <template v-else-if="newResType === 'facility'">
          <el-form-item label="所在位置">
            <el-input v-model="newResLocation" placeholder="输入设施所在位置" />
          </el-form-item>
          <el-form-item label="数量">
            <el-input v-model="newResQuantity" placeholder="输入设施数量" />
          </el-form-item>
          <el-form-item label="联系人/电话">
            <el-input v-model="newResContact" placeholder="输入联系人或电话" />
          </el-form-item>
        </template>
        <template v-else-if="newResType === 'software'">
          <el-form-item label="版本号">
            <el-input v-model="newResVersion" placeholder="例如：v2.1.0" />
          </el-form-item>
          <el-form-item label="下载链接">
            <el-input v-model="newResUrl" placeholder="https://..." />
          </el-form-item>
          <el-form-item label="授权信息">
            <el-input v-model="newResLicense" placeholder="例如：MIT / 商业授权 / 校内授权" />
          </el-form-item>
        </template>
        <el-form-item label="资源描述">
          <el-input v-model="newResDescription" type="textarea" :rows="2" placeholder="输入资源简介、用途说明等" />
        </el-form-item>
        <el-form-item v-if="fileTypesWithUpload.includes(newResType)" label="文件">
          <div class="drop-zone" :class="{ uploading: newResUploading }" @click="!newResUploading && fileInput?.click()" @dragover.prevent @drop.prevent="onFileDrop">
            <input ref="fileInput" type="file" :accept="acceptFor(newResType)" class="hidden-input" @change="onFileChange" />
            <template v-if="newResFile">
              <div class="file-picked">
                <el-icon :size="24" color="#409eff"><Document /></el-icon>
                <p class="file-name">{{ newResFile.name }}</p>
                <p class="file-size">{{ formatSize(newResFile.size) }}</p>
              </div>
            </template>
            <template v-else>
              <el-icon :size="24" color="#c0c4cc"><UploadFilled v-if="!newResUploading" /><Loading v-else class="is-loading" /></el-icon>
              <p class="drop-title">{{ newResUploading ? '上传中...' : '点击或拖拽上传文件' }}</p>
              <p class="drop-sub">
                {{ acceptFor(newResType) ? `支持 ${acceptFor(newResType)}，最大 10MB` : '支持多种格式，最大 10MB' }}
              </p>
            </template>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelUpload">取消</el-button>
        <el-button type="primary" :loading="newResUploading" :disabled="!canSubmitUpload" @click="handleUpload">
          上传并选中
        </el-button>
      </template>
    </el-dialog>

    <!-- 预览 -->
    <el-dialog v-model="previewOpen" :title="previewRes?.name || '资源预览'" width="70%" top="6vh" append-to-body destroy-on-close>
      <div class="preview-body">
        <img v-if="previewRes?.type === 'image' && previewRes.url" :src="previewRes.url" class="preview-img" :alt="previewRes.name" />
        <iframe v-else-if="previewRes?.url" :src="previewRes.url" class="preview-frame" :title="previewRes.name" />
        <div v-else class="no-file">暂无文件</div>
      </div>
      <template #footer>
        <el-button @click="previewOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '@/api/http';
import { resourceLibraryApi } from '@/api/library';
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_SHORT_LABELS, type ResourceKind } from '@/types/library';
import { fileApi } from '@/api/import-export';
import { fetchAllPages, type ResourceItem } from './lesson-edit-utils';

const props = withDefaults(
  defineProps<{
    pool?: ResourceItem[];
    selectedIds: string[];
    courseId?: string;
    nodeId?: string;
  }>(),
  { pool: () => [], courseId: '', nodeId: '' }
);

const emit = defineEmits<{
  (e: 'change', ids: string[]): void;
  (e: 'upload', resource: ResourceItem): void;
}>();

const allTypes = ['all', ...Object.keys(RESOURCE_TYPE_LABELS)];
const uploadTypes = allTypes.filter((t) => t !== 'all');

const fileTypesWithUpload = [
  'document',
  'spreadsheet',
  'image',
  'audio',
  'video',
  'archive',
  'other',
  'software'
];

const EXTS: Record<string, string[]> = {
  document: ['doc', 'docx', 'pdf', 'txt', 'md', 'ppt', 'pptx'],
  spreadsheet: ['xls', 'xlsx', 'csv'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
  video: ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'webm'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz'],
  software: ['exe', 'msi', 'apk', 'dmg', 'sh', 'run']
};

const ACCEPT: Record<string, string> = {
  document: '.doc,.docx,.pdf,.txt,.md,.ppt,.pptx',
  spreadsheet: '.xls,.xlsx,.csv',
  image: 'image/*',
  audio: '.mp3,.wav,.ogg,.m4a,.aac,.flac',
  video: '.mp4,.avi,.mov,.wmv,.mkv,.flv,.webm',
  archive: '.zip,.rar,.7z,.tar,.gz',
  software: '.exe,.msi,.apk,.dmg,.sh,.run'
};

function acceptFor(type: string): string {
  return ACCEPT[type] || '';
}

function typeShortLabel(t: string): string {
  return RESOURCE_TYPE_SHORT_LABELS[t] || t;
}
function typeLabel(t: string): string {
  return RESOURCE_TYPE_SHORT_LABELS[t] || t;
}

const TYPE_COLORS: Record<string, string> = {
  document: '#409eff',
  spreadsheet: '#67c23a',
  image: '#e6a23c',
  link: '#909399',
  audio: '#f56c6c',
  video: '#9c27b0',
  archive: '#795548',
  venue: '#ff9800',
  facility: '#00bcd4',
  software: '#3f51b5',
  other: '#607d8b'
};

function typeColor(t: string): string {
  return TYPE_COLORS[t] || '#909399';
}

function typeIcon(t: string): string {
  switch (t) {
    case 'document':
      return 'Document';
    case 'spreadsheet':
      return 'Grid';
    case 'image':
      return 'Picture';
    case 'link':
      return 'Link';
    case 'audio':
      return 'Headset';
    case 'video':
      return 'VideoCamera';
    case 'archive':
      return 'Box';
    case 'venue':
      return 'OfficeBuilding';
    case 'facility':
      return 'SetUp';
    case 'software':
      return 'Monitor';
    default:
      return 'Folder';
  }
}

function formatSize(size?: string | number): string {
  const n = Number(size);
  if (!n || Number.isNaN(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- 池加载 ---------- */

const dialogOpen = ref(false);
const internalPool = ref<ResourceItem[]>([]);
const loadingPool = ref(false);

const effectiveNodeId = computed(() =>
  props.nodeId && !props.nodeId.startsWith('node-') ? props.nodeId : undefined
);
const courseScope = computed(() => !!props.courseId && !effectiveNodeId.value);
const useApi = computed(() => !!props.courseId || !!effectiveNodeId.value);

const mergedPool = computed<ResourceItem[]>(() => {
  const map = new Map<string, ResourceItem>();
  internalPool.value.forEach((r) => map.set(r.id, r));
  (props.pool || []).forEach((r) => {
    if (!map.has(r.id)) map.set(r.id, r);
  });
  return Array.from(map.values());
});

async function loadResources() {
  if (!useApi.value) return;
  loadingPool.value = true;
  try {
    const items = await fetchAllPages(({ limit, offset }) =>
      resourceLibraryApi.list({ limit, offset })
    );
    internalPool.value = items.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.resourceType || r.type,
      url: r.url,
      description: r.description,
      size: r.fileSize ?? r.size,
      uploadedBy: r.uploadedBy,
      uploadedAt: r.createdAt,
      thumbnail: r.thumbnail
    }));
  } catch (e) {
    ElMessage.error((e as Error).message || '加载资源库失败');
  } finally {
    loadingPool.value = false;
  }
}

function openDialog() {
  dialogOpen.value = true;
  if (useApi.value) void loadResources();
}

/* ---------- 筛选 ---------- */

const resType = ref('all');
const resSearchName = ref('');
const resSearchProvider = ref('');

const filteredRes = computed(() =>
  mergedPool.value.filter((r) => {
    const matchType = resType.value === 'all' || r.type === resType.value;
    const matchName = !resSearchName.value || r.name.includes(resSearchName.value);
    const matchProvider = !resSearchProvider.value || (r.uploadedBy || '').includes(resSearchProvider.value);
    return matchType && matchName && matchProvider;
  })
);

function resetFilters() {
  resType.value = 'all';
  resSearchName.value = '';
  resSearchProvider.value = '';
}

/* ---------- 选中 ---------- */

function toggleResource(rid: string) {
  const selected = props.selectedIds.includes(rid);
  emit('change', selected ? props.selectedIds.filter((id) => id !== rid) : [...props.selectedIds, rid]);
}

const selectedResources = computed(() =>
  props.selectedIds
    .map((id) => mergedPool.value.find((r) => r.id === id))
    .filter((r): r is ResourceItem => !!r)
);

function nameOf(rid: string): string {
  return mergedPool.value.find((r) => r.id === rid)?.name || rid;
}
function typeOf(rid: string): string {
  return mergedPool.value.find((r) => r.id === rid)?.type || 'other';
}

/* ---------- 上传 ---------- */

const showUploadTypePicker = ref(false);
const showUpload = ref(false);
const newResName = ref('');
const newResType = ref('document');
const newResUrl = ref('');
const newResDescription = ref('');
const newResAddress = ref('');
const newResOpenTime = ref('');
const newResCapacity = ref('');
const newResContact = ref('');
const newResLocation = ref('');
const newResQuantity = ref('');
const newResVersion = ref('');
const newResLicense = ref('');
const newResFile = ref<File | null>(null);
const newResUploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function pickUploadType(t: string) {
  newResType.value = t;
  showUploadTypePicker.value = false;
  showUpload.value = true;
}

function openTypePicker() {
  showUploadTypePicker.value = true;
}

function resetUploadForm() {
  newResName.value = '';
  newResType.value = 'document';
  newResUrl.value = '';
  newResDescription.value = '';
  newResAddress.value = '';
  newResOpenTime.value = '';
  newResCapacity.value = '';
  newResContact.value = '';
  newResLocation.value = '';
  newResQuantity.value = '';
  newResVersion.value = '';
  newResLicense.value = '';
  newResFile.value = null;
  newResUploading.value = false;
}

function cancelUpload() {
  showUpload.value = false;
  resetUploadForm();
}

function inferTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  for (const [type, exts] of Object.entries(EXTS)) {
    if (exts.includes(ext)) return type;
  }
  return 'other';
}

function validateResourceFile(file: File): string | null {
  if (file.size > 10 * 1024 * 1024) return '文件大小超过 10MB';
  const allowed = EXTS[newResType.value] || [];
  if (allowed.length === 0) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowed.includes(ext)) {
    return `不支持的文件格式，请上传 ${allowed.map((e) => `.${e}`).join('、')} 文件`;
  }
  return null;
}

function handleFileSelect(file: File) {
  const err = validateResourceFile(file);
  if (err) {
    ElMessage.error(err);
    return;
  }
  newResFile.value = file;
  newResName.value = file.name;
  newResType.value = inferTypeFromName(file.name);
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) handleFileSelect(file);
  input.value = '';
}

function onFileDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFileSelect(file);
}

const canSubmitUpload = computed(() => {
  if (!newResName.value.trim()) return false;
  if (newResType.value === 'link' && !newResUrl.value.trim()) return false;
  if (fileTypesWithUpload.includes(newResType.value) && !newResFile.value && !newResUrl.value.trim()) {
    return false;
  }
  return true;
});

async function handleUpload() {
  if (!newResName.value.trim()) return;
  const isFileType = fileTypesWithUpload.includes(newResType.value);
  let fileUrl = newResUrl.value.trim();
  let uploadedSize: number | undefined;

  if (isFileType && newResFile.value) {
    newResUploading.value = true;
    try {
      const res = await fileApi.upload(newResFile.value);
      fileUrl = res.url;
      uploadedSize = res.size;
    } catch (e) {
      ElMessage.error((e as Error).message || '上传失败');
      newResUploading.value = false;
      return;
    }
  }

  if (newResType.value === 'link' && !fileUrl) {
    ElMessage.error('请填写链接地址');
    return;
  }

  const localId = `res-${Date.now()}`;
  const newRes: ResourceItem = {
    id: localId,
    name: newResName.value.trim(),
    type: newResType.value,
    url: fileUrl,
    description: newResDescription.value,
    uploadedBy: '当前用户',
    uploadedAt: new Date().toISOString().slice(0, 10),
    size: uploadedSize
  };

  if (useApi.value) {
    let createdId: string | undefined;
    try {
      const meta: Record<string, any> = {};
      if (newRes.type === 'venue') {
        if (newResAddress.value) meta.address = newResAddress.value;
        if (newResOpenTime.value) meta.openTime = newResOpenTime.value;
        if (newResCapacity.value) meta.capacity = newResCapacity.value;
        if (newResContact.value) meta.contact = newResContact.value;
      } else if (newRes.type === 'facility') {
        if (newResLocation.value) meta.location = newResLocation.value;
        if (newResContact.value) meta.contact = newResContact.value;
        if (newResQuantity.value) meta.quantity = newResQuantity.value;
      } else if (newRes.type === 'software') {
        if (newResVersion.value) meta.version = newResVersion.value;
        if (newResContact.value) meta.contact = newResContact.value;
      }
      const created = await resourceLibraryApi.create({
        name: newRes.name,
        resourceType: newRes.type as ResourceKind,
        url: fileUrl || undefined,
        description: newResDescription.value || undefined,
        fileSize: uploadedSize,
        metadata: Object.keys(meta).length > 0 ? meta : undefined
      } as any);
      createdId = created.id;
      newRes.id = created.id;
      newRes.url = created.url || newRes.url;
      internalPool.value = [newRes, ...internalPool.value];

      if (courseScope.value && props.courseId) {
        await request<{ id: string }>('/lesson/course-resources', {
          method: 'POST',
          body: JSON.stringify({ courseId: props.courseId, resourceId: created.id })
        });
      } else if (effectiveNodeId.value) {
        await request<{ id: string }>('/lesson/node-resources', {
          method: 'POST',
          body: JSON.stringify({ nodeId: effectiveNodeId.value, resourceId: created.id })
        });
      }
    } catch (e) {
      if (createdId) {
        ElMessage.error('资源已创建但绑定失败：资源已保存到资源库，请重试或手动关联');
      } else {
        ElMessage.error((e as Error).message || '资源保存失败');
      }
      newResUploading.value = false;
      return;
    }
  }

  emit('upload', newRes);
  emit('change', [...props.selectedIds, newRes.id]);
  resetUploadForm();
  showUpload.value = false;
  showUploadTypePicker.value = false;
  ElMessage.success('资源已上传并选中');
}

/* ---------- 预览 ---------- */

const previewOpen = ref(false);
const previewRes = ref<ResourceItem | null>(null);

function previewResource(r: ResourceItem) {
  previewRes.value = r;
  previewOpen.value = true;
}
</script>

<style scoped>
.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.res-tag {
  font-weight: normal;
  background: #ecf5ff;
  border-color: #d9ecff;
  color: #409eff;
}
.add-btn {
  width: 100%;
  border-style: dashed;
}
.selector-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 420px;
}
.toolbar {
  flex-shrink: 0;
}
.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.type-chip {
  font-size: 12px;
}
.toolbar-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.toolbar-input {
  flex: 1;
}
.content {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.res-list {
  flex: 1;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.res-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
}
.res-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  align-content: start;
}
.res-card {
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}
.res-card:hover {
  border-color: #a0cfff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.res-card.selected {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.2);
}
.res-thumb {
  position: relative;
  height: 76px;
  background: #f5f7fa;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.res-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  inset: 0;
}
.res-thumb-icon {
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
}
.res-checked {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #409eff;
  border-radius: 50%;
}
.res-type-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  transform: scale(0.85);
  transform-origin: bottom left;
}
.res-info {
  padding: 8px 10px 4px;
}
.res-name {
  font-size: 12px;
  font-weight: 500;
  color: #303133;
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.res-provider {
  font-size: 10px;
  color: #c0c4cc;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.res-actions {
  display: flex;
  padding: 0 8px 8px;
  gap: 4px;
}
.selected-panel {
  width: 220px;
  flex-shrink: 0;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 12px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
}
.selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.selected-title {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}
.selected-list {
  flex: 1;
  overflow-y: auto;
}
.selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #d9ecff;
  border-radius: 8px;
  background: #fff;
  margin-bottom: 8px;
}
.selected-icon {
  width: 32px;
  height: 32px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #f5f7fa;
}
.selected-name {
  flex: 1;
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-close {
  color: #c0c4cc;
  cursor: pointer;
  flex-shrink: 0;
}
.selected-close:hover {
  color: #f56c6c;
}
.type-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 8px 0;
}
.type-picker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.type-picker-item:hover {
  border-color: #409eff;
  background: #ecf5ff;
}
.type-picker-icon {
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
}
.type-picker-label {
  font-size: 12px;
  color: #606266;
}
.drop-zone {
  width: 100%;
  border: 2px dashed #e4e7ed;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}
.drop-zone:hover {
  border-color: #a0cfff;
  background: #fafcff;
}
.drop-zone.uploading {
  border-color: #a0cfff;
}
.hidden-input {
  display: none;
}
.file-picked {
  text-align: center;
}
.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin: 8px 0 4px;
}
.file-size {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
.drop-title {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin: 8px 0 4px;
}
.drop-sub {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
.preview-body {
  height: 60vh;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #f5f7fa;
  overflow: hidden;
}
.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
}
.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.no-file {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}
</style>

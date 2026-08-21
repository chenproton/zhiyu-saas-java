<template>
  <div class="resources-page">
    <!-- 总览视图：类型统计卡片 -->
    <div v-if="!isTypeView" class="stat-grid">
      <div v-for="[type, count] in typeStatCards" :key="type" class="stat-card">
        <div class="stat-icon" :style="{ backgroundColor: TYPE_BG[type] || '#f8fafc', color: TYPE_COLORS[type] || '#78716c' }">
          <span class="stat-dot" :style="{ backgroundColor: TYPE_COLORS[type] || '#78716c' }" />
        </div>
        <div>
          <div class="stat-count">{{ count }}</div>
          <div class="stat-name">{{ typeLabel(type) }}</div>
        </div>
      </div>
    </div>

    <!-- 引用统计 / 零引用 -->
    <CitationStatsPanel
      entity-label="资源"
      dialog-title="零引用资源"
      :stat-count="total"
      :stat-label="isTypeView ? `${resourceTypeLabel}总数` : '资源总数'"
      :fetch-stats="fetchStats"
      :fetch-uncited="fetchUncited"
      :delete-item="deleteItem"
      @deleted="loadItems"
    />

    <!-- 总览视图：类型筛选 -->
    <div v-if="!isTypeView" class="filter-bar">
      <span class="filter-label">类型筛选：</span>
      <el-button
        v-for="type in allTypes"
        :key="type"
        size="small"
        round
        :type="filterType === type ? 'primary' : 'default'"
        :style="filterType === type ? { backgroundColor: TYPE_COLORS[type], borderColor: TYPE_COLORS[type] } : {}"
        @click="toggleType(type)"
      >
        {{ typeLabel(type) }}
        <span class="chip-count">{{ typeCounts[type] || 0 }}</span>
        <span v-if="filterType === type" class="chip-close">✕</span>
      </el-button>
      <el-button v-if="filterType || searchQuery" size="small" text type="danger" @click="clearFilter">清除筛选</el-button>
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ isTypeView ? resourceTypeLabel : '教学资源库' }}</span>
          <div class="header-actions">
            <el-button size="small" @click="batchOpen = true">批量上传</el-button>
            <el-button size="small" type="primary" @click="openAdd">新建资源</el-button>
          </div>
        </div>
      </template>

      <TagFilterBar :model-value="selectedTagIds" @update:model-value="onTagFilterChange" />

      <el-input
        v-model="searchQuery"
        :placeholder="isTypeView ? `搜索${resourceTypeLabel}...` : '搜索资源名称...'"
        clearable
        style="max-width: 320px; margin-bottom: 12px"
        @input="onSearch"
        @clear="onSearch"
      />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="资源" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="resource-cell">
              <span class="type-dot" :style="{ backgroundColor: TYPE_COLORS[row.resourceType] || '#78716c' }" />
              <span class="resource-name">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="!isTypeView" label="类型" width="130">
          <template #default="{ row }">
            <el-tag size="small" :color="TYPE_BG[row.resourceType] || '#f8fafc'" :style="{ color: TYPE_COLORS[row.resourceType] || '#78716c', borderColor: TYPE_COLORS[row.resourceType] || '#78716c' }">
              {{ typeLabel(row.resourceType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="链接" width="90">
          <template #default="{ row }">
            <a v-if="row.url && isSafeLinkUrl(row.url)" :href="row.url" target="_blank" rel="noreferrer">访问</a>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ formatSize(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column label="描述" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="标签" min-width="140">
          <template #default="{ row }">
            <TagBadge v-for="t in tagsByResource[row.id] || []" :key="t.id" :tag="t" class="cell-tag" />
            <span v-if="!(tagsByResource[row.id] || []).length" class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.url && fileTypesWithUpload.includes(row.resourceType)"
              size="small"
              link
              title="预览"
              @click="openPreview(row)"
            >
              预览
            </el-button>
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="setDeleteTarget(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="totalPages > 1"
        v-model:current-page="page"
        :page-size="PAGE_SIZE"
        :total="total"
        layout="prev, pager, next, total"
        class="pagination"
        @current-change="loadItems"
      />
    </el-card>

    <!-- 批量上传 -->
    <ResourceBatchImportDialog
      v-model="batchOpen"
      :resource-type="resourceType"
      @imported="loadItems"
    />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogOpen" :title="dialogTitle" width="560px">
      <div class="dialog-desc">{{ dialogDesc }}</div>
      <el-form :model="form" label-width="80px">
        <el-form-item v-if="isTypeView" label="资源类型">
          <el-tag size="small" :color="TYPE_BG[resourceTypeKey] || '#f8fafc'" :style="{ color: TYPE_COLORS[resourceTypeKey] || '#78716c', borderColor: TYPE_COLORS[resourceTypeKey] || '#78716c' }">
            {{ resourceTypeLabel }}
          </el-tag>
        </el-form-item>
        <el-form-item label="资源名称" required>
          <el-input v-model="form.name" placeholder="输入资源名称" />
        </el-form-item>
        <el-form-item v-if="!isTypeView && !editingItem" label="资源类型">
          <el-select v-model="form.resourceType" style="width: 100%" @change="clearUploadFile">
            <el-option v-for="(label, key) in RESOURCE_TYPE_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="submitType === 'link'" label="URL 地址">
          <el-input v-model="form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="资源描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="输入资源简介、用途说明等" />
        </el-form-item>
        <el-form-item label="标签">
          <TagPicker v-model="form.tagIds" />
        </el-form-item>
        <el-form-item v-if="fileTypesWithUpload.includes(submitType)" label="文件">
          <div class="upload-zone" @click="uploadFileInputRef?.click()" @dragover.prevent @drop.prevent="onFileDrop">
            <input ref="uploadFileInputRef" type="file" :accept="resourceTypeAccept[submitType]" class="hidden-input" @change="onFileSelect" />
            <template v-if="uploadFile">
              <div class="upload-file">
                <span class="upload-file-name">{{ uploadFile.name }}</span>
                <span class="upload-file-size">{{ formatSize(uploadFile.size) }}</span>
              </div>
              <div class="upload-actions">
                <el-button size="small" @click.stop="uploadFileInputRef?.click()">重新选择</el-button>
                <el-button size="small" @click.stop="clearUploadFile">清除</el-button>
              </div>
            </template>
            <template v-else>
              <p class="upload-title">点击或拖拽上传文件</p>
              <p class="upload-sub">{{ acceptHint }}</p>
            </template>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ editingItem ? '保存' : '上传到资源库' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 预览弹窗 -->
    <ResourcePreviewDialog v-model="previewOpen" :resource="previewItem" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { resourceLibraryApi } from '@/api/library';
import { fileApi } from '@/api/import-export';
import { RESOURCE_TYPE_LABELS } from '@/types/library';
import type { ResourceKind, ResourceLibraryItem } from '@/types/library';
import { formatSize, isSafeLinkUrl } from '@/utils/format';
import CitationStatsPanel from './_components/CitationStatsPanel.vue';
import TagFilterBar from './_components/TagFilterBar.vue';
import TagPicker from './_components/TagPicker.vue';
import TagBadge from './_components/TagBadge.vue';
import ResourceBatchImportDialog from './_components/ResourceBatchImportDialog.vue';
import ResourcePreviewDialog from './_components/ResourcePreviewDialog.vue';
import { useLibraryCrud } from './_components/useLibraryCrud';
import { useTagBindings } from './_components/useTagBindings';
import { fileTypesWithUpload, resourceTypeAccept, validateResourceFile, TYPE_COLORS, TYPE_BG } from './_components/resource-types';
import type { CitationStats, UncitedItem } from './_components/types';

const route = useRoute();
const PAGE_SIZE = 200;
const TAG_RESOURCE_TYPE = 'resource_library';

const allTypes = Object.keys(RESOURCE_TYPE_LABELS) as ResourceKind[];

const resourceType = computed<ResourceKind | undefined>(() => {
  const t = route.params.type as string | undefined;
  return t && t in RESOURCE_TYPE_LABELS ? (t as ResourceKind) : undefined;
});
const isTypeView = computed(() => !!resourceType.value);
// 供模板索引/展示使用（类型视图下为 route 参数，总览视图回退 other）
const resourceTypeKey = computed<string>(() => resourceType.value || 'other');
const resourceTypeLabel = computed(() => typeLabel(resourceTypeKey.value));

function typeLabel(kind: string): string {
  return RESOURCE_TYPE_LABELS[kind as ResourceKind] || kind;
}

const selectedTagIds = ref<string[]>([]);
const filterType = ref<ResourceKind | null>(null);
const typeCounts = ref<Record<string, number>>({});
const { tagsByResource, loadBindings, saveTags } = useTagBindings(TAG_RESOURCE_TYPE);

const listResourceType = computed<ResourceKind | undefined>(() =>
  isTypeView.value ? resourceType.value : (filterType.value || undefined)
);

const { items, loading, searchQuery, loadItems, total, page, totalPages } = useLibraryCrud<ResourceLibraryItem>(
  resourceLibraryApi.list,
  {
    getParams: () => ({
      ...(listResourceType.value ? { resourceType: listResourceType.value } : {}),
      ...(selectedTagIds.value.length ? { tagIds: selectedTagIds.value.join(',') } : {})
    })
  }
);

const dialogOpen = ref(false);
const editingItem = ref<ResourceLibraryItem | null>(null);
const submitting = ref(false);
const batchOpen = ref(false);
const previewOpen = ref(false);
const previewItem = ref<ResourceLibraryItem | null>(null);
const deleteTarget = ref<string | null>(null);
const uploadFile = ref<File | null>(null);
const uploadFileInputRef = ref<HTMLInputElement | null>(null);
const form = reactive({ name: '', resourceType: 'document' as ResourceKind, url: '', description: '', tagIds: [] as string[] });

const submitType = computed<ResourceKind>(() =>
  isTypeView.value ? resourceType.value! : form.resourceType
);
const isFileType = computed(() => fileTypesWithUpload.includes(submitType.value));

const typeStatCards = computed(() => Object.entries(typeCounts.value).slice(0, 5));
const acceptHint = computed(() => {
  const accept = resourceTypeAccept[submitType.value];
  return accept ? `支持 ${accept}，最大 10MB` : '支持多种格式，最大 10MB';
});

const dialogTitle = computed(() =>
  editingItem.value ? '编辑资源' : isTypeView.value ? '新增资源' : '上传资源到公共库'
);
const dialogDesc = computed(() =>
  editingItem.value
    ? '编辑资源信息'
    : isTypeView.value
      ? `上传本地资源到${typeLabel(resourceType.value!)}`
      : '补充本地资源，上传后将加入资源公共库'
);

async function loadTypeCounts(): Promise<void> {
  if (isTypeView.value) return;
  try {
    const res = await resourceLibraryApi.stats({ ...(searchQuery.value ? { search: searchQuery.value } : {}) });
    const counts: Record<string, number> = {};
    for (const c of res.items || []) counts[c.resourceType] = c.count;
    typeCounts.value = counts;
  } catch {
    typeCounts.value = {};
  }
}

function onSearch(): void {
  page.value = 1;
  void loadItems();
  void loadTypeCounts();
}

function clearSearch(): void {
  searchQuery.value = '';
  page.value = 1;
  void loadItems();
  void loadTypeCounts();
}

function onTagFilterChange(ids: string[]): void {
  selectedTagIds.value = ids;
  page.value = 1;
  void loadItems();
}

function toggleType(type: ResourceKind): void {
  filterType.value = filterType.value === type ? null : type;
  page.value = 1;
  void loadItems();
}

function clearFilter(): void {
  filterType.value = null;
  searchQuery.value = '';
  page.value = 1;
  void loadItems();
  void loadTypeCounts();
}

function resetForm(): void {
  form.name = '';
  form.resourceType = isTypeView.value ? resourceType.value! : 'document';
  form.url = '';
  form.description = '';
  form.tagIds = [];
  uploadFile.value = null;
}

function openAdd(): void {
  editingItem.value = null;
  resetForm();
  dialogOpen.value = true;
}

function openEdit(item: ResourceLibraryItem): void {
  editingItem.value = item;
  form.name = item.name;
  form.resourceType = item.resourceType;
  form.url = item.url || '';
  form.description = item.description || '';
  form.tagIds = (tagsByResource.value[item.id] || []).map((t) => t.id);
  uploadFile.value = null;
  dialogOpen.value = true;
}

function openPreview(item: ResourceLibraryItem): void {
  previewItem.value = item;
  previewOpen.value = true;
}

function setDeleteTarget(id: string): void {
  deleteTarget.value = id;
}

function clearUploadFile(): void {
  uploadFile.value = null;
}

function onFileDrop(e: DragEvent): void {
  const file = e.dataTransfer?.files?.[0];
  if (file && fileTypesWithUpload.includes(submitType.value)) {
    const err = validateResourceFile(file, submitType.value);
    if (err) ElMessage.error(err);
    else uploadFile.value = file;
  }
}

function onFileSelect(e: Event): void {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    const err = validateResourceFile(file, submitType.value);
    if (err) ElMessage.error(err);
    else uploadFile.value = file;
  }
  target.value = '';
}

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  submitting.value = true;
  try {
    let finalUrl = form.url.trim();
    let finalSize: number | undefined = editingItem.value?.fileSize;
    if (isFileType.value && uploadFile.value) {
      const up = await fileApi.upload(uploadFile.value);
      finalUrl = up.url;
      finalSize = up.size;
    }
    const payload = {
      name: form.name.trim(),
      resourceType: submitType.value,
      url: finalUrl || undefined,
      description: form.description.trim() || undefined,
      thumbnail: submitType.value === 'image' ? finalUrl || undefined : undefined,
      fileSize: finalSize
    };
    let targetId = editingItem.value?.id;
    if (editingItem.value) {
      await resourceLibraryApi.update(editingItem.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      const created = await resourceLibraryApi.create(payload);
      targetId = created.id;
      ElMessage.success('创建成功');
    }
    if (targetId) {
      try {
        await saveTags(targetId, form.tagIds);
      } catch {
        ElMessage.warning('标签保存失败：实体已保存，标签未关联，可再次保存重试');
      }
    }
    dialogOpen.value = false;
    void loadItems();
    void loadTypeCounts();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return;
  try {
    await ElMessageBox.confirm('确定要删除该资源吗？此操作不可恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await resourceLibraryApi.delete(deleteTarget.value);
    ElMessage.success('删除成功');
    void loadItems();
    void loadTypeCounts();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  } finally {
    deleteTarget.value = null;
  }
}

// 引用统计 / 零引用列表：Vue api/library.ts 未提供，直连 React 同款后端端点
async function fetchStats(): Promise<CitationStats> {
  return request<CitationStats>(
    `/library/resources/citation-stats${buildQuery(resourceType.value ? { resourceType: resourceType.value } : {})}`
  );
}

async function fetchUncited(params: {
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}): Promise<ListResponse<UncitedItem>> {
  return request<ListResponse<UncitedItem>>(
    `/library/resources/uncited${buildQuery({
      ...params,
      ...(resourceType.value ? { resourceType: resourceType.value } : {})
    })}`
  );
}

async function deleteItem(id: string): Promise<unknown> {
  return resourceLibraryApi.delete(id);
}

watch(items, (v) => {
  if (v.length) void loadBindings(v);
});

watch(searchQuery, () => {
  void loadTypeCounts();
});

onMounted(() => {
  void loadItems();
  void loadTypeCounts();
});
</script>

<style scoped>
.resources-page {
  padding: 16px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #f1f5f9;
}
.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.stat-count {
  font-size: 20px;
  font-weight: 700;
  color: #334155;
  line-height: 1;
}
.stat-name {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  background: #fff;
}
.filter-label {
  font-size: 13px;
  color: #94a3b8;
  margin-right: 4px;
  flex-shrink: 0;
}
.chip-count {
  margin-left: 4px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.chip-close {
  margin-left: 2px;
  font-size: 11px;
}
.resource-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.resource-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-tag {
  margin-right: 4px;
}
.muted {
  color: #cbd5e1;
  font-size: 12px;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
.dialog-desc {
  margin: -8px 0 12px;
  font-size: 13px;
  color: #94a3b8;
}
.upload-zone {
  width: 100%;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.upload-zone:hover {
  border-color: #409eff;
  background: #f9fafb;
}
.hidden-input {
  display: none;
}
.upload-file {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}
.upload-file-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}
.upload-file-size {
  font-size: 12px;
  color: #9ca3af;
}
.upload-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}
.upload-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}
.upload-sub {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}
</style>

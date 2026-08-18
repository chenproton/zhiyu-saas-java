<template>
  <div class="library-page">
    <CitationStatsPanel
      entity-label="证书"
      dialog-title="零引用证书"
      :stat-count="total"
      stat-label="证书总数"
      :fetch-stats="fetchStats"
      :fetch-uncited="fetchUncited"
      :delete-item="deleteItem"
      @deleted="loadItems"
    />

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">岗位证书库</span>
          <el-button type="primary" @click="openAdd">新建证书</el-button>
        </div>
      </template>

      <div class="search-row">
        <el-input v-model="searchQuery" placeholder="搜索证书..." clearable style="max-width: 320px" @input="onSearch" @clear="onSearch" />
        <el-button v-if="searchQuery" text type="danger" @click="clearSearch">清除</el-button>
      </div>

      <TagFilterBar :model-value="selectedTagIds" @update:model-value="onTagFilterChange" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="链接" width="90">
          <template #default="{ row }">
            <a v-if="row.url && isSafeLinkUrl(row.url)" :href="row.url" target="_blank" rel="noreferrer">访问</a>
            <span v-else>-</span>
          </template>
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
        <el-table-column label="创建时间" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogOpen" :title="editingItem ? '编辑证书' : '新增证书'" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="证书名称" />
        </el-form-item>
        <el-form-item label="证书封面">
          <div class="cover-wrap">
            <div v-if="form.imageUrl" class="cover-preview">
              <el-image :src="form.imageUrl" fit="cover" class="cover-img" />
              <div class="cover-actions">
                <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" :disabled="imageUploading" @change="onCoverChange">
                  <el-button size="small" :loading="imageUploading">更换封面</el-button>
                </el-upload>
                <el-button size="small" :disabled="imageUploading" @click="removeCover">移除封面</el-button>
              </div>
            </div>
            <el-upload v-else :auto-upload="false" :show-file-list="false" accept="image/*" :disabled="imageUploading" @change="onCoverChange">
              <div class="cover-empty">
                <span>{{ imageUploading ? '上传中...' : '点击上传证书封面' }}</span>
              </div>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="链接">
          <el-input v-model="form.url" placeholder="官方链接" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="简要描述" />
        </el-form-item>
        <el-form-item label="标签">
          <TagPicker v-model="form.tagIds" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { certificateLibraryApi } from '@/api/job';
import { fileApi } from '@/api/import-export';
import type { CertificateLibraryItem } from '@/types/job';
import { isSafeLinkUrl } from '@/utils/format';
import CitationStatsPanel from './_components/CitationStatsPanel.vue';
import TagFilterBar from './_components/TagFilterBar.vue';
import TagPicker from './_components/TagPicker.vue';
import TagBadge from './_components/TagBadge.vue';
import { useLibraryCrud } from './_components/useLibraryCrud';
import { useTagBindings } from './_components/useTagBindings';
import { formatDate } from './_components/format';
import type { CitationStats, UncitedItem } from './_components/types';

const PAGE_SIZE = 200;
const TAG_RESOURCE_TYPE = 'certificate_library';

const selectedTagIds = ref<string[]>([]);
const { tagsByResource, loadBindings, saveTags } = useTagBindings(TAG_RESOURCE_TYPE);

const { items, loading, searchQuery, loadItems, total, page, totalPages } = useLibraryCrud<CertificateLibraryItem>(
  certificateLibraryApi.list,
  { getParams: () => (selectedTagIds.value.length ? { tagIds: selectedTagIds.value.join(',') } : {}) }
);

const dialogOpen = ref(false);
const editingItem = ref<CertificateLibraryItem | null>(null);
const submitting = ref(false);
const imageUploading = ref(false);
const form = reactive({ name: '', url: '', description: '', imageUrl: '', tagIds: [] as string[] });

function onSearch(): void {
  page.value = 1;
  void loadItems();
}

function clearSearch(): void {
  searchQuery.value = '';
  page.value = 1;
  void loadItems();
}

function onTagFilterChange(ids: string[]): void {
  selectedTagIds.value = ids;
  page.value = 1;
  void loadItems();
}

function resetForm(): void {
  form.name = '';
  form.url = '';
  form.description = '';
  form.imageUrl = '';
  form.tagIds = [];
}

function openAdd(): void {
  editingItem.value = null;
  resetForm();
  dialogOpen.value = true;
}

function openEdit(item: CertificateLibraryItem): void {
  editingItem.value = item;
  form.name = item.name;
  form.url = item.url || '';
  form.description = item.description || '';
  form.imageUrl = item.imageUrl || '';
  form.tagIds = (tagsByResource.value[item.id] || []).map((t) => t.id);
  dialogOpen.value = true;
}

async function onCoverChange(uploadFile: UploadFile): Promise<void> {
  const f = uploadFile.raw;
  if (f) await handleImageUpload(f);
}

async function handleImageUpload(file: File): Promise<void> {
  imageUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    form.imageUrl = res.url;
    ElMessage.success('封面上传成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '上传失败');
  } finally {
    imageUploading.value = false;
  }
}

function removeCover(): void {
  form.imageUrl = '';
}

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      url: form.url.trim() || undefined,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined
    };
    let savedId: string;
    if (editingItem.value) {
      savedId = editingItem.value.id;
      await certificateLibraryApi.update(editingItem.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      const created = await certificateLibraryApi.create(payload);
      savedId = created.id;
      ElMessage.success('创建成功');
    }
    try {
      await saveTags(savedId, form.tagIds);
    } catch {
      ElMessage.warning('标签保存失败：实体已保存，标签未关联，可再次保存重试');
    }
    dialogOpen.value = false;
    void loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

async function confirmDelete(item: CertificateLibraryItem): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要删除该证书吗？此操作不可恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await certificateLibraryApi.delete(item.id);
    ElMessage.success('删除成功');
    void loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

// 引用统计 / 零引用列表：Vue api/job.ts 未提供，直连 React 同款后端端点
async function fetchStats(): Promise<CitationStats> {
  return request<CitationStats>('/job/certificate-library/citation-stats');
}

async function fetchUncited(params: {
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}): Promise<ListResponse<UncitedItem>> {
  return request<ListResponse<UncitedItem>>(`/job/certificate-library/uncited${buildQuery(params)}`);
}

async function deleteItem(id: string): Promise<unknown> {
  return certificateLibraryApi.delete(id);
}

watch(items, (v) => {
  if (v.length) void loadBindings(v);
});

onMounted(() => {
  void loadItems();
});
</script>

<style scoped>
.library-page {
  padding: 16px;
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
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
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
.cover-wrap {
  width: 100%;
}
.cover-preview {
  position: relative;
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.cover-img {
  width: 100%;
  height: 160px;
  display: block;
}
.cover-actions {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #f8fafc;
}
.cover-empty {
  width: 100%;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.cover-empty:hover {
  background: #f9fafb;
}
</style>

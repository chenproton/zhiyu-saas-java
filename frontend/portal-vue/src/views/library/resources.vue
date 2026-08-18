<template>
  <div class="resources-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">教学资源库</span>
          <el-button type="primary" @click="openAdd">新建资源</el-button>
        </div>
      </template>

      <!-- 类型筛选 -->
      <div class="filter-bar">
        <el-button v-for="type in allTypes" :key="type" size="small" round :type="filterType === type ? 'primary' : 'default'" @click="toggleType(type)">
          {{ RESOURCE_TYPE_LABELS[type] }}
        </el-button>
        <el-button v-if="filterType || searchQuery" size="small" text type="danger" @click="clearFilter">清除筛选</el-button>
      </div>

      <el-input v-model="searchQuery" placeholder="搜索资源名称..." clearable style="max-width: 320px; margin-bottom: 12px" @input="onSearch" @clear="onSearch" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="资源" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">{{ typeLabel(row.resourceType) }}</template>
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
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next, total" class="pagination" @current-change="loadItems" />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogOpen" :title="editingItem ? '编辑资源' : '新建资源'" width="520px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="输入资源名称" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.resourceType" :disabled="!!editingItem" style="width: 100%">
            <el-option v-for="(label, key) in RESOURCE_TYPE_LABELS" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.resourceType === 'link'" label="URL">
          <el-input v-model="form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item v-if="isFileType" label="文件">
          <el-upload :auto-upload="false" :limit="1" :on-change="onFileChange" :file-list="fileList" accept="*">
            <el-button size="small">选择文件</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="form.tagIds" multiple style="width: 100%" placeholder="选择标签">
            <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="输入资源简介、用途说明等" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { resourceLibraryApi, tagApi } from '@/api/library';
import { fileApi } from '@/api/import-export';
import { RESOURCE_TYPE_LABELS } from '@/types/library';
import type { ResourceKind, ResourceLibraryItem, TagItem } from '@/types/library';
import { formatSize, isSafeLinkUrl } from '@/utils/format';

const PAGE_SIZE = 200;
const fileTypesWithUpload = ['document', 'spreadsheet', 'image', 'audio', 'video', 'archive'];
const TAG_RESOURCE_TYPE = 'resource_library';

const allTypes = Object.keys(RESOURCE_TYPE_LABELS) as ResourceKind[];

function typeLabel(kind: string): string {
  return RESOURCE_TYPE_LABELS[kind as ResourceKind] || kind;
}

const items = ref<ResourceLibraryItem[]>([]);
const tags = ref<TagItem[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const filterType = ref<ResourceKind | null>(null);
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;

const dialogOpen = ref(false);
const editingItem = ref<ResourceLibraryItem | null>(null);
const submitting = ref(false);
const fileList = ref<UploadFile[]>([]);
const currentFile = ref<File | null>(null);
const form = reactive({ name: '', resourceType: 'document' as ResourceKind, url: '', description: '', tagIds: [] as string[] });

const isFileType = computed(() => fileTypesWithUpload.includes(form.resourceType));

async function loadItems() {
  loading.value = true;
  try {
    const res = await resourceLibraryApi.list({
      ...(filterType.value ? { resourceType: filterType.value } : {}),
      ...(searchQuery.value ? { search: searchQuery.value } : {}),
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE
    });
    items.value = res.items;
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadTags() {
  try {
    const res = await tagApi.list();
    tags.value = res.items;
  } catch {
    /* 标签加载失败不阻断 */
  }
}

function onSearch() {
  page.value = 1;
  loadItems();
}
function toggleType(type: ResourceKind) {
  filterType.value = filterType.value === type ? null : type;
  page.value = 1;
  loadItems();
}
function clearFilter() {
  filterType.value = null;
  searchQuery.value = '';
  page.value = 1;
  loadItems();
}

function onFileChange(file: UploadFile) {
  currentFile.value = file.raw || null;
}

function resetForm() {
  form.name = '';
  form.resourceType = 'document';
  form.url = '';
  form.description = '';
  form.tagIds = [];
  fileList.value = [];
  currentFile.value = null;
}
function openAdd() {
  editingItem.value = null;
  resetForm();
  dialogOpen.value = true;
}
function openEdit(item: ResourceLibraryItem) {
  editingItem.value = item;
  form.name = item.name;
  form.resourceType = item.resourceType;
  form.url = item.url || '';
  form.description = item.description || '';
  form.tagIds = [];
  fileList.value = [];
  currentFile.value = null;
  dialogOpen.value = true;
}

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  submitting.value = true;
  try {
    let finalUrl = form.resourceType === 'link' && form.url.trim() ? form.url.trim() : undefined;
    let finalSize: number | undefined = editingItem.value?.fileSize;
    // 文件类型：先上传文件
    if (isFileType.value && currentFile.value) {
      const up = await fileApi.upload(currentFile.value);
      finalUrl = up.url;
      finalSize = up.size;
    }
    const payload = {
      name: form.name.trim(),
      resourceType: form.resourceType,
      url: finalUrl,
      description: form.description.trim() || undefined,
      fileSize: finalSize,
      thumbnail: form.resourceType === 'image' ? finalUrl || undefined : undefined
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
    // 保存标签绑定
    if (targetId && form.tagIds.length) {
      try {
        await tagApi.setBindings({ resourceType: TAG_RESOURCE_TYPE, resourceId: targetId, tagIds: form.tagIds });
      } catch {
        ElMessage.warning('标签保存失败');
      }
    }
    dialogOpen.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

async function confirmDelete(item: ResourceLibraryItem) {
  try {
    await ElMessageBox.confirm('确定要删除该资源吗？此操作不可恢复。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await resourceLibraryApi.delete(item.id);
    ElMessage.success('删除成功');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(() => {
  loadItems();
  loadTags();
});
</script>

<style scoped>
.resources-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>

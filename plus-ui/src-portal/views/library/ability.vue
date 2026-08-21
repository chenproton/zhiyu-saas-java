<template>
  <div class="library-page">
    <CitationStatsPanel
      entity-label="能力点"
      dialog-title="零引用能力点"
      :stat-count="total"
      stat-label="能力点总数"
      :fetch-stats="fetchStats"
      :fetch-uncited="fetchUncited"
      :delete-item="deleteItem"
      @deleted="loadItems"
    />

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">能力点管理</span>
          <el-button type="primary" @click="openAdd">新建能力点</el-button>
        </div>
      </template>

      <div class="search-row">
        <el-input v-model="searchQuery" placeholder="搜索能力点..." clearable style="max-width: 320px" @input="onSearch" @clear="onSearch" />
        <el-button v-if="searchQuery" text type="danger" @click="clearSearch">清除</el-button>
      </div>

      <TagFilterBar :model-value="selectedTagIds" @update:model-value="onTagFilterChange" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="编码" width="140">
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>
        <el-table-column label="描述" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="属性标签" min-width="160">
          <template #default="{ row }">
            <el-tag v-for="a in row.attributes || []" :key="a" size="small" class="cell-tag">{{ a }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="140">
          <template #default="{ row }">
            <TagBadge v-for="t in tagsByResource[row.id] || []" :key="t.id" :tag="t" class="cell-tag" />
            <span v-if="!(tagsByResource[row.id] || []).length" class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="公开" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isPublic ? 'success' : 'info'" size="small">{{ row.isPublic ? '公开' : '私有' }}</el-tag>
          </template>
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

    <el-dialog v-model="dialogOpen" :title="editingItem ? '编辑能力点' : '新增能力点'" width="520px">
      <el-form :model="form" label-width="110px">
        <el-form-item v-if="editingItem" label="编码">
          <el-input :model-value="editingItem.code || '-'" disabled />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="能力点名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="简要描述" />
        </el-form-item>
        <el-form-item label="属性标签">
          <el-input v-model="form.attributes" placeholder="沟通, 协作, 领导力" />
        </el-form-item>
        <el-form-item label="标签">
          <TagPicker v-model="form.tagIds" />
        </el-form-item>
        <el-form-item label="公开">
          <el-switch v-model="form.isPublic" />
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
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { abilityApi } from '@/api/job';
import type { AbilityPoint } from '@/types/job';
import CitationStatsPanel from './_components/CitationStatsPanel.vue';
import TagFilterBar from './_components/TagFilterBar.vue';
import TagPicker from './_components/TagPicker.vue';
import TagBadge from './_components/TagBadge.vue';
import { useLibraryCrud } from './_components/useLibraryCrud';
import { useTagBindings } from './_components/useTagBindings';
import type { CitationStats, UncitedItem } from './_components/types';

const PAGE_SIZE = 200;
const TAG_RESOURCE_TYPE = 'ability_point';

const selectedTagIds = ref<string[]>([]);
const { tagsByResource, loadBindings, saveTags } = useTagBindings(TAG_RESOURCE_TYPE);

const { items, loading, searchQuery, loadItems, total, page, totalPages } = useLibraryCrud<AbilityPoint>(
  abilityApi.list,
  { getParams: () => (selectedTagIds.value.length ? { tagIds: selectedTagIds.value.join(',') } : {}) }
);

const dialogOpen = ref(false);
const editingItem = ref<AbilityPoint | null>(null);
const submitting = ref(false);
const form = reactive({ name: '', description: '', attributes: '', isPublic: false, tagIds: [] as string[] });

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

function openAdd(): void {
  editingItem.value = null;
  form.name = '';
  form.description = '';
  form.attributes = '';
  form.isPublic = false;
  form.tagIds = [];
  dialogOpen.value = true;
}

function openEdit(item: AbilityPoint): void {
  editingItem.value = item;
  form.name = item.name;
  form.description = item.description || '';
  form.attributes = (item.attributes || []).join(', ');
  form.isPublic = item.isPublic;
  form.tagIds = (tagsByResource.value[item.id] || []).map((t) => t.id);
  dialogOpen.value = true;
}

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  const attrList = form.attributes
    ? form.attributes.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  submitting.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      isPublic: form.isPublic,
      attributes: attrList
    };
    let savedId: string;
    if (editingItem.value) {
      savedId = editingItem.value.id;
      await abilityApi.update(editingItem.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      const created = await abilityApi.create(payload);
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

async function confirmDelete(item: AbilityPoint): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要删除该能力点吗？此操作不可恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await abilityApi.delete(item.id);
    ElMessage.success('删除成功');
    void loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

// 引用统计 / 零引用列表：Vue api/job.ts 未提供，直连 React 同款后端端点
async function fetchStats(): Promise<CitationStats> {
  return request<CitationStats>('/job/abilities/citation-stats');
}

async function fetchUncited(params: {
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}): Promise<ListResponse<UncitedItem>> {
  return request<ListResponse<UncitedItem>>(`/job/abilities/uncited${buildQuery(params)}`);
}

async function deleteItem(id: string): Promise<unknown> {
  return abilityApi.delete(id);
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
</style>

<template>
  <div class="library-page">
    <CitationStatsPanel
      entity-label="知识点"
      dialog-title="零引用知识点"
      :stat-count="total"
      stat-label="知识点总数"
      :fetch-stats="fetchStats"
      :fetch-uncited="fetchUncited"
      :delete-item="deleteItem"
      @deleted="loadItems"
    />

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">知识点管理</span>
          <el-button type="primary" @click="openAdd">新建知识点</el-button>
        </div>
      </template>

      <div class="search-row">
        <el-input v-model="searchQuery" placeholder="搜索知识点..." clearable style="max-width: 320px" @input="onSearch" @clear="onSearch" />
        <el-button v-if="searchQuery" text type="danger" @click="clearSearch">清除</el-button>
      </div>

      <TagFilterBar :model-value="selectedTagIds" @update:model-value="onTagFilterChange" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="编码" width="150">
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>
        <el-table-column label="描述" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="关联课程" width="100">
          <template #default="{ row }">{{ (row.granularLessonIds || []).length }} 门</template>
        </el-table-column>
        <el-table-column label="标签" min-width="140">
          <template #default="{ row }">
            <TagBadge v-for="t in tagsByResource[row.id] || []" :key="t.id" :tag="t" class="cell-tag" />
            <span v-if="!(tagsByResource[row.id] || []).length" class="muted">-</span>
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogOpen" :title="dialogMode === 'add' ? '新增知识点' : '编辑知识点'" width="560px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="知识点名称" required>
          <el-input v-model="form.name" placeholder="输入知识点名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="输入知识点描述" />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="form.code" :disabled="dialogMode !== 'edit'" />
          <div class="hint">{{ dialogMode === 'edit' ? '可修改编码' : '系统自动生成，不可修改' }}</div>
        </el-form-item>
        <el-form-item label="标签">
          <TagPicker v-model="form.tagIds" />
        </el-form-item>
        <el-form-item label="关联颗粒课">
          <div class="gl-field">
            <div v-if="selectedGranularLessons.length" class="gl-selected">
              <el-tag
                v-for="gl in selectedGranularLessons"
                :key="gl.id"
                closable
                size="small"
                class="cell-tag"
                @close="removeGranularLesson(gl.id)"
              >
                {{ gl.name }}
              </el-tag>
            </div>
            <div class="gl-btns">
              <el-button size="small" @click="glSelectOpen = true">选择颗粒课</el-button>
              <el-button size="small" @click="onCreateGranularLesson">新建颗粒课</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!form.name.trim()" @click="submit">
          {{ dialogMode === 'add' ? '新增并选中' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>

    <GranularLessonSelectDialog
      v-model="glSelectOpen"
      :granular-courses="granularCourses"
      :selected-ids="form.granularLessonIds"
      @update:selected-ids="onGranularSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { request, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import { knowledgeApi, courseApi } from '@/api/lesson';
import type { KnowledgePoint } from '@/types/lesson';
import CitationStatsPanel from './_components/CitationStatsPanel.vue';
import TagFilterBar from './_components/TagFilterBar.vue';
import TagPicker from './_components/TagPicker.vue';
import TagBadge from './_components/TagBadge.vue';
import GranularLessonSelectDialog from './_components/GranularLessonSelectDialog.vue';
import { useLibraryCrud } from './_components/useLibraryCrud';
import { useTagBindings } from './_components/useTagBindings';
import type { CitationStats, UncitedItem, GranularLessonOption } from './_components/types';

const router = useRouter();
const PAGE_SIZE = 200;
const TAG_RESOURCE_TYPE = 'knowledge_point';
const GRANULAR_PAGE_SIZE = 200;

const selectedTagIds = ref<string[]>([]);
const { tagsByResource, loadBindings, saveTags } = useTagBindings(TAG_RESOURCE_TYPE);

const { items, loading, searchQuery, loadItems, total, page, totalPages } = useLibraryCrud<KnowledgePoint>(
  knowledgeApi.list,
  { getParams: () => (selectedTagIds.value.length ? { tagIds: selectedTagIds.value.join(',') } : {}) }
);

const dialogOpen = ref(false);
const editingItem = ref<KnowledgePoint | null>(null);
const dialogMode = ref<'add' | 'edit'>('add');
const linked = ref(false);
const submitting = ref(false);
const granularCourses = ref<GranularLessonOption[]>([]);
const glSelectOpen = ref(false);
const form = reactive({ name: '', description: '', code: '', granularLessonIds: [] as string[], tagIds: [] as string[] });

const selectedGranularLessons = computed(() =>
  granularCourses.value.filter((g) => form.granularLessonIds.includes(g.id))
);

function generateKpCode(): string {
  // 追加随机段，避免同毫秒/跨时段尾数碰撞导致 code 唯一约束冲突
  return `KP-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 6)}`;
}

async function loadGranularCourses(): Promise<void> {
  try {
    const all: GranularLessonOption[] = [];
    for (let p = 0; p < 1000; p++) {
      const res = await courseApi.list({ type: 'granular', limit: GRANULAR_PAGE_SIZE, offset: p * GRANULAR_PAGE_SIZE });
      const its = res.items || [];
      all.push(...its.map((c) => ({ id: c.id, name: c.name, code: c.code, description: c.description || undefined })));
      if (its.length < GRANULAR_PAGE_SIZE) break;
    }
    granularCourses.value = all;
  } catch {
    granularCourses.value = [];
  }
}

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
  dialogMode.value = 'add';
  linked.value = false;
  form.name = '';
  form.description = '';
  form.code = generateKpCode();
  form.granularLessonIds = [];
  form.tagIds = [];
  dialogOpen.value = true;
}

function openEdit(item: KnowledgePoint): void {
  editingItem.value = item;
  dialogMode.value = 'edit';
  linked.value = item.linked;
  form.name = item.name;
  form.description = item.description || '';
  form.code = item.code || '';
  form.granularLessonIds = [...(item.granularLessonIds || [])];
  form.tagIds = (tagsByResource.value[item.id] || []).map((t) => t.id);
  dialogOpen.value = true;
}

function removeGranularLesson(id: string): void {
  form.granularLessonIds = form.granularLessonIds.filter((x) => x !== id);
}

function onGranularSelect(v: string[]): void {
  form.granularLessonIds = v;
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
      code: form.code.trim() || undefined,
      description: form.description.trim() || undefined,
      linked: linked.value,
      granularLessonIds: form.granularLessonIds
    };
    let savedId: string;
    if (editingItem.value) {
      savedId = editingItem.value.id;
      await knowledgeApi.update(editingItem.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      const created = await knowledgeApi.create(payload);
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
    void loadGranularCourses();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    submitting.value = false;
  }
}

async function confirmDelete(item: KnowledgePoint): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要删除该知识点吗？此操作不可恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await knowledgeApi.delete(item.id);
    ElMessage.success('删除成功');
    void loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function onCreateGranularLesson(): Promise<void> {
  const newId = await handleCreateGranularLesson();
  if (newId && !form.granularLessonIds.includes(newId)) {
    form.granularLessonIds = [...form.granularLessonIds, newId];
  }
}

async function handleCreateGranularLesson(): Promise<string | undefined> {
  const baseName = editingItem.value?.name || '新建颗粒课';
  try {
    const created = await courseApi.create({
      name: `基于「${baseName}」的颗粒课`,
      type: 'granular',
      category: '专业基础'
    });
    granularCourses.value = [
      ...granularCourses.value,
      { id: created.id, name: created.name, code: created.code, description: created.description || undefined }
    ];
    if (editingItem.value) {
      await knowledgeApi.update(editingItem.value.id, {
        name: editingItem.value.name,
        code: editingItem.value.code || undefined,
        description: editingItem.value.description || undefined,
        linked: editingItem.value.linked,
        granularLessonIds: [...(editingItem.value.granularLessonIds || []), created.id]
      });
      void loadItems();
    }
    void promptNavigate(created.id);
    return created.id;
  } catch (e) {
    ElMessage.error((e as Error).message || '创建颗粒课失败');
    return undefined;
  }
}

async function promptNavigate(id: string): Promise<void> {
  try {
    await ElMessageBox.confirm('占位颗粒课已创建并关联，是否立即前往完善？', '前往完善', {
      confirmButtonText: '前往',
      cancelButtonText: '取消',
      type: 'info'
    });
    const href = router.resolve({ name: 'LessonGranularAdd', query: { id } }).href;
    window.open(href, '_blank', 'noopener,noreferrer');
  } catch {
    /* 取消前往 */
  }
}

// 引用统计 / 零引用列表：Vue api/lesson.ts 未提供，直连 React 同款后端端点
async function fetchStats(): Promise<CitationStats> {
  return request<CitationStats>('/lesson/knowledge-points/citation-stats');
}

async function fetchUncited(params: {
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}): Promise<ListResponse<UncitedItem>> {
  return request<ListResponse<UncitedItem>>(`/lesson/knowledge-points/uncited${buildQuery(params)}`);
}

async function deleteItem(id: string): Promise<unknown> {
  return knowledgeApi.delete(id);
}

watch(items, (v) => {
  if (v.length) void loadBindings(v);
});

onMounted(() => {
  void loadItems();
  void loadGranularCourses();
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
.hint {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}
.gl-field {
  width: 100%;
}
.gl-selected {
  margin-bottom: 8px;
}
.gl-btns {
  display: flex;
  gap: 8px;
}
</style>

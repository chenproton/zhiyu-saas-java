<template>
  <div class="questions-page">
    <div class="stat-card">
      <div class="stat-count">{{ total }}</div>
      <div class="stat-label">题目总数</div>
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">现场问答题库</span>
          <el-button type="primary" @click="openDialog()">新建现场问答题</el-button>
        </div>
      </template>

      <div class="search-row">
        <el-input v-model="searchQuery" placeholder="搜索题目名称..." clearable style="max-width: 320px" @input="onSearch" @clear="onSearch" />
        <el-button v-if="searchQuery" text type="danger" @click="clearSearch">清除</el-button>
      </div>

      <TagFilterBar :model-value="selectedTagIds" @update:model-value="onTagFilterChange" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="题目名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.name }}</template>
        </el-table-column>
        <el-table-column label="题目描述" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="适用专业" width="150">
          <template #default="{ row }">
            <el-tag size="small">{{ row.majorName || majorNameMap[row.majorId] || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="140">
          <template #default="{ row }">
            <TagBadge v-for="t in tagsByResource[row.id] || []" :key="t.id" :tag="t" class="cell-tag" />
            <span v-if="!(tagsByResource[row.id] || []).length" class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="答案" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.answer || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
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

    <el-dialog v-model="dialog" :title="editing ? '编辑现场问答题' : '新增现场问答题'" width="560px">
      <el-form label-width="100px">
        <el-form-item label="题目名称" required>
          <el-input v-model="form.name" placeholder="输入题目名称" />
        </el-form-item>
        <el-form-item label="适用专业">
          <el-select v-model="form.majorId" clearable placeholder="选择适用专业" style="width: 100%">
            <el-option v-for="m in majors" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="题目描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="输入题目描述" />
        </el-form-item>
        <el-form-item label="题目答案">
          <el-input v-model="form.answer" type="textarea" :rows="3" placeholder="输入题目答案" />
        </el-form-item>
        <el-form-item label="标签">
          <TagPicker v-model="form.tagIds" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!form.name.trim()" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createCrudApi } from '@/api/http';
import { majorApi } from '@/api/system';
import TagFilterBar from './_components/TagFilterBar.vue';
import TagPicker from './_components/TagPicker.vue';
import TagBadge from './_components/TagBadge.vue';
import { useLibraryCrud } from './_components/useLibraryCrud';
import { useTagBindings } from './_components/useTagBindings';

// 现场问答题库（后端为 /evaluation/random-draw-questions，React 侧 randomDrawQuestionApi）
interface RandomDrawQuestion {
  id: string;
  name: string;
  description?: string;
  answer?: string;
  majorId?: string;
  majorName?: string;
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 200;
const TAG_RESOURCE_TYPE = 'random_draw_question';

const randomDrawQuestionApi = createCrudApi<
  RandomDrawQuestion,
  Partial<Omit<RandomDrawQuestion, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<RandomDrawQuestion, 'id' | 'createdAt' | 'updatedAt'>>
>('/evaluation/random-draw-questions');

const selectedTagIds = ref<string[]>([]);
const { tagsByResource, loadBindings, saveTags } = useTagBindings(TAG_RESOURCE_TYPE);

const { items, loading, searchQuery, loadItems, total, page, totalPages } = useLibraryCrud<RandomDrawQuestion>(
  randomDrawQuestionApi.list,
  { getParams: () => (selectedTagIds.value.length ? { tagIds: selectedTagIds.value.join(',') } : {}) }
);

const dialog = ref(false);
const saving = ref(false);
const editing = ref<RandomDrawQuestion | null>(null);
const majors = ref<{ id: string; name: string }[]>([]);
const form = reactive({ name: '', description: '', answer: '', majorId: '', tagIds: [] as string[] });

const majorNameMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  for (const m of majors.value) map[m.id] = m.name;
  return map;
});

async function loadMajors(): Promise<void> {
  try {
    // 专业列表分页全量拉取，避免超过后端分页上限时姓名/专业缺失
    const all: { id: string; name: string }[] = [];
    for (let p = 0; p < 1000; p++) {
      const res = await majorApi.list({ limit: 200, offset: p * 200 });
      const its = res.items || [];
      all.push(...its.map((m) => ({ id: m.id, name: m.name })));
      if (its.length < 200) break;
    }
    majors.value = all;
  } catch {
    /* ignore */
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

function openDialog(row?: RandomDrawQuestion): void {
  editing.value = row || null;
  form.name = row?.name || '';
  form.description = row?.description || '';
  form.answer = row?.answer || '';
  form.majorId = row?.majorId || '';
  form.tagIds = row ? (tagsByResource.value[row.id] || []).map((t) => t.id) : [];
  dialog.value = true;
}

async function save(): Promise<void> {
  if (!form.name.trim()) {
    ElMessage.warning('题目名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      answer: form.answer.trim() || undefined,
      majorId: form.majorId || undefined
    };
    let savedId: string;
    if (editing.value) {
      savedId = editing.value.id;
      await randomDrawQuestionApi.update(editing.value.id, payload);
      ElMessage.success('更新成功');
    } else {
      const created = await randomDrawQuestionApi.create(payload);
      savedId = created.id;
      ElMessage.success('创建成功');
    }
    try {
      await saveTags(savedId, form.tagIds);
    } catch {
      ElMessage.warning('标签保存失败：实体已保存，标签未关联，可再次保存重试');
    }
    dialog.value = false;
    void loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(row: RandomDrawQuestion): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要删除该现场问答题吗？此操作不可恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    await randomDrawQuestionApi.delete(row.id);
    ElMessage.success('删除成功');
    void loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

watch(items, (v) => {
  if (v.length) void loadBindings(v);
});

onMounted(() => {
  void loadItems();
  void loadMajors();
});
</script>

<style scoped>
.questions-page {
  padding: 16px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eef2ff, #f5f7ff);
}
.stat-count {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}
.stat-label {
  font-size: 12px;
  color: #94a3b8;
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

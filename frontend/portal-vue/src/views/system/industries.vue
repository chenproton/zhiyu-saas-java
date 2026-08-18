<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">行业管理</h1>
        <p class="page-desc">管理行业分类，可为行业设置上级行业并启用/关闭</p>
      </div>
      <div class="header-actions">
        <el-button @click="importDialog = true">批量导入</el-button>
      </div>
    </div>

    <el-input
      v-model="keyword"
      placeholder="搜索行业代码、名称或上级行业..."
      clearable
      style="max-width: 320px; margin-bottom: 16px"
    />

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-bottom: 16px">
      <template #default>
        <el-button size="small" text type="primary" @click="loadItems">重试</el-button>
      </template>
    </el-alert>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="filteredItems" stripe :empty-text="loading ? '加载中...' : '暂无行业数据'">
        <el-table-column prop="code" label="行业代码" width="120">
          <template #default="{ row }"><span class="cell-mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="行业名称" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span class="cell-strong">{{ row.name }}</span></template>
        </el-table-column>
        <el-table-column label="上级行业" min-width="140">
          <template #default="{ row }">{{ parentName(row.parentId) }}</template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="80" align="center" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '已关闭' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用/关闭" width="100" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="onToggle(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" title="编辑行业" width="480px">
      <el-form label-width="90px">
        <el-form-item label="行业代码" required>
          <el-input v-model="form.code" placeholder="如：IT" :disabled="!!editing" />
        </el-form-item>
        <el-form-item label="行业名称" required>
          <el-input v-model="form.name" placeholder="如：信息技术" />
        </el-form-item>
        <el-form-item label="上级行业">
          <el-select v-model="form.parentId" clearable style="width: 100%" placeholder="无（顶级行业）">
            <el-option
              v-for="i in parentOptions"
              :key="i.id"
              :label="`${i.name} (${i.code})`"
              :value="i.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialog" title="批量导入行业" width="560px">
      <ImportExport entity="industries" :on-imported="loadItems" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { industryApi } from '@/api/system';
import type { Industry } from '@/types/system';
import ImportExport from '@/components/ImportExport.vue';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const items = ref<Industry[]>([]);
const loading = ref(false);
const error = ref('');
const keyword = ref('');
const dialog = ref(false);
const importDialog = ref(false);
const saving = ref(false);
const editing = ref<Industry | null>(null);
const form = reactive({ code: '', name: '', parentId: '', sortOrder: 0 });

const parentMap = computed<Map<string, string>>(() => {
  const byId = new Map(items.value.map((i) => [i.id, i]));
  const map = new Map<string, string>();
  for (const ind of items.value) {
    if (ind.parentId) {
      map.set(ind.parentId, byId.get(ind.parentId)?.name ?? ind.parentId);
    }
  }
  return map;
});

const parentOptions = computed<Industry[]>(() => {
  if (!editing.value) return items.value;
  return items.value.filter((i) => i.id !== editing.value!.id);
});

function parentName(id?: string): string {
  if (!id) return '-';
  return parentMap.value.get(id) ?? id;
}

const filteredItems = computed<Industry[]>(() => {
  const k = keyword.value.trim();
  if (!k) return items.value;
  return items.value.filter((ind) => {
    const pName = ind.parentId ? parentMap.value.get(ind.parentId) : '';
    return ind.name.includes(k) || ind.code.includes(k) || (pName ?? '').includes(k);
  });
});

async function loadItems() {
  if (!tenantId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await industryApi.list({ tenantId: tenantId.value, limit: 1000 });
    items.value = res.items;
  } catch (e) {
    error.value = (e as Error).message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function openDialog(row: Industry) {
  editing.value = row;
  form.code = row.code;
  form.name = row.name;
  form.parentId = row.parentId || '';
  form.sortOrder = row.sortOrder ?? 0;
  dialog.value = true;
}

async function save() {
  if (!form.code.trim() || !form.name.trim()) {
    ElMessage.warning('请填写行业代码与名称');
    return;
  }
  if (!editing.value) {
    ElMessage.error('未获取到行业信息');
    return;
  }
  saving.value = true;
  try {
    await industryApi.update(editing.value.id, {
      code: form.code.trim(),
      name: form.name.trim(),
      parentId: form.parentId || undefined,
      enabled: editing.value.enabled,
      sortOrder: form.sortOrder
    });
    ElMessage.success('行业信息已更新');
    dialog.value = false;
    await loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onToggle(row: Industry) {
  try {
    await industryApi.update(row.id, {
      code: row.code,
      name: row.name,
      parentId: row.parentId || undefined,
      enabled: !row.enabled,
      sortOrder: row.sortOrder
    });
    ElMessage.success(row.enabled ? '已关闭' : '已启用');
    await loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
    await loadItems();
  }
}

async function confirmDelete(row: Industry) {
  try {
    await ElMessageBox.confirm(
      `确定要删除行业「${row.name}」（${row.code}）吗？此操作不可撤销。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }
  try {
    await industryApi.delete(row.id);
    ElMessage.success('删除成功');
    await loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title { font-size: 20px; font-weight: 600; margin: 0; }
.page-desc { color: #909399; font-size: 13px; margin: 4px 0 0; }
.header-actions { display: flex; gap: 8px; }
.cell-strong { font-weight: 500; }
.cell-mono { font-family: monospace; font-size: 13px; }
</style>

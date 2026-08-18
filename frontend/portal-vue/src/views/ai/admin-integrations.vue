<template>
  <div class="integrations-page">
    <div class="page-header">
      <div>
        <h2>外部 AI 服务上架</h2>
        <p>维护第三方智能体与应用的链接卡片，上架后展示在 AI 广场</p>
      </div>
      <el-button type="primary" @click="openCreate">新增</el-button>
    </div>

    <el-card shadow="never">
      <el-radio-group v-model="kind" class="kind-tabs" @change="load">
        <el-radio-button value="agent">第三方智能体</el-radio-button>
        <el-radio-button value="app">应用</el-radio-button>
      </el-radio-group>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="图标" width="70">
          <template #default="{ row }"><span class="icon">{{ row.icon || '🔗' }}</span></template>
        </el-table-column>
        <el-table-column label="名称" prop="name" min-width="150" show-overflow-tooltip />
        <el-table-column label="描述" prop="description" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="分类" prop="category" width="110">
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </el-table-column>
        <el-table-column label="排序" prop="sort" width="70" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '已上架' : '已下架' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" @click="toggle(row)">{{ row.status === 'active' ? '下架' : '上架' }}</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑挂接' : '新增挂接'" width="520px">
      <el-form label-width="80px">
        <el-form-item label="名称" required><el-input v-model="form.name" placeholder="例如：文心一言" /></el-form-item>
        <el-form-item label="URL" required><el-input v-model="form.url" placeholder="https://" /></el-form-item>
        <el-form-item label="图标"><el-input v-model="form.icon" placeholder="🤖（emoji）" /></el-form-item>
        <el-form-item label="分类"><el-input v-model="form.category" placeholder="例如：效率工具" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" placeholder="一句话介绍" /></el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
          <div class="hint">数字越小越靠前</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">{{ editing ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog v-model="deleteDialog" title="删除挂接" width="440px">
      <p>删除后该链接卡片将立即从 AI 广场移除，且不可恢复。确认删除？</p>
      <template #footer>
        <el-button @click="deleteDialog = false">取消</el-button>
        <el-button type="danger" :loading="saving" @click="remove">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { aiCenterAdminApi } from '@/api/ai';
import type { AIIntegration } from '@/types/ai';
import { isSafeExternalUrl } from './ai-api';

const kind = ref<'agent' | 'app'>('agent');
const items = ref<AIIntegration[]>([]);
const loading = ref(true);
const saving = ref(false);
const dialog = ref(false);
const editing = ref<AIIntegration | null>(null);
const deleteDialog = ref(false);
const deleteTarget = ref<AIIntegration | null>(null);

const form = reactive({ name: '', url: '', icon: '', description: '', category: '', sort: 0 });

async function load() {
  loading.value = true;
  try {
    const res = await aiCenterAdminApi.listIntegrations(kind.value);
    items.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.name = '';
  form.url = '';
  form.icon = '';
  form.description = '';
  form.category = '';
  form.sort = 0;
}
function openCreate() {
  editing.value = null;
  resetForm();
  dialog.value = true;
}
function openEdit(item: AIIntegration) {
  editing.value = item;
  form.name = item.name;
  form.url = item.url;
  form.icon = item.icon;
  form.description = item.description;
  form.category = item.category;
  form.sort = item.sort ?? 0;
  dialog.value = true;
}

async function submit() {
  const name = form.name.trim();
  const url = form.url.trim();
  if (!name) {
    ElMessage.warning('请填写名称');
    return;
  }
  if (!/^https?:\/\//.test(url) || !isSafeExternalUrl(url)) {
    ElMessage.warning('请输入合法的 http(s) 链接');
    return;
  }
  const body = {
    kind: kind.value,
    name,
    url,
    icon: form.icon.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    sort: Number(form.sort) || 0
  };
  saving.value = true;
  try {
    if (editing.value) await aiCenterAdminApi.updateIntegration(editing.value.id, body);
    else await aiCenterAdminApi.createIntegration(body);
    ElMessage.success(editing.value ? '保存成功' : '创建成功');
    dialog.value = false;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    saving.value = false;
  }
}

async function toggle(item: AIIntegration) {
  const next = item.status === 'active' ? 'inactive' : 'active';
  try {
    await aiCenterAdminApi.toggleIntegration(item.id, next);
    item.status = next;
    ElMessage.success('操作成功');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

function confirmDelete(item: AIIntegration) {
  deleteTarget.value = item;
  deleteDialog.value = true;
}
async function remove() {
  if (!deleteTarget.value) return;
  saving.value = true;
  try {
    await aiCenterAdminApi.removeIntegration(deleteTarget.value.id);
    ElMessage.success('删除成功');
    deleteDialog.value = false;
    deleteTarget.value = null;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.integrations-page {
  max-width: 1152px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.page-header p {
  color: #909399;
  font-size: 12px;
  margin: 4px 0 0;
}
.kind-tabs {
  margin-bottom: 12px;
}
.icon {
  font-size: 20px;
}
.hint {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}
</style>

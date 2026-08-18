<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">角色管理</span>
          <el-button type="primary" @click="openDialog()">新建角色</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="code" label="编码" width="140" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="userCount" label="用户数" width="90" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑角色' : '新建角色'" width="640px">
      <el-form label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>

      <el-divider content-position="left">权限配置</el-divider>
      <el-collapse v-model="expandedModules">
        <el-collapse-item v-for="mod in permissionModules" :key="mod.module" :name="mod.module" :title="mod.label">
          <div v-for="p in mod.pages" :key="p.page" class="perm-page">
            <div class="perm-page-title">{{ p.label }}</div>
            <el-checkbox-group v-model="permSelection[`${mod.module}.${p.page}`]">
              <el-checkbox v-for="a in commonActions" :key="a" :value="a">{{ actionLabel(a) }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </el-collapse-item>
      </el-collapse>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { roleApi } from '@/api/system';
import type { Role } from '@/types/system';

const permissionModules = [
  { module: 'scene', label: '场景学习平台', pages: [{ page: 'scenarios', label: '场景管理' }] },
  { module: 'job', label: '产业岗位学习平台', pages: [{ page: 'positions', label: '岗位管理' }] },
  { module: 'lesson', label: '数字课程服务平台', pages: [{ page: 'courses', label: '课程管理' }] },
  { module: 'evaluation', label: '能力评价与测评管理平台', pages: [{ page: 'exams', label: '试卷管理' }, { page: 'question-banks', label: '题库管理' }] },
  { module: 'library', label: '教学资源共享服务平台', pages: [{ page: 'resources', label: '资源管理' }] },
  { module: 'alliance', label: '产教协同运营平台', pages: [{ page: 'projects', label: '联盟项目' }] },
  { module: 'affairs', label: '教务服务平台', pages: [{ page: 'programs', label: '人培方案' }] }
];
const commonActions = ['submit', 'review', 'publish', 'archive', 'unpublish', 'withdraw'];

function actionLabel(a: string) {
  const map: Record<string, string> = {
    submit: '提交审批', review: '审批', publish: '发布', archive: '归档', unpublish: '取消发布', withdraw: '撤回'
  };
  return map[a] || a;
}

const items = ref<Role[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<Role | null>(null);
const form = reactive({ code: '', name: '', description: '' });
const expandedModules = ref<string[]>([]);
const permSelection = reactive<Record<string, string[]>>({});

async function loadItems() {
  loading.value = true;
  try {
    const res = await roleApi.list({ limit: 200 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function resetPerms(permissions?: Record<string, unknown>) {
  for (const mod of permissionModules) {
    for (const p of mod.pages) {
      const key = `${mod.module}.${p.page}`;
      const modPerms = (permissions?.[mod.module] as Record<string, { actions?: string[] }>) || {};
      const actions = modPerms[p.page]?.actions || [];
      permSelection[key] = [...actions];
    }
  }
}

function openDialog(row?: Role) {
  editing.value = row || null;
  form.code = row?.code || '';
  form.name = row?.name || '';
  form.description = row?.description || '';
  resetPerms(row?.permissions);
  expandedModules.value = permissionModules.map((m) => m.module);
  dialog.value = true;
}

async function save() {
  if (!form.code.trim() || !form.name.trim()) { ElMessage.warning('编码和名称不能为空'); return; }
  saving.value = true;
  try {
    const permissions: Record<string, unknown> = {};
    for (const mod of permissionModules) {
      for (const p of mod.pages) {
        const key = `${mod.module}.${p.page}`;
        const actions = permSelection[key] || [];
        if (actions.length) {
          permissions[mod.module] = { ...(permissions[mod.module] as Record<string, unknown>), [p.page]: { actions } };
        }
      }
    }
    const payload = { code: form.code.trim(), name: form.name.trim(), description: form.description.trim() || undefined, permissions };
    if (editing.value) { await roleApi.update(editing.value.id, payload); ElMessage.success('更新成功'); }
    else { await roleApi.create(payload); ElMessage.success('创建成功'); }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}

async function confirmDelete(row: Role) {
  try { await ElMessageBox.confirm(`确定要删除角色「${row.name}」吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await roleApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.perm-page { padding: 8px 0; }
.perm-page-title { font-weight: 500; margin-bottom: 6px; }
</style>

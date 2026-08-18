<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">角色权限管理</span>
            <span class="card-sub">管理系统角色及权限配置</span>
          </div>
          <el-button type="primary" @click="openDialog()">新建角色</el-button>
        </div>
      </template>

      <el-input v-model="keyword" placeholder="搜索角色名称或编码..." clearable style="max-width: 320px; margin-bottom: 12px" />

      <el-table v-loading="loading" :data="filteredItems" stripe>
        <el-table-column prop="code" label="编码" width="140" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column label="关联用户" width="110">
          <template #default="{ row }">
            <el-tag type="info">{{ row.userCount ?? 0 }} 人</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" @click="openUsers(row)">查看用户</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑角色' : '新建角色'" width="640px">
      <el-form label-width="90px">
        <el-form-item label="编码">
          <el-input v-model="form.code" disabled />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="如：学校管理员" /></el-form-item>
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

    <!-- 查看用户 -->
    <el-dialog v-model="usersDialog" :title="`绑定用户 - ${selectedRole?.name || ''}`" width="640px">
      <div v-loading="usersLoading" class="users-wrap">
        <div v-if="usersError" class="users-error">{{ usersError }}</div>
        <el-empty v-else-if="!usersLoading && roleUsers.length === 0" description="暂无用户" />
        <el-table v-else :data="roleUsers" size="small">
          <el-table-column prop="name" label="姓名" min-width="100" />
          <el-table-column label="登录账号" min-width="120">
            <template #default="{ row }">{{ row.username || row.loginName }}</template>
          </el-table-column>
          <el-table-column label="全部角色" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="rn in (row.roleNames ?? [])" :key="rn" size="small" class="tag">{{ rn }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ userStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="usersDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { roleApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/system';
import type { User } from '@/types/user';

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

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const items = ref<Role[]>([]);
const loading = ref(false);
const keyword = ref('');
const dialog = ref(false);
const saving = ref(false);
const editing = ref<Role | null>(null);
const form = reactive({ code: '', name: '', description: '' });
const expandedModules = ref<string[]>([]);
const permSelection = reactive<Record<string, string[]>>({});

const usersDialog = ref(false);
const selectedRole = ref<Role | null>(null);
const roleUsers = ref<User[]>([]);
const usersLoading = ref(false);
const usersError = ref('');

const filteredItems = computed(() => {
  const q = keyword.value.trim();
  if (!q) return items.value;
  return items.value.filter((r) => r.name.includes(q) || r.code.includes(q));
});

async function loadItems() {
  loading.value = true;
  try {
    const res = await roleApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 1000 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function generateRoleCode() {
  let max = 0;
  items.value.forEach((r) => {
    const m = r.code.match(/^ROLE(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `ROLE${String(max + 1).padStart(3, '0')}`;
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
  form.code = row?.code || generateRoleCode();
  form.name = row?.name || '';
  form.description = row?.description || '';
  resetPerms(row?.permissions);
  expandedModules.value = permissionModules.map((m) => m.module);
  dialog.value = true;
}

async function save() {
  if (!form.name.trim()) { ElMessage.warning('角色名称不能为空'); return; }
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
    if (editing.value) {
      await roleApi.update(editing.value.id, {
        ...(tenantId.value ? { tenantId: tenantId.value } : {}),
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: editing.value.status || 'active',
        permissions
      });
      ElMessage.success('更新成功');
    } else {
      await roleApi.create({
        ...(tenantId.value ? { tenantId: tenantId.value } : {}),
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: 'active',
        permissions
      });
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}

async function confirmDelete(row: Role) {
  try { await ElMessageBox.confirm(`确定要删除角色「${row.name}」吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await roleApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

async function openUsers(row: Role) {
  selectedRole.value = row;
  roleUsers.value = [];
  usersError.value = '';
  usersDialog.value = true;
  usersLoading.value = true;
  try {
    const res = await userManagementApi.list({
      ...(tenantId.value ? { tenantId: tenantId.value } : {}),
      roleId: row.id,
      limit: 1000
    });
    roleUsers.value = res.items;
  } catch (e) {
    usersError.value = (e as Error).message || '加载角色用户失败';
  } finally {
    usersLoading.value = false;
  }
}

function userStatusLabel(s: string) {
  if (s === 'active') return '正常';
  if (s === 'graduated') return '已毕业';
  return '禁用';
}

onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-left: 8px; }
.perm-page { padding: 8px 0; }
.perm-page-title { font-weight: 500; margin-bottom: 6px; }
.tag { margin-right: 4px; }
.users-wrap { min-height: 200px; }
.users-error { color: #f56c6c; text-align: center; padding: 40px 0; }
</style>

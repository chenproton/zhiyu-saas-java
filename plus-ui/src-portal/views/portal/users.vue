<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">用户账号</span>
          <el-button type="primary" @click="openCreate">新建账号</el-button>
        </div>
      </template>

      <!-- 角色筛选 tabs -->
      <el-radio-group v-model="roleFilter" class="filter-bar" @change="loadItems">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button v-for="r in roles" :key="r.id" :value="r.code">{{ r.name }}</el-radio-button>
      </el-radio-group>

      <el-input v-model="keyword" placeholder="搜索姓名或账户..." clearable style="max-width: 320px; margin-bottom: 12px" @input="loadItems" @clear="loadItems" />

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="name" label="姓名" min-width="120" />
        <el-table-column label="账号" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.username || row.loginName || '-' }}</template>
        </el-table-column>
        <el-table-column label="角色" min-width="160">
          <template #default="{ row }">
            <template v-if="row.roleNames?.length">
              <el-tag v-for="rn in row.roleNames" :key="rn" size="small" class="role-tag">{{ rn }}</el-tag>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="160">
          <template #default="{ row }">{{ row.lastLoginAt || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openBindRoles(row)">绑定角色</el-button>
            <el-button size="small" @click="toggleStatus(row)">{{ row.status === 'active' ? '停用' : '启用' }}</el-button>
            <el-button size="small" @click="openResetPwd(row)">重置密码</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-if="total > pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next, total" class="pagination" @current-change="loadItems" />
    </el-card>

    <!-- 新建账号 -->
    <el-dialog v-model="createDialog" title="新建账号" width="480px">
      <el-form label-width="90px">
        <el-form-item label="姓名"><el-input v-model="createForm.name" /></el-form-item>
        <el-form-item label="账号"><el-input v-model="createForm.username" placeholder="登录账号" /></el-form-item>
        <el-form-item label="初始密码"><el-input v-model="createForm.password" type="password" show-password /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.roleIds" multiple style="width: 100%" placeholder="选择角色">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createAccount">创建</el-button>
      </template>
    </el-dialog>

    <!-- 绑定角色 -->
    <el-dialog v-model="bindDialog" :title="`绑定角色：${bindTarget?.name || ''}`" width="420px">
      <el-select v-model="bindRoleIds" multiple style="width: 100%" placeholder="选择角色">
        <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
      </el-select>
      <template #footer>
        <el-button @click="bindDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveBindRoles">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetDialog" :title="`重置密码：${resetTarget?.name || ''}`" width="420px">
      <el-input v-model="resetPassword" type="password" show-password placeholder="输入新密码" />
      <template #footer>
        <el-button @click="resetDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveResetPwd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { userManagementApi } from '@/api/portal';
import { roleApi } from '@/api/system';
import type { User } from '@/types/user';
import type { Role } from '@/types/system';

const PAGE_SIZE = 50;
const items = ref<User[]>([]);
const roles = ref<Role[]>([]);
const loading = ref(false);
const keyword = ref('');
const roleFilter = ref('');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;
const saving = ref(false);

const createDialog = ref(false);
const createForm = reactive({ name: '', username: '', password: '', roleIds: [] as string[] });

const bindDialog = ref(false);
const bindTarget = ref<User | null>(null);
const bindRoleIds = ref<string[]>([]);

const resetDialog = ref(false);
const resetTarget = ref<User | null>(null);
const resetPassword = ref('');

async function loadItems() {
  loading.value = true;
  try {
    const res = await userManagementApi.list({
      ...(keyword.value ? { keyword: keyword.value } : {}),
      ...(roleFilter.value ? { roleCode: roleFilter.value } : {}),
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

async function loadRoles() {
  try {
    const res = await roleApi.list({ limit: 200 });
    roles.value = res.items;
  } catch {
    /* 角色加载失败不阻断 */
  }
}

function openCreate() {
  createForm.name = '';
  createForm.username = '';
  createForm.password = '';
  createForm.roleIds = [];
  createDialog.value = true;
}
async function createAccount() {
  if (!createForm.name.trim() || !createForm.username.trim() || !createForm.password) {
    ElMessage.warning('姓名、账号、初始密码不能为空');
    return;
  }
  saving.value = true;
  try {
    await userManagementApi.create({
      name: createForm.name.trim(),
      username: createForm.username.trim(),
      password: createForm.password,
      roleIds: createForm.roleIds
    });
    ElMessage.success('创建成功');
    createDialog.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败');
  } finally {
    saving.value = false;
  }
}

function openBindRoles(row: User) {
  bindTarget.value = row;
  bindRoleIds.value = row.roleIds || [];
  bindDialog.value = true;
}
async function saveBindRoles() {
  if (!bindTarget.value) return;
  saving.value = true;
  try {
    await userManagementApi.bindRoles(bindTarget.value.id, bindRoleIds.value);
    ElMessage.success('角色已更新');
    bindDialog.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '更新失败');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: User) {
  const next = row.status === 'active' ? 'disabled' : 'active';
  try {
    await userManagementApi.updateStatus(row.id, next);
    ElMessage.success(next === 'active' ? '已启用' : '已停用');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

function openResetPwd(row: User) {
  resetTarget.value = row;
  resetPassword.value = '';
  resetDialog.value = true;
}
async function saveResetPwd() {
  if (!resetTarget.value || !resetPassword.value) {
    ElMessage.warning('请输入新密码');
    return;
  }
  saving.value = true;
  try {
    await userManagementApi.resetPassword(resetTarget.value.id, resetPassword.value);
    ElMessage.success('密码已重置');
    resetDialog.value = false;
  } catch (e) {
    ElMessage.error((e as Error).message || '重置失败');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(row: User) {
  try {
    await ElMessageBox.confirm(`确定要删除用户「${row.name}」吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await userManagementApi.delete(row.id);
    ElMessage.success('删除成功');
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(() => {
  loadRoles();
  loadItems();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.filter-bar { margin-bottom: 12px; }
.role-tag { margin-right: 4px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>

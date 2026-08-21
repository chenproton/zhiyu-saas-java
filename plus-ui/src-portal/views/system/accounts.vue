<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">账户管理</span>
            <span class="card-sub">管理系统登录账户，绑定角色并维护账户状态</span>
          </div>
          <el-button v-if="selectedIds.length" type="danger" :loading="batchDeleting" @click="confirmBatchDelete">
            批量删除({{ selectedIds.length }})
          </el-button>
        </div>
      </template>

      <!-- 角色筛选 tabs -->
      <el-radio-group v-model="roleCode" class="filter-bar" @change="onRoleChange">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button v-for="r in roles" :key="r.id" :value="r.code">{{ r.name }}</el-radio-button>
      </el-radio-group>

      <el-input v-model="searchText" placeholder="搜索姓名或账户..." clearable style="max-width: 320px; margin-bottom: 12px" @input="onSearch" @clear="onSearch" />

      <el-table v-loading="loading" :data="accounts" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="name" label="姓名" min-width="110" />
        <el-table-column label="角色" min-width="160">
          <template #default="{ row }">
            <template v-if="row.roleNames.length">
              <el-tag v-for="rn in row.roleNames" :key="rn" size="small" class="tag">{{ rn }}</el-tag>
            </template>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="所属组织" min-width="160">
          <template #default="{ row }">
            <span>{{ row.orgNodeName }}</span>
            <el-tag v-if="row.orgTypeName" size="small" type="info" class="tag">{{ row.orgTypeName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账户登录名" prop="loginName" min-width="140" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录时间" prop="lastLogin" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openBindRoles(row)">绑定角色</el-button>
            <el-button size="small" @click="openResetPwd(row)">重置密码</el-button>
            <el-button size="small" :type="row.status === 'active' ? 'danger' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 'active' ? '禁用账户' : '启用账户' }}
            </el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next, total"
        class="pagination"
        @current-change="load"
      />
    </el-card>

    <!-- 绑定角色 -->
    <el-dialog v-model="bindDialog" :title="`绑定角色 - ${bindTarget?.name || ''}`" width="440px">
      <div class="bind-tip">为用户绑定 1 个或多个角色，用户登录后可在顶栏切换当前角色</div>
      <el-select v-model="bindRoleIds" multiple filterable style="width: 100%" placeholder="搜索并选择角色...">
        <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id">
          <span>{{ r.name }}</span>
          <span class="opt-sub">{{ r.code }}</span>
        </el-option>
      </el-select>
      <div class="bind-tags">
        <el-tag v-for="id in bindRoleIds" :key="id" closable class="tag" @close="bindRoleIds = bindRoleIds.filter((i) => i !== id)">
          {{ roleName(id) }}
        </el-tag>
        <span v-if="!bindRoleIds.length" class="bind-empty">至少需要绑定一个角色</span>
      </div>
      <template #footer>
        <el-button @click="bindDialog = false">取消</el-button>
        <el-button type="primary" :loading="bindSaving" :disabled="!bindRoleIds.length" @click="saveBindRoles">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetDialog" :title="`重置密码 - ${resetTarget?.name || ''}`" width="420px">
      <el-input v-model="resetPassword" type="password" show-password placeholder="输入新密码" />
      <template #footer>
        <el-button @click="resetDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveResetPwd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { userManagementApi } from '@/api/portal';
import { roleApi, organizationApi, orgTypeApi } from '@/api/system';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/system';
import type { User } from '@/types/user';

interface AccountRow {
  id: string;
  name: string;
  roleNames: string[];
  roleIds: string[];
  orgNodeName: string;
  orgTypeName?: string;
  loginName: string;
  status: string;
  lastLogin: string;
}

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const PAGE_SIZE = 20;
const accounts = ref<AccountRow[]>([]);
const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const orgMap = ref<Map<string, { name: string; typeId: string }>>(new Map());
const orgTypeMap = ref<Map<string, string>>(new Map());
const loading = ref(false);
const searchText = ref('');
const roleCode = ref('');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;

const selectedIds = ref<string[]>([]);
const batchDeleting = ref(false);
const saving = ref(false);

const bindDialog = ref(false);
const bindTarget = ref<AccountRow | null>(null);
const bindRoleIds = ref<string[]>([]);
const bindSaving = ref(false);

const resetDialog = ref(false);
const resetTarget = ref<AccountRow | null>(null);
const resetPassword = ref('');

async function loadMeta() {
  try {
    const [roleRes, orgRes, orgTypeRes] = await Promise.all([
      roleApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 1000 }),
      organizationApi.tree({ ...(tenantId.value ? { tenantId: tenantId.value } : {}) }),
      orgTypeApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 1000 })
    ]);
    roles.value = roleRes.items;
    const om = new Map<string, { name: string; typeId: string }>();
    const walk = (nodes: typeof orgRes.items) => {
      for (const n of nodes) {
        om.set(n.id, { name: n.name, typeId: n.typeId });
        if (n.children?.length) walk(n.children);
      }
    };
    walk(orgRes.items || []);
    orgMap.value = om;
    const tm = new Map<string, string>();
    (orgTypeRes.items || []).forEach((t) => tm.set(t.id, t.name));
    orgTypeMap.value = tm;
  } catch {
    /* 元数据加载失败不阻断列表 */
  }
}

async function load() {
  loading.value = true;
  try {
    const res = await userManagementApi.list({
      ...(tenantId.value ? { tenantId: tenantId.value } : {}),
      ...(searchText.value.trim() ? { search: searchText.value.trim() } : {}),
      ...(roleCode.value ? { roleCode: roleCode.value } : {}),
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE
    });
    users.value = res.items;
    total.value = res.total ?? 0;
    accounts.value = res.items.map((u) => {
      const orgNode = u.orgNodeId ? orgMap.value.get(u.orgNodeId) : undefined;
      const orgTypeName = orgNode ? orgTypeMap.value.get(orgNode.typeId) : undefined;
      return {
        id: u.id,
        name: u.name,
        roleNames: u.roleNames ?? [],
        roleIds: u.roleIds ?? [],
        orgNodeName: orgNode?.name || '—',
        orgTypeName,
        loginName: u.username || u.loginName || '',
        status: u.status,
        lastLogin: u.lastLoginAt || '—'
      };
    });
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onSelectionChange(rows: AccountRow[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function onRoleChange() {
  page.value = 1;
  selectedIds.value = [];
  load();
}

function onSearch() {
  page.value = 1;
  selectedIds.value = [];
  load();
}

function roleName(id: string) {
  return roles.value.find((r) => r.id === id)?.name || id;
}

function openBindRoles(row: AccountRow) {
  bindTarget.value = row;
  bindRoleIds.value = [...row.roleIds];
  bindDialog.value = true;
}

async function saveBindRoles() {
  if (!bindTarget.value || !bindRoleIds.value.length) return;
  bindSaving.value = true;
  try {
    await userManagementApi.bindRoles(bindTarget.value.id, bindRoleIds.value);
    ElMessage.success('角色绑定成功');
    bindDialog.value = false;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '绑定失败');
  } finally {
    bindSaving.value = false;
  }
}

function openResetPwd(row: AccountRow) {
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
    ElMessage.success('密码重置成功');
    resetDialog.value = false;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '重置失败');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(row: AccountRow) {
  const next = row.status === 'active' ? 'disabled' : 'active';
  try {
    await userManagementApi.updateStatus(row.id, next);
    ElMessage.success(next === 'active' ? '账户已启用' : '账户已禁用');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function confirmDelete(row: AccountRow) {
  try {
    await ElMessageBox.confirm(`确定要删除账户「${row.name}」吗？此操作不可撤销。`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await userManagementApi.delete(row.id);
    ElMessage.success('删除成功');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function confirmBatchDelete() {
  if (!selectedIds.value.length) return;
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 个账户吗？此操作不可撤销。`, '确认批量删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  batchDeleting.value = true;
  try {
    await userManagementApi.batchDelete(selectedIds.value);
    ElMessage.success(`成功删除 ${selectedIds.value.length} 个账户`);
    selectedIds.value = [];
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '批量删除失败');
  } finally {
    batchDeleting.value = false;
  }
}

onMounted(async () => {
  await loadMeta();
  load();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-left: 8px; }
.filter-bar { margin-bottom: 12px; }
.tag { margin-right: 4px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
.bind-tip { color: #909399; font-size: 13px; margin-bottom: 12px; }
.bind-tags { min-height: 32px; margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
.bind-empty { color: #909399; font-size: 13px; }
.opt-sub { float: right; color: #c0c4cc; font-size: 12px; margin-left: 12px; }
</style>

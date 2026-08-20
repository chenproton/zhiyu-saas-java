<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">教职工管理</span>
            <span class="card-sub">维护教师档案信息</span>
          </div>
          <div>
            <el-button v-if="selectedIds.length" type="danger" @click="confirmBatchDelete">批量删除({{ selectedIds.length }})</el-button>
            <el-button v-if="selectedIds.length" @click="joinDialog = true">批量加入部门({{ selectedIds.length }})</el-button>
            <el-button @click="importDialog = true">批量导入</el-button>
            <el-button @click="exportTeachers">批量导出</el-button>
            <el-button type="primary" @click="openCreate">新建教师</el-button>
          </div>
        </div>
      </template>

      <div class="filter-row">
        <el-input v-model="keyword" placeholder="搜索姓名或登录账号..." clearable style="max-width: 320px" />
        <el-select v-model="statusFilter" style="width: 140px">
          <el-option label="全部状态" value="all" />
          <el-option label="正常" value="正常" />
          <el-option label="禁用" value="禁用" />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="filteredTeachers" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="登录账号（工号）" prop="loginAccount" width="160" />
        <el-table-column label="姓名" prop="name" width="110" />
        <el-table-column label="所属组织节点" prop="department" min-width="140" show-overflow-tooltip />
        <el-table-column label="关联角色" min-width="140">
          <template #default="{ row }">
            <template v-if="row.roles.length">
              <el-tag v-for="r in row.roles" :key="r" size="small" class="tag">{{ r }}</el-tag>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="职位" min-width="140">
          <template #default="{ row }">
            <template v-if="row.positions.length">
              <el-tag v-for="p in row.positions" :key="p" size="small" type="info" class="tag">{{ titleNameMap.get(p) || p }}</el-tag>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === '正常' ? 'success' : 'info'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" @click="changeStatus(row, '正常')" :disabled="row.status === '正常'">设为正常</el-button>
            <el-button size="small" @click="changeStatus(row, '禁用')" :disabled="row.status === '禁用'">设为禁用</el-button>
            <el-button size="small" @click="openResetPwd(row)">重置密码</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建/编辑 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑教师' : '新建教师'" width="480px">
      <el-form label-width="120px">
        <el-form-item label="姓名" required><el-input v-model="form.name" placeholder="请输入姓名" /></el-form-item>
        <el-form-item label="登录账号（工号）" required><el-input v-model="form.loginAccount" placeholder="如：T001" /></el-form-item>
        <el-form-item v-if="!editing" label="密码" required><el-input v-model="form.password" type="password" show-password placeholder="请输入密码" /></el-form-item>
        <el-form-item label="所属组织节点">
          <el-tree-select
            v-model="form.orgNodeId"
            :data="orgTreeData"
            node-key="value"
            :props="{ label: 'label', children: 'children' }"
            placeholder="选择所属组织节点"
            check-strictly
            default-expand-all
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="职位">
          <el-select v-model="form.titleIds" multiple filterable style="width: 100%" placeholder="选择职位">
            <el-option v-for="t in staffTitles" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
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

    <!-- 批量加入部门 -->
    <el-dialog v-model="joinDialog" title="批量加入部门" width="440px">
      <el-tree-select
        v-model="joinOrgNodeId"
        :data="orgTreeData"
        node-key="value"
        :props="{ label: 'label', children: 'children' }"
        placeholder="选择部门"
        check-strictly
        default-expand-all
        style="width: 100%"
      />
      <template #footer>
        <el-button @click="joinDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveJoin">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入（对齐 system 版入口 /import-export 的 teachers 实体，走 Java 泛化导入） -->
    <el-dialog v-model="importDialog" title="批量导入教师" width="560px">
      <ImportExport entity="teachers" :on-imported="load" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { userManagementApi, staffTitleApi } from '@/api/portal';
import { roleApi, organizationApi } from '@/api/system';
import { authedFetch } from '@/api/http';
import ImportExport from '@/components/ImportExport.vue';
import { useAuthStore } from '@/stores/auth';
import type { User, StaffTitle } from '@/types/user';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');
const institutionId = computed(() => (auth.user?.institutionId as string) || '');

interface Teacher {
  id: string;
  name: string;
  loginAccount: string;
  department: string;
  orgNodeId?: string;
  roles: string[];
  positions: string[];
  status: '正常' | '禁用';
}

const allUsers = ref<User[]>([]);
const teachers = ref<Teacher[]>([]);
const staffTitles = ref<StaffTitle[]>([]);
const orgTreeData = ref<{ value: string; label: string; children?: any[] }[]>([]);
const loading = ref(false);
const keyword = ref('');
const statusFilter = ref('all');
const selectedIds = ref<string[]>([]);
const saving = ref(false);

const dialog = ref(false);
const editing = ref<Teacher | null>(null);
const form = reactive({ name: '', loginAccount: '', password: '', orgNodeId: '', titleIds: [] as string[] });

const resetDialog = ref(false);
const resetTarget = ref<Teacher | null>(null);
const resetPassword = ref('');

const joinDialog = ref(false);
const joinOrgNodeId = ref('');

const importDialog = ref(false);

const titleNameMap = computed(() => {
  const m = new Map<string, string>();
  staffTitles.value.forEach((t) => m.set(t.id, t.name));
  return m;
});

const filteredTeachers = computed(() =>
  teachers.value.filter((t) => {
    if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false;
    if (!keyword.value.trim()) return true;
    const q = keyword.value.trim();
    return t.name.includes(q) || t.loginAccount.includes(q);
  })
);

function mapStatus(s: string): Teacher['status'] {
  return s === 'disabled' ? '禁用' : '正常';
}
function toBackendStatus(s: Teacher['status']): string {
  return s === '禁用' ? 'disabled' : 'active';
}

async function load() {
  loading.value = true;
  try {
    const [userRes, titleRes, orgRes] = await Promise.all([
      userManagementApi.list({ roleCode: 'teacher', limit: 1000 }),
      staffTitleApi.list({ limit: 1000 }),
      organizationApi.tree()
    ]);
    allUsers.value = userRes.items;
    staffTitles.value = titleRes.items;
    const byId = new Map<string, any>();
    const buildTree = (nodes: any[]): any[] => nodes.map((n) => {
      byId.set(n.id, n);
      return { value: n.id, label: n.name, children: n.children ? buildTree(n.children) : [] };
    });
    orgTreeData.value = buildTree(orgRes.items || []);

    teachers.value = allUsers.value.map((u) => {
      const orgNode = u.orgNodeId ? byId.get(u.orgNodeId) : undefined;
      return {
        id: u.id,
        name: u.name,
        loginAccount: u.username || u.loginName || '',
        department: orgNode?.name || '—',
        orgNodeId: u.orgNodeId,
        roles: u.roleNames ?? [],
        positions: u.titleIds ?? [],
        status: mapStatus(u.status)
      };
    });
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onSelectionChange(rows: Teacher[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function openCreate() {
  editing.value = null;
  form.name = '';
  form.loginAccount = '';
  form.password = '';
  form.orgNodeId = '';
  form.titleIds = [];
  dialog.value = true;
}
function openEdit(row: Teacher) {
  editing.value = row;
  form.name = row.name;
  form.loginAccount = row.loginAccount;
  form.password = '';
  form.orgNodeId = row.orgNodeId || '';
  form.titleIds = [...row.positions];
  dialog.value = true;
}
async function save() {
  if (!form.name.trim() || !form.loginAccount.trim() || (!editing.value && !form.password)) {
    ElMessage.warning('姓名、工号必填，新建需填写密码');
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      const original = allUsers.value.find((u) => u.id === editing.value!.id);
      if (!original) throw new Error('未找到原始用户数据');
      await userManagementApi.update(editing.value.id, {
        institutionId: original.institutionId,
        orgNodeId: form.orgNodeId || undefined,
        majorId: original.majorId,
        role: original.role,
        loginName: form.loginAccount.trim(),
        username: form.loginAccount.trim(),
        name: form.name.trim(),
        email: original.email,
        phone: original.phone,
        avatarUrl: original.avatarUrl,
        studentNo: original.studentNo,
        workId: original.workId,
        idCard: original.idCard,
        titleIds: form.titleIds
      });
      ElMessage.success('保存成功');
    } else {
      if (!tenantId.value) throw new Error('未获取到租户信息');
      const roles = await roleApi.list({ limit: 200 });
      const teacherRole = roles.items.find((r) => r.code === 'teacher');
      if (!teacherRole) throw new Error('未找到教师角色');
      await userManagementApi.create({
        tenantId: tenantId.value,
        institutionId: institutionId.value,
        roleId: teacherRole.id,
        role: 'school',
        platform: 'portal',
        loginName: form.loginAccount.trim(),
        username: form.loginAccount.trim(),
        password: form.password,
        name: form.name.trim(),
        orgNodeId: form.orgNodeId || undefined,
        titleIds: form.titleIds.length > 0 ? form.titleIds : undefined
      });
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function changeStatus(row: Teacher, target: Teacher['status']) {
  if (row.status === target) return;
  try {
    await userManagementApi.updateStatus(row.id, toBackendStatus(target));
    ElMessage.success('状态已更新');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

function openResetPwd(row: Teacher) {
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

async function confirmDelete(row: Teacher) {
  try { await ElMessageBox.confirm(`确定要删除教师「${row.name}」吗？`, '确认删除', { type: 'warning' }); } catch { return; }
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
  try { await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 名教师吗？此操作不可撤销。`, '确认批量删除', { type: 'warning' }); } catch { return; }
  try {
    await userManagementApi.batchDelete(selectedIds.value);
    ElMessage.success(`成功删除 ${selectedIds.value.length} 名教师`);
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '批量删除失败');
  }
}

async function saveJoin() {
  if (!joinOrgNodeId.value) {
    ElMessage.warning('请选择部门');
    return;
  }
  saving.value = true;
  try {
    await userManagementApi.batchUpdateOrgNode({ userIds: selectedIds.value, orgNodeId: joinOrgNodeId.value });
    ElMessage.success('批量加入部门成功');
    joinDialog.value = false;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '批量加入部门失败');
  } finally {
    saving.value = false;
  }
}

// 批量导出（对齐 system 版 teachers.vue：POST /export/teachers/excel，选中优先）
async function exportTeachers() {
  try {
    const res = await authedFetch('/export/teachers/excel', { method: 'POST', body: JSON.stringify({ ids: selectedIds.value }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '教师导出.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(selectedIds.value.length > 0 ? `已导出 ${selectedIds.value.length} 名教职工` : '导出完成');
  } catch (e) {
    ElMessage.error((e as Error).message || '导出失败');
  }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-left: 8px; }
.filter-row { display: flex; gap: 12px; margin-bottom: 12px; }
.tag { margin-right: 4px; }
</style>

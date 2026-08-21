<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">学生管理</span>
            <span class="card-sub">管理学生基础信息与学籍数据</span>
          </div>
          <div>
            <el-button v-if="selectedIds.length" type="danger" :loading="batchDeleting" @click="confirmBatchDelete">批量删除({{ selectedIds.length }})</el-button>
            <el-button v-if="selectedIds.length" :loading="graduateLoading" @click="confirmBatchGraduate">批量毕业({{ selectedIds.length }})</el-button>
            <el-button v-if="selectedIds.length" @click="joinDialog = true">批量加入班级({{ selectedIds.length }})</el-button>
            <el-button @click="importDialog = true">批量导入</el-button>
            <el-button @click="exportStudents">批量导出</el-button>
            <el-button type="primary" @click="openCreate">新建学生</el-button>
          </div>
        </div>
      </template>

      <div class="filter-row">
        <el-input v-model="keyword" placeholder="搜索姓名、登录账号..." clearable style="max-width: 320px" />
        <el-select v-model="statusFilter" style="width: 140px">
          <el-option label="全部状态" value="all" />
          <el-option label="正常" value="正常" />
          <el-option label="禁用" value="禁用" />
          <el-option label="毕业" value="毕业" />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="filteredStudents" stripe @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="登录账号（学号）" prop="loginAccount" width="160" />
        <el-table-column label="姓名" prop="name" width="120" />
        <el-table-column label="所属院系" prop="department" min-width="140" show-overflow-tooltip />
        <el-table-column label="班级" prop="className" min-width="120" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" @click="openResetPwd(row)">重置密码</el-button>
            <el-button size="small" @click="changeStatus(row, '正常')" :disabled="row.status === '正常'">设为正常</el-button>
            <el-button size="small" @click="changeStatus(row, '禁用')" :disabled="row.status === '禁用'">设为禁用</el-button>
            <el-button size="small" @click="changeStatus(row, '毕业')" :disabled="row.status === '毕业'">设为毕业</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建/编辑 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑学生' : '新建学生'" width="480px">
      <el-form label-width="120px">
        <el-form-item label="姓名" required><el-input v-model="form.name" placeholder="请输入姓名" /></el-form-item>
        <el-form-item label="登录账号（学号）" required><el-input v-model="form.loginAccount" placeholder="如：S2024001" /></el-form-item>
        <el-form-item v-if="!editing" label="密码" required><el-input v-model="form.password" type="password" show-password placeholder="请输入密码" /></el-form-item>
        <el-form-item label="班级" required>
          <el-tree-select
            v-model="form.classNodeId"
            :data="classTreeData"
            node-key="value"
            :props="{ label: 'label', children: 'children' }"
            placeholder="选择班级"
            check-strictly
            default-expand-all
            style="width: 100%"
          />
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

    <!-- 批量加入班级 -->
    <el-dialog v-model="joinDialog" title="批量加入班级" width="440px">
      <el-tree-select
        v-model="joinClassNodeId"
        :data="classTreeData"
        node-key="value"
        :props="{ label: 'label', children: 'children' }"
        placeholder="选择班级"
        check-strictly
        default-expand-all
        style="width: 100%"
      />
      <template #footer>
        <el-button @click="joinDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveJoin">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入 -->
    <el-dialog v-model="importDialog" title="批量导入学生" width="560px">
      <ImportExport entity="students" :on-imported="load" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { userManagementApi } from '@/api/portal';
import { roleApi, organizationApi, orgTypeApi } from '@/api/system';
import { authedFetch } from '@/api/http';
import ImportExport from '@/components/ImportExport.vue';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types/user';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');
const institutionId = computed(() => (auth.user?.institutionId as string) || '');

interface Student {
  id: string;
  name: string;
  loginAccount: string;
  className: string;
  department: string;
  orgNodeId?: string;
  status: '正常' | '禁用' | '毕业';
}

const allUsers = ref<User[]>([]);
const students = ref<Student[]>([]);
const classTreeData = ref<{ value: string; label: string; children?: any[] }[]>([]);
const loading = ref(false);
const keyword = ref('');
const statusFilter = ref('all');
const selectedIds = ref<string[]>([]);
const saving = ref(false);
const batchDeleting = ref(false);
const graduateLoading = ref(false);

const dialog = ref(false);
const editing = ref<Student | null>(null);
const form = reactive({ name: '', loginAccount: '', password: '', classNodeId: '' });

const resetDialog = ref(false);
const resetTarget = ref<Student | null>(null);
const resetPassword = ref('');

const joinDialog = ref(false);
const joinClassNodeId = ref('');

const importDialog = ref(false);

const filteredStudents = computed(() =>
  students.value.filter((s) => {
    if (statusFilter.value !== 'all' && s.status !== statusFilter.value) return false;
    if (!keyword.value.trim()) return true;
    const q = keyword.value.trim();
    return s.name.includes(q) || s.loginAccount.includes(q);
  })
);

function mapStatus(s: string): Student['status'] {
  if (s === 'disabled') return '禁用';
  if (s === 'graduated') return '毕业';
  return '正常';
}
function toBackendStatus(s: Student['status']): string {
  if (s === '禁用') return 'disabled';
  if (s === '毕业') return 'graduated';
  return 'active';
}
function statusType(s: string) {
  if (s === '正常') return 'success';
  if (s === '毕业') return 'warning';
  return 'info';
}

async function load() {
  loading.value = true;
  try {
    const [userRes, orgRes, orgTypeRes] = await Promise.all([
      userManagementApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), roleCode: 'student', limit: 1000 }),
      organizationApi.tree({ ...(tenantId.value ? { tenantId: tenantId.value } : {}) }),
      orgTypeApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 200 })
    ]);
    allUsers.value = userRes.items;
    const orgs = orgRes.items || [];
    const typeMap = new Map((orgTypeRes.items || []).map((t) => [t.id, t.name]));
    const classTypeIds = new Set((orgTypeRes.items || []).filter((t) => t.name === '班级').map((t) => t.id));
    const byId = new Map<string, any>();
    const buildTree = (nodes: any[]): any[] => nodes.map((n) => {
      byId.set(n.id, n);
      return { value: n.id, label: n.name, children: n.children ? buildTree(n.children) : [] };
    });
    const fullTree = buildTree(orgs);
    const filterClassTree = (nodes: any[]): any[] =>
      nodes
        .map((n) => ({ ...n, children: filterClassTree(n.children || []) }))
        .filter((n) => n.children.length > 0 || classTypeIds.has(n.value));
    classTreeData.value = filterClassTree(fullTree);

    students.value = allUsers.value.map((u) => {
      const classNode = u.orgNodeId ? byId.get(u.orgNodeId) : undefined;
      const className = classNode?.name || '—';
      let department = '—';
      if (classNode) {
        let cur = classNode;
        while (cur) {
          if (typeMap.get(cur.typeId) === '二级学院') { department = cur.name; break; }
          cur = cur.parentId ? byId.get(cur.parentId) : undefined;
        }
      }
      return {
        id: u.id,
        name: u.name,
        loginAccount: u.username || u.loginName || '',
        className,
        department,
        orgNodeId: u.orgNodeId,
        status: mapStatus(u.status)
      };
    });
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onSelectionChange(rows: Student[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function openCreate() {
  editing.value = null;
  form.name = '';
  form.loginAccount = '';
  form.password = '';
  form.classNodeId = '';
  dialog.value = true;
}
function openEdit(row: Student) {
  editing.value = row;
  form.name = row.name;
  form.loginAccount = row.loginAccount;
  form.password = '';
  form.classNodeId = row.orgNodeId || '';
  dialog.value = true;
}

async function save() {
  if (!form.name.trim() || !form.loginAccount.trim() || (!editing.value && !form.password) || !form.classNodeId) {
    ElMessage.warning('姓名、学号、班级必填，新建需填写密码');
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      const original = allUsers.value.find((u) => u.id === editing.value!.id);
      if (!original) throw new Error('未找到原始用户数据');
      await userManagementApi.update(editing.value.id, {
        institutionId: original.institutionId,
        orgNodeId: form.classNodeId || undefined,
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
        idCard: original.idCard
      });
      ElMessage.success('保存成功');
    } else {
      if (!tenantId.value) throw new Error('未获取到租户信息');
      const roles = await roleApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 200 });
      const studentRole = roles.items.find((r) => r.code === 'student');
      if (!studentRole) throw new Error('未找到学生角色');
      await userManagementApi.create({
        tenantId: tenantId.value,
        institutionId: institutionId.value,
        roleId: studentRole.id,
        role: 'school',
        platform: 'portal',
        loginName: form.loginAccount.trim(),
        username: form.loginAccount.trim(),
        password: form.password,
        name: form.name.trim(),
        orgNodeId: form.classNodeId
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

async function changeStatus(row: Student, target: Student['status']) {
  if (row.status === target) return;
  try {
    await userManagementApi.updateStatus(row.id, toBackendStatus(target));
    ElMessage.success('状态已更新');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

function openResetPwd(row: Student) {
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

async function confirmDelete(row: Student) {
  try { await ElMessageBox.confirm(`确定要删除学生「${row.name}」吗？`, '确认删除', { type: 'warning' }); } catch { return; }
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
  try { await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 名学生吗？此操作不可撤销。`, '确认批量删除', { type: 'warning' }); } catch { return; }
  batchDeleting.value = true;
  try {
    await userManagementApi.batchDelete(selectedIds.value);
    ElMessage.success(`成功删除 ${selectedIds.value.length} 名学生`);
    selectedIds.value = [];
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '批量删除失败');
  } finally {
    batchDeleting.value = false;
  }
}

async function confirmBatchGraduate() {
  if (!selectedIds.value.length) return;
  try {
    await ElMessageBox.confirm(`确定将选中的 ${selectedIds.value.length} 名学生状态改为毕业吗？此操作不可撤销。`, '确认批量毕业', { type: 'warning' });
  } catch {
    return;
  }
  graduateLoading.value = true;
  try {
    await userManagementApi.batchGraduate({ userIds: selectedIds.value });
    ElMessage.success(`已将 ${selectedIds.value.length} 名学生状态改为毕业`);
    selectedIds.value = [];
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '批量毕业失败');
  } finally {
    graduateLoading.value = false;
  }
}

async function saveJoin() {
  if (!joinClassNodeId.value) {
    ElMessage.warning('请选择班级');
    return;
  }
  saving.value = true;
  try {
    await userManagementApi.batchUpdateOrgNode({ userIds: selectedIds.value, orgNodeId: joinClassNodeId.value });
    ElMessage.success('批量加入班级成功');
    joinDialog.value = false;
    selectedIds.value = [];
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '批量加入班级失败');
  } finally {
    saving.value = false;
  }
}

async function exportStudents() {
  try {
    const res = await authedFetch('/export/students/excel', { method: 'POST', body: JSON.stringify({ ids: selectedIds.value }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedIds.value.length > 0 ? '学生导出.xlsx' : '学生导出.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success(selectedIds.value.length > 0 ? `已导出 ${selectedIds.value.length} 名学生` : '导出完成');
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
</style>

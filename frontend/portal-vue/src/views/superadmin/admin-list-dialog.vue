<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEnterprise ? '企业管理员配置' : '学校管理员配置'"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="onClosed"
  >
    <div class="dialog-desc">
      {{ tenant ? (isEnterprise ? `管理租户「${tenant.name}」的企业管理员账号（可登录企业服务台）` : `管理租户「${tenant.name}」的学校管理员账号`) : '' }}
    </div>

    <div class="toolbar">
      <el-button type="primary" size="small" :disabled="inline !== null" @click="startAdd">
        新增
      </el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="mb" />

    <el-table v-loading="loading" :data="admins" stripe :empty-text="isEnterprise ? '暂无企业管理员' : '暂无学校管理员'">
      <el-table-column label="账号" min-width="150">
        <template #default="{ row }">
          <el-input v-if="inline && inline.id === row.id" v-model="inline.username" size="small" :disabled="submitting" />
          <span v-else class="mono">{{ row.username }}</span>
        </template>
      </el-table-column>
      <el-table-column label="姓名" min-width="120">
        <template #default="{ row }">
          <el-input v-if="inline && inline.id === row.id" v-model="inline.name" size="small" :disabled="submitting" />
          <span v-else>{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <template v-if="inline && inline.id === row.id">
            <el-button size="small" type="primary" :loading="submitting" @click="submitInline">保存</el-button>
            <el-button size="small" :disabled="submitting" @click="cancelInline">取消</el-button>
          </template>
          <template v-else>
            <el-button size="small" @click="openPassword(row)">修改密码</el-button>
            <el-button size="small" @click="startEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteTarget = row">删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增行 -->
    <div v-if="inline && !inline.id" class="inline-add">
      <el-input v-model="inline.username" placeholder="登录账号" size="small" class="inline-input" :disabled="submitting" />
      <el-input v-model="inline.name" placeholder="姓名" size="small" class="inline-input" :disabled="submitting" />
      <el-button size="small" type="primary" :loading="submitting" @click="submitInline">保存</el-button>
      <el-button size="small" :disabled="submitting" @click="cancelInline">取消</el-button>
    </div>

    <!-- 修改密码 -->
    <el-dialog v-model="passwordDialog" title="修改密码" width="440px" append-to-body>
      <p class="dialog-desc">
        {{ passwordAdmin ? `为 ${passwordAdmin.name}（${passwordAdmin.username}）设置新密码` : '' }}
      </p>
      <el-form label-width="90px">
        <el-form-item label="新密码" required>
          <el-input v-model="newPassword" type="password" show-password placeholder="至少 8 位，包含字母和数字" />
        </el-form-item>
        <el-form-item label="确认新密码" required>
          <el-input v-model="confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <el-alert v-if="passwordError" :title="passwordError" type="error" :closable="false" show-icon class="mb" />
      <template #footer>
        <el-button @click="passwordDialog = false">取消</el-button>
        <el-button type="primary" :loading="passwordSubmitting" :disabled="!newPassword || !confirmPassword" @click="submitPassword">保存</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认 -->
    <el-dialog v-model="deleteConfirm" title="确认删除" width="440px" append-to-body>
      <p>
        {{ deleteTarget ? `确定删除管理员「${deleteTarget.name}（${deleteTarget.username}）」吗？此操作不可撤销。` : '' }}
      </p>
      <template #footer>
        <el-button @click="deleteConfirm = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="confirmDelete">删除</el-button>
      </template>
    </el-dialog>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { superAdminApi } from '@/api/superadmin';
import type { AdminTenant, TenantAdmin, AdminKind } from '@/api/superadmin';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*d).{8,}$/;

const props = defineProps<{
  modelValue: boolean;
  tenant: AdminTenant | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const isEnterprise = computed(() => props.tenant?.type === 'enterprise');
const kind = computed<AdminKind>(() => (isEnterprise.value ? 'enterprise' : 'school'));

const admins = ref<TenantAdmin[]>([]);
const loading = ref(false);
const error = ref('');

const inline = ref<{ id?: string; username: string; name: string } | null>(null);
const submitting = ref(false);

const deleteTarget = ref<TenantAdmin | null>(null);
const deleteConfirm = ref(false);
const deleting = ref(false);

const passwordDialog = ref(false);
const passwordAdmin = ref<TenantAdmin | null>(null);
const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const passwordSubmitting = ref(false);

async function fetchAdmins() {
  if (!props.tenant) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await superAdminApi.listAdmins(props.tenant.id, kind.value);
    admins.value = res.items;
  } catch (e) {
    error.value = (e as Error).message || '加载管理员列表失败';
  } finally {
    loading.value = false;
  }
}

function startAdd() {
  inline.value = { username: '', name: '' };
  error.value = '';
}

function startEdit(a: TenantAdmin) {
  inline.value = { id: a.id, username: a.username, name: a.name };
  error.value = '';
}

function cancelInline() {
  inline.value = null;
  error.value = '';
}

async function submitInline() {
  if (!inline.value || !props.tenant) return;
  if (!inline.value.username || !inline.value.name) {
    error.value = '账号和姓名不能为空';
    return;
  }
  const editingId = inline.value.id;
  submitting.value = true;
  error.value = '';
  try {
    if (editingId) {
      await superAdminApi.updateAdmin(props.tenant.id, kind.value, editingId, {
        username: inline.value.username,
        name: inline.value.name
      });
      ElMessage.success('保存成功');
    } else {
      const created = await superAdminApi.createAdmin(props.tenant.id, kind.value, {
        username: inline.value.username,
        name: inline.value.name
      });
      if (created.newPassword) {
        ElMessage.success(`创建成功，初始密码：${created.newPassword}`);
      } else {
        ElMessage.success('创建成功');
      }
    }
    inline.value = null;
    await fetchAdmins();
  } catch (e) {
    error.value = (e as Error).message || (editingId ? '保存失败' : '创建失败');
  } finally {
    submitting.value = false;
  }
}

function openPassword(a: TenantAdmin) {
  passwordAdmin.value = a;
  newPassword.value = '';
  confirmPassword.value = '';
  passwordError.value = '';
  passwordDialog.value = true;
}

async function submitPassword() {
  if (!passwordAdmin.value || !props.tenant) return;
  if (!newPassword.value) {
    passwordError.value = '请输入新密码';
    return;
  }
  if (!PASSWORD_RULE.test(newPassword.value)) {
    passwordError.value = '密码长度至少 8 位，且需同时包含字母和数字';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的密码不一致';
    return;
  }
  passwordSubmitting.value = true;
  passwordError.value = '';
  try {
    await superAdminApi.resetAdminPassword(props.tenant.id, kind.value, passwordAdmin.value.id, newPassword.value);
    ElMessage.success('修改成功');
    passwordDialog.value = false;
    passwordAdmin.value = null;
  } catch (e) {
    passwordError.value = (e as Error).message || '修改密码失败';
  } finally {
    passwordSubmitting.value = false;
  }
}

async function confirmDelete() {
  if (!props.tenant || !deleteTarget.value) return;
  deleting.value = true;
  try {
    await superAdminApi.deleteAdmin(props.tenant.id, kind.value, deleteTarget.value.id);
    ElMessage.success('删除成功');
    deleteConfirm.value = false;
    deleteTarget.value = null;
    await fetchAdmins();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  } finally {
    deleting.value = false;
  }
}

function onClosed() {
  inline.value = null;
  deleteTarget.value = null;
  deleteConfirm.value = false;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      inline.value = null;
      error.value = '';
      void fetchAdmins();
    }
  }
);
</script>

<style scoped>
.dialog-desc {
  color: #909399;
  font-size: 13px;
}
.toolbar {
  margin: 8px 0 12px;
}
.mono {
  font-family: monospace;
  font-size: 13px;
}
.inline-add {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 6px;
}
.inline-input {
  width: 180px;
}
.mb {
  margin-bottom: 12px;
}
</style>

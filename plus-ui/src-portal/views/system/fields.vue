<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">用户字段扩展</span>
            <span class="card-sub">系统预留20个用户扩展字段，您可以根据需要启用、命名这些字段，并指定适用的角色</span>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="fields" stripe>
        <el-table-column prop="slotNumber" label="序号" width="80" />
        <el-table-column prop="name" label="字段名称" min-width="160" />
        <el-table-column label="适用角色" min-width="220">
          <template #default="{ row }">
            <template v-if="row.roleCodes.length">
              <el-tag v-for="(label, i) in roleLabels(row.roleCodes)" :key="i" size="small" class="tag">{{ label }}</el-tag>
            </template>
            <span v-else class="muted">未指定</span>
          </template>
        </el-table-column>
        <el-table-column label="是否启用" width="100" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(val: boolean) => toggleEnabled(row, val)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="footer">已启用 {{ enabledCount }} / {{ fields.length }} 个扩展字段</div>
    </el-card>

    <!-- 编辑字段 -->
    <el-dialog v-model="dialog" title="编辑扩展字段" width="480px">
      <el-form label-width="90px">
        <el-form-item label="字段名称" required>
          <el-input v-model="form.name" placeholder="请输入字段名称" />
        </el-form-item>
        <el-form-item label="适用角色">
          <div class="role-chips">
            <el-check-tag
              v-for="r in roles"
              :key="r.id"
              :checked="form.roleCodes.includes(r.code)"
              class="role-chip"
              @change="toggleRoleCode(r.code)"
            >
              {{ r.name }}
            </el-check-tag>
          </div>
          <div class="muted">选择此字段适用的角色，不选则表示所有角色均可使用</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '@/api/http';
import { roleApi } from '@/api/system';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/system';

interface ExtendField {
  id: string;
  slotNumber: number;
  name: string;
  enabled: boolean;
  roleCodes: string[];
}

interface RawField {
  id: string;
  fieldName: string;
  isEnabled: boolean;
  isRequired?: boolean;
  applicableRoleCodes?: string[];
  slotNumber: number;
}

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const fields = ref<ExtendField[]>([]);
const rawFields = ref<RawField[]>([]);
const roles = ref<Role[]>([]);
const loading = ref(false);
const dialog = ref(false);
const saving = ref(false);
const editing = ref<ExtendField | null>(null);
const form = reactive({ name: '', roleCodes: [] as string[] });

const enabledCount = computed(() => fields.value.filter((f) => f.enabled).length);

function roleNameByCode(code: string) {
  return roles.value.find((r) => r.code === code)?.name || code;
}

function roleLabels(codes: string[]) {
  return codes.map((c) => roleNameByCode(c));
}

async function load() {
  loading.value = true;
  try {
    const [fieldsRes, rolesRes] = await Promise.all([
      request<{ items: RawField[]; total: number }>(
        `/user-extension-fields${tenantId.value ? `?tenantId=${encodeURIComponent(tenantId.value)}` : ''}`
      ),
      roleApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 1000 })
    ]);
    roles.value = rolesRes.items;
    rawFields.value = fieldsRes.items;
    fields.value = fieldsRes.items.map((f) => ({
      id: f.id,
      slotNumber: f.slotNumber,
      name: f.fieldName,
      enabled: f.isEnabled,
      roleCodes: f.applicableRoleCodes || []
    }));
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openDialog(row: ExtendField) {
  editing.value = row;
  form.name = row.name;
  form.roleCodes = [...row.roleCodes];
  dialog.value = true;
}

function toggleRoleCode(code: string) {
  if (form.roleCodes.includes(code)) {
    form.roleCodes = form.roleCodes.filter((c) => c !== code);
  } else {
    form.roleCodes = [...form.roleCodes, code];
  }
}

async function toggleEnabled(field: ExtendField, next: boolean) {
  const original = rawFields.value.find((f) => f.id === field.id);
  if (!original) return;
  try {
    await request(`/user-extension-fields/${field.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        fieldName: original.fieldName,
        isEnabled: next,
        isRequired: original.isRequired ?? false,
        applicableRoleCodes: original.applicableRoleCodes || []
      })
    });
    field.enabled = next;
    ElMessage.success('状态已更新');
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function save() {
  if (!editing.value) return;
  if (!form.name.trim()) {
    ElMessage.warning('请输入字段名称');
    return;
  }
  const original = rawFields.value.find((f) => f.id === editing.value!.id);
  saving.value = true;
  try {
    await request(`/user-extension-fields/${editing.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        fieldName: form.name.trim(),
        isEnabled: original?.isEnabled ?? true,
        isRequired: original?.isRequired ?? false,
        applicableRoleCodes: form.roleCodes
      })
    });
    ElMessage.success('保存成功');
    dialog.value = false;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-left: 8px; }
.footer { color: #909399; font-size: 13px; margin-top: 12px; }
.muted { color: #909399; font-size: 13px; }
.tag { margin-right: 4px; }
.role-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
.role-chip { margin-right: 0; }
</style>

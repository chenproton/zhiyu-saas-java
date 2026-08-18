<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">人员关系管理</span>
            <span class="card-sub">维护用户之间的上下级、协同等业务关系</span>
          </div>
          <el-button type="primary" @click="openDialog()">新建人员关系</el-button>
        </div>
      </template>

      <el-input v-model="searchText" placeholder="搜索关系..." clearable style="max-width: 320px; margin-bottom: 12px" />

      <el-table v-loading="loading" :data="relations" stripe>
        <el-table-column label="序号" width="60">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="initiatorName" label="关系发起人" min-width="120" show-overflow-tooltip />
        <el-table-column prop="initiatorDept" label="所属部门" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.initiatorDept || '—' }}</template>
        </el-table-column>
        <el-table-column prop="targetName" label="关系目标人" min-width="120" show-overflow-tooltip />
        <el-table-column prop="targetDept" label="所属部门" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.targetDept || '—' }}</template>
        </el-table-column>
        <el-table-column label="关系类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ typeLabel(row.relationType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建人员关系 -->
    <el-dialog v-model="dialog" title="新建人员关系" width="480px">
      <el-form label-width="100px">
        <el-form-item label="关系发起人" required>
          <el-select
            v-model="form.initiatorId"
            filterable
            remote
            :remote-method="searchInitiators"
            :loading="initiatorLoading"
            placeholder="搜索选择用户..."
            style="width: 100%"
          >
            <el-option v-for="u in initiatorOptions" :key="u.id" :label="u.name" :value="u.id">
              <span>{{ u.name }}</span>
              <span class="opt-sub">{{ u.username || u.loginName }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="关系目标人" required>
          <el-select
            v-model="form.targetId"
            filterable
            remote
            :remote-method="searchTargets"
            :loading="targetLoading"
            placeholder="搜索选择用户..."
            style="width: 100%"
          >
            <el-option v-for="u in targetOptions" :key="u.id" :label="u.name" :value="u.id">
              <span>{{ u.name }}</span>
              <span class="opt-sub">{{ u.username || u.loginName }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="关系类型" required>
          <el-select v-model="form.relationType" placeholder="请选择关系类型" style="width: 100%">
            <el-option v-for="t in relationTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { request } from '@/api/http';
import { userManagementApi } from '@/api/portal';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types/user';

interface RelationItem {
  id: string;
  initiatorId: string;
  initiatorName?: string;
  initiatorDept?: string;
  targetId: string;
  targetName?: string;
  targetDept?: string;
  relationType: string;
  createdAt?: string;
}

const relationTypes = [
  { value: 'superior', label: '上下级' },
  { value: 'collaboration', label: '业务协同' },
  { value: 'management', label: '管理关系' },
  { value: 'service', label: '服务关系' },
  { value: 'project', label: '项目参与' },
  { value: 'external', label: '外部合作' }
];

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const relations = ref<RelationItem[]>([]);
const loading = ref(false);
const searchText = ref('');

const dialog = ref(false);
const saving = ref(false);
const form = reactive({ initiatorId: '', targetId: '', relationType: '' });

const initiatorOptions = ref<User[]>([]);
const targetOptions = ref<User[]>([]);
const initiatorLoading = ref(false);
const targetLoading = ref(false);

function typeLabel(v: string) {
  return relationTypes.find((t) => t.value === v)?.label || v;
}

async function load() {
  loading.value = true;
  try {
    const q = searchText.value.trim();
    const res = await request<{ items: RelationItem[]; total: number }>(
      `/user-relations${q ? `?search=${encodeURIComponent(q)}` : ''}`
    );
    relations.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function searchUsers(q: string): Promise<User[]> {
  const res = await userManagementApi.list({
    ...(tenantId.value ? { tenantId: tenantId.value } : {}),
    ...(q ? { search: q } : {}),
    limit: 20
  });
  return res.items;
}

async function searchInitiators(q: string) {
  initiatorLoading.value = true;
  try {
    initiatorOptions.value = await searchUsers(q);
  } catch (e) {
    ElMessage.error((e as Error).message || '搜索用户失败');
  } finally {
    initiatorLoading.value = false;
  }
}

async function searchTargets(q: string) {
  targetLoading.value = true;
  try {
    targetOptions.value = await searchUsers(q);
  } catch (e) {
    ElMessage.error((e as Error).message || '搜索用户失败');
  } finally {
    targetLoading.value = false;
  }
}

function openDialog() {
  form.initiatorId = '';
  form.targetId = '';
  form.relationType = '';
  initiatorOptions.value = [];
  targetOptions.value = [];
  dialog.value = true;
}

async function save() {
  if (!form.initiatorId || !form.targetId || !form.relationType) {
    ElMessage.warning('请选择关系发起人、目标人与关系类型');
    return;
  }
  if (form.initiatorId === form.targetId) {
    ElMessage.warning('发起人与目标人不能相同');
    return;
  }
  saving.value = true;
  try {
    await request('/user-relations', {
      method: 'POST',
      body: JSON.stringify({ initiatorId: form.initiatorId, targetId: form.targetId, relationType: form.relationType })
    });
    ElMessage.success('创建成功');
    dialog.value = false;
    searchText.value = '';
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(row: RelationItem) {
  try {
    await ElMessageBox.confirm('确定要删除该关系吗？此操作不可撤销。', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await request(`/user-relations/${row.id}`, { method: 'DELETE' });
    ElMessage.success('删除成功');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

// 搜索防抖：输入停止 300ms 后重新拉取
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(searchText, () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => load(), 300);
});

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-left: 8px; }
.opt-sub { float: right; color: #c0c4cc; font-size: 12px; margin-left: 12px; }
</style>

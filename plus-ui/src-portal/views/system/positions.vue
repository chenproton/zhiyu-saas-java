<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">职位管理</span>
            <span class="card-sub">管理系统职位信息</span>
          </div>
          <el-button type="primary" @click="openDialog()">新建职位</el-button>
        </div>
      </template>

      <el-input v-model="keyword" placeholder="搜索职位名称或描述..." clearable style="max-width: 320px; margin-bottom: 12px" />

      <el-table v-loading="loading" :data="filteredPositions" stripe>
        <el-table-column prop="name" label="职位名称" min-width="140" />
        <el-table-column label="关联用户数量" width="120">
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
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" @click="openUsers(row)">查看用户</el-button>
            <el-button size="small" @click="toggleStatus(row)">{{ row.status === 'active' ? '停用' : '启用' }}</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建/编辑 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑职位' : '新建职位'" width="440px">
      <el-form label-width="80px">
        <el-form-item label="职位名称" required><el-input v-model="form.name" placeholder="如：教授" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" placeholder="可选描述" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 关联用户 -->
    <el-dialog v-model="usersDialog" :title="`关联用户 - ${selected?.name || ''}`" width="520px">
      <div class="users-desc">{{ `共 ${selected?.userCount ?? users.length} 名用户关联此职位` }}</div>
      <div v-loading="loadingUsers">
        <el-empty v-if="!loadingUsers && users.length === 0" description="暂无关联用户" />
        <div v-else class="users-list">
          <div v-for="u in users.slice(0, 5)" :key="u.id" class="users-item">
            <div class="avatar">{{ (u.name || '?')[0] }}</div>
            <span class="uname">{{ u.name }}</span>
            <el-tag size="small" type="info">{{ u.username || u.loginName }}</el-tag>
          </div>
          <div v-if="users.length > 5" class="more">... 还有 {{ users.length - 5 }} 名用户</div>
        </div>
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
import { staffTitleApi, userManagementApi } from '@/api/portal';
import { request } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types/user';

interface Position {
  id: string;
  name: string;
  description?: string;
  userCount?: number;
  status?: string;
  createdAt?: string;
}

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const positions = ref<Position[]>([]);
const loading = ref(false);
const keyword = ref('');
const dialog = ref(false);
const saving = ref(false);
const editing = ref<Position | null>(null);
const form = reactive({ name: '', description: '' });

const usersDialog = ref(false);
const selected = ref<Position | null>(null);
const users = ref<User[]>([]);
const loadingUsers = ref(false);

const filteredPositions = computed(() => {
  const q = keyword.value.trim();
  if (!q) return positions.value;
  return positions.value.filter((p) => p.name.includes(q) || (p.description && p.description.includes(q)));
});

async function load() {
  loading.value = true;
  try {
    const res = await staffTitleApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 200 });
    positions.value = res.items as Position[];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: Position) {
  editing.value = row || null;
  form.name = row?.name || '';
  form.description = row?.description || '';
  dialog.value = true;
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入职位名称');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...(tenantId.value ? { tenantId: tenantId.value } : {}),
      name: form.name.trim(),
      description: form.description.trim() || undefined
    };
    if (editing.value) {
      await staffTitleApi.update(editing.value.id, payload);
      ElMessage.success('保存成功');
    } else {
      await staffTitleApi.create(payload as { tenantId: string; name: string; description?: string });
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

async function toggleStatus(row: Position) {
  const next = row.status === 'active' ? 'inactive' : 'active';
  try {
    await request(`/staff-titles/${row.id}/status`, { method: 'POST', body: JSON.stringify({ status: next }) });
    ElMessage.success('状态已更新');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

async function openUsers(row: Position) {
  selected.value = row;
  users.value = [];
  usersDialog.value = true;
  loadingUsers.value = true;
  try {
    const res = await userManagementApi.list({
      ...(tenantId.value ? { tenantId: tenantId.value } : {}),
      titleId: row.id,
      limit: 200
    });
    users.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载用户失败');
  } finally {
    loadingUsers.value = false;
  }
}

async function confirmDelete(row: Position) {
  try {
    await ElMessageBox.confirm(`确定要删除职位「${row.name}」吗？删除后不可恢复。`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await staffTitleApi.delete(row.id);
    ElMessage.success('删除成功');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-left: 8px; }
.users-desc { color: #909399; font-size: 13px; margin-bottom: 12px; }
.users-list { display: flex; flex-direction: column; gap: 8px; }
.users-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f5f7fa; border-radius: 8px; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: #e6f4ff; color: #1677ff; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.uname { font-size: 14px; }
.more { text-align: center; color: #909399; font-size: 13px; }
</style>

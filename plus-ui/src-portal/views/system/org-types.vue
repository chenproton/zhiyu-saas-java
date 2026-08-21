<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">组织类型管理</span>
            <span class="card-sub">管理组织架构中的节点类型</span>
          </div>
          <el-button type="primary" @click="openDialog()">新建类型</el-button>
        </div>
      </template>

      <el-input v-model="keyword" placeholder="搜索类型名称..." clearable style="max-width: 320px; margin-bottom: 12px" />

      <el-table v-loading="loading" :data="filtered" stripe>
        <el-table-column label="类型名称" min-width="160">
          <template #default="{ row }">
            <span class="type-name">{{ row.name }}</span>
            <el-tag v-if="row.isDefault" size="small" class="default-tag">系统默认</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型分类" width="160">
          <template #default="{ row }">
            <el-tag :type="categoryTagType(row.category)">{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button v-if="!row.isDefault" size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
            <el-button v-else size="small" type="info" disabled>系统默认类型不可删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建/编辑 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑组织类型' : '新建组织类型'" width="440px">
      <el-form label-width="90px">
        <el-form-item label="类型名称" required><el-input v-model="form.name" placeholder="如：二级学院" /></el-form-item>
        <el-form-item label="类型分类" required>
          <el-select v-model="form.category" style="width: 100%">
            <el-option label="内部组织" value="internal" />
            <el-option label="业务组织" value="business" />
            <el-option label="外部协作组织" value="external" />
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
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { orgTypeApi } from '@/api/system';
import { useAuthStore } from '@/stores/auth';
import type { OrgType } from '@/types/system';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const items = ref<OrgType[]>([]);
const loading = ref(false);
const keyword = ref('');
const dialog = ref(false);
const saving = ref(false);
const editing = ref<OrgType | null>(null);
const form = reactive({ name: '', category: 'internal' as OrgType['category'] });

const filtered = computed(() => {
  const q = keyword.value.trim();
  if (!q) return items.value;
  return items.value.filter((i) => i.name.includes(q));
});

function categoryLabel(c: string) {
  const map: Record<string, string> = { internal: '内部组织', business: '业务组织', external: '外部协作组织' };
  return map[c] || c;
}
function categoryTagType(c: string) {
  if (c === 'internal') return 'primary';
  if (c === 'business') return 'success';
  return 'warning';
}

async function load() {
  loading.value = true;
  try {
    const res = await orgTypeApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 1000 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: OrgType) {
  editing.value = row || null;
  form.name = row?.name || '';
  form.category = row?.category || 'internal';
  dialog.value = true;
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入类型名称');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...(tenantId.value ? { tenantId: tenantId.value } : {}), name: form.name.trim(), category: form.category };
    if (editing.value) {
      await orgTypeApi.update(editing.value.id, payload);
      ElMessage.success('保存成功');
    } else {
      await orgTypeApi.create(payload);
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

async function confirmDelete(row: OrgType) {
  try {
    await ElMessageBox.confirm(`确定删除组织类型「${row.name}」吗？如果该类型仍被组织使用，删除可能会失败。`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await orgTypeApi.delete(row.id);
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
.type-name { font-weight: 500; }
.default-tag { margin-left: 8px; }
</style>

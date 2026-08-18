<template>
  <div class="org-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">组织架构管理</span>
            <span class="card-sub">管理学校组织架构树，同时维护学生线与教师线的组织归属</span>
          </div>
          <div>
            <el-button @click="exportOrgs">批量导出</el-button>
            <el-button type="primary" @click="openDialog(null)">新建节点</el-button>
          </div>
        </div>
      </template>

      <el-tree
        v-loading="loading"
        :data="treeData"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        default-expand-all
        :expand-on-click-node="false"
        empty-text="暂无组织节点"
      >
        <template #default="{ data }">
          <div class="org-node">
            <span class="node-name">{{ data.name }}</span>
            <el-tag v-if="typeLabel(data.typeId)" size="small" type="info" class="node-type">{{ typeLabel(data.typeId) }}</el-tag>
            <span class="node-count">成员 {{ data.memberCount ?? 0 }}</span>
            <span class="node-actions">
              <el-button size="small" text type="primary" @click.stop="openDialog(data)">添加子节点</el-button>
              <el-button size="small" text @click.stop="openEdit(data)">编辑</el-button>
              <el-button v-if="typeLabel(data.typeId) === '班级'" size="small" text type="warning" :loading="graduateLoading && graduateTarget?.id === data.id" @click.stop="confirmGraduate(data)">批量毕业</el-button>
              <el-button size="small" text type="danger" @click.stop="confirmDelete(data)">删除</el-button>
            </span>
          </div>
        </template>
      </el-tree>
    </el-card>

    <!-- 新增/编辑节点弹窗 -->
    <el-dialog v-model="dialog" :title="dialogTitle" width="480px">
      <el-form label-width="100px">
        <el-form-item label="节点组织名称">
          <el-input v-model="form.name" placeholder="如：信息学院" />
        </el-form-item>
        <el-form-item label="组织类型">
          <el-select v-model="form.typeId" style="width: 100%" placeholder="选择组织类型">
            <el-option v-for="t in orgTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="父节点">
          <el-select v-model="form.parentId" style="width: 100%" placeholder="选择父节点">
            <el-option label="无（作为一级节点）" value="" />
            <el-option v-for="o in flatNodes" :key="o.id" :label="o.name" :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序序号">
          <el-input-number v-model="form.sortOrder" :min="0" style="width: 100%" />
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
import { organizationApi, orgTypeApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import { authedFetch } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import type { Organization, OrgType } from '@/types/system';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const loading = ref(false);
const treeData = ref<Organization[]>([]);
const orgTypes = ref<OrgType[]>([]);
const dialog = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);
const parentOf = ref<string | null>(null);
const form = reactive({ name: '', typeId: '', parentId: '', sortOrder: 0 });

const graduateLoading = ref(false);
const graduateTarget = ref<Organization | null>(null);

// 展平树为下拉选项
const flatNodes = computed(() => {
  const out: Organization[] = [];
  const walk = (nodes: Organization[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(treeData.value);
  return out;
});

const dialogTitle = computed(() => {
  if (editingId.value) return '编辑节点';
  return parentOf.value ? '添加子节点' : '新建节点';
});

function typeLabel(typeId: string) {
  return orgTypes.value.find((t) => t.id === typeId)?.name || '';
}

async function load() {
  loading.value = true;
  try {
    const [treeRes, typeRes] = await Promise.all([
      organizationApi.tree({ ...(tenantId.value ? { tenantId: tenantId.value } : {}) }),
      orgTypeApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 200 })
    ]);
    treeData.value = treeRes.items || [];
    orgTypes.value = typeRes.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openDialog(parent: Organization | null) {
  editingId.value = null;
  parentOf.value = parent?.id ?? null;
  form.name = '';
  form.typeId = '';
  form.parentId = parent?.id ?? '';
  form.sortOrder = parent?.children?.length ? parent.children.length + 1 : 1;
  dialog.value = true;
}

function openEdit(node: Organization) {
  editingId.value = node.id;
  parentOf.value = null;
  form.name = node.name;
  form.typeId = node.typeId;
  form.parentId = node.parentId || '';
  form.sortOrder = node.sortOrder ?? 0;
  dialog.value = true;
}

async function save() {
  if (!form.name.trim()) { ElMessage.warning('请输入节点组织名称'); return; }
  if (!form.typeId) { ElMessage.warning('请选择组织类型'); return; }
  saving.value = true;
  try {
    const payload = {
      ...(tenantId.value ? { tenantId: tenantId.value } : {}),
      name: form.name.trim(),
      typeId: form.typeId,
      parentId: form.parentId || undefined,
      sortOrder: form.sortOrder || 0
    };
    if (editingId.value) {
      await organizationApi.update(editingId.value, payload);
      ElMessage.success('更新成功');
    } else {
      await organizationApi.create({ ...payload, memberCount: 0 });
      ElMessage.success('添加成功');
    }
    dialog.value = false;
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(node: Organization) {
  try {
    await ElMessageBox.confirm(`确定删除组织节点「${node.name}」吗？其子节点会被一并删除，节点下的用户将保留但清空所属班级/部门。`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
  } catch {
    return;
  }
  try {
    await organizationApi.delete(node.id);
    ElMessage.success('删除成功');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  }
}

async function confirmGraduate(node: Organization) {
  try {
    await ElMessageBox.confirm(`确定将「${node.name}」下的在籍学生全部标记为毕业吗？此操作不可撤销。`, '确认批量毕业', { type: 'warning', confirmButtonText: '确认毕业', cancelButtonText: '取消' });
  } catch {
    return;
  }
  graduateTarget.value = node;
  graduateLoading.value = true;
  try {
    // 分页拉全该班级下在籍学生（服务端按 orgNodeId 过滤）
    const pageSize = 200;
    const userIds: string[] = [];
    let offset = 0;
    let total = 0;
    do {
      const res = await userManagementApi.list({
        ...(tenantId.value ? { tenantId: tenantId.value } : {}),
        orgNodeId: node.id,
        status: 'active',
        limit: pageSize,
        offset
      });
      res.items.forEach((u) => userIds.push(u.id));
      total = res.total ?? 0;
      offset += pageSize;
    } while (offset < total);

    if (userIds.length === 0) {
      ElMessage.info('该班级下没有可毕业的在籍学生');
      return;
    }
    await userManagementApi.batchGraduate({ userIds });
    ElMessage.success(`已将 ${userIds.length} 名学生状态改为毕业`);
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '批量毕业失败');
  } finally {
    graduateLoading.value = false;
    graduateTarget.value = null;
  }
}

async function exportOrgs() {
  try {
    const res = await authedFetch('/export/organizations/excel', { method: 'POST', body: JSON.stringify({ ids: [] }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '组织架构导出.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出完成');
  } catch (e) {
    ElMessage.error((e as Error).message || '导出失败');
  }
}

onMounted(load);
</script>

<style scoped>
.org-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-left: 8px; }
.org-node { display: flex; align-items: center; gap: 8px; flex: 1; padding: 4px 0; }
.node-name { font-weight: 500; }
.node-type { margin-left: 4px; }
.node-count { color: #909399; font-size: 12px; }
.node-actions { margin-left: auto; opacity: 0; transition: opacity .2s; }
.org-node:hover .node-actions { opacity: 1; }
</style>

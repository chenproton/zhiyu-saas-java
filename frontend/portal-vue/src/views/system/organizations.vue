<template>
  <div class="org-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">组织架构</span>
          <el-button type="primary" @click="openDialog(null)">添加一级节点</el-button>
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
            <el-option v-for="t in orgTypes" :key="t.id" :label="`${t.name}${t.category ? '（' + t.category + '）' : ''}`" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="父节点">
          <el-select v-model="form.parentId" style="width: 100%" placeholder="选择父节点">
            <el-option label="无（作为一级节点）" value="" />
            <el-option v-for="o in flatNodes" :key="o.id" :label="o.name" :value="o.id" />
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
import { organizationApi, orgTypeApi } from '@/api/system';
import type { Organization, OrgType } from '@/types/system';

const loading = ref(false);
const treeData = ref<Organization[]>([]);
const orgTypes = ref<OrgType[]>([]);
const dialog = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);
const parentOf = ref<string | null>(null);
const form = reactive({ name: '', typeId: '', parentId: '' });

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
  return parentOf.value ? '添加子节点' : '添加一级节点';
});

function typeLabel(typeId: string) {
  return orgTypes.value.find((t) => t.id === typeId)?.name || '';
}

async function load() {
  loading.value = true;
  try {
    const [treeRes, typeRes] = await Promise.all([
      organizationApi.tree(),
      orgTypeApi.list({ limit: 200 })
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
  dialog.value = true;
}

function openEdit(node: Organization) {
  editingId.value = node.id;
  parentOf.value = null;
  form.name = node.name;
  form.typeId = node.typeId;
  form.parentId = node.parentId || '';
  dialog.value = true;
}

async function save() {
  if (!form.name.trim()) { ElMessage.warning('请输入节点组织名称'); return; }
  if (!form.typeId) { ElMessage.warning('请选择组织类型'); return; }
  saving.value = true;
  try {
    const payload = { name: form.name.trim(), typeId: form.typeId, parentId: form.parentId || undefined };
    if (editingId.value) {
      await organizationApi.update(editingId.value, payload);
      ElMessage.success('更新成功');
    } else {
      await organizationApi.create(payload);
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
    await ElMessageBox.confirm(`确定要删除「${node.name}」吗？${node.children?.length ? '其子节点将一并删除或迁移。' : ''}`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
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

onMounted(load);
</script>

<style scoped>
.org-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.org-node { display: flex; align-items: center; gap: 8px; flex: 1; padding: 4px 0; }
.node-name { font-weight: 500; }
.node-type { margin-left: 4px; }
.node-count { color: #909399; font-size: 12px; }
.node-actions { margin-left: auto; opacity: 0; transition: opacity .2s; }
.org-node:hover .node-actions { opacity: 1; }
</style>

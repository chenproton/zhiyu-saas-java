<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">角色权限管理</span>
            <span class="card-sub">管理系统角色及权限配置</span>
          </div>
          <el-button type="primary" @click="openDialog()">新建角色</el-button>
        </div>
      </template>

      <el-input v-model="keyword" placeholder="搜索角色名称或编码..." clearable style="max-width: 320px; margin-bottom: 12px" />

      <el-table v-loading="loading" :data="filteredItems" stripe>
        <el-table-column prop="code" label="编码" width="140" />
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column label="关联用户" width="110">
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
        <el-table-column label="操作" width="290" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" @click="openPermDialog(row)">权限配置</el-button>
            <el-button size="small" @click="openUsers(row)">查看用户</el-button>
            <el-button size="small" type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialog" :title="editing ? '编辑角色' : '新建角色'" width="640px">
      <el-form label-width="90px">
        <el-form-item label="编码">
          <el-input v-model="form.code" disabled />
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" placeholder="如：学校管理员" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 权限配置（对齐 React roles 页：菜单权限 / 操作权限 双 Tab） -->
    <el-dialog v-model="permDialog" :title="`权限配置 - ${permRole?.name || ''}`" width="860px" top="6vh">
      <p class="perm-desc">配置角色的菜单权限和操作权限</p>
      <el-tabs v-model="permTab">
        <el-tab-pane label="菜单权限" name="menus">
          <p class="perm-tip">选择该角色可访问的功能页面。未勾选的页面将在应用中心与各平台侧边导航中隐藏入口。</p>
          <div class="perm-tree-wrap">
            <el-tree
              ref="menuTreeRef"
              :data="visibleMenuTree"
              node-key="id"
              show-checkbox
              default-expand-all
              :props="{ label: 'label', children: 'children' }"
            />
          </div>
        </el-tab-pane>
        <el-tab-pane label="操作权限" name="actions">
          <p class="perm-tip">控制各模块页面的操作按钮权限（提交审批、发布、删除、审核等）。</p>
          <div class="perm-tree-wrap">
            <el-empty v-if="visibleActionModules.length === 0" description="暂无可配置的操作权限" />
            <div v-for="mod in visibleActionModules" :key="mod.module" class="action-module">
              <div class="action-module-title">{{ mod.label }}</div>
              <div v-for="p in mod.pages" :key="p.page" class="action-page">
                <div class="action-page-title">{{ p.label }}</div>
                <el-checkbox
                  v-for="a in p.actions"
                  :key="a.action"
                  :model-value="checkedActions.has(`${mod.module}:${p.page}:${a.action}`)"
                  @change="toggleAction(mod.module, p.page, a.action)"
                >{{ a.label }}</el-checkbox>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="permDialog = false">取消</el-button>
        <el-button type="primary" :loading="permSaving" @click="savePermissions">保存配置</el-button>
      </template>
    </el-dialog>

    <!-- 查看用户 -->
    <el-dialog v-model="usersDialog" :title="`绑定用户 - ${selectedRole?.name || ''}`" width="640px">
      <div v-loading="usersLoading" class="users-wrap">
        <div v-if="usersError" class="users-error">{{ usersError }}</div>
        <el-empty v-else-if="!usersLoading && roleUsers.length === 0" description="暂无用户" />
        <el-table v-else :data="roleUsers" size="small">
          <el-table-column prop="name" label="姓名" min-width="100" />
          <el-table-column label="登录账号" min-width="120">
            <template #default="{ row }">{{ row.username || row.loginName }}</template>
          </el-table-column>
          <el-table-column label="全部角色" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="rn in (row.roleNames ?? [])" :key="rn" size="small" class="tag">{{ rn }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'">{{ userStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="usersDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, ElTree } from 'element-plus';
import { roleApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/system';
import type { User } from '@/types/user';
import { loadPortalAuth } from '@/views/portal/portal-navigation';
import {
  ACTION_MODULE_PLATFORM_MAP,
  MENU_TREE,
  filterMenuTreeBySubscription,
  normalizeMenuPath,
  permissionModuleConfig,
  type MenuTreeItem
} from '@/utils/menu-permissions';

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const items = ref<Role[]>([]);
const loading = ref(false);
const keyword = ref('');
const dialog = ref(false);
const saving = ref(false);
const editing = ref<Role | null>(null);
const form = reactive({ code: '', name: '', description: '' });

const usersDialog = ref(false);
const selectedRole = ref<Role | null>(null);
const roleUsers = ref<User[]>([]);
const usersLoading = ref(false);
const usersError = ref('');

/* ---------------- 权限配置对话框（对齐 React openPermDialog / savePermissions） ---------------- */

const permDialog = ref(false);
const permTab = ref('menus');
const permRole = ref<Role | null>(null);
const permSaving = ref(false);
const menuTreeRef = ref<InstanceType<typeof ElTree>>();
const checkedActions = ref<Set<string>>(new Set());
const subscriptionModules = ref<Record<string, boolean> | null>(null);

const visibleMenuTree = computed(() => filterMenuTreeBySubscription(MENU_TREE, subscriptionModules.value));
const visibleActionModules = computed(() =>
  permissionModuleConfig.filter(
    (mod) =>
      subscriptionModules.value == null ||
      subscriptionModules.value[ACTION_MODULE_PLATFORM_MAP[mod.module]] === true
  )
);

function walkPages(nodes: MenuTreeItem[], fn: (n: MenuTreeItem) => void) {
  for (const n of nodes) {
    if (n.href) fn(n);
    if (n.children) walkPages(n.children, fn);
  }
}

function toggleAction(module: string, page: string, action: string) {
  const key = `${module}:${page}:${action}`;
  const next = new Set(checkedActions.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  checkedActions.value = next;
}

async function openPermDialog(row: Role) {
  permRole.value = row;
  permTab.value = 'menus';

  if (subscriptionModules.value === null) {
    try {
      const { subscriptionModules: subs } = await loadPortalAuth();
      subscriptionModules.value = subs;
    } catch {
      subscriptionModules.value = null;
    }
  }

  const perms = (row.permissions || {}) as Record<string, unknown>;

  // 菜单回显：menus 缺失（如学校管理员/平台管理员）表示不限制菜单，回显为全选
  const checkedLeafIds: string[] = [];
  if (perms.menus && typeof perms.menus === 'object') {
    const granted = new Set<string>();
    for (const [key, value] of Object.entries(perms.menus as Record<string, unknown>)) {
      if (value === true) granted.add(normalizeMenuPath(key));
    }
    walkPages(visibleMenuTree.value, (n) => {
      if (granted.has(normalizeMenuPath(n.href!))) checkedLeafIds.push(n.id);
    });
  } else {
    walkPages(visibleMenuTree.value, (n) => checkedLeafIds.push(n.id));
  }

  // 操作权限回显：兼容数组与 { buttons: [] } 两种历史结构
  const actionSet = new Set<string>();
  for (const mod of permissionModuleConfig) {
    const modPerms = perms[mod.module];
    if (modPerms && typeof modPerms === 'object') {
      for (const page of mod.pages) {
        const pagePerms = (modPerms as Record<string, unknown>)[page.page];
        const list = Array.isArray(pagePerms)
          ? pagePerms
          : pagePerms && typeof pagePerms === 'object' && Array.isArray((pagePerms as Record<string, unknown>).buttons)
            ? ((pagePerms as Record<string, unknown>).buttons as string[])
            : [];
        for (const a of list) {
          if (typeof a === 'string') actionSet.add(`${mod.module}:${page.page}:${a}`);
        }
      }
    }
  }
  checkedActions.value = actionSet;

  permDialog.value = true;
  await nextTick();
  menuTreeRef.value?.setCheckedKeys(checkedLeafIds);
}

async function savePermissions() {
  if (!permRole.value) return;
  permSaving.value = true;
  try {
    const checkedLeafIds = new Set(menuTreeRef.value?.getCheckedKeys(true) ?? []);
    const menus: Record<string, boolean> = {};
    walkPages(visibleMenuTree.value, (n) => {
      if (checkedLeafIds.has(n.id)) menus[n.href!] = true;
    });

    const permissions: Record<string, unknown> = { ...(permRole.value.permissions || {}), menus };

    // 保留非 menus 结构权限，按勾选更新操作权限；未订阅平台的操作权限不保留
    for (const mod of permissionModuleConfig.filter(
      (m) =>
        subscriptionModules.value == null ||
        subscriptionModules.value[ACTION_MODULE_PLATFORM_MAP[m.module]] === true
    )) {
      const modPerms: Record<string, string[]> = {};
      for (const page of mod.pages) {
        const actions: string[] = [];
        for (const a of page.actions) {
          if (checkedActions.value.has(`${mod.module}:${page.page}:${a.action}`)) {
            actions.push(a.action);
          }
        }
        if (actions.length > 0) modPerms[page.page] = actions;
      }
      if (Object.keys(modPerms).length > 0) {
        permissions[mod.module] = modPerms;
      } else {
        delete permissions[mod.module];
      }
    }

    // 仅提交可编辑字段（对齐 React：避免携带展示字段）
    await roleApi.update(permRole.value.id, {
      ...(permRole.value.tenantId ? { tenantId: permRole.value.tenantId } : {}),
      code: permRole.value.code,
      name: permRole.value.name,
      description: permRole.value.description,
      status: permRole.value.status,
      permissions
    });
    ElMessage.success('权限配置已保存');
    permDialog.value = false;
    loadItems();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存权限失败');
  } finally {
    permSaving.value = false;
  }
}

/* ---------------- 列表与角色 CRUD ---------------- */

const filteredItems = computed(() => {
  const q = keyword.value.trim();
  if (!q) return items.value;
  return items.value.filter((r) => r.name.includes(q) || r.code.includes(q));
});

async function loadItems() {
  loading.value = true;
  try {
    const res = await roleApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 1000 });
    items.value = res.items;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function generateRoleCode() {
  let max = 0;
  items.value.forEach((r) => {
    const m = r.code.match(/^ROLE(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `ROLE${String(max + 1).padStart(3, '0')}`;
}

function openDialog(row?: Role) {
  editing.value = row || null;
  form.code = row?.code || generateRoleCode();
  form.name = row?.name || '';
  form.description = row?.description || '';
  dialog.value = true;
}

async function save() {
  if (!form.name.trim()) { ElMessage.warning('角色名称不能为空'); return; }
  saving.value = true;
  try {
    if (editing.value) {
      await roleApi.update(editing.value.id, {
        ...(tenantId.value ? { tenantId: tenantId.value } : {}),
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: editing.value.status || 'active',
        permissions: editing.value.permissions
      });
      ElMessage.success('更新成功');
    } else {
      await roleApi.create({
        ...(tenantId.value ? { tenantId: tenantId.value } : {}),
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: 'active',
        permissions: {}
      });
      ElMessage.success('创建成功');
    }
    dialog.value = false;
    loadItems();
  } catch (e) { ElMessage.error((e as Error).message || '保存失败'); } finally { saving.value = false; }
}

async function confirmDelete(row: Role) {
  try { await ElMessageBox.confirm(`确定要删除角色「${row.name}」吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  try { await roleApi.delete(row.id); ElMessage.success('删除成功'); loadItems(); }
  catch (e) { ElMessage.error((e as Error).message || '删除失败'); }
}

async function openUsers(row: Role) {
  selectedRole.value = row;
  roleUsers.value = [];
  usersError.value = '';
  usersDialog.value = true;
  usersLoading.value = true;
  try {
    const res = await userManagementApi.list({
      ...(tenantId.value ? { tenantId: tenantId.value } : {}),
      roleId: row.id,
      limit: 1000
    });
    roleUsers.value = res.items;
  } catch (e) {
    usersError.value = (e as Error).message || '加载角色用户失败';
  } finally {
    usersLoading.value = false;
  }
}

function userStatusLabel(s: string) {
  if (s === 'active') return '正常';
  if (s === 'graduated') return '已毕业';
  return '禁用';
}

onMounted(loadItems);
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-left: 8px; }
.tag { margin-right: 4px; }
.users-wrap { min-height: 200px; }
.users-error { color: #f56c6c; text-align: center; padding: 40px 0; }
.perm-desc { color: #909399; font-size: 13px; margin: 0 0 8px; }
.perm-tip { color: #909399; font-size: 13px; margin: 0 0 12px; }
.perm-tree-wrap { border: 1px solid #e4e7ed; border-radius: 8px; padding: 12px; max-height: 50vh; overflow: auto; }
.action-module { border: 1px solid #e4e7ed; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
.action-module-title { font-weight: 600; font-size: 14px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #e4e7ed; }
.action-page { margin-bottom: 8px; }
.action-page-title { color: #909399; font-size: 13px; margin-bottom: 4px; }
</style>

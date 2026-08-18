<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">毕业学生管理</span>
            <span class="card-sub">管理已毕业学生的档案信息</span>
          </div>
        </div>
      </template>

      <div class="filter-row">
        <el-input v-model="keyword" placeholder="搜索姓名或学号..." clearable style="max-width: 320px" />
        <el-select v-model="yearFilter" style="width: 140px" placeholder="毕业年份">
          <el-option label="全部年份" value="all" />
          <el-option v-for="y in graduateYears" :key="y" :label="`${y}届`" :value="y" />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="filteredGraduates" stripe>
        <el-table-column prop="loginAccount" label="登录账号（学号）" width="160" />
        <el-table-column prop="name" label="姓名" width="110" />
        <el-table-column prop="department" label="所属院系" min-width="140" show-overflow-tooltip />
        <el-table-column prop="className" label="班级" min-width="120" show-overflow-tooltip />
        <el-table-column label="毕业年份" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.graduateYear !== undefined" type="info">{{ row.graduateYear }}届</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default>
            <el-tag>毕业</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="success" @click="reEnroll(row)">重新入学</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > pageSize"
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next, total"
        class="pagination"
        @current-change="load"
      />
    </el-card>

    <!-- 编辑学生 -->
    <el-dialog v-model="dialog" title="编辑学生" width="460px">
      <el-form label-width="120px">
        <el-form-item label="姓名" required><el-input v-model="form.name" placeholder="请输入姓名" /></el-form-item>
        <el-form-item label="登录账号（学号）" required><el-input v-model="form.loginAccount" placeholder="如：S2024001" /></el-form-item>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { userManagementApi } from '@/api/portal';
import { organizationApi, orgTypeApi } from '@/api/system';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types/user';

interface Graduate {
  id: string;
  name: string;
  loginAccount: string;
  className: string;
  department: string;
  orgNodeId?: string;
  graduateYear?: number;
}

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const PAGE_SIZE = 20;
const graduates = ref<Graduate[]>([]);
const users = ref<User[]>([]);
const classTreeData = ref<{ value: string; label: string; children?: any[] }[]>([]);
const byId = ref<Map<string, any>>(new Map());
const typeMap = ref<Map<string, string>>(new Map());
const loading = ref(false);
const keyword = ref('');
const yearFilter = ref('all');
const page = ref(1);
const total = ref(0);
const pageSize = PAGE_SIZE;

const dialog = ref(false);
const editing = ref<Graduate | null>(null);
const saving = ref(false);
const form = reactive({ name: '', loginAccount: '', classNodeId: '' });

const graduateYears = computed(() => {
  const set = new Set<number>();
  graduates.value.forEach((g) => {
    if (g.graduateYear !== undefined) set.add(g.graduateYear);
  });
  return [...set].sort((a, b) => b - a).map(String);
});

const filteredGraduates = computed(() =>
  graduates.value.filter((g) => {
    if (yearFilter.value !== 'all' && String(g.graduateYear) !== yearFilter.value) return false;
    if (!keyword.value.trim()) return true;
    const q = keyword.value.trim();
    return g.name.includes(q) || g.loginAccount.includes(q) || g.department.includes(q) || g.className.includes(q);
  })
);

async function load() {
  loading.value = true;
  try {
    const [userRes, orgRes, orgTypeRes] = await Promise.all([
      userManagementApi.list({
        ...(tenantId.value ? { tenantId: tenantId.value } : {}),
        roleCode: 'student',
        status: 'graduated',
        ...(keyword.value.trim() ? { search: keyword.value.trim() } : {}),
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE
      }),
      organizationApi.tree({ ...(tenantId.value ? { tenantId: tenantId.value } : {}) }),
      orgTypeApi.list({ ...(tenantId.value ? { tenantId: tenantId.value } : {}), limit: 1000 })
    ]);
    users.value = userRes.items;
    total.value = userRes.total ?? 0;

    const bm = new Map<string, any>();
    const buildTree = (nodes: any[]): any[] => nodes.map((n) => {
      bm.set(n.id, n);
      return { value: n.id, label: n.name, children: n.children ? buildTree(n.children) : [] };
    });
    const fullTree = buildTree(orgRes.items || []);
    byId.value = bm;

    const tm = new Map<string, string>();
    const classTypeIds = new Set<string>();
    (orgTypeRes.items || []).forEach((t) => {
      tm.set(t.id, t.name);
      if (t.name === '班级') classTypeIds.add(t.id);
    });
    typeMap.value = tm;

    const filterClassTree = (nodes: any[]): any[] =>
      nodes
        .map((n) => ({ ...n, children: filterClassTree(n.children || []) }))
        .filter((n) => n.children.length > 0 || classTypeIds.has(n.value));
    classTreeData.value = filterClassTree(fullTree);

    graduates.value = users.value.map((u) => {
      const classNode = u.orgNodeId ? bm.get(u.orgNodeId) : undefined;
      const className = classNode?.name || '—';
      let department = '—';
      if (classNode) {
        let cur = classNode;
        while (cur) {
          if (tm.get(cur.typeId) === '二级学院') { department = cur.name; break; }
          cur = cur.parentId ? bm.get(cur.parentId) : undefined;
        }
      }
      return {
        id: u.id,
        name: u.name,
        loginAccount: u.username || u.loginName || '',
        className,
        department,
        orgNodeId: u.orgNodeId,
        graduateYear: u.graduateYear
      };
    });
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openEdit(row: Graduate) {
  editing.value = row;
  form.name = row.name;
  form.loginAccount = row.loginAccount;
  form.classNodeId = row.orgNodeId || '';
  dialog.value = true;
}

async function save() {
  if (!editing.value || !form.name.trim() || !form.loginAccount.trim() || !form.classNodeId) {
    ElMessage.warning('姓名、学号、班级不能为空');
    return;
  }
  const original = users.value.find((u) => u.id === editing.value!.id);
  if (!original) {
    ElMessage.error('未找到原始用户数据');
    return;
  }
  saving.value = true;
  try {
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
      idCard: original.idCard,
      titleIds: original.titleIds
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

async function reEnroll(row: Graduate) {
  try {
    await userManagementApi.updateStatus(row.id, 'active');
    ElMessage.success('已恢复入学');
    load();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
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
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>

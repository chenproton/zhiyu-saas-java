<template>
  <div class="list-page">
    <div class="page-header">
      <div>
        <div class="card-title">学生画像</div>
        <div class="card-sub">按组织架构筛选学生，点击「查看画像」查看学生能力画像</div>
      </div>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
      class="error-alert"
    >
      <template #default>
        <el-button size="small" @click="retry">重试</el-button>
      </template>
    </el-alert>

    <div class="portrait-layout">
      <el-button class="org-toggle" @click="orgTreeOpen = !orgTreeOpen">
        <el-icon><Folder /></el-icon>
        组织架构筛选
      </el-button>

      <el-card class="org-panel" :class="{ 'is-open': orgTreeOpen }" shadow="never">
        <div class="org-panel-header">
          <el-icon><Folder /></el-icon>
          组织架构
        </div>
        <div v-loading="orgLoading" class="org-tree-wrap">
          <div
            class="org-all-btn"
            :class="{ active: selectedOrgNodeId === null }"
            @click="onSelectAll"
          >
            全部学生
          </div>
          <el-tree
            ref="orgTreeRef"
            :data="orgs"
            node-key="id"
            :props="{ label: 'name', children: 'children' }"
            highlight-current
            default-expand-all
            :expand-on-click-node="false"
            @node-click="onOrgNodeClick"
          />
        </div>
      </el-card>

      <div class="main-panel">
        <el-card shadow="never">
          <div class="filter-row">
            <el-input
              v-model="searchTerm"
              placeholder="搜索姓名、登录账号..."
              clearable
              style="max-width: 320px"
              @input="onSearchChange"
            />
          </div>
        </el-card>

        <el-card shadow="never" class="table-card">
          <el-table v-loading="loading" :data="pagedStudents" stripe :empty-text="emptyText">
            <el-table-column label="登录账号（学号）" prop="loginAccount" width="160" />
            <el-table-column label="姓名" prop="name" width="120" />
            <el-table-column label="所属院系" prop="department" min-width="140" show-overflow-tooltip />
            <el-table-column label="班级" prop="className" min-width="120" show-overflow-tooltip />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="openPreview(row)">查看画像</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <div class="pagination-row">
          <span class="total-text">共 {{ filteredStudents.length }} 条记录</span>
          <el-pagination
            v-model:current-page="page"
            :page-size="PAGE_SIZE"
            :total="filteredStudents.length"
            layout="prev, pager, next"
            background
          />
        </div>
      </div>
    </div>

    <el-dialog
      v-model="previewVisible"
      :title="previewTitle"
      width="80%"
      top="5vh"
      class="portrait-dialog"
      destroy-on-close
    >
      <div class="portrait-desc">学生能力画像详情</div>
      <div class="portrait-frame">
        <iframe
          v-if="previewStudent"
          :key="previewStudent.id"
          :src="`/student_portrait.html?userId=${encodeURIComponent(previewStudent.id)}`"
          title="学生画像"
          class="portrait-iframe"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Folder } from '@element-plus/icons-vue';
import { userManagementApi } from '@/api/portal';
import { organizationApi, orgTypeApi } from '@/api/system';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types/user';
import type { Organization, OrgType } from '@/types/system';

const DEPT_TYPE = '二级学院';
const PAGE_SIZE = 20;

const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

interface Student {
  id: string;
  name: string;
  loginAccount: string;
  className: string;
  department: string;
  orgNodeId?: string;
  status: '正常' | '禁用' | '毕业';
}

const users = ref<User[]>([]);
const students = ref<Student[]>([]);
const loading = ref(true);
const error = ref('');

const orgs = ref<Organization[]>([]);
const orgMap = ref<Map<string, Organization>>(new Map());
const orgTypeMap = ref<Map<string, OrgType>>(new Map());
const orgLoading = ref(false);

const searchTerm = ref('');
const selectedOrgNodeId = ref<string | null>(null);
const page = ref(1);
const orgTreeOpen = ref(false);

const previewStudent = ref<Student | null>(null);

function mapStudentStatus(status: string): Student['status'] {
  if (status === 'active') return '正常';
  if (status === 'disabled') return '禁用';
  if (status === 'graduated') return '毕业';
  return '正常';
}

function statusTagType(status: Student['status']): 'success' | 'info' | 'warning' {
  if (status === '正常') return 'success';
  if (status === '毕业') return 'warning';
  return 'info';
}

function getOrgTypeName(org: Organization | undefined, typeMap: Map<string, OrgType>): string | undefined {
  if (!org) return undefined;
  return typeMap.get(org.typeId)?.name;
}

function findOrgAncestor(
  map: Map<string, Organization>,
  nodeId: string | undefined,
  predicate: (org: Organization) => boolean
): Organization | undefined {
  if (!nodeId) return undefined;
  let current = map.get(nodeId);
  while (current) {
    if (predicate(current)) return current;
    if (!current.parentId) return undefined;
    current = map.get(current.parentId);
  }
  return undefined;
}

function collectOrgSubtreeIds(map: Map<string, Organization>, rootId: string): Set<string> {
  const ids = new Set<string>();
  const collect = (node?: Organization) => {
    if (!node || ids.has(node.id)) return;
    ids.add(node.id);
    (node.children || []).forEach((child) => collect(child));
  };
  collect(map.get(rootId));
  return ids;
}

// 全量拉取学生（分页合并），搜索/组织筛选作用在全量数据上，
// 避免分页接口下跨页学生永远搜不到、总数与列表不一致（对齐 React P1 修复）
async function fetchAllUsers(): Promise<User[]> {
  const pageSize = 200;
  const all: User[] = [];
  for (let p = 0; p < 1000; p++) {
    const res = await userManagementApi.list({
      tenantId: tenantId.value || undefined,
      roleCode: 'student',
      limit: pageSize,
      offset: p * pageSize
    });
    const items = res.items || [];
    all.push(...items);
    if (items.length < pageSize) break;
  }
  return all;
}

function buildStudents() {
  students.value = users.value.map((u) => {
    const classNode = u.orgNodeId ? orgMap.value.get(u.orgNodeId) : undefined;
    const className = classNode?.name || '—';
    let departmentName = '—';
    if (classNode) {
      const deptNode = findOrgAncestor(
        orgMap.value,
        classNode.id,
        (org) => getOrgTypeName(org, orgTypeMap.value) === DEPT_TYPE
      );
      departmentName = deptNode?.name || '—';
    }
    return {
      id: u.id,
      name: u.name,
      loginAccount: u.username || u.loginName || '',
      className,
      department: departmentName,
      orgNodeId: u.orgNodeId,
      status: mapStudentStatus(u.status)
    };
  });
}

async function loadUsers() {
  loading.value = true;
  error.value = '';
  try {
    users.value = await fetchAllUsers();
    buildStudents();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function loadOrgTree() {
  orgLoading.value = true;
  try {
    const [treeRes, typeRes] = await Promise.all([
      organizationApi.tree({ tenantId: tenantId.value || undefined }),
      orgTypeApi.list({ tenantId: tenantId.value || undefined, limit: 1000 })
    ]);
    orgs.value = treeRes.items || [];

    const typeMap = new Map<string, OrgType>();
    (typeRes.items || []).forEach((t) => typeMap.set(t.id, t));
    orgTypeMap.value = typeMap;

    const byId = new Map<string, Organization>();
    const flatten = (nodes: Organization[]) => {
      for (const n of nodes) {
        byId.set(n.id, n);
        if (n.children && n.children.length) flatten(n.children);
      }
    };
    flatten(orgs.value);
    orgMap.value = byId;

    buildStudents();
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载组织架构失败');
  } finally {
    orgLoading.value = false;
  }
}

async function retry() {
  await Promise.all([loadUsers(), loadOrgTree()]);
}

function onSearchChange() {
  page.value = 1;
}

function onSelectAll() {
  selectedOrgNodeId.value = null;
  page.value = 1;
}

function onOrgNodeClick(data: Organization) {
  selectedOrgNodeId.value = data.id;
  page.value = 1;
}

function openPreview(row: Student) {
  previewStudent.value = row;
}

const selectedOrgIds = computed<Set<string> | null>(() => {
  if (!selectedOrgNodeId.value) return null;
  return collectOrgSubtreeIds(orgMap.value, selectedOrgNodeId.value);
});

const filteredStudents = computed(() => {
  let result = students.value.filter((s) => {
    if (!searchTerm.value) return true;
    return s.name.includes(searchTerm.value) || s.loginAccount.includes(searchTerm.value);
  });
  const orgIds = selectedOrgIds.value;
  if (orgIds) {
    result = result.filter((s) => !!s.orgNodeId && orgIds.has(s.orgNodeId));
  }
  return result;
});

const pagedStudents = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return filteredStudents.value.slice(start, start + PAGE_SIZE);
});

const emptyText = computed(() =>
  searchTerm.value ? '未找到匹配的学生' : '暂无学生数据'
);

const previewVisible = computed({
  get: () => !!previewStudent.value,
  set: (v: boolean) => {
    if (!v) previewStudent.value = null;
  }
});

const previewTitle = computed(() =>
  previewStudent.value
    ? `${previewStudent.value.name}（${previewStudent.value.loginAccount}）学生画像`
    : '学生画像'
);

onMounted(() => {
  loadUsers();
  loadOrgTree();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.page-header { margin-bottom: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { color: #909399; font-size: 13px; margin-top: 4px; }
.error-alert { margin-bottom: 12px; }

.portrait-layout { display: flex; gap: 16px; align-items: flex-start; }

.org-toggle { display: none; }

.org-panel { width: 260px; flex-shrink: 0; }
.org-panel-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.org-tree-wrap { max-height: 500px; overflow-y: auto; }
.org-all-btn {
  padding: 6px 8px;
  font-size: 14px;
  border-radius: 4px;
  cursor: pointer;
  color: #606266;
  transition: background-color 0.2s;
}
.org-all-btn:hover { background-color: #f5f7fa; }
.org-all-btn.active { background-color: #ecf5ff; color: #409eff; font-weight: 600; }

.main-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.filter-row { display: flex; gap: 12px; }
.table-card { width: 100%; }

.pagination-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: #909399;
}

.portrait-desc { color: #909399; font-size: 13px; margin-bottom: 8px; }
.portrait-frame { width: 100%; }
.portrait-iframe {
  width: 100%;
  height: calc(100dvh - 11rem);
  min-height: 480px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .portrait-layout { flex-direction: column; }
  .org-toggle { display: flex; width: 100%; }
  .org-panel { display: none; width: 100%; }
  .org-panel.is-open { display: block; }
}
</style>

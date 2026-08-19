<template>
  <!-- 共建人选择器（对齐 React frontend/edu/components/shared/user-selector.tsx，含企业专家分组） -->
  <div class="user-selector">
    <el-button class="trigger" :disabled="disabled" @click="openDialog">
      <el-icon v-if="modelValue.length > 0"><UserFilled /></el-icon>
      <span class="trigger-text" :class="{ 'is-placeholder': modelValue.length === 0 }">{{ triggerText }}</span>
    </el-button>

    <el-dialog v-model="open" title="选择用户" width="960px" top="6vh" class="user-selector-dialog">
      <template #header>
        <div>
          <div class="dialog-title">选择用户</div>
          <div class="dialog-sub">从组织架构中选择共建人</div>
        </div>
      </template>

      <div class="picker">
        <!-- 左：组织树 + 企业专家分组 -->
        <div class="org-pane">
          <div v-if="orgLoading" class="pane-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
          </div>
          <template v-else>
            <div
              class="org-row"
              :class="{ active: !expertView && !selectedOrgId }"
              @click="selectAllOrg"
            >
              <el-icon><OfficeBuilding /></el-icon>
              <span>全部组织</span>
            </div>
            <div
              v-if="showEnterpriseExperts"
              class="org-row expert-row"
              :class="{ active: expertView }"
              @click="selectExpertView"
            >
              <el-icon><Briefcase /></el-icon>
              <span>企业专家</span>
            </div>
            <el-tree
              ref="treeRef"
              :data="orgs"
              node-key="id"
              :props="{ label: 'name', children: 'children' }"
              :current-node-key="expertView ? '' : selectedOrgId || ''"
              highlight-current
              default-expand-all
              :expand-on-click-node="false"
              @node-click="onOrgClick"
            />
          </template>
        </div>

        <!-- 右：用户 / 专家列表 -->
        <div class="list-pane">
          <div class="list-search">
            <el-input
              v-model="userSearch"
              :placeholder="expertView ? '搜索企业专家...' : '搜索用户...'"
              clearable
              :prefix-icon="Search"
            />
          </div>

          <div class="list-body">
            <template v-if="expertView">
              <div v-if="mentorOptions === null" class="pane-loading">
                <el-icon class="is-loading"><Loading /></el-icon>
              </div>
              <el-empty v-else-if="visibleExperts.length === 0" description="暂无企业专家" :image-size="72" />
              <el-table v-else :data="visibleExperts" height="100%" @row-click="onExpertRowClick">
                <el-table-column width="52">
                  <template #default="{ row }">
                    <el-checkbox
                      :model-value="!!row.userId && selectedIds.includes(row.userId)"
                      :disabled="!row.userId"
                      @click.stop
                      @change="() => onExpertRowClick(row)"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="专家" min-width="220">
                  <template #default="{ row }">{{ expertLabel(row) }}</template>
                </el-table-column>
                <el-table-column label="账号" width="140">
                  <template #default="{ row }">
                    <span class="dim">{{ row.userId ? '有企业账号' : '无企业账号' }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </template>

            <template v-else>
              <div v-if="usersLoading" class="pane-loading">
                <el-icon class="is-loading"><Loading /></el-icon>
              </div>
              <div v-else-if="usersError" class="pane-error">
                <p>{{ usersError }}</p>
                <p class="dim">请检查网络或权限后重试</p>
              </div>
              <el-empty v-else-if="users.length === 0" description="暂无用户" :image-size="72" />
              <el-table v-else :data="users" height="100%" @row-click="(row: User) => toggleUser(row.id)">
                <el-table-column width="52">
                  <template #default="{ row }">
                    <el-checkbox
                      :model-value="selectedIds.includes(row.id)"
                      @click.stop
                      @change="() => toggleUser(row.id)"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="账号" min-width="120">
                  <template #default="{ row }">{{ row.username }}</template>
                </el-table-column>
                <el-table-column label="姓名" min-width="120">
                  <template #default="{ row }">{{ row.name }}</template>
                </el-table-column>
                <el-table-column label="所属组织" min-width="140">
                  <template #default="{ row }">
                    <span class="dim">{{ orgName(row.orgNodeId) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="角色" min-width="140">
                  <template #default="{ row }">
                    <span class="dim">{{ (row.roleNames || []).join('、') || '-' }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </template>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="footer-bar">
          <div class="footer-selected">
            <span class="dim">
              {{ multiple ? `已选 ${selectedIds.length} 人` : selectedIds.length > 0 ? '已选' : '未选择' }}
            </span>
            <el-tag
              v-for="id in selectedIds"
              :key="id"
              closable
              size="small"
              type="info"
              @close="removeSelected(id)"
            >
              {{ displayName(id) }}
            </el-tag>
          </div>
          <div class="footer-actions">
            <el-button @click="open = false">取消</el-button>
            <el-button type="primary" @click="handleConfirm">
              <el-icon><Check /></el-icon>
              确认
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  Briefcase,
  Check,
  Loading,
  OfficeBuilding,
  Search,
  UserFilled
} from '@element-plus/icons-vue';
import { organizationApi } from '@/api/system';
import { userManagementApi } from '@/api/portal';
import { request } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { Organization } from '@/types/system';
import type { User } from '@/types/user';
import { fetchAllPages } from './types';

/** 企业专家（共建导师）候选项：对齐 Java AllianceDtos.MentorOptionDto */
interface MentorOption {
  expertId: string;
  name: string;
  title?: string;
  enterpriseId?: string;
  enterpriseName?: string;
  userId?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    multiple?: boolean;
    excludeStudent?: boolean;
    excludeUserIds?: string[];
    placeholder?: string;
    disabled?: boolean;
    /** 增加「企业专家」分组（数据源：/alliance/experts/mentor-options） */
    showEnterpriseExperts?: boolean;
  }>(),
  {
    multiple: true,
    excludeStudent: true,
    excludeUserIds: () => [],
    placeholder: '选择用户',
    disabled: false,
    showEnterpriseExperts: false
  }
);

const emit = defineEmits<{ (e: 'update:modelValue', ids: string[]): void }>();

const open = ref(false);
const orgs = ref<Organization[]>([]);
const treeRef = ref<{ setCurrentKey: (key?: string | null) => void } | null>(null);
const orgLoading = ref(false);
const selectedOrgId = ref<string | null>(null);
const expertView = ref(false);
const users = ref<User[]>([]);
const usersLoading = ref(false);
const usersError = ref<string | null>(null);
const userSearch = ref('');
const debouncedSearch = ref('');
const selectedIds = ref<string[]>([...props.modelValue]);
const userCache = ref<Record<string, { id: string; name?: string; username?: string }>>({});
const mentorOptions = ref<MentorOption[] | null>(null);
const fetchedIds = new Set<string>();
let loadSeq = 0;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// 组织扁平表（用于「所属组织」列回显）
const orgMap = computed(() => {
  const map = new Map<string, Organization>();
  const flatten = (nodes: Organization[]) => {
    nodes.forEach((n) => {
      map.set(n.id, n);
      if (n.children) flatten(n.children);
    });
  };
  flatten(orgs.value);
  return map;
});

function orgName(orgNodeId?: string): string {
  if (!orgNodeId) return '-';
  return orgMap.value.get(orgNodeId)?.name || '-';
}

watch(userSearch, (v) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedSearch.value = v;
  }, 300);
});

async function loadOrgTree() {
  orgLoading.value = true;
  try {
    const res = await organizationApi.tree();
    orgs.value = res.items || [];
  } catch {
    orgs.value = [];
  } finally {
    orgLoading.value = false;
  }
}

async function loadUsers() {
  // 专家视图下右侧列表来自 mentorOptions，本地过滤，无需请求用户接口
  if (expertView.value) return;
  const seq = ++loadSeq;
  usersLoading.value = true;
  usersError.value = null;
  try {
    const params: Record<string, string | number | boolean | undefined> = {
      search: debouncedSearch.value || undefined
    };
    if (selectedOrgId.value) params.orgNodeId = selectedOrgId.value;
    // 分页合并全量拉取，避免超过后端 maxPageSize(200) 静默截断
    const all = await fetchAllPages<User>((page, pageSize) =>
      userManagementApi.list({ ...params, limit: pageSize, offset: page * pageSize })
    );
    if (seq !== loadSeq) return;
    let filtered = all;
    if (props.excludeStudent) {
      filtered = filtered.filter((u) => !(u.roleCodes || []).includes('student'));
    }
    if (props.excludeUserIds.length > 0) {
      const excludeSet = new Set(props.excludeUserIds);
      filtered = filtered.filter((u) => !excludeSet.has(u.id));
    }
    users.value = filtered;
    mergeUserCache(all);
  } catch (e) {
    if (seq === loadSeq) usersError.value = (e as Error).message || '加载用户失败';
  } finally {
    if (seq === loadSeq) usersLoading.value = false;
  }
}

function mergeUserCache(items: { id: string; name?: string; username?: string }[]) {
  if (items.length === 0) return;
  const next = { ...userCache.value };
  items.forEach((u) => {
    next[u.id] = u;
  });
  userCache.value = next;
}

async function loadMentorOptions() {
  if (mentorOptions.value !== null) return;
  try {
    const res = await request<ListResponse<MentorOption>>('/alliance/experts/mentor-options');
    const items = res.items || [];
    mentorOptions.value = items;
    // 已选专家账号不在学校租户用户列表，加载后同步注入名字缓存供回显
    const selected = items.filter((o) => o.userId && props.modelValue.includes(o.userId));
    if (selected.length > 0) {
      mergeUserCache(selected.map((o) => ({ id: o.userId as string, name: o.name, username: o.name })));
    }
  } catch {
    mentorOptions.value = [];
  }
}

/** 已选但未在缓存中的 id：解析名字，避免触发区展示原始 id */
async function resolveMissingNames() {
  const missing = props.modelValue.filter((id) => !userCache.value[id] && !fetchedIds.has(id));
  if (missing.length === 0) return;
  missing.forEach((id) => fetchedIds.add(id));
  let expertUsers: { id: string; name: string; username: string }[] = [];
  if (props.showEnterpriseExperts) {
    try {
      const res = await request<ListResponse<MentorOption>>('/alliance/experts/mentor-options');
      expertUsers = (res.items || [])
        .filter((o) => o.userId && missing.includes(o.userId))
        .map((o) => ({ id: o.userId as string, name: o.name, username: o.name }));
    } catch {
      /* 导师数据源加载失败不阻塞回显 */
    }
  }
  const expertIds = new Set(expertUsers.map((u) => u.id));
  const rest = missing.filter((id) => !expertIds.has(id));
  const results = await Promise.allSettled(rest.map((id) => userManagementApi.get(id)));
  const fetched = results
    .filter((r): r is PromiseFulfilledResult<User> => r.status === 'fulfilled' && !!r.value)
    .map((r) => r.value);
  if (fetched.length > 0) mergeUserCache(fetched);
  if (expertUsers.length > 0) mergeUserCache(expertUsers);
}

const visibleExperts = computed<MentorOption[]>(() => {
  if (!mentorOptions.value) return [];
  const kw = debouncedSearch.value.trim().toLowerCase();
  const excludeSet = new Set(props.excludeUserIds);
  return mentorOptions.value.filter((o) => {
    if (o.userId && excludeSet.has(o.userId)) return false;
    if (!kw) return true;
    return expertLabel(o).toLowerCase().includes(kw);
  });
});

function expertLabel(o: MentorOption): string {
  return [o.enterpriseName, o.name, o.title].filter(Boolean).join(' · ') || o.name;
}

function onExpertRowClick(row: MentorOption) {
  if (!row.userId) return;
  mergeUserCache([{ id: row.userId, name: row.name, username: row.name }]);
  toggleUser(row.userId);
}

function toggleUser(userId: string) {
  if (!props.multiple) {
    selectedIds.value = [userId];
    return;
  }
  selectedIds.value = selectedIds.value.includes(userId)
    ? selectedIds.value.filter((id) => id !== userId)
    : [...selectedIds.value, userId];
}

function removeSelected(userId: string) {
  selectedIds.value = selectedIds.value.filter((id) => id !== userId);
}

function displayName(id: string): string {
  const u = userCache.value[id] || users.value.find((x) => x.id === id);
  return u?.name || u?.username || id;
}

const triggerText = computed(() => {
  if (props.modelValue.length === 0) return props.placeholder;
  if (props.modelValue.length <= 3) return props.modelValue.map((id) => displayName(id)).join('、');
  return `已选 ${props.modelValue.length} 人`;
});

function selectAllOrg() {
  expertView.value = false;
  selectedOrgId.value = null;
  treeRef.value?.setCurrentKey(null);
}

function selectExpertView() {
  expertView.value = true;
  treeRef.value?.setCurrentKey(null);
}

function onOrgClick(node: Organization) {
  expertView.value = false;
  selectedOrgId.value = node.id;
}

function openDialog() {
  selectedIds.value = [...props.modelValue];
  open.value = true;
}

function handleConfirm() {
  emit('update:modelValue', [...selectedIds.value]);
  open.value = false;
}

watch(open, (v) => {
  if (!v) return;
  selectedIds.value = [...props.modelValue];
  void loadUsers();
  if (props.showEnterpriseExperts) void loadMentorOptions();
});

watch([selectedOrgId, debouncedSearch, expertView], () => {
  if (open.value) void loadUsers();
});

watch(
  () => props.modelValue.join(','),
  () => {
    void resolveMissingNames();
  }
);

onMounted(() => {
  void loadOrgTree();
  void resolveMissingNames();
});
</script>

<style scoped>
.trigger {
  width: 100%;
  justify-content: flex-start;
  font-weight: 400;
}
.trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trigger-text.is-placeholder {
  color: #a8abb2;
}
.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.dialog-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
.picker {
  display: flex;
  height: 56vh;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}
.org-pane {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid #ebeef5;
  overflow: auto;
  padding: 8px;
}
.org-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 4px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
}
.org-row:hover {
  background: #f5f7fa;
}
.org-row.active {
  background: #ecf5ff;
  color: #409eff;
  font-weight: 500;
}
.expert-row {
  border: 1px dashed #b3d8ff;
}
.list-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.list-search {
  padding: 10px;
  border-bottom: 1px solid #ebeef5;
}
.list-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.pane-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #909399;
}
.pane-error {
  padding: 40px 0;
  text-align: center;
  color: #f56c6c;
  font-size: 13px;
}
.dim {
  color: #909399;
}
.footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.footer-selected {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
  font-size: 13px;
}
.footer-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>

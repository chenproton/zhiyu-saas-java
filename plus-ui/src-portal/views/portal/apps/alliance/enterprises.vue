<template>
  <div class="list-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">合作企业管理</div>
            <div class="card-sub">从全局企业池引入合作企业，维护本校合作关系（评级/状态/前台展示）。</div>
          </div>
          <div class="header-actions">
            <el-button size="small" @click="openRegister">代注册企业</el-button>
            <el-button size="small" type="primary" @click="openLink">引入企业</el-button>
          </div>
        </div>
      </template>

      <div class="toolbar">
        <el-input
          v-model="search"
          placeholder="搜索企业名称或行业..."
          clearable
          style="max-width: 320px"
          @input="onSearchInput"
          @clear="onSearchClear"
          @keyup.enter="reloadList"
        />
      </div>

      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column label="企业名称" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="goDetail(row.id)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="前台展示" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.isPublic || false" @change="(v: any) => togglePublic(row, Boolean(v))" />
          </template>
        </el-table-column>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">{{ enterpriseTypeText(row.enterpriseType) }}</template>
        </el-table-column>
        <el-table-column label="地址" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.address || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ allianceLabel('enterpriseStatus', row.status) }}</template>
        </el-table-column>
        <el-table-column label="评级" width="100">
          <template #default="{ row }">{{ allianceLabel('enterpriseRating', row.rating || 'general') }}</template>
        </el-table-column>
        <el-table-column label="合作协议" width="90">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="goDetail(row.id, 'agreements')">
              {{ countBy(agreements, 'enterpriseIds', row.id) }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="合作项目" width="90">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="goDetail(row.id, 'projects')">
              {{ countBy(projects, 'enterpriseIds', row.id) }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="合作成果" width="90">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="goDetail(row.id, 'achievements')">
              {{ countBy(achievements, 'enterpriseIds', row.id) }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="120">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goDetail(row.id)">查看</el-button>
            <el-button size="small" text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" text type="danger" @click="confirmUnlink(row)">解除引入</el-button>
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
        @current-change="loadList"
      />
    </el-card>

    <!-- 引入企业 -->
    <el-dialog v-model="linkDialog" title="引入企业" width="560px">
      <p class="dialog-desc">从全局企业池搜索已注册的企业，引入后建立校企合作关系。</p>
      <div class="link-search">
        <el-input
          v-model="searchKeyword"
          placeholder="输入企业名称关键词..."
          clearable
          @keyup.enter="doSearch"
        />
        <el-button :loading="searching" @click="doSearch">搜索</el-button>
      </div>
      <div class="link-results">
        <p v-if="searchResults === null" class="empty-hint">输入关键词搜索企业</p>
        <p v-else-if="searchResults.length === 0" class="empty-hint">未找到匹配的企业</p>
        <div v-else v-for="e in searchResults" :key="e.id" class="link-result-item">
          <div class="link-result-main">
            <div class="link-result-name">{{ e.name }}</div>
            <div class="link-result-sub">{{ [e.industry, e.region].filter(Boolean).join(' · ') || '未填写行业地区' }}</div>
          </div>
          <span v-if="linkedIds.has(e.id)" class="linked-mark">已引入</span>
          <el-button
            v-else
            size="small"
            type="primary"
            :loading="linkingId === e.id"
            :disabled="linkingId !== null && linkingId !== e.id"
            @click="doLink(e.id)"
          >
            引入
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="linkDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 代注册企业 -->
    <el-dialog v-model="registerDialog" title="代注册企业" width="640px">
      <p class="dialog-desc">为企业创建账号，注册后直接建立本校合作关联；请将用户名和密码转交企业。</p>
      <el-form :model="reg" label-width="140px">
        <el-form-item label="企业名称" required>
          <el-input v-model="reg.enterpriseName" placeholder="请输入企业全称" />
        </el-form-item>
        <el-form-item label="统一社会信用代码">
          <el-input v-model="reg.unifiedSocialCreditCode" placeholder="如：91320594MA1P7XXXX1" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="reg.contactPerson" placeholder="请输入联系人姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="reg.contactPhone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="联系邮箱（选填）">
          <el-input v-model="reg.contactEmail" placeholder="请输入联系邮箱" />
        </el-form-item>
        <el-form-item label="用户名" required>
          <el-input v-model="reg.username" placeholder="设置登录用户名（企业内唯一）" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="reg.password" type="password" placeholder="设置登录密码" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认密码" required>
          <el-input v-model="reg.confirmPassword" type="password" placeholder="再次输入密码" show-password autocomplete="new-password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="registerDialog = false">取消</el-button>
        <el-button type="primary" :loading="registering" @click="doRegister">代注册并关联</el-button>
      </template>
    </el-dialog>

    <!-- 编辑合作关系 -->
    <el-dialog v-model="editDialog" title="编辑合作关系" width="520px">
      <p class="dialog-desc">企业主体信息由企业侧维护，此处仅维护本校合作关系字段。</p>
      <el-form :model="editForm" label-width="120px">
        <el-form-item label="企业类型">
          <el-select v-model="editForm.enterpriseType" style="width: 100%">
            <el-option label="合作企业" value="cooperation" />
            <el-option label="第三方雇主企业" value="third-party" />
          </el-select>
        </el-form-item>
        <el-form-item label="合作状态">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option
              v-for="opt in mergeDictOptions(statusDict, editForm.status)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合作评级">
          <el-select v-model="editForm.rating" style="width: 100%">
            <el-option
              v-for="opt in mergeDictOptions(ratingDict, editForm.rating)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联二级学院">
          <el-select v-model="editForm.secondaryColleges" multiple filterable placeholder="选择归属学院" style="width: 100%">
            <el-option v-for="name in secondaryColleges" :key="name" :label="name" :value="name" />
          </el-select>
        </el-form-item>
        <el-form-item label="前台展示">
          <el-switch v-model="editForm.isPublic" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { portalRequest, buildQuery } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { organizationApi, orgTypeApi } from '@/api/system';
import type { Organization } from '@/types/system';
import { allianceLabel, formatDate, mergeDictOptions } from './alliance-admin';
import type { AllianceEnterprise, AllianceDictItem, ListResponse } from './alliance-admin';

const router = useRouter();
const auth = useAuthStore();
const tenantId = computed(() => (auth.user?.tenantId as string) || '');

const PAGE_SIZE = 20;
const items = ref<AllianceEnterprise[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = PAGE_SIZE;
const search = ref('');

const projects = ref<{ id: string; enterpriseIds?: string[] }[]>([]);
const achievements = ref<{ id: string; enterpriseIds?: string[] }[]>([]);
const agreements = ref<{ id: string; enterpriseIds?: string[] }[]>([]);
const linkedIds = ref<Set<string>>(new Set());

const statusDict = ref<AllianceDictItem[]>([]);
const ratingDict = ref<AllianceDictItem[]>([]);
const secondaryColleges = ref<string[]>([]);

const linkDialog = ref(false);
const searchKeyword = ref('');
const searchResults = ref<AllianceEnterprise[] | null>(null);
const searching = ref(false);
const linkingId = ref<string | null>(null);

const registerDialog = ref(false);
const registering = ref(false);
const reg = reactive({
  enterpriseName: '',
  unifiedSocialCreditCode: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  username: '',
  password: '',
  confirmPassword: '',
});

const editDialog = ref(false);
const saving = ref(false);
const editItem = ref<AllianceEnterprise | null>(null);
const editForm = reactive({
  enterpriseType: 'cooperation',
  status: 'negotiating',
  rating: 'general',
  isPublic: false,
  secondaryColleges: [] as string[],
});

function enterpriseTypeText(v: string): string {
  const map: Record<string, string> = {
    cooperation: '合作企业',
    'third-party': '第三方雇主企业',
    platform: '第三方雇主企业',
    'school-based': '合作企业',
  };
  return map[v] ?? v ?? '-';
}

function countBy(arr: { enterpriseIds?: string[] }[], field: string, id: string): number {
  return arr.filter((x) => ((x as unknown as Record<string, string[] | undefined>)[field] || []).includes?.(id)).length;
}

async function loadList() {
  if (!tenantId.value) return;
  loading.value = true;
  try {
    const res = await portalRequest<ListResponse<AllianceEnterprise>>(
      `/alliance/enterprises${buildQuery({
        limit: PAGE_SIZE,
        offset: (page.value - 1) * PAGE_SIZE,
        search: search.value.trim() || undefined,
      })}`,
    );
    items.value = res.items || [];
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error((e as Error).message || '加载失败');
  } finally {
    loading.value = false;
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    loadList();
  }, 300);
}
function onSearchClear() {
  page.value = 1;
  loadList();
}
function reloadList() {
  if (searchTimer) clearTimeout(searchTimer);
  page.value = 1;
  loadList();
}

async function loadRefs() {
  if (!tenantId.value) return;
  try {
    const [proj, ach, agr, linked] = await Promise.all([
      portalRequest<ListResponse<{ id: string; enterpriseIds?: string[] }>>('/alliance/projects?limit=200'),
      portalRequest<ListResponse<{ id: string; enterpriseIds?: string[] }>>('/alliance/achievements?limit=200'),
      portalRequest<ListResponse<{ id: string; enterpriseIds?: string[] }>>('/alliance/agreements?limit=200'),
      portalRequest<ListResponse<AllianceEnterprise>>('/alliance/enterprises?limit=200'),
    ]);
    projects.value = proj.items || [];
    achievements.value = ach.items || [];
    agreements.value = agr.items || [];
    linkedIds.value = new Set((linked.items || []).map((e) => e.id));
  } catch {
    // 引用数据加载失败不阻断主流程
  }
}

async function loadSecondaryColleges() {
  if (!tenantId.value) return;
  try {
    const [treeRes, typesRes] = await Promise.all([
      organizationApi.tree({ tenantId: tenantId.value }),
      orgTypeApi.list({ tenantId: tenantId.value, limit: 1000 }),
    ]);
    const typeNameMap = new Map<string, string>();
    (typesRes.items || []).forEach((t) => typeNameMap.set(t.id, t.name));
    const collegeTypeIds = new Set<string>();
    typeNameMap.forEach((name, id) => {
      if (name === '二级学院') collegeTypeIds.add(id);
    });
    const names: string[] = [];
    const walk = (nodes: Organization[]) => {
      for (const n of nodes) {
        if (collegeTypeIds.has(n.typeId)) names.push(n.name);
        if (n.children && n.children.length) walk(n.children);
      }
    };
    walk(treeRes.items || []);
    secondaryColleges.value = Array.from(new Set(names));
  } catch {
    // 二级学院选项加载失败不阻断主流程
  }
}

async function loadDicts() {
  if (!tenantId.value) return;
  try {
    const [s, r] = await Promise.all([
      portalRequest<{ items: AllianceDictItem[] }>('/alliance/dictionaries/enterprise_status'),
      portalRequest<{ items: AllianceDictItem[] }>('/alliance/dictionaries/cooperation_rating'),
    ]);
    statusDict.value = s.items || [];
    ratingDict.value = r.items || [];
  } catch {
    // 字典加载失败时回退静态映射
  }
}

function goDetail(id: string, tab?: string) {
  router.push(`/portal/apps/alliance/enterprises/${id}${tab ? `?tab=${tab}` : ''}`);
}

async function togglePublic(item: AllianceEnterprise, v: boolean) {
  try {
    await portalRequest(`/alliance/enterprises/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isPublic: v }),
    });
    item.isPublic = v;
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

function openEdit(item: AllianceEnterprise) {
  editItem.value = item;
  editForm.enterpriseType = item.enterpriseType || 'cooperation';
  editForm.status = item.status || 'negotiating';
  editForm.rating = item.rating || 'general';
  editForm.isPublic = item.isPublic || false;
  editForm.secondaryColleges = [...(item.secondaryColleges || [])];
  editDialog.value = true;
}

async function saveEdit() {
  if (!editItem.value) return;
  saving.value = true;
  try {
    await portalRequest(`/alliance/enterprises/${editItem.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        enterpriseType: editForm.enterpriseType,
        status: editForm.status,
        rating: editForm.rating,
        isPublic: editForm.isPublic,
        secondaryColleges: editForm.secondaryColleges,
      }),
    });
    ElMessage.success('合作关系已更新');
    editDialog.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function openLink() {
  searchResults.value = null;
  searchKeyword.value = '';
  linkDialog.value = true;
}

async function doSearch() {
  searching.value = true;
  try {
    const res = await portalRequest<ListResponse<AllianceEnterprise>>(
      `/alliance/enterprises/search${buildQuery({ keyword: searchKeyword.value })}`,
    );
    searchResults.value = res.items || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '搜索失败');
  } finally {
    searching.value = false;
  }
}

async function doLink(id: string) {
  linkingId.value = id;
  try {
    await portalRequest(`/alliance/enterprises/${id}/link`, { method: 'POST' });
    ElMessage.success('企业已引入');
    linkDialog.value = false;
    searchResults.value = null;
    searchKeyword.value = '';
    await Promise.all([loadList(), loadRefs()]);
  } catch (e) {
    ElMessage.error((e as Error).message || '引入失败');
  } finally {
    linkingId.value = null;
  }
}

function openRegister() {
  Object.assign(reg, {
    enterpriseName: '',
    unifiedSocialCreditCode: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  registerDialog.value = true;
}

async function doRegister() {
  if (!reg.enterpriseName.trim() || !reg.username.trim() || !reg.password) {
    ElMessage.warning('请填写必填项');
    return;
  }
  if (reg.password !== reg.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致');
    return;
  }
  registering.value = true;
  try {
    await portalRequest('/alliance/enterprises/register', {
      method: 'POST',
      body: JSON.stringify({
        enterpriseName: reg.enterpriseName,
        unifiedSocialCreditCode: reg.unifiedSocialCreditCode || undefined,
        contactPerson: reg.contactPerson || undefined,
        contactPhone: reg.contactPhone || undefined,
        contactEmail: reg.contactEmail || undefined,
        username: reg.username,
        password: reg.password,
      }),
    });
    ElMessage.success(`代注册成功，已创建企业账号 ${reg.username}，请将用户名和密码转交企业，企业即可登录企业服务台`);
    registerDialog.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error((e as Error).message || '代注册失败');
  } finally {
    registering.value = false;
  }
}

async function confirmUnlink(item: AllianceEnterprise) {
  try {
    await ElMessageBox.confirm(
      `确定要解除与 ${item.name} 的引入关系吗？历史协议/项目/成果引用保留，但页面不再展示。`,
      '解除引入',
      { type: 'warning', confirmButtonText: '解除引入', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await portalRequest(`/alliance/enterprises/${item.id}/link`, { method: 'DELETE' });
    ElMessage.success('已解除引入');
    await Promise.all([loadList(), loadRefs()]);
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  }
}

onMounted(() => {
  loadList();
  loadRefs();
  loadSecondaryColleges();
  loadDicts();
});
</script>

<style scoped>
.list-page { padding: 16px; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-sub { margin-top: 4px; font-size: 12px; color: #909399; }
.header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar { margin-bottom: 12px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
.dialog-desc { margin: 0 0 12px; font-size: 13px; color: #909399; }
.link-search { display: flex; gap: 8px; margin-bottom: 12px; }
.link-results { max-height: 50vh; overflow-y: auto; }
.empty-hint { text-align: center; padding: 24px 0; font-size: 13px; color: #909399; }
.link-result-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; }
.link-result-main { flex: 1; min-width: 0; }
.link-result-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link-result-sub { font-size: 12px; color: #909399; }
.linked-mark { font-size: 12px; color: #909399; flex-shrink: 0; }
</style>

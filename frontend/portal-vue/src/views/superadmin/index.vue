<template>
  <!-- 鉴权中 -->
  <div v-if="authenticated === null" class="superadmin-loading">
    <el-icon class="is-loading"><Loading /></el-icon>
  </div>

  <!-- 登录 -->
  <div v-else-if="!authenticated" class="superadmin-login">
    <el-card class="login-card" shadow="always">
      <div class="login-head">
        <div class="login-icon">🛡️</div>
        <h1 class="login-title">超级管理员控制台</h1>
        <p class="login-sub">请使用平台管理员账号登录</p>
      </div>

      <el-form label-position="top" @submit.prevent="handleLogin">
        <el-form-item label="账号">
          <el-input v-model="loginUsername" placeholder="请输入平台管理员账号" :disabled="loginLoading" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginPassword" type="password" show-password placeholder="请输入密码" :disabled="loginLoading" @keyup.enter="handleLogin" />
        </el-form-item>

        <el-form-item v-if="captchaRequired" label="验证码">
          <div class="captcha-row">
            <div v-if="captchaData" class="captcha-img" title="点击刷新验证码" @click="refreshCaptcha">
              <img :src="captchaData.image" alt="验证码" />
            </div>
            <div v-else class="captcha-placeholder">{{ captchaLoading ? '验证码加载中...' : captchaError || '验证码加载失败' }}</div>
            <el-input
              v-model="captchaCode"
              placeholder="请输入验证码"
              maxlength="6"
              autocomplete="off"
              class="captcha-input"
              @keyup.enter="handleLogin"
            />
          </div>
          <div class="captcha-tip">点击图片可刷新验证码</div>
        </el-form-item>

        <el-alert v-if="loginError" :title="loginError" type="error" :closable="false" show-icon class="login-alert" />

        <el-button
          type="primary"
          class="login-btn"
          :loading="loginLoading"
          :disabled="!loginUsername || !loginPassword"
          @click="handleLogin"
        >
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>

  <!-- 主内容 -->
  <div v-else class="superadmin-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">超级管理员 - 租户管理</h1>
        <p class="page-sub">管理所有平台租户，支持增删改查</p>
      </div>
      <div class="header-actions">
        <span class="auth-user">{{ authUser }}</span>
        <el-button size="small" @click="handleLogout">退出</el-button>
        <el-button type="primary" size="small" @click="openCreate">
          {{ tenantTab === 'enterprise' ? '新建企业租户' : '新建租户' }}
        </el-button>
      </div>
    </div>

    <!-- 租户类型 Tab -->
    <div class="tab-bar">
      <button type="button" class="tab-btn" :class="{ active: tenantTab === 'school' }" @click="switchTab('school')">学校租户</button>
      <button type="button" class="tab-btn" :class="{ active: tenantTab === 'enterprise' }" @click="switchTab('enterprise')">企业租户</button>
    </div>

    <!-- 搜索 -->
    <div class="search-row">
      <el-input v-model="searchTerm" placeholder="搜索企业名称或标识..." clearable class="search-input" />
    </div>

    <!-- 平台主题配置 -->
    <el-card shadow="never" class="theme-card">
      <div class="theme-card-head">
        <div class="theme-card-icon">🎨</div>
        <div>
          <div class="theme-card-title">平台主题配置</div>
          <div class="theme-card-sub">设置全平台主题色，保存后对所有用户实时生效；可在下方租户列表中为单个租户单独配置</div>
        </div>
      </div>
      <div class="theme-card-body">
        <ThemeColorPicker
          v-model:color="themeColor"
          :submitting="themeSaving"
          :secondary="[{ label: '恢复默认' }]"
          @submit="saveTheme"
          @secondary="onPlatformThemeSecondary"
        />
      </div>
    </el-card>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="list-alert" />

    <el-card shadow="never" class="list-card">
      <el-table v-loading="loading" :data="tenants" stripe :empty-text="loading ? '加载中...' : '暂无租户'">
        <el-table-column label="租户标识" width="120">
          <template #default="{ row }"><span class="mono muted">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="租户名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="联系人" min-width="100">
          <template #default="{ row }">{{ row.contact || '-' }}</template>
        </el-table-column>
        <el-table-column label="联系电话" min-width="120">
          <template #default="{ row }"><span class="muted">{{ row.phone || '-' }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="有效期" min-width="140">
          <template #default="{ row }">
            <span class="muted nowrap">{{ validityText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="160">
          <template #default="{ row }"><span class="muted nowrap">{{ formatDate(row.createdAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="360" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openAdminModal(row)">
              {{ row.type === 'enterprise' ? '企业管理员配置' : '学校管理员配置' }}
            </el-button>
            <el-button v-if="row.type === 'enterprise'" size="small" text @click="openView(row)">查看</el-button>
            <el-button v-else size="small" text @click="openSubscription(row)">套餐配置</el-button>
            <el-button size="small" text @click="openTenantTheme(row)">主题配置</el-button>
            <el-button size="small" text @click="openEdit(row)">编辑</el-button>
            <el-button size="small" text @click="handleToggleClick(row)">{{ row.status === 'active' ? '停用' : '启用' }}</el-button>
            <el-button size="small" text type="danger" @click="handleDeleteClick(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :page-size="PAGE_SIZE"
          :current-page="page"
          @current-change="onPageChange"
        />
      </div>
    </el-card>

    <!-- 租户创建/编辑 -->
    <TenantFormDialog
      v-model="formDialogOpen"
      :editing="editingTenant"
      :tab="tenantTab"
      @saved="fetchTenants"
    />

    <!-- 企业租户详情 -->
    <EnterpriseDetailDialog v-model="viewOpen" :tenant="viewTarget" />

    <!-- 管理员列表 -->
    <AdminListDialog v-model="adminOpen" :tenant="adminTarget" />

    <!-- 订阅套餐 + AI 配置 -->
    <SubscriptionDialog v-model="subscriptionOpen" :tenant="subscriptionTarget" />

    <!-- 租户主题配置 -->
    <el-dialog v-model="tenantThemeOpen" title="租户主题配置" width="560px" :close-on-click-modal="false" @closed="tenantThemeTarget = null">
      <p class="dialog-desc">
        {{ tenantThemeTarget ? `为租户「${tenantThemeTarget.name}」单独配置主题色，该租户下所有用户生效；不配置则使用平台默认色` : '' }}
      </p>
      <ThemeColorPicker
        v-model:color="tenantThemeColor"
        :submitting="tenantThemeSaving"
        submit-label="保存"
        :secondary="tenantThemeTarget ? [{ label: '恢复平台默认' }] : []"
        @submit="onTenantThemeSubmit"
        @secondary="onTenantThemeSecondary"
      />
    </el-dialog>

    <!-- 启用/停用确认 -->
    <el-dialog v-model="toggleOpen" :title="toggleTarget ? (toggleTarget.status === 'active' ? '停用租户' : '启用租户') : ''" width="440px">
      <p>
        {{ toggleTarget ? `确定${toggleTarget.status === 'active' ? '停用' : '启用'}租户「${toggleTarget.name}」吗？` : '' }}
      </p>
      <template #footer>
        <el-button @click="toggleTarget = null">取消</el-button>
        <el-button type="primary" :loading="toggleSubmitting" @click="confirmToggleStatus">
          {{ toggleTarget && toggleTarget.status === 'active' ? '停用' : '启用' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 删除确认（需输入租户名称） -->
    <el-dialog v-model="deleteOpen" title="确认删除" width="440px" :close-on-click-modal="false" @closed="deleteTarget = null">
      <p class="dialog-desc">
        {{ deleteTarget ? `确定删除租户「${deleteTarget.name}」吗？此操作不可撤销。请输入租户名称以确认删除。` : '' }}
      </p>
      <el-input
        v-model="deleteConfirmName"
        :placeholder="deleteTarget ? `请输入租户名称「${deleteTarget.name}」` : ''"
      />
      <p v-if="deleteMismatch" class="mismatch">租户名称不匹配</p>
      <template #footer>
        <el-button @click="deleteTarget = null">取消</el-button>
        <el-button type="danger" :loading="deleteSubmitting" :disabled="!canDelete" @click="confirmDelete">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import { getToken, setToken, removeToken } from '@/api/http';
import {
  superAdminApi,
  saasAuthApi,
  fetchThemeColor,
  applyBrandColor,
  isHexColor,
  DEFAULT_BRAND_COLOR,
  getDeviceId,
  parseJwtPayload
} from '@/api/superadmin';
import type { AdminTenant, TenantType, CaptchaData } from '@/api/superadmin';
import ThemeColorPicker from './theme-color-picker.vue';
import TenantFormDialog from './tenant-form-dialog.vue';
import EnterpriseDetailDialog from './enterprise-detail-dialog.vue';
import AdminListDialog from './admin-list-dialog.vue';
import SubscriptionDialog from './subscription-dialog.vue';

const PAGE_SIZE = 20;

// ===== 鉴权 =====
const authenticated = ref<boolean | null>(null);
const authUser = ref('');
const loginUsername = ref('');
const loginPassword = ref('');
const loginLoading = ref(false);
const loginError = ref('');

const captchaRequired = ref(false);
const captchaData = ref<CaptchaData | null>(null);
const captchaCode = ref('');
const captchaLoading = ref(false);
const captchaError = ref('');

// ===== 租户列表 =====
const tenants = ref<AdminTenant[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const error = ref('');
const searchTerm = ref('');
const tenantTab = ref<TenantType>('school');
let fetchSeq = 0;
let searchTimer: number | undefined;

// ===== 平台主题 =====
const themeColor = ref(DEFAULT_BRAND_COLOR);
const themeSaving = ref(false);

// ===== 弹窗 =====
const formDialogOpen = ref(false);
const editingTenant = ref<AdminTenant | null>(null);

const viewOpen = ref(false);
const viewTarget = ref<AdminTenant | null>(null);

const adminOpen = ref(false);
const adminTarget = ref<AdminTenant | null>(null);

const subscriptionOpen = ref(false);
const subscriptionTarget = ref<AdminTenant | null>(null);

const tenantThemeOpen = ref(false);
const tenantThemeTarget = ref<AdminTenant | null>(null);
const tenantThemeColor = ref(DEFAULT_BRAND_COLOR);
const tenantThemeSaving = ref(false);

const toggleOpen = ref(false);
const toggleTarget = ref<AdminTenant | null>(null);
const toggleSubmitting = ref(false);

const deleteOpen = ref(false);
const deleteTarget = ref<AdminTenant | null>(null);
const deleteConfirmName = ref('');
const deleteSubmitting = ref(false);

const deleteMismatch = computed(
  () =>
    deleteConfirmName.value.trim() !== '' &&
    !!deleteTarget.value &&
    deleteConfirmName.value.trim() !== deleteTarget.value.name
);
const canDelete = computed(
  () => !!deleteTarget.value && deleteConfirmName.value.trim() === deleteTarget.value.name
);

// ===== 鉴权流程 =====
onMounted(() => {
  const token = getToken('saas');
  if (token) {
    try {
      const payload = parseJwtPayload(token);
      if ((payload.roleCodes as string[] | undefined)?.includes('platform_admin')) {
        authenticated.value = true;
        authUser.value = (payload.username as string) || '管理员';
      } else {
        authenticated.value = false;
        loginError.value = '当前账号不是平台管理员';
        removeToken('saas');
      }
    } catch {
      authenticated.value = false;
      removeToken('saas');
    }
  } else {
    authenticated.value = false;
  }
});

watch(authenticated, (v) => {
  if (v) {
    void loadPlatformTheme();
    void fetchTenants();
  }
});

async function refreshCaptcha() {
  captchaLoading.value = true;
  captchaError.value = '';
  captchaCode.value = '';
  try {
    captchaData.value = await saasAuthApi.captcha();
  } catch (e) {
    captchaError.value = (e as Error).message || '验证码加载失败';
    captchaData.value = null;
  } finally {
    captchaLoading.value = false;
  }
}

async function handleLogin() {
  if (captchaRequired.value && !captchaCode.value) {
    loginError.value = '请先输入验证码';
    return;
  }
  loginLoading.value = true;
  loginError.value = '';
  try {
    const data = await saasAuthApi.saasLogin({
      username: loginUsername.value,
      password: loginPassword.value,
      deviceId: getDeviceId(),
      ...(captchaRequired.value && captchaData.value
        ? { captchaId: captchaData.value.captchaId, captchaCode: captchaCode.value }
        : {})
    });
    const payload = parseJwtPayload(data.token);
    if (!(payload.roleCodes as string[] | undefined)?.includes('platform_admin')) {
      throw new Error('当前账号不是平台管理员，无权限访问');
    }
    setToken(data.token, 'saas');
    authenticated.value = true;
    authUser.value = data.user?.username || data.user?.name || '管理员';
    captchaRequired.value = false;
    captchaCode.value = '';
    captchaData.value = null;
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'captcha_required') {
      await refreshCaptcha();
      captchaRequired.value = true;
      loginError.value = '请先输入验证码后再登录';
    } else if (e.code === 'captcha_wrong') {
      await refreshCaptcha();
      loginError.value = '验证码不正确，请重试';
    } else {
      loginError.value = e.message || '登录失败';
    }
  } finally {
    loginLoading.value = false;
  }
}

function handleLogout() {
  removeToken('saas');
  authenticated.value = false;
  loginUsername.value = '';
  loginPassword.value = '';
  loginError.value = '';
  captchaRequired.value = false;
  captchaData.value = null;
  captchaCode.value = '';
}

// ===== 租户列表 =====
async function fetchTenants() {
  const seq = ++fetchSeq;
  loading.value = true;
  error.value = '';
  try {
    const res = await superAdminApi.listTenants({
      search: searchTerm.value,
      type: tenantTab.value,
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE
    });
    if (seq !== fetchSeq) return;
    tenants.value = res.items;
    total.value = res.total;
    if (res.items.length === 0 && page.value > 1) {
      page.value -= 1;
    }
  } catch (e) {
    if (seq !== fetchSeq) return;
    error.value = (e as Error).message || '加载租户列表失败';
  } finally {
    if (seq === fetchSeq) loading.value = false;
  }
}

function switchTab(tab: TenantType) {
  if (tab === tenantTab.value) return;
  tenantTab.value = tab;
  searchTerm.value = '';
  page.value = 1;
}

watch(tenantTab, () => void fetchTenants());
watch(page, () => void fetchTenants());
watch(searchTerm, () => {
  if (searchTimer) window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    page.value = 1;
    void fetchTenants();
  }, 300);
});

function onPageChange(p: number) {
  page.value = p;
}

function validityText(ten: AdminTenant): string {
  if (!ten.validFrom && !ten.validUntil) return '不限';
  return [ten.validFrom || '-', ten.validUntil || '-'].join(' ~ ');
}

function formatDate(v?: string): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('zh-CN', { hour12: false });
}

// ===== 主题 =====
async function loadPlatformTheme() {
  try {
    themeColor.value = await fetchThemeColor();
  } catch {
    // 保持默认色
  }
}

async function saveTheme(color: string) {
  if (!isHexColor(color)) {
    ElMessage.error('主题色格式错误：应为 #RRGGBB 格式');
    return;
  }
  themeSaving.value = true;
  try {
    await superAdminApi.updatePlatformTheme(color);
    applyBrandColor(color);
    window.dispatchEvent(new Event('zhiyu-theme-changed'));
    themeColor.value = color;
    ElMessage.success('主题色已保存并生效');
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    themeSaving.value = false;
  }
}

function onPlatformThemeSecondary(_index: number) {
  themeColor.value = DEFAULT_BRAND_COLOR;
  void saveTheme(DEFAULT_BRAND_COLOR);
}

async function openTenantTheme(ten: AdminTenant) {
  tenantThemeTarget.value = ten;
  tenantThemeSaving.value = false;
  tenantThemeOpen.value = true;
  try {
    tenantThemeColor.value = await fetchThemeColor(ten.id);
  } catch {
    tenantThemeColor.value = DEFAULT_BRAND_COLOR;
  }
}

async function saveTenantTheme(ten: AdminTenant, color: string) {
  if (!isHexColor(color)) {
    ElMessage.error('主题色格式错误：应为 #RRGGBB 格式');
    return;
  }
  tenantThemeSaving.value = true;
  try {
    await superAdminApi.updateTenantTheme(ten.id, color);
    tenantThemeColor.value = color;
    ElMessage.success(`已保存，租户「${ten.name}」主题色生效`);
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败');
  } finally {
    tenantThemeSaving.value = false;
  }
}

async function clearTenantTheme(ten: AdminTenant) {
  tenantThemeSaving.value = true;
  try {
    await superAdminApi.deleteTenantTheme(ten.id);
    tenantThemeColor.value = DEFAULT_BRAND_COLOR;
    ElMessage.success('已恢复平台默认主题色');
  } catch (e) {
    ElMessage.error((e as Error).message || '恢复失败');
  } finally {
    tenantThemeSaving.value = false;
  }
}

function onTenantThemeSubmit(color: string) {
  if (tenantThemeTarget.value) void saveTenantTheme(tenantThemeTarget.value, color);
}

function onTenantThemeSecondary(_index: number) {
  if (tenantThemeTarget.value) void clearTenantTheme(tenantThemeTarget.value);
}

// ===== 弹窗动作 =====
function openCreate() {
  editingTenant.value = null;
  formDialogOpen.value = true;
}

function openEdit(ten: AdminTenant) {
  editingTenant.value = ten;
  formDialogOpen.value = true;
}

function openView(ten: AdminTenant) {
  viewTarget.value = ten;
  viewOpen.value = true;
}

function openAdminModal(ten: AdminTenant) {
  adminTarget.value = ten;
  adminOpen.value = true;
}

function openSubscription(ten: AdminTenant) {
  subscriptionTarget.value = ten;
  subscriptionOpen.value = true;
}

// ===== 启用/停用 =====
function handleToggleClick(ten: AdminTenant) {
  toggleTarget.value = ten;
  toggleOpen.value = true;
}

async function confirmToggleStatus() {
  if (!toggleTarget.value) return;
  const newStatus = toggleTarget.value.status === 'active' ? 'inactive' : 'active';
  toggleSubmitting.value = true;
  try {
    await superAdminApi.updateStatus(toggleTarget.value.id, newStatus);
    ElMessage.success(newStatus === 'active' ? '启用成功' : '停用成功');
    toggleOpen.value = false;
    await fetchTenants();
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败');
  } finally {
    toggleSubmitting.value = false;
    toggleTarget.value = null;
  }
}

// ===== 删除 =====
function handleDeleteClick(ten: AdminTenant) {
  deleteConfirmName.value = '';
  deleteTarget.value = ten;
  deleteOpen.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleteSubmitting.value = true;
  try {
    await superAdminApi.deleteTenant(deleteTarget.value.id);
    ElMessage.success('删除成功');
    deleteOpen.value = false;
    await fetchTenants();
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败');
  } finally {
    deleteSubmitting.value = false;
    deleteTarget.value = null;
  }
}
</script>

<style scoped>
.superadmin-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.superadmin-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 420px;
}
.login-head {
  text-align: center;
  margin-bottom: 24px;
}
.login-icon {
  font-size: 40px;
  margin-bottom: 12px;
}
.login-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
}
.login-sub {
  color: #909399;
  font-size: 13px;
  margin: 0;
}
.login-alert {
  margin-bottom: 16px;
}
.login-btn {
  width: 100%;
}
.captcha-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.captcha-img {
  flex-shrink: 0;
  height: 32px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}
.captcha-img img {
  height: 100%;
  width: auto;
}
.captcha-placeholder {
  flex-shrink: 0;
  height: 32px;
  width: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  color: #909399;
}
.captcha-input {
  flex: 1;
  min-width: 0;
}
.captcha-tip {
  font-size: 12px;
  color: #c0c4cc;
  line-height: 1.5;
  margin-top: 4px;
}

.superadmin-page {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}
.page-sub {
  color: #909399;
  font-size: 13px;
  margin: 4px 0 0;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.auth-user {
  font-size: 13px;
  color: #909399;
}
.tab-bar {
  display: inline-flex;
  gap: 4px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 16px;
}
.tab-btn {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: #606266;
}
.tab-btn.active {
  background: #4862e4;
  color: #fff;
}
.search-row {
  margin-bottom: 16px;
}
.search-input {
  max-width: 400px;
}
.theme-card {
  margin-bottom: 16px;
}
.theme-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
}
.theme-card-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #ecf5ff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.theme-card-title {
  font-weight: 600;
  font-size: 14px;
}
.theme-card-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.list-alert {
  margin-bottom: 16px;
}
.list-card {
  min-height: 300px;
}
.mono {
  font-family: monospace;
}
.muted {
  color: #909399;
}
.nowrap {
  white-space: nowrap;
}
.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.dialog-desc {
  color: #909399;
  font-size: 13px;
  margin: 0 0 12px;
}
.mismatch {
  color: #f56c6c;
  font-size: 13px;
  margin: 8px 0 0;
}
</style>

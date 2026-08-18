<template>
  <div class="portal-login-page">
    <div class="decor">
      <div class="blob blob-1" />
      <div class="blob blob-2" />
      <div class="blob blob-3" />
    </div>

    <div class="login-panel">
      <div class="brand-area">
        <h1 class="brand-title">场景化数智教学服务平台</h1>
      </div>

      <el-card shadow="never" class="login-card">
        <div class="login-heading">
          <h2 class="login-title">账号登录</h2>
          <p class="login-subtitle">使用学校分配的账号登录系统</p>
        </div>

        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-alert" />

        <el-form label-position="top" @submit.prevent="handleSubmit">
          <el-form-item label="账号">
            <el-input v-model="username" placeholder="请输入账号" autocomplete="username" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="password"
              type="password"
              placeholder="请输入密码"
              autocomplete="current-password"
              show-password
              @keyup.enter="handleSubmit"
            />
          </el-form-item>

          <el-form-item v-if="captchaRequired" label="验证码">
            <div class="captcha-row">
              <el-input
                v-model="captchaCode"
                placeholder="请输入验证码"
                maxlength="6"
                autocomplete="off"
                @keyup.enter="handleSubmit"
              />
              <img
                v-if="captcha?.image"
                :src="captcha.image"
                alt="验证码"
                class="captcha-img"
                title="点击刷新验证码"
                @click="loadCaptcha"
              />
              <div v-else class="captcha-loading">验证码加载中...</div>
            </div>
            <div class="captcha-tip">点击图片可刷新验证码</div>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" size="large" class="submit-btn" :loading="loading" @click="handleSubmit">
              {{ loading ? '登录中...' : '登 录' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div v-if="isDev" class="dev-accounts">
          <p class="dev-title">测试账号（仅开发环境显示）：</p>
          <ul>
            <li>学校管理员：school / school123</li>
            <li>教师：teacher / teacher123</li>
            <li>学生：student / student123</li>
          </ul>
        </div>
      </el-card>

      <p class="copyright">
        版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜ 京ICP备2025105397号-1
      </p>
    </div>

    <el-dialog v-model="showTenantSelect" title="选择租户" width="420px" :close-on-click-modal="false">
      <p class="tenant-tip">您的账号关联了多个学校，请选择要登录的学校</p>
      <div class="tenant-list">
        <button
          v-for="opt in tenantOptions"
          :key="opt.tenantId"
          type="button"
          class="tenant-item"
          :disabled="selectingTenant"
          @click="handleSelectTenant(opt.tenantId)"
        >
          <span class="tenant-name">{{ opt.tenantName }}</span>
          <span class="tenant-id">{{ opt.tenantId }}</span>
        </button>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon style="margin-top: 12px" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { setToken, removeToken } from '@/api/http';
import { authApi } from '@/api/auth';
import type { CaptchaData, LoginResponse, TenantOption } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

interface RoleInfo {
  id: string;
  code: string;
}

const ROLE_PRIORITY = ['school_admin', 'teacher', 'student', 'enterprise_mentor'];
const STORAGE_PREFIX = 'zhiyu-active-role:';
const DEVICE_ID_KEY = 'zhiyu-device-id';

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function resolveActiveRole(userId: string | undefined, roles: RoleInfo[] | undefined): RoleInfo | undefined {
  if (!roles || roles.length === 0) return undefined;
  if (userId) {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + userId);
      if (saved) {
        const found = roles.find((r) => r.id === saved);
        if (found) return found;
      }
    } catch {
      // ignore storage errors
    }
  }
  for (const code of ROLE_PRIORITY) {
    const found = roles.find((r) => r.code === code);
    if (found) return found;
  }
  return roles[0];
}

function getPostLoginPath(roleCode?: string): string {
  switch (roleCode) {
    case 'school_admin':
      return '/portal/apps';
    case 'teacher':
    case 'student':
      return '/portal/workspace';
    default:
      return '/portal';
  }
}

const router = useRouter();
const auth = useAuthStore();

const isDev = import.meta.env.DEV;

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const tenantOptions = ref<TenantOption[]>([]);
let preAuthToken = '';
const showTenantSelect = ref(false);
const selectingTenant = ref(false);

const captchaRequired = ref(false);
const captcha = ref<CaptchaData | null>(null);
const captchaCode = ref('');

async function loadCaptcha() {
  try {
    captcha.value = await authApi.captcha();
  } catch (e) {
    captcha.value = null;
    error.value = (e as Error).message || '验证码加载失败';
  }
  captchaCode.value = '';
}

async function doLogin(token: string) {
  setToken(token, 'portal');
  auth.token = token;
  try {
    const me = await auth.fetchMe();
    const roles = (me.roles ?? []) as unknown as RoleInfo[];
    const activeRole = resolveActiveRole(me.user?.id, roles);
    await router.replace(getPostLoginPath(activeRole?.code));
  } catch (e) {
    removeToken('portal');
    auth.token = '';
    auth.user = null;
    throw e;
  }
}

async function handleSelectTenant(tenantId: string) {
  selectingTenant.value = true;
  try {
    const res = await authApi.selectTenant({ preAuthToken, tenantId });
    await doLogin(res.token);
  } catch (e) {
    error.value = (e as Error).message || '选择租户失败';
    showTenantSelect.value = false;
  } finally {
    selectingTenant.value = false;
  }
}

async function handleSubmit() {
  error.value = '';
  if (!username.value || !password.value) {
    error.value = '请输入账号和密码';
    return;
  }
  if (captchaRequired.value && !captchaCode.value.trim()) {
    error.value = '请先输入验证码';
    return;
  }
  loading.value = true;
  try {
    const res: LoginResponse = await authApi.portalLogin({
      username: username.value,
      password: password.value,
      deviceId: getDeviceId(),
      ...(captchaRequired.value && captcha.value && captchaCode.value.trim()
        ? { captchaId: captcha.value.captchaId, captchaCode: captchaCode.value.trim() }
        : {})
    });
    if (res.needsTenantSelection && res.preAuthToken && res.tenants) {
      tenantOptions.value = res.tenants;
      preAuthToken = res.preAuthToken;
      showTenantSelect.value = true;
      loading.value = false;
      return;
    }
    await doLogin(res.token);
  } catch (e) {
    // http.ts 只透传 error 文案、丢弃 code，故按后端稳定文案区分验证码错误
    const msg = (e as Error).message || '';
    if (msg === '请完成验证码') {
      captchaRequired.value = true;
      await loadCaptcha();
      error.value = '请先输入验证码后再登录';
    } else if (msg === '验证码不正确，请重试') {
      await loadCaptcha();
      error.value = '验证码不正确，请重试';
    } else {
      error.value = msg || '登录失败';
    }
    loading.value = false;
  }
}
</script>

<style scoped>
.portal-login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 16px;
  background: linear-gradient(135deg, #f6f9ff 0%, #f7f9fc 50%, #eef3fb 100%);
  overflow: hidden;
}
.decor { position: absolute; inset: 0; pointer-events: none; }
.blob { position: absolute; border-radius: 50%; filter: blur(60px); background: rgba(64, 158, 255, 0.12); }
.blob-1 { width: 420px; height: 420px; top: -120px; left: -120px; }
.blob-2 { width: 420px; height: 420px; bottom: -120px; right: -120px; }
.blob-3 { width: 220px; height: 220px; top: 40%; left: 55%; background: rgba(64, 158, 255, 0.08); }
.login-panel { position: relative; width: 100%; max-width: 440px; }
.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 28px;
}
.brand-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: linear-gradient(90deg, #409eff, #66b1ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.login-card {
  border-radius: 14px;
  border: 1px solid #e8ecf3;
  padding: 8px 12px;
  box-shadow: 0 16px 40px -20px rgba(64, 158, 255, 0.4);
}
.login-heading { text-align: center; margin-bottom: 16px; }
.login-title { margin: 0; font-size: 18px; font-weight: 600; color: #333; }
.login-subtitle { margin: 4px 0 0; font-size: 12px; color: #98a2b3; }
.error-alert { margin-bottom: 14px; }
.submit-btn { width: 100%; }
.captcha-row { display: flex; gap: 8px; width: 100%; align-items: center; }
.captcha-img {
  height: 40px;
  width: 110px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  flex-shrink: 0;
  object-fit: cover;
}
.captcha-loading {
  height: 40px;
  width: 110px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  color: #c0c4cc;
}
.captcha-tip { margin-top: 4px; font-size: 12px; color: #c0c4cc; line-height: 1.4; }
.dev-accounts {
  margin-top: 16px;
  padding: 12px;
  border: 1px dashed #e6ebf3;
  border-radius: 8px;
  background: #fafbfc;
  font-size: 12px;
  color: #c0c4cc;
}
.dev-title { margin: 0 0 4px; color: #909399; font-weight: 500; }
.dev-accounts ul { margin: 0; padding-left: 16px; line-height: 1.8; }
.copyright {
  margin-top: 24px;
  padding: 0 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
  color: #c0c4cc;
}
.tenant-tip { color: #606266; margin: 0 0 12px; line-height: 1.6; }
.tenant-list { display: flex; flex-direction: column; gap: 8px; }
.tenant-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
  font-size: 14px;
  color: #303133;
  transition: all 0.2s;
}
.tenant-item:hover:not(:disabled) { border-color: #409eff; color: #409eff; }
.tenant-item:disabled { cursor: not-allowed; opacity: 0.6; }
.tenant-name { font-weight: 500; }
.tenant-id { font-size: 12px; color: #c0c4cc; }
</style>

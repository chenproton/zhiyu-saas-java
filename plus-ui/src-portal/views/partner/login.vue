<template>
  <div class="partner-login-page">
    <div class="login-panel">
      <div class="brand-area">
        <h1 class="brand-title">企业服务台</h1>
      </div>

      <el-card shadow="never" class="login-card">
        <div class="tab-switch">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: tab === 'login' }"
            @click="switchTab('login')"
          >
            账号登录
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: tab === 'register' }"
            @click="switchTab('register')"
          >
            企业注册
          </button>
        </div>

        <el-alert v-if="error" :title="error" type="error" :closable="false" class="error-alert" show-icon />

        <el-form v-if="tab === 'login'" label-position="top" @submit.prevent="handleLogin">
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
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item v-if="captchaRequired" label="验证码">
            <div class="captcha-row">
              <el-input
                v-model="captchaCode"
                placeholder="请输入验证码"
                maxlength="6"
                autocomplete="off"
                @keyup.enter="handleLogin"
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
            <el-button type="primary" size="large" class="submit-btn" :loading="loading" @click="handleLogin">
              {{ loading ? '登录中...' : '登 录' }}
            </el-button>
          </el-form-item>
          <p class="form-footnote">忘记密码？请联系平台管理员重置。</p>
        </el-form>

        <el-form v-else label-position="top" @submit.prevent="handleRegister">
          <el-form-item label="企业名称">
            <el-input v-model="reg.enterpriseName" placeholder="请输入企业全称" />
          </el-form-item>
          <el-form-item label="统一社会信用代码">
            <el-input v-model="reg.unifiedSocialCreditCode" placeholder="如：91320594MA1P7XXXX1" />
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="联系人">
                <el-input v-model="reg.contactPerson" placeholder="请输入联系人姓名" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="手机号">
                <el-input v-model="reg.contactPhone" placeholder="请输入手机号" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="联系邮箱（选填）">
            <el-input v-model="reg.contactEmail" type="email" placeholder="请输入联系邮箱" />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input
              v-model="reg.username"
              placeholder="设置登录用户名（同一账号可加入多个企业）"
              autocomplete="username"
            />
          </el-form-item>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="密码">
                <el-input
                  v-model="reg.password"
                  type="password"
                  placeholder="设置登录密码"
                  autocomplete="new-password"
                  show-password
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="确认密码">
                <el-input
                  v-model="reg.confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  autocomplete="new-password"
                  show-password
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item>
            <el-button type="primary" size="large" class="submit-btn" :loading="loading" @click="handleRegister">
              {{ loading ? '注册中...' : '注册并登录' }}
            </el-button>
          </el-form-item>
          <p class="form-footnote">注册即创建企业管理员账号，无需审核，立即可用；同一用户名可加入多个企业</p>
        </el-form>
      </el-card>

      <p class="copyright">
        版权所有 © 2020-2026 杭州知与未来科技有限公司 ｜ 软件著作权登记号：2020SR0123456 ｜ 京ICP备2025105397号-1
      </p>
    </div>

    <el-dialog v-model="showTenantSelect" title="选择企业" width="420px" :close-on-click-modal="false">
      <p class="tenant-tip">您的账号关联了多个企业，请选择要登录的企业</p>
      <div class="tenant-list">
        <button
          v-for="opt in tenantOptions"
          :key="opt.tenantId"
          type="button"
          class="tenant-item"
          :disabled="selectingTenant"
          @click="handleSelectTenant(opt.tenantId)"
        >
          {{ opt.tenantName }}
        </button>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" class="error-alert" show-icon />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { setToken, partnerRequest } from '@/api/http';
import { authApi } from '@/api/auth';
import type { CaptchaData, LoginResponse, TenantOption } from '@/api/auth';
import { getDeviceId } from '@/utils/device';

interface RegisterPayload {
  enterpriseName: string;
  unifiedSocialCreditCode: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail?: string;
  username: string;
  password: string;
}

const router = useRouter();

const tab = ref<'login' | 'register'>('login');
const error = ref('');
const loading = ref(false);

const username = ref('');
const password = ref('');

// 多企业候选登录：账号关联多个企业时弹窗选择
const tenantOptions = ref<TenantOption[]>([]);
let preAuthToken = '';
const showTenantSelect = ref(false);
const selectingTenant = ref(false);

const reg = reactive({
  enterpriseName: '',
  unifiedSocialCreditCode: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  username: '',
  password: '',
  confirmPassword: ''
});

// 防爆破验证码：后端返回 captcha_required 后展示，输入完成后随登录请求提交
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

function switchTab(next: 'login' | 'register') {
  tab.value = next;
  error.value = '';
}

async function doLogin(token: string) {
  setToken(token, 'partner');
  await router.replace('/partner/workspace');
}

async function handleSelectTenant(tenantId: string) {
  selectingTenant.value = true;
  try {
    const res = await partnerRequest<LoginResponse>('/auth/select-tenant', {
      method: 'POST',
      body: JSON.stringify({ preAuthToken, tenantId })
    });
    await doLogin(res.token);
  } catch (e) {
    error.value = (e as Error).message || '选择企业失败';
    showTenantSelect.value = false;
  } finally {
    selectingTenant.value = false;
  }
}

async function handleLogin() {
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
    const res = await partnerRequest<LoginResponse>('/auth/partner/login', {
      method: 'POST',
      body: JSON.stringify({
        username: username.value,
        password: password.value,
        deviceId: getDeviceId(),
        ...(captchaRequired.value && captcha.value && captchaCode.value.trim()
          ? { captchaId: captcha.value.captchaId, captchaCode: captchaCode.value.trim() }
          : {})
      })
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

async function handleRegister() {
  error.value = '';
  if (reg.password !== reg.confirmPassword) {
    error.value = '两次输入的密码不一致';
    return;
  }
  const required: Array<[string, string]> = [
    ['企业名称', reg.enterpriseName],
    ['统一社会信用代码', reg.unifiedSocialCreditCode],
    ['联系人', reg.contactPerson],
    ['手机号', reg.contactPhone],
    ['用户名', reg.username],
    ['密码', reg.password]
  ];
  for (const [label, value] of required) {
    if (!value.trim()) {
      error.value = `请填写${label}`;
      return;
    }
  }
  loading.value = true;
  try {
    const payload: RegisterPayload = {
      enterpriseName: reg.enterpriseName.trim(),
      unifiedSocialCreditCode: reg.unifiedSocialCreditCode.trim(),
      contactPerson: reg.contactPerson.trim(),
      contactPhone: reg.contactPhone.trim(),
      contactEmail: reg.contactEmail.trim() || undefined,
      username: reg.username.trim(),
      password: reg.password
    };
    const res = await partnerRequest<LoginResponse>('/auth/partner/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await doLogin(res.token);
  } catch (e) {
    error.value = (e as Error).message || '注册失败';
    loading.value = false;
  }
}
</script>

<style scoped>
.partner-login-page {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px 48px;
  background: linear-gradient(135deg, #f6f9ff 0%, #f7f9fc 50%, #eef3fb 100%);
}
.login-panel {
  width: 100%;
  max-width: 440px;
}
.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 28px;
}
.brand-logo {
  height: 64px;
  width: auto;
  object-fit: contain;
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
  padding: 8px;
}
.tab-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #f1f2f5;
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 20px;
}
.tab-btn {
  border: none;
  background: transparent;
  padding: 8px 0;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn.active {
  background: #fff;
  color: #409eff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.error-alert {
  margin-bottom: 14px;
}
.submit-btn {
  width: 100%;
}
.captcha-row {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;
}
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
.captcha-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #c0c4cc;
  line-height: 1.4;
}
.form-footnote {
  margin: 8px 0 0;
  text-align: center;
  font-size: 12px;
  color: #c0c4cc;
  line-height: 1.6;
}
.copyright {
  margin-top: 24px;
  padding: 0 16px;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
  color: #c0c4cc;
}
.tenant-tip {
  color: #606266;
  margin: 0 0 12px;
  line-height: 1.6;
}
.tenant-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tenant-item {
  padding: 12px 14px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
  background: #fff;
  font-size: 14px;
  color: #303133;
  transition: all 0.2s;
}
.tenant-item:hover:not(:disabled) {
  border-color: #409eff;
  color: #409eff;
}
.tenant-item:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>

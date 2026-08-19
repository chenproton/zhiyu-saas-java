<template>
  <el-dialog
    :model-value="modelValue"
    :title="editing ? '编辑租户' : '新增租户'"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="onClosed"
  >
    <div class="dialog-desc">
      {{ description }}
    </div>

    <el-form label-width="130px">
      <!-- 学校：租户标识 + 状态 -->
      <template v-if="isSchool">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="租户标识" required>
              <el-input v-model="form.code" placeholder="唯一标识，创建后不可修改" :disabled="!!editing" class="mono" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width: 100%">
                <el-option label="启用" value="active" />
                <el-option label="停用" value="inactive" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </template>

      <!-- 企业创建：管理员账号 + 初始密码 -->
      <template v-if="isEnterprise && !editing">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="企业管理员用户名" required>
              <el-input v-model="entUsername" placeholder="企业登录用户名（同一账号可加入多个企业）" autocomplete="off" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="初始密码" required>
              <el-input v-model="entPassword" type="password" show-password placeholder="至少 8 位，包含字母和数字" autocomplete="new-password" />
            </el-form-item>
          </el-col>
        </el-row>
      </template>

      <el-form-item label="企业名称" required>
        <el-input v-model="form.name" placeholder="如：清华大学" />
      </el-form-item>

      <!-- 学校字段 -->
      <template v-if="isSchool">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contact" placeholder="企业联系人姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.phone" placeholder="联系电话" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="绑定域名">
              <el-input v-model="form.domain" placeholder="如：xxx.edu.cn" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="企业代码">
              <el-input v-model="form.enterpriseCode" placeholder="统一社会信用代码" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="企业地址">
          <el-input v-model="form.address" placeholder="企业详细地址" />
        </el-form-item>
        <el-form-item label="企业简介">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="企业简介描述" />
        </el-form-item>
      </template>

      <!-- 企业字段 -->
      <template v-if="isEnterprise">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="统一社会信用代码">
              <el-input v-model="entForm.creditCode" placeholder="如：91320594MA1P7XXXX1" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="entForm.contactPerson" placeholder="企业联系人姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="手机号">
              <el-input v-model="entForm.contactPhone" placeholder="联系电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系邮箱（选填）">
              <el-input v-model="entForm.contactEmail" placeholder="联系邮箱" />
            </el-form-item>
          </el-col>
        </el-row>
        <template v-if="editing">
          <el-row :gutter="12">
            <el-col :span="12">
              <el-form-item label="状态">
                <el-select v-model="form.status" style="width: 100%">
                  <el-option label="启用" value="active" />
                  <el-option label="停用" value="inactive" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="前台展示">
                <el-switch v-model="profileForm.enablePublic" active-text="对联盟前台展示" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
      </template>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="有效期开始日期">
            <el-date-picker v-model="form.validFrom" type="date" value-format="YYYY-MM-DD" placeholder="不限" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="有效期结束日期">
            <el-date-picker v-model="form.validUntil" type="date" value-format="YYYY-MM-DD" placeholder="不限" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <p class="hint">留空表示不限；有效期外租户内所有用户无法登录</p>
    </el-form>

    <el-alert v-if="viewLoadError" :title="viewLoadError" type="error" :closable="false" show-icon class="mb" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="mb" />

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!!(editing && viewLoadError)" @click="handleSubmit">
        {{ editing ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { superAdminApi } from '@/api/superadmin';
import type { AdminTenant, TenantType } from '@/api/superadmin';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*d).{8,}$/;

const props = defineProps<{
  modelValue: boolean;
  editing: AdminTenant | null;
  tab: TenantType;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const isSchool = computed(() => (props.editing ? props.editing.type !== 'enterprise' : props.tab === 'school'));
const isEnterprise = computed(() => !isSchool.value);

const description = computed(() => {
  if (isEnterprise.value) {
    return props.editing
      ? '修改企业租户信息，管理员账号不可修改'
      : '创建企业租户及企业管理员账号（与 partner 自助注册一致）';
  }
  return props.editing ? '修改租户信息，租户标识创建后不可修改' : '创建新的平台租户';
});

const submitting = ref(false);
const error = ref('');
const viewLoadError = ref('');
const viewLoading = ref(false);

const form = reactive({
  name: '',
  code: '',
  contact: '',
  phone: '',
  domain: '',
  enterpriseCode: '',
  address: '',
  description: '',
  validFrom: '',
  validUntil: '',
  status: 'active' as 'active' | 'inactive'
});

const entUsername = ref('');
const entPassword = ref('');
const entForm = reactive({ creditCode: '', contactPerson: '', contactPhone: '', contactEmail: '' });
const profileForm = reactive({
  unifiedSocialCreditCode: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  enablePublic: false
});

function resetForm() {
  form.name = '';
  form.code = '';
  form.contact = '';
  form.phone = '';
  form.domain = '';
  form.enterpriseCode = '';
  form.address = '';
  form.description = '';
  form.validFrom = '';
  form.validUntil = '';
  form.status = 'active';
  entUsername.value = '';
  entPassword.value = '';
  entForm.creditCode = '';
  entForm.contactPerson = '';
  entForm.contactPhone = '';
  entForm.contactEmail = '';
  profileForm.unifiedSocialCreditCode = '';
  profileForm.contactPerson = '';
  profileForm.contactPhone = '';
  profileForm.contactEmail = '';
  profileForm.enablePublic = false;
  error.value = '';
  viewLoadError.value = '';
}

function loadForm(ten: AdminTenant) {
  form.name = ten.name;
  form.code = ten.code;
  form.contact = ten.contact || '';
  form.phone = ten.phone || '';
  form.domain = ten.domain || '';
  form.enterpriseCode = ten.enterpriseCode || '';
  form.address = ten.address || '';
  form.description = ten.description || '';
  form.validFrom = ten.validFrom || '';
  form.validUntil = ten.validUntil || '';
  form.status = ten.status;
}

async function loadEnterpriseProfile(ten: AdminTenant) {
  viewLoading.value = true;
  viewLoadError.value = '';
  try {
    const res = await superAdminApi.getEnterprise(ten.id);
    entForm.creditCode = res.enterprise.unifiedSocialCreditCode || '';
    entForm.contactPerson = res.enterprise.contactPerson || '';
    entForm.contactPhone = res.enterprise.contactPhone || '';
    entForm.contactEmail = res.enterprise.contactEmail || '';
    profileForm.unifiedSocialCreditCode = res.enterprise.unifiedSocialCreditCode || '';
    profileForm.contactPerson = res.enterprise.contactPerson || '';
    profileForm.contactPhone = res.enterprise.contactPhone || '';
    profileForm.contactEmail = res.enterprise.contactEmail || '';
    profileForm.enablePublic = res.enterprise.enablePublic;
  } catch (e) {
    viewLoadError.value = `企业主体信息加载失败：${(e as Error).message}。请关闭弹窗后重试，避免以空白表单覆盖企业资料。`;
    ElMessage.error((e as Error).message || '加载企业信息失败');
  } finally {
    viewLoading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    resetForm();
    if (props.editing) {
      loadForm(props.editing);
      if (props.editing.type === 'enterprise') {
        void loadEnterpriseProfile(props.editing);
      }
    }
  }
);

function onClosed() {
  // 关闭后不保留表单状态
}

async function handleSubmit() {
  if (!form.name) {
    error.value = '企业名称不能为空';
    return;
  }
  if (isEnterprise.value && !props.editing) {
    if (!entUsername.value) {
      error.value = '企业管理员用户名不能为空';
      return;
    }
    if (!entPassword.value || !PASSWORD_RULE.test(entPassword.value)) {
      error.value = '密码长度至少 8 位，且需同时包含字母和数字';
      return;
    }
  }
  submitting.value = true;
  error.value = '';
  try {
    if (props.editing) {
      if (props.editing.type === 'enterprise') {
        await superAdminApi.updateEnterprise(props.editing.id, {
          name: form.name,
          unifiedSocialCreditCode: entForm.creditCode || null,
          contactPerson: entForm.contactPerson || null,
          contactPhone: entForm.contactPhone || null,
          contactEmail: entForm.contactEmail || null,
          enablePublic: profileForm.enablePublic,
          status: form.status,
          validFrom: form.validFrom || '',
          validUntil: form.validUntil || ''
        });
        ElMessage.success('更新成功');
      } else {
        await superAdminApi.updateTenant(props.editing.id, {
          name: form.name,
          contact: form.contact || null,
          phone: form.phone || null,
          domain: form.domain || null,
          enterpriseCode: form.enterpriseCode || null,
          address: form.address || null,
          description: form.description || null,
          validFrom: form.validFrom || null,
          validUntil: form.validUntil || null
        });
        ElMessage.success('更新成功');
      }
    } else if (isEnterprise.value) {
      const created = await superAdminApi.createTenant({
        name: form.name,
        type: 'enterprise',
        username: entUsername.value,
        password: entPassword.value,
        contact: entForm.contactPerson || null,
        phone: entForm.contactPhone || null,
        contactEmail: entForm.contactEmail || null,
        enterpriseCode: entForm.creditCode || null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null
      });
      if (created.adminUser) {
        ElMessage.success(
          `创建成功：管理员账号 ${created.adminUser.username || ''} ｜ 初始密码：${created.adminUser.initialPassword || ''}`
        );
      } else {
        ElMessage.success('创建成功');
      }
    } else {
      const code = form.code || 't' + Math.random().toString(36).substring(2, 9);
      await superAdminApi.createTenant({
        name: form.name,
        code,
        contact: form.contact || null,
        phone: form.phone || null,
        domain: form.domain || null,
        enterpriseCode: form.enterpriseCode || null,
        address: form.address || null,
        description: form.description || null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null
      });
      ElMessage.success('创建成功');
    }
    emit('update:modelValue', false);
    emit('saved');
  } catch (e) {
    error.value = (e as Error).message || (props.editing ? '更新失败' : '创建失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.dialog-desc {
  color: #909399;
  font-size: 13px;
  margin-bottom: 16px;
}
.mono :deep(.el-input__inner) {
  font-family: monospace;
}
.hint {
  font-size: 12px;
  color: #909399;
  margin: 0 0 4px 130px;
}
.mb {
  margin-bottom: 12px;
}
</style>

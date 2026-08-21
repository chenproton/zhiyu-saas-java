<!--
  个人中心 Tab：个人资料 / 我的荣誉奖励（仅学生）/ 账号安全 / 通知偏好。
  对齐原 React 版 profile-tab.tsx：
  - 个人资料：头像 + 姓名 + 身份行，账号信息表单（可改姓名）+ 其它信息（只读：学号/手机/邮箱/专业/班级，
    staff 变体为 工号/所属机构/手机/邮箱）；
  - 我的荣誉奖励：/portal/workspace/honors 增删改 + 证书附件上传（/files/upload）；
  - 账号安全：修改密码表单 + 手机/邮箱/微信绑定状态（手机号脱敏）+ 安全建议；
  - 通知偏好：学习通知 4 项 + 通知渠道 3 项（后端暂未提供偏好写接口，开关只读，与 React 一致）。
-->
<template>
  <div class="profile-tab">
    <el-radio-group v-model="activeSubTab" class="sub-tabs">
      <el-radio-button value="profile">个人资料</el-radio-button>
      <el-radio-button v-if="!isStaff" value="archive">我的荣誉奖励</el-radio-button>
      <el-radio-button value="security">账号安全</el-radio-button>
      <el-radio-button value="notifications">通知偏好</el-radio-button>
    </el-radio-group>

    <!-- 个人资料 -->
    <SectionCard v-if="activeSubTab === 'profile'" title="个人资料" :icon="User" icon-color="blue">
      <div class="identity-row">
        <span class="identity-avatar">{{ avatarChar }}</span>
        <div>
          <h3 class="identity-name">{{ user?.name || '—' }}</h3>
          <p class="identity-sub">{{ identityText }}</p>
        </div>
      </div>

      <div class="profile-body">
        <AccountInfoForm />

        <div class="readonly-block">
          <p class="block-label">其它信息（不可修改）</p>
          <div class="field-grid">
            <div v-for="field in readOnlyFields" :key="field.label" class="field-row">
              <label class="field-label">{{ field.label }}</label>
              <el-input :model-value="field.value" disabled />
            </div>
          </div>
        </div>
      </div>
    </SectionCard>

    <!-- 我的荣誉奖励 -->
    <SectionCard
      v-else-if="activeSubTab === 'archive' && !isStaff"
      title="我的荣誉奖励"
      :icon="Trophy"
      icon-color="purple"
      action-label="添加荣誉"
      @action="openCreate"
    >
      <p class="honor-count">共 {{ honors.length }} 项荣誉与证书</p>
      <div v-if="honorsLoading" class="empty-line">加载中...</div>
      <div v-else class="honor-list">
        <div v-for="item in honors" :key="item.id" class="honor-item">
          <span class="honor-icon"><el-icon><Trophy /></el-icon></span>
          <div class="honor-body">
            <p class="honor-name">{{ item.name }}</p>
            <p class="honor-meta">
              {{ item.issuer }}{{ item.honorDate ? ` · ${item.honorDate}` : ''
              }}{{ item.fileName ? ` · 附件：${item.fileName}` : '' }}
            </p>
          </div>
          <div class="honor-actions">
            <el-button link size="small" @click="openEdit(item)">
              <el-icon><EditPen /></el-icon>
            </el-button>
            <el-button
              link
              size="small"
              :loading="deletingId === item.id"
              @click="handleDelete(item.id)"
            >
              <el-icon class="danger"><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div v-if="honors.length === 0" class="empty-line">暂无荣誉记录，点击上方按钮配置</div>
      </div>
    </SectionCard>

    <!-- 账号安全 -->
    <SectionCard v-else-if="activeSubTab === 'security'" title="账号安全" :icon="Lock" icon-color="rose">
      <div class="security-body">
        <div class="panel">
          <p class="block-label">修改密码</p>
          <ChangePasswordForm />
        </div>

        <div class="bind-list">
          <div v-for="item in securityItems" :key="item.label" class="bind-row">
            <div class="bind-left">
              <span class="bind-icon"><el-icon :size="20"><component :is="item.icon" /></el-icon></span>
              <div>
                <p class="bind-label">{{ item.label }}</p>
                <p class="bind-status" :class="{ bound: item.status === 'bound' }">
                  {{ item.statusText }}
                </p>
              </div>
            </div>
            <span class="bind-action">{{ item.action }}</span>
          </div>
        </div>

        <div class="advice">
          <p class="advice-title"><el-icon><Lock /></el-icon><strong>安全建议</strong></p>
          <p class="advice-text">
            建议定期修改登录密码，开启二次验证，不要在公共设备上保存登录状态。
          </p>
        </div>
      </div>
    </SectionCard>

    <!-- 通知偏好 -->
    <SectionCard v-else title="通知偏好" :icon="Bell" icon-color="amber">
      <div class="notify-body">
        <div>
          <h4 class="notify-group-title">学习通知</h4>
          <div class="notify-list">
            <div v-for="item in LEARNING_NOTIFY" :key="item.key" class="notify-row">
              <div>
                <p class="notify-label">{{ item.label }}</p>
                <p class="notify-desc">{{ item.desc }}</p>
              </div>
              <el-switch :model-value="NOTIFICATIONS[item.key]" disabled />
            </div>
          </div>
        </div>

        <div class="notify-channels">
          <h4 class="notify-group-title">通知渠道</h4>
          <div class="notify-list">
            <div v-for="item in CHANNEL_NOTIFY" :key="item.key" class="notify-row">
              <div>
                <p class="notify-label">{{ item.label }}</p>
                <p class="notify-desc">{{ item.desc }}</p>
              </div>
              <el-switch :model-value="NOTIFICATIONS[item.key]" disabled />
            </div>
          </div>
        </div>
      </div>
    </SectionCard>

    <!-- 荣誉添加/编辑弹窗 -->
    <el-dialog v-model="honorDialogOpen" :title="editingId ? '编辑荣誉' : '添加荣誉'" width="480px">
      <p class="dialog-desc">荣誉名称与颁发机构为必填项，可上传证书附件。</p>
      <div class="honor-form">
        <div class="field-row">
          <label class="field-label">荣誉名称 *</label>
          <el-input v-model="form.name" placeholder="如：国家励志奖学金" />
        </div>
        <div class="field-row">
          <label class="field-label">颁发机构</label>
          <el-input v-model="form.issuer" placeholder="如：教育部" />
        </div>
        <div class="field-row">
          <label class="field-label">获得日期</label>
          <el-input v-model="form.honorDate" placeholder="如：2025-11" />
        </div>
        <div class="field-row">
          <label class="field-label">证书附件</label>
          <div class="upload-row">
            <input type="file" class="file-input" :disabled="uploading" @change="handleUpload" />
            <el-icon v-if="uploading" class="is-loading"><Loading /></el-icon>
          </div>
          <p v-if="form.fileName" class="upload-hint">已上传：{{ form.fileName }}</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="honorDialogOpen = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!form.name.trim()"
          @click="handleSave"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Bell,
  Cellphone,
  Delete,
  EditPen,
  Iphone,
  Loading,
  Lock,
  Message,
  Trophy,
  User
} from '@element-plus/icons-vue';
import { fileApi } from '@/api/import-export';
import type { Major, Organization } from '@/types/system';
import SectionCard from './SectionCard.vue';
import AccountInfoForm from './AccountInfoForm.vue';
import ChangePasswordForm from './ChangePasswordForm.vue';
import { studentHonorApi } from './workspace-api';
import type { PortalInstitution, StudentHonor } from './workspace-api';
import type { User as PortalUser } from '@/types/user';

const props = withDefaults(
  defineProps<{
    /**
     * student：学生个人中心（含荣誉奖励，只读项为 学号/手机/邮箱/专业/班级）；
     * teacher：教师个人中心（无荣誉奖励，只读项对齐 React TeacherProfileTab：工号/所属部门/专业/手机/邮箱）；
     * staff：学校管理员（无荣誉奖励，只读项为 工号/所属机构/手机/邮箱）。
     */
    variant?: 'student' | 'teacher' | 'staff';
    user?: PortalUser | null;
    major?: Major | null;
    orgNode?: Organization | null;
    institution?: PortalInstitution | null;
  }>(),
  { variant: 'student' }
);

/** 非学生变体统一不展示「我的荣誉奖励」（与 React 教师/管理员个人中心一致） */
const isStaff = computed(() => props.variant !== 'student');
const activeSubTab = ref<'profile' | 'archive' | 'security' | 'notifications'>('profile');

/* ---------- 通知偏好（后端暂无写接口，只读展示，与 React 一致） ---------- */
const NOTIFICATIONS: Record<string, boolean> = {
  course: true,
  exam: true,
  scene: true,
  position: false,
  system: true,
  email: true,
  sms: false
};
const LEARNING_NOTIFY = [
  { key: 'course', label: '课程任务提醒', desc: '当有新的课程任务或作业截止时通知我' },
  { key: 'exam', label: '考试测评提醒', desc: '当有新的考试安排或成绩发布时通知我' },
  { key: 'scene', label: '场景任务提醒', desc: '当有新的场景任务或评分反馈时通知我' },
  { key: 'position', label: '岗位推荐通知', desc: '当有匹配岗位或招聘活动上线时通知我' }
];
const CHANNEL_NOTIFY = [
  { key: 'system', label: '站内消息', desc: '在工作台消息中心接收通知' },
  { key: 'email', label: '邮件通知', desc: '发送通知到绑定邮箱' },
  { key: 'sms', label: '短信通知', desc: '发送通知到绑定手机' }
];

/* ---------- 个人资料 ---------- */
const avatarChar = computed(() => props.user?.name?.charAt(0)?.toUpperCase() || 'U');

const identityText = computed(() => {
  const parts =
    props.variant === 'student'
      ? [props.major?.name, props.orgNode?.name]
      : props.variant === 'teacher'
        ? [props.orgNode?.name, props.major?.name]
        : [props.orgNode?.name, props.institution?.name];
  return parts.filter(Boolean).join(' · ') || '暂无身份信息';
});

const readOnlyFields = computed(() => {
  if (props.variant === 'teacher') {
    return [
      { label: '工号', value: props.user?.workId || '—' },
      { label: '所属部门', value: props.orgNode?.name || '—' },
      { label: '专业', value: props.major?.name || '—' },
      { label: '手机号', value: props.user?.phone || '—' },
      { label: '邮箱', value: props.user?.email || '—' }
    ];
  }
  if (props.variant === 'staff') {
    return [
      { label: '工号', value: props.user?.workId || '—' },
      { label: '所属机构', value: props.institution?.name || '—' },
      { label: '手机号', value: props.user?.phone || '—' },
      { label: '邮箱', value: props.user?.email || '—' }
    ];
  }
  return [
    { label: '学号', value: props.user?.studentNo || '—' },
    { label: '手机号', value: props.user?.phone || '—' },
    { label: '邮箱', value: props.user?.email || '—' },
    { label: '专业', value: props.major?.name || '—' },
    { label: '班级', value: props.orgNode?.name || '—' }
  ];
});

/** 手机号脱敏：长号码保留前 3 后 4；短号码（<8 位）仅保留首尾各 1 位，避免遮蔽段重叠泄露 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '*'.repeat(phone.length);
  if (phone.length < 8) {
    return `${phone.slice(0, 1)}${'*'.repeat(phone.length - 2)}${phone.slice(-1)}`;
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

const securityItems = computed(() => [
  {
    label: '手机绑定',
    status: 'bound',
    statusText: props.user?.phone ? maskPhone(props.user.phone) : '未绑定',
    action: props.user?.phone ? '更换' : '绑定',
    icon: Cellphone
  },
  {
    label: '邮箱绑定',
    status: props.user?.email ? 'bound' : 'unbound',
    statusText: props.user?.email ? '已绑定' : '未绑定',
    action: props.user?.email ? '更换' : '绑定',
    icon: Message
  },
  { label: '微信绑定', status: 'unbound', statusText: '未绑定', action: '绑定', icon: Iphone }
]);

/* ---------- 荣誉奖励 ---------- */
interface HonorForm {
  name: string;
  issuer: string;
  honorDate: string;
  fileName: string;
  fileUrl: string;
}

const honors = ref<StudentHonor[]>([]);
const honorsLoading = ref(true);
const honorDialogOpen = ref(false);
const editingId = ref<string | null>(null);
const form = reactive<HonorForm>({ name: '', issuer: '', honorDate: '', fileName: '', fileUrl: '' });
const saving = ref(false);
const uploading = ref(false);
const deletingId = ref<string | null>(null);

function resetForm() {
  form.name = '';
  form.issuer = '';
  form.honorDate = '';
  form.fileName = '';
  form.fileUrl = '';
}

async function loadHonors() {
  honorsLoading.value = true;
  try {
    const res = await studentHonorApi.list();
    honors.value = res.items || [];
  } catch {
    honors.value = [];
  } finally {
    honorsLoading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  resetForm();
  honorDialogOpen.value = true;
}

function openEdit(item: StudentHonor) {
  editingId.value = item.id;
  form.name = item.name;
  form.issuer = item.issuer || '';
  form.honorDate = item.honorDate || '';
  form.fileName = item.fileName || '';
  form.fileUrl = item.fileUrl || '';
  honorDialogOpen.value = true;
}

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const res = await fileApi.upload(file);
    form.fileName = res.name;
    form.fileUrl = res.url;
  } catch {
    // 上传失败保持原状
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

async function handleSave() {
  if (!form.name.trim()) return;
  saving.value = true;
  try {
    const payload = {
      name: form.name,
      issuer: form.issuer,
      honorDate: form.honorDate,
      fileName: form.fileName,
      fileUrl: form.fileUrl
    };
    if (editingId.value) {
      await studentHonorApi.update(editingId.value, payload);
    } else {
      await studentHonorApi.create(payload);
    }
    honorDialogOpen.value = false;
    await loadHonors();
  } catch (e) {
    // 保存失败保持弹窗并提示
    ElMessage.error((e as Error).message || '保存失败，请稍后重试');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id: string) {
  deletingId.value = id;
  try {
    await studentHonorApi.remove(id);
    honors.value = honors.value.filter((h) => h.id !== id);
  } catch (e) {
    ElMessage.error((e as Error).message || '删除失败，请稍后重试');
  } finally {
    deletingId.value = null;
  }
}

onMounted(() => {
  if (!isStaff.value) void loadHonors();
});
</script>

<style scoped>
.profile-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sub-tabs {
  flex-wrap: wrap;
}

/* 个人资料 */
.identity-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.identity-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.identity-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}
.identity-sub {
  margin: 4px 0 0;
  font-size: 14px;
  color: #6b7280;
}
.profile-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.readonly-block {
  border-top: 1px solid #f3f4f6;
  padding-top: 20px;
}
.block-label {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}
.field-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}
@media (min-width: 768px) {
  .field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 13px;
  color: #374151;
}

/* 荣誉 */
.honor-count {
  margin: 0 0 12px;
  font-size: 12px;
  color: #6b7280;
}
.honor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.honor-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  background: #fff;
}
.honor-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #fffbeb;
  color: #f59e0b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.honor-body {
  flex: 1;
  min-width: 0;
}
.honor-name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.honor-meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.honor-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.danger {
  color: #fb7185;
}
.empty-line {
  padding: 32px 0;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}

/* 账号安全 */
.security-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.panel {
  padding: 16px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
}
.bind-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bind-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
}
.bind-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bind-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #f9fafb;
  color: #6b7280;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.bind-label {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}
.bind-status {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}
.bind-status.bound {
  color: #059669;
}
.bind-action {
  font-size: 12px;
  color: #9ca3af;
}
.advice {
  padding: 16px;
  border: 1px solid #ffe4e6;
  border-radius: 12px;
  background: #fff1f2;
}
.advice-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #111827;
}
.advice-title :deep(.el-icon) {
  color: #f43f5e;
}
.advice-text {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}

/* 通知偏好 */
.notify-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.notify-channels {
  border-top: 1px solid #f3f4f6;
  padding-top: 16px;
}
.notify-group-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.notify-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.notify-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: #f9fafb;
}
.notify-label {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}
.notify-desc {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

/* 弹窗 */
.dialog-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #6b7280;
}
.honor-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.upload-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.file-input {
  font-size: 12px;
  color: #6b7280;
}
.upload-hint {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

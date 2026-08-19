<!--
  个人中心 Tab（教师）。
  对齐 React frontend/edu/app/portal/workspace/_components/teacher-profile-tab.tsx（226 行）：
  - 三个子页：个人资料 / 账号安全 / 通知偏好；
  - 个人资料：头像 + 姓名 + 「部门 · 专业」身份行，账号信息表单（可改姓名，复用 AccountInfoForm）
    + 其它信息（不可修改：工号 / 所属部门 / 专业 / 手机号 / 邮箱，三列栅格）；
  - 账号安全：修改密码（复用 ChangePasswordForm）+ 安全条目列表（React 侧 teacherSecurityItems 为空数组，
    Vue 同源保持空态）+ 教师账号安全建议；
  - 通知偏好：教学通知 4 项（课程动态/考试与成绩/教学管理/系统维护）+ 通知渠道 2 项（邮件/短信），
    后端暂无偏好写接口，开关只读（与 React 一致）。
-->
<template>
  <div class="teacher-profile">
    <el-radio-group v-model="activeSubTab" class="sub-tabs">
      <el-radio-button value="profile">个人资料</el-radio-button>
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

    <!-- 账号安全 -->
    <SectionCard v-else-if="activeSubTab === 'security'" title="账号安全" :icon="Lock" icon-color="rose">
      <div class="security-body">
        <div class="panel">
          <p class="block-label">修改密码</p>
          <ChangePasswordForm />
        </div>

        <div v-if="teacherSecurityItems.length > 0" class="bind-list">
          <div v-for="item in teacherSecurityItems" :key="item.label" class="bind-row">
            <div class="bind-left">
              <span class="bind-icon"><el-icon :size="20"><Lock /></el-icon></span>
              <div>
                <p class="bind-label">{{ item.label }}</p>
                <p
                  class="bind-status"
                  :class="{ bound: item.status === 'strong' || item.status === 'bound' }"
                >
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
            建议定期修改登录密码，教师账号涉及成绩管理等敏感操作，请务必确保账号安全。
          </p>
        </div>
      </div>
    </SectionCard>

    <!-- 通知偏好 -->
    <SectionCard v-else title="通知偏好" :icon="Bell" icon-color="amber">
      <div class="notify-body">
        <div>
          <h4 class="notify-group-title">教学通知</h4>
          <div class="notify-list">
            <div v-for="item in TEACHING_NOTIFY" :key="item.key" class="notify-row">
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Bell, Lock, User } from '@element-plus/icons-vue';
import type { Major, Organization } from '@/types/system';
import type { User as PortalUser } from '@/types/user';
import SectionCard from './SectionCard.vue';
import AccountInfoForm from './AccountInfoForm.vue';
import ChangePasswordForm from './ChangePasswordForm.vue';
import { teacherSecurityItems } from './workspace-teacher-types';

const props = defineProps<{
  user?: PortalUser | null;
  major?: Major | null;
  orgNode?: Organization | null;
}>();

const activeSubTab = ref<'profile' | 'security' | 'notifications'>('profile');

/* 通知偏好（后端暂无写接口，只读展示，与 React 一致） */
const NOTIFICATIONS: Record<string, boolean> = {
  course: true,
  exam: true,
  teaching: true,
  system: true,
  email: true,
  sms: false
};
const TEACHING_NOTIFY = [
  { key: 'course', label: '课程动态提醒', desc: '当学生提交作业或课程有新进展时通知我' },
  { key: 'exam', label: '考试与成绩提醒', desc: '当考试安排变动或成绩需要录入时通知我' },
  { key: 'teaching', label: '教学管理通知', desc: '当有新的教学安排、教务通知时通知我' },
  { key: 'system', label: '系统维护通知', desc: '当系统有更新维护时有新通知时提醒' }
];
const CHANNEL_NOTIFY = [
  { key: 'email', label: '邮件通知', desc: '发送通知到绑定邮箱' },
  { key: 'sms', label: '短信通知', desc: '发送通知到绑定手机（紧急事项）' }
];

const user = computed(() => props.user);
const avatarChar = computed(() => props.user?.name?.charAt(0)?.toUpperCase() || 'U');

const identityText = computed(
  () => [props.orgNode?.name, props.major?.name].filter(Boolean).join(' · ') || '暂无身份信息'
);

const readOnlyFields = computed(() => [
  { label: '工号', value: props.user?.workId || '—' },
  { label: '所属部门', value: props.orgNode?.name || '—' },
  { label: '专业', value: props.major?.name || '—' },
  { label: '手机号', value: props.user?.phone || '—' },
  { label: '邮箱', value: props.user?.email || '—' }
]);
</script>

<style scoped>
.teacher-profile {
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
  padding-bottom: 24px;
  border-bottom: 1px solid #f3f4f6;
}
.identity-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
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
  .field-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
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
</style>

<!--
  审批中心 Tab（学校管理员）。
  对齐原 React 版 school-admin-approvals-tab.tsx（113 行）：
  - 数据源：GET /portal/workspace/dashboard?role=school_admin 的 todos（待审批项）；
  - 顶部 4 卡：待审批总数 + 前 3 项待审批（标题去掉「待审批」字样）；
  - 「待审批事项清单」：每项按 todo.id / 类型映射到对应域审批中心（课程/场景/岗位/题库/试卷/培养方案/教学计划），
    空态「暂无待审批事项」。
-->
<template>
  <div class="admin-approvals">
    <div class="stat-grid">
      <div class="stat-card total">
        <div>
          <p class="stat-label">待审批总数</p>
          <p class="stat-value">{{ total }}</p>
        </div>
        <span class="stat-icon"><el-icon :size="22"><Tickets /></el-icon></span>
      </div>
      <div v-for="item in todos.slice(0, 3)" :key="item.id" class="stat-card plain">
        <div>
          <p class="stat-sub">{{ item.title.replace('待审批', '') }}</p>
          <p class="stat-num">{{ item.count }}</p>
        </div>
      </div>
    </div>

    <SectionCard title="待审批事项清单" :icon="Checked" icon-color="rose">
      <div class="approval-list">
        <div v-if="todos.length === 0" class="empty-line">暂无待审批事项</div>
        <div
          v-for="item in todos"
          :key="item.id"
          class="approval-item"
          :class="{ disabled: !approvalPath(item.id) }"
          @click="go(approvalPath(item.id))"
        >
          <div class="approval-left">
            <span class="approval-icon"><el-icon :size="20"><Tickets /></el-icon></span>
            <div>
              <p class="approval-title">{{ item.title }}</p>
              <p class="approval-desc">点击前往对应审批中心处理</p>
            </div>
          </div>
          <div class="approval-right">
            <el-tag size="small" type="danger" effect="light">{{ item.count }}</el-tag>
            <el-icon class="approval-arrow"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowRight, Checked, Tickets } from '@element-plus/icons-vue';
import SectionCard from './SectionCard.vue';
import { workspaceDashboardApi } from './workspace-api';
import type { WorkspaceTodo } from './workspace-api';

/** todo.id → 域审批中心（对齐 React approvalHrefMap） */
const APPROVAL_HREF_MAP: Record<string, string> = {
  'pending-course': '/lesson/admin/approvals',
  'pending-scenario': '/scene/approvals',
  'pending-career_position': '/job/approvals',
  'pending-question_bank': '/evaluation/approvals',
  'pending-exam': '/evaluation/approvals',
  'pending-training_program': '/affairs/approvals',
  'pending-teaching_plan': '/affairs/approvals'
};

/** 资源类型 → 域审批中心（对齐 React typeHrefMap，兼容 id 去掉 pending- 前缀的形态） */
const TYPE_HREF_MAP: Record<string, string> = {
  course: '/lesson/admin/approvals',
  scenario: '/scene/approvals',
  career_position: '/job/approvals',
  question_bank: '/evaluation/approvals',
  exam: '/evaluation/approvals',
  training_program: '/affairs/approvals',
  teaching_plan: '/affairs/approvals'
};

const router = useRouter();
const todos = ref<WorkspaceTodo[]>([]);

const total = computed(() => todos.value.reduce((acc, item) => acc + item.count, 0));

function approvalPath(id: string): string {
  return APPROVAL_HREF_MAP[id] || TYPE_HREF_MAP[id.replace('pending-', '')] || '';
}

function go(path: string) {
  if (path) void router.push(path);
}

onMounted(async () => {
  try {
    const res = await workspaceDashboardApi.get({ role: 'school_admin' });
    todos.value = res.todos || [];
  } catch (e) {
    ElMessage.error((e as Error).message || '加载待审批事项失败');
  }
});
</script>

<style scoped>
.admin-approvals {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 768px) {
  .stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.stat-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
}
.stat-card.total {
  background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-primary-light-3));
  color: #fff;
}
.stat-card.plain {
  background: linear-gradient(135deg, #fff, rgba(249, 250, 251, 0.5));
  border: 1px solid #f3f4f6;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.stat-label {
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
}
.stat-value {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}
.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.stat-sub {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.stat-num {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

/* 清单 */
.approval-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.approval-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: rgba(249, 250, 251, 0.5);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.approval-item:hover {
  background: #fff;
  border-color: var(--el-color-primary-light-7);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.approval-item.disabled {
  cursor: default;
}
.approval-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.approval-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #f3f4f6;
  color: var(--el-color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.approval-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.approval-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.approval-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.approval-arrow {
  color: #d1d5db;
}
.approval-item:hover .approval-arrow {
  color: var(--el-color-primary);
}
.empty-line {
  padding: 48px 0;
  text-align: center;
  font-size: 14px;
  color: #9ca3af;
}
</style>

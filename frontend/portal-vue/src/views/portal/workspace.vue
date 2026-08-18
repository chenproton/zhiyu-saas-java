<template>
  <div class="workspace">
    <h2 class="page-title">工作台</h2>
    <el-alert v-if="auth.user" type="success" :title="`欢迎回来，${auth.user.name}`" :closable="false" style="margin-bottom: 16px" />

    <h3 class="section-title">常用功能</h3>
    <el-row :gutter="16">
      <el-col v-for="q in quickLinks" :key="q.href" :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover" class="quick-card" @click="$router.push(q.href)">
          <el-icon :color="q.color" :size="28"><component :is="q.icon" /></el-icon>
          <div class="quick-label">{{ q.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <h3 class="section-title">跨平台功能</h3>
    <el-row :gutter="16">
      <el-col v-for="q in crossLinks" :key="q.href" :xs="12" :sm="8" :md="6" :lg="4">
        <el-card shadow="hover" class="quick-card" @click="$router.push(q.href)">
          <el-icon :color="q.color" :size="28"><component :is="q.icon" /></el-icon>
          <div class="quick-label">{{ q.label }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { Briefcase, Grid, Reading, DataAnalysis, Share, UserFilled, Calendar, MagicStick, Checked, SetUp, Download } from '@element-plus/icons-vue';

const auth = useAuthStore();

const quickLinks = [
  { label: '岗位', href: '/job/positions', icon: Briefcase, color: '#e6a23c' },
  { label: '场景', href: '/scene/scenarios', icon: Grid, color: '#67c23a' },
  { label: '课程', href: '/lesson/courses', icon: Reading, color: '#409eff' },
  { label: '试卷', href: '/evaluation/exams', icon: DataAnalysis, color: '#f56c6c' },
  { label: '资源库', href: '/library/resources', icon: Share, color: '#909399' },
  { label: '联盟项目', href: '/alliance/projects', icon: UserFilled, color: '#9c27b0' },
  { label: '人培方案', href: '/affairs/programs', icon: Calendar, color: '#e6a23c' },
  { label: 'AI 对话', href: '/ai/chat', icon: MagicStick, color: '#8e44ad' }
];

const crossLinks = [
  { label: '审批中心', href: '/approvals', icon: Checked, color: '#67c23a' },
  { label: '审批流程', href: '/workflows', icon: SetUp, color: '#409eff' },
  { label: '导入导出', href: '/import-export', icon: Download, color: '#909399' }
];
</script>

<style scoped>
.workspace { padding: 8px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
.section-title { font-size: 15px; font-weight: 600; margin: 20px 0 12px; color: #303133; }
.quick-card { text-align: center; cursor: pointer; margin-bottom: 16px; }
.quick-label { margin-top: 8px; font-size: 13px; color: #606266; }
</style>

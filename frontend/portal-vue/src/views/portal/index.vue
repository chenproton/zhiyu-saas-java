<template>
  <div class="home">
    <div class="hero">
      <h1 class="hero-title">知与 SaaS 业务门户</h1>
      <p class="hero-sub">以产业需求为牵引 · 以学生能力为中心 · 以场景实践为载体</p>
      <div class="hero-actions">
        <el-button type="primary" size="large" @click="$router.push('/portal/apps')">进入应用中心</el-button>
        <el-button size="large" @click="$router.push('/portal/workspace')">前往工作台</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="features">
      <el-col v-for="f in features" :key="f.id" :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="feature-card" @click="$router.push(f.href)">
          <el-icon :color="f.color" :size="32"><component :is="f.icon" /></el-icon>
          <div class="feature-title">{{ f.label }}</div>
          <div class="feature-desc">{{ f.desc }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { Briefcase, Grid, Reading, DataAnalysis, Share, UserFilled, Calendar, MagicStick } from '@element-plus/icons-vue';

const features = [
  { id: 'career', label: '职业岗位学习平台', desc: '岗位能力建模与人才培养', href: '/job/landing', icon: Briefcase, color: '#e6a23c' },
  { id: 'scene', label: '实践场景学习平台', desc: '场景任务链与实训', href: '/scene/landing', icon: Grid, color: '#67c23a' },
  { id: 'course', label: '数字课程服务平台', desc: '体系课/颗粒课/混合课', href: '/lesson/landing', icon: Reading, color: '#409eff' },
  { id: 'ability', label: '能力评价与测评', desc: '题库/试卷/能力认证', href: '/evaluation/landing', icon: DataAnalysis, color: '#f56c6c' },
  { id: 'resource', label: '教学资源共享', desc: '资源库/标签/现场问答', href: '/library/landing', icon: Share, color: '#909399' },
  { id: 'alliance', label: '产教协同运营', desc: '联盟项目/协议/成果/品牌', href: '/alliance/projects', icon: UserFilled, color: '#9c27b0' },
  { id: 'affairs', label: '教务服务', desc: '人培方案/批次/教学计划', href: '/affairs/programs', icon: Calendar, color: '#e6a23c' },
  { id: 'ai', label: 'AI 智能服务', desc: '智能体/知识库/对话', href: '/ai/chat', icon: MagicStick, color: '#8e44ad' }
];
</script>

<style scoped>
.home { padding: 8px; }
.hero {
  text-align: center;
  padding: 48px 16px;
  background: linear-gradient(135deg, #409eff 0%, #8e44ad 100%);
  border-radius: 12px;
  color: #fff;
  margin-bottom: 24px;
}
.hero-title { font-size: 28px; font-weight: 700; margin: 0; }
.hero-sub { opacity: 0.9; margin: 12px 0 24px; }
.hero-actions { display: flex; gap: 12px; justify-content: center; }
.features { margin-top: 8px; }
.feature-card { text-align: center; cursor: pointer; margin-bottom: 16px; }
.feature-title { font-weight: 600; margin-top: 8px; }
.feature-desc { font-size: 12px; color: #909399; margin-top: 4px; }
</style>

<template>
  <div class="apps-page">
    <h2 class="page-title">应用中心</h2>
    <p class="page-sub">选择平台进入对应管理功能</p>

    <el-row :gutter="16">
      <el-col v-for="p in platforms" :key="p.id" :xs="24" :sm="12" :md="8" :lg="6">
        <el-card shadow="hover" class="platform-card">
          <template #header>
            <div class="platform-header">
              <el-icon :color="p.color" :size="20"><component :is="p.icon" /></el-icon>
              <span class="platform-title">{{ p.label }}</span>
            </div>
          </template>
          <div class="module-list">
            <div v-for="m in p.modules" :key="m.href" class="module-item" @click="$router.push(m.href)">
              <span>{{ m.label }}</span>
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ArrowRight, Setting, Briefcase, Grid, Reading, DataAnalysis, Share, UserFilled, Calendar, MagicStick } from '@element-plus/icons-vue';

const platforms = [
  {
    id: 'system',
    label: '系统管理',
    icon: Setting,
    color: '#409eff',
    modules: [
      { label: '组织机构', href: '/system/organizations' },
      { label: '组织类型', href: '/system/org-types' },
      { label: '角色管理', href: '/system/roles' },
      { label: '用户管理', href: '/users' },
      { label: '专业管理', href: '/system/majors' },
      { label: '行业管理', href: '/system/industries' }
    ]
  },
  {
    id: 'career',
    label: '职业岗位学习平台',
    icon: Briefcase,
    color: '#e6a23c',
    modules: [
      { label: '岗位资源管理', href: '/job/positions' },
      { label: '岗位批次', href: '/job/batches' },
      { label: '学习路径', href: '/job/learn-roads' },
      { label: '岗位推荐', href: '/job/recommend' },
      { label: '岗位归档', href: '/job/archive' }
    ]
  },
  {
    id: 'scene',
    label: '实践场景学习平台',
    icon: Grid,
    color: '#67c23a',
    modules: [
      { label: '场景资源管理', href: '/scene/scenarios' },
      { label: '场景批次', href: '/scene/batches' },
      { label: '场景归档', href: '/scene/archive' }
    ]
  },
  {
    id: 'course',
    label: '数字课程服务平台',
    icon: Reading,
    color: '#409eff',
    modules: [
      { label: '课程管理', href: '/lesson/courses' },
      { label: '课程批次', href: '/lesson/batches' },
      { label: '课程归档', href: '/lesson/archive' }
    ]
  },
  {
    id: 'ability',
    label: '能力评价与测评资源管理平台',
    icon: DataAnalysis,
    color: '#f56c6c',
    modules: [
      { label: '试卷管理', href: '/evaluation/exams' },
      { label: '题库管理', href: '/evaluation/question-banks' },
      { label: '岗位能力认定', href: '/evaluation/job-ability' },
      { label: '考试使用', href: '/evaluation/exam-usage' },
      { label: '课程节点评价', href: '/evaluation/lesson-results' },
      { label: '场景任务评价', href: '/evaluation/scene-results' },
      { label: '测评批次', href: '/evaluation/batches' },
      { label: '试卷归档', href: '/evaluation/archive' }
    ]
  },
  {
    id: 'resource',
    label: '教学资源共享服务平台',
    icon: Share,
    color: '#909399',
    modules: [
      { label: '教学资源库', href: '/library/resources' },
      { label: '标签管理', href: '/library/tags' },
      { label: '现场问答', href: '/library/questions' },
      { label: '知识点', href: '/library/knowledge' },
      { label: '能力点', href: '/library/ability' },
      { label: '证书库', href: '/library/certificates' },
      { label: '我的资源', href: '/library/my-resources' }
    ]
  },
  {
    id: 'alliance',
    label: '产教协同与人才品牌运营平台',
    icon: UserFilled,
    color: '#9c27b0',
    modules: [
      { label: '联盟项目', href: '/alliance/projects' },
      { label: '联盟协议', href: '/alliance/agreements' },
      { label: '联盟成果', href: '/alliance/achievements' },
      { label: '联盟品牌', href: '/alliance/brands' }
    ]
  },
  {
    id: 'affairs',
    label: '教务服务平台',
    icon: Calendar,
    color: '#e6a23c',
    modules: [
      { label: '人培方案', href: '/affairs/programs' },
      { label: '教学计划', href: '/affairs/teaching-plans' },
      { label: '学生管理', href: '/affairs/students' },
      { label: '教职工管理', href: '/affairs/teachers' },
      { label: '排课管理', href: '/affairs/scheduling' },
      { label: '场地与节次', href: '/affairs/scheduling-config' },
      { label: '教务批次', href: '/affairs/batches' },
      { label: '方案归档', href: '/affairs/archive' }
    ]
  },
  {
    id: 'partner',
    label: '产教融合合作平台',
    icon: Share,
    color: '#409eff',
    modules: [
      { label: '共建场景', href: '/partner/co-build-scenarios' },
      { label: '共建岗位', href: '/partner/co-build-positions' },
      { label: '就业项目', href: '/partner/employment-projects' },
      { label: '就业岗位', href: '/partner/employment-jobs' },
      { label: '专家库', href: '/partner/experts' },
      { label: '企业信息', href: '/partner/enterprise' },
      { label: '合作内容', href: '/partner/cooperation' },
      { label: '合作学校', href: '/partner/schools' },
      { label: '测评任务', href: '/partner/tasks' },
      { label: '账号安全', href: '/partner/settings' },
      { label: '合作工作台', href: '/partner/workspace' }
    ]
  },
  {
    id: 'ai',
    label: 'AI 智能服务平台',
    icon: MagicStick,
    color: '#8e44ad',
    modules: [
      { label: 'AI 广场', href: '/ai/square' },
      { label: 'AI 智能体', href: '/ai/agents' },
      { label: 'AI 知识库', href: '/ai/kbs' },
      { label: 'AI 对话', href: '/ai/chat' },
      { label: '智能体管理', href: '/ai/admin/agents' },
      { label: '知识库管理', href: '/ai/admin/kbs' },
      { label: '内容审核', href: '/ai/admin/reviews' },
      { label: '外部 AI 服务', href: '/ai/admin/integrations' }
    ]
  }
];
</script>

<style scoped>
.apps-page { padding: 8px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0; }
.page-sub { color: #909399; margin: 8px 0 20px; }
.platform-card { margin-bottom: 16px; }
.platform-header { display: flex; align-items: center; gap: 8px; }
.platform-title { font-weight: 600; }
.module-list { display: flex; flex-direction: column; gap: 4px; }
.module-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: #606266;
  font-size: 13px;
}
.module-item:hover {
  background: #f5f7fa;
  color: #409eff;
}
</style>

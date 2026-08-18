import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { getToken } from '@/api/http';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login.vue'),
    meta: { public: true }
  },
  {
    path: '/job/landing',
    name: 'JobLanding',
    component: () => import('@/views/landing/job.vue'),
    meta: { public: true }
  },
  {
    // 岗位详情（公开 landing 子页，对齐 React /job/landing/[id]）
    path: '/job/landing/:id',
    name: 'JobLandingDetail',
    component: () => import('@/views/landing/job-detail.vue'),
    meta: { public: true }
  },
  {
    // 岗位学习页（公开 landing 子页，对齐 React /job/landing/[id]/learn）
    path: '/job/landing/:id/learn',
    name: 'JobLandingLearn',
    component: () => import('@/views/landing/job-learn.vue'),
    meta: { public: true }
  },
  {
    path: '/scene/landing',
    name: 'SceneLanding',
    component: () => import('@/views/landing/scene.vue'),
    meta: { public: true }
  },
  {
    path: '/lesson/landing',
    name: 'LessonLanding',
    component: () => import('@/views/landing/lesson.vue'),
    meta: { public: true }
  },
  {
    // 课程详情（公开 landing 子页，对齐 React /lesson/landing/[id]）
    path: '/lesson/landing/:id',
    name: 'LessonLandingDetail',
    component: () => import('@/views/landing/lesson-detail.vue'),
    meta: { public: true }
  },
  {
    // 课程学习页（公开 landing 子页，对齐 React /lesson/landing/[id]/learn）
    path: '/lesson/landing/:id/learn',
    name: 'LessonLandingLearn',
    component: () => import('@/views/landing/lesson-learn.vue'),
    meta: { public: true }
  },
  {
    path: '/library/landing',
    name: 'LibraryLanding',
    component: () => import('@/views/landing/library.vue'),
    meta: { public: true }
  },
  {
    path: '/evaluation/landing',
    name: 'EvaluationLanding',
    component: () => import('@/views/landing/evaluation.vue'),
    meta: { public: true }
  },
  {
    path: '/evaluation/landing/exam-center',
    name: 'EvaluationLandingExamCenter',
    component: () => import('@/views/landing/exam-center.vue'),
    meta: { public: true }
  },
  {
    path: '/evaluation/landing/banks/:id',
    name: 'EvaluationLandingBankDetail',
    component: () => import('@/views/landing/bank-detail.vue'),
    meta: { public: true }
  },
  {
    path: '/evaluation/landing/exams/:id',
    name: 'EvaluationLandingExamDetail',
    component: () => import('@/views/landing/exam-detail.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/PortalLayout.vue'),
    children: [
      {
        path: '',
        redirect: '/portal'
      },
      {
        path: 'portal',
        name: 'PortalHome',
        component: () => import('@/views/portal/index.vue')
      },
      {
        path: 'portal/workspace',
        name: 'PortalWorkspace',
        component: () => import('@/views/portal/workspace.vue')
      },
      {
        path: 'portal/apps',
        name: 'PortalApps',
        component: () => import('@/views/portal/apps.vue')
      },
      {
        path: 'portal/community',
        name: 'PortalCommunity',
        component: () => import('@/views/portal/community.vue')
      },
      {
        path: 'portal/favorites',
        name: 'PortalFavorites',
        component: () => import('@/views/portal/favorites.vue')
      },
      {
        path: 'library/resources',
        name: 'LibraryResources',
        component: () => import('@/views/library/resources.vue')
      },
      {
        path: 'library/tags',
        name: 'LibraryTags',
        component: () => import('@/views/library/tags.vue')
      },
      {
        path: 'library/questions',
        name: 'LibraryQuestions',
        component: () => import('@/views/library/questions.vue')
      },
      {
        path: 'library/knowledge',
        name: 'LibraryKnowledge',
        component: () => import('@/views/library/knowledge.vue')
      },
      {
        path: 'library/ability',
        name: 'LibraryAbility',
        component: () => import('@/views/library/ability.vue')
      },
      {
        path: 'library/certificates',
        name: 'LibraryCertificates',
        component: () => import('@/views/library/certificates.vue')
      },
      {
        path: 'library/my-resources',
        name: 'LibraryMyResources',
        component: () => import('@/views/library/my-resources.vue')
      },
      {
        path: 'job/positions',
        name: 'JobPositions',
        component: () => import('@/views/job/positions.vue')
      },
      {
        path: 'job/positions/:id/edit',
        name: 'JobPositionEdit',
        component: () => import('@/views/job/position-edit.vue')
      },
      {
        path: 'job/batches',
        name: 'JobBatches',
        component: () => import('@/views/job/batches.vue')
      },
      {
        path: 'job/archive',
        name: 'JobArchive',
        component: () => import('@/views/job/archive.vue')
      },
      {
        path: 'job/learn-roads',
        name: 'JobLearnRoads',
        component: () => import('@/views/job/learn-roads.vue')
      },
      {
        path: 'job/recommend',
        name: 'JobRecommend',
        component: () => import('@/views/job/recommend.vue')
      },
      {
        path: 'scene/scenarios',
        name: 'SceneScenarios',
        component: () => import('@/views/scene/scenarios.vue')
      },
      {
        path: 'scene/scenarios/:id/edit',
        name: 'SceneScenarioEdit',
        component: () => import('@/views/scene/scenario-edit.vue')
      },
      {
        path: 'scene/batches',
        name: 'SceneBatches',
        component: () => import('@/views/scene/batches.vue')
      },
      {
        path: 'scene/archive',
        name: 'SceneArchive',
        component: () => import('@/views/scene/archive.vue')
      },
      {
        path: 'lesson/courses',
        name: 'LessonCourses',
        component: () => import('@/views/lesson/courses.vue')
      },
      // ---- lesson admin（对齐 React /lesson/admin/* 路径）----
      {
        // 颗粒课管理列表（对齐 React /lesson/admin/granular，按 type 筛选）
        path: 'lesson/admin/granular',
        name: 'LessonAdminGranular',
        component: () => import('@/views/lesson/courses.vue'),
        props: { routeQueryType: 'granular' }
      },
      {
        // 混合课管理列表（对齐 React /lesson/admin/hybrid）
        path: 'lesson/admin/hybrid',
        name: 'LessonAdminHybrid',
        component: () => import('@/views/lesson/courses.vue'),
        props: { routeQueryType: 'hybrid' }
      },
      {
        // 体系课管理列表（对齐 React /lesson/admin/system）
        path: 'lesson/admin/system',
        name: 'LessonAdminSystem',
        component: () => import('@/views/lesson/courses.vue'),
        props: { routeQueryType: 'system' }
      },
      {
        // 体系课编辑页（对齐 React /lesson/admin/system/add；?id= 编辑模式）
        path: 'lesson/admin/system/add',
        name: 'LessonAdminSystemAdd',
        component: () => import('@/views/lesson/course-edit.vue')
      },
      {
        // 混合课编辑页 React 路径别名（对齐 React /lesson/admin/hybrid/add）
        path: 'lesson/admin/hybrid/add',
        name: 'LessonAdminHybridAdd',
        component: () => import('@/views/lesson/course-hybrid-edit.vue')
      },
      {
        // 课程归档（对齐 React /lesson/admin/archive）
        path: 'lesson/admin/archive',
        name: 'LessonAdminArchive',
        component: () => import('@/views/lesson/archive.vue')
      },
      {
        // 课程批次（对齐 React /lesson/admin/batches）
        path: 'lesson/admin/batches',
        name: 'LessonAdminBatches',
        component: () => import('@/views/lesson/batches.vue')
      },
      {
        // 颗粒课程编辑页（对齐 React /lesson/admin/granular/add）
        path: 'lesson/admin/granular/add',
        name: 'LessonGranularAdd',
        component: () => import('@/views/lesson/course-granular-edit.vue')
      },
      {
        path: 'lesson/courses/:id/edit',
        name: 'LessonCourseEdit',
        component: () => import('@/views/lesson/course-edit.vue')
      },
      {
        // 混合课程编辑页（新建/编辑共用，?id= 编辑模式；对齐 React /lesson/admin/hybrid/add）
        path: 'lesson/courses/hybrid/add',
        name: 'LessonHybridCourseAdd',
        component: () => import('@/views/lesson/course-hybrid-edit.vue')
      },
      {
        path: 'lesson/batches',
        name: 'LessonBatches',
        component: () => import('@/views/lesson/batches.vue')
      },
      {
        path: 'lesson/archive',
        name: 'LessonArchive',
        component: () => import('@/views/lesson/archive.vue')
      },
      {
        path: 'alliance/projects',
        name: 'AllianceProjects',
        component: () => import('@/views/alliance/projects.vue')
      },
      {
        path: 'alliance/agreements',
        name: 'AllianceAgreements',
        component: () => import('@/views/alliance/agreements.vue')
      },
      {
        path: 'alliance/achievements',
        name: 'AllianceAchievements',
        component: () => import('@/views/alliance/achievements.vue')
      },
      {
        path: 'alliance/brands',
        name: 'AllianceBrands',
        component: () => import('@/views/alliance/brands.vue')
      },
      {
        path: 'affairs/programs',
        name: 'AffairsPrograms',
        component: () => import('@/views/affairs/programs.vue')
      },
      {
        path: 'affairs/programs/:id/edit',
        name: 'AffairsProgramEdit',
        component: () => import('@/views/affairs/program-edit.vue')
      },
      {
        path: 'affairs/teaching-plans',
        name: 'TeachingPlans',
        component: () => import('@/views/affairs/teaching-plans.vue')
      },
      {
        path: 'affairs/teaching-plans/:id',
        name: 'TeachingPlanDetail',
        component: () => import('@/views/affairs/teaching-plan-detail.vue')
      },
      {
        // React /affairs/majors 转发到 portal/apps/system/resource/majors，Vue 复用 system/majors.vue
        path: 'affairs/majors',
        name: 'AffairsMajors',
        component: () => import('@/views/system/majors.vue')
      },
      {
        // React /affairs/org-structure 转发到 portal/apps/system/org-user/org-structure，Vue 复用 system/organizations.vue
        path: 'affairs/org-structure',
        name: 'AffairsOrgStructure',
        component: () => import('@/views/system/organizations.vue')
      },
      {
        path: 'affairs/students',
        name: 'AffairsStudents',
        component: () => import('@/views/affairs/students.vue')
      },
      {
        path: 'affairs/teachers',
        name: 'AffairsTeachers',
        component: () => import('@/views/affairs/teachers.vue')
      },
      {
        path: 'affairs/scheduling',
        name: 'AffairsScheduling',
        component: () => import('@/views/affairs/scheduling.vue')
      },
      {
        path: 'affairs/scheduling-config',
        name: 'AffairsSchedulingConfig',
        component: () => import('@/views/affairs/scheduling-config.vue')
      },
      {
        path: 'affairs/batches',
        name: 'AffairsBatches',
        component: () => import('@/views/affairs/batches.vue')
      },
      {
        path: 'affairs/archive',
        name: 'AffairsArchive',
        component: () => import('@/views/affairs/archive.vue')
      },
      {
        path: 'evaluation/exams',
        name: 'EvaluationExams',
        component: () => import('@/views/evaluation/exams.vue')
      },
      {
        path: 'evaluation/exams/:id/edit',
        name: 'ExamEdit',
        component: () => import('@/views/evaluation/exam-edit.vue')
      },
      {
        path: 'evaluation/question-banks',
        name: 'QuestionBanks',
        component: () => import('@/views/evaluation/question-banks.vue')
      },
      {
        path: 'evaluation/question-banks/:id/edit',
        name: 'QuestionBankEdit',
        component: () => import('@/views/evaluation/question-bank-edit.vue')
      },
      {
        path: 'evaluation/batches',
        name: 'EvaluationBatches',
        component: () => import('@/views/evaluation/batches.vue')
      },
      {
        path: 'evaluation/archive',
        name: 'EvaluationArchive',
        component: () => import('@/views/evaluation/archive.vue')
      },
      {
        path: 'evaluation/job-ability',
        name: 'JobAbility',
        component: () => import('@/views/evaluation/job-ability.vue')
      },
      {
        path: 'evaluation/job-ability-config/:id',
        name: 'JobAbilityConfig',
        component: () => import('@/views/evaluation/job-ability-config.vue')
      },
      {
        path: 'evaluation/job-ability-results',
        name: 'JobAbilityResults',
        component: () => import('@/views/evaluation/job-ability-results.vue')
      },
      {
        path: 'evaluation/exam-usage',
        name: 'ExamUsage',
        component: () => import('@/views/evaluation/exam-usage.vue')
      },
      {
        path: 'evaluation/exam-usage-results',
        name: 'ExamUsageResults',
        component: () => import('@/views/evaluation/exam-usage-results.vue')
      },
      {
        path: 'evaluation/lesson-results',
        name: 'LessonResults',
        component: () => import('@/views/evaluation/lesson-results.vue')
      },
      {
        path: 'evaluation/lesson-results/:id',
        name: 'LessonResultDetail',
        component: () => import('@/views/evaluation/lesson-result-detail.vue')
      },
      {
        // 日常考试（React /evaluation/lesson-results/daily-exams 对齐）
        path: 'evaluation/lesson-results/daily-exams',
        name: 'DailyExams',
        component: () => import('@/views/evaluation/daily-exams.vue')
      },
      {
        path: 'evaluation/lesson-results/daily-exams/:resultId',
        name: 'DailyExamDetail',
        component: () => import('@/views/evaluation/daily-exam-detail.vue')
      },
      {
        path: 'evaluation/scene-results',
        name: 'SceneResults',
        component: () => import('@/views/evaluation/scene-results.vue')
      },
      {
        path: 'evaluation/scene-results/:id',
        name: 'SceneResultDetail',
        component: () => import('@/views/evaluation/scene-result-detail.vue')
      },
      {
        path: 'system/organizations',
        name: 'SystemOrganizations',
        component: () => import('@/views/system/organizations.vue')
      },
      {
        path: 'system/roles',
        name: 'SystemRoles',
        component: () => import('@/views/system/roles.vue')
      },
      {
        path: 'system/majors',
        name: 'SystemMajors',
        component: () => import('@/views/system/majors.vue')
      },
      {
        path: 'system/industries',
        name: 'SystemIndustries',
        component: () => import('@/views/system/industries.vue')
      },
      {
        path: 'system/org-types',
        name: 'SystemOrgTypes',
        component: () => import('@/views/system/org-types.vue')
      },
      {
        path: 'users',
        name: 'UserManagement',
        component: () => import('@/views/portal/users.vue')
      },
      {
        path: 'partner/experts',
        name: 'PartnerExperts',
        component: () => import('@/views/partner/experts.vue')
      },
      {
        path: 'partner/enterprise',
        name: 'PartnerEnterprise',
        component: () => import('@/views/partner/enterprise.vue')
      },
      {
        path: 'partner/workspace',
        name: 'PartnerWorkspace',
        component: () => import('@/views/partner/workspace.vue')
      },
      {
        path: 'partner/co-build-positions',
        name: 'PartnerCobuildPositions',
        component: () => import('@/views/partner/co-build-positions.vue')
      },
      {
        path: 'partner/co-build-scenarios',
        name: 'PartnerCobuildScenarios',
        component: () => import('@/views/partner/co-build-scenarios.vue')
      },
      {
        path: 'partner/employment-projects',
        name: 'PartnerEmploymentProjects',
        component: () => import('@/views/partner/employment-projects.vue')
      },
      {
        path: 'partner/employment-jobs',
        name: 'PartnerEmploymentJobs',
        component: () => import('@/views/partner/employment-jobs.vue')
      },
      {
        path: 'partner/cooperation',
        name: 'PartnerCooperation',
        component: () => import('@/views/partner/cooperation.vue')
      },
      {
        path: 'partner/schools',
        name: 'PartnerSchools',
        component: () => import('@/views/partner/schools.vue')
      },
      {
        path: 'partner/tasks',
        name: 'PartnerTasks',
        component: () => import('@/views/partner/tasks.vue')
      },
      {
        path: 'partner/settings',
        name: 'PartnerSettings',
        component: () => import('@/views/partner/settings.vue')
      },
      {
        path: 'ai/agents',
        name: 'AiAgents',
        component: () => import('@/views/ai/agents.vue')
      },
      {
        path: 'ai/kbs',
        name: 'AiKbs',
        component: () => import('@/views/ai/kbs.vue')
      },
      {
        path: 'ai/chat',
        name: 'AiChat',
        component: () => import('@/views/ai/chat.vue')
      },
      {
        path: 'ai/square',
        name: 'AiSquare',
        component: () => import('@/views/ai/square.vue')
      },
      {
        path: 'ai/admin/agents',
        name: 'AiAdminAgents',
        component: () => import('@/views/ai/admin-content.vue'),
        meta: { aiAdminType: 'agent' }
      },
      {
        path: 'ai/admin/kbs',
        name: 'AiAdminKbs',
        component: () => import('@/views/ai/admin-content.vue'),
        meta: { aiAdminType: 'kb' }
      },
      {
        path: 'ai/admin/reviews',
        name: 'AiAdminReviews',
        component: () => import('@/views/ai/admin-reviews.vue')
      },
      {
        path: 'ai/admin/integrations',
        name: 'AiAdminIntegrations',
        component: () => import('@/views/ai/admin-integrations.vue')
      },
      {
        path: 'approvals',
        name: 'Approvals',
        component: () => import('@/views/approvals/index.vue')
      },
      {
        path: 'workflows',
        name: 'Workflows',
        component: () => import('@/views/workflows/index.vue')
      },
      {
        path: 'import-export',
        name: 'ImportExport',
        component: () => import('@/views/import-export.vue')
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_APP_BASE_PATH || '/'),
  routes
});

router.beforeEach((to) => {
  const token = getToken();
  if (!to.meta.public && !token) {
    return { name: 'Login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;

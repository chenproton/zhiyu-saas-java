import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { getToken } from '@/api/http';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/portal/login.vue'),
    meta: { public: true }
  },
  {
    // 门户登录（对齐 React /portal/login；api/http.ts 401 处理跳转此路径）
    path: '/portal/login',
    name: 'PortalLogin',
    component: () => import('@/views/portal/login.vue'),
    meta: { public: true }
  },
  {
    // 企业服务台登录（对齐 React /partner/login，独立于门户布局；partner token 独立存储）
    path: '/partner/login',
    name: 'PartnerLogin',
    component: () => import('@/views/partner/login.vue'),
    meta: { public: true }
  },
  {
    // 超管控制台（对齐 React /superadmin，SaaS 平台登录态；页面内部自行鉴权，不走门户 token 守卫）
    path: '/superadmin',
    name: 'Superadmin',
    component: () => import('@/views/superadmin/index.vue'),
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
    // 场景详情（公开 landing 子页，对齐 React /scene/landing/[id]）
    path: '/scene/landing/:id',
    name: 'SceneLandingDetail',
    component: () => import('@/views/landing/scene-detail.vue'),
    meta: { public: true }
  },
  {
    // 场景学习页（公开 landing 子页，对齐 React /scene/landing/[id]/learn）
    path: '/scene/landing/:id/learn',
    name: 'SceneLandingLearn',
    component: () => import('@/views/landing/scene-learn.vue'),
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
    // 对齐 React：/evaluation/landing/exams 重定向到考试中心（React 为 <Navigate>）
    path: '/evaluation/landing/exams',
    redirect: '/evaluation/landing/exam-center'
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
        // React 路径别名（对齐 /library/resources/:type；resources.vue 从 route.query.type 读取）
        path: 'library/resources/:type',
        name: 'LibraryResourcesType',
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
        path: 'scene',
        name: 'SceneList',
        redirect: { path: '/scene/scenarios' }
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
        // 场景任务编排（对齐 React /scene/scenarios/[id]/edit/tasks）
        path: 'scene/scenarios/:id/edit/tasks',
        name: 'SceneScenarioTasks',
        component: () => import('@/views/scene/scenario-tasks.vue')
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
      // ---- 联盟管理应用（对齐 React /portal/apps/alliance/* 管理页）----
      {
        path: 'portal/apps/alliance/achievements',
        name: 'AllianceAdminAchievements',
        component: () => import('@/views/portal/apps/alliance/achievements.vue')
      },
      {
        path: 'portal/apps/alliance/achievements/new',
        name: 'AllianceAdminAchievementNew',
        component: () => import('@/views/portal/apps/alliance/achievement-edit.vue')
      },
      {
        path: 'portal/apps/alliance/achievements/:id',
        name: 'AllianceAdminAchievementDetail',
        component: () => import('@/views/portal/apps/alliance/achievement-detail.vue')
      },
      {
        path: 'portal/apps/alliance/achievements/:id/edit',
        name: 'AllianceAdminAchievementEdit',
        component: () => import('@/views/portal/apps/alliance/achievement-edit.vue')
      },
      {
        path: 'portal/apps/alliance/agreements',
        name: 'AllianceAdminAgreements',
        component: () => import('@/views/portal/apps/alliance/agreements.vue')
      },
      {
        path: 'portal/apps/alliance/agreements/new',
        name: 'AllianceAdminAgreementNew',
        component: () => import('@/views/portal/apps/alliance/agreement-edit.vue')
      },
      {
        path: 'portal/apps/alliance/agreements/:id',
        name: 'AllianceAdminAgreementDetail',
        component: () => import('@/views/portal/apps/alliance/agreement-detail.vue')
      },
      {
        path: 'portal/apps/alliance/agreements/:id/edit',
        name: 'AllianceAdminAgreementEdit',
        component: () => import('@/views/portal/apps/alliance/agreement-edit.vue')
      },
      {
        path: 'portal/apps/alliance/projects',
        name: 'AllianceAdminProjects',
        component: () => import('@/views/portal/apps/alliance/projects.vue')
      },
      {
        path: 'portal/apps/alliance/projects/new',
        name: 'AllianceAdminProjectNew',
        component: () => import('@/views/portal/apps/alliance/project-edit.vue')
      },
      {
        path: 'portal/apps/alliance/projects/:id',
        name: 'AllianceAdminProjectDetail',
        component: () => import('@/views/portal/apps/alliance/project-detail.vue')
      },
      {
        path: 'portal/apps/alliance/projects/:id/edit',
        name: 'AllianceAdminProjectEdit',
        component: () => import('@/views/portal/apps/alliance/project-edit.vue')
      },
      // ---- 产教联盟前台（对齐 React /portal/alliance/* 公开门户）----
      {
        path: 'portal/alliance/landing',
        name: 'AllianceLanding',
        component: () => import('@/views/portal/alliance/landing.vue')
      },
      {
        path: 'portal/alliance/enterprises',
        name: 'AllianceEnterprises',
        component: () => import('@/views/portal/alliance/enterprises.vue')
      },
      {
        path: 'portal/alliance/enterprises/:id',
        name: 'AllianceEnterpriseDetail',
        component: () => import('@/views/portal/alliance/enterprise-detail.vue')
      },
      {
        path: 'portal/alliance/experts',
        name: 'AllianceExperts',
        component: () => import('@/views/portal/alliance/experts.vue')
      },
      {
        path: 'portal/alliance/experts/:id',
        name: 'AllianceExpertDetail',
        component: () => import('@/views/portal/alliance/expert-detail.vue')
      },
      {
        path: 'portal/alliance/projects',
        name: 'AllianceProjectsPublic',
        component: () => import('@/views/portal/alliance/projects.vue')
      },
      {
        path: 'portal/alliance/projects/:id',
        name: 'AllianceProjectDetail',
        component: () => import('@/views/portal/alliance/project-detail.vue')
      },
      {
        path: 'portal/alliance/achievements',
        name: 'AllianceAchievementsPublic',
        component: () => import('@/views/portal/alliance/achievements.vue')
      },
      {
        path: 'portal/alliance/achievements/:id',
        name: 'AllianceAchievementDetail',
        component: () => import('@/views/portal/alliance/achievement-detail.vue')
      },
      {
        path: 'portal/alliance/brands',
        name: 'AllianceBrandsPublic',
        component: () => import('@/views/portal/alliance/brands.vue')
      },
      {
        path: 'portal/alliance/brands/:id',
        name: 'AllianceBrandDetail',
        component: () => import('@/views/portal/alliance/brand-detail.vue')
      },
      {
        path: 'portal/alliance/employment',
        name: 'AllianceEmployment',
        component: () => import('@/views/portal/alliance/employment.vue')
      },
      {
        path: 'portal/alliance/employment/mine',
        name: 'AllianceEmploymentMine',
        component: () => import('@/views/portal/alliance/employment-mine.vue')
      },
      {
        path: 'portal/alliance/employment/job/:id',
        name: 'AllianceEmploymentJobDetail',
        component: () => import('@/views/portal/alliance/employment-job-detail.vue')
      },
      {
        path: 'portal/alliance/employment/:id',
        name: 'AllianceEmploymentDetail',
        component: () => import('@/views/portal/alliance/employment-detail.vue')
      },
      // ---- 联盟管理应用（对齐 React /portal/apps/alliance/* 管理端）----
      {
        path: 'portal/apps/alliance/brands',
        name: 'AllianceAppsBrands',
        component: () => import('@/views/portal/apps/alliance/brands.vue')
      },
      {
        path: 'portal/apps/alliance/brands/culture',
        name: 'AllianceAppsBrandCulture',
        component: () => import('@/views/portal/apps/alliance/brand-culture.vue')
      },
      {
        path: 'portal/apps/alliance/brands/employer',
        name: 'AllianceAppsBrandEmployer',
        component: () => import('@/views/portal/apps/alliance/brand-employer.vue')
      },
      {
        path: 'portal/apps/alliance/brands/job',
        name: 'AllianceAppsBrandJob',
        component: () => import('@/views/portal/apps/alliance/brand-job.vue')
      },
      {
        path: 'portal/apps/alliance/brands/major',
        name: 'AllianceAppsBrandMajor',
        component: () => import('@/views/portal/apps/alliance/brand-major.vue')
      },
      {
        path: 'portal/apps/alliance/brands/talent',
        name: 'AllianceAppsBrandTalent',
        component: () => import('@/views/portal/apps/alliance/brand-talent.vue')
      },
      {
        path: 'portal/apps/alliance/brands/teacher',
        name: 'AllianceAppsBrandTeacher',
        component: () => import('@/views/portal/apps/alliance/brand-teacher.vue')
      },
      {
        path: 'portal/apps/alliance/brands/:id',
        name: 'AllianceAppsBrandDetail',
        component: () => import('@/views/portal/apps/alliance/brand-detail.vue')
      },
      {
        path: 'portal/apps/alliance/dictionaries',
        name: 'AllianceAppsDictionaries',
        component: () => import('@/views/portal/apps/alliance/dictionaries.vue')
      },
      {
        path: 'portal/apps/alliance/school',
        name: 'AllianceAppsSchool',
        component: () => import('@/views/portal/apps/alliance/school.vue')
      },
      {
        path: 'portal/apps/alliance/enterprises',
        name: 'AllianceAppsEnterprises',
        component: () => import('@/views/portal/apps/alliance/enterprises.vue')
      },
      {
        path: 'portal/apps/alliance/enterprises/:id',
        name: 'AllianceAppsEnterpriseDetail',
        component: () => import('@/views/portal/apps/alliance/enterprise-detail.vue')
      },
      {
        path: 'portal/apps/alliance/experts',
        name: 'AllianceAppsExperts',
        component: () => import('@/views/portal/apps/alliance/experts.vue')
      },
      {
        path: 'portal/apps/alliance/experts/:id',
        name: 'AllianceAppsExpertDetail',
        component: () => import('@/views/portal/apps/alliance/expert-detail.vue')
      },
      {
        path: 'portal/apps/alliance/permissions',
        name: 'AllianceAppsPermissions',
        component: () => import('@/views/portal/apps/alliance/permissions.vue')
      },
      {
        path: 'portal/apps/alliance/employmentjob',
        name: 'AllianceAppsEmploymentJob',
        component: () => import('@/views/portal/apps/alliance/employmentjob.vue')
      },
      {
        path: 'portal/apps/alliance/employmentproject',
        name: 'AllianceAppsEmploymentProject',
        component: () => import('@/views/portal/apps/alliance/employmentproject.vue')
      },
      {
        path: 'portal/apps/alliance/employmentproject/new',
        name: 'AllianceAppsEmploymentProjectNew',
        component: () => import('@/views/portal/apps/alliance/employmentproject-edit.vue')
      },
      {
        path: 'portal/apps/alliance/employmentproject/:id',
        name: 'AllianceAppsEmploymentProjectDetail',
        component: () => import('@/views/portal/apps/alliance/employmentproject-detail.vue')
      },
      {
        path: 'affairs/programs',
        name: 'AffairsPrograms',
        component: () => import('@/views/affairs/programs.vue')
      },
      {
        // React 深链 /affairs/programs/:id（编辑/新建页），Vue 用 /:id/edit；React 新建形态 id='new' 转 Vue 的 ?new=true
        path: 'affairs/programs/:id',
        redirect: (to) => {
          const id = to.params.id as string;
          const query = { ...(to.query as Record<string, string | null>) };
          if (id === 'new') query.new = 'true';
          return { path: `/affairs/programs/${id}/edit`, query };
        }
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
        // React /affairs/positions 转发到 portal/apps/system/org-user/positions，Vue 复用 system/positions.vue
        path: 'affairs/positions',
        name: 'AffairsPositions',
        component: () => import('@/views/system/positions.vue')
      },
      {
        // React /affairs/relations 转发到 portal/apps/system/org-user/relations，Vue 复用 system/relations.vue
        path: 'affairs/relations',
        name: 'AffairsRelations',
        component: () => import('@/views/system/relations.vue')
      },
      {
        // React /affairs/config（教务配置=场地节次），Vue 复用 scheduling-config.vue
        path: 'affairs/config',
        name: 'AffairsConfig',
        component: () => import('@/views/affairs/scheduling-config.vue')
      },
      {
        path: 'affairs/students',
        name: 'AffairsStudents',
        component: () => import('@/views/affairs/students.vue')
      },
      {
        // 学生画像（对齐 React /affairs/student-portraits）
        path: 'affairs/student-portraits',
        name: 'AffairsStudentPortraits',
        component: () => import('@/views/affairs/student-portraits.vue')
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
        // React 深链 /evaluation/exams/:id（组卷/编辑页），Vue 用 /:id/edit，补别名互通
        path: 'evaluation/exams/:id',
        redirect: (to) => ({ path: `/evaluation/exams/${to.params.id}/edit`, query: to.query })
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
        // React 深链 /evaluation/question-banks/:id（题库详情），Vue 用 /:id/edit，补别名互通
        path: 'evaluation/question-banks/:id',
        redirect: (to) => ({ path: `/evaluation/question-banks/${to.params.id}/edit`, query: to.query })
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
        // React 路径别名（对齐 /evaluation/job-ability/config/:id）
        path: 'evaluation/job-ability/config/:id',
        name: 'JobAbilityConfigReact',
        component: () => import('@/views/evaluation/job-ability-config.vue')
      },
      {
        path: 'evaluation/job-ability-results',
        name: 'JobAbilityResults',
        component: () => import('@/views/evaluation/job-ability-results.vue')
      },
      {
        // React 路径别名（对齐 /evaluation/job-ability/results）
        path: 'evaluation/job-ability/results',
        name: 'JobAbilityResultsReact',
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
        // React 路径别名（对齐 /evaluation/exam-usage/results，React 用 path 段传 usageId 参数）
        path: 'evaluation/exam-usage/results',
        name: 'ExamUsageResultsReact',
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
      // ---- 门户系统应用 · 租户/资源/日志（对齐 React /portal/apps/system/*）----
      {
        path: 'portal/apps/system/tenant',
        name: 'SystemTenant',
        component: () => import('@/views/system/tenant.vue')
      },
      {
        path: 'portal/apps/system/resource/package',
        name: 'SystemResourcePackage',
        component: () => import('@/views/system/resource-package.vue')
      },
      {
        path: 'portal/apps/system/resource/codes',
        name: 'SystemResourceCodes',
        component: () => import('@/views/system/resource-codes.vue')
      },
      {
        path: 'portal/apps/system/resource/industries',
        name: 'SystemResourceIndustries',
        component: () => import('@/views/system/industries.vue')
      },
      {
        path: 'portal/apps/system/resource/majors',
        name: 'SystemResourceMajors',
        component: () => import('@/views/system/majors.vue')
      },
      {
        path: 'portal/apps/system/logs/login',
        name: 'SystemLogsLogin',
        component: () => import('@/views/system/logs-login.vue')
      },
      {
        path: 'portal/apps/system/logs/operation',
        name: 'SystemLogsOperation',
        component: () => import('@/views/system/logs-operation.vue')
      },
      // ---- 门户系统应用 · 组织用户（对齐 React /portal/apps/system/org-user/*）----
      {
        path: 'portal/apps/system/org-user/org-structure',
        name: 'OrgUserOrgStructure',
        component: () => import('@/views/system/organizations.vue')
      },
      {
        path: 'portal/apps/system/org-user/org-types',
        name: 'OrgUserOrgTypes',
        component: () => import('@/views/system/org-types.vue')
      },
      {
        path: 'portal/apps/system/org-user/positions',
        name: 'OrgUserPositions',
        component: () => import('@/views/system/positions.vue')
      },
      {
        path: 'portal/apps/system/org-user/relations',
        name: 'OrgUserRelations',
        component: () => import('@/views/system/relations.vue')
      },
      {
        path: 'portal/apps/system/org-user/roles',
        name: 'OrgUserRoles',
        component: () => import('@/views/system/roles.vue')
      },
      {
        path: 'portal/apps/system/org-user/accounts',
        name: 'OrgUserAccounts',
        component: () => import('@/views/system/accounts.vue')
      },
      {
        path: 'portal/apps/system/org-user/fields',
        name: 'OrgUserFields',
        component: () => import('@/views/system/fields.vue')
      },
      {
        path: 'portal/apps/system/org-user/graduates',
        name: 'OrgUserGraduates',
        component: () => import('@/views/system/graduates.vue')
      },
      {
        path: 'portal/apps/system/org-user/students',
        name: 'OrgUserStudents',
        component: () => import('@/views/system/students.vue')
      },
      {
        path: 'portal/apps/system/org-user/teachers',
        name: 'OrgUserTeachers',
        component: () => import('@/views/system/teachers.vue')
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
        // React 深链 /partner/experts/new → Vue 的 :id/edit + new=true
        path: 'partner/experts/new',
        redirect: { path: '/partner/experts/new/edit', query: { new: 'true' } }
      },
      {
        // 专家详情（对齐 React /partner/experts/:id）
        path: 'partner/experts/:id',
        name: 'PartnerExpertDetail',
        component: () => import('@/views/partner/expert-detail.vue')
      },
      {
        // 专家编辑（对齐 React /partner/experts/:id/edit）
        path: 'partner/experts/:id/edit',
        name: 'PartnerExpertEdit',
        component: () => import('@/views/partner/expert-edit.vue')
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
        // React 路径别名（对齐 /partner/co-build/positions）
        path: 'partner/co-build/positions',
        name: 'PartnerCobuildPositionsReact',
        component: () => import('@/views/partner/co-build-positions.vue')
      },
      {
        path: 'partner/co-build-scenarios',
        name: 'PartnerCobuildScenarios',
        component: () => import('@/views/partner/co-build-scenarios.vue')
      },
      {
        // React 路径别名（对齐 /partner/co-build/scenes）
        path: 'partner/co-build/scenes',
        name: 'PartnerCobuildScenesReact',
        component: () => import('@/views/partner/co-build-scenarios.vue')
      },
      {
        // 共建岗位编辑页（对齐 React /partner/co-build/positions/:id/edit）
        path: 'partner/co-build/positions/:id/edit',
        name: 'PartnerCobuildPositionEdit',
        component: () => import('@/views/partner/co-build-position-edit.vue')
      },
      {
        // 共建场景编辑页（对齐 React /partner/co-build/scenes/:id/edit）
        path: 'partner/co-build/scenes/:id/edit',
        name: 'PartnerCobuildScenarioEdit',
        component: () => import('@/views/partner/co-build-scenario-edit.vue')
      },
      {
        // 共建场景任务编排页（对齐 React /partner/co-build/scenes/[id]/edit/tasks）
        path: 'partner/co-build/scenes/:id/edit/tasks',
        name: 'PartnerCobuildSceneTasks',
        component: () => import('@/views/partner/co-build-scene-tasks.vue')
      },
      {
        path: 'partner/employment-projects',
        name: 'PartnerEmploymentProjects',
        component: () => import('@/views/partner/employment-projects.vue')
      },
      {
        // 就业项目详情（对齐 React /partner/employment-projects/:id）
        path: 'partner/employment-projects/:id',
        name: 'PartnerEmploymentProjectDetail',
        component: () => import('@/views/partner/employment-project-detail.vue')
      },
      {
        path: 'partner/employment-jobs',
        name: 'PartnerEmploymentJobs',
        component: () => import('@/views/partner/employment-jobs.vue')
      },
      {
        // React 深链 /partner/employment-jobs/new → Vue 的 :id/edit + new=true
        path: 'partner/employment-jobs/new',
        redirect: { path: '/partner/employment-jobs/new/edit', query: { new: 'true' } }
      },
      {
        // 就业岗位详情（对齐 React /partner/employment-jobs/:id）
        path: 'partner/employment-jobs/:id',
        name: 'PartnerEmploymentJobDetail',
        component: () => import('@/views/partner/employment-job-detail.vue')
      },
      {
        // 就业岗位编辑（对齐 React /partner/employment-jobs/:id/edit）
        path: 'partner/employment-jobs/:id/edit',
        name: 'PartnerEmploymentJobEdit',
        component: () => import('@/views/partner/employment-job-edit.vue')
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
      // ---- AI 智能服务中心（对齐 React /portal/apps/ai/* 路径）----
      {
        path: 'portal/apps/ai',
        redirect: '/portal/apps/ai/landing'
      },
      {
        // 落地页（hero + 我的工坊 + AI 广场平铺 + YIKnow 弹窗）
        path: 'portal/apps/ai/landing',
        name: 'AiLanding',
        component: () => import('@/views/ai/landing.vue')
      },
      {
        // 旧 /square 重定向到落地页 #square（对齐 React）
        path: 'portal/apps/ai/square',
        redirect: { path: '/portal/apps/ai/landing', hash: '#square' }
      },
      {
        // 旧 /studio 重定向到落地页 #studio（对齐 React）
        path: 'portal/apps/ai/studio',
        redirect: { path: '/portal/apps/ai/landing', hash: '#studio' }
      },
      {
        // 智能体大厅
        path: 'portal/apps/ai/hall/agents',
        name: 'AiHallAgents',
        component: () => import('@/views/ai/hall/agents.vue')
      },
      {
        // 知识库大厅
        path: 'portal/apps/ai/hall/kbs',
        name: 'AiHallKbs',
        component: () => import('@/views/ai/hall/kbs.vue')
      },
      {
        // 智能体对话页
        path: 'portal/apps/ai/agents/:id',
        name: 'AiAgentChat',
        component: () => import('@/views/ai/agent-chat.vue')
      },
      {
        // 知识库详情 + 库内问答
        path: 'portal/apps/ai/kb/:id',
        name: 'AiKbDetail',
        component: () => import('@/views/ai/kb-detail.vue')
      },
      {
        // 新建智能体
        path: 'portal/apps/ai/studio/agents/new',
        name: 'AiStudioAgentNew',
        component: () => import('@/views/ai/studio/agent-new.vue')
      },
      {
        // 智能体编辑器
        path: 'portal/apps/ai/studio/agents/:id',
        name: 'AiStudioAgentEdit',
        component: () => import('@/views/ai/studio/agent-edit.vue')
      },
      {
        // 新建知识库
        path: 'portal/apps/ai/studio/kb/new',
        name: 'AiStudioKbNew',
        component: () => import('@/views/ai/studio/kb-new.vue')
      },
      {
        // 知识库管理（文档/协作者）
        path: 'portal/apps/ai/studio/kb/:id',
        name: 'AiStudioKbEdit',
        component: () => import('@/views/ai/studio/kb-edit.vue')
      },
      {
        // 智能体内容管理
        path: 'portal/apps/ai/admin/agents',
        name: 'AiAdminAgents',
        component: () => import('@/views/ai/admin-content.vue'),
        meta: { aiAdminType: 'agent' }
      },
      {
        // 知识库内容管理
        path: 'portal/apps/ai/admin/kbs',
        name: 'AiAdminKbs',
        component: () => import('@/views/ai/admin-content.vue'),
        meta: { aiAdminType: 'kb' }
      },
      {
        // 审核工作台
        path: 'portal/apps/ai/admin/reviews',
        name: 'AiAdminReviews',
        component: () => import('@/views/ai/admin-reviews.vue')
      },
      {
        // 外部 AI 服务上架
        path: 'portal/apps/ai/admin/integrations',
        name: 'AiAdminIntegrations',
        component: () => import('@/views/ai/admin-integrations.vue')
      },
      // ---- 旧 /ai/* 短路径：保留为重定向到新路径（portal/apps.vue、portal/index.vue、workspace.vue 导航在用）----
      {
        path: 'ai/agents',
        redirect: '/portal/apps/ai/hall/agents'
      },
      {
        path: 'ai/kbs',
        redirect: '/portal/apps/ai/hall/kbs'
      },
      {
        path: 'ai/chat',
        redirect: '/portal/apps/ai/landing'
      },
      {
        path: 'ai/square',
        redirect: { path: '/portal/apps/ai/landing', hash: '#square' }
      },
      {
        path: 'ai/admin/agents',
        redirect: '/portal/apps/ai/admin/agents'
      },
      {
        path: 'ai/admin/kbs',
        redirect: '/portal/apps/ai/admin/kbs'
      },
      {
        path: 'ai/admin/reviews',
        redirect: '/portal/apps/ai/admin/reviews'
      },
      {
        path: 'ai/admin/integrations',
        redirect: '/portal/apps/ai/admin/integrations'
      },
      {
        path: 'approvals',
        name: 'Approvals',
        component: () => import('@/views/approvals/index.vue')
      },
      // ---- 各域 approvals（对齐 React 按域拆分：/affairs/approvals 等，复用聚合页按类型过滤）----
      {
        path: 'affairs/approvals',
        name: 'AffairsApprovals',
        component: () => import('@/views/approvals/index.vue'),
        props: { targetTypes: ['training_program', 'teaching_plan'] }
      },
      {
        path: 'evaluation/approvals',
        name: 'EvaluationApprovals',
        component: () => import('@/views/approvals/index.vue'),
        props: { targetTypes: ['exam', 'question_bank'] }
      },
      {
        path: 'job/approvals',
        name: 'JobApprovals',
        component: () => import('@/views/approvals/index.vue'),
        props: { targetTypes: ['career_position'] }
      },
      {
        path: 'scene/approvals',
        name: 'SceneApprovals',
        component: () => import('@/views/approvals/index.vue'),
        props: { targetTypes: ['scenario'] }
      },
      {
        path: 'lesson/admin/approvals',
        name: 'LessonAdminApprovals',
        component: () => import('@/views/approvals/index.vue'),
        props: { targetTypes: ['course'] }
      },
      {
        path: 'workflows',
        name: 'Workflows',
        component: () => import('@/views/workflows/index.vue')
      },
      // ---- 各域 workflows（对齐 React 按域拆分，复用统一流程配置页）----
      {
        path: 'affairs/workflows',
        name: 'AffairsWorkflows',
        component: () => import('@/views/workflows/index.vue')
      },
      {
        path: 'evaluation/workflows',
        name: 'EvaluationWorkflows',
        component: () => import('@/views/workflows/index.vue')
      },
      {
        path: 'job/workflows',
        name: 'JobWorkflows',
        component: () => import('@/views/workflows/index.vue')
      },
      {
        path: 'scene/workflows',
        name: 'SceneWorkflows',
        component: () => import('@/views/workflows/index.vue')
      },
      {
        path: 'lesson/admin/workflows',
        name: 'LessonAdminWorkflows',
        component: () => import('@/views/workflows/index.vue')
      },
      {
        path: 'import-export',
        name: 'ImportExport',
        component: () => import('@/views/import-export.vue')
      },
      {
        // 404 兜底（对齐 React not-found）：未知路径重定向到门户首页
        path: ':pathMatch(.*)*',
        redirect: { path: '/portal' }
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

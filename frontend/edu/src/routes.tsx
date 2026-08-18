import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router'

// ============================================================================
// 路由表：由 Next.js App Router 的文件约定路由迁移而来。
// - 布局（layout.tsx）保持原 `{children}` 签名不变，通过 <Layout><Outlet/></Layout> 接入。
// - 页面（page.tsx）一律 React.lazy，保持按路由代码分割（对齐 Next 自动分割）。
// - [param] 动态段 → :param；模块根无 page.tsx 的路径落到下方 `*` 通配 → 404（对齐原行为）。
// ============================================================================

// ---------- 布局（eager：layout route 需常驻，避免懒加载致子树重挂载） ----------
import AffairsLayout from '@/app/affairs/layout'
import EvaluationLayout from '@/app/evaluation/layout'
import EvaluationLandingLayout from '@/app/evaluation/landing/layout'
import JobLayout from '@/app/job/layout'
import JobLandingLayout from '@/app/job/landing/layout'
import LessonLayout from '@/app/lesson/layout'
import LessonAdminLayout from '@/app/lesson/admin/layout'
import LessonLandingLayout from '@/app/lesson/landing/layout'
import LibraryLayout from '@/app/library/layout'
import LibraryLandingLayout from '@/app/library/landing/layout'
import PartnerLayout from '@/app/partner/layout'
import PortalLayout from '@/app/portal/layout'
import PortalAllianceLayout from '@/app/portal/alliance/layout'
import PortalAppsAiLayout from '@/app/portal/apps/ai/layout'
import PortalAppsAllianceLayout from '@/app/portal/apps/alliance/layout'
import PortalAppsSystemLayout from '@/app/portal/apps/system/layout'
import SceneLayout from '@/app/scene/layout'
import SceneLandingLayout from '@/app/scene/landing/layout'
import SuperadminLayout from '@/app/superadmin/layout'
import NotFound from '@/app/not-found'

// ---------- 页面（lazy） ----------
// changelog（公共页，无布局）
const ChangelogPage = lazy(() => import('@/app/changelog/page'))
// affairs
const AffairsApprovals = lazy(() => import('@/app/affairs/approvals/page'))
const AffairsBatches = lazy(() => import('@/app/affairs/batches/page'))
const AffairsConfig = lazy(() => import('@/app/affairs/config/page'))
const AffairsMajors = lazy(() => import('@/app/affairs/majors/page'))
const AffairsOrgStructure = lazy(() => import('@/app/affairs/org-structure/page'))
const AffairsPositions = lazy(() => import('@/app/affairs/positions/page'))
const AffairsPrograms = lazy(() => import('@/app/affairs/programs/page'))
const AffairsProgramDetail = lazy(() => import('@/app/affairs/programs/[id]/page'))
const AffairsRelations = lazy(() => import('@/app/affairs/relations/page'))
const AffairsScheduling = lazy(() => import('@/app/affairs/scheduling/page'))
const AffairsStudentPortraits = lazy(() => import('@/app/affairs/student-portraits/page'))
const AffairsStudents = lazy(() => import('@/app/affairs/students/page'))
const AffairsTeachers = lazy(() => import('@/app/affairs/teachers/page'))
const AffairsTeachingPlans = lazy(() => import('@/app/affairs/teaching-plans/page'))
const AffairsTeachingPlanDetail = lazy(() => import('@/app/affairs/teaching-plans/[id]/page'))
const AffairsWorkflows = lazy(() => import('@/app/affairs/workflows/page'))
// evaluation
const EvaluationApprovals = lazy(() => import('@/app/evaluation/approvals/page'))
const EvaluationBatches = lazy(() => import('@/app/evaluation/batches/page'))
const EvaluationExamUsage = lazy(() => import('@/app/evaluation/exam-usage/page'))
const EvaluationExamUsageResults = lazy(() => import('@/app/evaluation/exam-usage/results/page'))
const EvaluationExams = lazy(() => import('@/app/evaluation/exams/page'))
const EvaluationExamDetail = lazy(() => import('@/app/evaluation/exams/[id]/page'))
const EvaluationJobAbility = lazy(() => import('@/app/evaluation/job-ability/page'))
const EvaluationJobAbilityConfig = lazy(() => import('@/app/evaluation/job-ability/config/[id]/page'))
const EvaluationJobAbilityResults = lazy(() => import('@/app/evaluation/job-ability/results/page'))
const EvaluationLandingPage = lazy(() => import('@/app/evaluation/landing/page'))
const EvaluationLandingBankDetail = lazy(() => import('@/app/evaluation/landing/banks/[id]/page'))
const EvaluationLandingExamCenter = lazy(() => import('@/app/evaluation/landing/exam-center/page'))
const EvaluationLandingExamDetail = lazy(() => import('@/app/evaluation/landing/exams/[id]/page'))
const EvaluationLessonResults = lazy(() => import('@/app/evaluation/lesson-results/page'))
const EvaluationLessonResultDetail = lazy(() => import('@/app/evaluation/lesson-results/[id]/page'))
const EvaluationDailyExams = lazy(() => import('@/app/evaluation/lesson-results/daily-exams/page'))
const EvaluationDailyExamDetail = lazy(
  () => import('@/app/evaluation/lesson-results/daily-exams/[resultId]/page'),
)
const EvaluationQuestionBanks = lazy(() => import('@/app/evaluation/question-banks/page'))
const EvaluationQuestionBankDetail = lazy(() => import('@/app/evaluation/question-banks/[id]/page'))
const EvaluationSceneResults = lazy(() => import('@/app/evaluation/scene-results/page'))
const EvaluationSceneResultDetail = lazy(() => import('@/app/evaluation/scene-results/[id]/page'))
const EvaluationWorkflows = lazy(() => import('@/app/evaluation/workflows/page'))
// job
const JobApprovals = lazy(() => import('@/app/job/approvals/page'))
const JobArchive = lazy(() => import('@/app/job/archive/page'))
const JobBatches = lazy(() => import('@/app/job/batches/page'))
const JobLandingPage = lazy(() => import('@/app/job/landing/page'))
const JobLandingDetail = lazy(() => import('@/app/job/landing/[id]/page'))
const JobLandingLearn = lazy(() => import('@/app/job/landing/[id]/learn/page'))
const JobLearnRoads = lazy(() => import('@/app/job/learn-roads/page'))
const JobPositions = lazy(() => import('@/app/job/positions/page'))
const JobPositionEdit = lazy(() => import('@/app/job/positions/[id]/edit/page'))
const JobRecommend = lazy(() => import('@/app/job/recommend/page'))
const JobWorkflows = lazy(() => import('@/app/job/workflows/page'))
// lesson
const LessonAdminApprovals = lazy(() => import('@/app/lesson/admin/approvals/page'))
const LessonAdminArchive = lazy(() => import('@/app/lesson/admin/archive/page'))
const LessonAdminBatches = lazy(() => import('@/app/lesson/admin/batches/page'))
const LessonAdminGranular = lazy(() => import('@/app/lesson/admin/granular/page'))
const LessonAdminGranularAdd = lazy(() => import('@/app/lesson/admin/granular/add/page'))
const LessonAdminHybrid = lazy(() => import('@/app/lesson/admin/hybrid/page'))
const LessonAdminHybridAdd = lazy(() => import('@/app/lesson/admin/hybrid/add/page'))
const LessonAdminSystem = lazy(() => import('@/app/lesson/admin/system/page'))
const LessonAdminSystemAdd = lazy(() => import('@/app/lesson/admin/system/add/page'))
const LessonAdminWorkflows = lazy(() => import('@/app/lesson/admin/workflows/page'))
const LessonLandingPage = lazy(() => import('@/app/lesson/landing/page'))
const LessonLandingDetail = lazy(() => import('@/app/lesson/landing/[id]/page'))
const LessonLandingLearn = lazy(() => import('@/app/lesson/landing/[id]/learn/page'))
// library
const LibraryAbility = lazy(() => import('@/app/library/ability/page'))
const LibraryCertificates = lazy(() => import('@/app/library/certificates/page'))
const LibraryKnowledge = lazy(() => import('@/app/library/knowledge/page'))
const LibraryLandingPage = lazy(() => import('@/app/library/landing/page'))
const LibraryMyResources = lazy(() => import('@/app/library/my-resources/page'))
const LibraryQuestions = lazy(() => import('@/app/library/questions/page'))
const LibraryResources = lazy(() => import('@/app/library/resources/[type]/page'))
const LibraryTags = lazy(() => import('@/app/library/tags/page'))
// partner
const PartnerCoBuildPositions = lazy(() => import('@/app/partner/co-build/positions/page'))
const PartnerCoBuildPositionEdit = lazy(
  () => import('@/app/partner/co-build/positions/[id]/edit/page'),
)
const PartnerCoBuildScenes = lazy(() => import('@/app/partner/co-build/scenes/page'))
const PartnerCoBuildSceneEdit = lazy(() => import('@/app/partner/co-build/scenes/[id]/edit/page'))
const PartnerCoBuildSceneTasks = lazy(
  () => import('@/app/partner/co-build/scenes/[id]/edit/tasks/page'),
)
const PartnerCooperation = lazy(() => import('@/app/partner/cooperation/page'))
const PartnerEmploymentJobs = lazy(() => import('@/app/partner/employment-jobs/page'))
const PartnerEmploymentJobNew = lazy(() => import('@/app/partner/employment-jobs/new/page'))
const PartnerEmploymentJob = lazy(() => import('@/app/partner/employment-jobs/[id]/page'))
const PartnerEmploymentJobEdit = lazy(() => import('@/app/partner/employment-jobs/[id]/edit/page'))
const PartnerEmploymentProjects = lazy(() => import('@/app/partner/employment-projects/page'))
const PartnerEmploymentProject = lazy(() => import('@/app/partner/employment-projects/[id]/page'))
const PartnerEnterprise = lazy(() => import('@/app/partner/enterprise/page'))
const PartnerExperts = lazy(() => import('@/app/partner/experts/page'))
const PartnerExpertNew = lazy(() => import('@/app/partner/experts/new/page'))
const PartnerExpert = lazy(() => import('@/app/partner/experts/[id]/page'))
const PartnerExpertEdit = lazy(() => import('@/app/partner/experts/[id]/edit/page'))
const PartnerLogin = lazy(() => import('@/app/partner/login/page'))
const PartnerSchools = lazy(() => import('@/app/partner/schools/page'))
const PartnerSettings = lazy(() => import('@/app/partner/settings/page'))
const PartnerTasks = lazy(() => import('@/app/partner/tasks/page'))
const PartnerWorkspace = lazy(() => import('@/app/partner/workspace/page'))
// portal
const PortalIndex = lazy(() => import('@/app/portal/page'))
const PortalLogin = lazy(() => import('@/app/portal/login/page'))
const PortalWorkspace = lazy(() => import('@/app/portal/workspace/page'))
const PortalAllianceAchievements = lazy(() => import('@/app/portal/alliance/achievements/page'))
const PortalAllianceAchievement = lazy(() => import('@/app/portal/alliance/achievements/[id]/page'))
const PortalAllianceBrands = lazy(() => import('@/app/portal/alliance/brands/page'))
const PortalAllianceBrand = lazy(() => import('@/app/portal/alliance/brands/[id]/page'))
const PortalAllianceEmployment = lazy(() => import('@/app/portal/alliance/employment/page'))
const PortalAllianceEmploymentDetail = lazy(
  () => import('@/app/portal/alliance/employment/[id]/page'),
)
const PortalAllianceEmploymentJob = lazy(
  () => import('@/app/portal/alliance/employment/job/[id]/page'),
)
const PortalAllianceEmploymentMine = lazy(
  () => import('@/app/portal/alliance/employment/mine/page'),
)
const PortalAllianceEnterprises = lazy(() => import('@/app/portal/alliance/enterprises/page'))
const PortalAllianceEnterprise = lazy(() => import('@/app/portal/alliance/enterprises/[id]/page'))
const PortalAllianceExperts = lazy(() => import('@/app/portal/alliance/experts/page'))
const PortalAllianceExpert = lazy(() => import('@/app/portal/alliance/experts/[id]/page'))
const PortalAllianceLanding = lazy(() => import('@/app/portal/alliance/landing/page'))
const PortalAllianceProjects = lazy(() => import('@/app/portal/alliance/projects/page'))
const PortalAllianceProject = lazy(() => import('@/app/portal/alliance/projects/[id]/page'))
const PortalAppsIndex = lazy(() => import('@/app/portal/apps/page'))
const PortalAppsAiAdminAgents = lazy(() => import('@/app/portal/apps/ai/admin/agents/page'))
const PortalAppsAiAdminIntegrations = lazy(
  () => import('@/app/portal/apps/ai/admin/integrations/page'),
)
const PortalAppsAiAdminKbs = lazy(() => import('@/app/portal/apps/ai/admin/kbs/page'))
const PortalAppsAiAdminReviews = lazy(() => import('@/app/portal/apps/ai/admin/reviews/page'))
const PortalAppsAiAgent = lazy(() => import('@/app/portal/apps/ai/agents/[id]/page'))
const PortalAppsAiHallAgents = lazy(() => import('@/app/portal/apps/ai/hall/agents/page'))
const PortalAppsAiHallKbs = lazy(() => import('@/app/portal/apps/ai/hall/kbs/page'))
const PortalAppsAiKb = lazy(() => import('@/app/portal/apps/ai/kb/[id]/page'))
const PortalAppsAiLanding = lazy(() => import('@/app/portal/apps/ai/landing/page'))
const PortalAppsAiSquare = lazy(() => import('@/app/portal/apps/ai/square/page'))
const PortalAppsAiStudio = lazy(() => import('@/app/portal/apps/ai/studio/page'))
const PortalAppsAiStudioAgent = lazy(() => import('@/app/portal/apps/ai/studio/agents/[id]/page'))
const PortalAppsAiStudioAgentNew = lazy(
  () => import('@/app/portal/apps/ai/studio/agents/new/page'),
)
const PortalAppsAiStudioKb = lazy(() => import('@/app/portal/apps/ai/studio/kb/[id]/page'))
const PortalAppsAiStudioKbNew = lazy(() => import('@/app/portal/apps/ai/studio/kb/new/page'))
const PortalAppsAllianceAchievements = lazy(
  () => import('@/app/portal/apps/alliance/achievements/page'),
)
const PortalAppsAllianceAchievementNew = lazy(
  () => import('@/app/portal/apps/alliance/achievements/new/page'),
)
const PortalAppsAllianceAchievement = lazy(
  () => import('@/app/portal/apps/alliance/achievements/[id]/page'),
)
const PortalAppsAllianceAchievementEdit = lazy(
  () => import('@/app/portal/apps/alliance/achievements/[id]/edit/page'),
)
const PortalAppsAllianceAgreements = lazy(
  () => import('@/app/portal/apps/alliance/agreements/page'),
)
const PortalAppsAllianceAgreementNew = lazy(
  () => import('@/app/portal/apps/alliance/agreements/new/page'),
)
const PortalAppsAllianceAgreement = lazy(
  () => import('@/app/portal/apps/alliance/agreements/[id]/page'),
)
const PortalAppsAllianceAgreementEdit = lazy(
  () => import('@/app/portal/apps/alliance/agreements/[id]/edit/page'),
)
const PortalAppsAllianceBrands = lazy(() => import('@/app/portal/apps/alliance/brands/page'))
const PortalAppsAllianceBrandCulture = lazy(
  () => import('@/app/portal/apps/alliance/brands/culture/page'),
)
const PortalAppsAllianceBrandEmployer = lazy(
  () => import('@/app/portal/apps/alliance/brands/employer/page'),
)
const PortalAppsAllianceBrand = lazy(() => import('@/app/portal/apps/alliance/brands/[id]/page'))
const PortalAppsAllianceBrandJob = lazy(() => import('@/app/portal/apps/alliance/brands/job/page'))
const PortalAppsAllianceBrandMajor = lazy(
  () => import('@/app/portal/apps/alliance/brands/major/page'),
)
const PortalAppsAllianceBrandTalent = lazy(
  () => import('@/app/portal/apps/alliance/brands/talent/page'),
)
const PortalAppsAllianceBrandTeacher = lazy(
  () => import('@/app/portal/apps/alliance/brands/teacher/page'),
)
const PortalAppsAllianceDictionaries = lazy(
  () => import('@/app/portal/apps/alliance/dictionaries/page'),
)
const PortalAppsAllianceEmploymentJob = lazy(
  () => import('@/app/portal/apps/alliance/employmentjob/page'),
)
const PortalAppsAllianceEmploymentProject = lazy(
  () => import('@/app/portal/apps/alliance/employmentproject/page'),
)
const PortalAppsAllianceEmploymentProjectNew = lazy(
  () => import('@/app/portal/apps/alliance/employmentproject/new/page'),
)
const PortalAppsAllianceEmploymentProjectDetail = lazy(
  () => import('@/app/portal/apps/alliance/employmentproject/[id]/page'),
)
const PortalAppsAllianceEnterprises = lazy(
  () => import('@/app/portal/apps/alliance/enterprises/page'),
)
const PortalAppsAllianceEnterprise = lazy(
  () => import('@/app/portal/apps/alliance/enterprises/[id]/page'),
)
const PortalAppsAllianceExperts = lazy(() => import('@/app/portal/apps/alliance/experts/page'))
const PortalAppsAllianceExpert = lazy(() => import('@/app/portal/apps/alliance/experts/[id]/page'))
const PortalAppsAlliancePermissions = lazy(
  () => import('@/app/portal/apps/alliance/permissions/page'),
)
const PortalAppsAllianceProjects = lazy(() => import('@/app/portal/apps/alliance/projects/page'))
const PortalAppsAllianceProjectNew = lazy(
  () => import('@/app/portal/apps/alliance/projects/new/page'),
)
const PortalAppsAllianceProject = lazy(
  () => import('@/app/portal/apps/alliance/projects/[id]/page'),
)
const PortalAppsAllianceProjectEdit = lazy(
  () => import('@/app/portal/apps/alliance/projects/[id]/edit/page'),
)
const PortalAppsAllianceSchool = lazy(() => import('@/app/portal/apps/alliance/school/page'))
const PortalAppsSystemLogsLogin = lazy(() => import('@/app/portal/apps/system/logs/login/page'))
const PortalAppsSystemLogsOperation = lazy(
  () => import('@/app/portal/apps/system/logs/operation/page'),
)
const PortalAppsSystemOrgAccounts = lazy(
  () => import('@/app/portal/apps/system/org-user/accounts/page'),
)
const PortalAppsSystemOrgFields = lazy(
  () => import('@/app/portal/apps/system/org-user/fields/page'),
)
const PortalAppsSystemOrgGraduates = lazy(
  () => import('@/app/portal/apps/system/org-user/graduates/page'),
)
const PortalAppsSystemOrgStructure = lazy(
  () => import('@/app/portal/apps/system/org-user/org-structure/page'),
)
const PortalAppsSystemOrgTypes = lazy(
  () => import('@/app/portal/apps/system/org-user/org-types/page'),
)
const PortalAppsSystemOrgPositions = lazy(
  () => import('@/app/portal/apps/system/org-user/positions/page'),
)
const PortalAppsSystemOrgRelations = lazy(
  () => import('@/app/portal/apps/system/org-user/relations/page'),
)
const PortalAppsSystemOrgRoles = lazy(
  () => import('@/app/portal/apps/system/org-user/roles/page'),
)
const PortalAppsSystemOrgStudents = lazy(
  () => import('@/app/portal/apps/system/org-user/students/page'),
)
const PortalAppsSystemOrgTeachers = lazy(
  () => import('@/app/portal/apps/system/org-user/teachers/page'),
)
const PortalAppsSystemResourceCodes = lazy(
  () => import('@/app/portal/apps/system/resource/codes/page'),
)
const PortalAppsSystemResourceIndustries = lazy(
  () => import('@/app/portal/apps/system/resource/industries/page'),
)
const PortalAppsSystemResourceMajors = lazy(
  () => import('@/app/portal/apps/system/resource/majors/page'),
)
const PortalAppsSystemResourcePackage = lazy(
  () => import('@/app/portal/apps/system/resource/package/page'),
)
const PortalAppsSystemTenant = lazy(() => import('@/app/portal/apps/system/tenant/page'))
// scene
const SceneIndex = lazy(() => import('@/app/scene/page'))
const SceneApprovals = lazy(() => import('@/app/scene/approvals/page'))
const SceneArchive = lazy(() => import('@/app/scene/archive/page'))
const SceneBatches = lazy(() => import('@/app/scene/batches/page'))
const SceneLandingPage = lazy(() => import('@/app/scene/landing/page'))
const SceneLandingDetail = lazy(() => import('@/app/scene/landing/[id]/page'))
const SceneLandingLearn = lazy(() => import('@/app/scene/landing/[id]/learn/page'))
const SceneScenarioEdit = lazy(() => import('@/app/scene/scenarios/[id]/edit/page'))
const SceneScenarioEditTasks = lazy(() => import('@/app/scene/scenarios/[id]/edit/tasks/page'))
const SceneWorkflows = lazy(() => import('@/app/scene/workflows/page'))
// superadmin
const SuperadminIndex = lazy(() => import('@/app/superadmin/page'))

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/changelog" element={<ChangelogPage />} />

        <Route path="/affairs" element={<AffairsLayout><Outlet /></AffairsLayout>}>
          <Route path="approvals" element={<AffairsApprovals />} />
          <Route path="batches" element={<AffairsBatches />} />
          <Route path="config" element={<AffairsConfig />} />
          <Route path="majors" element={<AffairsMajors />} />
          <Route path="org-structure" element={<AffairsOrgStructure />} />
          <Route path="positions" element={<AffairsPositions />} />
          <Route path="programs" element={<AffairsPrograms />} />
          <Route path="programs/:id" element={<AffairsProgramDetail />} />
          <Route path="relations" element={<AffairsRelations />} />
          <Route path="scheduling" element={<AffairsScheduling />} />
          <Route path="student-portraits" element={<AffairsStudentPortraits />} />
          <Route path="students" element={<AffairsStudents />} />
          <Route path="teachers" element={<AffairsTeachers />} />
          <Route path="teaching-plans" element={<AffairsTeachingPlans />} />
          <Route path="teaching-plans/:id" element={<AffairsTeachingPlanDetail />} />
          <Route path="workflows" element={<AffairsWorkflows />} />
        </Route>

        <Route path="/evaluation" element={<EvaluationLayout><Outlet /></EvaluationLayout>}>
          <Route path="approvals" element={<EvaluationApprovals />} />
          <Route path="batches" element={<EvaluationBatches />} />
          <Route path="exam-usage" element={<EvaluationExamUsage />} />
          <Route path="exam-usage/results" element={<EvaluationExamUsageResults />} />
          <Route path="exams" element={<EvaluationExams />} />
          <Route path="exams/:id" element={<EvaluationExamDetail />} />
          <Route path="job-ability" element={<EvaluationJobAbility />} />
          <Route path="job-ability/config/:id" element={<EvaluationJobAbilityConfig />} />
          <Route path="job-ability/results" element={<EvaluationJobAbilityResults />} />
          <Route
            path="landing"
            element={<EvaluationLandingLayout><Outlet /></EvaluationLandingLayout>}
          >
            <Route index element={<EvaluationLandingPage />} />
            <Route path="banks/:id" element={<EvaluationLandingBankDetail />} />
            <Route path="exam-center" element={<EvaluationLandingExamCenter />} />
            <Route path="exams" element={<Navigate to="exam-center" replace />} />
            <Route path="exams/:id" element={<EvaluationLandingExamDetail />} />
          </Route>
          <Route path="lesson-results" element={<EvaluationLessonResults />} />
          <Route path="lesson-results/:id" element={<EvaluationLessonResultDetail />} />
          <Route path="lesson-results/daily-exams" element={<EvaluationDailyExams />} />
          <Route
            path="lesson-results/daily-exams/:resultId"
            element={<EvaluationDailyExamDetail />}
          />
          <Route path="question-banks" element={<EvaluationQuestionBanks />} />
          <Route path="question-banks/:id" element={<EvaluationQuestionBankDetail />} />
          <Route path="scene-results" element={<EvaluationSceneResults />} />
          <Route path="scene-results/:id" element={<EvaluationSceneResultDetail />} />
          <Route path="workflows" element={<EvaluationWorkflows />} />
        </Route>

        <Route path="/job" element={<JobLayout><Outlet /></JobLayout>}>
          <Route path="approvals" element={<JobApprovals />} />
          <Route path="archive" element={<JobArchive />} />
          <Route path="batches" element={<JobBatches />} />
          <Route path="landing" element={<JobLandingLayout><Outlet /></JobLandingLayout>}>
            <Route index element={<JobLandingPage />} />
            <Route path=":id" element={<JobLandingDetail />} />
            <Route path=":id/learn" element={<JobLandingLearn />} />
          </Route>
          <Route path="learn-roads" element={<JobLearnRoads />} />
          <Route path="positions" element={<JobPositions />} />
          <Route path="positions/:id/edit" element={<JobPositionEdit />} />
          <Route path="recommend" element={<JobRecommend />} />
          <Route path="workflows" element={<JobWorkflows />} />
        </Route>

        <Route path="/lesson" element={<LessonLayout><Outlet /></LessonLayout>}>
          <Route path="admin" element={<LessonAdminLayout><Outlet /></LessonAdminLayout>}>
            <Route path="approvals" element={<LessonAdminApprovals />} />
            <Route path="archive" element={<LessonAdminArchive />} />
            <Route path="batches" element={<LessonAdminBatches />} />
            <Route path="granular" element={<LessonAdminGranular />} />
            <Route path="granular/add" element={<LessonAdminGranularAdd />} />
            <Route path="hybrid" element={<LessonAdminHybrid />} />
            <Route path="hybrid/add" element={<LessonAdminHybridAdd />} />
            <Route path="system" element={<LessonAdminSystem />} />
            <Route path="system/add" element={<LessonAdminSystemAdd />} />
            <Route path="workflows" element={<LessonAdminWorkflows />} />
          </Route>
          <Route path="landing" element={<LessonLandingLayout><Outlet /></LessonLandingLayout>}>
            <Route index element={<LessonLandingPage />} />
            <Route path=":id" element={<LessonLandingDetail />} />
            <Route path=":id/learn" element={<LessonLandingLearn />} />
          </Route>
        </Route>

        <Route path="/library" element={<LibraryLayout><Outlet /></LibraryLayout>}>
          <Route path="ability" element={<LibraryAbility />} />
          <Route path="certificates" element={<LibraryCertificates />} />
          <Route path="knowledge" element={<LibraryKnowledge />} />
          <Route path="landing" element={<LibraryLandingLayout><Outlet /></LibraryLandingLayout>}>
            <Route index element={<LibraryLandingPage />} />
          </Route>
          <Route path="my-resources" element={<LibraryMyResources />} />
          <Route path="questions" element={<LibraryQuestions />} />
          <Route path="resources/:type" element={<LibraryResources />} />
          <Route path="tags" element={<LibraryTags />} />
        </Route>

        <Route path="/partner" element={<PartnerLayout><Outlet /></PartnerLayout>}>
          <Route index element={<Navigate to="workspace" replace />} />
          <Route path="co-build/positions" element={<PartnerCoBuildPositions />} />
          <Route path="co-build/positions/:id/edit" element={<PartnerCoBuildPositionEdit />} />
          <Route path="co-build/scenes" element={<PartnerCoBuildScenes />} />
          <Route path="co-build/scenes/:id/edit" element={<PartnerCoBuildSceneEdit />} />
          <Route path="co-build/scenes/:id/edit/tasks" element={<PartnerCoBuildSceneTasks />} />
          <Route path="cooperation" element={<PartnerCooperation />} />
          <Route path="employment-jobs" element={<PartnerEmploymentJobs />} />
          <Route path="employment-jobs/new" element={<PartnerEmploymentJobNew />} />
          <Route path="employment-jobs/:id" element={<PartnerEmploymentJob />} />
          <Route path="employment-jobs/:id/edit" element={<PartnerEmploymentJobEdit />} />
          <Route path="employment-projects" element={<PartnerEmploymentProjects />} />
          <Route path="employment-projects/:id" element={<PartnerEmploymentProject />} />
          <Route path="enterprise" element={<PartnerEnterprise />} />
          <Route path="experts" element={<PartnerExperts />} />
          <Route path="experts/new" element={<PartnerExpertNew />} />
          <Route path="experts/:id" element={<PartnerExpert />} />
          <Route path="experts/:id/edit" element={<PartnerExpertEdit />} />
          <Route path="login" element={<PartnerLogin />} />
          <Route path="schools" element={<PartnerSchools />} />
          <Route path="settings" element={<PartnerSettings />} />
          <Route path="tasks" element={<PartnerTasks />} />
          <Route path="workspace" element={<PartnerWorkspace />} />
        </Route>

        <Route path="/portal" element={<PortalLayout><Outlet /></PortalLayout>}>
          <Route index element={<PortalIndex />} />
          <Route path="login" element={<PortalLogin />} />
          <Route path="workspace" element={<PortalWorkspace />} />
          <Route path="alliance" element={<PortalAllianceLayout><Outlet /></PortalAllianceLayout>}>
            <Route path="achievements" element={<PortalAllianceAchievements />} />
            <Route path="achievements/:id" element={<PortalAllianceAchievement />} />
            <Route path="brands" element={<PortalAllianceBrands />} />
            <Route path="brands/:id" element={<PortalAllianceBrand />} />
            <Route path="employment" element={<PortalAllianceEmployment />} />
            <Route path="employment/:id" element={<PortalAllianceEmploymentDetail />} />
            <Route path="employment/job/:id" element={<PortalAllianceEmploymentJob />} />
            <Route path="employment/mine" element={<PortalAllianceEmploymentMine />} />
            <Route path="enterprises" element={<PortalAllianceEnterprises />} />
            <Route path="enterprises/:id" element={<PortalAllianceEnterprise />} />
            <Route path="experts" element={<PortalAllianceExperts />} />
            <Route path="experts/:id" element={<PortalAllianceExpert />} />
            <Route path="landing" element={<PortalAllianceLanding />} />
            <Route path="projects" element={<PortalAllianceProjects />} />
            <Route path="projects/:id" element={<PortalAllianceProject />} />
          </Route>
          <Route path="apps">
            <Route index element={<PortalAppsIndex />} />
            <Route path="ai" element={<PortalAppsAiLayout><Outlet /></PortalAppsAiLayout>}>
              <Route path="admin/agents" element={<PortalAppsAiAdminAgents />} />
              <Route path="admin/integrations" element={<PortalAppsAiAdminIntegrations />} />
              <Route path="admin/kbs" element={<PortalAppsAiAdminKbs />} />
              <Route path="admin/reviews" element={<PortalAppsAiAdminReviews />} />
              <Route path="agents/:id" element={<PortalAppsAiAgent />} />
              <Route path="hall/agents" element={<PortalAppsAiHallAgents />} />
              <Route path="hall/kbs" element={<PortalAppsAiHallKbs />} />
              <Route path="kb/:id" element={<PortalAppsAiKb />} />
              <Route path="landing" element={<PortalAppsAiLanding />} />
              <Route path="square" element={<PortalAppsAiSquare />} />
              <Route path="studio" element={<PortalAppsAiStudio />} />
              <Route path="studio/agents/:id" element={<PortalAppsAiStudioAgent />} />
              <Route path="studio/agents/new" element={<PortalAppsAiStudioAgentNew />} />
              <Route path="studio/kb/:id" element={<PortalAppsAiStudioKb />} />
              <Route path="studio/kb/new" element={<PortalAppsAiStudioKbNew />} />
            </Route>
            <Route
              path="alliance"
              element={<PortalAppsAllianceLayout><Outlet /></PortalAppsAllianceLayout>}
            >
              <Route path="achievements" element={<PortalAppsAllianceAchievements />} />
              <Route path="achievements/new" element={<PortalAppsAllianceAchievementNew />} />
              <Route path="achievements/:id" element={<PortalAppsAllianceAchievement />} />
              <Route
                path="achievements/:id/edit"
                element={<PortalAppsAllianceAchievementEdit />}
              />
              <Route path="agreements" element={<PortalAppsAllianceAgreements />} />
              <Route path="agreements/new" element={<PortalAppsAllianceAgreementNew />} />
              <Route path="agreements/:id" element={<PortalAppsAllianceAgreement />} />
              <Route path="agreements/:id/edit" element={<PortalAppsAllianceAgreementEdit />} />
              <Route path="brands" element={<PortalAppsAllianceBrands />} />
              <Route path="brands/culture" element={<PortalAppsAllianceBrandCulture />} />
              <Route path="brands/employer" element={<PortalAppsAllianceBrandEmployer />} />
              <Route path="brands/:id" element={<PortalAppsAllianceBrand />} />
              <Route path="brands/job" element={<PortalAppsAllianceBrandJob />} />
              <Route path="brands/major" element={<PortalAppsAllianceBrandMajor />} />
              <Route path="brands/talent" element={<PortalAppsAllianceBrandTalent />} />
              <Route path="brands/teacher" element={<PortalAppsAllianceBrandTeacher />} />
              <Route path="dictionaries" element={<PortalAppsAllianceDictionaries />} />
              <Route path="employmentjob" element={<PortalAppsAllianceEmploymentJob />} />
              <Route path="employmentproject" element={<PortalAppsAllianceEmploymentProject />} />
              <Route
                path="employmentproject/new"
                element={<PortalAppsAllianceEmploymentProjectNew />}
              />
              <Route
                path="employmentproject/:id"
                element={<PortalAppsAllianceEmploymentProjectDetail />}
              />
              <Route path="enterprises" element={<PortalAppsAllianceEnterprises />} />
              <Route path="enterprises/:id" element={<PortalAppsAllianceEnterprise />} />
              <Route path="experts" element={<PortalAppsAllianceExperts />} />
              <Route path="experts/:id" element={<PortalAppsAllianceExpert />} />
              <Route path="permissions" element={<PortalAppsAlliancePermissions />} />
              <Route path="projects" element={<PortalAppsAllianceProjects />} />
              <Route path="projects/new" element={<PortalAppsAllianceProjectNew />} />
              <Route path="projects/:id" element={<PortalAppsAllianceProject />} />
              <Route path="projects/:id/edit" element={<PortalAppsAllianceProjectEdit />} />
              <Route path="school" element={<PortalAppsAllianceSchool />} />
            </Route>
            <Route
              path="system"
              element={<PortalAppsSystemLayout><Outlet /></PortalAppsSystemLayout>}
            >
              <Route index element={<Navigate to="tenant" replace />} />
              <Route path="logs/login" element={<PortalAppsSystemLogsLogin />} />
              <Route path="logs/operation" element={<PortalAppsSystemLogsOperation />} />
              <Route path="org-user/accounts" element={<PortalAppsSystemOrgAccounts />} />
              <Route path="org-user/fields" element={<PortalAppsSystemOrgFields />} />
              <Route path="org-user/graduates" element={<PortalAppsSystemOrgGraduates />} />
              <Route path="org-user/org-structure" element={<PortalAppsSystemOrgStructure />} />
              <Route path="org-user/org-types" element={<PortalAppsSystemOrgTypes />} />
              <Route path="org-user/positions" element={<PortalAppsSystemOrgPositions />} />
              <Route path="org-user/relations" element={<PortalAppsSystemOrgRelations />} />
              <Route path="org-user/roles" element={<PortalAppsSystemOrgRoles />} />
              <Route path="org-user/students" element={<PortalAppsSystemOrgStudents />} />
              <Route path="org-user/teachers" element={<PortalAppsSystemOrgTeachers />} />
              <Route path="resource/codes" element={<PortalAppsSystemResourceCodes />} />
              <Route path="resource/industries" element={<PortalAppsSystemResourceIndustries />} />
              <Route path="resource/majors" element={<PortalAppsSystemResourceMajors />} />
              <Route path="resource/package" element={<PortalAppsSystemResourcePackage />} />
              <Route path="tenant" element={<PortalAppsSystemTenant />} />
            </Route>
          </Route>
        </Route>

        <Route path="/scene" element={<SceneLayout><Outlet /></SceneLayout>}>
          <Route index element={<SceneIndex />} />
          <Route path="approvals" element={<SceneApprovals />} />
          <Route path="archive" element={<SceneArchive />} />
          <Route path="batches" element={<SceneBatches />} />
          <Route path="landing" element={<SceneLandingLayout><Outlet /></SceneLandingLayout>}>
            <Route index element={<SceneLandingPage />} />
            <Route path=":id" element={<SceneLandingDetail />} />
            <Route path=":id/learn" element={<SceneLandingLearn />} />
          </Route>
          <Route path="scenarios/:id/edit" element={<SceneScenarioEdit />} />
          <Route path="scenarios/:id/edit/tasks" element={<SceneScenarioEditTasks />} />
          <Route path="workflows" element={<SceneWorkflows />} />
        </Route>

        <Route path="/superadmin" element={<SuperadminLayout><Outlet /></SuperadminLayout>}>
          <Route index element={<SuperadminIndex />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

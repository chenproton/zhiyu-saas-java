package service

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListAbilities 查询能力点列表。
func (s *PositionService) ListAbilities(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.AbilityPoint]) ([]domain.AbilityPoint, int, error) {
	return s.st.Abilities().List(ctx, p, cfg)
}

// GetAbility 查询单个能力点。
func (s *PositionService) GetAbility(ctx context.Context, id string) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Get(ctx, id)
}

// CreateAbility 创建能力点。
func (s *PositionService) CreateAbility(ctx context.Context, tenantID string, p *store.AbilityPointParams) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Create(ctx, tenantID, p)
}

// UpdateAbility 更新能力点。
func (s *PositionService) UpdateAbility(ctx context.Context, id string, p *store.AbilityPointParams) (*domain.AbilityPoint, error) {
	return s.st.Abilities().Update(ctx, id, p)
}

// DeleteAbility 删除能力点。
func (s *PositionService) DeleteAbility(ctx context.Context, id string) error {
	return s.st.Abilities().Delete(ctx, id)
}

// ListAbilityDomains 查询能力域列表。
func (s *PositionService) ListAbilityDomains(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.AbilityDomain]) ([]domain.AbilityDomain, int, error) {
	return s.st.AbilityDomains().List(ctx, p, cfg)
}

// GetAbilityDomain 查询单个能力域。
func (s *PositionService) GetAbilityDomain(ctx context.Context, id string) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Get(ctx, id)
}

// CreateAbilityDomain 创建能力域。
func (s *PositionService) CreateAbilityDomain(ctx context.Context, tenantID string, p *store.AbilityDomainParams) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Create(ctx, tenantID, p)
}

// UpdateAbilityDomain 更新能力域。
func (s *PositionService) UpdateAbilityDomain(ctx context.Context, id string, p *store.AbilityDomainParams) (*domain.AbilityDomain, error) {
	return s.st.AbilityDomains().Update(ctx, id, p)
}

// DeleteAbilityDomain 删除能力域。
func (s *PositionService) DeleteAbilityDomain(ctx context.Context, id string) error {
	return s.st.AbilityDomains().Delete(ctx, id)
}

// ListBanners 查询轮播图列表。
func (s *PositionService) ListBanners(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.JobBannerConfig]) ([]domain.JobBannerConfig, int, error) {
	return s.st.Banners().List(ctx, p, cfg)
}

// GetBanner 查询单个轮播图。
func (s *PositionService) GetBanner(ctx context.Context, id string) (*domain.JobBannerConfig, error) {
	return s.st.Banners().Get(ctx, id)
}

// CreateBanner 创建轮播图。
func (s *PositionService) CreateBanner(ctx context.Context, tenantID string, p *store.BannerParams) (*domain.JobBannerConfig, error) {
	return s.st.Banners().Create(ctx, tenantID, p)
}

// UpdateBanner 更新轮播图。
func (s *PositionService) UpdateBanner(ctx context.Context, id string, p *store.BannerParams) (*domain.JobBannerConfig, error) {
	return s.st.Banners().Update(ctx, id, p)
}

// DeleteBanner 删除轮播图。
func (s *PositionService) DeleteBanner(ctx context.Context, id string) error {
	return s.st.Banners().Delete(ctx, id)
}

// ListTerms 查询学期列表。
func (s *PositionService) ListTerms(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Term]) ([]domain.Term, int, error) {
	return s.st.Terms().List(ctx, p, cfg)
}

// GetTerm 查询单个学期。
func (s *PositionService) GetTerm(ctx context.Context, id, tenantID string) (*domain.Term, error) {
	return s.st.Terms().Get(ctx, id, tenantID)
}

// CreateTerm 创建学期（事务）。
func (s *PositionService) CreateTerm(ctx context.Context, tenantID string, p *store.TermParams) (string, error) {
	var id string
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		i, err := txStore.Terms().Create(ctx, txStore.Q(), tenantID, p)
		if err != nil {
			return err
		}
		id = i
		return nil
	})
	return id, err
}

// UpdateTerm 更新学期（事务）。
func (s *PositionService) UpdateTerm(ctx context.Context, tenantID, id string, p *store.TermParams) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Terms().Update(ctx, txStore.Q(), tenantID, id, p)
	})
}

// DeleteTerm 删除学期。
func (s *PositionService) DeleteTerm(ctx context.Context, id, tenantID string) error {
	return s.st.Terms().Delete(ctx, id, tenantID)
}

// BatchQueryer 暴露批次查询器。
func (s *PositionService) BatchQueryer() store.Queryer {
	return s.st.Q()
}

// BatchTenantOf 查询批次租户。
func (s *PositionService) BatchTenantOf(ctx context.Context, table, id string) (string, error) {
	return s.st.Batches().TenantOf(ctx, table, id)
}

// BatchCreate 创建批次。
func (s *PositionService) BatchCreate(ctx context.Context, table string, fields store.BatchCreateFields, id string, tenantID *string, tenantScoped bool, extraCols []string, extraVals []any) error {
	return s.st.Batches().CreateFields(ctx, table, fields, id, tenantID, tenantScoped, extraCols, extraVals)
}

// BatchUpdate 更新批次。
func (s *PositionService) BatchUpdate(ctx context.Context, table string, fields store.BatchUpdateFields, id string) error {
	return s.st.Batches().UpdateFields(ctx, table, fields, id)
}

// BatchDelete 删除批次。
func (s *PositionService) BatchDelete(ctx context.Context, table, id string) error {
	return s.st.Batches().Delete(ctx, table, id)
}

// BatchUpdateStatus 更新批次状态。
func (s *PositionService) BatchUpdateStatus(ctx context.Context, table, id, status string) error {
	return s.st.Batches().UpdateStatus(ctx, table, id, status)
}

// BatchGetByTable 按表查询批次单行。
func (s *PositionService) BatchGetByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error) {
	return s.st.Batches().GetByTable(ctx, s.st.Q(), table, selectColumns, id)
}

// ListWorkflows 查询审批流程列表。
func (s *PositionService) ListWorkflows(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Workflow]) ([]domain.Workflow, int, error) {
	return s.st.Workflows().List(ctx, p, cfg)
}

// GetWorkflow 查询单个审批流程。
func (s *PositionService) GetWorkflow(ctx context.Context, id string) (*domain.Workflow, error) {
	return s.st.Workflows().Get(ctx, id)
}

// CreateWorkflow 创建审批流程。
func (s *PositionService) CreateWorkflow(ctx context.Context, tenantID *string, p *store.WorkflowParams) (*domain.Workflow, error) {
	return s.st.Workflows().Create(ctx, tenantID, p)
}

// UpdateWorkflow 更新审批流程。
func (s *PositionService) UpdateWorkflow(ctx context.Context, id string, p *store.WorkflowParams) (*domain.Workflow, error) {
	return s.st.Workflows().Update(ctx, id, p)
}

// DeleteWorkflow 删除审批流程。
func (s *PositionService) DeleteWorkflow(ctx context.Context, id string) error {
	return s.st.Workflows().Delete(ctx, id)
}

// GetSubscription 查询订阅。
func (s *PositionService) GetSubscription(ctx context.Context, id string) (*domain.SubscriptionPackage, error) {
	return s.st.Subscriptions().Get(ctx, id)
}

// GetSubscriptionByTenant 查询租户订阅。
func (s *PositionService) GetSubscriptionByTenant(ctx context.Context, tenantID string) (*domain.SubscriptionPackage, error) {
	return s.st.Subscriptions().GetByTenant(ctx, tenantID)
}

// UpdateSubscription 更新订阅。
func (s *PositionService) UpdateSubscription(ctx context.Context, id string, p *store.SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	return s.st.Subscriptions().Update(ctx, id, p)
}

// ListResourceCodes 查询资源码列表。
func (s *PositionService) ListResourceCodes(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ResourceCode]) ([]domain.ResourceCode, int, error) {
	return s.st.ResourceCodes().List(ctx, p, cfg)
}

// GetResourceCode 查询单个资源码。
func (s *PositionService) GetResourceCode(ctx context.Context, id string) (*domain.ResourceCode, error) {
	return s.st.ResourceCodes().Get(ctx, id)
}

// CreateResourceCode 创建资源码。
func (s *PositionService) CreateResourceCode(ctx context.Context, p *store.ResourceCodeParams) (*domain.ResourceCode, error) {
	return s.st.ResourceCodes().Create(ctx, p)
}

// UpdateResourceCode 更新资源码。
func (s *PositionService) UpdateResourceCode(ctx context.Context, id string, p *store.ResourceCodeParams) (*domain.ResourceCode, error) {
	return s.st.ResourceCodes().Update(ctx, id, p)
}

// DeleteResourceCode 删除资源码。
func (s *PositionService) DeleteResourceCode(ctx context.Context, id string) error {
	return s.st.ResourceCodes().Delete(ctx, id)
}

// ListRecommends 查询推荐位列表。
func (s *PositionService) ListRecommends(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.PositionRecommendation]) ([]domain.PositionRecommendation, int, error) {
	return s.st.Recommends().List(ctx, p, cfg)
}

// GetRecommend 查询单个推荐位。
func (s *PositionService) GetRecommend(ctx context.Context, id string) (*domain.PositionRecommendation, error) {
	return s.st.Recommends().Get(ctx, id)
}

// CreateRecommend 创建推荐位。
func (s *PositionService) CreateRecommend(ctx context.Context, tenantID string, p *store.RecommendParams) (*domain.PositionRecommendation, error) {
	return s.st.Recommends().Create(ctx, tenantID, p)
}

// UpdateRecommend 更新推荐位。
func (s *PositionService) UpdateRecommend(ctx context.Context, id string, p *store.RecommendParams) (*domain.PositionRecommendation, error) {
	return s.st.Recommends().Update(ctx, id, p)
}

// DeleteRecommend 删除推荐位。
func (s *PositionService) DeleteRecommend(ctx context.Context, id string) error {
	return s.st.Recommends().Delete(ctx, id)
}

// CreateSubscription 创建订阅。
func (s *PositionService) CreateSubscription(ctx context.Context, p *store.SubscriptionUpdateParams) (*domain.SubscriptionPackage, error) {
	return s.st.Subscriptions().Create(ctx, p)
}

// ListHybridModules 查询混合模块列表。
func (s *PositionService) ListHybridModules(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.HybridNodeModule]) ([]domain.HybridNodeModule, int, error) {
	return s.st.HybridModules().List(ctx, p, cfg)
}

// GetHybridModule 查询单个混合模块。
func (s *PositionService) GetHybridModule(ctx context.Context, id string) (*domain.HybridNodeModule, error) {
	return s.st.HybridModules().Get(ctx, id)
}

// UpsertHybridModule 创建或更新混合模块。
func (s *PositionService) UpsertHybridModule(ctx context.Context, tenantID, id string, p *store.HybridModuleParams) (*domain.HybridNodeModule, error) {
	if id != "" {
		return s.st.HybridModules().Update(ctx, id, p)
	}
	return s.st.HybridModules().Create(ctx, tenantID, p)
}

// DeleteHybridModule 删除混合模块。
func (s *PositionService) DeleteHybridModule(ctx context.Context, id string) error {
	return s.st.HybridModules().Delete(ctx, id)
}

// ListLessonBehaviorRecords 查询课堂行为记录。
func (s *PositionService) ListLessonBehaviorRecords(ctx context.Context, courseID, startDate, endDate string) ([]domain.LessonBehaviorRecord, error) {
	return s.st.LessonBehaviors().ListRecords(ctx, courseID, startDate, endDate)
}

// UpsertLessonBehavior 保存课堂行为记录。
func (s *PositionService) UpsertLessonBehavior(ctx context.Context, tenantID string, p *store.LessonBehaviorUpsertParams) (*domain.LessonBehaviorRecord, error) {
	return s.st.LessonBehaviors().Upsert(ctx, tenantID, p)
}

// ListLandingExams 查询落地考试。
func (s *PositionService) ListLandingExams(ctx context.Context, tenantID string) ([]store.LandingExam, error) {
	return s.st.Landing().ListExams(ctx, tenantID)
}

// ListApprovals 查询审批记录列表。
func (s *PositionService) ListApprovals(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ApprovalRecord]) ([]domain.ApprovalRecord, int, error) {
	return s.st.Approvals().List(ctx, p, cfg)
}

// GetApproval 查询单个审批记录。
func (s *PositionService) GetApproval(ctx context.Context, id string) (*domain.ApprovalRecord, error) {
	return s.st.Approvals().Get(ctx, id)
}

// CreateApproval 创建审批记录。
func (s *PositionService) CreateApproval(ctx context.Context, tenantID *string, p *store.ApprovalCreateParams) (*domain.ApprovalRecord, error) {
	return s.st.Approvals().Create(ctx, tenantID, p)
}

// ReviewApproval 评审审批（事务：更新记录+同步实体状态）。
func (s *PositionService) ReviewApproval(ctx context.Context, id, action, newStatus string, stepIdx int, history domain.JSONSlice, targetType, targetID string, tenantID *string, syncStatus bool) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		if action == string(domain.ApprovalStatusRejected) {
			ok, err := txStore.Approvals().RejectRecord(ctx, txStore.Q(), id, newStatus, history)
			if err != nil {
				return err
			}
			if !ok {
				return store.ErrNotFound
			}
			if syncStatus && tenantID != nil {
				if err := txStore.Approvals().SyncEntityStatus(ctx, txStore.Q(), targetType, newStatus, targetID, *tenantID); err != nil {
					return err
				}
			}
			return nil
		}
		ok, err := txStore.Approvals().AdvanceRecord(ctx, txStore.Q(), id, newStatus, stepIdx, history)
		if err != nil {
			return err
		}
		if !ok {
			return store.ErrNotFound
		}
		if syncStatus && tenantID != nil {
			if err := txStore.Approvals().SyncEntityStatus(ctx, txStore.Q(), targetType, newStatus, targetID, *tenantID); err != nil {
				return err
			}
		}
		return nil
	})
}

// UpdateApprovalHistory 更新审批历史（不推进）。
func (s *PositionService) UpdateApprovalHistory(ctx context.Context, id string, history domain.JSONSlice) (bool, error) {
	return s.st.Approvals().UpdateHistory(ctx, id, history)
}

// ListTeachingPlans 查询教学计划列表。
func (s *PositionService) ListTeachingPlans(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.TeachingPlan]) ([]domain.TeachingPlan, int, error) {
	return s.st.TeachingPlans().List(ctx, p, cfg)
}

// GetTeachingPlan 查询单个教学计划。
func (s *PositionService) GetTeachingPlan(ctx context.Context, id, tenantID string) (*domain.TeachingPlan, error) {
	return s.st.TeachingPlans().Get(ctx, id, tenantID)
}

// ListTeachingPlanEntries 查询计划条目。
func (s *PositionService) ListTeachingPlanEntries(ctx context.Context, planID, tenantID string) ([]domain.TeachingPlanEntry, error) {
	return s.st.TeachingPlans().ListPlanEntries(ctx, planID, tenantID)
}

// GetTeachingPlanEntry 查询单个计划条目。
func (s *PositionService) GetTeachingPlanEntry(ctx context.Context, id, tenantID string) (*domain.TeachingPlanEntry, error) {
	return s.st.TeachingPlans().GetPlanEntry(ctx, id, tenantID)
}

// UpdateTeachingPlanEntry 更新计划条目。
func (s *PositionService) UpdateTeachingPlanEntry(ctx context.Context, id, tenantID string, e *domain.TeachingPlanEntry, credits *float64, totalHours *int, classNodeIDs *[]string) error {
	return s.st.TeachingPlans().UpdatePlanEntry(ctx, id, tenantID, e, credits, totalHours, classNodeIDs)
}

// DeleteTeachingPlanEntry 删除计划条目。
func (s *PositionService) DeleteTeachingPlanEntry(ctx context.Context, id, tenantID string) error {
	return s.st.TeachingPlans().DeletePlanEntry(ctx, id, tenantID)
}

// ConfirmTeachingPlan 确认计划。
func (s *PositionService) ConfirmTeachingPlan(ctx context.Context, id, tenantID string) error {
	return s.st.TeachingPlans().ConfirmPlan(ctx, id, tenantID)
}

// GenerateTeachingPlan 生成教学计划（事务）。
func (s *PositionService) GenerateTeachingPlan(ctx context.Context, p *store.GeneratePlanParams, courses []store.PlanCourse, posScenMap map[string][]store.ScenarioBrief, weeksCount int) (string, error) {
	var planID string
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		id, err := txStore.TeachingPlans().GeneratePlan(ctx, txStore.Q(), p, courses, posScenMap, weeksCount)
		if err != nil {
			return err
		}
		planID = id
		return nil
	})
	return planID, err
}

// FetchTeachingPlanProgramBrief 查询人培方案简要。
func (s *PositionService) FetchTeachingPlanProgramBrief(ctx context.Context, id, tenantID string) (*store.ProgramBrief, error) {
	return s.st.TeachingPlans().FetchProgramBrief(ctx, id, tenantID)
}

// FetchTeachingPlanTermWeeks 查询学期周数。
func (s *PositionService) FetchTeachingPlanTermWeeks(ctx context.Context, id, tenantID string) (int, error) {
	return s.st.TeachingPlans().TermWeeks(ctx, id, tenantID)
}

// FetchTeachingPlanCourses 查询方案课程。
func (s *PositionService) FetchTeachingPlanCourses(ctx context.Context, programID string) ([]store.PlanCourse, error) {
	return s.st.TeachingPlans().FetchProgramCourses(ctx, programID)
}

// FetchPositionScenarios 查询岗位场景。
func (s *PositionService) FetchPositionScenarios(ctx context.Context, positionID string) ([]store.ScenarioBrief, error) {
	return s.st.TeachingPlans().FetchPositionScenarios(ctx, positionID)
}

// FindTeachingPlanExisting 查询已有计划。
func (s *PositionService) FindTeachingPlanExisting(ctx context.Context, programID, termID, tenantID string) (string, error) {
	return s.st.TeachingPlans().FindExistingPlan(ctx, programID, termID, tenantID)
}

// TeachingPlanScheduledCount 查询已排课条目数。
func (s *PositionService) TeachingPlanScheduledCount(ctx context.Context, planID string) (int, error) {
	return s.st.TeachingPlans().ScheduledEntryCount(ctx, planID)
}

// ListAnnouncements 查询公告。
func (s *PositionService) ListAnnouncements(ctx context.Context, role string, tenantID *string) ([]store.AnnouncementRow, error) {
	return s.st.Portal().ListAnnouncements(ctx, role, tenantID)
}

// PendingApprovalCount 待审批数。
func (s *PositionService) PendingApprovalCount(ctx context.Context, tenantID *string) int {
	return s.st.Portal().PendingApprovalCount(ctx, tenantID)
}

// DraftCourseCount 待提交课程数。
func (s *PositionService) DraftCourseCount(ctx context.Context, userID string, tenantID *string) int {
	return s.st.Portal().DraftCourseCount(ctx, userID, tenantID)
}

// UpcomingExamCount 待参加考试数。
func (s *PositionService) UpcomingExamCount(ctx context.Context, tenantID *string, now time.Time) int {
	return s.st.Portal().UpcomingExamCount(ctx, tenantID, now)
}

// ListTeacherSchedules 教师排课事件。
func (s *PositionService) ListTeacherSchedules(ctx context.Context, userID string, tenantID *string) ([]store.TeacherScheduleRow, error) {
	return s.st.Portal().ListTeacherSchedules(ctx, userID, tenantID)
}

// UserClassNodeID 用户班级节点。
func (s *PositionService) UserClassNodeID(ctx context.Context, userID string, tenantID *string) string {
	return s.st.Portal().UserClassNodeID(ctx, userID, tenantID)
}

// ListStudentSchedules 学生排课事件。
func (s *PositionService) ListStudentSchedules(ctx context.Context, classNodeID string, tenantID *string) ([]store.StudentScheduleRow, error) {
	return s.st.Portal().ListStudentSchedules(ctx, classNodeID, tenantID)
}

// ListExamEvents 考试事件。
func (s *PositionService) ListExamEvents(ctx context.Context, tenantID *string) ([]store.ExamEventRow, error) {
	return s.st.Portal().ListExamEvents(ctx, tenantID)
}

// TeacherStats 教师统计。
func (s *PositionService) TeacherStats(ctx context.Context, userID string, tenantID *string) (int, int) {
	return s.st.Portal().TeacherStats(ctx, userID, tenantID)
}

// StudentStats 学生统计。
func (s *PositionService) StudentStats(ctx context.Context, tenantID *string) (int, int) {
	return s.st.Portal().StudentStats(ctx, tenantID)
}

// SchoolAdminStats 管理员统计。
func (s *PositionService) SchoolAdminStats(ctx context.Context, tenantID *string) (int, int) {
	return s.st.Portal().SchoolAdminStats(ctx, tenantID)
}

// SchoolAdminResourceStats 管理员资源统计。
func (s *PositionService) SchoolAdminResourceStats(ctx context.Context, tenantID *string) (int, int, int, int, int, int) {
	return s.st.Portal().SchoolAdminResourceStats(ctx, tenantID)
}

// SchoolAdminResourceGrowth 管理员资源增长趋势（最近 months 个月）。
func (s *PositionService) SchoolAdminResourceGrowth(ctx context.Context, tenantID *string, months int) []domain.WorkspaceResourceGrowth {
	return s.st.Portal().SchoolAdminResourceGrowth(ctx, tenantID, months)
}

// PersonnelStats 人员统计。
func (s *PositionService) PersonnelStats(ctx context.Context, tenantID *string) ([]store.PersonnelStatRow, error) {
	return s.st.Portal().PersonnelStats(ctx, tenantID)
}

// SchoolAdminTodos 管理员待办。
func (s *PositionService) SchoolAdminTodos(ctx context.Context, tenantID *string) ([]store.SchoolAdminTodoRow, error) {
	return s.st.Portal().SchoolAdminTodos(ctx, tenantID)
}

// ListStudentCourses 学生课程。
func (s *PositionService) ListStudentCourses(ctx context.Context, tenantID *string) ([]store.StudentCourseRow, error) {
	return s.st.Portal().ListStudentCourses(ctx, tenantID)
}

// ListSceneTasks 场景任务。
func (s *PositionService) ListSceneTasks(ctx context.Context, tenantID *string) ([]store.SceneTaskRow, error) {
	return s.st.Portal().ListSceneTasks(ctx, tenantID)
}

// ListStudentExams 学生考试。
func (s *PositionService) ListStudentExams(ctx context.Context, userID string, tenantID *string) ([]store.ExamRow, error) {
	return s.st.Portal().ListStudentExams(ctx, userID, tenantID)
}

// ListTeacherCourses 教师课程。
func (s *PositionService) ListTeacherCourses(ctx context.Context, userID string, tenantID *string) ([]store.TeacherCourseRow, error) {
	return s.st.Portal().ListTeacherCourses(ctx, userID, tenantID)
}

// ListClassPlans 班级计划。
func (s *PositionService) ListClassPlans(ctx context.Context, userID string, tenantID *string) ([]store.ClassPlanRow, error) {
	return s.st.Portal().ListClassPlans(ctx, userID, tenantID)
}

// CreditHoursRatio 学分学时比。
func (s *PositionService) CreditHoursRatio(ctx context.Context) float64 {
	return s.st.Portal().CreditHoursRatio(ctx)
}

// BatchCourseProgress 课程进度。
func (s *PositionService) BatchCourseProgress(ctx context.Context, courseIDs []string, userID string) map[string]int {
	return s.st.Portal().BatchCourseProgress(ctx, courseIDs, userID)
}

// BatchCourseStudentCounts 课程学生数。
func (s *PositionService) BatchCourseStudentCounts(ctx context.Context, courseIDs []string) map[string]int {
	return s.st.Portal().BatchCourseStudentCounts(ctx, courseIDs)
}

// BatchSceneTaskStatus 任务状态。
func (s *PositionService) BatchSceneTaskStatus(ctx context.Context, taskIDs []string, userID string) map[string]string {
	return s.st.Portal().BatchSceneTaskStatus(ctx, taskIDs, userID)
}

// PeriodLabelMap 节次标签。
func (s *PositionService) PeriodLabelMap(ctx context.Context, tenantID *string) map[string]string {
	return s.st.Portal().PeriodLabelMap(ctx, tenantID)
}

// ListTrainingPrograms 查询人培方案列表。
func (s *PositionService) ListTrainingPrograms(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.TrainingProgram]) ([]domain.TrainingProgram, int, error) {
	return s.st.TrainingPrograms().List(ctx, p, cfg)
}

// GetTrainingProgram 查询人培方案。
func (s *PositionService) GetTrainingProgram(ctx context.Context, id, tenantID string) (*domain.TrainingProgram, error) {
	return s.st.TrainingPrograms().Get(ctx, id, tenantID)
}

// CreateTrainingProgram 创建人培方案。
func (s *PositionService) CreateTrainingProgram(ctx context.Context, tenantID string, p *store.TrainingProgramParams) (*domain.TrainingProgram, error) {
	return s.st.TrainingPrograms().Create(ctx, tenantID, p)
}

// UpdateTrainingProgram 更新人培方案。
func (s *PositionService) UpdateTrainingProgram(ctx context.Context, id, tenantID string, p *store.TrainingProgramParams) (*domain.TrainingProgram, error) {
	return s.st.TrainingPrograms().Update(ctx, id, tenantID, p)
}

// DeleteTrainingProgram 删除人培方案。
func (s *PositionService) DeleteTrainingProgram(ctx context.Context, id, tenantID string) error {
	return s.st.TrainingPrograms().Delete(ctx, id, tenantID)
}

// UpdateTrainingProgramStatus 更新状态。
func (s *PositionService) UpdateTrainingProgramStatus(ctx context.Context, id, tenantID, status string) (*domain.TrainingProgram, error) {
	return s.st.TrainingPrograms().UpdateStatus(ctx, id, tenantID, status)
}

// ListTrainingProgramCourses 查询方案课程。
func (s *PositionService) ListTrainingProgramCourses(ctx context.Context, programID string) ([]domain.TrainingProgramCourse, error) {
	return s.st.TrainingPrograms().ListCourses(ctx, programID)
}

// PutTrainingProgramCourses 保存课程设置（事务）。
func (s *PositionService) PutTrainingProgramCourses(ctx context.Context, programID string, courses []store.ProgramCourseItem) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.TrainingPrograms().PutCourses(ctx, txStore.Q(), programID, courses)
	})
}

// TrainingProgramQueryer 暴露查询器（actions 用）。
func (s *PositionService) TrainingProgramQueryer() store.Queryer {
	return s.st.Q()
}

// GetTrainingProgramByID 按 ID 查询（contentActions 用）。
func (s *PositionService) GetTrainingProgramByID(ctx context.Context, id string) (*domain.TrainingProgram, error) {
	return s.st.TrainingPrograms().GetByID(ctx, id)
}

// CloneTrainingProgram 克隆人培方案（事务）。
func (s *PositionService) CloneTrainingProgram(ctx context.Context, tenantID, userID string, src *domain.TrainingProgram, newName string) (string, error) {
	var newID string
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		id, err := txStore.TrainingPrograms().CloneProgram(ctx, txStore.Q(), tenantID, userID, src, newName)
		if err != nil {
			return err
		}
		newID = id
		return nil
	})
	return newID, err
}

// TrainingProgramStoreRef 返回 store（contentActions pool 用）。
func (s *PositionService) TrainingProgramStoreRef() *store.Store {
	return s.st
}

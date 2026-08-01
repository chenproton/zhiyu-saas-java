package service

import (
	"context"

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
func (s *PositionService) BatchCreate(ctx context.Context, table string, cols []string, vals []any) error {
	return s.st.Batches().Create(ctx, table, cols, vals)
}

// BatchUpdate 更新批次。
func (s *PositionService) BatchUpdate(ctx context.Context, table string, setClauses []string, args []any) error {
	return s.st.Batches().Update(ctx, table, setClauses, args)
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

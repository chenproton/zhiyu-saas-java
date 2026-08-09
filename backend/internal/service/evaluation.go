package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// EvaluationService 评测域业务编排（题库/题目/试卷等）。
type EvaluationService struct {
	*Service
	st *store.Store
}

// NewEvaluationService 创建评测服务。
func NewEvaluationService(s *Service) *EvaluationService {
	return &EvaluationService{Service: s, st: s.Store()}
}

// ListQuestionBanks 查询题库列表。
func (s *EvaluationService) ListQuestionBanks(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.QuestionBank]) ([]domain.QuestionBank, int, error) {
	return s.st.QuestionBanks().List(ctx, p, cfg)
}

// GetQuestionBank 查询单个题库。
func (s *EvaluationService) GetQuestionBank(ctx context.Context, id string) (*domain.QuestionBank, error) {
	return s.st.QuestionBanks().Get(ctx, id)
}

// GetQuestionBankInTenant 查询单个题库（租户限定）。
func (s *EvaluationService) GetQuestionBankInTenant(ctx context.Context, id, tenantID string) (*domain.QuestionBank, error) {
	return s.st.QuestionBanks().GetScoped(ctx, id, tenantID)
}

// CreateQuestionBank 创建题库。
func (s *EvaluationService) CreateQuestionBank(ctx context.Context, tenantID string, p *store.QuestionBankCreateParams) (*domain.QuestionBank, error) {
	return s.st.QuestionBanks().Create(ctx, tenantID, p)
}

// UpdateQuestionBank 更新题库（限定租户）。
func (s *EvaluationService) UpdateQuestionBank(ctx context.Context, id, tenantID string, p *store.QuestionBankUpdateParams) (*domain.QuestionBank, error) {
	return s.st.QuestionBanks().Update(ctx, id, tenantID, p)
}

// DeleteQuestionBank 删除题库（限定租户）。
func (s *EvaluationService) DeleteQuestionBank(ctx context.Context, id, tenantID string) error {
	return s.st.QuestionBanks().Delete(ctx, id, tenantID)
}

// EnsureDraftPool 确保用户草稿池存在。
func (s *EvaluationService) EnsureDraftPool(ctx context.Context, tenantID, userID string) error {
	return s.st.QuestionBanks().EnsureDraftPool(ctx, tenantID, userID)
}

// IsDraftPool 查询是否草稿池。
func (s *EvaluationService) IsDraftPool(ctx context.Context, id string) (bool, error) {
	return s.st.QuestionBanks().IsDraftPool(ctx, id)
}

// PositionTenantID 查询岗位租户（证书体系租户归属校验用）。
func (s *EvaluationService) PositionTenantID(ctx context.Context, positionID string) (string, error) {
	return s.st.Positions().TenantID(ctx, positionID)
}

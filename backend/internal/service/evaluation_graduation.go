package service

import (
	"context"
	"errors"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListGraduationTopics 查询课题列表。
func (s *EvaluationService) ListGraduationTopics(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.GraduationProjectTopic]) ([]domain.GraduationProjectTopic, int, error) {
	return s.st.Graduations().ListTopics(ctx, p, cfg)
}

// GetGraduationTopic 查询单个课题。
func (s *EvaluationService) GetGraduationTopic(ctx context.Context, id string) (*domain.GraduationProjectTopic, error) {
	return s.st.Graduations().GetTopic(ctx, id)
}

// ErrInvalidEnterpriseMentor 毕业设计企业导师非法（非本校已启用 mentor_links 的影子账号）。
var ErrInvalidEnterpriseMentor = errors.New("invalid enterprise mentor")

// validateEnterpriseMentor 校验企业导师 ∈ 本校已启用 mentor_links 的影子账号（B14，修复悬空引用）。
func (s *EvaluationService) validateEnterpriseMentor(ctx context.Context, tenantID string, mentorID *string) error {
	if mentorID == nil || *mentorID == "" {
		return nil
	}
	ok, err := s.st.AllianceExpertMentorLinks().IsEnabledMentorUser(ctx, tenantID, *mentorID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidEnterpriseMentor
	}
	return nil
}

// CreateGraduationTopic 创建课题。
func (s *EvaluationService) CreateGraduationTopic(ctx context.Context, p *store.GraduationTopicParams) (*domain.GraduationProjectTopic, error) {
	if err := s.validateEnterpriseMentor(ctx, p.TenantID, p.EnterpriseMentorID); err != nil {
		return nil, err
	}
	return s.st.Graduations().CreateTopic(ctx, p)
}

// UpdateGraduationTopic 更新课题。
func (s *EvaluationService) UpdateGraduationTopic(ctx context.Context, id, tenantID string, p *store.GraduationTopicParams) (*domain.GraduationProjectTopic, error) {
	if err := s.validateEnterpriseMentor(ctx, tenantID, p.EnterpriseMentorID); err != nil {
		return nil, err
	}
	return s.st.Graduations().UpdateTopic(ctx, id, p)
}

// DeleteGraduationTopic 删除课题（事务）。
func (s *EvaluationService) DeleteGraduationTopic(ctx context.Context, id string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Graduations().DeleteTopic(ctx, txStore.Q(), id)
	})
}

// ApplyGraduationTopic 申请课题。
func (s *EvaluationService) ApplyGraduationTopic(ctx context.Context, tenantID, topicID, userID, phase string) (bool, bool, error) {
	return s.st.Graduations().ApplyTopic(ctx, tenantID, topicID, userID, phase)
}

// ListGraduationEvaluations 查询评价列表。
func (s *EvaluationService) ListGraduationEvaluations(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.GraduationProjectEvaluation]) ([]domain.GraduationProjectEvaluation, int, error) {
	return s.st.Graduations().ListEvaluations(ctx, p, cfg)
}

// CreateGraduationEvaluation 创建评价。
func (s *EvaluationService) CreateGraduationEvaluation(ctx context.Context, p *store.GraduationEvaluationParams) (*domain.GraduationProjectEvaluation, error) {
	return s.st.Graduations().CreateEvaluation(ctx, p)
}

// QueryGraduationResults 查询毕业结果。
func (s *EvaluationService) QueryGraduationResults(ctx context.Context, tenantID string, limit, offset int) ([]domain.GraduationQueryResult, int, error) {
	return s.st.Graduations().QueryGraduationResults(ctx, tenantID, limit, offset)
}

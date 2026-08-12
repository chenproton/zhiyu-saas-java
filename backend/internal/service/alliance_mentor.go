package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// AllianceMentorService 校企互动：共建导师选择器数据源（本校已引入企业的专家 + 绑定账号）。
type AllianceMentorService struct {
	*Service
	st *store.Store
}

// NewAllianceMentorService 创建共建导师服务。
func NewAllianceMentorService(s *Service) *AllianceMentorService {
	return &AllianceMentorService{Service: s, st: s.Store()}
}

// ListMentorOptions 共建导师选择器数据源（本校已引入企业的全部专家 + 绑定账号）。
func (s *AllianceMentorService) ListMentorOptions(ctx context.Context, tenantID string) ([]domain.AllianceMentorOption, error) {
	return s.st.Alliance().ListMentorOptionsBySchoolTenant(ctx, tenantID)
}

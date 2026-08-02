package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListLandingExams 查询落地考试。
func (s *PositionService) ListLandingExams(ctx context.Context, tenantID string) ([]store.LandingExam, error) {
	return s.st.Landing().ListExams(ctx, tenantID)
}

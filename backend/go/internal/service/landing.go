package service

import (
	"context"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// ListTargetPositions 查询学生目标岗位（来源：人培方案排给班级的岗位）。
func (s *PositionService) ListTargetPositions(ctx context.Context, tenantID, userID string) ([]domain.CareerPosition, error) {
	return s.st.Landing().ListTargetPositions(ctx, tenantID, userID)
}

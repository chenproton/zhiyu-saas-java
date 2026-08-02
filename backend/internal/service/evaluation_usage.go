package service

import (
	"context"
)

// PositionTenantID 查询岗位租户。
func (s *EvaluationService) PositionTenantID(ctx context.Context, positionID string) (string, error) {
	return s.st.CertGrades().PositionTenantID(ctx, positionID)
}

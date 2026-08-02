package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListCertGrades 查询岗位认证等级聚合数据。
func (s *EvaluationService) ListCertGrades(ctx context.Context, positionID string) ([]store.CertGradeRow, []store.CompRequirement, []store.LeaderboardEntry, error) {
	grades, err := s.st.CertGrades().ListGrades(ctx, positionID)
	if err != nil {
		return nil, nil, nil, err
	}
	gradeIDs := make([]string, 0, len(grades))
	for _, g := range grades {
		gradeIDs = append(gradeIDs, g.ID)
	}
	if len(gradeIDs) == 0 {
		return grades, nil, nil, nil
	}
	comps, err := s.st.CertGrades().ListCompRequirements(ctx, gradeIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	lb, err := s.st.CertGrades().ListLeaderboard(ctx, gradeIDs)
	if err != nil {
		return nil, nil, nil, err
	}
	return grades, comps, lb, nil
}

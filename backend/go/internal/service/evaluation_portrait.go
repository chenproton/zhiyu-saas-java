package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListStudentPortraits 查询学生画像列表。
func (s *EvaluationService) ListStudentPortraits(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.StudentAbilityPortrait]) ([]domain.StudentAbilityPortrait, int, error) {
	return s.st.StudentPortraits().ListPortraits(ctx, p, cfg)
}

// GetStudentPortrait 查询单个画像。
func (s *EvaluationService) GetStudentPortrait(ctx context.Context, id, tenantID string) (*domain.StudentAbilityPortrait, error) {
	return s.st.StudentPortraits().GetPortrait(ctx, id, tenantID)
}

// GetStudentPortraitByUserPosition 查询用户岗位画像。
func (s *EvaluationService) GetStudentPortraitByUserPosition(ctx context.Context, userID, careerPositionID string) (*domain.StudentAbilityPortrait, error) {
	return s.st.StudentPortraits().GetPortraitByUserPosition(ctx, userID, careerPositionID)
}

// ListStudentArchives 查询学生档案列表。
func (s *EvaluationService) ListStudentArchives(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.StudentAbilityArchive]) ([]domain.StudentAbilityArchive, int, error) {
	return s.st.StudentPortraits().ListArchives(ctx, p, cfg)
}

// CreateStudentArchive 创建学生档案。
func (s *EvaluationService) CreateStudentArchive(ctx context.Context, p *store.StudentArchiveCreateParams) (*domain.StudentAbilityArchive, error) {
	return s.st.StudentPortraits().CreateArchive(ctx, p)
}

// DeleteStudentArchive 删除学生档案。
func (s *EvaluationService) DeleteStudentArchive(ctx context.Context, id, tenantID string) (bool, error) {
	return s.st.StudentPortraits().DeleteArchive(ctx, id, tenantID)
}

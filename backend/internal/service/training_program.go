package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

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

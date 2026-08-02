package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListExams 查询试卷列表（批量填充题目）。
func (s *EvaluationService) ListExams(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Exam]) ([]domain.Exam, int, error) {
	items, total, err := s.st.Exams().List(ctx, p, cfg)
	if err != nil {
		return nil, 0, err
	}
	if len(items) > 0 {
		examIDs := make([]string, len(items))
		for i := range items {
			examIDs[i] = items[i].ID
			items[i].Questions = []domain.ExamQuestion{}
		}
		qMap, qErr := s.st.Exams().BatchFetchExamQuestions(ctx, examIDs)
		if qErr == nil {
			for i := range items {
				items[i].Questions = qMap[items[i].ID]
			}
		}
	}
	return items, total, nil
}

// GetExam 查询单个试卷（含题目）。
func (s *EvaluationService) GetExam(ctx context.Context, id string) (*domain.Exam, error) {
	return s.st.Exams().Get(ctx, id)
}

// ExamTenantID 查询试卷租户。
func (s *EvaluationService) ExamTenantID(ctx context.Context, id string) (string, error) {
	return s.st.Exams().TenantID(ctx, id)
}

// CreateExam 创建试卷。
func (s *EvaluationService) CreateExam(ctx context.Context, tenantID string, p *store.ExamCreateParams) (*domain.Exam, error) {
	return s.st.Exams().Create(ctx, tenantID, p)
}

// UpdateExam 更新试卷。
func (s *EvaluationService) UpdateExam(ctx context.Context, id string, p *store.ExamUpdateParams) (*domain.Exam, error) {
	return s.st.Exams().Update(ctx, id, p)
}

// DeleteExam 删除试卷。
func (s *EvaluationService) DeleteExam(ctx context.Context, id string) error {
	return s.st.Exams().Delete(ctx, id)
}

// BulkUpdateExamScores 批量更新分数（事务内）。
func (s *EvaluationService) BulkUpdateExamScores(ctx context.Context, examID string, scores map[string]float64) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Exams().BulkUpdateScores(ctx, txStore.Q(), examID, scores)
	})
}

// ListExamUsages 查询考试安排列表。
func (s *EvaluationService) ListExamUsages(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ExamUsage]) ([]domain.ExamUsage, int, error) {
	return s.st.ExamUsages().List(ctx, p, cfg)
}

// GetExamUsage 查询单个考试安排。
func (s *EvaluationService) GetExamUsage(ctx context.Context, id string) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Get(ctx, id)
}

// CreateExamUsage 创建考试安排。
func (s *EvaluationService) CreateExamUsage(ctx context.Context, p *store.ExamUsageCreateParams) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Create(ctx, p)
}

// UpdateExamUsage 更新考试安排。
func (s *EvaluationService) UpdateExamUsage(ctx context.Context, id string, p *store.ExamUsageCreateParams) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Update(ctx, id, p)
}

// DeleteExamUsage 删除考试安排。
func (s *EvaluationService) DeleteExamUsage(ctx context.Context, id string) error {
	return s.st.ExamUsages().Delete(ctx, id)
}

// SetExamUsageStatus 更新考试安排状态。
func (s *EvaluationService) SetExamUsageStatus(ctx context.Context, id, status string) error {
	return s.st.ExamUsages().SetStatus(ctx, id, status)
}

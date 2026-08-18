package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListExams 查询试卷列表（含题目数聚合，不填充全量题目——大列表下避免一次返回数千题目对象）。
func (s *EvaluationService) ListExams(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Exam]) ([]domain.Exam, int, error) {
	items, total, err := s.st.Exams().List(ctx, p, cfg)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetExam 查询单个试卷（含题目）。
func (s *EvaluationService) GetExam(ctx context.Context, tenantID, id string) (*domain.Exam, error) {
	return s.st.Exams().Get(ctx, tenantID, id)
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
func (s *EvaluationService) UpdateExam(ctx context.Context, tenantID, id string, p *store.ExamUpdateParams) (*domain.Exam, error) {
	return s.st.Exams().Update(ctx, tenantID, id, p)
}

// DeleteExam 删除试卷（题目与试卷同一事务）。
func (s *EvaluationService) DeleteExam(ctx context.Context, tenantID, id string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Exams().Delete(ctx, txStore.Q(), tenantID, id)
	})
}

// BulkUpdateExamScores 批量更新分数（事务内）。
func (s *EvaluationService) BulkUpdateExamScores(ctx context.Context, tenantID, examID string, scores map[string]float64) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		return txStore.Exams().BulkUpdateScores(ctx, txStore.Q(), tenantID, examID, scores)
	})
}

// ListExamUsages 查询考试安排列表。
func (s *EvaluationService) ListExamUsages(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.ExamUsage]) ([]domain.ExamUsage, int, error) {
	return s.st.ExamUsages().List(ctx, p, cfg)
}

// GetExamUsage 查询单个考试安排。
func (s *EvaluationService) GetExamUsage(ctx context.Context, tenantID, id string) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Get(ctx, tenantID, id)
}

// CreateExamUsage 创建考试安排。
func (s *EvaluationService) CreateExamUsage(ctx context.Context, p *store.ExamUsageCreateParams) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Create(ctx, p)
}

// UpdateExamUsage 更新考试安排。
func (s *EvaluationService) UpdateExamUsage(ctx context.Context, tenantID, id string, p *store.ExamUsageCreateParams) (*domain.ExamUsage, error) {
	return s.st.ExamUsages().Update(ctx, tenantID, id, p)
}

// DeleteExamUsage 删除考试安排。
func (s *EvaluationService) DeleteExamUsage(ctx context.Context, tenantID, id string) error {
	return s.st.ExamUsages().Delete(ctx, tenantID, id)
}

// SetExamUsageStatus 更新考试安排状态。
func (s *EvaluationService) SetExamUsageStatus(ctx context.Context, tenantID, id, status string) error {
	return s.st.ExamUsages().SetStatus(ctx, tenantID, id, status)
}

// ListExamCenter 考试中心列表。isStudent 为 true 时班级类考试按本人班级过滤可参加标记。
func (s *EvaluationService) ListExamCenter(ctx context.Context, tenantID, userID string, isStudent bool) ([]domain.ExamCenterItem, error) {
	classNodeID := ""
	if isStudent {
		classNodeID = s.st.Portal().UserClassNodeID(ctx, userID, &tenantID)
	}
	rows, err := s.st.ExamUsages().ListExamCenter(ctx, tenantID, userID, classNodeID)
	if err != nil {
		return nil, err
	}
	items := make([]domain.ExamCenterItem, 0, len(rows))
	for _, r := range rows {
		item := domain.ExamCenterItem{
			ID:            r.ID,
			ExamID:        r.ExamID,
			UsageName:     r.UsageName,
			ExamName:      r.ExamName,
			Description:   r.Description,
			StartTime:     r.StartTime,
			EndTime:       r.EndTime,
			Duration:      r.Duration,
			Status:        r.Status,
			QuestionCount: r.QuestionCount,
			TotalScore:    r.TotalScore,
			Submitted:     r.Submitted,
			Score:         r.Score,
			StudentView:   isStudent,
			ExamVersion:   r.ExamVersion,
		}
		item.Participatable = isStudent && r.ClassMatch
		items = append(items, item)
	}
	return items, nil
}

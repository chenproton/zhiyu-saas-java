package service

import (
	"context"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ListQuestions 查询题目列表。
func (s *EvaluationService) ListQuestions(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.Question]) ([]domain.Question, int, error) {
	return s.st.Questions().List(ctx, p, cfg)
}

// GetQuestion 查询单个题目（限定租户）。
func (s *EvaluationService) GetQuestion(ctx context.Context, id, tenantID string) (*domain.Question, error) {
	return s.st.Questions().Get(ctx, id, tenantID)
}

// CreateQuestion 创建题目。
func (s *EvaluationService) CreateQuestion(ctx context.Context, tenantID string, p *store.QuestionCreateParams) (*domain.Question, error) {
	return s.st.Questions().Create(ctx, tenantID, p)
}

// UpdateQuestion 更新题目（限定租户）。
func (s *EvaluationService) UpdateQuestion(ctx context.Context, id, tenantID string, p *store.QuestionUpdateParams) (*domain.Question, error) {
	return s.st.Questions().Update(ctx, id, tenantID, p)
}

// DeleteQuestion 删除题目（限定租户）。
func (s *EvaluationService) DeleteQuestion(ctx context.Context, id, tenantID string) error {
	return s.st.Questions().Delete(ctx, id, tenantID)
}

// BatchCreateQuestions 批量创建题目（事务内）。
func (s *EvaluationService) BatchCreateQuestions(ctx context.Context, tenantID, bankID, creatorID string, items []store.QuestionCreateParams) (int, error) {
	var count int
	err := s.WithTx(ctx, func(txStore *store.Store) error {
		c, err := txStore.Questions().BatchCreate(ctx, txStore.Q(), tenantID, bankID, creatorID, items)
		if err != nil {
			return err
		}
		count = c
		return nil
	})
	return count, err
}

// FetchExamQuestion 查询题目快照（限定租户）。
func (s *EvaluationService) FetchExamQuestion(ctx context.Context, tenantID, questionID string) (*store.QuestionSnapshot, error) {
	return s.st.Exams().FetchQuestion(ctx, tenantID, questionID)
}

// AddExamQuestion 添加题目到试卷（事务内：添加 + 重算总分）。
func (s *EvaluationService) AddExamQuestion(ctx context.Context, tenantID, examID string, q *store.QuestionSnapshot, score float64) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.Exams().AddQuestion(ctx, tenantID, examID, q, score); err != nil {
			return err
		}
		return txStore.Exams().RecalcExamTotal(ctx, examID)
	})
}

// RemoveExamQuestion 移除试卷题目（事务内：移除 + 重算总分）。
func (s *EvaluationService) RemoveExamQuestion(ctx context.Context, examID, questionID string) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		if err := txStore.Exams().RemoveQuestion(ctx, examID, questionID); err != nil {
			return err
		}
		return txStore.Exams().RecalcExamTotal(ctx, examID)
	})
}

// UpdateExamQuestionScore 更新题目分数（事务内：更新 + 重算总分）。
func (s *EvaluationService) UpdateExamQuestionScore(ctx context.Context, examID, questionID string, score float64) error {
	return s.WithTx(ctx, func(txStore *store.Store) error {
		hit, err := txStore.Exams().UpdateQuestionScore(ctx, examID, questionID, score)
		if err != nil {
			return err
		}
		if !hit {
			return store.ErrNotFound
		}
		return txStore.Exams().RecalcExamTotal(ctx, examID)
	})
}

// ListRandomDrawQuestions 查询随机抽题列表。
func (s *EvaluationService) ListRandomDrawQuestions(ctx context.Context, p store.ListParams, cfg store.ListQueryConfig[domain.RandomDrawQuestion]) ([]domain.RandomDrawQuestion, int, error) {
	return s.st.RandomDrawQuestions().List(ctx, p, cfg)
}

// GetRandomDrawQuestion 查询单个随机抽题。
func (s *EvaluationService) GetRandomDrawQuestion(ctx context.Context, id, tenantID string) (*domain.RandomDrawQuestion, error) {
	return s.st.RandomDrawQuestions().Get(ctx, id, tenantID)
}

// CreateRandomDrawQuestion 创建随机抽题。
func (s *EvaluationService) CreateRandomDrawQuestion(ctx context.Context, tenantID string, p *store.RandomDrawQuestionParams) (*domain.RandomDrawQuestion, error) {
	return s.st.RandomDrawQuestions().Create(ctx, tenantID, p)
}

// UpdateRandomDrawQuestion 更新随机抽题。
func (s *EvaluationService) UpdateRandomDrawQuestion(ctx context.Context, id, tenantID string, p *store.RandomDrawQuestionParams) (*domain.RandomDrawQuestion, error) {
	return s.st.RandomDrawQuestions().Update(ctx, id, tenantID, p)
}

// DeleteRandomDrawQuestion 删除随机抽题。
func (s *EvaluationService) DeleteRandomDrawQuestion(ctx context.Context, id, tenantID string) error {
	return s.st.RandomDrawQuestions().Delete(ctx, id, tenantID)
}

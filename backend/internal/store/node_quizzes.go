package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// NodeQuizStore 节点测验持久化（quiz + questions 两级）。
type NodeQuizStore struct {
	q Queryer
}

// NewNodeQuizStore 创建测验 store。
func NewNodeQuizStore(q Queryer) *NodeQuizStore {
	return &NodeQuizStore{q: q}
}

// ListQuizzes 查询测验列表。
func (s *NodeQuizStore) ListQuizzes(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.NodeQuiz]) ([]domain.NodeQuiz, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanNodeQuizRows)
}

// GetQuiz 查询单个测验。
func (s *NodeQuizStore) GetQuiz(ctx context.Context, id string) (*domain.NodeQuiz, error) {
	q, err := s.fetchQuiz(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return q, nil
}

// CreateQuiz 创建测验。
func (s *NodeQuizStore) CreateQuiz(ctx context.Context, tenantID string, p *NodeQuizParams) (*domain.NodeQuiz, error) {
	id := uuid.NewString()
	if _, err := s.q.Exec(ctx, `
		INSERT INTO node_quizzes (id, tenant_id, node_id, title, type, time_limit)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, tenantID, p.NodeID, p.Title, p.Type, p.TimeLimit); err != nil {
		return nil, err
	}
	return s.fetchQuiz(ctx, id)
}

// UpdateQuiz 更新测验。
func (s *NodeQuizStore) UpdateQuiz(ctx context.Context, id string, p *NodeQuizUpdateParams) (*domain.NodeQuiz, error) {
	if _, err := s.fetchQuiz(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE node_quizzes SET title = $1, type = $2, time_limit = $3
		WHERE id = $4
	`, p.Title, p.Type, p.TimeLimit, id); err != nil {
		return nil, err
	}
	return s.fetchQuiz(ctx, id)
}

// DeleteQuiz 在事务内删除测验及其题目。
func (s *NodeQuizStore) DeleteQuiz(ctx context.Context, tx Queryer, id string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM node_quiz_questions WHERE quiz_id = $1`, id); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `DELETE FROM node_quizzes WHERE id = $1`, id)
	return err
}

// ListQuestions 查询测验题目。
func (s *NodeQuizStore) ListQuestions(ctx context.Context, quizID string) ([]domain.NodeQuizQuestion, int, error) {
	var total int
	if err := s.q.QueryRow(ctx, `SELECT COUNT(*) FROM node_quiz_questions WHERE quiz_id = $1`, quizID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.q.Query(ctx, `
		SELECT id, quiz_id, type, question, options, answer, score, sort_order
		FROM node_quiz_questions
		WHERE quiz_id = $1
		ORDER BY sort_order ASC
	`, quizID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanNodeQuizQuestionRows(rows)
	return items, total, err
}

// AddQuestion 添加题目。
func (s *NodeQuizStore) AddQuestion(ctx context.Context, tenantID, quizID string, p *NodeQuizQuestionParams) (*domain.NodeQuizQuestion, error) {
	id := uuid.NewString()
	if _, err := s.q.Exec(ctx, `
		INSERT INTO node_quiz_questions (id, tenant_id, quiz_id, type, question, options, answer, score, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, id, tenantID, quizID, p.Type, p.Question, p.Options, p.Answer, p.Score, p.SortOrder); err != nil {
		return nil, err
	}
	return s.fetchQuestion(ctx, id)
}

// UpdateQuestion 更新题目。
func (s *NodeQuizStore) UpdateQuestion(ctx context.Context, questionID string, p *NodeQuizQuestionParams) (*domain.NodeQuizQuestion, error) {
	if _, err := s.fetchQuestion(ctx, questionID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE node_quiz_questions SET type = $1, question = $2, options = $3, answer = $4,
			score = $5, sort_order = $6
		WHERE id = $7
	`, p.Type, p.Question, p.Options, p.Answer, p.Score, p.SortOrder, questionID); err != nil {
		return nil, err
	}
	return s.fetchQuestion(ctx, questionID)
}

// GetQuestion 查询单个题目（校验存在）。
func (s *NodeQuizStore) GetQuestion(ctx context.Context, questionID string) (*domain.NodeQuizQuestion, error) {
	q, err := s.fetchQuestion(ctx, questionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return q, nil
}

// DeleteQuestion 删除题目。
func (s *NodeQuizStore) DeleteQuestion(ctx context.Context, questionID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM node_quiz_questions WHERE id = $1`, questionID)
	return err
}

// NodeQuizParams 创建测验参数。
type NodeQuizParams struct {
	NodeID    string
	Title     string
	Type      string
	TimeLimit *int
}

// NodeQuizUpdateParams 更新测验参数。
type NodeQuizUpdateParams struct {
	Title     string
	Type      string
	TimeLimit *int
}

// NodeQuizQuestionParams 题目参数。
type NodeQuizQuestionParams struct {
	Type      string
	Question  string
	Options   domain.JSONMap
	Answer    *string
	Score     float64
	SortOrder int
}

func (s *NodeQuizStore) fetchQuiz(ctx context.Context, id string) (*domain.NodeQuiz, error) {
	var q domain.NodeQuiz
	err := s.q.QueryRow(ctx, `
		SELECT id, node_id, title, type, time_limit FROM node_quizzes WHERE id = $1
	`, id).Scan(&q.ID, &q.NodeID, &q.Title, &q.Type, &q.TimeLimit)
	if err != nil {
		return nil, err
	}
	return &q, nil
}

func (s *NodeQuizStore) fetchQuestion(ctx context.Context, id string) (*domain.NodeQuizQuestion, error) {
	var q domain.NodeQuizQuestion
	err := s.q.QueryRow(ctx, `
		SELECT id, quiz_id, type, question, options, answer, score, sort_order
		FROM node_quiz_questions WHERE id = $1
	`, id).Scan(&q.ID, &q.QuizID, &q.Type, &q.Question, &q.Options, &q.Answer, &q.Score, &q.SortOrder)
	if err != nil {
		return nil, err
	}
	return &q, nil
}

func scanNodeQuizRows(rows pgx.Rows) ([]domain.NodeQuiz, error) {
	items := make([]domain.NodeQuiz, 0)
	for rows.Next() {
		var q domain.NodeQuiz
		if err := rows.Scan(&q.ID, &q.NodeID, &q.Title, &q.Type, &q.TimeLimit); err != nil {
			return nil, err
		}
		items = append(items, q)
	}
	return items, nil
}

func scanNodeQuizQuestionRows(rows pgx.Rows) ([]domain.NodeQuizQuestion, error) {
	items := make([]domain.NodeQuizQuestion, 0)
	for rows.Next() {
		var q domain.NodeQuizQuestion
		if err := rows.Scan(&q.ID, &q.QuizID, &q.Type, &q.Question, &q.Options, &q.Answer, &q.Score, &q.SortOrder); err != nil {
			return nil, err
		}
		items = append(items, q)
	}
	return items, nil
}

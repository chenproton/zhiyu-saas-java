package store

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// QuestionStore 题目持久化。
type QuestionStore struct {
	q Queryer
}

// NewQuestionStore 创建题目 store。
func NewQuestionStore(q Queryer) *QuestionStore {
	return &QuestionStore{q: q}
}

// List 查询题目列表。
func (s *QuestionStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Question]) ([]domain.Question, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanQuestionRows)
}

// Get 查询单个题目（限定租户）。
func (s *QuestionStore) Get(ctx context.Context, id, tenantID string) (*domain.Question, error) {
	q, err := s.fetchQuestion(ctx, id, tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return q, nil
}

// Create 创建题目。
func (s *QuestionStore) Create(ctx context.Context, tenantID string, p *QuestionCreateParams) (*domain.Question, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
	`, id, tenantID, p.Code, p.BankID, p.Type, p.Content, p.OptionsJSON, p.AnswerJSON, p.Analysis, p.Score, p.Difficulty, p.KnowledgePoints, p.CreatorID, p.Source)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Update 更新题目（bank_id 可选更新，限定租户）。
func (s *QuestionStore) Update(ctx context.Context, id, tenantID string, p *QuestionUpdateParams) (*domain.Question, error) {
	if _, err := s.fetchQuestion(ctx, id, tenantID); err != nil {
		return nil, err
	}
	setClauses := []string{
		"type = $1",
		"content = $2",
		"options = $3",
		"answer = $4",
		"analysis = $5",
		"score = $6",
		"difficulty = $7",
		"knowledge_point_ids = $8",
		"source = $9",
	}
	args := []any{p.Type, p.Content, p.OptionsJSON, p.AnswerJSON, p.Analysis, p.Score, p.Difficulty, p.KnowledgePoints, p.Source}
	argIdx := 10
	if p.BankID != "" {
		setClauses = append(setClauses, "bank_id = $"+Itoa(argIdx))
		args = append(args, p.BankID)
		argIdx++
	}
	args = append(args, id, tenantID)
	_, err := s.q.Exec(ctx, `
		UPDATE questions SET `+joinSQL(setClauses, ", ")+`
		WHERE id = $`+Itoa(argIdx)+` AND tenant_id = $`+Itoa(argIdx+1)+`
	`, args...)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Delete 删除题目（限定租户）。
func (s *QuestionStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM questions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// BatchCreate 事务内批量创建题目，返回成功数。
func (s *QuestionStore) BatchCreate(ctx context.Context, tx Queryer, tenantID, bankID, creatorID string, items []QuestionCreateParams) (int, error) {
	count := 0
	for _, p := range items {
		if p.Type == "" || p.Content == "" {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
		`, uuid.NewString(), tenantID, GenerateEntityCode("TM"), bankID, p.Type, p.Content, p.OptionsJSON, p.AnswerJSON, p.Analysis, p.Score, p.Difficulty, p.KnowledgePoints, creatorID, p.Source); err != nil {
			return 0, err
		}
		count++
	}
	return count, nil
}

// QuestionCreateParams 创建题目参数。
type QuestionCreateParams struct {
	Code            string
	BankID          string
	Type            string
	Content         string
	OptionsJSON     string
	AnswerJSON      string
	Analysis        *string
	Score           float64
	Difficulty      *string
	KnowledgePoints []string
	CreatorID       string
	Source          *string
}

// QuestionUpdateParams 更新题目参数。
type QuestionUpdateParams struct {
	BankID          string
	Type            string
	Content         string
	OptionsJSON     string
	AnswerJSON      string
	Analysis        *string
	Score           float64
	Difficulty      *string
	KnowledgePoints []string
	Source          *string
}

func (s *QuestionStore) fetchQuestion(ctx context.Context, id, tenantID string) (*domain.Question, error) {
	var q domain.Question
	var analysis, difficulty, creatorID, source, answerStr, optionsStr *string
	err := s.q.QueryRow(ctx, `
		SELECT id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status, created_at
		FROM questions WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(
		&q.ID, &q.Code, &q.BankID, &q.Type, &q.Content, &optionsStr, &answerStr, &analysis,
		&q.Score, &difficulty, &q.KnowledgePoints, &creatorID, &source, &q.Status, &q.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if answerStr != nil {
		var ans domain.JSONSlice
		if err := json.Unmarshal([]byte(*answerStr), &ans); err != nil {
			slog.Warn("解析题目答案失败", "error", err)
		}
		q.Answer = ans
	}
	if optionsStr != nil {
		var opts []string
		if err := json.Unmarshal([]byte(*optionsStr), &opts); err != nil {
			slog.Warn("解析题目选项失败", "error", err)
		}
		q.Options = opts
	}
	q.Analysis = analysis
	q.Difficulty = difficulty
	q.CreatorID = creatorID
	q.Source = source
	return &q, nil
}

// ListConfig 返回题目列表查询配置，SQL 片段沉淀在 store 层。
func (s *QuestionStore) ListConfig() ListQueryConfig[domain.Question] {
	return ListQueryConfig[domain.Question]{
		Table:         "questions",
		SelectColumns: "id, code, bank_id, type, content, options, answer, analysis, score, difficulty, knowledge_point_ids, creator_id, source, status, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"content"},
		ScanRows:      ScanQuestionRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if bankID := p.Values["bankId"]; bankID != "" {
				qb.AddCondition("bank_id = " + qb.NextArg(bankID))
			}
			if qType := p.Values["type"]; qType != "" {
				qb.AddCondition("type = " + qb.NextArg(qType))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
}

// ScanQuestionRows 扫描题目行。
func ScanQuestionRows(rows pgx.Rows) ([]domain.Question, error) {
	items := make([]domain.Question, 0)
	for rows.Next() {
		var q domain.Question
		var analysis, difficulty, creatorID, source, answerStr, optionsStr *string
		if err := rows.Scan(
			&q.ID, &q.Code, &q.BankID, &q.Type, &q.Content, &optionsStr, &answerStr, &analysis,
			&q.Score, &difficulty, &q.KnowledgePoints, &creatorID, &source, &q.Status, &q.CreatedAt,
		); err != nil {
			return nil, err
		}
		if answerStr != nil {
			var ans domain.JSONSlice
			if err := json.Unmarshal([]byte(*answerStr), &ans); err != nil {
				slog.Warn("解析题目答案失败", "error", err)
			}
			q.Answer = ans
		}
		if optionsStr != nil {
			var opts []string
			if err := json.Unmarshal([]byte(*optionsStr), &opts); err != nil {
				slog.Warn("解析题目选项失败", "error", err)
			}
			q.Options = opts
		}
		q.Analysis = analysis
		q.Difficulty = difficulty
		q.CreatorID = creatorID
		q.Source = source
		items = append(items, q)
	}
	return items, rows.Err()
}

package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ExamStore 试卷持久化。
type ExamStore struct {
	q Queryer
}

// NewExamStore 创建试卷 store。
func NewExamStore(q Queryer) *ExamStore {
	return &ExamStore{q: q}
}

// List 查询试卷列表。
func (s *ExamStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Exam]) ([]domain.Exam, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanExamRows)
}

// Get 查询单个试卷（含题目列表）。租户为强制参数：SQL 级限定
// tenant_id，杜绝"漏写归属校验即跨租户 IDOR"。
func (s *ExamStore) Get(ctx context.Context, tenantID, id string) (*domain.Exam, error) {
	e, err := s.fetchExam(ctx, tenantID, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return e, nil
}

// TenantID 查询试卷租户。
func (s *ExamStore) TenantID(ctx context.Context, id string) (string, error) {
	var tenantID string
	err := s.q.QueryRow(ctx, `SELECT tenant_id FROM exams WHERE id = $1`, id).Scan(&tenantID)
	return tenantID, err
}

// Create 创建试卷。
func (s *ExamStore) Create(ctx context.Context, tenantID string, p *ExamCreateParams) (*domain.Exam, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration, cover_image,
			collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id, is_temp)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, 'draft', 0, $5, $6, $7, $8, $9, 'V1.0', 'mine', $10, $11)
		RETURNING id
	`, tenantID, p.Code, p.Name, p.Description, p.Duration, p.CoverImage, p.CollaboratorIDs, p.CollaboratorDeptIDs, p.BatchID, p.CreatorID, p.IsTemp).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, tenantID, id)
}

// Update 更新试卷。
func (s *ExamStore) Update(ctx context.Context, tenantID, id string, p *ExamUpdateParams) (*domain.Exam, error) {
	if _, err := s.fetchExam(ctx, tenantID, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE exams SET name = $1, description = $2, duration = $3, cover_image = $4,
			collaborator_ids = $5, collaborator_dept_ids = $6, batch_id = $7, updated_at = NOW()
		WHERE id = $8 AND tenant_id = $9
	`, p.Name, p.Description, p.Duration, p.CoverImage, p.CollaboratorIDs, p.CollaboratorDeptIDs, p.BatchID, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, tenantID, id)
}

// Delete 删除试卷（题目与试卷在同一事务内，防止半删状态）。
func (s *ExamStore) Delete(ctx context.Context, q Queryer, tenantID, id string) error {
	if _, err := q.Exec(ctx, `DELETE FROM exam_questions WHERE exam_id = $1`, id); err != nil {
		return fmt.Errorf("delete exam questions: %w", err)
	}
	_, err := q.Exec(ctx, `DELETE FROM exams WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// QuestionSnapshot 题目快照（AddQuestion 用）。
type QuestionSnapshot struct {
	ID       string
	Type     domain.QuestionType
	Content  string
	Options  []byte
	Answer   []byte
	Analysis *string
	Score    float64
}

// FetchQuestion 查询题目快照（限定租户）。
func (s *ExamStore) FetchQuestion(ctx context.Context, tenantID, questionID string) (*QuestionSnapshot, error) {
	var q QuestionSnapshot
	var optionsStr, answerStr *string
	err := s.q.QueryRow(ctx, `
		SELECT id, type, content, options, answer, analysis, score FROM questions WHERE id = $1 AND tenant_id = $2
	`, questionID, tenantID).Scan(&q.ID, &q.Type, &q.Content, &optionsStr, &answerStr, &q.Analysis, &q.Score)
	if err != nil {
		return nil, err
	}
	if optionsStr != nil {
		q.Options = []byte(*optionsStr)
	} else {
		q.Options = []byte("[]")
	}
	if answerStr != nil {
		q.Answer = []byte(*answerStr)
	} else {
		q.Answer = []byte("[]")
	}
	return &q, nil
}

// AddQuestion 添加题目到试卷。
func (s *ExamStore) AddQuestion(ctx context.Context, tenantID, examID string, q *QuestionSnapshot, score float64) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM exam_questions WHERE exam_id = $3))
		ON CONFLICT (exam_id, question_id) DO UPDATE SET
			type = EXCLUDED.type, content = EXCLUDED.content, options = EXCLUDED.options,
			answer = EXCLUDED.answer, analysis = EXCLUDED.analysis, score = EXCLUDED.score
	`, uuid.NewString(), tenantID, examID, q.ID, q.Type, q.Content, string(q.Options), string(q.Answer), q.Analysis, score)
	return err
}

// RemoveQuestion 从试卷移除题目。
func (s *ExamStore) RemoveQuestion(ctx context.Context, examID, questionID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM exam_questions WHERE exam_id = $1 AND question_id = $2`, examID, questionID)
	return err
}

// UpdateQuestionScore 更新试卷题目分数，返回是否命中。
func (s *ExamStore) UpdateQuestionScore(ctx context.Context, examID, questionID string, score float64) (bool, error) {
	tag, err := s.q.Exec(ctx, `
		UPDATE exam_questions SET score = $1 WHERE exam_id = $2 AND question_id = $3
	`, score, examID, questionID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// BulkUpdateScores 事务内批量更新分数并重算总分。
func (s *ExamStore) BulkUpdateScores(ctx context.Context, tx Queryer, examID string, scores map[string]float64) error {
	for questionID, score := range scores {
		if score <= 0 {
			continue
		}
		if _, err := tx.Exec(ctx, `
			UPDATE exam_questions SET score = $1 WHERE exam_id = $2 AND question_id = $3
		`, score, examID, questionID); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `
		UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = $1), 0), updated_at = NOW()
		WHERE id = $1
	`, examID)
	return err
}

// RecalcExamTotal 重算试卷总分。
func (s *ExamStore) RecalcExamTotal(ctx context.Context, examID string) error {
	_, err := s.q.Exec(ctx, `
		UPDATE exams SET total_score = COALESCE((SELECT SUM(score) FROM exam_questions WHERE exam_id = $1), 0), updated_at = NOW()
		WHERE id = $1
	`, examID)
	return err
}

// ExamCreateParams 创建试卷参数。
type ExamCreateParams struct {
	Code                string
	Name                string
	Description         *string
	Duration            *int
	CoverImage          *string
	CollaboratorIDs     []string
	CollaboratorDeptIDs []string
	BatchID             *string
	CreatorID           string
	IsTemp              bool
}

// ExamUpdateParams 更新试卷参数。
type ExamUpdateParams struct {
	Name                string
	Description         *string
	Duration            *int
	CoverImage          *string
	CollaboratorIDs     []string
	CollaboratorDeptIDs []string
	BatchID             *string
}

func (s *ExamStore) fetchExam(ctx context.Context, tenantID, id string) (*domain.Exam, error) {
	var e domain.Exam
	var coverImage, description, creatorID, batchID, tenantID2 *string
	err := s.q.QueryRow(ctx, `
		SELECT e.id, e.code, e.name, e.description, e.status, e.total_score, e.duration, e.cover_image,
		e.is_temp,
			e.collaborator_ids,
			COALESCE((SELECT u.name FROM users u WHERE u.id = e.creator_id), e.creator_id::text) AS creator_name,
			COALESCE((
				SELECT array_agg(u.name ORDER BY ord)
				FROM unnest(e.collaborator_ids) WITH ORDINALITY AS c(id, ord)
				JOIN users u ON u.id = c.id
			), '{}') AS collaborator_names,
			e.collaborator_dept_ids, e.batch_id, COALESCE(e.version, 'V1.0') AS version, e.owner_type, e.creator_id, e.created_at, e.updated_at, e.tenant_id
		FROM exams e WHERE e.id = $1 AND e.tenant_id = $2
	`, id, tenantID).Scan(
		&e.ID, &e.Code, &e.Name, &description, &e.Status, &e.TotalScore, &e.Duration, &coverImage,
		&e.IsTemp, &e.CollaboratorIDs, &e.CreatorName, &e.CollaboratorNames, &e.CollaboratorDeptIDs, &batchID, &e.Version, &e.OwnerType, &creatorID, &e.CreatedAt, &e.UpdatedAt, &tenantID2,
	)
	if err != nil {
		return nil, err
	}
	if description != nil {
		e.Description = *description
	}
	e.CoverImage = coverImage
	e.CreatorID = creatorID
	e.BatchID = batchID
	e.TenantID = tenantID2
	questions, err := s.fetchExamQuestions(ctx, id)
	if err == nil {
		e.Questions = questions
	}
	return &e, nil
}

func (s *ExamStore) fetchExamQuestions(ctx context.Context, examID string) ([]domain.ExamQuestion, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order
		FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order
	`, examID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.ExamQuestion, 0)
	for rows.Next() {
		var eq domain.ExamQuestion
		var optionsStr, answerStr, analysis *string
		if err := rows.Scan(&eq.ID, &eq.ExamID, &eq.QuestionID, &eq.Type, &eq.Content, &optionsStr, &answerStr, &analysis, &eq.Score, &eq.Order); err != nil {
			return nil, err
		}
		if optionsStr != nil {
			if err := json.Unmarshal([]byte(*optionsStr), &eq.Options); err != nil {
				slog.Warn("解析题目选项失败", "error", err)
			}
		}
		if answerStr != nil {
			var ans domain.JSONSlice
			_ = json.Unmarshal([]byte(*answerStr), &ans)
			eq.Answer = ans
		}
		if eq.Answer == nil {
			eq.Answer = domain.JSONSlice{}
		}
		eq.Analysis = analysis
		items = append(items, eq)
	}
	return items, rows.Err()
}

// ScanExamRows 扫描试卷行（不含题目）。
func ScanExamRows(rows pgx.Rows) ([]domain.Exam, error) {
	items := make([]domain.Exam, 0)
	for rows.Next() {
		var e domain.Exam
		var coverImage, description, creatorID, batchID *string
		if err := rows.Scan(
			&e.ID, &e.Code, &e.Name, &description, &e.Status, &e.TotalScore, &e.Duration, &coverImage,
			&e.IsTemp, &e.CollaboratorIDs, &e.CreatorName, &e.CollaboratorNames, &e.CollaboratorDeptIDs, &batchID, &e.Version, &e.OwnerType, &creatorID, &e.CreatedAt, &e.UpdatedAt, &e.QuestionCount,
		); err != nil {
			return nil, err
		}
		if description != nil {
			e.Description = *description
		}
		e.CoverImage = coverImage
		e.CreatorID = creatorID
		e.BatchID = batchID
		items = append(items, e)
	}
	return items, rows.Err()
}

const examListFrom = "exams e"
const examListSelectColumns = "e.id, e.code, e.name, e.description, e.status, e.total_score, e.duration, e.cover_image, e.is_temp, e.collaborator_ids, COALESCE((SELECT u.name FROM users u WHERE u.id = e.creator_id), e.creator_id::text) AS creator_name, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(e.collaborator_ids) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, e.collaborator_dept_ids, e.batch_id, COALESCE(e.version, 'V1.0') AS version, e.owner_type, e.creator_id, e.created_at, e.updated_at, (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count"

// ListConfig 返回试卷列表查询配置，SQL 片段沉淀在 store 层。
func (s *ExamStore) ListConfig() ListQueryConfig[domain.Exam] {
	return ListQueryConfig[domain.Exam]{
		Table:         examListFrom,
		SelectColumns: examListSelectColumns,
		TenantScoped:  true,
		TenantColumn:  "e.tenant_id",
		SearchColumns: []string{"e.name", "e.description"},
		SearchParam:   "search",
		OrderBy:       "e.created_at DESC",
		DefaultLimit:  50,
		ScanRows:      ScanExamRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			qb.AddCondition("e.is_temp = FALSE")
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("e.status = " + qb.NextArg(status))
			}
		},
	}
}

// BatchFetchExamQuestions 批量查询试卷题目（按 exam_id 分组）。
func (s *ExamStore) BatchFetchExamQuestions(ctx context.Context, examIDs []string) (map[string][]domain.ExamQuestion, error) {
	out := make(map[string][]domain.ExamQuestion)
	if len(examIDs) == 0 {
		return out, nil
	}
	rows, err := s.q.Query(ctx, `
		SELECT exam_id, id, question_id, type, content, options, answer, analysis, score, sort_order
		FROM exam_questions WHERE exam_id = ANY($1) ORDER BY sort_order
	`, examIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var examID string
		var eq domain.ExamQuestion
		var optionsStr, answerStr, analysis *string
		if err := rows.Scan(&examID, &eq.ID, &eq.QuestionID, &eq.Type, &eq.Content, &optionsStr, &answerStr, &analysis, &eq.Score, &eq.Order); err != nil {
			return nil, err
		}
		if optionsStr != nil {
			if err := json.Unmarshal([]byte(*optionsStr), &eq.Options); err != nil {
				slog.Warn("解析题目选项失败", "error", err)
			}
		}
		if answerStr != nil {
			var ans domain.JSONSlice
			_ = json.Unmarshal([]byte(*answerStr), &ans)
			eq.Answer = ans
		}
		if eq.Answer == nil {
			eq.Answer = domain.JSONSlice{}
		}
		eq.Analysis = analysis
		out[examID] = append(out[examID], eq)
	}
	return out, rows.Err()
}

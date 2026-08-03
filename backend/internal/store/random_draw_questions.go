package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// RandomDrawQuestionStore 随机抽题持久化。
type RandomDrawQuestionStore struct {
	q Queryer
}

// NewRandomDrawQuestionStore 创建随机抽题 store。
func NewRandomDrawQuestionStore(q Queryer) *RandomDrawQuestionStore {
	return &RandomDrawQuestionStore{q: q}
}

// List 查询随机抽题列表。
func (s *RandomDrawQuestionStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.RandomDrawQuestion]) ([]domain.RandomDrawQuestion, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanRandomDrawQuestionRows)
}

// Get 查询单个随机抽题。
func (s *RandomDrawQuestionStore) Get(ctx context.Context, id, tenantID string) (*domain.RandomDrawQuestion, error) {
	q, err := s.fetchQuestion(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	return q, nil
}

// Create 创建随机抽题。
func (s *RandomDrawQuestionStore) Create(ctx context.Context, tenantID string, p *RandomDrawQuestionParams) (*domain.RandomDrawQuestion, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO random_draw_questions (id, tenant_id, name, description, answer, major_id)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
		RETURNING id
	`, tenantID, p.Name, p.Description, p.Answer, p.MajorID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Update 更新随机抽题。
func (s *RandomDrawQuestionStore) Update(ctx context.Context, id, tenantID string, p *RandomDrawQuestionParams) (*domain.RandomDrawQuestion, error) {
	if _, err := s.fetchQuestion(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE random_draw_questions SET name = $1, description = $2, answer = $3, major_id = $4, updated_at = NOW()
		WHERE id = $5 AND tenant_id = $6
	`, p.Name, p.Description, p.Answer, p.MajorID, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Delete 删除随机抽题。
func (s *RandomDrawQuestionStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM random_draw_questions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// RandomDrawQuestionParams 创建/更新参数。
type RandomDrawQuestionParams struct {
	Name        string
	Description *string
	Answer      *string
	MajorID     *string
}

func (s *RandomDrawQuestionStore) fetchQuestion(ctx context.Context, id, tenantID string) (*domain.RandomDrawQuestion, error) {
	var q domain.RandomDrawQuestion
	var description, answer, majorID, majorName *string
	err := s.q.QueryRow(ctx, `
		SELECT rdq.id, rdq.name, rdq.description, rdq.answer, rdq.major_id, m.name AS major_name, rdq.created_at, rdq.updated_at
		FROM random_draw_questions rdq
		LEFT JOIN majors m ON m.id = rdq.major_id
		WHERE rdq.id = $1 AND rdq.tenant_id = $2
	`, id, tenantID).Scan(
		&q.ID, &q.Name, &description, &answer, &majorID, &majorName, &q.CreatedAt, &q.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	q.Description = description
	q.Answer = answer
	q.MajorID = majorID
	q.MajorName = majorName
	return &q, nil
}

// ListConfig 返回随机抽题列表查询配置，SQL 片段沉淀在 store 层。
func (s *RandomDrawQuestionStore) ListConfig() ListQueryConfig[domain.RandomDrawQuestion] {
	return ListQueryConfig[domain.RandomDrawQuestion]{
		Table:         "random_draw_questions rdq LEFT JOIN majors m ON m.id = rdq.major_id",
		SelectColumns: "rdq.id, rdq.name, rdq.description, rdq.answer, rdq.major_id, m.name AS major_name, rdq.created_at, rdq.updated_at",
		TenantScoped:  true,
		TenantColumn:  "rdq.tenant_id",
		SearchColumns: []string{"rdq.name", "rdq.description", "m.name"},
		DefaultLimit:  200,
		ScanRows:      ScanRandomDrawQuestionRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if majorID := p.Values["majorId"]; majorID != "" {
				qb.AddCondition("rdq.major_id = " + qb.NextArg(majorID))
			}
		},
	}
}

// ScanRandomDrawQuestionRows 扫描随机抽题行。
func ScanRandomDrawQuestionRows(rows pgx.Rows) ([]domain.RandomDrawQuestion, error) {
	items := make([]domain.RandomDrawQuestion, 0)
	for rows.Next() {
		var q domain.RandomDrawQuestion
		var description, answer, majorID, majorName *string
		if err := rows.Scan(
			&q.ID, &q.Name, &description, &answer, &majorID, &majorName, &q.CreatedAt, &q.UpdatedAt,
		); err != nil {
			return nil, err
		}
		q.Description = description
		q.Answer = answer
		q.MajorID = majorID
		q.MajorName = majorName
		items = append(items, q)
	}
	return items, rows.Err()
}

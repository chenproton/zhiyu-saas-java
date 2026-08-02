package store

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// TermStore 学期持久化。
type TermStore struct {
	q Queryer
}

// NewTermStore 创建学期 store。
func NewTermStore(q Queryer) *TermStore {
	return &TermStore{q: q}
}

// List 查询学期列表。
func (s *TermStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.Term]) ([]domain.Term, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanTermRows)
}

// Get 查询单个学期。
func (s *TermStore) Get(ctx context.Context, id, tenantID string) (*domain.Term, error) {
	var term domain.Term
	err := s.q.QueryRow(ctx, `
		SELECT id, name, to_char(start_date, 'YYYY-MM-DD'), to_char(end_date, 'YYYY-MM-DD'), weeks_count, is_current, created_at
		FROM terms WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&term.ID, &term.Name, &term.StartDate, &term.EndDate, &term.WeeksCount, &term.IsCurrent, &term.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &term, nil
}

// Create 创建学期（事务：置当前时清空其他）。
func (s *TermStore) Create(ctx context.Context, tx Queryer, tenantID string, p *TermParams) (string, error) {
	if p.IsCurrent {
		if _, err := tx.Exec(ctx, `UPDATE terms SET is_current = false WHERE tenant_id = $1`, tenantID); err != nil {
			return "", err
		}
	}
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO terms (id, tenant_id, name, start_date, end_date, weeks_count, is_current)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
		RETURNING id
	`, tenantID, p.Name, p.StartDate, p.EndDate, p.WeeksCount, p.IsCurrent).Scan(&id)
	return id, err
}

// Update 更新学期（事务：置当前时清空其他）。
func (s *TermStore) Update(ctx context.Context, tx Queryer, tenantID, id string, p *TermParams) error {
	if p.IsCurrent {
		if _, err := tx.Exec(ctx, `UPDATE terms SET is_current = false WHERE tenant_id = $1 AND id <> $2`, tenantID, id); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `
		UPDATE terms SET name = $1, start_date = $2, end_date = $3, weeks_count = $4, is_current = $5
		WHERE id = $6 AND tenant_id = $7
	`, p.Name, p.StartDate, p.EndDate, p.WeeksCount, p.IsCurrent, id, tenantID)
	return err
}

// Delete 删除学期。
func (s *TermStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM terms WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// TermParams 学期参数。
type TermParams struct {
	Name       string
	StartDate  string
	EndDate    string
	WeeksCount int
	IsCurrent  bool
}

// ListConfig 返回学期列表查询配置，SQL 片段沉淀在 store 层。
func (s *TermStore) ListConfig() ListQueryConfig[domain.Term] {
	return ListQueryConfig[domain.Term]{
		Table:         "terms",
		SelectColumns: "id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, weeks_count, is_current, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "start_date DESC",
		ScanRows:      ScanTermRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if isCurrent := p.Values["isCurrent"]; isCurrent == "true" {
				qb.AddCondition("is_current = true")
			}
		},
	}
}

// ScanTermRows 扫描学期行。
func ScanTermRows(rows pgx.Rows) ([]domain.Term, error) {
	items := make([]domain.Term, 0)
	for rows.Next() {
		var term domain.Term
		if err := rows.Scan(&term.ID, &term.Name, &term.StartDate, &term.EndDate, &term.WeeksCount, &term.IsCurrent, &term.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, term)
	}
	return items, nil
}

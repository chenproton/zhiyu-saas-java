package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// AppealStore 申诉持久化。
type AppealStore struct {
	q Queryer
}

// NewAppealStore 创建申诉 store。
func NewAppealStore(q Queryer) *AppealStore {
	return &AppealStore{q: q}
}

// List 查询申诉列表。
func (s *AppealStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.AppealRecord]) ([]domain.AppealRecord, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanAppealRows)
}

// ListConfig 返回申诉列表查询配置，SQL 片段沉淀在 store 层。
func (s *AppealStore) ListConfig() ListQueryConfig[domain.AppealRecord] {
	return ListQueryConfig[domain.AppealRecord]{
		Table:         "appeal_records",
		SelectColumns: "id, user_id, type, reason, status, created_at",
		TenantScoped:  true,
		ScanRows:      ScanAppealRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if appealType := p.Values["type"]; appealType != "" {
				qb.AddCondition("type = " + qb.NextArg(appealType))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
}

// Get 查询单个申诉。
func (s *AppealStore) Get(ctx context.Context, id string) (*domain.AppealRecord, error) {
	var a domain.AppealRecord
	err := s.q.QueryRow(ctx, `
		SELECT id, user_id, type, reason, status, created_at
		FROM appeal_records WHERE id = $1
	`, id).Scan(&a.ID, &a.UserID, &a.Type, &a.Reason, &a.Status, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// TenantID 查询申诉所属租户（租户归属校验用）。
func (s *AppealStore) TenantID(ctx context.Context, id string) (string, error) {
	var tenantID string
	err := s.q.QueryRow(ctx, `SELECT tenant_id FROM appeal_records WHERE id = $1`, id).Scan(&tenantID)
	return tenantID, err
}

// Create 创建申诉。
func (s *AppealStore) Create(ctx context.Context, tenantID, userID, appealType, reason string) (*domain.AppealRecord, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO appeal_records (id, tenant_id, user_id, type, reason, status)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, 'pending')
		RETURNING id
	`, tenantID, userID, appealType, reason).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Process 处理申诉（status: approved/rejected）。
func (s *AppealStore) Process(ctx context.Context, id, status string) (*domain.AppealRecord, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE appeal_records SET status = $1 WHERE id = $2
	`, status, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// ScanAppealRows 扫描申诉行。
func ScanAppealRows(rows pgx.Rows) ([]domain.AppealRecord, error) {
	var items []domain.AppealRecord
	for rows.Next() {
		var a domain.AppealRecord
		if err := rows.Scan(&a.ID, &a.UserID, &a.Type, &a.Reason, &a.Status, &a.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, a)
	}
	return items, rows.Err()
}

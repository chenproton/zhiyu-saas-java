package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 字典 =====

func (s *AllianceStore) ScanDictionaryRows(rows pgx.Rows) ([]domain.AllianceDictionary, error) {
	items := make([]domain.AllianceDictionary, 0)
	for rows.Next() {
		var d domain.AllianceDictionary
		if err := rows.Scan(&d.ID, &d.TenantID, &d.DictType, &d.Code, &d.Name, &d.SortOrder, &d.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, d)
	}
	return items, nil
}

func (s *AllianceStore) CreateDictionary(ctx context.Context, d *domain.AllianceDictionary) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_dictionaries (id, tenant_id, dict_type, code, name, sort_order, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,NOW())
	`, id, d.TenantID, d.DictType, d.Code, d.Name, d.SortOrder)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) GetDictionaryByID(ctx context.Context, id, tenantID string) (*domain.AllianceDictionary, error) {
	var d domain.AllianceDictionary
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, dict_type, code, name, sort_order, created_at
		FROM alliance_dictionaries WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&d.ID, &d.TenantID, &d.DictType, &d.Code, &d.Name, &d.SortOrder, &d.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (s *AllianceStore) UpdateDictionary(ctx context.Context, id, tenantID string, d *domain.AllianceDictionary) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_dictionaries SET name = $1, sort_order = $2 WHERE id = $3 AND tenant_id = $4
	`, d.Name, d.SortOrder, id, tenantID)
	return err
}

func (s *AllianceStore) DeleteDictionary(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_dictionaries WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

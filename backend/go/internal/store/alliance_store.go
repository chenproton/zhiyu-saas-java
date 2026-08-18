package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type AllianceStore struct {
	q Queryer
}

// Q 返回底层查询器。
func (s *AllianceStore) Q() Queryer {
	return s.q
}

func NewAllianceStore(q Queryer) *AllianceStore {
	return &AllianceStore{q: q}
}

// ===== 学校信息 =====

func (s *AllianceStore) GetSchoolInfo(ctx context.Context, tenantID string) (*domain.AllianceSchoolInfo, error) {
	var i domain.AllianceSchoolInfo
	var shortName, schoolType, province, city, address, website, contactPhone, description, logoURL *string
	var scaleData, secondaryColleges json.RawMessage
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, short_name, school_type, province, city, address,
		       website, contact_phone, description, logo_url, scale_data, secondary_colleges,
		       created_at, updated_at
		FROM alliance_school_info WHERE tenant_id = $1
	`, tenantID).Scan(&i.ID, &i.TenantID, &i.Name, &shortName, &schoolType, &province, &city,
		&address, &website, &contactPhone, &description, &logoURL, &scaleData, &secondaryColleges,
		&i.CreatedAt, &i.UpdatedAt)
	if err != nil {
		return nil, err
	}
	i.ShortName = shortName
	i.SchoolType = schoolType
	i.Province = province
	i.City = city
	i.Address = address
	i.Website = website
	i.ContactPhone = contactPhone
	i.Description = description
	i.LogoURL = logoURL
	i.ScaleData = scaleData
	i.SecondaryColleges = secondaryColleges
	return &i, nil
}

func (s *AllianceStore) UpsertSchoolInfo(ctx context.Context, info *domain.AllianceSchoolInfo) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_school_info (id, tenant_id, name, short_name, school_type, province, city,
			address, website, contact_phone, description, logo_url, scale_data, secondary_colleges,
			created_at, updated_at)
		VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
		ON CONFLICT (tenant_id) DO UPDATE SET
			name = $3, short_name = $4, school_type = $5, province = $6, city = $7,
			address = $8, website = $9, contact_phone = $10, description = $11, logo_url = $12,
			scale_data = $13, secondary_colleges = $14, updated_at = NOW()
	`, info.ID, info.TenantID, info.Name, info.ShortName, info.SchoolType, info.Province, info.City,
		info.Address, info.Website, info.ContactPhone, info.Description, info.LogoURL,
		info.ScaleData, info.SecondaryColleges)
	return err
}

// ===== handler 直写 DB 收编 =====

// queryList 执行查询并用 scan 扫描全部行；扫描错误上抛（与 queryOne 行为一致）。
func queryList[T any](ctx context.Context, db Queryer, scan func(pgx.Rows) ([]T, error), query string, args ...any) ([]T, error) {
	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, err := scan(rows)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// queryOne 执行查询并返回第一行；无行时返回 pgx.ErrNoRows。
func queryOne[T any](ctx context.Context, db Queryer, scan func(pgx.Rows) ([]T, error), query string, args ...any) (*T, error) {
	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, err := scan(rows)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, pgx.ErrNoRows
	}
	return &items[0], nil
}

func (s *AllianceStore) ListMilestones(ctx context.Context, projectID, tenantID string) ([]domain.AllianceProjectMilestone, error) {
	return queryList(ctx, s.q, s.ScanMilestoneRows, `
		SELECT id, tenant_id, project_id, name, description, due_date, completed_date,
			is_completed, sort_order, created_at, updated_at
		FROM alliance_project_milestones WHERE project_id = $1 AND tenant_id = $2 ORDER BY sort_order ASC
	`, projectID, tenantID)
}

func (s *AllianceStore) GetPermissionByID(ctx context.Context, id, tenantID string) (*domain.AlliancePermission, error) {
	return queryOne(ctx, s.q, s.ScanPermissionRows, `
		SELECT id, tenant_id, account_name, account_type, enterprise_id, expert_id,
			is_enabled, resource_permissions, platform_permissions, created_at, updated_at
		FROM alliance_permissions WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
}

func (s *AllianceStore) ListDictionaries(ctx context.Context, dictType, tenantID string) ([]domain.AllianceDictionary, error) {
	return queryList(ctx, s.q, s.ScanDictionaryRows, `
		SELECT id, tenant_id, dict_type, code, name, sort_order, created_at
		FROM alliance_dictionaries WHERE dict_type = $1 AND tenant_id = $2 ORDER BY sort_order ASC
	`, dictType, tenantID)
}

package store

import (
	"context"
	"errors"
	"sort"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// UserExtensionFieldStore 提供用户扩展字段的持久化访问。
type UserExtensionFieldStore struct {
	q Queryer
}

// NewUserExtensionFieldStore 创建扩展字段 store。
func NewUserExtensionFieldStore(q Queryer) *UserExtensionFieldStore {
	return &UserExtensionFieldStore{q: q}
}

// List 查询租户全部扩展字段（按槽位排序）。
func (s *UserExtensionFieldStore) List(ctx context.Context, tenantID string) ([]domain.UserExtensionField, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, field_key, field_name, field_type, is_enabled, is_required,
			applicable_role_codes, slot_number, created_at
		FROM user_extension_fields
		WHERE tenant_id = $1
		ORDER BY slot_number ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanUserExtensionFieldRows(rows)
}

// Get 按 ID 查询扩展字段。
func (s *UserExtensionFieldStore) Get(ctx context.Context, id string) (*domain.UserExtensionField, error) {
	f, err := s.fetchField(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return f, nil
}

// Update 更新扩展字段。
func (s *UserExtensionFieldStore) Update(ctx context.Context, id string, p *UserExtensionFieldUpdateParams) (*domain.UserExtensionField, error) {
	if _, err := s.fetchField(ctx, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	_, err := s.q.Exec(ctx, `
		UPDATE user_extension_fields SET field_name = $1, is_enabled = $2, is_required = $3,
			applicable_role_codes = $4
		WHERE id = $5
	`, p.FieldName, p.IsEnabled, p.IsRequired, p.ApplicableRoleCodes, id)
	if err != nil {
		return nil, err
	}
	return s.fetchField(ctx, id)
}

// EnsureDefaultSlots 补齐 1-20 号默认槽位。
func (s *UserExtensionFieldStore) EnsureDefaultSlots(ctx context.Context, tenantID string) error {
	rows, err := s.q.Query(ctx, `
		SELECT slot_number FROM user_extension_fields WHERE tenant_id = $1
	`, tenantID)
	if err != nil {
		return err
	}
	existing := make(map[int]bool)
	for rows.Next() {
		var slot int
		if err := rows.Scan(&slot); err != nil {
			rows.Close()
			return err
		}
		existing[slot] = true
	}
	rows.Close()

	for slot := 1; slot <= 20; slot++ {
		if existing[slot] {
			continue
		}
		fieldKey := "field_" + Itoa(slot)
		fieldName := "扩展字段" + Itoa(slot)
		if _, err := s.q.Exec(ctx, `
			INSERT INTO user_extension_fields (id, tenant_id, field_key, field_name, field_type, is_enabled, is_required, applicable_role_codes, slot_number)
			VALUES ($1, $2, $3, $4, 'text', FALSE, FALSE, '{}', $5)
			ON CONFLICT (tenant_id, field_key) DO NOTHING
		`, uuid.NewString(), tenantID, fieldKey, fieldName, slot); err != nil {
			return err
		}
	}
	return nil
}

// FilterTenantRoleCodes 仅保留租户内真实存在的角色编码。
func (s *UserExtensionFieldStore) FilterTenantRoleCodes(ctx context.Context, tenantID string, codes []string) []string {
	if len(codes) == 0 {
		return []string{}
	}
	rows, err := s.q.Query(ctx, `
		SELECT code FROM roles WHERE tenant_id = $1 AND code = ANY($2::text[])
	`, tenantID, codes)
	if err != nil {
		return []string{}
	}
	defer rows.Close()
	valid := make([]string, 0, len(codes))
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err == nil {
			valid = append(valid, code)
		}
	}
	sort.Strings(valid)
	return valid
}

// UserExtensionFieldUpdateParams 更新扩展字段参数。
type UserExtensionFieldUpdateParams struct {
	FieldName           string
	IsEnabled           bool
	IsRequired          bool
	ApplicableRoleCodes []string
}

func (s *UserExtensionFieldStore) fetchField(ctx context.Context, id string) (*domain.UserExtensionField, error) {
	var field domain.UserExtensionField
	var applicableCodes []string

	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, field_key, field_name, field_type, is_enabled, is_required,
			applicable_role_codes, slot_number, created_at
		FROM user_extension_fields WHERE id = $1
	`, id).Scan(
		&field.ID, &field.TenantID, &field.FieldKey, &field.FieldName, &field.FieldType,
		&field.IsEnabled, &field.IsRequired, &applicableCodes, &field.SlotNumber, &field.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	field.ApplicableRoleCodes = applicableCodes
	return &field, nil
}

func scanUserExtensionFieldRows(rows pgx.Rows) ([]domain.UserExtensionField, error) {
	items := make([]domain.UserExtensionField, 0)
	for rows.Next() {
		var field domain.UserExtensionField
		var applicableCodes []string
		if err := rows.Scan(
			&field.ID, &field.TenantID, &field.FieldKey, &field.FieldName, &field.FieldType,
			&field.IsEnabled, &field.IsRequired, &applicableCodes, &field.SlotNumber, &field.CreatedAt,
		); err != nil {
			return nil, err
		}
		field.ApplicableRoleCodes = applicableCodes
		items = append(items, field)
	}
	return items, rows.Err()
}

package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// PositionAbilityStore 岗位能力绑定持久化。
type PositionAbilityStore struct {
	q Queryer
}

// NewPositionAbilityStore 创建岗位能力 store。
func NewPositionAbilityStore(q Queryer) *PositionAbilityStore {
	return &PositionAbilityStore{q: q}
}

// List 查询能力绑定列表。
func (s *PositionAbilityStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.PositionAbilityBinding]) ([]domain.PositionAbilityBinding, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanPositionAbilityRows)
}

// Get 查询单个绑定。
func (s *PositionAbilityStore) Get(ctx context.Context, id string) (*domain.PositionAbilityBinding, error) {
	b, err := s.fetchBinding(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return b, nil
}

// Create 创建绑定。
func (s *PositionAbilityStore) Create(ctx context.Context, tenantID string, p *PositionAbilityParams) (*domain.PositionAbilityBinding, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO position_ability_bindings (
			id, tenant_id, career_position_id, responsibility_id, ability_point_id, source,
			domain, required_level, rubric_description, attributes, weight
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, id, tenantID, p.CareerPositionID, p.ResponsibilityID, p.AbilityPointID, p.Source,
		p.Domain, p.RequiredLevel, p.RubricDescription, p.Attributes, p.Weight)
	if err != nil {
		return nil, err
	}
	return s.fetchBinding(ctx, id)
}

// Update 更新绑定。
func (s *PositionAbilityStore) Update(ctx context.Context, id string, p *PositionAbilityParams) (*domain.PositionAbilityBinding, error) {
	if _, err := s.fetchBinding(ctx, id); err != nil {
		return nil, err
	}
	_, err := s.q.Exec(ctx, `
		UPDATE position_ability_bindings SET
			career_position_id = $1, responsibility_id = $2, ability_point_id = $3, source = $4,
			domain = $5, required_level = $6, rubric_description = $7, attributes = $8, weight = $9
		WHERE id = $10
	`, p.CareerPositionID, p.ResponsibilityID, p.AbilityPointID, p.Source,
		p.Domain, p.RequiredLevel, p.RubricDescription, p.Attributes, p.Weight, id)
	if err != nil {
		return nil, err
	}
	return s.fetchBinding(ctx, id)
}

// Delete 删除绑定。
func (s *PositionAbilityStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM position_ability_bindings WHERE id = $1`, id)
	return err
}

// ListConfig 返回能力绑定列表查询配置，SQL 片段沉淀在 store 层。
func (s *PositionAbilityStore) ListConfig() ListQueryConfig[domain.PositionAbilityBinding] {
	return ListQueryConfig[domain.PositionAbilityBinding]{
		Table:         "position_ability_bindings",
		SelectColumns: "id, career_position_id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, attributes, weight",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if careerPositionID := p.Values["careerPositionId"]; careerPositionID != "" {
				qb.AddCondition("career_position_id = " + qb.NextArg(careerPositionID))
			}
			if responsibilityID := p.Values["responsibilityId"]; responsibilityID != "" {
				qb.AddCondition("responsibility_id = " + qb.NextArg(responsibilityID))
			}
		},
	}
}

// PositionAbilityParams 能力绑定参数。
type PositionAbilityParams struct {
	CareerPositionID  string
	ResponsibilityID  string
	AbilityPointID    string
	Source            string
	Domain            *string
	RequiredLevel     string
	RubricDescription *string
	Attributes        []string
	Weight            float64
}

func (s *PositionAbilityStore) fetchBinding(ctx context.Context, id string) (*domain.PositionAbilityBinding, error) {
	var b domain.PositionAbilityBinding
	var domainField, rubricDescription *string
	var attributes []string

	err := s.q.QueryRow(ctx, `
		SELECT id, career_position_id, responsibility_id, ability_point_id, source,
			domain, required_level, rubric_description, attributes, weight
		FROM position_ability_bindings WHERE id = $1
	`, id).Scan(
		&b.ID, &b.CareerPositionID, &b.ResponsibilityID, &b.AbilityPointID, &b.Source,
		&domainField, &b.RequiredLevel, &rubricDescription, &attributes, &b.Weight,
	)
	if err != nil {
		return nil, err
	}
	b.Domain = domainField
	b.RubricDescription = rubricDescription
	b.Attributes = attributes
	return &b, nil
}

func scanPositionAbilityRows(rows pgx.Rows) ([]domain.PositionAbilityBinding, error) {
	items := make([]domain.PositionAbilityBinding, 0)
	for rows.Next() {
		var b domain.PositionAbilityBinding
		var domainField, rubricDescription *string
		var attributes []string
		if err := rows.Scan(
			&b.ID, &b.CareerPositionID, &b.ResponsibilityID, &b.AbilityPointID, &b.Source,
			&domainField, &b.RequiredLevel, &rubricDescription, &attributes, &b.Weight,
		); err != nil {
			return nil, err
		}
		b.Domain = domainField
		b.RubricDescription = rubricDescription
		b.Attributes = attributes
		items = append(items, b)
	}
	return items, rows.Err()
}

// PositionResponsibilityStore 岗位职责持久化。
type PositionResponsibilityStore struct {
	q Queryer
}

// NewPositionResponsibilityStore 创建岗位职责 store。
func NewPositionResponsibilityStore(q Queryer) *PositionResponsibilityStore {
	return &PositionResponsibilityStore{q: q}
}

// List 查询职责列表。
func (s *PositionResponsibilityStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.PositionResponsibility]) ([]domain.PositionResponsibility, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, scanPositionResponsibilityRows)
}

// Get 查询单个职责。
func (s *PositionResponsibilityStore) Get(ctx context.Context, id string) (*domain.PositionResponsibility, error) {
	r, err := s.fetchResp(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return r, nil
}

// Create 创建职责（tenant_id 保持 NULL，与原行为一致）。
func (s *PositionResponsibilityStore) Create(ctx context.Context, p *PositionResponsibilityParams) (*domain.PositionResponsibility, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO position_responsibilities (id, career_position_id, name, description, sort_order)
		VALUES ($1, $2, $3, $4, $5)
	`, id, p.CareerPositionID, p.Name, p.Description, p.SortOrder)
	if err != nil {
		return nil, err
	}
	return s.fetchResp(ctx, id)
}

// Update 更新职责。
func (s *PositionResponsibilityStore) Update(ctx context.Context, id string, p *PositionResponsibilityParams) (*domain.PositionResponsibility, error) {
	if _, err := s.fetchResp(ctx, id); err != nil {
		return nil, err
	}
	_, err := s.q.Exec(ctx, `
		UPDATE position_responsibilities SET name = $1, description = $2, sort_order = $3
		WHERE id = $4
	`, p.Name, p.Description, p.SortOrder, id)
	if err != nil {
		return nil, err
	}
	return s.fetchResp(ctx, id)
}

// Delete 删除职责。
func (s *PositionResponsibilityStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM position_responsibilities WHERE id = $1`, id)
	return err
}

// ListConfig 返回职责列表查询配置，SQL 片段沉淀在 store 层。
func (s *PositionResponsibilityStore) ListConfig() ListQueryConfig[domain.PositionResponsibility] {
	return ListQueryConfig[domain.PositionResponsibility]{
		Table:         "position_responsibilities",
		SelectColumns: "id, career_position_id, name, description, sort_order",
		TenantScoped:  true,
		OrderBy:       "sort_order ASC, id ASC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if careerPositionID := p.Values["careerPositionId"]; careerPositionID != "" {
				qb.AddCondition("career_position_id = " + qb.NextArg(careerPositionID))
			}
		},
	}
}

// PositionResponsibilityParams 职责参数。
type PositionResponsibilityParams struct {
	CareerPositionID string
	Name             string
	Description      *string
	SortOrder        int
}

func (s *PositionResponsibilityStore) fetchResp(ctx context.Context, id string) (*domain.PositionResponsibility, error) {
	var r domain.PositionResponsibility
	err := s.q.QueryRow(ctx, `
		SELECT id, career_position_id, name, description, sort_order
		FROM position_responsibilities WHERE id = $1
	`, id).Scan(
		&r.ID, &r.CareerPositionID, &r.Name, &r.Description, &r.SortOrder,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func scanPositionResponsibilityRows(rows pgx.Rows) ([]domain.PositionResponsibility, error) {
	items := make([]domain.PositionResponsibility, 0)
	for rows.Next() {
		var r domain.PositionResponsibility
		if err := rows.Scan(
			&r.ID, &r.CareerPositionID, &r.Name, &r.Description, &r.SortOrder,
		); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

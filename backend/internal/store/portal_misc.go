package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 能力点 =====

// AbilityStore 能力点持久化。
type AbilityStore struct {
	q Queryer
}

// NewAbilityStore 创建能力点 store。
func NewAbilityStore(q Queryer) *AbilityStore {
	return &AbilityStore{q: q}
}

// List 查询能力点列表。
func (s *AbilityStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.AbilityPoint]) ([]domain.AbilityPoint, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanAbilityPointRows)
}

// Get 查询单个能力点。
func (s *AbilityStore) Get(ctx context.Context, id string) (*domain.AbilityPoint, error) {
	var a domain.AbilityPoint
	var description, code *string
	err := s.q.QueryRow(ctx, `
		SELECT id, name, code, description, category, attributes, is_public, creator_id, created_at
		FROM ability_points WHERE id = $1
	`, id).Scan(&a.ID, &a.Name, &code, &description, &a.Category, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	a.Description = description
	a.Code = code
	return &a, nil
}

// Create 创建能力点。
func (s *AbilityStore) Create(ctx context.Context, tenantID string, p *AbilityPointParams) (*domain.AbilityPoint, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO ability_points (id, tenant_id, name, description, category, attributes, is_public, creator_id)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, tenantID, p.Name, p.Description, p.Category, p.Attributes, p.IsPublic, p.CreatorID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新能力点。
func (s *AbilityStore) Update(ctx context.Context, id string, p *AbilityPointParams) (*domain.AbilityPoint, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE ability_points SET name = $1, description = $2, category = $3, attributes = $4, is_public = $5
		WHERE id = $6
	`, p.Name, p.Description, p.Category, p.Attributes, p.IsPublic, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除能力点。
func (s *AbilityStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM ability_points WHERE id = $1`, id)
	return err
}

// AbilityPointParams 能力点参数。
type AbilityPointParams struct {
	Name        string
	Description *string
	Category    string
	Attributes  []string
	IsPublic    bool
	CreatorID   string
}

// ScanAbilityPointRows 扫描能力点行。
func ScanAbilityPointRows(rows pgx.Rows) ([]domain.AbilityPoint, error) {
	items := make([]domain.AbilityPoint, 0)
	for rows.Next() {
		var a domain.AbilityPoint
		var description, code *string
		if err := rows.Scan(&a.ID, &a.Name, &code, &description, &a.Category, &a.Attributes, &a.IsPublic, &a.CreatorID, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.Description = description
		a.Code = code
		items = append(items, a)
	}
	return items, nil
}

// ===== 能力域 =====

// AbilityDomainStore 能力域持久化。
type AbilityDomainStore struct {
	q Queryer
}

// NewAbilityDomainStore 创建能力域 store。
func NewAbilityDomainStore(q Queryer) *AbilityDomainStore {
	return &AbilityDomainStore{q: q}
}

// List 查询能力域列表。
func (s *AbilityDomainStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.AbilityDomain]) ([]domain.AbilityDomain, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanAbilityDomainRows)
}

// Get 查询单个能力域。
func (s *AbilityDomainStore) Get(ctx context.Context, id string) (*domain.AbilityDomain, error) {
	d, err := s.fetchDomain(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return d, nil
}

// Create 创建能力域。
func (s *AbilityDomainStore) Create(ctx context.Context, tenantID string, p *AbilityDomainParams) (*domain.AbilityDomain, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
		RETURNING id
	`, tenantID, p.CareerPositionID, p.Name, p.Description, p.BindingIDs, p.SortOrder).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新能力域。
func (s *AbilityDomainStore) Update(ctx context.Context, id string, p *AbilityDomainParams) (*domain.AbilityDomain, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE ability_domains SET
			career_position_id = $1, name = $2, description = $3, binding_ids = $4, sort_order = $5
		WHERE id = $6
	`, p.CareerPositionID, p.Name, p.Description, p.BindingIDs, p.SortOrder, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除能力域。
func (s *AbilityDomainStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM ability_domains WHERE id = $1`, id)
	return err
}

// AbilityDomainParams 能力域参数。
type AbilityDomainParams struct {
	CareerPositionID string
	Name             string
	Description      *string
	BindingIDs       []string
	SortOrder        int
}

func (s *AbilityDomainStore) fetchDomain(ctx context.Context, id string) (*domain.AbilityDomain, error) {
	var d domain.AbilityDomain
	var tenantID, description *string
	var bindingIDs []string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, career_position_id, name, description, binding_ids, sort_order
		FROM ability_domains WHERE id = $1
	`, id).Scan(&d.ID, &tenantID, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder)
	if err != nil {
		return nil, err
	}
	d.TenantID = tenantID
	d.Description = description
	d.BindingIDs = bindingIDs
	return &d, nil
}

// ScanAbilityDomainRows 扫描能力域行。
func ScanAbilityDomainRows(rows pgx.Rows) ([]domain.AbilityDomain, error) {
	items := make([]domain.AbilityDomain, 0)
	for rows.Next() {
		var d domain.AbilityDomain
		var tenantID, description *string
		var bindingIDs []string
		if err := rows.Scan(&d.ID, &tenantID, &d.CareerPositionID, &d.Name, &description, &bindingIDs, &d.SortOrder); err != nil {
			return nil, err
		}
		d.TenantID = tenantID
		d.Description = description
		d.BindingIDs = bindingIDs
		items = append(items, d)
	}
	return items, nil
}

var _ = time.Now

// ===== 轮播图 =====

// BannerStore 轮播图持久化。
type BannerStore struct {
	q Queryer
}

// NewBannerStore 创建轮播图 store。
func NewBannerStore(q Queryer) *BannerStore {
	return &BannerStore{q: q}
}

// List 查询轮播图列表。
func (s *BannerStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.JobBannerConfig]) ([]domain.JobBannerConfig, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanBannerRows)
}

// Get 查询单个轮播图。
func (s *BannerStore) Get(ctx context.Context, id string) (*domain.JobBannerConfig, error) {
	var b domain.JobBannerConfig
	var linkURL *string
	err := s.q.QueryRow(ctx, `
		SELECT id, title, image_url, link_url, sort_order, is_enabled, created_at, updated_at
		FROM banner_configs WHERE id = $1
	`, id).Scan(&b.ID, &b.Title, &b.ImageURL, &linkURL, &b.SortOrder, &b.IsEnabled, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	b.LinkURL = linkURL
	return &b, nil
}

// Create 创建轮播图。
func (s *BannerStore) Create(ctx context.Context, tenantID string, p *BannerParams) (*domain.JobBannerConfig, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO banner_configs (id, tenant_id, title, image_url, link_url, sort_order, is_enabled)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, tenantID, p.Title, p.ImageURL, p.LinkURL, p.SortOrder, p.IsEnabled).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Update 更新轮播图。
func (s *BannerStore) Update(ctx context.Context, id string, p *BannerParams) (*domain.JobBannerConfig, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE banner_configs SET
			title = $1, image_url = $2, link_url = $3, sort_order = $4, is_enabled = $5, updated_at = NOW()
		WHERE id = $6
	`, p.Title, p.ImageURL, p.LinkURL, p.SortOrder, p.IsEnabled, id); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

// Delete 删除轮播图。
func (s *BannerStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM banner_configs WHERE id = $1`, id)
	return err
}

// BannerParams 轮播图参数。
type BannerParams struct {
	Title     string
	ImageURL  string
	LinkURL   *string
	SortOrder int
	IsEnabled bool
}

// ScanBannerRows 扫描轮播图行。
func ScanBannerRows(rows pgx.Rows) ([]domain.JobBannerConfig, error) {
	items := make([]domain.JobBannerConfig, 0)
	for rows.Next() {
		var b domain.JobBannerConfig
		var linkURL *string
		if err := rows.Scan(&b.ID, &b.Title, &b.ImageURL, &linkURL, &b.SortOrder, &b.IsEnabled, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		b.LinkURL = linkURL
		items = append(items, b)
	}
	return items, nil
}

// ===== 学期 =====

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

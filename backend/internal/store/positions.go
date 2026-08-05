package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// PositionStore 岗位持久化。
type PositionStore struct {
	q        Queryer
	beginner txBeginner
}

// NewPositionStore 创建岗位 store。
func NewPositionStore(q Queryer, beginner txBeginner) *PositionStore {
	return &PositionStore{q: q, beginner: beginner}
}

// List 查询岗位列表。
func (s *PositionStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.CareerPosition]) ([]domain.CareerPosition, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanPositionRows)
}

const positionSelectColumns = "cp.id, cp.batch_id, cp.code, cp.name, cp.short_name, cp.industry_id, COALESCE(maj.major_ids, '{}') AS major_ids, COALESCE(maj.major_names, '{}') AS major_names, cp.position_type, cp.salary_min, cp.salary_max, cp.cover_image, cp.description, cp.requirements, cp.career_path, cp.version, cp.status, cp.created_by, COALESCE(cr_u.name, cp.created_by::text) AS created_by_name, cp.collaborators, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(cp.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, COALESCE(fc.cnt, 0) AS favorite_count, COALESCE(vc.cnt, 0) AS view_count, cp.created_at, cp.updated_at"

const positionListFrom = "career_positions cp LEFT JOIN LATERAL (SELECT COALESCE(array_agg(cpm.major_id), '{}') AS major_ids, COALESCE(array_agg(m.name), '{}') AS major_names FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id WHERE cpm.career_position_id = cp.id) maj ON true LEFT JOIN users cr_u ON cr_u.id = cp.created_by LEFT JOIN view_counters vc ON vc.target_type = 'career_position' AND vc.target_id = cp.id LEFT JOIN favorite_counters fc ON fc.target_type = 'career_position' AND fc.target_id = cp.id"

const positionFavoritesFrom = "position_favorites pf JOIN career_positions cp ON cp.id = pf.career_position_id LEFT JOIN LATERAL (SELECT COALESCE(array_agg(cpm.major_id), '{}') AS major_ids, COALESCE(array_agg(m.name), '{}') AS major_names FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id WHERE cpm.career_position_id = cp.id) maj ON true LEFT JOIN users cr_u ON cr_u.id = cp.created_by LEFT JOIN view_counters vc ON vc.target_type = 'career_position' AND vc.target_id = cp.id LEFT JOIN favorite_counters fc ON fc.target_type = 'career_position' AND fc.target_id = cp.id"

// AdminListConfig 返回管理端岗位列表查询配置（租户隔离 + 管理过滤条件）。
func (s *PositionStore) AdminListConfig() ListQueryConfig[domain.CareerPosition] {
	return ListQueryConfig[domain.CareerPosition]{
		Table:         positionListFrom,
		CountTable:    "career_positions cp",
		SelectColumns: positionSelectColumns,
		TenantScoped:  true,
		TenantColumn:  "cp.tenant_id",
		SearchColumns: []string{"cp.name"},
		SearchParam:   "search",
		OrderBy:       "cp.created_at DESC",
		DefaultLimit:  50,
		ScanRows:      ScanPositionRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			batchID := p.Values["batchId"]
			status := p.Values["status"]
			positionType := p.Values["positionType"]
			if batchID != "" {
				qb.AddCondition("cp.batch_id = " + qb.NextArg(batchID))
			}
			if status != "" {
				qb.AddCondition("cp.status = " + qb.NextArg(status))
			} else {
				qb.AddCondition("cp.status != " + qb.NextArg("archived"))
			}
			if positionType != "" {
				qb.AddCondition("cp.position_type = " + qb.NextArg(positionType))
			}
		},
	}
}

// PublicListConfig 返回前台公开岗位列表查询配置（仅已发布，租户隔离）。
func (s *PositionStore) PublicListConfig() ListQueryConfig[domain.CareerPosition] {
	return ListQueryConfig[domain.CareerPosition]{
		Table:         positionListFrom,
		SelectColumns: positionSelectColumns,
		TenantScoped:  true,
		TenantColumn:  "cp.tenant_id",
		SearchColumns: []string{"cp.name"},
		SearchParam:   "search",
		OrderBy:       "cp.created_at DESC",
		DefaultLimit:  50,
		ScanRows:      ScanPositionRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			qb.AddCondition("cp.status = " + qb.NextArg(string(domain.StatusPublished)))
			if positionType := p.Values["positionType"]; positionType != "" {
				qb.AddCondition("cp.position_type = " + qb.NextArg(positionType))
			}
		},
	}
}

// FavoritesListConfig 返回当前用户收藏岗位列表查询配置。
func (s *PositionStore) FavoritesListConfig(userID string) ListQueryConfig[domain.CareerPosition] {
	return ListQueryConfig[domain.CareerPosition]{
		Table:         positionFavoritesFrom,
		SelectColumns: positionSelectColumns,
		OrderBy:       "cp.created_at DESC",
		DefaultLimit:  50,
		ScanRows:      ScanPositionRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			qb.AddCondition("cp.status = " + qb.NextArg(string(domain.StatusPublished)))
			qb.AddCondition("pf.user_id = " + qb.NextArg(userID))
		},
	}
}

// Get 查询单个岗位。
func (s *PositionStore) Get(ctx context.Context, id string) (*domain.CareerPosition, error) {
	pos, err := s.fetchPosition(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return pos, nil
}

// TenantID 查询岗位租户。
func (s *PositionStore) TenantID(ctx context.Context, id string) (string, error) {
	var tenantID string
	err := s.q.QueryRow(ctx, `SELECT tenant_id FROM career_positions WHERE id = $1`, id).Scan(&tenantID)
	return tenantID, err
}

// Create 在事务内创建岗位与专业绑定。
func (s *PositionStore) Create(ctx context.Context, tx Queryer, tenantID string, p *PositionCreateParams) (*domain.CareerPosition, error) {
	id := uuid.NewString()
	if _, err := tx.Exec(ctx, `
		INSERT INTO career_positions (
			id, tenant_id, code, batch_id, name, short_name, industry_id, position_type,
			salary_min, salary_max, cover_image, description, requirements, career_path,
			version, status, created_by, collaborators
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
	`, id, tenantID, p.Code, p.BatchID, p.Name, p.ShortName, p.IndustryID,
		p.PositionType, p.SalaryMin, p.SalaryMax, p.CoverImage, p.Description,
		p.Requirements, p.CareerPath, p.Version, p.Status, p.CreatedBy,
		p.Collaborators); err != nil {
		return nil, err
	}
	for _, majorID := range p.MajorIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO career_position_majors (career_position_id, major_id) VALUES ($1, $2)
		`, id, majorID); err != nil {
			return nil, err
		}
	}
	return s.fetchPosition(ctx, id)
}

// Update 在事务内更新岗位与专业绑定。
func (s *PositionStore) Update(ctx context.Context, tx Queryer, id string, p *PositionUpdateParams) (*domain.CareerPosition, error) {
	if _, err := tx.Exec(ctx, `
		UPDATE career_positions SET
			batch_id = $1, name = $2, short_name = $3, industry_id = $4,
			position_type = $5, salary_min = $6, salary_max = $7, cover_image = $8,
			description = $9, requirements = $10, career_path = $11, version = $12,
			collaborators = $13, updated_at = NOW()
		WHERE id = $14
	`, p.BatchID, p.Name, p.ShortName, p.IndustryID, p.PositionType,
		p.SalaryMin, p.SalaryMax, p.CoverImage, p.Description, p.Requirements,
		p.CareerPath, p.Version, p.Collaborators, id); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM career_position_majors WHERE career_position_id = $1`, id); err != nil {
		return nil, err
	}
	for _, majorID := range p.MajorIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO career_position_majors (career_position_id, major_id) VALUES ($1, $2)
		`, id, majorID); err != nil {
			return nil, err
		}
	}
	return s.fetchPosition(ctx, id)
}

// Delete 删除岗位（事务内同步清理无外键约束的岗位能力结果/学生画像/汇聚日志/
// 认证规则链/认证等级数据，防止孤儿数据残留）。
func (s *PositionStore) Delete(ctx context.Context, id string) error {
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM job_ability_results WHERE career_position_id = $1`, id); err != nil {
			return fmt.Errorf("cleanup job ability results: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM student_ability_portraits WHERE career_position_id = $1`, id); err != nil {
			return fmt.Errorf("cleanup student ability portraits: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM job_ability_aggregate_logs WHERE career_position_id = $1`, id); err != nil {
			return fmt.Errorf("cleanup job ability aggregate logs: %w", err)
		}
		// certification_weights 无 rule_id 外键需显式删除；certification_rules 级联删
		// ability_items → ability_points → related_tasks；grade_data 级联删 leaderboard/competency
		if _, err := tx.Exec(ctx, `DELETE FROM certification_weights WHERE rule_id IN (SELECT id FROM certification_rules WHERE career_position_id = $1)`, id); err != nil {
			return fmt.Errorf("cleanup certification weights: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM certification_grade_data WHERE position_id = $1`, id); err != nil {
			return fmt.Errorf("cleanup certification grade data: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM certification_rules WHERE career_position_id = $1`, id); err != nil {
			return fmt.Errorf("cleanup certification rules: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM career_positions WHERE id = $1`, id); err != nil {
			return fmt.Errorf("delete position: %w", err)
		}
		return nil
	})
}

// IncrementView 记录岗位浏览。
func (s *PositionStore) IncrementView(ctx context.Context, targetID string, userID, tenantID any) error {
	return RecordView(ctx, s.q, "career_position", targetID, userID, tenantID)
}

// PositionCreateParams 创建岗位参数。
type PositionCreateParams struct {
	Code          string
	BatchID       *string
	Name          string
	ShortName     *string
	IndustryID    *string
	PositionType  string
	SalaryMin     *int
	SalaryMax     *int
	CoverImage    *string
	Description   *string
	Requirements  []string
	CareerPath    *string
	Version       string
	Status        domain.CareerPositionStatus
	CreatedBy     string
	Collaborators []string
	MajorIDs      []string
}

// PositionUpdateParams 更新岗位参数。
type PositionUpdateParams struct {
	BatchID       *string
	Name          string
	ShortName     *string
	IndustryID    *string
	PositionType  string
	SalaryMin     *int
	SalaryMax     *int
	CoverImage    *string
	Description   *string
	Requirements  []string
	CareerPath    *string
	Version       string
	Collaborators []string
	MajorIDs      []string
}

// FullPositionSaveParams 完整保存岗位参数（SaveFull）。
type FullPositionSaveParams struct {
	BatchID          *string
	Name             string
	ShortName        string
	IndustryID       *string
	PositionType     string
	SalaryRange      [2]int
	CoverImage       *string
	Description      *string
	Requirements     []string
	CareerPath       *string
	Version          string
	Collaborators    []string
	Majors           []string
	CreatorID        string
	Certificates     []FullPositionCertificateItem
	Responsibilities []FullPositionResponsibilityItem
	AbilityBindings  []FullPositionAbilityBindingItem
	AbilityDomains   []FullPositionAbilityDomainItem
}

// FullPositionCertificateItem 证书项。
type FullPositionCertificateItem struct {
	ID          string
	Name        string
	URL         *string
	Description *string
	Image       *string
}

// FullPositionResponsibilityItem 职责项。
type FullPositionResponsibilityItem struct {
	ID          string
	Name        string
	Description *string
}

// FullPositionAbilityBindingItem 能力绑定项。
type FullPositionAbilityBindingItem struct {
	ID                string
	ResponsibilityID  string
	Source            string
	Name              string
	Description       *string
	PublicAbilityID   string
	AbilityPointID    string
	Domain            *string
	RequiredLevel     string
	RubricDescription *string
	Attributes        []string
	Weight            float64
}

// FullPositionAbilityDomainItem 能力域项。
type FullPositionAbilityDomainItem struct {
	ID          string
	Name        string
	Description *string
	BindingIDs  []string
}

// SaveFull 在事务内完整保存岗位（岗位+专业+职责+能力绑定+能力域+证书）。
func (s *PositionStore) SaveFull(ctx context.Context, tx Queryer, tenantID, positionID string, p *FullPositionSaveParams, abilityPointMap map[string]string, certificateMap map[string]string) error {
	if _, err := tx.Exec(ctx, `
		UPDATE career_positions SET
			batch_id = $1, name = $2, short_name = $3, industry_id = $4,
			position_type = $5, salary_min = $6, salary_max = $7, cover_image = $8,
			description = $9, requirements = $10, career_path = $11, version = $12,
			collaborators = $13, updated_at = NOW()
		WHERE id = $14
	`, p.BatchID, p.Name, p.ShortName, p.IndustryID, p.PositionType,
		p.SalaryRange[0], p.SalaryRange[1], p.CoverImage, p.Description,
		p.Requirements, p.CareerPath, p.Version, p.Collaborators, positionID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM career_position_majors WHERE career_position_id = $1`, positionID); err != nil {
		return err
	}
	for _, majorID := range p.Majors {
		if _, err := tx.Exec(ctx, `
			INSERT INTO career_position_majors (career_position_id, major_id) VALUES ($1, $2)
		`, positionID, majorID); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM position_certificates WHERE career_position_id = $1`, positionID); err != nil {
		return err
	}
	for name, libID := range certificateMap {
		if _, err := tx.Exec(ctx, `
			INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT DO NOTHING
		`, uuid.NewString(), tenantID, positionID, libID); err != nil {
			return err
		}
		_ = name
	}

	if _, err := tx.Exec(ctx, `DELETE FROM ability_domains WHERE career_position_id = $1`, positionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM position_ability_bindings WHERE career_position_id = $1`, positionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM position_responsibilities WHERE career_position_id = $1`, positionID); err != nil {
		return err
	}

	respIDMap := make(map[string]string)
	for idx, resp := range p.Responsibilities {
		respID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, description, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, respID, tenantID, positionID, resp.Name, resp.Description, idx); err != nil {
			return err
		}
		respIDMap[resp.ID] = respID
	}

	bindingIDMap := make(map[string]string)
	for _, binding := range p.AbilityBindings {
		respBackendID, ok := respIDMap[binding.ResponsibilityID]
		if !ok {
			continue
		}
		abilityPointID, exists := abilityPointMap[binding.ID]
		if !exists {
			continue
		}
		bindingID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			INSERT INTO position_ability_bindings (
				id, tenant_id, career_position_id, responsibility_id, ability_point_id, source,
				domain, required_level, rubric_description, attributes, weight
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (career_position_id, responsibility_id, ability_point_id) DO UPDATE SET
				domain = EXCLUDED.domain,
				required_level = EXCLUDED.required_level,
				rubric_description = EXCLUDED.rubric_description,
				attributes = EXCLUDED.attributes,
				weight = EXCLUDED.weight
		`, bindingID, tenantID, positionID, respBackendID, abilityPointID, binding.Source,
			binding.Domain, binding.RequiredLevel, binding.RubricDescription, binding.Attributes, binding.Weight); err != nil {
			return err
		}
		bindingIDMap[binding.ID] = bindingID
	}

	for _, ad := range p.AbilityDomains {
		newBindingIDs := make([]string, 0, len(ad.BindingIDs))
		for _, oldID := range ad.BindingIDs {
			if newID, ok := bindingIDMap[oldID]; ok {
				newBindingIDs = append(newBindingIDs, newID)
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.NewString(), tenantID, positionID, ad.Name, ad.Description, newBindingIDs, 0); err != nil {
			return err
		}
	}

	return nil
}

// PrepareAbilityPoint 查找或创建能力点，返回 ID。
func (s *PositionStore) PrepareAbilityPoint(ctx context.Context, tenantID, name string, description *string, attributes []string) (string, error) {
	var existingID string
	err := s.q.QueryRow(ctx, `
		SELECT id FROM ability_points WHERE tenant_id = $1 AND name = $2
	`, tenantID, name).Scan(&existingID)
	if err == nil && existingID != "" {
		return existingID, nil
	}
	newID := uuid.NewString()
	code, err := GenerateUniqueEntityCode(ctx, s.q, "NL", "ability_points", tenantID)
	if err != nil {
		code = GenerateEntityCode("NL")
	}
	if _, err := s.q.Exec(ctx, `
		INSERT INTO ability_points (id, tenant_id, name, code, description, attributes, is_public)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (tenant_id, name) DO NOTHING
	`, newID, tenantID, name, code, description, attributes, true); err != nil {
		return "", err
	}
	_ = s.q.QueryRow(ctx, `
		SELECT id FROM ability_points WHERE tenant_id = $1 AND name = $2
	`, tenantID, name).Scan(&existingID)
	if existingID != "" {
		return existingID, nil
	}
	return newID, nil
}

// PrepareCertificate 查找或创建证书库条目，返回 ID。
func (s *PositionStore) PrepareCertificate(ctx context.Context, tenantID, name string, url, description, image *string) (string, error) {
	var libraryID string
	err := s.q.QueryRow(ctx, `
		SELECT id FROM certificate_library WHERE tenant_id = $1 AND name = $2
	`, tenantID, name).Scan(&libraryID)
	if err == nil && libraryID != "" {
		return libraryID, nil
	}
	libraryID = uuid.NewString()
	if _, err := s.q.Exec(ctx, `
		INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (tenant_id, name) DO NOTHING
	`, libraryID, tenantID, name, url, description, image); err != nil {
		return "", err
	}
	_ = s.q.QueryRow(ctx, `
		SELECT id FROM certificate_library WHERE tenant_id = $1 AND name = $2
	`, tenantID, name).Scan(&libraryID)
	return libraryID, nil
}

// GetFavorite 查询收藏状态。
func (s *PositionStore) GetFavorite(ctx context.Context, userID, positionID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM position_favorites WHERE user_id = $1 AND career_position_id = $2)
	`, userID, positionID).Scan(&exists)
	return exists, err
}

// FavoriteCount 查询岗位收藏数。
func (s *PositionStore) FavoriteCount(ctx context.Context, positionID string) (int, error) {
	var cnt int
	err := s.q.QueryRow(ctx, `
		SELECT COALESCE(cnt, 0) FROM favorite_counters
		WHERE target_type = 'career_position' AND target_id = $1
	`, positionID).Scan(&cnt)
	return cnt, err
}

// ToggleFavorite 切换收藏，返回新状态。
func (s *PositionStore) ToggleFavorite(ctx context.Context, userID, positionID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM position_favorites WHERE user_id = $1 AND career_position_id = $2)
	`, userID, positionID).Scan(&exists)
	if err != nil {
		return false, err
	}
	if exists {
		if _, err := s.q.Exec(ctx, `DELETE FROM position_favorites WHERE user_id = $1 AND career_position_id = $2`, userID, positionID); err != nil {
			return false, err
		}
		_, _ = s.q.Exec(ctx, `
			UPDATE favorite_counters SET cnt = GREATEST(cnt - 1, 0), updated_at = now()
			WHERE target_type = 'career_position' AND target_id = $1
		`, positionID)
		return false, nil
	}
	if _, err := s.q.Exec(ctx, `
		INSERT INTO position_favorites (id, user_id, career_position_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, career_position_id) DO NOTHING
	`, uuid.NewString(), userID, positionID); err != nil {
		return false, err
	}
	_, _ = s.q.Exec(ctx, `
		INSERT INTO favorite_counters (target_type, target_id, cnt)
		VALUES ('career_position', $1, 1)
		ON CONFLICT (target_type, target_id) DO UPDATE SET cnt = favorite_counters.cnt + 1, updated_at = now()
	`, positionID)
	return true, nil
}

// ListFavorites 查询用户收藏的岗位。
func (s *PositionStore) ListFavorites(ctx context.Context, userID string, p ListParams, cfg ListQueryConfig[domain.CareerPosition]) ([]domain.CareerPosition, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanPositionRows)
}

func (s *PositionStore) fetchPosition(ctx context.Context, id string) (*domain.CareerPosition, error) {
	var pos domain.CareerPosition
	var batchID, shortName, industryID, coverImage, description, careerPath *string
	var salaryMin, salaryMax *int
	var majorIDs, majorNames, requirements, collaborators []string

	err := s.q.QueryRow(ctx, `
		SELECT cp.id, cp.tenant_id, cp.batch_id, cp.code, cp.name, cp.short_name, cp.industry_id,
			COALESCE((SELECT array_agg(cpm.major_id) FROM career_position_majors cpm WHERE cpm.career_position_id = cp.id), '{}') AS major_ids,
			COALESCE((SELECT array_agg(m.name) FROM career_position_majors cpm JOIN majors m ON m.id = cpm.major_id WHERE cpm.career_position_id = cp.id), '{}') AS major_names,
			cp.position_type, cp.salary_min, cp.salary_max, cp.cover_image, cp.description,
			cp.requirements, cp.career_path, cp.version, cp.status, cp.created_by,
			COALESCE((SELECT u.name FROM users u WHERE u.id = cp.created_by), cp.created_by::text) AS created_by_name,
			cp.collaborators,
			COALESCE((
				SELECT array_agg(u.name ORDER BY ord)
				FROM unnest(cp.collaborators) WITH ORDINALITY AS c(id, ord)
				JOIN users u ON u.id = c.id
			), '{}') AS collaborator_names,
			COALESCE(fc.cnt, 0) AS favorite_count,
			COALESCE(vc.cnt, 0) AS view_count,
			cp.created_at, cp.updated_at
		FROM career_positions cp
		LEFT JOIN view_counters vc ON vc.target_type = 'career_position' AND vc.target_id = cp.id
		LEFT JOIN favorite_counters fc ON fc.target_type = 'career_position' AND fc.target_id = cp.id
		WHERE cp.id = $1
	`, id).Scan(
		&pos.ID, &pos.TenantID, &batchID, &pos.Code, &pos.Name, &shortName, &industryID, &majorIDs, &majorNames, &pos.PositionType,
		&salaryMin, &salaryMax, &coverImage, &description, &requirements, &careerPath,
		&pos.Version, &pos.Status, &pos.CreatedBy, &pos.CreatedByName, &collaborators, &pos.CollaboratorNames, &pos.FavoriteCount, &pos.ViewCount,
		&pos.CreatedAt, &pos.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	pos.BatchID = batchID
	pos.ShortName = shortName
	pos.IndustryID = industryID
	pos.SalaryMin = salaryMin
	pos.SalaryMax = salaryMax
	pos.CoverImage = coverImage
	pos.Description = description
	pos.Requirements = requirements
	pos.CareerPath = careerPath
	pos.MajorIDs = majorIDs
	pos.MajorNames = majorNames
	pos.Collaborators = collaborators
	return &pos, nil
}

func ScanPositionRows(rows pgx.Rows) ([]domain.CareerPosition, error) {
	items := make([]domain.CareerPosition, 0)
	for rows.Next() {
		var pos domain.CareerPosition
		var batchID, shortName, industryID, coverImage, description, careerPath *string
		var salaryMin, salaryMax *int
		var majorIDs, majorNames, requirements, collaborators []string
		if err := rows.Scan(
			&pos.ID, &batchID, &pos.Code, &pos.Name, &shortName, &industryID, &majorIDs, &majorNames, &pos.PositionType,
			&salaryMin, &salaryMax, &coverImage, &description, &requirements, &careerPath,
			&pos.Version, &pos.Status, &pos.CreatedBy, &pos.CreatedByName, &collaborators, &pos.CollaboratorNames, &pos.FavoriteCount, &pos.ViewCount,
			&pos.CreatedAt, &pos.UpdatedAt,
		); err != nil {
			return nil, err
		}
		pos.BatchID = batchID
		pos.ShortName = shortName
		pos.IndustryID = industryID
		pos.SalaryMin = salaryMin
		pos.SalaryMax = salaryMax
		pos.CoverImage = coverImage
		pos.Description = description
		pos.Requirements = requirements
		pos.CareerPath = careerPath
		pos.MajorIDs = majorIDs
		pos.MajorNames = majorNames
		pos.Collaborators = collaborators
		items = append(items, pos)
	}
	return items, rows.Err()
}

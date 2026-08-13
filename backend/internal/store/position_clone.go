package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// PositionSourceFields 岗位克隆源字段。
type PositionSourceFields struct {
	Name          *string
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
	BatchID       *string
	TenantID      *string
}

// PositionInsertColumns 岗位插入列（克隆与快照 builder 共用，防字段漂移）。
const PositionInsertColumns = `id, tenant_id, code, batch_id, name, short_name, industry_id, position_type,
	salary_min, salary_max, cover_image, description, requirements, career_path,
	version, status, created_by, collaborators`

// PositionCloneStore 岗位克隆持久化（事务内多表复制）。
type PositionCloneStore struct {
	q Queryer
}

// NewPositionCloneStore 创建岗位克隆 store。
func NewPositionCloneStore(q Queryer) *PositionCloneStore {
	return &PositionCloneStore{q: q}
}

// FetchSource 查询源岗位字段。
func (s *PositionCloneStore) FetchSource(ctx context.Context, id string) (*PositionSourceFields, error) {
	var f PositionSourceFields
	var posType domain.PositionType
	err := s.q.QueryRow(ctx, `
		SELECT name, short_name, industry_id, position_type, salary_min, salary_max,
			cover_image, description, requirements, career_path, version, collaborators, batch_id, tenant_id
		FROM career_positions WHERE id = $1
	`, id).Scan(&f.Name, &f.ShortName, &f.IndustryID, &posType,
		&f.SalaryMin, &f.SalaryMax, &f.CoverImage, &f.Description,
		&f.Requirements, &f.CareerPath, &f.Version, &f.Collaborators, &f.BatchID, &f.TenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	f.PositionType = string(posType)
	return &f, nil
}

// ClonePosition 在事务内克隆岗位及全部关联（专业/职责/能力绑定/能力域/证书）。
// 返回新岗位 ID。
func (s *PositionCloneStore) ClonePosition(ctx context.Context, tx Queryer, tenantID, oldPositionID, newName string, src *PositionSourceFields, createdBy string, code string) (string, error) {
	newID := uuid.NewString()
	_, err := tx.Exec(ctx, `
		INSERT INTO career_positions (`+PositionInsertColumns+`)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft', $16, $17)
	`, newID, tenantID, code, src.BatchID, newName, src.ShortName, src.IndustryID, src.PositionType,
		src.SalaryMin, src.SalaryMax, src.CoverImage, src.Description, src.Requirements,
		src.CareerPath, src.Version, createdBy, src.Collaborators)
	if err != nil {
		return "", err
	}

	if err := s.cloneMajors(ctx, tx, oldPositionID, newID); err != nil {
		return "", err
	}

	respIDMap := make(map[string]string)
	if err := s.cloneResponsibilities(ctx, tx, oldPositionID, newID, tenantID, respIDMap); err != nil {
		return "", err
	}

	bindingIDMap := make(map[string]string)
	if err := s.cloneAbilityBindings(ctx, tx, oldPositionID, newID, tenantID, respIDMap, bindingIDMap); err != nil {
		return "", err
	}

	if err := s.cloneAbilityDomains(ctx, tx, oldPositionID, newID, tenantID, bindingIDMap); err != nil {
		return "", err
	}

	if err := s.cloneCertificates(ctx, tx, oldPositionID, newID, tenantID); err != nil {
		return "", err
	}

	return newID, nil
}

func (s *PositionCloneStore) cloneMajors(ctx context.Context, tx Queryer, oldPositionID, newPositionID string) error {
	rows, err := tx.Query(ctx, `
		SELECT major_id FROM career_position_majors WHERE career_position_id = $1
	`, oldPositionID)
	if err != nil {
		return err
	}
	defer rows.Close()
	var majors []string
	for rows.Next() {
		var majorID string
		if err := rows.Scan(&majorID); err != nil {
			return err
		}
		majors = append(majors, majorID)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, majorID := range majors {
		if _, err := tx.Exec(ctx, `
			INSERT INTO career_position_majors (career_position_id, major_id) VALUES ($1, $2)
		`, newPositionID, majorID); err != nil {
			return err
		}
	}
	return nil
}

func (s *PositionCloneStore) cloneResponsibilities(ctx context.Context, tx Queryer, oldPositionID, newPositionID, tenantID string, respIDMap map[string]string) error {
	rows, err := tx.Query(ctx, `
		SELECT id, name, description, sort_order FROM position_responsibilities
		WHERE career_position_id = $1 ORDER BY sort_order
	`, oldPositionID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type respRow struct {
		OldID       string
		Name        string
		Description *string
		SortOrder   int
	}
	var items []respRow
	for rows.Next() {
		var rr respRow
		if err := rows.Scan(&rr.OldID, &rr.Name, &rr.Description, &rr.SortOrder); err != nil {
			return err
		}
		items = append(items, rr)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, rr := range items {
		newRespID := uuid.NewString()
		respIDMap[rr.OldID] = newRespID
		if _, err := tx.Exec(ctx, `
			INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, description, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, newRespID, tenantID, newPositionID, rr.Name, rr.Description, rr.SortOrder); err != nil {
			return err
		}
	}
	return nil
}

func (s *PositionCloneStore) cloneAbilityBindings(ctx context.Context, tx Queryer, oldPositionID, newPositionID, tenantID string, respIDMap, bindingIDMap map[string]string) error {
	rows, err := tx.Query(ctx, `
		SELECT id, responsibility_id, ability_point_id, source, domain, required_level, rubric_description, attributes, weight
		FROM position_ability_bindings WHERE career_position_id = $1
	`, oldPositionID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type bindingRow struct {
		oldBindingID, oldRespID, abilityPointID, source string
		domain, requiredLevel                           *string
		rubricDescription                               *string
		attributes                                      []string
		weight                                          float64
	}
	var bindings []bindingRow
	for rows.Next() {
		var br bindingRow
		if err := rows.Scan(&br.oldBindingID, &br.oldRespID, &br.abilityPointID, &br.source,
			&br.domain, &br.requiredLevel, &br.rubricDescription, &br.attributes, &br.weight); err != nil {
			return err
		}
		bindings = append(bindings, br)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, br := range bindings {
		newRespID, ok := respIDMap[br.oldRespID]
		if !ok {
			continue
		}
		newBindingID := uuid.NewString()
		bindingIDMap[br.oldBindingID] = newBindingID
		if _, err := tx.Exec(ctx, `
			INSERT INTO position_ability_bindings (
				id, tenant_id, career_position_id, responsibility_id, ability_point_id, source,
				domain, required_level, rubric_description, attributes, weight
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, newBindingID, tenantID, newPositionID, newRespID, br.abilityPointID, br.source,
			br.domain, br.requiredLevel, br.rubricDescription, br.attributes, br.weight); err != nil {
			return err
		}
	}
	return nil
}

func (s *PositionCloneStore) cloneAbilityDomains(ctx context.Context, tx Queryer, oldPositionID, newPositionID, tenantID string, bindingIDMap map[string]string) error {
	rows, err := tx.Query(ctx, `
		SELECT name, description, binding_ids, sort_order
		FROM ability_domains WHERE career_position_id = $1 ORDER BY sort_order
	`, oldPositionID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type domainRow struct {
		name          string
		description   *string
		oldBindingIDs []string
		sortOrder     int
	}
	var domains []domainRow
	for rows.Next() {
		var dr domainRow
		if err := rows.Scan(&dr.name, &dr.description, &dr.oldBindingIDs, &dr.sortOrder); err != nil {
			return err
		}
		domains = append(domains, dr)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, dr := range domains {
		newBindingIDs := make([]string, 0, len(dr.oldBindingIDs))
		for _, oldID := range dr.oldBindingIDs {
			if newID, ok := bindingIDMap[oldID]; ok {
				newBindingIDs = append(newBindingIDs, newID)
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ability_domains (id, tenant_id, career_position_id, name, description, binding_ids, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.NewString(), tenantID, newPositionID, dr.name, dr.description, newBindingIDs, dr.sortOrder); err != nil {
			return err
		}
	}
	return nil
}

func (s *PositionCloneStore) cloneCertificates(ctx context.Context, tx Queryer, oldPositionID, newPositionID, tenantID string) error {
	rows, err := tx.Query(ctx, `
		SELECT certificate_library_id FROM position_certificates WHERE career_position_id = $1
	`, oldPositionID)
	if err != nil {
		return err
	}
	defer rows.Close()
	var libIDs []string
	for rows.Next() {
		var libID string
		if err := rows.Scan(&libID); err != nil {
			return err
		}
		libIDs = append(libIDs, libID)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, libID := range libIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)
			VALUES ($1, $2, $3, $4)
		`, uuid.NewString(), tenantID, newPositionID, libID); err != nil {
			return err
		}
	}
	return nil
}

// FetchPosition 查询完整岗位（含专业/计数/协作者名称）。
func (s *PositionCloneStore) FetchPosition(ctx context.Context, id string) (domain.CareerPosition, error) {
	var p domain.CareerPosition
	var batchID, shortName, industryID, coverImage, description, careerPath *string
	var salaryMin, salaryMax *int
	var majorIDs, majorNames, requirements, collaborators []string

	err := s.q.QueryRow(ctx, `
		SELECT cp.id, cp.batch_id, cp.code, cp.name, cp.short_name, cp.industry_id,
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
		&p.ID, &batchID, &p.Code, &p.Name, &shortName, &industryID, &majorIDs, &majorNames, &p.PositionType,
		&salaryMin, &salaryMax, &coverImage, &description, &requirements, &careerPath,
		&p.Version, &p.Status, &p.CreatedBy, &p.CreatedByName, &collaborators, &p.CollaboratorNames, &p.FavoriteCount, &p.ViewCount,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return p, err
	}
	p.BatchID = batchID
	p.ShortName = shortName
	p.IndustryID = industryID
	p.SalaryMin = salaryMin
	p.SalaryMax = salaryMax
	p.CoverImage = coverImage
	p.Description = description
	p.Requirements = requirements
	p.CareerPath = careerPath
	p.MajorIDs = majorIDs
	p.MajorNames = majorNames
	p.Collaborators = collaborators
	return p, nil
}

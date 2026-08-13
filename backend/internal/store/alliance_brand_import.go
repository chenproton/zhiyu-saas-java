package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 品牌批量导入 store 方法（SQL 唯一所在地，handler 层不拼 SQL） =====

// LookupUserIDByNameWithRole 按租户+姓名+业务角色匹配用户 ID（user_roles/roles.code），
// 多个同名取第一个，未命中返回空字符串。
func LookupUserIDByNameWithRole(ctx context.Context, q Queryer, tenantID, name, roleCode string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		SELECT u.id FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.tenant_id = $1 AND u.name = $2 AND r.code = $3
		LIMIT 1
	`, tenantID, name, roleCode).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// LookupTeachingPositionIDByName 按租户+名称匹配教学岗位（position_type='teaching'）。
func LookupTeachingPositionIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		SELECT id FROM career_positions
		WHERE tenant_id = $1 AND name = $2 AND position_type = 'teaching'
		LIMIT 1
	`, tenantID, name).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// LookupJobBrandIDByName 按租户+名称匹配岗位品牌。
func LookupJobBrandIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		SELECT id FROM alliance_brands
		WHERE tenant_id = $1 AND brand_type = 'job' AND name = $2
		LIMIT 1
	`, tenantID, name).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// LookupAchievementIDByTitle 按租户+标题匹配合作成果。
func LookupAchievementIDByTitle(ctx context.Context, q Queryer, tenantID, title string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		SELECT id FROM alliance_achievements
		WHERE tenant_id = $1 AND title = $2
		LIMIT 1
	`, tenantID, title).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// LookupCourseIDByName 按租户+名称匹配课程。
func LookupCourseIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		SELECT id FROM courses
		WHERE tenant_id = $1 AND name = $2
		LIMIT 1
	`, tenantID, name).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// LookupIndependentEmployerBrandIDByName 按租户+名称匹配独立雇主品牌（未引用合作企业库）。
func LookupIndependentEmployerBrandIDByName(ctx context.Context, q Queryer, tenantID, name string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		SELECT id FROM alliance_brands
		WHERE tenant_id = $1 AND brand_type = 'employer' AND enterprise_id IS NULL AND name = $2
		LIMIT 1
	`, tenantID, name).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// GetBrandByName 按租户+类型+名称查询品牌 ID（不存在返回空字符串）。
func (s *AllianceStore) GetBrandByName(ctx context.Context, tenantID, brandType, name string) (string, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		SELECT id FROM alliance_brands
		WHERE tenant_id = $1 AND brand_type = $2 AND name = $3
		LIMIT 1
	`, tenantID, brandType, name).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// ListAllMajors 模板预填用：租户全部专业（按名称排序）。
func (s *Store) ListAllMajors(ctx context.Context, tenantID string) ([]domain.Major, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, code, name, alias, enabled, created_at, updated_at
		FROM majors WHERE tenant_id = $1 ORDER BY name
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.Major, 0)
	for rows.Next() {
		var m domain.Major
		if err := rows.Scan(&m.ID, &m.TenantID, &m.Code, &m.Name, &m.Alias, &m.Enabled,
			&m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

// ImportEnterprisePositionParams 导入企业岗位参数（职责/证书能力建模留空）。
type ImportEnterprisePositionParams struct {
	Name             string
	SalaryMin        *int
	SalaryMax        *int
	IndustryID       *string
	CoverImage       *string
	Description      *string
	Requirements     []string
	CareerPath       *string
	MajorIDs         []string
	Responsibilities []ImportPositionResponsibility
}

// ImportPositionResponsibility 导入岗位职责项。
type ImportPositionResponsibility struct {
	Name        string
	Description *string
}

// ImportSaveEnterprisePosition 导入保存企业岗位：positionID 为空时先创建草稿岗位，
// 再 SaveFull 全量保存（同事务），与页面「新增独立岗位」流程一致；
// positionID 非空时仅 SaveFull 更新（覆盖导入同名校牌时复用已有岗位）。
func (s *Store) ImportSaveEnterprisePosition(ctx context.Context, tenantID, userID, positionID string, p *ImportEnterprisePositionParams) (string, error) {
	requirements := p.Requirements
	if requirements == nil {
		requirements = []string{}
	}
	collaborators := []string{}
	err := s.WithTx(ctx, func(txStore *Store) error {
		if positionID == "" {
			code, err := GenerateUniqueEntityCode(ctx, txStore.Q(), "GW", "career_positions", tenantID)
			if err != nil {
				return err
			}
			pos, err := txStore.Positions().Create(ctx, txStore.Q(), tenantID, &PositionCreateParams{
				Code:          code,
				Name:          p.Name,
				IndustryID:    p.IndustryID,
				PositionType:  "enterprise",
				SalaryMin:     p.SalaryMin,
				SalaryMax:     p.SalaryMax,
				CoverImage:    p.CoverImage,
				Description:   p.Description,
				Requirements:  requirements,
				CareerPath:    p.CareerPath,
				Version:       "V1.0",
				Status:        domain.CareerPositionStatusDraft,
				CreatedBy:     userID,
				Collaborators: collaborators,
				MajorIDs:      p.MajorIDs,
			})
			if err != nil {
				return err
			}
			positionID = pos.ID
		}
		responsibilities := make([]FullPositionResponsibilityItem, 0, len(p.Responsibilities))
		for i, r := range p.Responsibilities {
			responsibilities = append(responsibilities, FullPositionResponsibilityItem{
				ID:          fmt.Sprintf("imp-%d", i),
				Name:        r.Name,
				Description: r.Description,
			})
		}
		salaryMin, salaryMax := 0, 0
		if p.SalaryMin != nil {
			salaryMin = *p.SalaryMin
		}
		if p.SalaryMax != nil {
			salaryMax = *p.SalaryMax
		}
		return txStore.Positions().SaveFull(ctx, txStore.Q(), tenantID, positionID,
			&FullPositionSaveParams{
				Name:             p.Name,
				IndustryID:       p.IndustryID,
				PositionType:     "enterprise",
				SalaryRange:      [2]int{salaryMin, salaryMax},
				CoverImage:       p.CoverImage,
				Description:      p.Description,
				Requirements:     requirements,
				CareerPath:       p.CareerPath,
				Version:          "V1.0",
				CreatorID:        userID,
				Collaborators:    collaborators,
				Majors:           p.MajorIDs,
				Responsibilities: responsibilities,
			}, nil, nil)
	})
	return positionID, err
}

// UpsertTeacherExpertProfile 校本师资导入：按教师 user_id 查找专家档案，
// 存在则仅更新导入提供的字段（nil 字段保留原值），不存在则创建新档案。
func (s *AllianceStore) UpsertTeacherExpertProfile(ctx context.Context, tenantID string, e *domain.AllianceExpert) (string, error) {
	existing, err := s.GetExpertByUserID(ctx, tenantID, *e.UserID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if existing == nil {
		id, err := s.CreateExpert(ctx, e)
		if err != nil {
			return "", err
		}
		return id, nil
	}
	_, err = s.q.Exec(ctx, `
		UPDATE alliance_experts SET
			name = COALESCE($1, name),
			gender = COALESCE($2, gender),
			age = COALESCE($3, age),
			title = COALESCE($4, title),
			position = COALESCE($5, position),
			industry = COALESCE($6, industry),
			specialties = COALESCE($7, specialties),
			experience_years = COALESCE($8, experience_years),
			education = COALESCE($9, education),
			introduction = COALESCE($10, introduction),
			work_experience = COALESCE($11, work_experience),
			city = COALESCE($12, city),
			avatar_url = COALESCE($13, avatar_url),
			updated_at = NOW()
		WHERE id = $14 AND tenant_id = $15
	`, e.Name, e.Gender, e.Age, e.Title, e.Position, e.Industry,
		rawJSONOrNil(e.Specialties), e.ExperienceYears, e.Education,
		e.Introduction, e.WorkExperience, e.City, e.AvatarURL, existing.ID, tenantID)
	if err != nil {
		return "", err
	}
	return existing.ID, nil
}

// rawJSONOrNil json.RawMessage 为空时返回 nil（配合 COALESCE 保留原值）。
func rawJSONOrNil(raw json.RawMessage) interface{} {
	if len(raw) == 0 {
		return nil
	}
	return raw
}

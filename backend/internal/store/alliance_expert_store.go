package store

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 专家 =====

func (s *AllianceStore) ScanExpertRows(rows pgx.Rows) ([]domain.AllianceExpert, error) {
	items := make([]domain.AllianceExpert, 0)
	for rows.Next() {
		var e domain.AllianceExpert
		var gender, ttl, pos, etype, industry, edu, intro, workExp, city, avatar *string
		var age, expYrs *int
		var proFields, specs, photos, attachs json.RawMessage
		var rating, enterpriseID, coverImage, partnerSource, positionDirection, organization *string
		var colleges json.RawMessage
		var createdBy *string
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &gender, &age, &ttl, &pos,
			&etype, &industry, &proFields, &specs, &expYrs, &edu, &intro, &workExp,
			&city, &avatar, &coverImage, &photos, &attachs, &enterpriseID, &organization, &rating,
			&e.Status, &partnerSource, &positionDirection, &colleges, &e.IsPublic, &createdBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		e.Gender = gender
		e.Age = age
		e.Title = ttl
		e.Position = pos
		e.ExpertType = etype
		e.Industry = industry
		e.ProfessionalFields = proFields
		e.Specialties = specs
		e.ExperienceYears = expYrs
		e.Education = edu
		e.Introduction = intro
		e.WorkExperience = workExp
		e.City = city
		e.AvatarURL = avatar
		e.CoverImage = coverImage
		e.Photos = photos
		e.Attachments = attachs
		e.EnterpriseID = enterpriseID
		e.Organization = organization
		e.Rating = rating
		e.PartnerSource = partnerSource
		e.PositionDirection = positionDirection
		e.SecondaryColleges = colleges
		e.CreatedBy = createdBy
		items = append(items, e)
	}
	return items, rows.Err()
}

// ListConfig 返回专家列表查询配置，SQL 片段沉淀在 store 层。
func (s *AllianceStore) ListExpertsConfig() ListQueryConfig[domain.AllianceExpert] {
	return ListQueryConfig[domain.AllianceExpert]{
		Table:         "alliance_experts",
		SelectColumns: "id, tenant_id, name, gender, age, title, position, expert_type, industry, professional_fields, specialties, experience_years, education, introduction, work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating, status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "title", "industry"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: s.ScanExpertRows,
	}
}

func (s *AllianceStore) CreateExpert(ctx context.Context, e *domain.AllianceExpert) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_experts (id, tenant_id, name, gender, age, title, position,
			expert_type, industry, professional_fields, specialties, experience_years,
			education, introduction, work_experience, city, avatar_url, cover_image, photos, attachments,
			enterprise_id, organization, rating, status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,NOW(),NOW())
	`, id, e.TenantID, e.Name, e.Gender, e.Age, e.Title, e.Position, e.ExpertType,
		e.Industry, emptyJSON(e.ProfessionalFields), emptyJSON(e.Specialties), e.ExperienceYears,
		e.Education, e.Introduction, e.WorkExperience, e.City, e.AvatarURL, e.CoverImage,
		emptyJSON(e.Photos), emptyJSON(e.Attachments), e.EnterpriseID, e.Organization, e.Rating,
		e.Status, e.PartnerSource, e.PositionDirection, emptyJSON(e.SecondaryColleges), e.IsPublic, e.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateExpert(ctx context.Context, id, tenantID string, e *domain.AllianceExpert) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_experts SET
			name = $1, gender = $2, age = $3, title = $4, position = $5, expert_type = $6,
			industry = $7, professional_fields = $8, specialties = $9, experience_years = $10,
			education = $11, introduction = $12, work_experience = $13, city = $14, avatar_url = $15,
			cover_image = $16, photos = $17, attachments = $18, enterprise_id = $19, organization = $20, rating = $21,
			status = $22, partner_source = $23, position_direction = $24,
			secondary_colleges = $25, is_public = $26, updated_at = NOW()
		WHERE id = $27 AND tenant_id = $28
	`, e.Name, e.Gender, e.Age, e.Title, e.Position, e.ExpertType, e.Industry,
		emptyJSON(e.ProfessionalFields), emptyJSON(e.Specialties), e.ExperienceYears,
		e.Education, e.Introduction, e.WorkExperience, e.City, e.AvatarURL, e.CoverImage,
		emptyJSON(e.Photos), emptyJSON(e.Attachments), e.EnterpriseID, e.Organization, e.Rating,
		e.Status, e.PartnerSource, e.PositionDirection, emptyJSON(e.SecondaryColleges), e.IsPublic, id, tenantID)
	return err
}

func (s *AllianceStore) DeleteExpert(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_experts WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (s *AllianceStore) GetExpertByID(ctx context.Context, id, tenantID string) (*domain.AllianceExpert, error) {
	var e domain.AllianceExpert
	var gender, ttl, pos, etype, industry, edu, intro, workExp, city, avatar *string
	var age, expYrs *int
	var proFields, specs, photos, attachs json.RawMessage
	var rating, enterpriseID, coverImage, partnerSource, positionDirection, organization *string
	var colleges json.RawMessage
	var createdBy *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, gender, age, title, position, expert_type, industry,
			professional_fields, specialties, experience_years, education, introduction,
			work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating,
			status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_experts WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&e.ID, &e.TenantID, &e.Name, &gender, &age, &ttl, &pos,
		&etype, &industry, &proFields, &specs, &expYrs, &edu, &intro, &workExp,
		&city, &avatar, &coverImage, &photos, &attachs, &enterpriseID, &organization, &rating,
		&e.Status, &partnerSource, &positionDirection, &colleges, &e.IsPublic, &createdBy, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, err
	}
	e.Gender = gender
	e.Age = age
	e.Title = ttl
	e.Position = pos
	e.ExpertType = etype
	e.Industry = industry
	e.ProfessionalFields = proFields
	e.Specialties = specs
	e.ExperienceYears = expYrs
	e.Education = edu
	e.Introduction = intro
	e.WorkExperience = workExp
	e.City = city
	e.AvatarURL = avatar
	e.CoverImage = coverImage
	e.Photos = photos
	e.Attachments = attachs
	e.EnterpriseID = enterpriseID
	e.Organization = organization
	e.Rating = rating
	e.PartnerSource = partnerSource
	e.PositionDirection = positionDirection
	e.SecondaryColleges = colleges
	e.CreatedBy = createdBy
	return &e, nil
}

func (s *AllianceStore) ListPublicExperts(ctx context.Context) ([]domain.AllianceExpert, error) {
	return queryList(ctx, s.q, s.ScanExpertRows, `
		SELECT id, tenant_id, name, gender, age, title, position, expert_type, industry,
			professional_fields, specialties, experience_years, education, introduction,
			work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating,
			status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_experts WHERE is_public = true AND status = 'active'
		ORDER BY created_at DESC LIMIT 100
	`)
}

func (s *AllianceStore) GetPublicExpertByID(ctx context.Context, id string) (*domain.AllianceExpert, error) {
	return queryOne(ctx, s.q, s.ScanExpertRows, `
		SELECT id, tenant_id, name, gender, age, title, position, expert_type, industry,
			professional_fields, specialties, experience_years, education, introduction,
			work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating,
			status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_experts WHERE id = $1 AND is_public = true AND status = 'active'
	`, id)
}

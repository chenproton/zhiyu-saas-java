package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 合作企业 =====

type AllianceEnterpriseCreateParams struct {
	TenantID                   string
	Name                       string
	EnterpriseType             string
	Industry                   *string
	Region                     *string
	Description                *string
	LogoURL                    *string
	CoverImage                 *string
	Status                     string
	Rating                     *string
	CooperationTypes           json.RawMessage
	ContactPerson              *string
	ContactPhone               *string
	ContactEmail               *string
	Address                    *string
	UnifiedSocialCreditCode    *string
	EstablishedYear            *int
	EmployeeCount              *int
	BusinessLicensePhotos      json.RawMessage
	QualificationPhotos        json.RawMessage
	IntellectualPropertyPhotos json.RawMessage
	CoverPhotos                json.RawMessage
	SecondaryColleges          json.RawMessage
	RatingRecord               json.RawMessage
	IsPublic                   bool
	CreatedBy                  *string
}

type AllianceEnterpriseUpdateParams struct {
	Name                       string
	EnterpriseType             string
	Industry                   *string
	Region                     *string
	Description                *string
	LogoURL                    *string
	CoverImage                 *string
	Status                     string
	Rating                     *string
	CooperationTypes           json.RawMessage
	ContactPerson              *string
	ContactPhone               *string
	ContactEmail               *string
	Address                    *string
	UnifiedSocialCreditCode    *string
	EstablishedYear            *int
	EmployeeCount              *int
	BusinessLicensePhotos      json.RawMessage
	QualificationPhotos        json.RawMessage
	IntellectualPropertyPhotos json.RawMessage
	CoverPhotos                json.RawMessage
	SecondaryColleges          json.RawMessage
	RatingRecord               json.RawMessage
	IsPublic                   bool
}

func emptyJSON(v json.RawMessage) json.RawMessage {
	if v == nil || len(v) == 0 {
		return json.RawMessage("[]")
	}
	return v
}

func (s *AllianceStore) ScanEnterpriseRows(rows pgx.Rows) ([]domain.AllianceEnterprise, error) {
	items := make([]domain.AllianceEnterprise, 0)
	for rows.Next() {
		var e domain.AllianceEnterprise
		var industry, region, description, logoURL, coverImage, rating *string
		var contactPerson, contactPhone, contactEmail, address, creditCode *string
		var establishedYear, employeeCount *int
		var coopTypes, bizPhotos, qualPhotos, ipPhotos, coverPhotos, colleges, ratingRecord json.RawMessage
		var createdBy *string
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &e.EnterpriseType, &industry, &region,
			&description, &logoURL, &coverImage, &e.Status, &rating, &coopTypes,
			&contactPerson, &contactPhone, &contactEmail, &address, &creditCode,
			&establishedYear, &employeeCount, &bizPhotos, &qualPhotos, &ipPhotos,
			&coverPhotos, &colleges, &ratingRecord, &e.IsPublic, &createdBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		e.Industry = industry
		e.Region = region
		e.Description = description
		e.LogoURL = logoURL
		e.CoverImage = coverImage
		e.Rating = rating
		e.CooperationTypes = coopTypes
		e.ContactPerson = contactPerson
		e.ContactPhone = contactPhone
		e.ContactEmail = contactEmail
		e.Address = address
		e.UnifiedSocialCreditCode = creditCode
		e.EstablishedYear = establishedYear
		e.EmployeeCount = employeeCount
		e.BusinessLicensePhotos = bizPhotos
		e.QualificationPhotos = qualPhotos
		e.IntellectualPropertyPhotos = ipPhotos
		e.CoverPhotos = coverPhotos
		e.SecondaryColleges = colleges
		e.RatingRecord = ratingRecord
		e.CreatedBy = createdBy
		items = append(items, e)
	}
	return items, rows.Err()
}

// ListConfig 返回合作企业列表查询配置，SQL 片段沉淀在 store 层。
func (s *AllianceStore) ListEnterprisesConfig() ListQueryConfig[domain.AllianceEnterprise] {
	return ListQueryConfig[domain.AllianceEnterprise]{
		Table: "alliance_enterprises",
		SelectColumns: "id, tenant_id, name, enterprise_type, industry, region, description, " +
			"logo_url, cover_image, status, rating, cooperation_types, contact_person, " +
			"contact_phone, contact_email, address, unified_social_credit_code, " +
			"established_year, employee_count, business_license_photos, qualification_photos, " +
			"intellectual_property_photos, cover_photos, secondary_colleges, rating_record, " +
			"is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "industry"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if rating := p.Values["rating"]; rating != "" {
				qb.AddCondition("rating = " + qb.NextArg(rating))
			}
		},
		ScanRows: s.ScanEnterpriseRows,
	}
}

func (s *AllianceStore) GetEnterpriseByID(ctx context.Context, id, tenantID string) (*domain.AllianceEnterprise, error) {
	var e domain.AllianceEnterprise
	var industry, region, description, logoURL, coverImage, rating *string
	var contactPerson, contactPhone, contactEmail, address, creditCode *string
	var establishedYear, employeeCount *int
	var coopTypes, bizPhotos, qualPhotos, ipPhotos, coverPhotos, colleges, ratingRecord json.RawMessage
	var createdBy *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, enterprise_type, industry, region, description,
			logo_url, cover_image, status, rating, cooperation_types, contact_person,
			contact_phone, contact_email, address, unified_social_credit_code,
			established_year, employee_count, business_license_photos, qualification_photos,
			intellectual_property_photos, cover_photos, secondary_colleges, rating_record,
			is_public, created_by, created_at, updated_at
		FROM alliance_enterprises WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&e.ID, &e.TenantID, &e.Name, &e.EnterpriseType, &industry, &region,
		&description, &logoURL, &coverImage, &e.Status, &rating, &coopTypes,
		&contactPerson, &contactPhone, &contactEmail, &address, &creditCode,
		&establishedYear, &employeeCount, &bizPhotos, &qualPhotos, &ipPhotos,
		&coverPhotos, &colleges, &ratingRecord, &e.IsPublic, &createdBy, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, err
	}
	e.Industry = industry
	e.Region = region
	e.Description = description
	e.LogoURL = logoURL
	e.CoverImage = coverImage
	e.Rating = rating
	e.CooperationTypes = coopTypes
	e.ContactPerson = contactPerson
	e.ContactPhone = contactPhone
	e.ContactEmail = contactEmail
	e.Address = address
	e.UnifiedSocialCreditCode = creditCode
	e.EstablishedYear = establishedYear
	e.EmployeeCount = employeeCount
	e.BusinessLicensePhotos = bizPhotos
	e.QualificationPhotos = qualPhotos
	e.IntellectualPropertyPhotos = ipPhotos
	e.CoverPhotos = coverPhotos
	e.SecondaryColleges = colleges
	e.RatingRecord = ratingRecord
	e.CreatedBy = createdBy
	return &e, nil
}

func (s *AllianceStore) CreateEnterprise(ctx context.Context, p *AllianceEnterpriseCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_enterprises (id, tenant_id, name, enterprise_type, industry, region,
			description, logo_url, cover_image, status, rating, cooperation_types, contact_person,
			contact_phone, contact_email, address, unified_social_credit_code, established_year,
			employee_count, business_license_photos, qualification_photos, intellectual_property_photos,
			cover_photos, secondary_colleges, rating_record, is_public, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,NOW(),NOW())
	`, id, p.TenantID, p.Name, p.EnterpriseType, p.Industry, p.Region, p.Description, p.LogoURL,
		p.CoverImage, p.Status, p.Rating, emptyJSON(p.CooperationTypes), p.ContactPerson,
		p.ContactPhone, p.ContactEmail, p.Address, p.UnifiedSocialCreditCode, p.EstablishedYear,
		p.EmployeeCount, emptyJSON(p.BusinessLicensePhotos), emptyJSON(p.QualificationPhotos),
		emptyJSON(p.IntellectualPropertyPhotos), emptyJSON(p.CoverPhotos), emptyJSON(p.SecondaryColleges),
		p.RatingRecord, p.IsPublic, p.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateEnterprise(ctx context.Context, id string, p *AllianceEnterpriseUpdateParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_enterprises SET
			name = $1, enterprise_type = $2, industry = $3, region = $4, description = $5,
			logo_url = $6, cover_image = $7, status = $8, rating = $9, cooperation_types = $10,
			contact_person = $11, contact_phone = $12, contact_email = $13, address = $14,
			unified_social_credit_code = $15, established_year = $16, employee_count = $17,
			business_license_photos = $18, qualification_photos = $19, intellectual_property_photos = $20,
			cover_photos = $21, secondary_colleges = $22, rating_record = $23, is_public = $24,
			updated_at = NOW()
		WHERE id = $25
	`, p.Name, p.EnterpriseType, p.Industry, p.Region, p.Description, p.LogoURL, p.CoverImage,
		p.Status, p.Rating, emptyJSON(p.CooperationTypes), p.ContactPerson, p.ContactPhone,
		p.ContactEmail, p.Address, p.UnifiedSocialCreditCode, p.EstablishedYear, p.EmployeeCount,
		emptyJSON(p.BusinessLicensePhotos), emptyJSON(p.QualificationPhotos), emptyJSON(p.IntellectualPropertyPhotos),
		emptyJSON(p.CoverPhotos), emptyJSON(p.SecondaryColleges), p.RatingRecord, p.IsPublic, id)
	return err
}

func (s *AllianceStore) DeleteEnterprise(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_enterprises WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ===== 企业合作协议 =====

type AllianceEnterpriseAgreementCreateParams struct {
	TenantID     string
	EnterpriseID string
	Name         string
	Type         *string
	StartDate    *string
	EndDate      *string
	Status       string
	Content      *string
	Attachments  json.RawMessage
}

type AllianceEnterpriseAgreementUpdateParams struct {
	Name        string
	Type        *string
	StartDate   *string
	EndDate     *string
	Status      string
	Content     *string
	Attachments json.RawMessage
}

func (s *AllianceStore) ScanEnterpriseAgreementRows(rows pgx.Rows) ([]domain.AllianceEnterpriseAgreement, error) {
	items := make([]domain.AllianceEnterpriseAgreement, 0)
	for rows.Next() {
		var a domain.AllianceEnterpriseAgreement
		var typ, content *string
		var startDate, endDate *time.Time
		var attachments json.RawMessage
		if err := rows.Scan(&a.ID, &a.TenantID, &a.EnterpriseID, &a.Name, &typ, &startDate,
			&endDate, &a.Status, &content, &attachments, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.Type = typ
		a.StartDate = formatDate(startDate)
		a.EndDate = formatDate(endDate)
		a.Content = content
		a.Attachments = attachments
		items = append(items, a)
	}
	return items, rows.Err()
}

func (s *AllianceStore) GetEnterpriseAgreementByID(ctx context.Context, id, tenantID string) (*domain.AllianceEnterpriseAgreement, error) {
	var a domain.AllianceEnterpriseAgreement
	var typ, content *string
	var startDate, endDate *time.Time
	var attachments json.RawMessage
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, enterprise_id, name, type, start_date, end_date, status,
			content, attachments, created_at, updated_at
		FROM alliance_enterprise_agreements WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&a.ID, &a.TenantID, &a.EnterpriseID, &a.Name, &typ, &startDate,
		&endDate, &a.Status, &content, &attachments, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	a.Type = typ
	a.StartDate = formatDate(startDate)
	a.EndDate = formatDate(endDate)
	a.Content = content
	a.Attachments = attachments
	return &a, nil
}

func (s *AllianceStore) CreateEnterpriseAgreement(ctx context.Context, p *AllianceEnterpriseAgreementCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_enterprise_agreements (id, tenant_id, enterprise_id, name, type,
			start_date, end_date, status, content, attachments, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
	`, id, p.TenantID, p.EnterpriseID, p.Name, p.Type, p.StartDate, p.EndDate, p.Status, p.Content, emptyJSON(p.Attachments))
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateEnterpriseAgreement(ctx context.Context, id string, p *AllianceEnterpriseAgreementUpdateParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_enterprise_agreements SET
			name = $1, type = $2, start_date = $3, end_date = $4, status = $5,
			content = $6, attachments = $7, updated_at = NOW()
		WHERE id = $8
	`, p.Name, p.Type, p.StartDate, p.EndDate, p.Status, p.Content, emptyJSON(p.Attachments), id)
	return err
}

func (s *AllianceStore) DeleteEnterpriseAgreement(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_enterprise_agreements WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ===== 公开查询（门户前台） =====

func (s *AllianceStore) ListPublicEnterprises(ctx context.Context) ([]domain.AllianceEnterprise, error) {
	return queryList(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT id, tenant_id, name, enterprise_type, industry, region, description, logo_url,
			cover_image, status, rating, cooperation_types, contact_person, contact_phone,
			contact_email, address, unified_social_credit_code, established_year, employee_count,
			business_license_photos, qualification_photos, intellectual_property_photos,
			cover_photos, secondary_colleges, rating_record, is_public, created_by, created_at, updated_at
		FROM alliance_enterprises WHERE is_public = true AND status = 'active'
		ORDER BY created_at DESC LIMIT 100
	`)
}

func (s *AllianceStore) GetPublicEnterpriseByID(ctx context.Context, id string) (*domain.AllianceEnterprise, error) {
	return queryOne(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT id, tenant_id, name, enterprise_type, industry, region, description,
			logo_url, cover_image, status, rating, cooperation_types, contact_person,
			contact_phone, contact_email, address, unified_social_credit_code,
			established_year, employee_count, business_license_photos, qualification_photos,
			intellectual_property_photos, cover_photos, secondary_colleges, rating_record,
			is_public, created_by, created_at, updated_at
		FROM alliance_enterprises WHERE id = $1 AND is_public = true AND status = 'active'
	`, id)
}

func (s *AllianceStore) GetPublicBrandByID(ctx context.Context, id string) (*domain.AllianceBrand, error) {
	return queryOne(ctx, s.q, s.ScanBrandRows, `
		SELECT id, tenant_id, brand_type, name, status, is_public, is_featured,
			cover_image, cover_video, description, data,
			student_id, enterprise_id, position_id, major_id, teacher_id, expert_id,
			sort_order, view_count, created_at, updated_at
		FROM alliance_brands WHERE id = $1 AND is_public = true AND status = 'published'
	`, id)
}

// AlliancePublicStats 门户前台公开统计数据。
type AlliancePublicStats struct {
	EnterpriseCount  int
	ProjectCount     int
	ExpertCount      int
	AchievementCount int
	BrandCount       int
}

func (s *AllianceStore) GetPublicStats(ctx context.Context) AlliancePublicStats {
	var st AlliancePublicStats
	s.q.QueryRow(ctx, `SELECT COUNT(*) FROM alliance_enterprises WHERE is_public = true AND status = 'active'`).Scan(&st.EnterpriseCount)
	s.q.QueryRow(ctx, `SELECT COUNT(*) FROM alliance_projects WHERE is_public = true AND publish_status = 'published'`).Scan(&st.ProjectCount)
	s.q.QueryRow(ctx, `SELECT COUNT(*) FROM alliance_experts WHERE is_public = true AND status = 'active'`).Scan(&st.ExpertCount)
	s.q.QueryRow(ctx, `SELECT COUNT(*) FROM alliance_achievements WHERE is_public = true AND status = 'published'`).Scan(&st.AchievementCount)
	s.q.QueryRow(ctx, `SELECT COUNT(*) FROM alliance_brands WHERE is_public = true AND status = 'published'`).Scan(&st.BrandCount)
	return st
}

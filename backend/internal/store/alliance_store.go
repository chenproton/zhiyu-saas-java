package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
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
	`, nilToEmpty(info.ID), info.TenantID, info.Name, info.ShortName, info.SchoolType, info.Province, info.City,
		info.Address, info.Website, info.ContactPhone, info.Description, info.LogoURL,
		info.ScaleData, info.SecondaryColleges)
	return err
}

func nilToEmpty(s string) string {
	return s
}

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
	return items, nil
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
	return items, nil
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

// ===== 合作项目 =====

func formatDate(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01-02")
	return &s
}

func (s *AllianceStore) ScanProjectRows(rows pgx.Rows) ([]domain.AllianceProject, error) {
	items := make([]domain.AllianceProject, 0)
	for rows.Next() {
		var p domain.AllianceProject
		var typ, description, budget, coverImage *string
		var startDate, endDate *time.Time
		var enterpriseIDs, agreementIDs, colleges json.RawMessage
		var createdBy *string
		if err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &typ, &description, &p.Phase,
			&p.PublishStatus, &startDate, &endDate, &budget, &coverImage,
			&enterpriseIDs, &agreementIDs, &colleges, &p.IsPublic, &createdBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.Type = typ
		p.Description = description
		p.StartDate = formatDate(startDate)
		p.EndDate = formatDate(endDate)
		p.Budget = budget
		p.CoverImage = coverImage
		p.EnterpriseIDs = enterpriseIDs
		p.AgreementIDs = agreementIDs
		p.SecondaryColleges = colleges
		p.CreatedBy = createdBy
		items = append(items, p)
	}
	return items, nil
}

func (s *AllianceStore) GetProjectByID(ctx context.Context, id, tenantID string) (*domain.AllianceProject, error) {
	var p domain.AllianceProject
	var typ, description, budget, coverImage *string
	var startDate, endDate *time.Time
	var enterpriseIDs, agreementIDs, colleges json.RawMessage
	var createdBy *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, type, description, phase, publish_status,
			start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges,
			is_public, created_by, created_at, updated_at
		FROM alliance_projects WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&p.ID, &p.TenantID, &p.Name, &typ, &description, &p.Phase,
		&p.PublishStatus, &startDate, &endDate, &budget, &coverImage,
		&enterpriseIDs, &agreementIDs, &colleges, &p.IsPublic, &createdBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	p.Type = typ
	p.Description = description
	p.StartDate = formatDate(startDate)
	p.EndDate = formatDate(endDate)
	p.Budget = budget
	p.CoverImage = coverImage
	p.EnterpriseIDs = enterpriseIDs
	p.AgreementIDs = agreementIDs
	p.SecondaryColleges = colleges
	p.CreatedBy = createdBy
	return &p, nil
}

func (s *AllianceStore) CreateProject(ctx context.Context, p *domain.AllianceProject) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_projects (id, tenant_id, name, type, description, phase, publish_status,
			start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges,
			is_public, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
	`, id, p.TenantID, p.Name, p.Type, p.Description, p.Phase, p.PublishStatus,
		p.StartDate, p.EndDate, p.Budget, p.CoverImage,
		emptyJSON(p.EnterpriseIDs), emptyJSON(p.AgreementIDs), emptyJSON(p.SecondaryColleges), p.IsPublic, p.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateProject(ctx context.Context, id string, p *domain.AllianceProject) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_projects SET
			name = $1, type = $2, description = $3, phase = $4, publish_status = $5,
			start_date = $6, end_date = $7, budget = $8, cover_image = $9, enterprise_ids = $10,
			agreement_ids = $11, secondary_colleges = $12, is_public = $13, updated_at = NOW()
		WHERE id = $14
	`, p.Name, p.Type, p.Description, p.Phase, p.PublishStatus,
		p.StartDate, p.EndDate, p.Budget, p.CoverImage,
		emptyJSON(p.EnterpriseIDs), emptyJSON(p.AgreementIDs), emptyJSON(p.SecondaryColleges), p.IsPublic, id)
	return err
}

func (s *AllianceStore) DeleteProject(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_projects WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ===== 里程碑 =====

func (s *AllianceStore) ScanMilestoneRows(rows pgx.Rows) ([]domain.AllianceProjectMilestone, error) {
	items := make([]domain.AllianceProjectMilestone, 0)
	for rows.Next() {
		var m domain.AllianceProjectMilestone
		var description *string
		var dueDate, completedDate *time.Time
		if err := rows.Scan(&m.ID, &m.TenantID, &m.ProjectID, &m.Name, &description,
			&dueDate, &completedDate, &m.IsCompleted, &m.SortOrder,
			&m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.Description = description
		m.DueDate = formatDate(dueDate)
		m.CompletedDate = formatDate(completedDate)
		items = append(items, m)
	}
	return items, nil
}

func (s *AllianceStore) CreateMilestone(ctx context.Context, m *domain.AllianceProjectMilestone) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_project_milestones (id, tenant_id, project_id, name, description,
			due_date, completed_date, is_completed, sort_order, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
	`, id, m.TenantID, m.ProjectID, m.Name, m.Description, m.DueDate,
		m.CompletedDate, m.IsCompleted, m.SortOrder)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateMilestone(ctx context.Context, id string, m *domain.AllianceProjectMilestone) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_project_milestones SET
			name = $1, description = $2, due_date = $3, completed_date = $4,
			is_completed = $5, sort_order = $6, updated_at = NOW()
		WHERE id = $7
	`, m.Name, m.Description, m.DueDate, m.CompletedDate, m.IsCompleted, m.SortOrder, id)
	return err
}

func (s *AllianceStore) DeleteMilestone(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_project_milestones WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ===== 合作成果 =====

func (s *AllianceStore) ScanAchievementRows(rows pgx.Rows) ([]domain.AllianceAchievement, error) {
	items := make([]domain.AllianceAchievement, 0)
	for rows.Next() {
		var a domain.AllianceAchievement
		var description, coverImage, citationReason *string
		var achievementDate *time.Time
		var attachments, images, ownerPersons, coBuilders, enterpriseIDs, projectIDs, relatedPositions, relatedScenes, relatedCourses, colleges json.RawMessage
		var createdBy *string
		if err := rows.Scan(&a.ID, &a.TenantID, &a.Title, &a.Type, &description, &achievementDate,
			&coverImage, &attachments, &citationReason, &images, &ownerPersons, &coBuilders,
			&enterpriseIDs, &projectIDs, &relatedPositions,
			&relatedScenes, &relatedCourses, &a.Status, &a.ViewCount, &colleges,
			&a.IsPublic, &createdBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.Description = description
		a.AchievementDate = formatDate(achievementDate)
		a.CoverImage = coverImage
		a.Attachments = attachments
		a.CitationReason = citationReason
		a.Images = images
		a.OwnerPersons = ownerPersons
		a.CoBuilders = coBuilders
		a.EnterpriseIDs = enterpriseIDs
		a.ProjectIDs = projectIDs
		a.RelatedPositions = relatedPositions
		a.RelatedScenes = relatedScenes
		a.RelatedCourses = relatedCourses
		a.SecondaryColleges = colleges
		a.CreatedBy = createdBy
		items = append(items, a)
	}
	return items, nil
}

func (s *AllianceStore) CreateAchievement(ctx context.Context, a *domain.AllianceAchievement) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_achievements (id, tenant_id, title, type, description, achievement_date,
			cover_image, attachments, citation_reason, images, owner_persons, co_builders,
			enterprise_ids, project_ids, related_positions, related_scenes,
			related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())
	`, id, a.TenantID, a.Title, a.Type, a.Description, a.AchievementDate, a.CoverImage,
		emptyJSON(a.Attachments), a.CitationReason, emptyJSON(a.Images), emptyJSON(a.OwnerPersons), emptyJSON(a.CoBuilders),
		emptyJSON(a.EnterpriseIDs), emptyJSON(a.ProjectIDs),
		emptyJSON(a.RelatedPositions), emptyJSON(a.RelatedScenes), emptyJSON(a.RelatedCourses),
		a.Status, a.ViewCount, emptyJSON(a.SecondaryColleges), a.IsPublic, a.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateAchievement(ctx context.Context, id string, a *domain.AllianceAchievement) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_achievements SET
			title = $1, type = $2, description = $3, achievement_date = $4, cover_image = $5,
			attachments = $6, citation_reason = $7, images = $8, owner_persons = $9, co_builders = $10,
			enterprise_ids = $11, project_ids = $12, related_positions = $13,
			related_scenes = $14, related_courses = $15, status = $16, view_count = $17,
			secondary_colleges = $18, is_public = $19, updated_at = NOW()
		WHERE id = $20
	`, a.Title, a.Type, a.Description, a.AchievementDate, a.CoverImage,
		emptyJSON(a.Attachments), a.CitationReason, emptyJSON(a.Images), emptyJSON(a.OwnerPersons), emptyJSON(a.CoBuilders),
		emptyJSON(a.EnterpriseIDs), emptyJSON(a.ProjectIDs),
		emptyJSON(a.RelatedPositions), emptyJSON(a.RelatedScenes), emptyJSON(a.RelatedCourses),
		a.Status, a.ViewCount, emptyJSON(a.SecondaryColleges), a.IsPublic, id)
	return err
}

func (s *AllianceStore) DeleteAchievement(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_achievements WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (s *AllianceStore) GetAchievementByID(ctx context.Context, id, tenantID string) (*domain.AllianceAchievement, error) {
	var a domain.AllianceAchievement
	var description, coverImage, citationReason *string
	var achievementDate *time.Time
	var attachments, images, ownerPersons, coBuilders, enterpriseIDs, projectIDs, relatedPositions, relatedScenes, relatedCourses, colleges json.RawMessage
	var createdBy *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, title, type, description, achievement_date, cover_image,
			attachments, citation_reason, images, owner_persons, co_builders,
			enterprise_ids, project_ids, related_positions, related_scenes,
			related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_achievements WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&a.ID, &a.TenantID, &a.Title, &a.Type, &description, &achievementDate,
		&coverImage, &attachments, &citationReason, &images, &ownerPersons, &coBuilders,
		&enterpriseIDs, &projectIDs, &relatedPositions,
		&relatedScenes, &relatedCourses, &a.Status, &a.ViewCount, &colleges,
		&a.IsPublic, &createdBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	a.Description = description
	a.AchievementDate = formatDate(achievementDate)
	a.CoverImage = coverImage
	a.Attachments = attachments
	a.CitationReason = citationReason
	a.Images = images
	a.OwnerPersons = ownerPersons
	a.CoBuilders = coBuilders
	a.EnterpriseIDs = enterpriseIDs
	a.ProjectIDs = projectIDs
	a.RelatedPositions = relatedPositions
	a.RelatedScenes = relatedScenes
	a.RelatedCourses = relatedCourses
	a.SecondaryColleges = colleges
	return &a, nil
}

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
	return items, nil
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

func (s *AllianceStore) UpdateExpert(ctx context.Context, id string, e *domain.AllianceExpert) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_experts SET
			name = $1, gender = $2, age = $3, title = $4, position = $5, expert_type = $6,
			industry = $7, professional_fields = $8, specialties = $9, experience_years = $10,
			education = $11, introduction = $12, work_experience = $13, city = $14, avatar_url = $15,
			cover_image = $16, photos = $17, attachments = $18, enterprise_id = $19, organization = $20, rating = $21,
			status = $22, partner_source = $23, position_direction = $24,
			secondary_colleges = $25, is_public = $26, updated_at = NOW()
		WHERE id = $27
	`, e.Name, e.Gender, e.Age, e.Title, e.Position, e.ExpertType, e.Industry,
		emptyJSON(e.ProfessionalFields), emptyJSON(e.Specialties), e.ExperienceYears,
		e.Education, e.Introduction, e.WorkExperience, e.City, e.AvatarURL, e.CoverImage,
		emptyJSON(e.Photos), emptyJSON(e.Attachments), e.EnterpriseID, e.Organization, e.Rating,
		e.Status, e.PartnerSource, e.PositionDirection, emptyJSON(e.SecondaryColleges), e.IsPublic, id)
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

// ===== 合作协议（独立） =====

func (s *AllianceStore) ScanAgreementRows(rows pgx.Rows) ([]domain.AllianceAgreement, error) {
	items := make([]domain.AllianceAgreement, 0)
	for rows.Next() {
		var a domain.AllianceAgreement
		var typ, content *string
		var startDate, endDate *time.Time
		var enterpriseIDs, projectIDs, attachments json.RawMessage
		var createdBy *string
		if err := rows.Scan(&a.ID, &a.TenantID, &a.Name, &typ, &content, &startDate,
			&endDate, &a.Status, &enterpriseIDs, &projectIDs, &attachments,
			&createdBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.Type = typ
		a.Content = content
		a.StartDate = formatDate(startDate)
		a.EndDate = formatDate(endDate)
		a.EnterpriseIDs = enterpriseIDs
		a.ProjectIDs = projectIDs
		a.Attachments = attachments
		a.CreatedBy = createdBy
		items = append(items, a)
	}
	return items, nil
}

func (s *AllianceStore) CreateAgreement(ctx context.Context, a *domain.AllianceAgreement) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_agreements (id, tenant_id, name, type, content, start_date,
			end_date, status, enterprise_ids, project_ids, attachments, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
	`, id, a.TenantID, a.Name, a.Type, a.Content, a.StartDate, a.EndDate,
		a.Status, emptyJSON(a.EnterpriseIDs), emptyJSON(a.ProjectIDs), emptyJSON(a.Attachments), a.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateAgreement(ctx context.Context, id string, a *domain.AllianceAgreement) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_agreements SET
			name = $1, type = $2, content = $3, start_date = $4, end_date = $5,
			status = $6, enterprise_ids = $7, project_ids = $8, attachments = $9, updated_at = NOW()
		WHERE id = $10
	`, a.Name, a.Type, a.Content, a.StartDate, a.EndDate, a.Status,
		emptyJSON(a.EnterpriseIDs), emptyJSON(a.ProjectIDs), emptyJSON(a.Attachments), id)
	return err
}

func (s *AllianceStore) DeleteAgreement(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_agreements WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (s *AllianceStore) GetAgreementByID(ctx context.Context, id, tenantID string) (*domain.AllianceAgreement, error) {
	var a domain.AllianceAgreement
	var typ, content *string
	var startDate, endDate *time.Time
	var enterpriseIDs, projectIDs, attachments json.RawMessage
	var createdBy *string
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, name, type, content, start_date, end_date, status,
			enterprise_ids, project_ids, attachments, created_by, created_at, updated_at
		FROM alliance_agreements WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&a.ID, &a.TenantID, &a.Name, &typ, &content, &startDate,
		&endDate, &a.Status, &enterpriseIDs, &projectIDs, &attachments, &createdBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	a.Type = typ
	a.Content = content
	a.StartDate = formatDate(startDate)
	a.EndDate = formatDate(endDate)
	a.EnterpriseIDs = enterpriseIDs
	a.ProjectIDs = projectIDs
	a.Attachments = attachments
	a.CreatedBy = createdBy
	return &a, nil
}

// ===== 权限 =====

func (s *AllianceStore) ScanPermissionRows(rows pgx.Rows) ([]domain.AlliancePermission, error) {
	items := make([]domain.AlliancePermission, 0)
	for rows.Next() {
		var p domain.AlliancePermission
		var enterpriseID, expertID *string
		var resourcePerms, platformPerms json.RawMessage
		if err := rows.Scan(&p.ID, &p.TenantID, &p.AccountName, &p.AccountType,
			&enterpriseID, &expertID, &p.IsEnabled, &resourcePerms, &platformPerms,
			&p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.EnterpriseID = enterpriseID
		p.ExpertID = expertID
		p.ResourcePermissions = resourcePerms
		p.PlatformPermissions = platformPerms
		items = append(items, p)
	}
	return items, nil
}

func (s *AllianceStore) CreatePermission(ctx context.Context, p *domain.AlliancePermission) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_permissions (id, tenant_id, account_name, account_type,
			enterprise_id, expert_id, is_enabled, resource_permissions, platform_permissions,
			created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
	`, id, p.TenantID, p.AccountName, p.AccountType, p.EnterpriseID, p.ExpertID,
		p.IsEnabled, emptyJSON(p.ResourcePermissions), emptyJSON(p.PlatformPermissions))
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdatePermission(ctx context.Context, id string, p *domain.AlliancePermission) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_permissions SET
			account_name = $1, account_type = $2, enterprise_id = $3, expert_id = $4,
			is_enabled = $5, resource_permissions = $6, platform_permissions = $7, updated_at = NOW()
		WHERE id = $8
	`, p.AccountName, p.AccountType, p.EnterpriseID, p.ExpertID,
		p.IsEnabled, emptyJSON(p.ResourcePermissions), emptyJSON(p.PlatformPermissions), id)
	return err
}

func (s *AllianceStore) DeletePermission(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_permissions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

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

func (s *AllianceStore) UpdateDictionary(ctx context.Context, id string, d *domain.AllianceDictionary) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_dictionaries SET name = $1, sort_order = $2 WHERE id = $3
	`, d.Name, d.SortOrder, id)
	return err
}

func (s *AllianceStore) DeleteDictionary(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_dictionaries WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ===== 品牌 =====

func (s *AllianceStore) ScanBrandRows(rows pgx.Rows) ([]domain.AllianceBrand, error) {
	items := make([]domain.AllianceBrand, 0)
	for rows.Next() {
		var b domain.AllianceBrand
		var coverImage, coverVideo, description *string
		var studentID, enterpriseID, positionID, majorID, teacherID, expertID *string
		var data json.RawMessage
		if err := rows.Scan(&b.ID, &b.TenantID, &b.BrandType, &b.Name, &b.Status,
			&b.IsPublic, &b.IsFeatured, &coverImage, &coverVideo, &description,
			&data, &studentID, &enterpriseID, &positionID, &majorID, &teacherID, &expertID,
			&b.SortOrder, &b.ViewCount, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		b.CoverImage = coverImage
		b.CoverVideo = coverVideo
		b.Description = description
		b.Data = data
		b.StudentID = studentID
		b.EnterpriseID = enterpriseID
		b.PositionID = positionID
		b.MajorID = majorID
		b.TeacherID = teacherID
		b.ExpertID = expertID
		items = append(items, b)
	}
	return items, nil
}

func (s *AllianceStore) CreateBrand(ctx context.Context, b *domain.AllianceBrand) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_brands (id, tenant_id, brand_type, name, status, is_public,
			is_featured, cover_image, cover_video, description, data,
			student_id, enterprise_id, position_id, major_id, teacher_id, expert_id,
			sort_order, view_count, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW())
	`, id, b.TenantID, b.BrandType, b.Name, b.Status, b.IsPublic, b.IsFeatured,
		b.CoverImage, b.CoverVideo, b.Description, b.Data,
		b.StudentID, b.EnterpriseID, b.PositionID, b.MajorID, b.TeacherID, b.ExpertID,
		b.SortOrder, b.ViewCount)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateBrand(ctx context.Context, id string, b *domain.AllianceBrand) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_brands SET
			name = $1, status = $2, is_public = $3, is_featured = $4, cover_image = $5,
			cover_video = $6, description = $7, data = $8,
			student_id = $9, enterprise_id = $10, position_id = $11, major_id = $12,
			teacher_id = $13, expert_id = $14, sort_order = $15, updated_at = NOW()
		WHERE id = $16
	`, b.Name, b.Status, b.IsPublic, b.IsFeatured, b.CoverImage, b.CoverVideo,
		b.Description, b.Data,
		b.StudentID, b.EnterpriseID, b.PositionID, b.MajorID, b.TeacherID, b.ExpertID,
		b.SortOrder, id)
	return err
}

func (s *AllianceStore) DeleteBrand(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_brands WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (s *AllianceStore) GetBrandByID(ctx context.Context, id, tenantID string) (*domain.AllianceBrand, error) {
	var b domain.AllianceBrand
	var coverImage, coverVideo, description *string
	var data json.RawMessage
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, brand_type, name, status, is_public, is_featured,
			cover_image, cover_video, description, data,
			student_id, enterprise_id, position_id, major_id, teacher_id, expert_id,
			sort_order, view_count, created_at, updated_at
		FROM alliance_brands WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&b.ID, &b.TenantID, &b.BrandType, &b.Name, &b.Status,
		&b.IsPublic, &b.IsFeatured, &coverImage, &coverVideo, &description,
		&data, &b.StudentID, &b.EnterpriseID, &b.PositionID, &b.MajorID,
		&b.TeacherID, &b.ExpertID, &b.SortOrder, &b.ViewCount, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	b.CoverImage = coverImage
	b.CoverVideo = coverVideo
	b.Description = description
	b.Data = data
	return &b, nil
}

// ===== handler 直写 DB 收编 =====

// queryList 执行查询并用 scan 扫描全部行；扫描错误被忽略（与公开列表原行为一致）。
func queryList[T any](ctx context.Context, db Queryer, scan func(pgx.Rows) ([]T, error), query string, args ...any) ([]T, error) {
	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, _ := scan(rows)
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

func (s *AllianceStore) ListEnterpriseAgreements(ctx context.Context, enterpriseID string) ([]domain.AllianceEnterpriseAgreement, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, tenant_id, enterprise_id, name, type, start_date, end_date,
			status, content, attachments, created_at, updated_at
		FROM alliance_enterprise_agreements
		WHERE enterprise_id = $1
		ORDER BY created_at DESC
	`, enterpriseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return s.ScanEnterpriseAgreementRows(rows)
}

func (s *AllianceStore) ListMilestones(ctx context.Context, projectID string) ([]domain.AllianceProjectMilestone, error) {
	return queryList(ctx, s.q, s.ScanMilestoneRows, `
		SELECT id, tenant_id, project_id, name, description, due_date, completed_date,
			is_completed, sort_order, created_at, updated_at
		FROM alliance_project_milestones WHERE project_id = $1 ORDER BY sort_order ASC
	`, projectID)
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

// ===== 公开查询（门户前台） =====

func (s *AllianceStore) ListPublicEnterprises(ctx context.Context) ([]domain.AllianceEnterprise, error) {
	return queryList(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT id, tenant_id, name, enterprise_type, industry, region, description, logo_url,
			cover_image, status, rating, cooperation_types, contact_person, contact_phone,
			contact_email, address, unified_social_credit_code, established_year, employee_count,
			business_license_photos, qualification_photos, intellectual_property_photos,
			cover_photos, secondary_colleges, rating_record, is_public, created_by, created_at, updated_at
		FROM alliance_enterprises WHERE is_public = true AND status = 'active'
		ORDER BY created_at DESC
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

func (s *AllianceStore) ListPublicProjects(ctx context.Context) ([]domain.AllianceProject, error) {
	return queryList(ctx, s.q, s.ScanProjectRows, `
		SELECT id, tenant_id, name, type, description, phase, publish_status,
			start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges,
			is_public, created_by, created_at, updated_at
		FROM alliance_projects WHERE is_public = true AND publish_status = 'published'
		ORDER BY created_at DESC
	`)
}

func (s *AllianceStore) GetPublicProjectByID(ctx context.Context, id string) (*domain.AllianceProject, error) {
	return queryOne(ctx, s.q, s.ScanProjectRows, `
		SELECT id, tenant_id, name, type, description, phase, publish_status,
			start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges,
			is_public, created_by, created_at, updated_at
		FROM alliance_projects WHERE id = $1 AND is_public = true AND publish_status = 'published'
	`, id)
}

func (s *AllianceStore) ListPublicAchievements(ctx context.Context) ([]domain.AllianceAchievement, error) {
	return queryList(ctx, s.q, s.ScanAchievementRows, `
		SELECT id, tenant_id, title, type, description, achievement_date, cover_image,
			attachments, citation_reason, images, owner_persons, co_builders,
			enterprise_ids, project_ids, related_positions, related_scenes,
			related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_achievements WHERE is_public = true AND status = 'published'
		ORDER BY created_at DESC
	`)
}

func (s *AllianceStore) GetPublicAchievementByID(ctx context.Context, id string) (*domain.AllianceAchievement, error) {
	return queryOne(ctx, s.q, s.ScanAchievementRows, `
		SELECT id, tenant_id, title, type, description, achievement_date, cover_image,
			attachments, citation_reason, images, owner_persons, co_builders,
			enterprise_ids, project_ids, related_positions, related_scenes,
			related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_achievements WHERE id = $1 AND is_public = true AND status = 'published'
	`, id)
}

func (s *AllianceStore) ListPublicExperts(ctx context.Context) ([]domain.AllianceExpert, error) {
	return queryList(ctx, s.q, s.ScanExpertRows, `
		SELECT id, tenant_id, name, gender, age, title, position, expert_type, industry,
			professional_fields, specialties, experience_years, education, introduction,
			work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating,
			status, partner_source, position_direction, secondary_colleges, is_public, created_by, created_at, updated_at
		FROM alliance_experts WHERE is_public = true AND status = 'active'
		ORDER BY created_at DESC
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

func (s *AllianceStore) ListPublicBrands(ctx context.Context, brandType string) ([]domain.AllianceBrand, error) {
	query := `SELECT id, tenant_id, brand_type, name, status, is_public, is_featured,
		cover_image, cover_video, description, data,
		student_id, enterprise_id, position_id, major_id, teacher_id, expert_id,
		sort_order, view_count, created_at, updated_at
		FROM alliance_brands WHERE is_public = true AND status = 'published'`
	args := []interface{}{}
	if brandType != "" {
		query += " AND brand_type = $1"
		args = append(args, brandType)
	}
	query += " ORDER BY sort_order ASC, created_at DESC"
	return queryList(ctx, s.q, s.ScanBrandRows, query, args...)
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

package store

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 企业主体（partner_enterprises，全局唯一，tenant_id = 企业租户） =====

// enterpriseColumns 企业主体全列（唯一列清单，扫描顺序与 ScanEnterpriseRows 一致）。
const enterpriseColumns = `id, tenant_id, name, industry, region, description,
	logo_url, cover_image, cooperation_types, contact_person,
	contact_phone, contact_email, address, unified_social_credit_code,
	established_year, employee_count, business_license_photos, qualification_photos,
	intellectual_property_photos, cover_photos, enable_public, created_at, updated_at`

type AllianceEnterpriseCreateParams struct {
	TenantID                   string
	Name                       string
	Industry                   *string
	Region                     *string
	Description                *string
	LogoURL                    *string
	CoverImage                 *string
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
	EnablePublic               bool
}

// AllianceEnterpriseProfileUpdateParams 企业服务台主体信息更新（不含租户归属）。
type AllianceEnterpriseProfileUpdateParams struct {
	Name                       string
	Industry                   *string
	Region                     *string
	Description                *string
	LogoURL                    *string
	CoverImage                 *string
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
	EnablePublic               bool
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
		var industry, region, description, logoURL, coverImage *string
		var contactPerson, contactPhone, contactEmail, address, creditCode *string
		var establishedYear, employeeCount *int
		var coopTypes, bizPhotos, qualPhotos, ipPhotos, coverPhotos json.RawMessage
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &industry, &region,
			&description, &logoURL, &coverImage, &coopTypes,
			&contactPerson, &contactPhone, &contactEmail, &address, &creditCode,
			&establishedYear, &employeeCount, &bizPhotos, &qualPhotos, &ipPhotos,
			&coverPhotos, &e.EnablePublic, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		e.Industry = industry
		e.Region = region
		e.Description = description
		e.LogoURL = logoURL
		e.CoverImage = coverImage
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
		items = append(items, e)
	}
	return items, rows.Err()
}

// GetEnterpriseByID 按 ID + 企业租户查询主体（企业服务台自身数据）。
func (s *AllianceStore) GetEnterpriseByID(ctx context.Context, id, tenantID string) (*domain.AllianceEnterprise, error) {
	return queryOne(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT `+enterpriseColumns+`
		FROM partner_enterprises WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
}

// GetEnterpriseByTenant 按企业租户查询主体（每个企业租户唯一主体）。
func (s *AllianceStore) GetEnterpriseByTenant(ctx context.Context, tenantID string) (*domain.AllianceEnterprise, error) {
	return queryOne(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT `+enterpriseColumns+`
		FROM partner_enterprises WHERE tenant_id = $1
	`, tenantID)
}

// GetEnterpriseByIDGlobal 按 ID 查询主体（跨租户只读；调用方须先做合作关联校验）。
func (s *AllianceStore) GetEnterpriseByIDGlobal(ctx context.Context, id string) (*domain.AllianceEnterprise, error) {
	return queryOne(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT `+enterpriseColumns+`
		FROM partner_enterprises WHERE id = $1
	`, id)
}

func (s *AllianceStore) CreateEnterprise(ctx context.Context, p *AllianceEnterpriseCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx, `
		INSERT INTO partner_enterprises (id, tenant_id, name, industry, region,
			description, logo_url, cover_image, cooperation_types, contact_person,
			contact_phone, contact_email, address, unified_social_credit_code, established_year,
			employee_count, business_license_photos, qualification_photos, intellectual_property_photos,
			cover_photos, enable_public, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
	`, id, p.TenantID, p.Name, p.Industry, p.Region, p.Description, p.LogoURL,
		p.CoverImage, emptyJSON(p.CooperationTypes), p.ContactPerson,
		p.ContactPhone, p.ContactEmail, p.Address, p.UnifiedSocialCreditCode, p.EstablishedYear,
		p.EmployeeCount, emptyJSON(p.BusinessLicensePhotos), emptyJSON(p.QualificationPhotos),
		emptyJSON(p.IntellectualPropertyPhotos), emptyJSON(p.CoverPhotos), p.EnablePublic)
	if err != nil {
		return "", err
	}
	return id, nil
}

// UpdateEnterpriseProfile 企业服务台更新自身主体信息（含 enable_public 展示开关）。
func (s *AllianceStore) UpdateEnterpriseProfile(ctx context.Context, id, tenantID string, p *AllianceEnterpriseProfileUpdateParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE partner_enterprises SET
			name = $1, industry = $2, region = $3, description = $4,
			logo_url = $5, cover_image = $6, cooperation_types = $7,
			contact_person = $8, contact_phone = $9, contact_email = $10, address = $11,
			unified_social_credit_code = $12, established_year = $13, employee_count = $14,
			business_license_photos = $15, qualification_photos = $16, intellectual_property_photos = $17,
			cover_photos = $18, enable_public = $19,
			updated_at = NOW()
		WHERE id = $20 AND tenant_id = $21
	`, p.Name, p.Industry, p.Region, p.Description, p.LogoURL, p.CoverImage,
		emptyJSON(p.CooperationTypes), p.ContactPerson, p.ContactPhone,
		p.ContactEmail, p.Address, p.UnifiedSocialCreditCode, p.EstablishedYear, p.EmployeeCount,
		emptyJSON(p.BusinessLicensePhotos), emptyJSON(p.QualificationPhotos), emptyJSON(p.IntellectualPropertyPhotos),
		emptyJSON(p.CoverPhotos), p.EnablePublic, id, tenantID)
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

func (s *AllianceStore) UpdateEnterpriseAgreement(ctx context.Context, id, tenantID string, p *AllianceEnterpriseAgreementUpdateParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_enterprise_agreements SET
			name = $1, type = $2, start_date = $3, end_date = $4, status = $5,
			content = $6, attachments = $7, updated_at = NOW()
		WHERE id = $8 AND tenant_id = $9
	`, p.Name, p.Type, p.StartDate, p.EndDate, p.Status, p.Content, emptyJSON(p.Attachments), id, tenantID)
	return err
}

func (s *AllianceStore) DeleteEnterpriseAgreement(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_enterprise_agreements WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ===== 公开查询（门户前台） =====
// 数据源（§3.2 双控原则）：企业控制 enable_public（"愿不愿意"），学校控制 link.is_public（"在不在本校出现"）。
// tenantID 为空 → 全局联盟展示（仅企业侧开关）；非空 → 该校落地页（link.is_public + enable_public 双控）。

func (s *AllianceStore) ListPublicEnterprises(ctx context.Context, tenantID string) ([]domain.AllianceEnterprise, error) {
	if tenantID != "" {
		return queryList(ctx, s.q, s.ScanEnterpriseRows, `
			SELECT `+enterpriseColumns+`
			FROM partner_enterprises pe
			WHERE pe.enable_public = true AND EXISTS (
				SELECT 1 FROM alliance_enterprise_links l
				WHERE l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true
			)
			ORDER BY pe.created_at DESC LIMIT 100
		`, tenantID)
	}
	return queryList(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT `+enterpriseColumns+`
		FROM partner_enterprises pe WHERE pe.enable_public = true
		ORDER BY pe.created_at DESC LIMIT 100
	`)
}

func (s *AllianceStore) GetPublicEnterpriseByID(ctx context.Context, id, tenantID string) (*domain.AllianceEnterprise, error) {
	if tenantID != "" {
		return queryOne(ctx, s.q, s.ScanEnterpriseRows, `
			SELECT `+enterpriseColumns+`
			FROM partner_enterprises pe
			WHERE pe.id = $1 AND pe.enable_public = true AND EXISTS (
				SELECT 1 FROM alliance_enterprise_links l
				WHERE l.enterprise_id = pe.id AND l.tenant_id = $2 AND l.is_public = true
			)
		`, id, tenantID)
	}
	return queryOne(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT `+enterpriseColumns+`
		FROM partner_enterprises pe WHERE pe.id = $1 AND pe.enable_public = true
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

func (s *AllianceStore) GetPublicStats(ctx context.Context, tenantID string) AlliancePublicStats {
	var st AlliancePublicStats
	count := func(query string, args ...any) int {
		var n int
		if err := s.q.QueryRow(ctx, query, args...).Scan(&n); err != nil {
			slog.Warn("alliance public stats query failed", "error", err)
		}
		return n
	}
	if tenantID != "" {
		st.EnterpriseCount = count(`
			SELECT COUNT(*) FROM partner_enterprises pe
			WHERE pe.enable_public = true AND EXISTS (
				SELECT 1 FROM alliance_enterprise_links l
				WHERE l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true
			)`, tenantID)
		st.ExpertCount = count(`
			SELECT COUNT(*) FROM alliance_experts x
			WHERE x.is_public = true AND x.status = 'active'
			  AND EXISTS (SELECT 1 FROM partner_enterprises pe WHERE pe.id = x.enterprise_id AND pe.enable_public = true)
			  AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id AND l.tenant_id = $1 AND l.is_public = true)`, tenantID)
		st.ProjectCount = count(`
			SELECT COUNT(*) FROM alliance_projects p
			WHERE p.is_public = true AND p.publish_status = 'published'
			  AND p.tenant_id = $1
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(p.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
				JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true
			  )`, tenantID)
		st.AchievementCount = count(`
			SELECT COUNT(*) FROM alliance_achievements a
			WHERE a.is_public = true AND a.status = 'published'
			  AND a.tenant_id = $1
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
				JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true
			  )`, tenantID)
	} else {
		st.EnterpriseCount = count(`SELECT COUNT(*) FROM partner_enterprises WHERE enable_public = true`)
		st.ExpertCount = count(`
			SELECT COUNT(*) FROM alliance_experts x
			WHERE x.is_public = true AND x.status = 'active'
			  AND EXISTS (SELECT 1 FROM partner_enterprises pe WHERE pe.id = x.enterprise_id AND pe.enable_public = true)`)
		st.ProjectCount = count(`
			SELECT COUNT(*) FROM alliance_projects p
			WHERE p.is_public = true AND p.publish_status = 'published'
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(p.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
			  )`)
		st.AchievementCount = count(`
			SELECT COUNT(*) FROM alliance_achievements a
			WHERE a.is_public = true AND a.status = 'published'
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
			  )`)
	}
	// 品牌为学校侧内容（§3.2 逻辑保持），不参与企业双控
	st.BrandCount = count(`SELECT COUNT(*) FROM alliance_brands WHERE is_public = true AND status = 'published'`)
	return st
}

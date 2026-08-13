package store

import (
	"context"
	"encoding/json"
	"log/slog"

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

// ===== 公开查询（门户前台） =====
// 数据源（§3.2 双控原则）：企业控制 enable_public（"愿不愿意"），学校控制 link.is_public（"在不在本校出现"）。
// tenantID 为空 → 全局联盟展示（仅企业侧开关）；非空 → 该校落地页（link.is_public + enable_public 双控，且排除已终止合作）。
// 带 tenantID 时额外返回学校侧评级（link.rating，前台评级筛选用）。

// publicEnterpriseColumns 公开企业列：企业主体全列（带 pe. 前缀，JOIN links 时避免共有列歧义）
// + 学校侧评级（仅 tenant 分支有值）。
const publicEnterpriseColumns = `pe.id, pe.tenant_id, pe.name, pe.industry, pe.region, pe.description,
	pe.logo_url, pe.cover_image, pe.cooperation_types, pe.contact_person,
	pe.contact_phone, pe.contact_email, pe.address, pe.unified_social_credit_code,
	pe.established_year, pe.employee_count, pe.business_license_photos, pe.qualification_photos,
	pe.intellectual_property_photos, pe.cover_photos, pe.enable_public, pe.created_at, pe.updated_at, l.rating`

func (s *AllianceStore) ScanPublicEnterpriseRows(rows pgx.Rows) ([]domain.AllianceEnterprise, error) {
	items := make([]domain.AllianceEnterprise, 0)
	for rows.Next() {
		var e domain.AllianceEnterprise
		var industry, region, description, logoURL, coverImage *string
		var contactPerson, contactPhone, contactEmail, address, creditCode *string
		var establishedYear, employeeCount *int
		var coopTypes, bizPhotos, qualPhotos, ipPhotos, coverPhotos json.RawMessage
		var rating *string
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &industry, &region,
			&description, &logoURL, &coverImage, &coopTypes,
			&contactPerson, &contactPhone, &contactEmail, &address, &creditCode,
			&establishedYear, &employeeCount, &bizPhotos, &qualPhotos, &ipPhotos,
			&coverPhotos, &e.EnablePublic, &e.CreatedAt, &e.UpdatedAt, &rating,
			&e.ProjectCount, &e.AgreementCount, &e.AchievementCount); err != nil {
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
		e.Rating = rating
		items = append(items, e)
	}
	return items, rows.Err()
}

// ListPublicEnterprises 门户前台公开企业列表。
// limit/offset 分页；limit<=0 时默认 100。
func (s *AllianceStore) ListPublicEnterprises(ctx context.Context, tenantID string, limit, offset int) ([]domain.AllianceEnterprise, error) {
	if limit <= 0 {
		limit = 100
	}
	if tenantID != "" {
		return queryList(ctx, s.q, s.ScanPublicEnterpriseRows, `
			SELECT `+publicEnterpriseColumns+`,
				(SELECT COUNT(*) FROM alliance_projects p
				 WHERE p.tenant_id = $1 AND p.is_public = true AND p.enterprise_ids @> jsonb_build_array(pe.id)) AS project_count,
				(SELECT COUNT(*) FROM alliance_agreements a
				 WHERE a.tenant_id = $1 AND a.enterprise_ids @> jsonb_build_array(pe.id)) AS agreement_count,
				(SELECT COUNT(*) FROM alliance_achievements ac
				 WHERE ac.tenant_id = $1 AND ac.is_public = true AND ac.enterprise_ids @> jsonb_build_array(pe.id)) AS achievement_count
			FROM partner_enterprises pe
			JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true AND l.status <> 'terminated'
			WHERE pe.enable_public = true
			ORDER BY pe.created_at DESC LIMIT $2 OFFSET $3
		`, tenantID, limit, offset)
	}
	return queryList(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT `+enterpriseColumns+`
		FROM partner_enterprises pe WHERE pe.enable_public = true
		ORDER BY pe.created_at DESC LIMIT $1 OFFSET $2
	`, limit, offset)
}

func (s *AllianceStore) GetPublicEnterpriseByID(ctx context.Context, id, tenantID string) (*domain.AllianceEnterprise, error) {
	if tenantID != "" {
		return queryOne(ctx, s.q, s.ScanEnterpriseRows, `
			SELECT `+enterpriseColumns+`
			FROM partner_enterprises pe
			WHERE pe.id = $1 AND pe.enable_public = true AND EXISTS (
				SELECT 1 FROM alliance_enterprise_links l
				WHERE l.enterprise_id = pe.id AND l.tenant_id = $2 AND l.is_public = true AND l.status <> 'terminated'
			)
		`, id, tenantID)
	}
	return queryOne(ctx, s.q, s.ScanEnterpriseRows, `
		SELECT `+enterpriseColumns+`
		FROM partner_enterprises pe WHERE pe.id = $1 AND pe.enable_public = true
	`, id)
}

// HasPublicEnterpriseAccess 判定 viewerTenantID 是否可查看 enterpriseTenantID 名下企业的公开文件：
// 存在企业主体（enable_public=true，归属 enterpriseTenantID）且与 viewerTenantID 有
// is_public=true 且未终止的合作链接。用于 /uploads 跨租户文件放行（联盟前台展示）。
func (s *AllianceStore) HasPublicEnterpriseAccess(ctx context.Context, enterpriseTenantID, viewerTenantID string) (bool, error) {
	var ok bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM partner_enterprises pe
			JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id
			WHERE pe.tenant_id = $1 AND pe.enable_public = true
			  AND l.tenant_id = $2 AND l.is_public = true AND l.status <> 'terminated'
		)
	`, enterpriseTenantID, viewerTenantID).Scan(&ok)
	return ok, err
}

// IsPublicAllianceFile 判定文件是否属于联盟公开前台内容（任意访问者可见，含访客）：
// 文件被 enable_public 企业（logo/封面）、其名下专家（头像/封面/照片）、
// is_public 成果（封面/图集）、项目或品牌（封面）引用。
// 用于 /uploads 文件放行：与公开接口（enable_public/is_public 即对外可见）语义对齐，
// 避免"接口返回了数据但图片 403"的不一致（公开数据归属租户名下可能没有 enable_public 企业，
// 原 HasPublicEnterpriseAccess 无法覆盖）。
func (s *AllianceStore) IsPublicAllianceFile(ctx context.Context, fileTenantID, fileURL string) (bool, error) {
	var ok bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM partner_enterprises
			WHERE tenant_id = $1 AND enable_public = true AND (logo_url = $2 OR cover_image = $2)
			UNION ALL
			SELECT 1 FROM alliance_experts x
			JOIN partner_enterprises pe ON pe.id = x.enterprise_id AND pe.enable_public = true
			WHERE x.tenant_id = $1
			  AND ($2 = x.avatar_url OR $2 = x.cover_image
			       OR $2 IN (SELECT jsonb_array_elements_text(x.photos)))
			UNION ALL
			SELECT 1 FROM alliance_achievements
			WHERE tenant_id = $1 AND is_public = true
			  AND ($2 = cover_image OR $2 IN (SELECT jsonb_array_elements_text(images)))
			UNION ALL
			SELECT 1 FROM alliance_projects
			WHERE tenant_id = $1 AND is_public = true AND cover_image = $2
			UNION ALL
			SELECT 1 FROM alliance_brands
			WHERE tenant_id = $1 AND is_public = true AND cover_image = $2
		)
	`, fileTenantID, fileURL).Scan(&ok)
	return ok, err
}

// ContentMonthCount 近 months 个月每月合作内容数量（项目/协议/成果，服务台折线图）。
type ContentMonthCount struct {
	Month        string `json:"month"`
	Projects     int    `json:"projects"`
	Agreements   int    `json:"agreements"`
	Achievements int    `json:"achievements"`
}

// CountMonthlyContentByEnterprise 近 months 个月每月新增合作项目/协议/成果数
// （enterprise_ids 关联本企业主体）。
func (s *AllianceStore) CountMonthlyContentByEnterprise(ctx context.Context, enterpriseID string, months int) ([]ContentMonthCount, error) {
	if months <= 0 || months > 12 {
		months = 6
	}
	rows, err := s.q.Query(ctx, `
		SELECT m.month,
			COALESCE(p.cnt, 0) AS projects,
			COALESCE(a.cnt, 0) AS agreements,
			COALESCE(c.cnt, 0) AS achievements
		FROM (
			SELECT to_char(d, 'YYYY-MM') AS month
			FROM generate_series(date_trunc('month', NOW()) - make_interval(months => $2 - 1),
				date_trunc('month', NOW()), '1 month') d
		) m
		LEFT JOIN (
			SELECT to_char(date_trunc('month', p.created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt
			FROM alliance_projects p, jsonb_array_elements_text(p.enterprise_ids) eid
			WHERE eid = $1
			  AND p.created_at >= date_trunc('month', NOW()) - make_interval(months => $2 - 1)
			GROUP BY 1
		) p ON p.month = m.month
		LEFT JOIN (
			SELECT to_char(date_trunc('month', a.created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt
			FROM alliance_agreements a, jsonb_array_elements_text(a.enterprise_ids) eid
			WHERE eid = $1
			  AND a.created_at >= date_trunc('month', NOW()) - make_interval(months => $2 - 1)
			GROUP BY 1
		) a ON a.month = m.month
		LEFT JOIN (
			SELECT to_char(date_trunc('month', c.created_at), 'YYYY-MM') AS month, COUNT(*) AS cnt
			FROM alliance_achievements c, jsonb_array_elements_text(c.enterprise_ids) eid
			WHERE eid = $1
			  AND c.created_at >= date_trunc('month', NOW()) - make_interval(months => $2 - 1)
			GROUP BY 1
		) c ON c.month = m.month
		ORDER BY m.month
	`, enterpriseID, months)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ContentMonthCount
	for rows.Next() {
		var c ContentMonthCount
		if err := rows.Scan(&c.Month, &c.Projects, &c.Agreements, &c.Achievements); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
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
				WHERE l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true AND l.status <> 'terminated'
			)`, tenantID)
		st.ExpertCount = count(`
			SELECT COUNT(*) FROM alliance_experts x
			WHERE x.is_public = true AND x.status = 'active'
			  AND EXISTS (SELECT 1 FROM partner_enterprises pe WHERE pe.id = x.enterprise_id AND pe.enable_public = true)
			  AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id AND l.tenant_id = $1 AND l.is_public = true AND l.status <> 'terminated')`, tenantID)
		st.ProjectCount = count(`
			SELECT COUNT(*) FROM alliance_projects p
			WHERE p.is_public = true
			  AND p.tenant_id = $1
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(p.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
				JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true AND l.status <> 'terminated'
			  )`, tenantID)
		st.AchievementCount = count(`
			SELECT COUNT(*) FROM alliance_achievements a
			WHERE a.is_public = true
			  AND a.tenant_id = $1
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
				JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true AND l.status <> 'terminated'
			  )`, tenantID)
	} else {
		st.EnterpriseCount = count(`SELECT COUNT(*) FROM partner_enterprises WHERE enable_public = true`)
		st.ExpertCount = count(`
			SELECT COUNT(*) FROM alliance_experts x
			WHERE x.is_public = true AND x.status = 'active'
			  AND EXISTS (SELECT 1 FROM partner_enterprises pe WHERE pe.id = x.enterprise_id AND pe.enable_public = true)`)
		st.ProjectCount = count(`
			SELECT COUNT(*) FROM alliance_projects p
			WHERE p.is_public = true
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(p.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
			  )`)
		st.AchievementCount = count(`
			SELECT COUNT(*) FROM alliance_achievements a
			WHERE a.is_public = true
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
			  )`)
	}
	// 品牌为学校侧内容（§3.2 逻辑保持），不参与企业双控
	st.BrandCount = count(`SELECT COUNT(*) FROM alliance_brands WHERE is_public = true AND status <> 'archived'`)
	return st
}

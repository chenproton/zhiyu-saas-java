package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 学校-企业合作关联（alliance_enterprise_links，tenant_id = 学校租户） =====

type AllianceEnterpriseLinkStore struct {
	q Queryer
}

func NewAllianceEnterpriseLinkStore(q Queryer) *AllianceEnterpriseLinkStore {
	return &AllianceEnterpriseLinkStore{q: q}
}

type AllianceEnterpriseLinkCreateParams struct {
	TenantID          string
	EnterpriseID      string
	RelationType      string
	Status            string
	Rating            *string
	EnterpriseType    string
	IsPublic          bool
	SecondaryColleges json.RawMessage
	CreatedBy         *string
}

// AllianceEnterpriseLinkUpdateParams 学校侧管理字段（仅 link 上的字段可更新，企业主体不可改）。
type AllianceEnterpriseLinkUpdateParams struct {
	Status            string
	Rating            *string
	EnterpriseType    string
	IsPublic          bool
	SecondaryColleges json.RawMessage
}

// CreateLink 引入企业（创建合作关联）；UNIQUE(tenant_id, enterprise_id) 冲突由调用方转 409。
func (s *AllianceEnterpriseLinkStore) CreateLink(ctx context.Context, p *AllianceEnterpriseLinkCreateParams) (string, error) {
	id := uuid.NewString()
	relationType := p.RelationType
	if relationType == "" {
		relationType = "alliance"
	}
	status := p.Status
	if status == "" {
		status = "negotiating"
	}
	enterpriseType := p.EnterpriseType
	if enterpriseType == "" {
		enterpriseType = "cooperation"
	}
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_enterprise_links (id, tenant_id, enterprise_id, relation_type, status,
			rating, enterprise_type, is_public, secondary_colleges, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
	`, id, p.TenantID, p.EnterpriseID, relationType, status,
		p.Rating, enterpriseType, p.IsPublic, emptyJSON(p.SecondaryColleges), p.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

// DeleteLink 解除引入（删除 link；历史协议/项目/成果引用保留）。
func (s *AllianceEnterpriseLinkStore) DeleteLink(ctx context.Context, enterpriseID, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE enterprise_id = $1 AND tenant_id = $2`, enterpriseID, tenantID)
	return err
}

// GetLinkByEnterprise 查询某校与某企业的合作关联（越权校验的数据基础）。
func (s *AllianceEnterpriseLinkStore) GetLinkByEnterprise(ctx context.Context, enterpriseID, tenantID string) (*domain.AllianceEnterpriseLink, error) {
	var l domain.AllianceEnterpriseLink
	var rating, createdBy *string
	var colleges json.RawMessage
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, enterprise_id, relation_type, status, rating,
			enterprise_type, is_public, secondary_colleges, created_by, created_at, updated_at
		FROM alliance_enterprise_links WHERE enterprise_id = $1 AND tenant_id = $2
	`, enterpriseID, tenantID).Scan(&l.ID, &l.TenantID, &l.EnterpriseID, &l.RelationType, &l.Status,
		&rating, &l.EnterpriseType, &l.IsPublic, &colleges, &createdBy, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, err
	}
	l.Rating = rating
	l.SecondaryColleges = colleges
	l.CreatedBy = createdBy
	return &l, nil
}

// UpdateLink 仅更新学校侧管理字段（rating/status/enterprise_type/is_public/secondary_colleges）。
func (s *AllianceEnterpriseLinkStore) UpdateLink(ctx context.Context, enterpriseID, tenantID string, p *AllianceEnterpriseLinkUpdateParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_enterprise_links SET
			status = $1, rating = $2, enterprise_type = $3, is_public = $4,
			secondary_colleges = $5, updated_at = NOW()
		WHERE enterprise_id = $6 AND tenant_id = $7
	`, p.Status, p.Rating, p.EnterpriseType, p.IsPublic, emptyJSON(p.SecondaryColleges), enterpriseID, tenantID)
	return err
}

// ListEnterpriseIDsBySchoolTenant 列出某校已引入的企业 ID 集合（专家跨租户过滤的数据基础）。
func (s *AllianceEnterpriseLinkStore) ListEnterpriseIDsBySchoolTenant(ctx context.Context, tenantID string) ([]string, error) {
	rows, err := s.q.Query(ctx, `SELECT enterprise_id FROM alliance_enterprise_links WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// AllianceEnterpriseListFilter 学校侧已引入企业列表筛选参数。
type AllianceEnterpriseListFilter struct {
	Search string
	Status string
	Limit  int
	Offset int
}

// ListBySchoolTenant 学校侧已引入企业合并视图（join partner_enterprises：主体信息 + link 管理字段）。
// 支持按名称/行业关键字、link 状态筛选以及 limit/offset 分页，返回结果与总条数。
func (s *AllianceEnterpriseLinkStore) ListBySchoolTenant(ctx context.Context, tenantID string, filter AllianceEnterpriseListFilter) ([]domain.AllianceLinkedEnterprise, int, error) {
	if filter.Limit <= 0 {
		filter.Limit = 200
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	where := []string{"l.tenant_id = $1"}
	args := []any{tenantID}
	idx := 2

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(e.name ILIKE $%d OR e.industry ILIKE $%d)", idx, idx))
		args = append(args, "%"+filter.Search+"%")
		idx++
	}
	if filter.Status != "" {
		where = append(where, fmt.Sprintf("l.status = $%d", idx))
		args = append(args, filter.Status)
		idx++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	if err := s.q.QueryRow(ctx, "SELECT COUNT(*) FROM alliance_enterprise_links l JOIN partner_enterprises e ON e.id = l.enterprise_id WHERE "+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	dataArgs := append([]any{}, args...)
	dataArgs = append(dataArgs, filter.Limit, filter.Offset)
	rows, err := s.q.Query(ctx, `
		SELECT e.id, e.tenant_id, e.name, e.industry, e.region, e.description,
			e.logo_url, e.cover_image, e.cooperation_types, e.contact_person,
			e.contact_phone, e.contact_email, e.address, e.unified_social_credit_code,
			e.established_year, e.employee_count, e.business_license_photos, e.qualification_photos,
			e.intellectual_property_photos, e.cover_photos, e.enable_public, e.created_at, e.updated_at,
			l.id, l.relation_type, l.status, l.rating, l.enterprise_type, l.is_public, l.secondary_colleges
		FROM alliance_enterprise_links l
		JOIN partner_enterprises e ON e.id = l.enterprise_id
		WHERE `+whereClause+`
		ORDER BY l.created_at DESC
		LIMIT $`+strconv.Itoa(idx)+` OFFSET $`+strconv.Itoa(idx+1)+`
	`, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanLinkedEnterpriseRows(rows)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetLinkedByEnterprise 学校侧单企业合并视图（主体 + link 管理字段）。
func (s *AllianceEnterpriseLinkStore) GetLinkedByEnterprise(ctx context.Context, enterpriseID, tenantID string) (*domain.AllianceLinkedEnterprise, error) {
	return queryOne(ctx, s.q, scanLinkedEnterpriseRows, `
		SELECT e.id, e.tenant_id, e.name, e.industry, e.region, e.description,
			e.logo_url, e.cover_image, e.cooperation_types, e.contact_person,
			e.contact_phone, e.contact_email, e.address, e.unified_social_credit_code,
			e.established_year, e.employee_count, e.business_license_photos, e.qualification_photos,
			e.intellectual_property_photos, e.cover_photos, e.enable_public, e.created_at, e.updated_at,
			l.id, l.relation_type, l.status, l.rating, l.enterprise_type, l.is_public, l.secondary_colleges
		FROM alliance_enterprise_links l
		JOIN partner_enterprises e ON e.id = l.enterprise_id
		WHERE l.enterprise_id = $1 AND l.tenant_id = $2
	`, enterpriseID, tenantID)
}

func scanLinkedEnterpriseRows(rows pgx.Rows) ([]domain.AllianceLinkedEnterprise, error) {
	items := make([]domain.AllianceLinkedEnterprise, 0)
	for rows.Next() {
		var v domain.AllianceLinkedEnterprise
		var industry, region, description, logoURL, coverImage *string
		var contactPerson, contactPhone, contactEmail, address, creditCode *string
		var establishedYear, employeeCount *int
		var coopTypes, bizPhotos, qualPhotos, ipPhotos, coverPhotos json.RawMessage
		if err := rows.Scan(&v.ID, &v.TenantID, &v.Name, &industry, &region,
			&description, &logoURL, &coverImage, &coopTypes,
			&contactPerson, &contactPhone, &contactEmail, &address, &creditCode,
			&establishedYear, &employeeCount, &bizPhotos, &qualPhotos, &ipPhotos,
			&coverPhotos, &v.EnablePublic, &v.CreatedAt, &v.UpdatedAt,
			&v.LinkID, &v.RelationType, &v.Status, &v.Rating, &v.EnterpriseType, &v.IsPublic, &v.SecondaryColleges); err != nil {
			return nil, err
		}
		v.Industry = industry
		v.Region = region
		v.Description = description
		v.LogoURL = logoURL
		v.CoverImage = coverImage
		v.CooperationTypes = coopTypes
		v.ContactPerson = contactPerson
		v.ContactPhone = contactPhone
		v.ContactEmail = contactEmail
		v.Address = address
		v.UnifiedSocialCreditCode = creditCode
		v.EstablishedYear = establishedYear
		v.EmployeeCount = employeeCount
		v.BusinessLicensePhotos = bizPhotos
		v.QualificationPhotos = qualPhotos
		v.IntellectualPropertyPhotos = ipPhotos
		v.CoverPhotos = coverPhotos
		items = append(items, v)
	}
	return items, rows.Err()
}

// ListByEnterpriseTenant 企业侧合作学校反向视图（join tenants 出学校名称）。
func (s *AllianceEnterpriseLinkStore) ListByEnterpriseTenant(ctx context.Context, enterpriseTenantID string) ([]domain.AlliancePartnerSchool, error) {
	rows, err := s.q.Query(ctx, `
		SELECT l.id, l.tenant_id, t.name, l.relation_type, l.status, l.rating,
			l.enterprise_type, l.is_public, l.created_at
		FROM alliance_enterprise_links l
		JOIN partner_enterprises e ON e.id = l.enterprise_id
		JOIN tenants t ON t.id = l.tenant_id
		WHERE e.tenant_id = $1
		ORDER BY l.created_at DESC
	`, enterpriseTenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AlliancePartnerSchool, 0)
	for rows.Next() {
		var v domain.AlliancePartnerSchool
		if err := rows.Scan(&v.LinkID, &v.TenantID, &v.SchoolName, &v.RelationType, &v.Status,
			&v.Rating, &v.EnterpriseType, &v.IsPublic, &v.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, v)
	}
	return items, rows.Err()
}

// CountByEnterpriseTenant 企业侧合作学校数量（服务台统计）。
func (s *AllianceEnterpriseLinkStore) CountByEnterpriseTenant(ctx context.Context, enterpriseTenantID string) (int, error) {
	var n int
	err := s.q.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM alliance_enterprise_links l
		JOIN partner_enterprises e ON e.id = l.enterprise_id
		WHERE e.tenant_id = $1
	`, enterpriseTenantID).Scan(&n)
	return n, err
}

// MonthCount 按月聚合计数。
type MonthCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

// CountMonthlyLinksByEnterpriseTenant 近 months 个月每月新增合作学校数（服务台柱状图）。
func (s *AllianceEnterpriseLinkStore) CountMonthlyLinksByEnterpriseTenant(ctx context.Context, enterpriseTenantID string, months int) ([]MonthCount, error) {
	if months <= 0 || months > 12 {
		months = 6
	}
	rows, err := s.q.Query(ctx, `
		SELECT to_char(date_trunc('month', l.created_at), 'YYYY-MM') AS month, COUNT(*)
		FROM alliance_enterprise_links l
		JOIN partner_enterprises e ON e.id = l.enterprise_id
		WHERE e.tenant_id = $1
		  AND l.created_at >= date_trunc('month', NOW()) - make_interval(months => $2 - 1)
		GROUP BY 1 ORDER BY 1
	`, enterpriseTenantID, months)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MonthCount
	for rows.Next() {
		var c MonthCount
		if err := rows.Scan(&c.Month, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// SearchEnterprises 全局企业池关键词搜索（跨租户只读，排除已被该校引入的企业）。
func (s *AllianceEnterpriseLinkStore) SearchEnterprises(ctx context.Context, schoolTenantID, keyword string, limit int) ([]domain.AllianceEnterprise, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	return queryList(ctx, s.q, NewAllianceStore(s.q).ScanEnterpriseRows, `
		SELECT `+enterpriseColumns+`
		FROM partner_enterprises e
		WHERE ($1 = '' OR e.name ILIKE '%' || $1 || '%' OR e.industry ILIKE '%' || $1 || '%')
		  AND NOT EXISTS (
			SELECT 1 FROM alliance_enterprise_links l
			WHERE l.enterprise_id = e.id AND l.tenant_id = $2
		  )
		ORDER BY e.created_at DESC
		LIMIT $3
	`, keyword, schoolTenantID, limit)
}

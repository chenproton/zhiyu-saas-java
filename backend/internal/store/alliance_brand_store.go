package store

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

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
	return items, rows.Err()
}

// ListConfig 返回品牌列表查询配置，SQL 片段沉淀在 store 层。
func (s *AllianceStore) ListBrandsConfig() ListQueryConfig[domain.AllianceBrand] {
	return ListQueryConfig[domain.AllianceBrand]{
		Table:         "alliance_brands",
		SelectColumns: "id, tenant_id, brand_type, name, status, is_public, is_featured, cover_image, cover_video, description, data, student_id, enterprise_id, position_id, major_id, teacher_id, expert_id, sort_order, view_count, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "sort_order ASC, created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if brandType := p.Values["brandType"]; brandType != "" {
				qb.AddCondition("brand_type = " + qb.NextArg(brandType))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: s.ScanBrandRows,
	}
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

func (s *AllianceStore) UpdateBrand(ctx context.Context, id, tenantID string, b *domain.AllianceBrand) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_brands SET
			name = $1, status = $2, is_public = $3, is_featured = $4, cover_image = $5,
			cover_video = $6, description = $7, data = $8,
			student_id = $9, enterprise_id = $10, position_id = $11, major_id = $12,
			teacher_id = $13, expert_id = $14, sort_order = $15, updated_at = NOW()
		WHERE id = $16 AND tenant_id = $17
	`, b.Name, b.Status, b.IsPublic, b.IsFeatured, b.CoverImage, b.CoverVideo,
		b.Description, b.Data,
		b.StudentID, b.EnterpriseID, b.PositionID, b.MajorID, b.TeacherID, b.ExpertID,
		b.SortOrder, id, tenantID)
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

// ListPublicBrands 门户前台公开品牌列表：is_public 为展示开关，status 仅排除已归档。
// 不要求 published：品牌页创建即 draft 且雇主品牌无发布入口，开关语义与项目/成果（is_public 唯一门槛）对齐。
func (s *AllianceStore) ListPublicBrands(ctx context.Context, brandType string) ([]domain.AllianceBrand, error) {
	query := `SELECT id, tenant_id, brand_type, name, status, is_public, is_featured,
		cover_image, cover_video, description, data,
		student_id, enterprise_id, position_id, major_id, teacher_id, expert_id,
		sort_order, view_count, created_at, updated_at
		FROM alliance_brands WHERE is_public = true AND status <> 'archived'`
	args := []interface{}{}
	if brandType != "" {
		query += " AND brand_type = $1"
		args = append(args, brandType)
	}
	query += " ORDER BY sort_order ASC, created_at DESC LIMIT 100"
	return queryList(ctx, s.q, s.ScanBrandRows, query, args...)
}

// ===== 雇主品牌（brandType=employer，LEFT JOIN partner_enterprises 附带引用企业资料） =====

// employerBrandSelect 雇主品牌查询列（扫描顺序与 ScanEmployerBrandRows 一致）。
const employerBrandSelect = `b.id, b.tenant_id, b.brand_type, b.name, b.status, b.is_public, b.is_featured,
	b.cover_image, b.cover_video, b.description, b.data,
	b.student_id, b.enterprise_id, b.position_id, b.major_id, b.teacher_id, b.expert_id,
	b.sort_order, b.view_count, b.created_at, b.updated_at,
	pe.name, pe.logo_url, pe.industry, pe.region, pe.description,
	pe.unified_social_credit_code, pe.contact_person, pe.contact_phone, pe.contact_email, pe.address`

func (s *AllianceStore) ScanEmployerBrandRows(rows pgx.Rows) ([]domain.EmployerBrand, error) {
	items := make([]domain.EmployerBrand, 0)
	for rows.Next() {
		var b domain.EmployerBrand
		var coverImage, coverVideo, description *string
		var studentID, enterpriseID, positionID, majorID, teacherID, expertID *string
		var data json.RawMessage
		if err := rows.Scan(&b.ID, &b.TenantID, &b.BrandType, &b.Name, &b.Status,
			&b.IsPublic, &b.IsFeatured, &coverImage, &coverVideo, &description,
			&data, &studentID, &enterpriseID, &positionID, &majorID, &teacherID, &expertID,
			&b.SortOrder, &b.ViewCount, &b.CreatedAt, &b.UpdatedAt,
			&b.EnterpriseName, &b.EnterpriseLogo, &b.EnterpriseIndustry, &b.EnterpriseRegion,
			&b.EnterpriseDescription, &b.EnterpriseCreditCode, &b.EnterpriseContactPerson,
			&b.EnterpriseContactPhone, &b.EnterpriseContactEmail, &b.EnterpriseAddress); err != nil {
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
	return items, rows.Err()
}

// ListEmployerBrands 雇主品牌列表（含引用企业资料，支持名称搜索与分页）。
func (s *AllianceStore) ListEmployerBrands(ctx context.Context, tenantID, search string, limit, offset int) ([]domain.EmployerBrand, int, error) {
	args := []any{tenantID}
	where := "b.tenant_id = $1 AND b.brand_type = 'employer'"
	if search != "" {
		args = append(args, "%"+search+"%")
		where += " AND (b.name ILIKE $" + Itoa(len(args)) + " OR pe.name ILIKE $" + Itoa(len(args)) + ")"
	}
	var total int
	if err := s.q.QueryRow(ctx, `
		SELECT COUNT(*) FROM alliance_brands b
		LEFT JOIN partner_enterprises pe ON pe.id = b.enterprise_id
		WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 20
	}
	items, err := queryList(ctx, s.q, s.ScanEmployerBrandRows, `
		SELECT `+employerBrandSelect+`
		FROM alliance_brands b
		LEFT JOIN partner_enterprises pe ON pe.id = b.enterprise_id
		WHERE `+where+`
		ORDER BY b.sort_order ASC, b.created_at DESC
		LIMIT `+Itoa(limit)+` OFFSET `+Itoa(offset), args...)
	return items, total, err
}

// GetEmployerBrandByID 雇主品牌详情（含引用企业资料）。
func (s *AllianceStore) GetEmployerBrandByID(ctx context.Context, id, tenantID string) (*domain.EmployerBrand, error) {
	return queryOne(ctx, s.q, s.ScanEmployerBrandRows, `
		SELECT `+employerBrandSelect+`
		FROM alliance_brands b
		LEFT JOIN partner_enterprises pe ON pe.id = b.enterprise_id
		WHERE b.id = $1 AND b.tenant_id = $2`, id, tenantID)
}

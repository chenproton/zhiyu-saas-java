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
	isPublic, isFeatured := false, false
	if b.IsPublic != nil {
		isPublic = *b.IsPublic
	}
	if b.IsFeatured != nil {
		isFeatured = *b.IsFeatured
	}
	_, err := s.q.Exec(ctx, `
		INSERT INTO alliance_brands (id, tenant_id, brand_type, name, status, is_public,
			is_featured, cover_image, cover_video, description, data,
			student_id, enterprise_id, position_id, major_id, teacher_id, expert_id,
			sort_order, view_count, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW())
	`, id, b.TenantID, b.BrandType, b.Name, b.Status, isPublic, isFeatured,
		b.CoverImage, b.CoverVideo, b.Description, b.Data,
		b.StudentID, b.EnterpriseID, b.PositionID, b.MajorID, b.TeacherID, b.ExpertID,
		b.SortOrder, b.ViewCount)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateBrand(ctx context.Context, id, tenantID string, b *domain.AllianceBrand) error {
	// 部分更新兜底在 handler 层（ValidateUpdateExisting）保证 IsPublic/IsFeatured 非空
	isPublic, isFeatured := false, false
	if b.IsPublic != nil {
		isPublic = *b.IsPublic
	}
	if b.IsFeatured != nil {
		isFeatured = *b.IsFeatured
	}
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_brands SET
			name = $1, status = $2, is_public = $3, is_featured = $4, cover_image = $5,
			cover_video = $6, description = $7, data = $8,
			student_id = $9, enterprise_id = $10, position_id = $11, major_id = $12,
			teacher_id = $13, expert_id = $14, sort_order = $15, updated_at = NOW()
		WHERE id = $16 AND tenant_id = $17
	`, b.Name, b.Status, isPublic, isFeatured, b.CoverImage, b.CoverVideo,
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
func (s *AllianceStore) ListPublicBrands(ctx context.Context, brandType string) ([]domain.PublicBrandItem, error) {
	query := `SELECT ` + publicBrandSelect + `
		FROM ` + publicBrandFrom + `
		WHERE b.is_public = true AND b.status <> 'archived'`
	args := []interface{}{}
	if brandType != "" {
		query += " AND b.brand_type = $1"
		args = append(args, brandType)
	}
	query += " ORDER BY b.sort_order ASC, b.created_at DESC LIMIT 100"
	return queryList(ctx, s.q, s.ScanPublicBrandRows, query, args...)
}

// ===== 前台公开品牌视图（按品牌类型附带关联对象资料） =====

// publicBrandSelect 前台品牌查询列（扫描顺序与 ScanPublicBrandRows 一致）：
// 品牌基础列 + 引用企业资料 + 关联岗位资料（含职责/证书） + 教师/企业专家资料。
const publicBrandSelect = `b.id, b.tenant_id, b.brand_type, b.name, b.status, b.is_public, b.is_featured,
	b.cover_image, b.cover_video, b.description, b.data,
	b.student_id, b.enterprise_id, b.position_id, b.major_id, b.teacher_id, b.expert_id,
	b.sort_order, b.view_count, b.created_at, b.updated_at,
	pe.name, pe.logo_url, pe.industry, pe.region, pe.description,
	pe.unified_social_credit_code, pe.contact_person, pe.contact_phone, pe.contact_email, pe.address,
	pe.established_year, pe.employee_count, pe.cover_image,
	COALESCE(pe.cover_photos, '[]'), COALESCE(pe.business_license_photos, '[]'),
	COALESCE(pe.intellectual_property_photos, '[]'), COALESCE(pe.qualification_photos, '[]'),
	COALESCE(cp.name, ''), COALESCE(cp.position_type, ''), cp.salary_min, cp.salary_max,
	COALESCE(maj.major_names, '{}'), ind.name, COALESCE(cp.status, ''),
	cp.description, COALESCE(cp.requirements, '{}'), cp.career_path, cp.cover_image,
	COALESCE((
		SELECT jsonb_agg(jsonb_build_object(
			'id', r.id, 'careerPositionId', r.career_position_id,
			'name', r.name, 'description', r.description, 'sortOrder', r.sort_order
		) ORDER BY r.sort_order)
		FROM position_responsibilities r WHERE r.career_position_id = cp.id
	), '[]'),
	COALESCE((
		SELECT jsonb_agg(jsonb_build_object(
			'id', pc.id, 'careerPositionId', pc.career_position_id,
			'certificateLibraryId', pc.certificate_library_id,
			'name', cl.name, 'url', cl.url, 'description', cl.description, 'imageUrl', cl.image_url
		) ORDER BY cl.name)
		FROM position_certificates pc JOIN certificate_library cl ON cl.id = pc.certificate_library_id
		WHERE pc.career_position_id = cp.id
	), '[]'),
	COALESCE(ae.name, u.name, ''), COALESCE(ae.avatar_url, u.avatar_url, ''),
	ae.title, ae.position, COALESCE(ae.organization, org.name, ''), ae.industry,
	ae.experience_years, ae.education, ae.introduction, ae.work_experience, ae.city,
	ae.expert_type, ae.rating, ae.status, ae.gender, ae.age,
	COALESCE(ae.specialties, '[]'), COALESCE(ae.professional_fields, '[]'), COALESCE(ae.attachments, '[]')`

// publicBrandFrom 前台品牌查询 FROM 片段：
// 引用企业（partner_enterprises）/ 关联岗位（career_positions + 专业/行业）/ 教师（users + 组织）/
// 企业专家（alliance_experts：expertId 直连，或 teacherId 关联的校本教师专家档案副本）。
const publicBrandFrom = `alliance_brands b
	LEFT JOIN partner_enterprises pe ON pe.id = b.enterprise_id
	LEFT JOIN career_positions cp ON cp.id = b.position_id
	LEFT JOIN LATERAL (
		SELECT COALESCE(array_agg(m.name ORDER BY cpm.major_id), '{}') AS major_names
		FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id
		WHERE cpm.career_position_id = cp.id
	) maj ON true
	LEFT JOIN industries ind ON ind.id = cp.industry_id
	LEFT JOIN users u ON u.id = b.teacher_id
	LEFT JOIN organizations org ON org.id = u.org_node_id
	LEFT JOIN alliance_experts ae ON
		(b.teacher_id IS NOT NULL AND ae.user_id = b.teacher_id AND ae.tenant_id = b.tenant_id AND ae.enterprise_id IS NULL)
		OR (b.expert_id IS NOT NULL AND ae.id = b.expert_id)`

// ScanPublicBrandRows 扫描前台品牌行（含关联对象资料）。
func (s *AllianceStore) ScanPublicBrandRows(rows pgx.Rows) ([]domain.PublicBrandItem, error) {
	items := make([]domain.PublicBrandItem, 0)
	for rows.Next() {
		var b domain.PublicBrandItem
		var coverImage, coverVideo, description *string
		var studentID, enterpriseID, positionID, majorID, teacherID, expertID *string
		var data json.RawMessage
		var entCoverPhotos, entLicensePhotos, entIPPhotos, entQualPhotos json.RawMessage
		var personSpecialties, personProfessionalFields, personAttachments json.RawMessage
		if err := rows.Scan(&b.ID, &b.TenantID, &b.BrandType, &b.Name, &b.Status,
			&b.IsPublic, &b.IsFeatured, &coverImage, &coverVideo, &description,
			&data, &studentID, &enterpriseID, &positionID, &majorID, &teacherID, &expertID,
			&b.SortOrder, &b.ViewCount, &b.CreatedAt, &b.UpdatedAt,
			&b.EnterpriseName, &b.EnterpriseLogo, &b.EnterpriseIndustry, &b.EnterpriseRegion,
			&b.EnterpriseDescription, &b.EnterpriseCreditCode, &b.EnterpriseContactPerson,
			&b.EnterpriseContactPhone, &b.EnterpriseContactEmail, &b.EnterpriseAddress,
			&b.EnterpriseEstablishedYear, &b.EnterpriseEmployeeCount, &b.EnterpriseCoverImage,
			&entCoverPhotos, &entLicensePhotos, &entIPPhotos, &entQualPhotos,
			&b.PositionName, &b.PositionType, &b.SalaryMin, &b.SalaryMax,
			&b.MajorNames, &b.IndustryName, &b.PositionStatus,
			&b.PositionDescription, &b.PositionRequirements, &b.PositionCareerPath, &b.PositionCoverImage,
			&b.Responsibilities, &b.Certificates,
			&b.PersonName, &b.PersonAvatar, &b.PersonTitle, &b.PersonPosition,
			&b.PersonOrganization, &b.PersonIndustry, &b.PersonExperienceYears, &b.PersonEducation,
			&b.PersonIntroduction, &b.PersonWorkExperience, &b.PersonCity,
			&b.PersonExpertType, &b.PersonRating, &b.PersonStatus, &b.PersonGender, &b.PersonAge,
			&personSpecialties, &personProfessionalFields, &personAttachments); err != nil {
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
		b.EnterpriseCoverPhotos = entCoverPhotos
		b.EnterpriseLicensePhotos = entLicensePhotos
		b.EnterpriseIPPhotos = entIPPhotos
		b.EnterpriseQualPhotos = entQualPhotos
		b.PersonSpecialties = personSpecialties
		b.PersonProfessionalFields = personProfessionalFields
		b.PersonAttachments = personAttachments
		if b.Responsibilities == nil {
			b.Responsibilities = []domain.PositionResponsibility{}
		}
		if b.Certificates == nil {
			b.Certificates = []domain.PositionCertificate{}
		}
		items = append(items, b)
	}
	return items, rows.Err()
}

// GetPublicBrandByID 前台品牌详情（含关联对象资料）。
func (s *AllianceStore) GetPublicBrandByID(ctx context.Context, id string) (*domain.PublicBrandItem, error) {
	item, err := queryOne(ctx, s.q, s.ScanPublicBrandRows, `
		SELECT `+publicBrandSelect+`
		FROM `+publicBrandFrom+`
		WHERE b.id = $1 AND b.is_public = true AND b.status <> 'archived'
	`, id)
	if err != nil {
		return nil, err
	}
	// 雇主品牌已招聘学生补充专业名称（读时按 users.major_id 关联 majors）
	s.enrichHiredStudentMajors(ctx, item)
	return item, nil
}

// hiredStudentRef 雇主品牌 data.hiredStudents 快照（读时补充专业名称）。
type hiredStudentRef struct {
	StudentID string `json:"studentId"`
	Name      string `json:"name"`
	StudentNo string `json:"studentNo,omitempty"`
	JobID     string `json:"jobId"`
	JobName   string `json:"jobName,omitempty"`
	MajorName string `json:"majorName,omitempty"`
}

// enrichHiredStudentMajors 为雇主品牌已招聘学生补充专业名称（用户主专业）。
func (s *AllianceStore) enrichHiredStudentMajors(ctx context.Context, item *domain.PublicBrandItem) {
	if item == nil || item.BrandType != "employer" || len(item.Data) == 0 {
		return
	}
	var payload struct {
		HiredStudents []hiredStudentRef `json:"hiredStudents"`
	}
	if err := json.Unmarshal(item.Data, &payload); err != nil || len(payload.HiredStudents) == 0 {
		return
	}
	ids := make([]string, 0, len(payload.HiredStudents))
	for _, hs := range payload.HiredStudents {
		if hs.StudentID != "" {
			ids = append(ids, hs.StudentID)
		}
	}
	if len(ids) == 0 {
		return
	}
	rows, err := s.q.Query(ctx, `
		SELECT u.id::text, m.name
		FROM users u LEFT JOIN majors m ON m.id = u.major_id
		WHERE u.id = ANY($1)
	`, ids)
	if err != nil {
		return
	}
	defer rows.Close()
	majorByUser := map[string]string{}
	for rows.Next() {
		var userID, majorName string
		if err := rows.Scan(&userID, &majorName); err == nil {
			majorByUser[userID] = majorName
		}
	}
	for i := range payload.HiredStudents {
		payload.HiredStudents[i].MajorName = majorByUser[payload.HiredStudents[i].StudentID]
	}
	var dataMap map[string]json.RawMessage
	if err := json.Unmarshal(item.Data, &dataMap); err != nil {
		return
	}
	updated, err := json.Marshal(payload.HiredStudents)
	if err != nil {
		return
	}
	dataMap["hiredStudents"] = updated
	if merged, err := json.Marshal(dataMap); err == nil {
		item.Data = merged
	}
}

// ===== 雇主品牌（brandType=employer，LEFT JOIN partner_enterprises 附带引用企业资料） =====

// employerBrandSelect 雇主品牌查询列（扫描顺序与 ScanEmployerBrandRows 一致）。
const employerBrandSelect = `b.id, b.tenant_id, b.brand_type, b.name, b.status, b.is_public, b.is_featured,
	b.cover_image, b.cover_video, b.description, b.data,
	b.student_id, b.enterprise_id, b.position_id, b.major_id, b.teacher_id, b.expert_id,
	b.sort_order, b.view_count, b.created_at, b.updated_at,
	pe.name, pe.logo_url, pe.industry, pe.region, pe.description,
	pe.unified_social_credit_code, pe.contact_person, pe.contact_phone, pe.contact_email, pe.address,
	pe.established_year, pe.employee_count, pe.cover_image,
	COALESCE(pe.cover_photos, '[]'), COALESCE(pe.business_license_photos, '[]'),
	COALESCE(pe.intellectual_property_photos, '[]'), COALESCE(pe.qualification_photos, '[]')`

func (s *AllianceStore) ScanEmployerBrandRows(rows pgx.Rows) ([]domain.EmployerBrand, error) {
	items := make([]domain.EmployerBrand, 0)
	for rows.Next() {
		var b domain.EmployerBrand
		var coverImage, coverVideo, description *string
		var studentID, enterpriseID, positionID, majorID, teacherID, expertID *string
		var data json.RawMessage
		var entCoverPhotos, entLicensePhotos, entIPPhotos, entQualPhotos json.RawMessage
		if err := rows.Scan(&b.ID, &b.TenantID, &b.BrandType, &b.Name, &b.Status,
			&b.IsPublic, &b.IsFeatured, &coverImage, &coverVideo, &description,
			&data, &studentID, &enterpriseID, &positionID, &majorID, &teacherID, &expertID,
			&b.SortOrder, &b.ViewCount, &b.CreatedAt, &b.UpdatedAt,
			&b.EnterpriseName, &b.EnterpriseLogo, &b.EnterpriseIndustry, &b.EnterpriseRegion,
			&b.EnterpriseDescription, &b.EnterpriseCreditCode, &b.EnterpriseContactPerson,
			&b.EnterpriseContactPhone, &b.EnterpriseContactEmail, &b.EnterpriseAddress,
			&b.EnterpriseEstablishedYear, &b.EnterpriseEmployeeCount, &b.EnterpriseCoverImage,
			&entCoverPhotos, &entLicensePhotos, &entIPPhotos, &entQualPhotos); err != nil {
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
		b.EnterpriseCoverPhotos = entCoverPhotos
		b.EnterpriseLicensePhotos = entLicensePhotos
		b.EnterpriseIPPhotos = entIPPhotos
		b.EnterpriseQualPhotos = entQualPhotos
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

// ===== 岗位品牌（brandType=job，LEFT JOIN career_positions 附带关联岗位资料） =====

// jobBrandSelect 岗位品牌查询列（扫描顺序与 ScanJobBrandRows 一致）。
const jobBrandSelect = `b.id, b.tenant_id, b.brand_type, b.name, b.status, b.is_public, b.is_featured,
	b.cover_image, b.cover_video, b.description, b.data,
	b.student_id, b.enterprise_id, b.position_id, b.major_id, b.teacher_id, b.expert_id,
	b.sort_order, b.view_count, b.created_at, b.updated_at,
	COALESCE(cp.name, ''), COALESCE(cp.position_type, ''),
	cp.salary_min, cp.salary_max, COALESCE(maj.major_names, '{}'),
	COALESCE(cp.status, '')`

// ScanJobBrandRows 扫描岗位品牌行（含关联岗位资料）。
func (s *AllianceStore) ScanJobBrandRows(rows pgx.Rows) ([]domain.JobBrand, error) {
	items := make([]domain.JobBrand, 0)
	for rows.Next() {
		var b domain.JobBrand
		var coverImage, coverVideo, description *string
		var studentID, enterpriseID, positionID, majorID, teacherID, expertID *string
		var data json.RawMessage
		if err := rows.Scan(&b.ID, &b.TenantID, &b.BrandType, &b.Name, &b.Status,
			&b.IsPublic, &b.IsFeatured, &coverImage, &coverVideo, &description,
			&data, &studentID, &enterpriseID, &positionID, &majorID, &teacherID, &expertID,
			&b.SortOrder, &b.ViewCount, &b.CreatedAt, &b.UpdatedAt,
			&b.PositionName, &b.PositionType, &b.SalaryMin, &b.SalaryMax,
			&b.MajorNames, &b.PositionStatus); err != nil {
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

// jobBrandFrom 岗位品牌查询 FROM 片段（品牌 LEFT JOIN 岗位 + 岗位专业名）。
const jobBrandFrom = `alliance_brands b
	LEFT JOIN career_positions cp ON cp.id = b.position_id
	LEFT JOIN LATERAL (
		SELECT COALESCE(array_agg(m.name ORDER BY cpm.major_id), '{}') AS major_names
		FROM career_position_majors cpm LEFT JOIN majors m ON m.id = cpm.major_id
		WHERE cpm.career_position_id = cp.id
	) maj ON true`

// ListJobBrands 岗位品牌列表（含关联岗位资料，支持名称搜索与分页）。
func (s *AllianceStore) ListJobBrands(ctx context.Context, tenantID, search string, limit, offset int) ([]domain.JobBrand, int, error) {
	args := []any{tenantID}
	where := "b.tenant_id = $1 AND b.brand_type = 'job'"
	if search != "" {
		args = append(args, "%"+search+"%")
		where += " AND (b.name ILIKE $" + Itoa(len(args)) + " OR COALESCE(cp.name, '') ILIKE $" + Itoa(len(args)) + ")"
	}
	var total int
	if err := s.q.QueryRow(ctx, `
		SELECT COUNT(*) FROM alliance_brands b
		LEFT JOIN career_positions cp ON cp.id = b.position_id
		WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 20
	}
	items, err := queryList(ctx, s.q, s.ScanJobBrandRows, `
		SELECT `+jobBrandSelect+`
		FROM `+jobBrandFrom+`
		WHERE `+where+`
		ORDER BY b.sort_order ASC, b.created_at DESC
		LIMIT `+Itoa(limit)+` OFFSET `+Itoa(offset), args...)
	return items, total, err
}

// GetJobBrandByID 岗位品牌详情（含关联岗位资料）。
func (s *AllianceStore) GetJobBrandByID(ctx context.Context, id, tenantID string) (*domain.JobBrand, error) {
	return queryOne(ctx, s.q, s.ScanJobBrandRows, `
		SELECT `+jobBrandSelect+`
		FROM `+jobBrandFrom+`
		WHERE b.id = $1 AND b.tenant_id = $2`, id, tenantID)
}

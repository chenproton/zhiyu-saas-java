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

// ===== 专家（alliance_experts，tenant_id = 企业租户） =====

// expertColumns 专家全列（唯一列清单，扫描顺序与 ScanExpertRows 一致）。
const expertColumns = "id, tenant_id, name, gender, age, title, position, expert_type, industry, professional_fields, specialties, experience_years, education, introduction, work_experience, city, avatar_url, cover_image, photos, attachments, enterprise_id, organization, rating, status, partner_source, position_direction, secondary_colleges, is_public, user_id, created_by, created_at, updated_at"

func (s *AllianceStore) ScanExpertRows(rows pgx.Rows) ([]domain.AllianceExpert, error) {
	items := make([]domain.AllianceExpert, 0)
	for rows.Next() {
		var e domain.AllianceExpert
		var gender, ttl, pos, etype, industry, edu, intro, workExp, city, avatar *string
		var age, expYrs *int
		var proFields, specs, photos, attachs json.RawMessage
		var rating, enterpriseID, coverImage, partnerSource, positionDirection, organization *string
		var colleges json.RawMessage
		var userID, createdBy *string
		var isPublic bool
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &gender, &age, &ttl, &pos,
			&etype, &industry, &proFields, &specs, &expYrs, &edu, &intro, &workExp,
			&city, &avatar, &coverImage, &photos, &attachs, &enterpriseID, &organization, &rating,
			&e.Status, &partnerSource, &positionDirection, &colleges, &isPublic, &userID, &createdBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
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
		e.UserID = userID
		e.CreatedBy = createdBy
		e.IsPublic = &isPublic
		items = append(items, e)
	}
	return items, rows.Err()
}

// ListConfig 返回专家列表查询配置，SQL 片段沉淀在 store 层。
func (s *AllianceStore) ListExpertsConfig() ListQueryConfig[domain.AllianceExpert] {
	return ListQueryConfig[domain.AllianceExpert]{
		Table:         "alliance_experts",
		SelectColumns: expertColumns,
		TenantScoped:  true,
		SearchColumns: []string{"name", "title", "industry"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if enterpriseID := p.Values["enterpriseId"]; enterpriseID != "" {
				qb.AddCondition("enterprise_id = " + qb.NextArg(enterpriseID))
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
			enterprise_id, organization, rating, status, partner_source, position_direction, secondary_colleges, is_public, user_id, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW(),NOW())
	`, id, e.TenantID, e.Name, e.Gender, e.Age, e.Title, e.Position, e.ExpertType,
		e.Industry, emptyJSON(e.ProfessionalFields), emptyJSON(e.Specialties), e.ExperienceYears,
		e.Education, e.Introduction, e.WorkExperience, e.City, e.AvatarURL, e.CoverImage,
		emptyJSON(e.Photos), emptyJSON(e.Attachments), e.EnterpriseID, e.Organization, e.Rating,
		e.Status, e.PartnerSource, e.PositionDirection, emptyJSON(e.SecondaryColleges), BoolVal(e.IsPublic), e.UserID, e.CreatedBy)
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
			secondary_colleges = $25, is_public = $26, user_id = $27, updated_at = NOW()
		WHERE id = $28 AND tenant_id = $29
	`, e.Name, e.Gender, e.Age, e.Title, e.Position, e.ExpertType, e.Industry,
		emptyJSON(e.ProfessionalFields), emptyJSON(e.Specialties), e.ExperienceYears,
		e.Education, e.Introduction, e.WorkExperience, e.City, e.AvatarURL, e.CoverImage,
		emptyJSON(e.Photos), emptyJSON(e.Attachments), e.EnterpriseID, e.Organization, e.Rating,
		e.Status, e.PartnerSource, e.PositionDirection, emptyJSON(e.SecondaryColleges), BoolVal(e.IsPublic), e.UserID, id, tenantID)
	return err
}

func (s *AllianceStore) DeleteExpert(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_experts WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// GetExpertByID 按 ID + 企业租户查询专家（企业服务台自身数据）。
func (s *AllianceStore) GetExpertByID(ctx context.Context, id, tenantID string) (*domain.AllianceExpert, error) {
	return queryOne(ctx, s.q, s.ScanExpertRows, `
		SELECT `+expertColumns+`
		FROM alliance_experts WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
}

// DeleteExpertAccountReferences 删除专家账号关联（评审步骤引用清理 + 角色 + 用户）。
// service 层 DeleteExpertWithAccount 事务内调用；SQL 唯一所在地。
func (s *AllianceStore) DeleteExpertAccountReferences(ctx context.Context, tx Queryer, userID string) error {
	// 从评审步骤的评审人数组中移除该账号（数组列无 FK，防悬空引用）
	if _, err := tx.Exec(ctx, `
		UPDATE task_review_steps SET assigned_user_ids = array_remove(assigned_user_ids, $1)
		WHERE $1::uuid = ANY(assigned_user_ids)
	`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID); err != nil {
		return err
	}
	return nil
}

// GetExpertByUserID 专家本人档案（按绑定账号 user_id 查询，同租户内）。
func (s *AllianceStore) GetExpertByUserID(ctx context.Context, tenantID, userID string) (*domain.AllianceExpert, error) {
	return queryOne(ctx, s.q, s.ScanExpertRows, `
		SELECT `+expertColumns+`
		FROM alliance_experts WHERE tenant_id = $1 AND user_id = $2
	`, tenantID, userID)
}

// AllianceExpertListFilter 学校侧专家列表筛选参数。
type AllianceExpertListFilter struct {
	Search string
	Status string
	Limit  int
	Offset int
}

// ListByEnterpriseIDs 跨租户只读：按企业 ID 集合查询专家（学校侧按已引入企业加载）。
// 支持按姓名/职称/行业关键字、状态筛选以及 limit/offset 分页，返回结果与总条数。
// 越权防线下沉到 SQL：企业必须已引入本校（links 存在且未终止），不再依赖调用方自觉。
func (s *AllianceStore) ListByEnterpriseIDs(ctx context.Context, tenantID string, enterpriseIDs []string, filter AllianceExpertListFilter) ([]domain.AllianceExpert, int, error) {
	if len(enterpriseIDs) == 0 {
		return []domain.AllianceExpert{}, 0, nil
	}
	if filter.Limit <= 0 {
		filter.Limit = 200
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	where := []string{
		"x.enterprise_id = ANY($1::uuid[])",
		"EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id AND l.tenant_id = $2 AND l.status <> 'terminated')",
	}
	args := []any{enterpriseIDs, tenantID}
	idx := 3

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(x.name ILIKE $%d OR x.title ILIKE $%d OR x.industry ILIKE $%d)", idx, idx, idx))
		args = append(args, "%"+filter.Search+"%")
		idx++
	}
	if filter.Status != "" {
		where = append(where, fmt.Sprintf("x.status = $%d", idx))
		args = append(args, filter.Status)
		idx++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	if err := s.q.QueryRow(ctx, "SELECT COUNT(*) FROM alliance_experts x WHERE "+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	dataArgs := append([]any{}, args...)
	dataArgs = append(dataArgs, filter.Limit, filter.Offset)
	items, err := queryList(ctx, s.q, s.ScanExpertRows, `
		SELECT `+expertColumnsQualified+`
		FROM alliance_experts x
		WHERE `+whereClause+`
		ORDER BY x.created_at DESC
		LIMIT $`+strconv.Itoa(idx)+` OFFSET $`+strconv.Itoa(idx+1)+`
	`, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetExpertByIDGlobal 按 ID 查询专家（跨租户只读；调用方须先做归属校验）。
func (s *AllianceStore) GetExpertByIDGlobal(ctx context.Context, id string) (*domain.AllianceExpert, error) {
	return queryOne(ctx, s.q, s.ScanExpertRows, `
		SELECT `+expertColumns+`
		FROM alliance_experts WHERE id = $1
	`, id)
}

// expertColumnsQualified 专家全列带表别名前缀（public 查询 JOIN partner_enterprises 时用，
// 避免 id/name/status 等两表共有列名歧义；扫描顺序与 expertColumns 一致）。
const expertColumnsQualified = "x.id, x.tenant_id, x.name, x.gender, x.age, x.title, x.position, x.expert_type, x.industry, x.professional_fields, x.specialties, x.experience_years, x.education, x.introduction, x.work_experience, x.city, x.avatar_url, x.cover_image, x.photos, x.attachments, x.enterprise_id, x.organization, x.rating, x.status, x.partner_source, x.position_direction, x.secondary_colleges, x.is_public, x.user_id, x.created_by, x.created_at, x.updated_at"

// publicExpertColumns 公开专家列：专家全列（带前缀）+ 企业名称（前台展示归属企业用）。
// 扫描顺序与 ScanPublicExpertRows 一致。
const publicExpertColumns = expertColumnsQualified + `, pe.name AS enterprise_name`

func (s *AllianceStore) ScanPublicExpertRows(rows pgx.Rows) ([]domain.AllianceExpert, error) {
	items := make([]domain.AllianceExpert, 0)
	for rows.Next() {
		var e domain.AllianceExpert
		var gender, ttl, pos, etype, industry, edu, intro, workExp, city, avatar *string
		var age, expYrs *int
		var proFields, specs, photos, attachs json.RawMessage
		var rating, enterpriseID, coverImage, partnerSource, positionDirection, organization, enterpriseName *string
		var colleges json.RawMessage
		var userID, createdBy *string
		var isPublic bool
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &gender, &age, &ttl, &pos,
			&etype, &industry, &proFields, &specs, &expYrs, &edu, &intro, &workExp,
			&city, &avatar, &coverImage, &photos, &attachs, &enterpriseID, &organization, &rating,
			&e.Status, &partnerSource, &positionDirection, &colleges, &isPublic, &userID, &createdBy, &e.CreatedAt, &e.UpdatedAt,
			&enterpriseName); err != nil {
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
		e.EnterpriseName = enterpriseName
		e.Organization = organization
		e.Rating = rating
		e.PartnerSource = partnerSource
		e.PositionDirection = positionDirection
		e.SecondaryColleges = colleges
		e.UserID = userID
		e.CreatedBy = createdBy
		e.IsPublic = &isPublic
		items = append(items, e)
	}
	return items, rows.Err()
}

// ListPublicExperts 门户前台公开专家列表（双控：企业 enable_public + 专家 is_public；
// 带 tenantID 时叠加该校 link.is_public 且合作未终止，§3.2）。
// includeNonPublic=true 时忽略专家 is_public 条件（仅企业/学校侧公开校验仍生效），
// 供企业详情页"专家团队"使用：专家是否上联盟首页（is_public）不影响企业页展示。返回含企业名称。
// limit/offset 分页；limit<=0 时默认 100。
func (s *AllianceStore) ListPublicExperts(ctx context.Context, tenantID string, limit, offset int, includeNonPublic bool) ([]domain.AllianceExpert, error) {
	if limit <= 0 {
		limit = 100
	}
	publicCond := "x.is_public = true"
	if includeNonPublic {
		publicCond = "true"
	}
	if tenantID != "" {
		return queryList(ctx, s.q, s.ScanPublicExpertRows, `
			SELECT `+publicExpertColumns+`
			FROM alliance_experts x
			JOIN partner_enterprises pe ON pe.id = x.enterprise_id
			WHERE `+publicCond+` AND x.status = 'active' AND pe.enable_public = true
			  AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id AND l.tenant_id = $1 AND l.is_public = true AND l.status <> 'terminated')
			ORDER BY x.created_at DESC LIMIT $2 OFFSET $3
		`, tenantID, limit, offset)
	}
	return queryList(ctx, s.q, s.ScanPublicExpertRows, `
		SELECT `+publicExpertColumns+`
		FROM alliance_experts x
		JOIN partner_enterprises pe ON pe.id = x.enterprise_id
		WHERE `+publicCond+` AND x.status = 'active' AND pe.enable_public = true
		ORDER BY x.created_at DESC LIMIT $1 OFFSET $2
	`, limit, offset)
}

func (s *AllianceStore) GetPublicExpertByID(ctx context.Context, id, tenantID string) (*domain.AllianceExpert, error) {
	if tenantID != "" {
		return queryOne(ctx, s.q, s.ScanPublicExpertRows, `
			SELECT `+publicExpertColumns+`
			FROM alliance_experts x
			JOIN partner_enterprises pe ON pe.id = x.enterprise_id
			WHERE x.id = $1 AND x.is_public = true AND x.status = 'active' AND pe.enable_public = true
			  AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id AND l.tenant_id = $2 AND l.is_public = true AND l.status <> 'terminated')
		`, id, tenantID)
	}
	return queryOne(ctx, s.q, s.ScanPublicExpertRows, `
		SELECT `+publicExpertColumns+`
		FROM alliance_experts x
		JOIN partner_enterprises pe ON pe.id = x.enterprise_id
		WHERE x.id = $1 AND x.is_public = true AND x.status = 'active' AND pe.enable_public = true
	`, id)
}

// UpdateExpertIsPublic 学校侧维护专家"前台展示"开关（跨租户更新专家 is_public；
// SQL 内强制企业已引入本校（links 存在且未终止），不再依赖调用方先校验）。
func (s *AllianceStore) UpdateExpertIsPublic(ctx context.Context, id, tenantID string, isPublic bool) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_experts SET is_public = $2, updated_at = NOW()
		WHERE id = $1 AND EXISTS (
			SELECT 1 FROM alliance_enterprise_links l
			WHERE l.enterprise_id = alliance_experts.enterprise_id
			  AND l.tenant_id = $3 AND l.status <> 'terminated'
		)
	`, id, isPublic, tenantID)
	return err
}

// ListMentorOptionsBySchoolTenant 共建导师选择器数据源（GET /alliance/experts/mentor-options）：
// 本校已引入企业的全部专家，携带绑定账号（partner 平台 users.id，null=无账号不可选）。
func (s *AllianceStore) ListMentorOptionsBySchoolTenant(ctx context.Context, tenantID string) ([]domain.AllianceMentorOption, error) {
	rows, err := s.q.Query(ctx, `
		SELECT x.id, x.name, x.title, e.id, e.name, x.user_id
		FROM alliance_experts x
		JOIN alliance_enterprise_links l ON l.enterprise_id = x.enterprise_id AND l.tenant_id = $1
		JOIN partner_enterprises e ON e.id = x.enterprise_id
		ORDER BY e.name, x.created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.AllianceMentorOption, 0)
	for rows.Next() {
		var o domain.AllianceMentorOption
		if err := rows.Scan(&o.ExpertID, &o.Name, &o.Title, &o.EnterpriseID, &o.EnterpriseName, &o.UserID); err != nil {
			return nil, err
		}
		items = append(items, o)
	}
	return items, rows.Err()
}

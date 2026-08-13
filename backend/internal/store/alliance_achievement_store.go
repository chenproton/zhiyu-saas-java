package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ===== 合作成果 =====

func (s *AllianceStore) ScanAchievementRows(rows pgx.Rows) ([]domain.AllianceAchievement, error) {
	items := make([]domain.AllianceAchievement, 0)
	for rows.Next() {
		var a domain.AllianceAchievement
		var description, coverImage, citationReason *string
		var achievementDate *time.Time
		var attachments, images, ownerPersons, coBuilders, enterpriseIDs, projectIDs, relatedPositions, relatedScenes, relatedCourses, colleges json.RawMessage
		var createdBy *string
		var isPublic bool
		if err := rows.Scan(&a.ID, &a.TenantID, &a.Title, &a.Type, &description, &achievementDate,
			&coverImage, &attachments, &citationReason, &images, &ownerPersons, &coBuilders,
			&enterpriseIDs, &projectIDs, &relatedPositions,
			&relatedScenes, &relatedCourses, &a.Status, &a.ViewCount, &colleges,
			&isPublic, &createdBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
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
	return items, rows.Err()
}

// ListConfig 返回合作成果列表查询配置，SQL 片段沉淀在 store 层。
func (s *AllianceStore) ListAchievementsConfig() ListQueryConfig[domain.AllianceAchievement] {
	return ListQueryConfig[domain.AllianceAchievement]{
		Table:         "alliance_achievements",
		SelectColumns: "id, tenant_id, title, type, description, achievement_date, cover_image, attachments, citation_reason, images, owner_persons, co_builders, enterprise_ids, project_ids, related_positions, related_scenes, related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"title"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if achieveType := p.Values["type"]; achieveType != "" {
				qb.AddCondition("type = " + qb.NextArg(achieveType))
			}
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: s.ScanAchievementRows,
	}
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
		a.Status, a.ViewCount, emptyJSON(a.SecondaryColleges), BoolVal(a.IsPublic), a.CreatedBy)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *AllianceStore) UpdateAchievement(ctx context.Context, id, tenantID string, a *domain.AllianceAchievement) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_achievements SET
			title = $1, type = $2, description = $3, achievement_date = $4, cover_image = $5,
			attachments = $6, citation_reason = $7, images = $8, owner_persons = $9, co_builders = $10,
			enterprise_ids = $11, project_ids = $12, related_positions = $13,
			related_scenes = $14, related_courses = $15, status = $16,
			secondary_colleges = $17, is_public = $18, updated_at = NOW()
		WHERE id = $19 AND tenant_id = $20
	`, a.Title, a.Type, a.Description, a.AchievementDate, a.CoverImage,
		emptyJSON(a.Attachments), a.CitationReason, emptyJSON(a.Images), emptyJSON(a.OwnerPersons), emptyJSON(a.CoBuilders),
		emptyJSON(a.EnterpriseIDs), emptyJSON(a.ProjectIDs),
		emptyJSON(a.RelatedPositions), emptyJSON(a.RelatedScenes), emptyJSON(a.RelatedCourses),
		a.Status, emptyJSON(a.SecondaryColleges), BoolVal(a.IsPublic), id, tenantID)
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
	var isPublic bool
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
		&isPublic, &createdBy, &a.CreatedAt, &a.UpdatedAt)
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

// ListPublicAchievements 门户前台公开成果列表：is_public 为唯一展示门槛，归属"双控通过的企业"
// （enterprise_ids 直接关联）或关联"双控通过的项目"（project_ids 二次关联，§3.2）；
// 带 tenantID 时限定该校自有成果且叠加 link.is_public 双控、排除已终止合作。
func (s *AllianceStore) ListPublicAchievements(ctx context.Context, tenantID string, limit, offset int) ([]domain.AllianceAchievement, error) {
	const cols = `id, tenant_id, title, type, description, achievement_date, cover_image,
		attachments, citation_reason, images, owner_persons, co_builders,
		enterprise_ids, project_ids, related_positions, related_scenes,
		related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at`
	if limit <= 0 {
		limit = 100
	}
	if tenantID != "" {
		return queryList(ctx, s.q, s.ScanAchievementRows, `
			SELECT `+cols+`
			FROM alliance_achievements a
			WHERE a.is_public = true
			  AND a.tenant_id = $1
			  AND (
				EXISTS (
					SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
					JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
					JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true AND l.status <> 'terminated'
				)
				OR EXISTS (
					SELECT 1 FROM jsonb_array_elements_text(a.project_ids) pid
					JOIN alliance_projects p ON p.id = pid::uuid AND p.is_public = true AND p.tenant_id = $1
					JOIN jsonb_array_elements_text(p.enterprise_ids) eid ON true
					JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
					JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true AND l.status <> 'terminated'
				)
			  )
			ORDER BY a.created_at DESC LIMIT $2 OFFSET $3
		`, tenantID, limit, offset)
	}
	return queryList(ctx, s.q, s.ScanAchievementRows, `
		SELECT `+cols+`
		FROM alliance_achievements a
		WHERE a.is_public = true
		  AND (
			EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
			)
			OR EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.project_ids) pid
				JOIN alliance_projects p ON p.id = pid::uuid AND p.is_public = true
				JOIN jsonb_array_elements_text(p.enterprise_ids) eid ON true
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
			)
		  )
		ORDER BY a.created_at DESC LIMIT $1 OFFSET $2
	`, limit, offset)
}

func (s *AllianceStore) GetPublicAchievementByID(ctx context.Context, id, tenantID string) (*domain.AllianceAchievement, error) {
	const cols = `id, tenant_id, title, type, description, achievement_date, cover_image,
		attachments, citation_reason, images, owner_persons, co_builders,
		enterprise_ids, project_ids, related_positions, related_scenes,
		related_courses, status, view_count, secondary_colleges, is_public, created_by, created_at, updated_at`
	if tenantID != "" {
		return queryOne(ctx, s.q, s.ScanAchievementRows, `
			SELECT `+cols+`
			FROM alliance_achievements a
			WHERE a.id = $1 AND a.is_public = true
			  AND a.tenant_id = $2
			  AND (
				EXISTS (
					SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
					JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
					JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $2 AND l.is_public = true AND l.status <> 'terminated'
				)
				OR EXISTS (
					SELECT 1 FROM jsonb_array_elements_text(a.project_ids) pid
					JOIN alliance_projects p ON p.id = pid::uuid AND p.is_public = true AND p.tenant_id = $2
					JOIN jsonb_array_elements_text(p.enterprise_ids) eid ON true
					JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
					JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $2 AND l.is_public = true AND l.status <> 'terminated'
				)
			  )
		`, id, tenantID)
	}
	return queryOne(ctx, s.q, s.ScanAchievementRows, `
		SELECT `+cols+`
		FROM alliance_achievements a
		WHERE a.id = $1 AND a.is_public = true
		  AND (
			EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
			)
			OR EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.project_ids) pid
				JOIN alliance_projects p ON p.id = pid::uuid AND p.is_public = true
				JOIN jsonb_array_elements_text(p.enterprise_ids) eid ON true
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
			)
		  )
	`, id)
}

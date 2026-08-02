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

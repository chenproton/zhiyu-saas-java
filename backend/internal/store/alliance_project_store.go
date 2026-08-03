package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

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
	return items, rows.Err()
}

// ListConfig 返回合作项目列表查询配置，SQL 片段沉淀在 store 层。
func (s *AllianceStore) ListProjectsConfig() ListQueryConfig[domain.AllianceProject] {
	return ListQueryConfig[domain.AllianceProject]{
		Table:         "alliance_projects",
		SelectColumns: "id, tenant_id, name, type, description, phase, publish_status, start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges, is_public, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if phase := p.Values["phase"]; phase != "" {
				qb.AddCondition("phase = " + qb.NextArg(phase))
			}
		},
		ScanRows: s.ScanProjectRows,
	}
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
	return items, rows.Err()
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

func (s *AllianceStore) GetMilestoneByID(ctx context.Context, id, tenantID string) (*domain.AllianceProjectMilestone, error) {
	var m domain.AllianceProjectMilestone
	var description *string
	var dueDate, completedDate *time.Time
	err := s.q.QueryRow(ctx, `
		SELECT id, tenant_id, project_id, name, description, due_date, completed_date,
			is_completed, sort_order, created_at, updated_at
		FROM alliance_project_milestones WHERE id = $1 AND tenant_id = $2
	`, id, tenantID).Scan(&m.ID, &m.TenantID, &m.ProjectID, &m.Name, &description,
		&dueDate, &completedDate, &m.IsCompleted, &m.SortOrder,
		&m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil, err
	}
	m.Description = description
	m.DueDate = formatDate(dueDate)
	m.CompletedDate = formatDate(completedDate)
	return &m, nil
}

func (s *AllianceStore) UpdateMilestone(ctx context.Context, id, tenantID string, m *domain.AllianceProjectMilestone) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_project_milestones SET
			name = $1, description = $2, due_date = $3, completed_date = $4,
			is_completed = $5, sort_order = $6, updated_at = NOW()
		WHERE id = $7 AND tenant_id = $8
	`, m.Name, m.Description, m.DueDate, m.CompletedDate, m.IsCompleted, m.SortOrder, id, tenantID)
	return err
}

func (s *AllianceStore) DeleteMilestone(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM alliance_project_milestones WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

func (s *AllianceStore) ListPublicProjects(ctx context.Context) ([]domain.AllianceProject, error) {
	return queryList(ctx, s.q, s.ScanProjectRows, `
		SELECT id, tenant_id, name, type, description, phase, publish_status,
			start_date, end_date, budget, cover_image, enterprise_ids, agreement_ids, secondary_colleges,
			is_public, created_by, created_at, updated_at
		FROM alliance_projects WHERE is_public = true AND publish_status = 'published'
		ORDER BY created_at DESC LIMIT 100
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

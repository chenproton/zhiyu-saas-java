package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

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
	return items, rows.Err()
}

// ListConfig 返回合作协议列表查询配置，SQL 片段沉淀在 store 层。
func (s *AllianceStore) ListAgreementsConfig() ListQueryConfig[domain.AllianceAgreement] {
	return ListQueryConfig[domain.AllianceAgreement]{
		Table:         "alliance_agreements",
		SelectColumns: "id, tenant_id, name, type, content, start_date, end_date, status, enterprise_ids, project_ids, attachments, created_by, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"name"},
		OrderBy:       "created_at DESC",
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
		ScanRows: s.ScanAgreementRows,
	}
}

// ScanPublicAgreementRows 扫描公开协议视图行（仅公开字段，无 content/attachments）。
func (s *AllianceStore) ScanPublicAgreementRows(rows pgx.Rows) ([]domain.AlliancePublicAgreement, error) {
	items := make([]domain.AlliancePublicAgreement, 0)
	for rows.Next() {
		var a domain.AlliancePublicAgreement
		var startDate, endDate *time.Time
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.Status, &startDate, &endDate, &a.EnterpriseIDs); err != nil {
			return nil, err
		}
		a.StartDate = formatDate(startDate)
		a.EndDate = formatDate(endDate)
		items = append(items, a)
	}
	return items, rows.Err()
}

// ListPublicAgreements 门户前台公开协议列表：排除草稿，且至少关联一家"双控通过的企业"
// （enterprise_ids 关联判断，参照 ListPublicProjects）；带 tenantID 时限定该校协议并叠加
// link.is_public 双控。仅返回公开字段，content/attachments 不下发。
func (s *AllianceStore) ListPublicAgreements(ctx context.Context, tenantID string) ([]domain.AlliancePublicAgreement, error) {
	const cols = `id, name, type, status, start_date, end_date, enterprise_ids`
	if tenantID != "" {
		return queryList(ctx, s.q, s.ScanPublicAgreementRows, `
			SELECT `+cols+`
			FROM alliance_agreements a
			WHERE a.status <> 'draft' AND a.tenant_id = $1
			  AND EXISTS (
				SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
				JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
				JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = $1 AND l.is_public = true
			  )
			ORDER BY a.created_at DESC LIMIT 100
		`, tenantID)
	}
	return queryList(ctx, s.q, s.ScanPublicAgreementRows, `
		SELECT `+cols+`
		FROM alliance_agreements a
		WHERE a.status <> 'draft'
		  AND EXISTS (
			SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid
			JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true
		  )
		ORDER BY a.created_at DESC LIMIT 100
	`)
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

func (s *AllianceStore) UpdateAgreement(ctx context.Context, id, tenantID string, a *domain.AllianceAgreement) error {
	_, err := s.q.Exec(ctx, `
		UPDATE alliance_agreements SET
			name = $1, type = $2, content = $3, start_date = $4, end_date = $5,
			status = $6, enterprise_ids = $7, project_ids = $8, attachments = $9, updated_at = NOW()
		WHERE id = $10 AND tenant_id = $11
	`, a.Name, a.Type, a.Content, a.StartDate, a.EndDate, a.Status,
		emptyJSON(a.EnterpriseIDs), emptyJSON(a.ProjectIDs), emptyJSON(a.Attachments), id, tenantID)
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

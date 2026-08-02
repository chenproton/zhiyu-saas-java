package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

type MicroCertStore struct {
	q        Queryer
	beginner txBeginner
}

// Q 返回底层查询器。
func (s *MicroCertStore) Q() Queryer {
	return s.q
}

func NewMicroCertStore(q Queryer, beginner txBeginner) *MicroCertStore {
	return &MicroCertStore{q: q, beginner: beginner}
}

type MicroCertTemplateCreateParams struct {
	TenantID     string
	Title        string
	CertTypeID   string
	CertTypeName string
	Content      string
	CoverImage   *string
}

type MicroCertTemplateUpdateParams struct {
	Title        string
	CertTypeID   string
	CertTypeName string
	Content      string
	CoverImage   *string
}

func (s *MicroCertStore) GetTemplate(ctx context.Context, id string) (domain.MicroCertTemplate, error) {
	var t domain.MicroCertTemplate
	var cover *string
	err := s.q.QueryRow(ctx,
		`SELECT id, title, cert_type_id, cert_type_name, content, cover_image, created_at, updated_at FROM micro_cert_templates WHERE id = $1`, id,
	).Scan(&t.ID, &t.Title, &t.CertTypeID, &t.CertTypeName, &t.Content, &cover, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return t, err
	}
	t.CoverImage = cover
	return t, nil
}

func (s *MicroCertStore) CreateTemplate(ctx context.Context, p MicroCertTemplateCreateParams) (string, error) {
	id := uuid.NewString()
	_, err := s.q.Exec(ctx,
		`INSERT INTO micro_cert_templates (id, tenant_id, title, cert_type_id, cert_type_name, content, cover_image) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, p.TenantID, p.Title, p.CertTypeID, p.CertTypeName, p.Content, p.CoverImage,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *MicroCertStore) UpdateTemplate(ctx context.Context, id string, p MicroCertTemplateUpdateParams) error {
	_, err := s.q.Exec(ctx,
		`UPDATE micro_cert_templates SET title=$1, cert_type_id=$2, cert_type_name=$3, content=$4, cover_image=$5, updated_at=NOW() WHERE id=$6`,
		p.Title, p.CertTypeID, p.CertTypeName, p.Content, p.CoverImage, id,
	)
	return err
}

func (s *MicroCertStore) DeleteTemplate(ctx context.Context, id string) error {
	if _, err := s.q.Exec(ctx, `DELETE FROM cert_issuance_records WHERE template_id = $1`, id); err != nil {
		return err
	}
	_, err := s.q.Exec(ctx, `DELETE FROM micro_cert_templates WHERE id = $1`, id)
	return err
}

func (s *MicroCertStore) IssueCerts(ctx context.Context, tenantID, templateID string, userIDs []string) (int, error) {
	tx, err := s.beginner.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, userID := range userIDs {
		recordID := uuid.NewString()
		tag, err := tx.Exec(ctx,
			`INSERT INTO cert_issuance_records (id, tenant_id, template_id, user_id, issue_date, status, cert_number) VALUES ($1,$2,$3,$4,$5,'issued',$6)
			 ON CONFLICT (tenant_id, template_id, user_id) DO NOTHING`,
			recordID, tenantID, templateID, userID, time.Now(), uuid.NewString(),
		)
		if err != nil {
			return 0, err
		}
		count += int(tag.RowsAffected())
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return count, nil
}

func (s *MicroCertStore) ScanTemplateRows(rows pgx.Rows) ([]domain.MicroCertTemplate, error) {
	items := make([]domain.MicroCertTemplate, 0)
	for rows.Next() {
		var t domain.MicroCertTemplate
		var cover *string
		if err := rows.Scan(&t.ID, &t.Title, &t.CertTypeID, &t.CertTypeName, &t.Content, &cover, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.CoverImage = cover
		items = append(items, t)
	}
	return items, nil
}

func (s *MicroCertStore) ScanIssuanceRows(rows pgx.Rows) ([]domain.CertIssuanceRecord, error) {
	items := make([]domain.CertIssuanceRecord, 0)
	for rows.Next() {
		var r domain.CertIssuanceRecord
		var expireDate, revokedAt *time.Time
		var revokeReason *string
		if err := rows.Scan(&r.ID, &r.TemplateID, &r.UserID, &r.CertNumber, &r.IssueDate, &expireDate, &r.Status, &revokedAt, &revokeReason); err != nil {
			return nil, err
		}
		r.ExpireDate = expireDate
		r.RevokedAt = revokedAt
		r.RevokeReason = revokeReason
		items = append(items, r)
	}
	return items, nil
}

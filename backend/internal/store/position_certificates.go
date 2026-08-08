package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// PositionCertificateStore 岗位证书绑定持久化。
type PositionCertificateStore struct {
	q Queryer
}

// NewPositionCertificateStore 创建岗位证书 store。
func NewPositionCertificateStore(q Queryer) *PositionCertificateStore {
	return &PositionCertificateStore{q: q}
}

// List 查询岗位证书列表（含证书库详情）。
func (s *PositionCertificateStore) List(ctx context.Context, tenantID, careerPositionID string, limit, offset int) ([]domain.PositionCertificate, int, error) {
	where := []string{"pc.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2
	if careerPositionID != "" {
		where = append(where, "career_position_id = $"+Itoa(argIdx))
		args = append(args, careerPositionID)
		argIdx++
	}
	cond := joinSQL(where, " AND ")

	countQuery := "SELECT COUNT(*) FROM position_certificates pc WHERE " + cond
	var total int
	if err := s.q.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	query := `
		SELECT pc.id, pc.career_position_id, pc.certificate_library_id,
			cl.name, cl.url, cl.description, cl.image_url
		FROM position_certificates pc
		JOIN certificate_library cl ON cl.id = pc.certificate_library_id
		WHERE ` + cond + `
		ORDER BY cl.name ASC
		LIMIT $` + Itoa(argIdx) + ` OFFSET $` + Itoa(argIdx+1)

	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanPositionCertificateRows(rows)
	if items == nil {
		items = []domain.PositionCertificate{}
	}
	return items, total, err
}

// Get 查询单个岗位证书。
func (s *PositionCertificateStore) Get(ctx context.Context, id string) (*domain.PositionCertificate, error) {
	item, err := s.fetchCert(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return item, nil
}

// Create 创建岗位证书（find-or-create 证书库条目后绑定）。
func (s *PositionCertificateStore) Create(ctx context.Context, tenantID string, p *PositionCertificateParams) (*domain.PositionCertificate, error) {
	libraryID, err := s.findOrCreateLibrary(ctx, tenantID, p.Name, p.URL, p.Description, p.ImageURL)
	if err != nil {
		return nil, err
	}
	id := uuid.NewString()
	if _, err := s.q.Exec(ctx, `
		INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)
		VALUES ($1, $2, $3, $4)
	`, id, tenantID, p.CareerPositionID, libraryID); err != nil {
		return nil, err
	}
	return s.fetchCert(ctx, id)
}

// Update 更新岗位证书（提供名称时 find-or-create 证书库并重绑）。
func (s *PositionCertificateStore) Update(ctx context.Context, tenantID string, p *PositionCertificateUpdateParams) (*domain.PositionCertificate, error) {
	if p.Name != "" {
		libraryID, err := s.findOrCreateLibrary(ctx, tenantID, p.Name, p.URL, p.Description, p.ImageURL)
		if err != nil {
			return nil, err
		}
		if _, err := s.q.Exec(ctx, `
			UPDATE position_certificates SET
				career_position_id = $1, certificate_library_id = $2
			WHERE id = $3
		`, p.CareerPositionID, libraryID, p.ID); err != nil {
			return nil, err
		}
	} else {
		if _, err := s.q.Exec(ctx, `
			UPDATE position_certificates SET career_position_id = $1
			WHERE id = $2
		`, p.CareerPositionID, p.ID); err != nil {
			return nil, err
		}
	}
	return s.fetchCert(ctx, p.ID)
}

// Delete 删除岗位证书。
func (s *PositionCertificateStore) Delete(ctx context.Context, id string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM position_certificates WHERE id = $1`, id)
	return err
}

// PositionCertificateParams 创建参数。
type PositionCertificateParams struct {
	CareerPositionID     string
	CertificateLibraryID string
	Name                 string
	URL                  *string
	Description          *string
	ImageURL             *string
}

// PositionCertificateUpdateParams 更新参数。
type PositionCertificateUpdateParams struct {
	ID               string
	CareerPositionID string
	Name             string
	URL              *string
	Description      *string
	ImageURL         *string
}

// findOrCreateLibrary 按名称查找证书库条目，不存在则创建。
func (s *PositionCertificateStore) findOrCreateLibrary(ctx context.Context, tenantID, name string, url, description, imageURL *string) (string, error) {
	var libraryID string
	err := s.q.QueryRow(ctx, `
		SELECT id FROM certificate_library WHERE tenant_id = $1 AND name = $2
	`, tenantID, name).Scan(&libraryID)
	if err == nil {
		return libraryID, nil
	}
	libraryID = uuid.NewString()
	if _, err := s.q.Exec(ctx, `
		INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, libraryID, tenantID, name, url, description, imageURL); err != nil {
		return "", err
	}
	return libraryID, nil
}

func (s *PositionCertificateStore) fetchCert(ctx context.Context, id string) (*domain.PositionCertificate, error) {
	var item domain.PositionCertificate
	err := s.q.QueryRow(ctx, `
		SELECT pc.id, pc.career_position_id, pc.certificate_library_id,
			cl.name, cl.url, cl.description, cl.image_url
		FROM position_certificates pc
		JOIN certificate_library cl ON cl.id = pc.certificate_library_id
		WHERE pc.id = $1
	`, id).Scan(
		&item.ID, &item.CareerPositionID, &item.CertificateLibraryID,
		&item.Name, &item.URL, &item.Description, &item.ImageURL,
	)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func scanPositionCertificateRows(rows pgx.Rows) ([]domain.PositionCertificate, error) {
	items := make([]domain.PositionCertificate, 0)
	for rows.Next() {
		var item domain.PositionCertificate
		if err := rows.Scan(
			&item.ID, &item.CareerPositionID, &item.CertificateLibraryID,
			&item.Name, &item.URL, &item.Description, &item.ImageURL,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

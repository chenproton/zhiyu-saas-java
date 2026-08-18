package store

import (
	"context"
)

// StudentHonor 学生荣誉记录行。
type StudentHonor struct {
	ID        string
	TenantID  string
	UserID    string
	Name      string
	Issuer    string
	HonorDate string
	FileName  string
	FileURL   string
}

// StudentHonorStore 学生荣誉持久化。
type StudentHonorStore struct {
	q Queryer
}

// NewStudentHonorStore 创建学生荣誉 store。
func NewStudentHonorStore(q Queryer) *StudentHonorStore {
	return &StudentHonorStore{q: q}
}

// HonorUpsertParams 荣誉创建/更新参数。
type HonorUpsertParams struct {
	ID        string
	TenantID  string
	UserID    string
	Name      string
	Issuer    string
	HonorDate string
	FileName  string
	FileURL   string
}

const honorColumns = `id, tenant_id, user_id, name, issuer, honor_date, file_name, file_url`

func scanHonor(row interface{ Scan(...any) error }) (StudentHonor, error) {
	var h StudentHonor
	err := row.Scan(&h.ID, &h.TenantID, &h.UserID, &h.Name, &h.Issuer, &h.HonorDate, &h.FileName, &h.FileURL)
	return h, err
}

// ListHonors 查询学生荣誉（按 user_id，新→旧）。
func (s *StudentHonorStore) ListHonors(ctx context.Context, tenantID, userID string) ([]StudentHonor, error) {
	rows, err := s.q.Query(ctx, `
		SELECT `+honorColumns+` FROM student_honors
		WHERE tenant_id = $1 AND user_id = $2
		ORDER BY created_at DESC, id DESC
	`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []StudentHonor
	for rows.Next() {
		h, err := scanHonor(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, h)
	}
	return items, rows.Err()
}

// GetHonor 查询单条荣誉（租户限定）。
func (s *StudentHonorStore) GetHonor(ctx context.Context, id, tenantID string) (*StudentHonor, error) {
	row := s.q.QueryRow(ctx, `
		SELECT `+honorColumns+` FROM student_honors WHERE id = $1 AND tenant_id = $2
	`, id, tenantID)
	h, err := scanHonor(row)
	if err != nil {
		return nil, err
	}
	return &h, nil
}

// CreateHonor 新增荣誉。
func (s *StudentHonorStore) CreateHonor(ctx context.Context, p *HonorUpsertParams) (string, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO student_honors (tenant_id, user_id, name, issuer, honor_date, file_name, file_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, p.TenantID, p.UserID, p.Name, p.Issuer, p.HonorDate, p.FileName, p.FileURL).Scan(&id)
	return id, err
}

// UpdateHonor 更新荣誉（租户+本人限定）。
func (s *StudentHonorStore) UpdateHonor(ctx context.Context, p *HonorUpsertParams) error {
	_, err := s.q.Exec(ctx, `
		UPDATE student_honors
		SET name = $1, issuer = $2, honor_date = $3, file_name = $4, file_url = $5, updated_at = NOW()
		WHERE id = $6 AND tenant_id = $7 AND user_id = $8
	`, p.Name, p.Issuer, p.HonorDate, p.FileName, p.FileURL, p.ID, p.TenantID, p.UserID)
	return err
}

// DeleteHonor 删除荣誉（租户+本人限定）。
func (s *StudentHonorStore) DeleteHonor(ctx context.Context, id, tenantID, userID string) error {
	_, err := s.q.Exec(ctx, `
		DELETE FROM student_honors WHERE id = $1 AND tenant_id = $2 AND user_id = $3
	`, id, tenantID, userID)
	return err
}

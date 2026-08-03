package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// TrainingProgramStore 人培方案持久化。
type TrainingProgramStore struct {
	q Queryer
}

// NewTrainingProgramStore 创建人培方案 store。
func NewTrainingProgramStore(q Queryer) *TrainingProgramStore {
	return &TrainingProgramStore{q: q}
}

// List 查询人培方案列表。
func (s *TrainingProgramStore) List(ctx context.Context, p ListParams, cfg ListQueryConfig[domain.TrainingProgram]) ([]domain.TrainingProgram, int, error) {
	return ExecuteListQuery(ctx, s.q, p, cfg, ScanTrainingProgramRows)
}

// ListConfig 返回人培方案列表查询配置，SQL 片段沉淀在 store 层。
func (s *TrainingProgramStore) ListConfig() ListQueryConfig[domain.TrainingProgram] {
	return ListQueryConfig[domain.TrainingProgram]{
		Table:         "training_programs tp LEFT JOIN majors m ON m.id = tp.major_id LEFT JOIN users cu ON cu.id = tp.created_by LEFT JOIN batches lb ON lb.id = tp.batch_id",
		SelectColumns: "tp.id, tp.name, tp.code, tp.major_id, COALESCE(m.name, '') AS major_name, tp.entry_year, tp.level, tp.duration, tp.total_credits, tp.status, tp.description, (SELECT COUNT(*) FROM training_program_courses c WHERE c.program_id = tp.id) AS course_count, tp.created_by, COALESCE(cu.name, '') AS created_by_name, tp.collaborators, COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(tp.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}') AS collaborator_names, tp.batch_id, COALESCE(lb.name, '') AS batch_name, tp.created_at, tp.updated_at",
		TenantScoped:  true,
		TenantColumn:  "tp.tenant_id",
		SearchColumns: []string{"tp.name", "tp.code"},
		OrderBy:       "tp.entry_year DESC, tp.created_at DESC",
		ScanRows:      ScanTrainingProgramRows,
		ExtraFilter: func(p ListParams, qb *ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("tp.status = " + qb.NextArg(status))
			}
			if majorID := p.Values["majorId"]; majorID != "" {
				qb.AddCondition("tp.major_id = " + qb.NextArg(majorID))
			}
		},
	}
}

// Get 查询单个人培方案。
func (s *TrainingProgramStore) Get(ctx context.Context, id, tenantID string) (*domain.TrainingProgram, error) {
	p, err := s.fetchProgram(ctx, id, tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

// Create 创建人培方案。
func (s *TrainingProgramStore) Create(ctx context.Context, tenantID string, p *TrainingProgramParams) (*domain.TrainingProgram, error) {
	var id string
	err := s.q.QueryRow(ctx, `
		INSERT INTO training_programs (id, tenant_id, name, code, major_id, entry_year, level, duration, total_credits, status, description, created_by)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10)
		RETURNING id
	`, tenantID, p.Name, p.Code, p.MajorID, p.EntryYear,
		p.Level, p.Duration, p.TotalCredits, p.Description, p.CreatedBy).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Update 更新人培方案。
func (s *TrainingProgramStore) Update(ctx context.Context, id, tenantID string, p *TrainingProgramParams) (*domain.TrainingProgram, error) {
	if _, err := s.fetchProgram(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE training_programs
		SET name = $1, code = $2, major_id = $3, entry_year = $4, level = $5, duration = $6,
			total_credits = $7, description = $8, updated_at = NOW()
		WHERE id = $9 AND tenant_id = $10
	`, p.Name, p.Code, p.MajorID, p.EntryYear,
		p.Level, p.Duration, p.TotalCredits, p.Description, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// Delete 删除人培方案。
func (s *TrainingProgramStore) Delete(ctx context.Context, id, tenantID string) error {
	_, err := s.q.Exec(ctx, `DELETE FROM training_programs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// UpdateStatus 更新状态。
func (s *TrainingProgramStore) UpdateStatus(ctx context.Context, id, tenantID, status string) (*domain.TrainingProgram, error) {
	if _, err := s.fetchProgram(ctx, id, tenantID); err != nil {
		return nil, err
	}
	if _, err := s.q.Exec(ctx, `
		UPDATE training_programs SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3
	`, status, id, tenantID); err != nil {
		return nil, err
	}
	return s.Get(ctx, id, tenantID)
}

// ListCourses 查询方案课程。
func (s *TrainingProgramStore) ListCourses(ctx context.Context, programID string) ([]domain.TrainingProgramCourse, error) {
	rows, err := s.q.Query(ctx, `
		SELECT c.id, c.program_id, c.name, c.code, c.credits, c.hours, c.semester, c.nature, c.assessment,
			c.position_id, COALESCE(cp.name, ''), c.course_id, COALESCE(cr.name, ''), c.sort_order
		FROM training_program_courses c
		LEFT JOIN career_positions cp ON cp.id = c.position_id
		LEFT JOIN courses cr ON cr.id = c.course_id
		WHERE c.program_id = $1
		ORDER BY c.sort_order, c.id
	`, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.TrainingProgramCourse, 0)
	for rows.Next() {
		var c domain.TrainingProgramCourse
		var positionID, courseID *string
		var positionName, courseName string
		if err := rows.Scan(&c.ID, &c.ProgramID, &c.Name, &c.Code, &c.Credits, &c.Hours, &c.Semester, &c.Nature, &c.Assessment,
			&positionID, &positionName, &courseID, &courseName, &c.SortOrder); err != nil {
			return nil, err
		}
		c.PositionID = positionID
		c.CourseID = courseID
		c.PositionName = positionName
		c.CourseName = courseName
		items = append(items, c)
	}
	return items, rows.Err()
}

// PutCourses 保存课程设置（事务：全量替换）。
func (s *TrainingProgramStore) PutCourses(ctx context.Context, tx Queryer, programID string, courses []ProgramCourseItem) error {
	if _, err := tx.Exec(ctx, `DELETE FROM training_program_courses WHERE program_id = $1`, programID); err != nil {
		return err
	}
	for _, c := range courses {
		name := c.Name
		if name == "" && c.PositionID != nil && *c.PositionID != "" {
			_ = tx.QueryRow(ctx, `SELECT name FROM career_positions WHERE id=$1`, *c.PositionID).Scan(&name)
		}
		if name == "" && c.CourseID != nil && *c.CourseID != "" {
			_ = tx.QueryRow(ctx, `SELECT name FROM courses WHERE id=$1`, *c.CourseID).Scan(&name)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO training_program_courses (id, program_id, name, code, credits, hours, semester, nature, assessment, position_id, course_id, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, uuid.NewString(), programID, name, c.Code, c.Credits, c.Hours,
			c.Semester, c.Nature, c.Assessment, c.PositionID, c.CourseID, c.SortOrder); err != nil {
			return err
		}
	}
	_, err := tx.Exec(ctx, `UPDATE training_programs SET updated_at = NOW() WHERE id = $1`, programID)
	return err
}

// ProgramCourseItem 课程项。
type ProgramCourseItem struct {
	Name       string
	Code       *string
	Credits    *float64
	Hours      *int
	Semester   *int
	Nature     string
	Assessment *string
	PositionID *string
	CourseID   *string
	SortOrder  int
}

// TrainingProgramParams 人培方案参数。
type TrainingProgramParams struct {
	Name         string
	Code         *string
	MajorID      *string
	EntryYear    int
	Level        *string
	Duration     *int
	TotalCredits *float64
	Description  *string
	CreatedBy    string
}

func (s *TrainingProgramStore) fetchProgram(ctx context.Context, id, tenantID string) (*domain.TrainingProgram, error) {
	var p domain.TrainingProgram
	err := s.q.QueryRow(ctx, `
		SELECT tp.id, tp.name, tp.code, tp.major_id, COALESCE(m.name, ''), tp.entry_year, tp.level, tp.duration,
			tp.total_credits, tp.status, tp.description,
			(SELECT COUNT(*) FROM training_program_courses c WHERE c.program_id = tp.id),
			tp.created_by, COALESCE(cu.name, ''), tp.collaborators,
			COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(tp.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}'),
			tp.batch_id, COALESCE(lb.name, ''), tp.created_at, tp.updated_at
		FROM training_programs tp LEFT JOIN majors m ON m.id = tp.major_id LEFT JOIN users cu ON cu.id = tp.created_by LEFT JOIN batches lb ON lb.id = tp.batch_id
		WHERE tp.id = $1 AND tp.tenant_id = $2
	`, id, tenantID).Scan(&p.ID, &p.Name, &p.Code, &p.MajorID, &p.MajorName, &p.EntryYear, &p.Level, &p.Duration,
		&p.TotalCredits, &p.Status, &p.Description, &p.CourseCount, &p.CreatedBy, &p.CreatedByName, &p.Collaborators, &p.CollaboratorNames, &p.BatchID, &p.BatchName, &p.CreatedAt, &p.UpdatedAt)
	return &p, err
}

// ScanTrainingProgramRows 扫描人培方案行。
func ScanTrainingProgramRows(rows pgx.Rows) ([]domain.TrainingProgram, error) {
	items := make([]domain.TrainingProgram, 0)
	for rows.Next() {
		var p domain.TrainingProgram
		if err := rows.Scan(&p.ID, &p.Name, &p.Code, &p.MajorID, &p.MajorName, &p.EntryYear, &p.Level, &p.Duration,
			&p.TotalCredits, &p.Status, &p.Description, &p.CourseCount, &p.CreatedBy, &p.CreatedByName, &p.Collaborators, &p.CollaboratorNames, &p.BatchID, &p.BatchName, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}

// GetByID 按 ID 查询（无租户，contentActions 用）。
func (s *TrainingProgramStore) GetByID(ctx context.Context, id string) (*domain.TrainingProgram, error) {
	var p domain.TrainingProgram
	err := s.q.QueryRow(ctx, `
		SELECT tp.id, tp.name, tp.code, tp.major_id, COALESCE(m.name, ''), tp.entry_year, tp.level, tp.duration,
			tp.total_credits, tp.status, tp.description,
			(SELECT COUNT(*) FROM training_program_courses c WHERE c.program_id = tp.id),
			tp.created_by, COALESCE(cu.name, ''), tp.collaborators,
			COALESCE((SELECT array_agg(u.name ORDER BY ord) FROM unnest(tp.collaborators) WITH ORDINALITY AS c(id, ord) JOIN users u ON u.id = c.id), '{}'),
			tp.batch_id, COALESCE(lb.name, ''), tp.created_at, tp.updated_at
		FROM training_programs tp LEFT JOIN majors m ON m.id = tp.major_id LEFT JOIN users cu ON cu.id = tp.created_by LEFT JOIN batches lb ON lb.id = tp.batch_id
		WHERE tp.id = $1
	`, id).Scan(&p.ID, &p.Name, &p.Code, &p.MajorID, &p.MajorName, &p.EntryYear, &p.Level, &p.Duration,
		&p.TotalCredits, &p.Status, &p.Description, &p.CourseCount, &p.CreatedBy, &p.CreatedByName, &p.Collaborators, &p.CollaboratorNames, &p.BatchID, &p.BatchName, &p.CreatedAt, &p.UpdatedAt)
	return &p, err
}

// CloneProgram 克隆人培方案（事务：插方案+克隆课程）。
func (s *TrainingProgramStore) CloneProgram(ctx context.Context, tx Queryer, tenantID, userID string, src *domain.TrainingProgram, newName string) (string, error) {
	newID := uuid.NewString()
	if _, err := tx.Exec(ctx, `
		INSERT INTO training_programs (id, tenant_id, name, code, major_id, entry_year, level, duration, total_credits, status, description, created_by, collaborators)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'{}')
	`, newID, tenantID, newName, src.Code, src.MajorID, src.EntryYear, src.Level, src.Duration, src.TotalCredits, "draft", src.Description, userID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO training_program_courses (id, program_id, name, code, credits, hours, semester, nature, assessment, position_id, course_id, sort_order)
		SELECT gen_random_uuid(), $1, name, code, credits, hours, semester, nature, assessment, position_id, course_id, sort_order
		FROM training_program_courses WHERE program_id = $2
	`, newID, src.ID); err != nil {
		return "", err
	}
	return newID, nil
}

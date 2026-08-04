package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// CourseAssessmentStore 课程评估生成持久化（发布时生成节点考试/作业）。
type CourseAssessmentStore struct {
	q Queryer
}

// NewCourseAssessmentStore 创建评估生成 store。
func NewCourseAssessmentStore(q Queryer) *CourseAssessmentStore {
	return &CourseAssessmentStore{q: q}
}

// CourseInfo 课程基础信息。
type CourseInfo struct {
	Type      string
	Name      string
	TenantID  string
	CreatorID string
}

// FetchCourseInfo 查询课程基础信息。
func (s *CourseAssessmentStore) FetchCourseInfo(ctx context.Context, q Queryer, courseID string) (*CourseInfo, error) {
	var info CourseInfo
	err := q.QueryRow(ctx, `
		SELECT c.type, c.name, c.tenant_id, c.creator_id
		FROM courses c
		WHERE c.id = $1
	`, courseID).Scan(&info.Type, &info.Name, &info.TenantID, &info.CreatorID)
	if err != nil {
		return nil, err
	}
	return &info, nil
}

// ListNodeEvalData 查询课程全部节点及其评估配置。
func (s *CourseAssessmentStore) ListNodeEvalData(ctx context.Context, q Queryer, courseID string) ([]NodeEvalRow, error) {
	rows, err := q.Query(ctx, `
		SELECT id, name, eval_data
		FROM system_course_nodes
		WHERE course_id = $1
		ORDER BY sort_order ASC, id ASC
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var nodes []NodeEvalRow
	for rows.Next() {
		var n NodeEvalRow
		if err := rows.Scan(&n.ID, &n.Name, &n.EvalData); err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

// NodeEvalRow 节点评估配置行。
type NodeEvalRow struct {
	ID       string
	Name     string
	EvalData domain.JSONMap
}

// UpdateNodeEvalData 更新节点评估配置。
func (s *CourseAssessmentStore) UpdateNodeEvalData(ctx context.Context, q Queryer, nodeID string, evalData domain.JSONMap) error {
	_, err := q.Exec(ctx, `UPDATE system_course_nodes SET eval_data = $1, updated_at = NOW() WHERE id = $2`, evalData, nodeID)
	return err
}

// PaperExamName 查询试卷名称。
func (s *CourseAssessmentStore) PaperExamName(ctx context.Context, q Queryer, paperID, tenantID string) (string, error) {
	var name string
	err := q.QueryRow(ctx, `SELECT name FROM exams WHERE id = $1 AND tenant_id = $2`, paperID, tenantID).Scan(&name)
	return name, err
}

// FindNodeUsage 查询节点已有考试安排。
func (s *CourseAssessmentStore) FindNodeUsage(ctx context.Context, q Queryer, examID, nodeID string) (string, error) {
	var usageID string
	err := q.QueryRow(ctx, `
		SELECT id FROM exam_usages
		WHERE exam_id = $1 AND target_type = 'node' AND $2 = ANY(target_ids)
	`, examID, nodeID).Scan(&usageID)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return usageID, err
}

// CreateNodeUsage 创建节点考试安排（published）。
func (s *CourseAssessmentStore) CreateNodeUsage(ctx context.Context, q Queryer, tenantID, examID, nodeID, name, creatorID string) (string, error) {
	usageID := uuid.NewString()
	var creator any
	if creatorID != "" {
		creator = creatorID
	}
	_, err := q.Exec(ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id)
		VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, 'node', $5, 'published', $6)
	`, usageID, tenantID, examID, name, []string{nodeID}, creator)
	if err != nil {
		return "", err
	}
	return usageID, nil
}

// CreateTempExam 创建临时考试（published）。
func (s *CourseAssessmentStore) CreateTempExam(ctx context.Context, q Queryer, tenantID, name string, duration int, creatorID string) (string, error) {
	id := uuid.NewString()
	code, err := GenerateUniqueEntityCode(ctx, q, "SJ", "exams", tenantID)
	if err != nil {
		return "", fmt.Errorf("生成考试编码失败: %w", err)
	}
	_, err = q.Exec(ctx, `
		INSERT INTO exams (id, tenant_id, code, name, description, status, total_score, duration, cover_image,
			collaborator_ids, collaborator_dept_ids, batch_id, version, owner_type, creator_id, is_temp)
		VALUES ($1, $2, $3, $4, '', 'published', 0, $5, NULL, '{}', '{}', NULL, 'v1.0', 'mine', $6, TRUE)
	`, id, tenantID, code, name, duration, creatorID)
	if err != nil {
		return "", fmt.Errorf("创建临时考试失败: %w", err)
	}
	return id, nil
}

// CreateExamUsage 创建通用考试安排（published）。
func (s *CourseAssessmentStore) CreateExamUsage(ctx context.Context, q Queryer, tenantID, examID, targetType, targetID, name, creatorID string) (string, error) {
	id := uuid.NewString()
	var creator any
	if creatorID != "" {
		creator = creatorID
	}
	_, err := q.Exec(ctx, `
		INSERT INTO exam_usages (id, tenant_id, exam_id, name, description, start_time, end_time, duration, target_type, target_ids, status, creator_id)
		VALUES ($1, $2, $3, $4, NULL, NULL, NULL, NULL, $5, $6, 'published', $7)
	`, id, tenantID, examID, name, targetType, []string{targetID}, creator)
	if err != nil {
		return "", fmt.Errorf("创建考试安排失败: %w", err)
	}
	return id, nil
}

// NodeHomeworkExists 查询节点是否已有作业。
func (s *CourseAssessmentStore) NodeHomeworkExists(ctx context.Context, q Queryer, nodeID string) (bool, error) {
	var exists bool
	err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM node_homeworks WHERE node_id = $1)`, nodeID).Scan(&exists)
	return exists, err
}

// CreateNodeHomework 创建节点作业。
func (s *CourseAssessmentStore) CreateNodeHomework(ctx context.Context, q Queryer, tenantID, nodeID, title, creatorID string) error {
	var creator any
	if creatorID != "" {
		creator = creatorID
	}
	_, err := q.Exec(ctx, `
		INSERT INTO node_homeworks (id, tenant_id, node_id, title, requirement, need_attachment, creator_id)
		VALUES ($1, $2, $3, $4, '', FALSE, $5)
	`, uuid.NewString(), tenantID, nodeID, title, creator)
	if err != nil {
		return fmt.Errorf("创建节点作业失败: %w", err)
	}
	return nil
}

// CleanupCourseLevelAssessments 清理课程级旧测评（兼容历史数据）。
func (s *CourseAssessmentStore) CleanupCourseLevelAssessments(ctx context.Context, q Queryer, courseID string) error {
	_, _ = q.Exec(ctx, `
		DELETE FROM exam_usages eu
		WHERE eu.target_type = 'course' AND $1 = ANY(eu.target_ids)
		  AND NOT EXISTS (SELECT 1 FROM exam_results er WHERE er.exam_usage_id = eu.id)
	`, courseID)
	_, _ = q.Exec(ctx, `
		DELETE FROM course_homeworks ch
		WHERE ch.course_id = $1
		  AND NOT EXISTS (SELECT 1 FROM course_homework_submissions chs WHERE chs.homework_id = ch.id)
	`, courseID)
	return nil
}

// CourseExamUsage 课程考试安排（评估列表项）。
type CourseExamUsage struct {
	ID        string  `json:"id"`
	ExamID    string  `json:"examId"`
	ExamName  string  `json:"examName"`
	IsTemp    bool    `json:"isTemp"`
	Name      string  `json:"name"`
	StartTime *string `json:"startTime,omitempty"`
	EndTime   *string `json:"endTime,omitempty"`
	Duration  *int    `json:"duration,omitempty"`
	Status    string  `json:"status"`
	Type      string  `json:"type"`
}

// CourseHomework 课程作业（评估列表项）。
type CourseHomework struct {
	ID             string  `json:"id"`
	Title          string  `json:"title"`
	Requirement    string  `json:"requirement"`
	NeedAttachment bool    `json:"needAttachment"`
	Deadline       *string `json:"deadline,omitempty"`
	Status         string  `json:"status"`
	Type           string  `json:"type"`
}

// ListCourseExamUsages 查询课程考试安排列表。
func (s *CourseAssessmentStore) ListCourseExamUsages(ctx context.Context, tenantID, courseID string) ([]CourseExamUsage, error) {
	rows, err := s.q.Query(ctx, `
		SELECT eu.id, eu.exam_id, e.name AS exam_name, e.is_temp, eu.name, eu.start_time, eu.end_time, eu.duration, eu.status
		FROM exam_usages eu
		JOIN exams e ON e.id = eu.exam_id
		WHERE eu.tenant_id = $1 AND eu.target_type = 'course' AND $2 = ANY(eu.target_ids)
		ORDER BY eu.created_at ASC
	`, tenantID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]CourseExamUsage, 0)
	for rows.Next() {
		var item CourseExamUsage
		var startTime, endTime *time.Time
		if err := rows.Scan(&item.ID, &item.ExamID, &item.ExamName, &item.IsTemp, &item.Name, &startTime, &endTime, &item.Duration, &item.Status); err != nil {
			return nil, err
		}
		item.Type = "exam"
		if startTime != nil {
			s := startTime.Format(time.RFC3339)
			item.StartTime = &s
		}
		if endTime != nil {
			s := endTime.Format(time.RFC3339)
			item.EndTime = &s
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// ListCourseHomeworks 查询课程作业列表。
func (s *CourseAssessmentStore) ListCourseHomeworks(ctx context.Context, tenantID, courseID string) ([]CourseHomework, error) {
	rows, err := s.q.Query(ctx, `
		SELECT id, title, requirement, need_attachment, deadline, status
		FROM course_homeworks
		WHERE tenant_id = $1 AND course_id = $2
		ORDER BY created_at ASC
	`, tenantID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]CourseHomework, 0)
	for rows.Next() {
		var item CourseHomework
		var deadline *time.Time
		if err := rows.Scan(&item.ID, &item.Title, &item.Requirement, &item.NeedAttachment, &deadline, &item.Status); err != nil {
			return nil, err
		}
		item.Type = "homework"
		if deadline != nil {
			s := deadline.Format(time.RFC3339)
			item.Deadline = &s
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

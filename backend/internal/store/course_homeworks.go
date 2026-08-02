package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// HomeworkSubmissionItem 作业提交记录（课程/节点通用）。
type HomeworkSubmissionItem struct {
	ID             string
	StudentID      string
	StudentName    string
	Content        string
	AttachmentURLs []string
	Status         string
	Score          *float64
	TotalScore     *float64
	Comment        string
	CreatedAt      *time.Time
	GradedAt       *time.Time
}

// CourseHomeworkStore 课程/节点作业持久化。
type CourseHomeworkStore struct {
	q Queryer
}

// NewCourseHomeworkStore 创建作业 store。
func NewCourseHomeworkStore(q Queryer) *CourseHomeworkStore {
	return &CourseHomeworkStore{q: q}
}

// CourseHomeworkExists 校验课程作业存在。
func (s *CourseHomeworkStore) CourseHomeworkExists(ctx context.Context, homeworkID, courseID, tenantID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM course_homeworks WHERE id = $1 AND course_id = $2 AND tenant_id = $3)
	`, homeworkID, courseID, tenantID).Scan(&exists)
	return exists, err
}

// SubmitCourseHomework 提交课程作业（幂等 upsert）。
func (s *CourseHomeworkStore) SubmitCourseHomework(ctx context.Context, tenantID, courseID, homeworkID, studentID, content string, attachmentURLs []string) (string, error) {
	var submissionID string
	err := s.q.QueryRow(ctx, `
		INSERT INTO course_homework_submissions (tenant_id, course_id, homework_id, student_id, content, attachment_urls, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
		ON CONFLICT (homework_id, student_id)
		DO UPDATE SET content = EXCLUDED.content, attachment_urls = EXCLUDED.attachment_urls,
			status = CASE WHEN course_homework_submissions.status = 'graded' THEN 'graded' ELSE 'submitted' END,
			updated_at = NOW()
		RETURNING id
	`, tenantID, courseID, homeworkID, studentID, content, attachmentURLs).Scan(&submissionID)
	return submissionID, err
}

// ListCourseHomeworkSubmissions 查询课程作业提交列表。
func (s *CourseHomeworkStore) ListCourseHomeworkSubmissions(ctx context.Context, tenantID, courseID, homeworkID string) ([]HomeworkSubmissionItem, error) {
	rows, err := s.q.Query(ctx, `
		SELECT s.id, s.student_id, COALESCE(u.name, ''), s.content, s.attachment_urls, s.status, s.score, s.total_score, s.comment, s.created_at, s.graded_at
		FROM course_homework_submissions s
		JOIN users u ON u.id = s.student_id
		WHERE s.tenant_id = $1 AND s.course_id = $2 AND s.homework_id = $3
		ORDER BY s.created_at DESC
	`, tenantID, courseID, homeworkID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanHomeworkSubmissions(rows)
}

// GradeCourseHomework 批改课程作业并同步统一评价结果。
func (s *CourseHomeworkStore) GradeCourseHomework(ctx context.Context, graderID, tenantID, courseID, homeworkID, submissionID string, score float64, comment string) (string, float64, error) {
	var studentID string
	var totalScore float64
	err := s.q.QueryRow(ctx, `
		UPDATE course_homework_submissions
		SET score = $1, comment = $2, status = 'graded', graded_at = NOW(), graded_by = $3
		WHERE id = $4 AND tenant_id = $5 AND course_id = $6 AND homework_id = $7
		RETURNING student_id, COALESCE(total_score, 100)
	`, score, comment, graderID, submissionID, tenantID, courseID, homeworkID).Scan(&studentID, &totalScore)
	if err != nil {
		return "", 0, err
	}
	_, _ = s.q.Exec(ctx, `
		INSERT INTO course_evaluation_results (tenant_id, course_id, method_key, evaluatee_id, status, total_score, max_score)
		VALUES ($1, $2, 'homework', $3, 'evaluated', $4, $5)
		ON CONFLICT (tenant_id, course_id, evaluatee_id, method_key)
		DO UPDATE SET total_score = EXCLUDED.total_score, max_score = EXCLUDED.max_score, status = 'evaluated', graded_at = NOW(), updated_at = NOW()
	`, tenantID, courseID, studentID, score, totalScore)
	return studentID, totalScore, nil
}

// NodeHomeworkExists 校验节点作业存在。
func (s *CourseHomeworkStore) NodeHomeworkExists(ctx context.Context, homeworkID, nodeID, tenantID string) (bool, error) {
	var exists bool
	err := s.q.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM node_homeworks WHERE id = $1 AND node_id = $2 AND tenant_id = $3)
	`, homeworkID, nodeID, tenantID).Scan(&exists)
	return exists, err
}

// SubmitNodeHomework 提交节点作业（幂等 upsert）。
func (s *CourseHomeworkStore) SubmitNodeHomework(ctx context.Context, tenantID, nodeID, homeworkID, studentID, content string, attachmentURLs []string) (string, error) {
	var submissionID string
	err := s.q.QueryRow(ctx, `
		INSERT INTO node_homework_submissions (tenant_id, node_id, homework_id, student_id, content, attachment_urls, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
		ON CONFLICT (homework_id, student_id)
		DO UPDATE SET content = EXCLUDED.content, attachment_urls = EXCLUDED.attachment_urls,
			status = CASE WHEN node_homework_submissions.status = 'graded' THEN 'graded' ELSE 'submitted' END,
			updated_at = NOW()
		RETURNING id
	`, tenantID, nodeID, homeworkID, studentID, content, attachmentURLs).Scan(&submissionID)
	return submissionID, err
}

// ListNodeHomeworkSubmissions 查询节点作业提交列表。
func (s *CourseHomeworkStore) ListNodeHomeworkSubmissions(ctx context.Context, tenantID, nodeID, homeworkID string) ([]HomeworkSubmissionItem, error) {
	rows, err := s.q.Query(ctx, `
		SELECT s.id, s.student_id, COALESCE(u.name, ''), s.content, s.attachment_urls, s.status, s.score, s.total_score, s.comment, s.created_at, s.graded_at
		FROM node_homework_submissions s
		JOIN users u ON u.id = s.student_id
		WHERE s.tenant_id = $1 AND s.node_id = $2 AND s.homework_id = $3
		ORDER BY s.created_at DESC
	`, tenantID, nodeID, homeworkID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanHomeworkSubmissions(rows)
}

// GradeNodeHomework 批改节点作业并同步统一评价结果。
func (s *CourseHomeworkStore) GradeNodeHomework(ctx context.Context, graderID, tenantID, nodeID, homeworkID, submissionID string, score float64, comment string) (string, float64, error) {
	var studentID string
	var totalScore float64
	err := s.q.QueryRow(ctx, `
		UPDATE node_homework_submissions
		SET score = $1, comment = $2, status = 'graded', graded_at = NOW(), graded_by = $3
		WHERE id = $4 AND tenant_id = $5 AND node_id = $6 AND homework_id = $7
		RETURNING student_id, COALESCE(total_score, 100)
	`, score, comment, graderID, submissionID, tenantID, nodeID, homeworkID).Scan(&studentID, &totalScore)
	if err != nil {
		return "", 0, err
	}
	_, _ = s.q.Exec(ctx, `
		INSERT INTO node_evaluation_results (tenant_id, node_id, method_key, evaluatee_id, status, total_score, max_score, comment, graded_at, graded_by)
		VALUES ($1, $2, 'homework', $3, 'evaluated', $4, $5, $6, NOW(), $7)
		ON CONFLICT (tenant_id, node_id, evaluatee_id, method_key)
		DO UPDATE SET total_score = EXCLUDED.total_score, max_score = EXCLUDED.max_score, status = 'evaluated', comment = EXCLUDED.comment, graded_at = NOW(), graded_by = EXCLUDED.graded_by, updated_at = NOW()
	`, tenantID, nodeID, studentID, score, totalScore, comment, graderID)
	return studentID, totalScore, nil
}

func scanHomeworkSubmissions(rows pgx.Rows) ([]HomeworkSubmissionItem, error) {
	items := make([]HomeworkSubmissionItem, 0)
	for rows.Next() {
		var it HomeworkSubmissionItem
		if err := rows.Scan(&it.ID, &it.StudentID, &it.StudentName, &it.Content, &it.AttachmentURLs, &it.Status,
			&it.Score, &it.TotalScore, &it.Comment, &it.CreatedAt, &it.GradedAt); err != nil {
			continue
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

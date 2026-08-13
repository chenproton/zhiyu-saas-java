package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ErrNotFound is returned by Get when the row does not exist.
var ErrNotFound = errors.New("not found")

// ErrAlreadyGraded 记录已被评分，禁止覆盖（重交保护）。
var ErrAlreadyGraded = errors.New("already graded")

// ErrForbidden 无权限执行操作（如班级不匹配禁止参加考试）。
var ErrForbidden = errors.New("forbidden")

// ErrExamNotStarted 考试尚未到开始时间。
var ErrExamNotStarted = errors.New("exam not started")

// ErrExamEnded 考试已过结束时间。
var ErrExamEnded = errors.New("exam ended")

// ErrRetakeNotAllowed 考试不允许重复作答。
var ErrRetakeNotAllowed = errors.New("retake not allowed")

const resourceSelectColumns = `
	rl.id, rl.tenant_id, rl.name, rl.resource_type, rl.url, rl.description,
	rl.thumbnail, rl.file_size, rl.metadata, rl.uploaded_by,
	u.name AS uploader_name, o.name AS uploader_org_name, m.name AS uploader_major_name,
	rl.created_at, rl.updated_at
`

const resourceJoinClause = `
	LEFT JOIN users u ON u.id = rl.uploaded_by
	LEFT JOIN organizations o ON o.id = u.org_node_id
	LEFT JOIN majors m ON m.id = u.major_id
`

// ResourceLibraryStore 提供资源库的持久化访问，SQL 全部收敛于此。
type ResourceLibraryStore struct {
	q        Queryer
	beginner txBeginner
}

// NewResourceLibraryStore 创建资源库 store。
func NewResourceLibraryStore(q Queryer, beginner txBeginner) *ResourceLibraryStore {
	return &ResourceLibraryStore{q: q, beginner: beginner}
}

// ResourceFilter 资源列表查询参数（由 handler 从请求显式提取）。
type ResourceFilter struct {
	Search       string
	ResourceType string
	OrgName      string
	MajorName    string
	UploadedBy   string
	TagIDs       []string
	Limit        int
	Offset       int
}

// List 按租户 + 筛选条件分页查询资源。
func (s *ResourceLibraryStore) List(ctx context.Context, tenantID string, f ResourceFilter) ([]domain.ResourceLibraryItem, int, error) {
	where := []string{"rl.tenant_id = $1"}
	args := []any{tenantID}
	argIdx := 2

	if f.Search != "" {
		where = append(where, "(rl.name ILIKE $"+Itoa(argIdx)+" OR rl.description ILIKE $"+Itoa(argIdx)+")")
		args = append(args, "%"+f.Search+"%")
		argIdx++
	}
	if f.ResourceType != "" {
		where = append(where, "rl.resource_type = $"+Itoa(argIdx))
		args = append(args, f.ResourceType)
		argIdx++
	}
	if f.OrgName != "" {
		where = append(where, "o.name = $"+Itoa(argIdx))
		args = append(args, f.OrgName)
		argIdx++
	}
	if f.MajorName != "" {
		where = append(where, "m.name = $"+Itoa(argIdx))
		args = append(args, f.MajorName)
		argIdx++
	}
	if f.UploadedBy != "" {
		where = append(where, "rl.uploaded_by = $"+Itoa(argIdx))
		args = append(args, f.UploadedBy)
		argIdx++
	}
	if len(f.TagIDs) > 0 {
		where = append(where, `EXISTS (SELECT 1 FROM resource_tag_relations rtr WHERE rtr.tenant_id = rl.tenant_id AND rtr.resource_type = $`+Itoa(argIdx)+` AND rtr.resource_id = rl.id AND rtr.tag_id = ANY($`+Itoa(argIdx+1)+`))`)
		args = append(args, domain.TagResourceTypeResourceLibrary, f.TagIDs)
		argIdx += 2
	}

	cond := joinSQL(where, " AND ")
	countQuery := "SELECT COUNT(*) FROM resource_library rl " + resourceJoinClause + " WHERE " + cond
	var total int
	if err := s.q.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit, offset := ClampLimitOffset(f.Limit, f.Offset, 50)
	args = append(args, limit, offset)
	query := `
		SELECT ` + resourceSelectColumns + `
		FROM resource_library rl
		` + resourceJoinClause + `
		WHERE ` + cond + `
		ORDER BY rl.created_at DESC
		LIMIT $` + Itoa(argIdx) + ` OFFSET $` + Itoa(argIdx+1)

	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanResourceRows(rows)
	return items, total, err
}

// CitationStats 资源引用次数分布（引用源：课程/节点/任务绑定；可按类型过滤）。
func (s *ResourceLibraryStore) CitationStats(ctx context.Context, tenantID, resourceType string) (CitationStats, error) {
	where := "rl.tenant_id = $1"
	args := []any{tenantID}
	argIdx := 2
	if resourceType != "" {
		where += " AND rl.resource_type::text = $" + Itoa(argIdx)
		args = append(args, resourceType)
		argIdx++
	}
	rows, err := s.q.Query(ctx, `
		SELECT `+citationBucketCase+`, COUNT(*) AS cnt
		FROM (
			SELECT rl.id,
				COALESCE((SELECT COUNT(*) FROM course_resource_bindings crb WHERE crb.resource_id = rl.id), 0)
				+ COALESCE((SELECT COUNT(*) FROM node_resource_bindings nrb WHERE nrb.resource_id = rl.id), 0)
				+ COALESCE((SELECT COUNT(*) FROM task_resource_bindings trb WHERE trb.resource_id = rl.id), 0) AS ref_count
			FROM resource_library rl
			WHERE `+where+`
		) refs
		GROUP BY bucket
	`, args...)
	if err != nil {
		return CitationStats{}, err
	}
	defer rows.Close()
	return scanCitationStats(rows)
}

// ListUncited 零引用资源列表（弹窗：上传时段筛选 + 分页；可按类型过滤）。
func (s *ResourceLibraryStore) ListUncited(ctx context.Context, tenantID, resourceType string, from, to *time.Time, limit, offset int) ([]UncitedItem, int, error) {
	where := "rl.tenant_id = $1"
	args := []any{tenantID}
	argIdx := 2
	if resourceType != "" {
		where += " AND rl.resource_type::text = $" + Itoa(argIdx)
		args = append(args, resourceType)
		argIdx++
	}
	if from != nil {
		where += " AND rl.created_at >= $" + Itoa(argIdx)
		args = append(args, *from)
		argIdx++
	}
	if to != nil {
		where += " AND rl.created_at < $" + Itoa(argIdx)
		args = append(args, *to)
		argIdx++
	}
	uncited := `
		AND NOT EXISTS (SELECT 1 FROM course_resource_bindings crb WHERE crb.resource_id = rl.id)
		AND NOT EXISTS (SELECT 1 FROM node_resource_bindings nrb WHERE nrb.resource_id = rl.id)
		AND NOT EXISTS (SELECT 1 FROM task_resource_bindings trb WHERE trb.resource_id = rl.id)`

	var total int
	if err := s.q.QueryRow(ctx, "SELECT COUNT(*) FROM resource_library rl WHERE "+where+uncited, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	limit, offset = ClampLimitOffset(limit, offset, 50)
	args = append(args, limit, offset)
	rows, err := s.q.Query(ctx, `
		SELECT rl.id, rl.name, rl.created_at
		FROM resource_library rl
		WHERE `+where+uncited+`
		ORDER BY rl.created_at DESC
		LIMIT $`+Itoa(argIdx)+` OFFSET $`+Itoa(argIdx+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]UncitedItem, 0, limit)
	for rows.Next() {
		var it UncitedItem
		if err := rows.Scan(&it.ID, &it.Name, &it.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, it)
	}
	return items, total, rows.Err()
}

// ResourceTypeCount 某资源类型的数量（列表总览统计卡片用）。
type ResourceTypeCount struct {
	ResourceType string `json:"resourceType"`
	Count        int    `json:"count"`
}

// CountByType 按类型统计资源数量（租户隔离，可选 search 过滤）。
func (s *ResourceLibraryStore) CountByType(ctx context.Context, tenantID, search string) ([]ResourceTypeCount, error) {
	where := []string{"rl.tenant_id = $1"}
	args := []any{tenantID}
	if search != "" {
		where = append(where, "(rl.name ILIKE $2 OR rl.description ILIKE $2)")
		args = append(args, "%"+search+"%")
	}
	rows, err := s.q.Query(ctx, `
		SELECT rl.resource_type, COUNT(*) AS cnt
		FROM resource_library rl
		WHERE `+joinSQL(where, " AND ")+`
		GROUP BY rl.resource_type
		ORDER BY cnt DESC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ResourceTypeCount, 0)
	for rows.Next() {
		var c ResourceTypeCount
		if err := rows.Scan(&c.ResourceType, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// FindByNames 按名称精确匹配查询已有资源（批量导入重名校验用）。
func (s *ResourceLibraryStore) FindByNames(ctx context.Context, tenantID, resourceType string, names []string) ([]domain.ResourceLibraryItem, error) {
	if len(names) == 0 {
		return nil, nil
	}
	rows, err := s.q.Query(ctx, `
		SELECT `+resourceSelectColumns+`
		FROM resource_library rl
		`+resourceJoinClause+`
		WHERE rl.tenant_id = $1 AND rl.resource_type = $2 AND rl.name = ANY($3)
	`, tenantID, resourceType, names)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanResourceRows(rows)
}

// Get 按 ID 查询资源（跨租户校验由 handler 层负责）。
func (s *ResourceLibraryStore) Get(ctx context.Context, id string) (*domain.ResourceLibraryItem, error) {
	item, err := s.fetchItem(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return item, nil
}

// Create 新建资源，返回完整记录。
func (s *ResourceLibraryStore) Create(ctx context.Context, tenantID string, p *ResourceCreateParams) (*domain.ResourceLibraryItem, error) {
	id := uuid.NewString()
	metadata := p.Metadata
	if metadata == nil {
		metadata = domain.JSONMap{}
	}
	_, err := s.q.Exec(ctx, `
		INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, thumbnail, file_size, metadata, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, id, tenantID, p.Name, p.ResourceType, p.URL, p.Description, p.Thumbnail, p.FileSize, metadata, p.UploadedBy)
	if err != nil {
		return nil, err
	}
	return s.fetchItem(ctx, id)
}

// Update 更新资源字段，返回更新后的完整记录。
func (s *ResourceLibraryStore) Update(ctx context.Context, id string, p *ResourceUpdateParams) (*domain.ResourceLibraryItem, error) {
	if _, err := s.fetchItem(ctx, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	_, err := s.q.Exec(ctx, `
		UPDATE resource_library SET
			name = $1, resource_type = $2, url = $3, description = $4,
			thumbnail = $5, file_size = $6, metadata = $7, updated_at = NOW()
		WHERE id = $8
	`, p.Name, p.ResourceType, p.URL, p.Description, p.Thumbnail, p.FileSize, p.Metadata, id)
	if err != nil {
		return nil, err
	}
	return s.fetchItem(ctx, id)
}

// Delete 删除资源。
func (s *ResourceLibraryStore) Delete(ctx context.Context, id string) error {
	return withTxStore(ctx, s.beginner, func(tx pgx.Tx) error {
		if err := DeleteResourceTags(ctx, tx, domain.TagResourceTypeResourceLibrary, id); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM resource_library WHERE id = $1`, id)
		return err
	})
}

// ResourceCreateParams 创建资源参数。
type ResourceCreateParams struct {
	Name         string
	ResourceType domain.ResourceType
	URL          *string
	Description  *string
	Thumbnail    *string
	FileSize     *int64
	Metadata     domain.JSONMap
	UploadedBy   string
}

// ResourceUpdateParams 更新资源参数（合并后的最终值）。
type ResourceUpdateParams struct {
	Name         string
	ResourceType domain.ResourceType
	URL          *string
	Description  *string
	Thumbnail    *string
	FileSize     *int64
	Metadata     domain.JSONMap
}

func (s *ResourceLibraryStore) fetchItem(ctx context.Context, id string) (*domain.ResourceLibraryItem, error) {
	var item domain.ResourceLibraryItem
	var url, description, thumbnail *string
	var fileSize *int64
	var uploadedBy *string
	var uploaderName, uploaderOrgName, uploaderMajorName *string
	var metadata domain.JSONMap

	err := s.q.QueryRow(ctx, `
		SELECT `+resourceSelectColumns+`
		FROM resource_library rl
		`+resourceJoinClause+`
		WHERE rl.id = $1
	`, id).Scan(
		&item.ID, &item.TenantID, &item.Name, &item.ResourceType,
		&url, &description, &thumbnail, &fileSize, &metadata,
		&uploadedBy, &uploaderName, &uploaderOrgName, &uploaderMajorName,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	item.URL = url
	item.Description = description
	item.Thumbnail = thumbnail
	item.FileSize = fileSize
	item.Metadata = metadata
	item.UploadedBy = uploadedBy
	item.UploaderName = uploaderName
	item.UploaderOrgName = uploaderOrgName
	item.UploaderMajorName = uploaderMajorName
	return &item, nil
}

func scanResourceRows(rows pgx.Rows) ([]domain.ResourceLibraryItem, error) {
	items := make([]domain.ResourceLibraryItem, 0)
	for rows.Next() {
		var item domain.ResourceLibraryItem
		var url, description, thumbnail *string
		var fileSize *int64
		var uploadedBy *string
		var uploaderName, uploaderOrgName, uploaderMajorName *string
		var metadata domain.JSONMap
		if err := rows.Scan(
			&item.ID, &item.TenantID, &item.Name, &item.ResourceType,
			&url, &description, &thumbnail, &fileSize, &metadata,
			&uploadedBy, &uploaderName, &uploaderOrgName, &uploaderMajorName,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		item.URL = url
		item.Description = description
		item.Thumbnail = thumbnail
		item.FileSize = fileSize
		item.Metadata = metadata
		item.UploadedBy = uploadedBy
		item.UploaderName = uploaderName
		item.UploaderOrgName = uploaderOrgName
		item.UploaderMajorName = uploaderMajorName
		items = append(items, item)
	}
	return items, rows.Err()
}

func joinSQL(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}

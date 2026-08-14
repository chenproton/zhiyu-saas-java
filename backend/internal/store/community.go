package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// CommunityTopicRow 帖子行（含作者名与统计）。
type CommunityTopicRow struct {
	ID          string
	TenantID    string
	AuthorID    string
	AuthorName  string
	AvatarURL   string
	Title       string
	Content     string
	Tag         string
	ReplyCount  int
	ViewCount   int
	LastReplyAt *time.Time
	CreatedAt   time.Time
}

// CommunityReplyRow 回复行（含作者名与父评论作者名）。
type CommunityReplyRow struct {
	ID               string
	TopicID          string
	AuthorID         string
	AuthorName       string
	AvatarURL        string
	ParentID         *string
	ParentAuthorID   string
	ParentAuthorName string
	Content          string
	CreatedAt        time.Time
}

// TopicSort 帖子列表排序方式。
type TopicSort string

const (
	TopicSortHot    TopicSort = "hot"
	TopicSortLatest TopicSort = "latest"
	TopicSortMine   TopicSort = "mine"
)

// CommunityStore 学习社区持久化。
type CommunityStore struct {
	q Queryer
}

// NewCommunityStore 创建社区 store。
func NewCommunityStore(q Queryer) *CommunityStore {
	return &CommunityStore{q: q}
}

// topicSelectColumns 帖子查询公共列（含 view_counters 阅读数与 replies 最近回复时间）。
const topicSelectColumns = `
	t.id, t.tenant_id, t.author_id, COALESCE(u.name, ''),
	COALESCE(u.avatar_url, ''), t.title, t.content, COALESCE(t.tag, ''),
	t.reply_count, COALESCE(vc.cnt, 0), r.last_reply_at, t.created_at`

// CreateTopic 创建帖子。
func (s *CommunityStore) CreateTopic(ctx context.Context, q Queryer, tenantID, authorID, title, content, tag string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		INSERT INTO community_topics (tenant_id, author_id, title, content, tag)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, tenantID, authorID, title, content, tag).Scan(&id)
	return id, err
}

// ListTopics 按排序方式分页查询帖子（mine 时按作者过滤）。
func (s *CommunityStore) ListTopics(ctx context.Context, tenantID string, sort TopicSort, authorID string, limit, offset int) ([]CommunityTopicRow, int, error) {
	// where 条件单点维护：COUNT 与列表查询共用，新增过滤条件仅需改这一处。
	where := `t.tenant_id = $1`
	args := []any{tenantID}
	if sort == TopicSortMine {
		where += ` AND t.author_id = $2`
		args = append(args, authorID)
	}

	countQuery := `SELECT COUNT(*) FROM community_topics t WHERE ` + where
	var total int
	if err := s.q.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := `t.created_at DESC`
	if sort == TopicSortHot {
		orderBy = `COALESCE(vc.cnt, 0) DESC, t.created_at DESC`
	}
	limitOffset := `LIMIT $2 OFFSET $3`
	if sort == TopicSortMine {
		limitOffset = `LIMIT $3 OFFSET $4`
	}

	query := `
		SELECT ` + topicSelectColumns + `
		FROM community_topics t
		JOIN users u ON u.id = t.author_id
		LEFT JOIN view_counters vc ON vc.target_type = 'community_topic' AND vc.target_id = t.id
		LEFT JOIN LATERAL (
			SELECT MAX(created_at) AS last_reply_at FROM community_replies WHERE topic_id = t.id
		) r ON true
		WHERE ` + where + `
		ORDER BY ` + orderBy + `
		` + limitOffset
	args = append(args, limit, offset)

	rows, err := s.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []CommunityTopicRow
	for rows.Next() {
		var t CommunityTopicRow
		if err := rows.Scan(&t.ID, &t.TenantID, &t.AuthorID, &t.AuthorName, &t.AvatarURL,
			&t.Title, &t.Content, &t.Tag, &t.ReplyCount, &t.ViewCount, &t.LastReplyAt, &t.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, t)
	}
	return items, total, rows.Err()
}

// GetTopic 按 ID 查询帖子（限定租户）。
func (s *CommunityStore) GetTopic(ctx context.Context, tenantID, topicID string) (*CommunityTopicRow, error) {
	query := `
		SELECT ` + topicSelectColumns + `
		FROM community_topics t
		JOIN users u ON u.id = t.author_id
		LEFT JOIN view_counters vc ON vc.target_type = 'community_topic' AND vc.target_id = t.id
		LEFT JOIN LATERAL (
			SELECT MAX(created_at) AS last_reply_at FROM community_replies WHERE topic_id = t.id
		) r ON true
		WHERE t.id = $1 AND t.tenant_id = $2`
	var row CommunityTopicRow
	err := s.q.QueryRow(ctx, query, topicID, tenantID).Scan(
		&row.ID, &row.TenantID, &row.AuthorID, &row.AuthorName, &row.AvatarURL,
		&row.Title, &row.Content, &row.Tag, &row.ReplyCount, &row.ViewCount, &row.LastReplyAt, &row.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// CreateReply 创建回复（同时校验帖子归属租户、parent 评论属于同一帖子）。
func (s *CommunityStore) CreateReply(ctx context.Context, q Queryer, topicID, tenantID, authorID string, parentID *string, content string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		INSERT INTO community_replies (topic_id, author_id, parent_id, content)
		SELECT t.id, $3, $4, $5 FROM community_topics t WHERE t.id = $1 AND t.tenant_id = $2
			AND ($4::uuid IS NULL OR EXISTS (
				SELECT 1 FROM community_replies p WHERE p.id = $4::uuid AND p.topic_id = t.id
			))
		RETURNING id
	`, topicID, tenantID, authorID, parentID, content).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", ErrNotFound
	}
	return id, err
}

// IncrementTopicReplyCount 递增帖子回复数。
func (s *CommunityStore) IncrementTopicReplyCount(ctx context.Context, q Queryer, topicID string) error {
	_, err := q.Exec(ctx, `
		UPDATE community_topics SET reply_count = reply_count + 1, updated_at = NOW() WHERE id = $1
	`, topicID)
	return err
}

// ListReplies 查询帖子全部回复（按时间正序）。
func (s *CommunityStore) ListReplies(ctx context.Context, tenantID, topicID string) ([]CommunityReplyRow, error) {
	rows, err := s.q.Query(ctx, `
		SELECT r.id, r.topic_id, r.author_id, COALESCE(u.name, ''), COALESCE(u.avatar_url, ''),
			r.parent_id, COALESCE(pu.id::text, ''), COALESCE(pu.name, ''), r.content, r.created_at
		FROM community_replies r
		JOIN users u ON u.id = r.author_id
		JOIN community_topics t ON t.id = r.topic_id
		LEFT JOIN community_replies pr ON pr.id = r.parent_id
		LEFT JOIN users pu ON pu.id = pr.author_id
		WHERE r.topic_id = $1 AND t.tenant_id = $2
		ORDER BY r.created_at ASC
	`, topicID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CommunityReplyRow
	for rows.Next() {
		var r CommunityReplyRow
		if err := rows.Scan(&r.ID, &r.TopicID, &r.AuthorID, &r.AuthorName, &r.AvatarURL,
			&r.ParentID, &r.ParentAuthorID, &r.ParentAuthorName, &r.Content, &r.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, r)
	}
	return items, rows.Err()
}

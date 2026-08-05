package service

import (
	"context"
	"fmt"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/store"
)

// CommunityService 学习社区业务编排（发帖/回复/阅读数）。
type CommunityService struct {
	*Service
	st *store.Store
}

// NewCommunityService 创建学习社区服务。
func NewCommunityService(s *Service) *CommunityService {
	return &CommunityService{Service: s, st: s.Store()}
}

// CreateTopic 创建帖子。
func (s *CommunityService) CreateTopic(ctx context.Context, tenantID, authorID, title, content, tag string) (string, error) {
	return s.st.Community().CreateTopic(ctx, s.st.Q(), tenantID, authorID, title, content, tag)
}

// ListTopics 分页查询帖子列表，并标记是否本人发布。
func (s *CommunityService) ListTopics(ctx context.Context, tenantID, userID string, sort store.TopicSort, limit, offset int) ([]domain.CommunityTopic, int, error) {
	rows, total, err := s.st.Community().ListTopics(ctx, tenantID, sort, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	items := make([]domain.CommunityTopic, 0, len(rows))
	for _, r := range rows {
		items = append(items, domain.CommunityTopic{
			ID:          r.ID,
			TenantID:    r.TenantID,
			AuthorID:    r.AuthorID,
			AuthorName:  r.AuthorName,
			AvatarURL:   r.AvatarURL,
			Title:       r.Title,
			Content:     r.Content,
			Tag:         r.Tag,
			ReplyCount:  r.ReplyCount,
			ViewCount:   r.ViewCount,
			LastReplyAt: r.LastReplyAt,
			CreatedAt:   r.CreatedAt,
			IsMine:      r.AuthorID == userID,
		})
	}
	return items, total, nil
}

// GetTopic 查询帖子详情并累加阅读数（同用户重复阅读也计数，与岗位/场景浏览口径一致）。
func (s *CommunityService) GetTopic(ctx context.Context, tenantID, userID, topicID string) (*domain.CommunityTopic, error) {
	row, err := s.st.Community().GetTopic(ctx, tenantID, topicID)
	if err != nil {
		return nil, err
	}
	if err := store.RecordView(ctx, s.st.Q(), "community_topic", topicID, userID, tenantID); err != nil {
		return nil, fmt.Errorf("record view: %w", err)
	}
	return &domain.CommunityTopic{
		ID:          row.ID,
		TenantID:    row.TenantID,
		AuthorID:    row.AuthorID,
		AuthorName:  row.AuthorName,
		AvatarURL:   row.AvatarURL,
		Title:       row.Title,
		Content:     row.Content,
		Tag:         row.Tag,
		ReplyCount:  row.ReplyCount,
		ViewCount:   row.ViewCount + 1,
		LastReplyAt: row.LastReplyAt,
		CreatedAt:   row.CreatedAt,
		IsMine:      row.AuthorID == userID,
	}, nil
}

// CreateReply 创建回复（事务内同时递增帖子回复数）。
func (s *CommunityService) CreateReply(ctx context.Context, tenantID, userID, topicID string, parentID *string, content string) (string, error) {
	var replyID string
	err := s.WithTx(ctx, func(tx *store.Store) error {
		id, err := tx.Community().CreateReply(ctx, tx.Q(), topicID, tenantID, userID, parentID, content)
		if err != nil {
			return err
		}
		if err := tx.Community().IncrementTopicReplyCount(ctx, tx.Q(), topicID); err != nil {
			return err
		}
		replyID = id
		return nil
	})
	return replyID, err
}

// ListReplies 查询帖子回复列表，并标记是否本人发布。
func (s *CommunityService) ListReplies(ctx context.Context, userID, topicID string) ([]domain.CommunityReply, error) {
	rows, err := s.st.Community().ListReplies(ctx, topicID)
	if err != nil {
		return nil, err
	}
	items := make([]domain.CommunityReply, 0, len(rows))
	for _, r := range rows {
		items = append(items, domain.CommunityReply{
			ID:               r.ID,
			TopicID:          r.TopicID,
			AuthorID:         r.AuthorID,
			AuthorName:       r.AuthorName,
			AvatarURL:        r.AvatarURL,
			ParentID:         r.ParentID,
			ParentAuthorID:   r.ParentAuthorID,
			ParentAuthorName: r.ParentAuthorName,
			Content:          r.Content,
			CreatedAt:        r.CreatedAt,
			IsMine:           r.AuthorID == userID,
		})
	}
	return items, nil
}

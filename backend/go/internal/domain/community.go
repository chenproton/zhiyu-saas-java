package domain

import "time"

// CommunityTopic 学习社区帖子。
type CommunityTopic struct {
	ID          string     `json:"id"`
	TenantID    string     `json:"tenantId"`
	AuthorID    string     `json:"authorId"`
	AuthorName  string     `json:"authorName"`
	AvatarURL   string     `json:"avatarUrl,omitempty"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	Tag         string     `json:"tag,omitempty"`
	ReplyCount  int        `json:"replyCount"`
	ViewCount   int        `json:"viewCount"`
	LastReplyAt *time.Time `json:"lastReplyAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	IsMine      bool       `json:"isMine"`
}

// CommunityReply 学习社区回复（parentId 非空表示回复某条评论）。
type CommunityReply struct {
	ID               string    `json:"id"`
	TopicID          string    `json:"topicId"`
	AuthorID         string    `json:"authorId"`
	AuthorName       string    `json:"authorName"`
	AvatarURL        string    `json:"avatarUrl,omitempty"`
	ParentID         *string   `json:"parentId,omitempty"`
	ParentAuthorID   string    `json:"parentAuthorId,omitempty"`
	ParentAuthorName string    `json:"parentAuthorName,omitempty"`
	Content          string    `json:"content"`
	CreatedAt        time.Time `json:"createdAt"`
	IsMine           bool      `json:"isMine"`
}

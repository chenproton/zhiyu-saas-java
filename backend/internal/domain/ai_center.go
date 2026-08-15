package domain

import "time"

// AI 智能服务中心领域类型（docs/spec/ai-service-center.md §4）。
// 状态机（知识库/智能体共用）：private → pending → published|rejected；published → private（下架）；rejected → pending（重新提交）。
const (
	AIContentStatusPrivate   = "private"
	AIContentStatusPending   = "pending"
	AIContentStatusPublished = "published"
	AIContentStatusRejected  = "rejected"
)

// 文档解析状态。
const (
	AIDocStatusParsing = "parsing"
	AIDocStatusReady   = "ready"
	AIDocStatusFailed  = "failed"
)

// 协作者角色。
const (
	AICollaboratorEditor = "editor"
	AICollaboratorViewer = "viewer"
)

// 第三方挂接类型与状态。
const (
	AIIntegrationKindAgent = "agent"
	AIIntegrationKindApp   = "app"

	AIIntegrationActive   = "active"
	AIIntegrationInactive = "inactive"
)

// 审核留痕动作。
const (
	AIReviewActionSubmit    = "submit"
	AIReviewActionApprove   = "approve"
	AIReviewActionReject    = "reject"
	AIReviewActionUnpublish = "unpublish"
	AIReviewActionTakedown  = "takedown"
)

// AIKnowledgeBase 知识库。
type AIKnowledgeBase struct {
	ID            string     `json:"id"`
	TenantID      string     `json:"tenantId"`
	OwnerID       string     `json:"ownerId"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	Tags          []string   `json:"tags"`
	Status        string     `json:"status"`
	ReviewComment string     `json:"reviewComment,omitempty"`
	ReviewedBy    string     `json:"reviewedBy,omitempty"`
	ReviewedAt    *time.Time `json:"reviewedAt,omitempty"`
	DocCount      int        `json:"docCount"`
	AskCount      int64      `json:"askCount"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`

	// 视图扩展字段（非表列）：查询时按需填充
	OwnerName string `json:"ownerName,omitempty"`
	MyRole    string `json:"myRole,omitempty"` // owner/editor/viewer/member
}

// AIKBDocument 知识库文档。
type AIKBDocument struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenantId"`
	KbID       string    `json:"kbId"`
	UploaderID string    `json:"uploaderId"`
	Name       string    `json:"name"`
	FilePath   string    `json:"-"` // 存储路径不外泄
	FileSize   int64     `json:"fileSize"`
	Mime       string    `json:"mime"`
	Status     string    `json:"status"`
	Error      string    `json:"error,omitempty"`
	ChunkCount int       `json:"chunkCount"`
	CharCount  int       `json:"charCount"`
	CreatedAt  time.Time `json:"createdAt"`

	UploaderName string `json:"uploaderName,omitempty"`
}

// AIKBChunk 文档分块（检索单元）。Content 只在召回结果中经溯源片段输出。
type AIKBChunk struct {
	ID       string `json:"id"`
	TenantID string `json:"tenantId"`
	DocID    string `json:"docId"`
	KbID     string `json:"kbId"`
	Seq      int    `json:"seq"`
	Content  string `json:"content"`
	DocName  string `json:"docName,omitempty"` // 召回时 JOIN 填充
}

// AIKBCollaborator 知识库协作者。
type AIKBCollaborator struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenantId"`
	KbID      string    `json:"kbId"`
	UserID    string    `json:"userId"`
	Role      string    `json:"role"` // editor/viewer
	CreatedAt time.Time `json:"createdAt"`

	UserName string `json:"userName,omitempty"`
}

// AIAgent 自建智能体。
type AIAgent struct {
	ID            string     `json:"id"`
	TenantID      string     `json:"tenantId"`
	OwnerID       string     `json:"ownerId"`
	Name          string     `json:"name"`
	Avatar        string     `json:"avatar"`
	Description   string     `json:"description"`
	Greeting      string     `json:"greeting"`
	SystemPrompt  string     `json:"systemPrompt"`
	Status        string     `json:"status"`
	ReviewComment string     `json:"reviewComment,omitempty"`
	ReviewedBy    string     `json:"reviewedBy,omitempty"`
	ReviewedAt    *time.Time `json:"reviewedAt,omitempty"`
	ChatCount     int64      `json:"chatCount"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`

	// 视图扩展字段
	OwnerName string   `json:"ownerName,omitempty"`
	KbIDs     []string `json:"kbIds,omitempty"`
	KbNames   []string `json:"kbNames,omitempty"`
}

// AIConversation 智能体会话。
type AIConversation struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenantId"`
	AgentID   string    `json:"agentId"`
	UserID    string    `json:"userId"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// AIMessageSource 回答溯源（召回分块快照）。
type AIMessageSource struct {
	DocID   string `json:"docId"`
	DocName string `json:"docName"`
	Seq     int    `json:"seq"`
	Snippet string `json:"snippet"`
}

// AIMessage 会话消息。
type AIMessage struct {
	ID             string            `json:"id"`
	TenantID       string            `json:"tenantId"`
	ConversationID string            `json:"conversationId"`
	Role           string            `json:"role"` // user/assistant
	Content        string            `json:"content"`
	Sources        []AIMessageSource `json:"sources"`
	CreatedAt      time.Time         `json:"createdAt"`
}

// AIIntegration 第三方智能体/应用挂接（链接卡片）。
type AIIntegration struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenantId"`
	Kind        string    `json:"kind"` // agent/app
	Name        string    `json:"name"`
	Description string    `json:"description"`
	URL         string    `json:"url"`
	Icon        string    `json:"icon"`
	Category    string    `json:"category"`
	Sort        int       `json:"sort"`
	Status      string    `json:"status"` // active/inactive
	CreatedBy   string    `json:"createdBy,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// AIReviewLog 审核留痕。
type AIReviewLog struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenantId"`
	TargetType string    `json:"targetType"` // kb/agent
	TargetID   string    `json:"targetId"`
	Action     string    `json:"action"`
	ActorID    string    `json:"actorId"`
	Comment    string    `json:"comment"`
	CreatedAt  time.Time `json:"createdAt"`
}

// AI 智能服务中心用户端 HTTP 适配（docs/spec/ai-service-center.md §5.1-5.3）。
// 分层红线：本文件不出现 SQL/db 句柄；文件落盘 IO 沿用 file_handler 模式（handler 可做文件 IO，不可碰 db）。
package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// AICenterHandler AI 智能服务中心用户端 handler。
type AICenterHandler struct {
	Service   *service.AICenterService
	UploadDir string
}

// aiCenterError 统一错误映射：404/403/409/412/502/500。
func aiCenterError(w http.ResponseWriter, r *http.Request, err error, fallback string) {
	switch {
	case err == nil:
		return
	case errors.Is(err, store.ErrNotFound):
		respondError(w, http.StatusNotFound, "资源不存在或无权访问")
	case errors.Is(err, store.ErrForbidden):
		respondError(w, http.StatusForbidden, "无权操作")
	case errors.Is(err, service.ErrAIInvalidTransition):
		respondError(w, http.StatusConflict, "当前状态不允许该操作")
	case errors.Is(err, service.ErrAIAgentTooManyKBs):
		respondError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrAINotConfigured):
		respondError(w, http.StatusPreconditionFailed, "ai_not_configured")
	default:
		var upErr *ai.UpstreamError
		if errors.As(err, &upErr) {
			respondError(w, http.StatusBadGateway, upErr.Message)
			return
		}
		respondServerError(w, r, err, fallback)
	}
}

// aiCenterPage 解析 page/pageSize（默认 1/20，pageSize ≤ 50）。
func aiCenterPage(r *http.Request) (page, pageSize int) {
	page, _ = parseInt(r.URL.Query().Get("page"), 1)
	pageSize, _ = parseInt(r.URL.Query().Get("pageSize"), 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	return page, pageSize
}

func aiCenterUser(r *http.Request) (tenantID, userID string, ok bool) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		return "", "", false
	}
	return *claims.TenantID, claims.UserID, true
}

// ==================== 知识库 ====================

// ListKBs GET /ai/kb?scope=&q=
func (h *AICenterHandler) ListKBs(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	page, pageSize := aiCenterPage(r)
	items, total, err := h.Service.ListMyKBs(r.Context(), tenantID, userID,
		r.URL.Query().Get("scope"), strings.TrimSpace(r.URL.Query().Get("q")), page, pageSize)
	if aiCenterError(w, r, err, "查询知识库失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

// CreateKB POST /ai/kb
func (h *AICenterHandler) CreateKB(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var in service.CreateKBInput
	if !decodeBody(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Name) == "" || len([]rune(in.Name)) > 200 {
		respondError(w, http.StatusBadRequest, "名称必填且不超过 200 字")
		return
	}
	if len([]rune(in.Description)) > 2000 {
		respondError(w, http.StatusBadRequest, "描述过长")
		return
	}
	kb, err := h.Service.CreateKB(r.Context(), tenantID, userID, in)
	if aiCenterError(w, r, err, "创建知识库失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusCreated, kb)
}

// GetKB GET /ai/kb/{id}
func (h *AICenterHandler) GetKB(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	kb, err := h.Service.GetKB(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "查询知识库失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, kb)
}

// UpdateKB PUT /ai/kb/{id}
func (h *AICenterHandler) UpdateKB(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var in service.CreateKBInput
	if !decodeBody(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Name) == "" || len([]rune(in.Name)) > 200 {
		respondError(w, http.StatusBadRequest, "名称必填且不超过 200 字")
		return
	}
	err := h.Service.UpdateKB(r.Context(), tenantID, chi.URLParam(r, "id"), userID, in)
	if aiCenterError(w, r, err, "更新知识库失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DeleteKB DELETE /ai/kb/{id}（删除后 best-effort 清理文件）
func (h *AICenterHandler) DeleteKB(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	paths, err := h.Service.DeleteKB(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "删除知识库失败"); err != nil {
		return
	}
	for _, p := range paths {
		if rmErr := os.Remove(p); rmErr != nil {
			slog.Warn("ai kb file cleanup failed", "path", p, "error", rmErr)
		}
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// SubmitKB POST /ai/kb/{id}/submit
func (h *AICenterHandler) SubmitKB(w http.ResponseWriter, r *http.Request) {
	h.kbTransition(w, r, "submit")
}

// UnpublishKB POST /ai/kb/{id}/unpublish
func (h *AICenterHandler) UnpublishKB(w http.ResponseWriter, r *http.Request) {
	h.kbTransition(w, r, "unpublish")
}

func (h *AICenterHandler) kbTransition(w http.ResponseWriter, r *http.Request, action string) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	kbID := chi.URLParam(r, "id")
	var err error
	switch action {
	case "submit":
		err = h.Service.SubmitKB(r.Context(), tenantID, kbID, userID)
	case "unpublish":
		err = h.Service.UnpublishKB(r.Context(), tenantID, kbID, userID)
	}
	if aiCenterError(w, r, err, "操作失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ==================== 文档 ====================

// ListDocuments GET /ai/kb/{id}/documents
func (h *AICenterHandler) ListDocuments(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	docs, err := h.Service.ListDocuments(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "查询文档失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": docs})
}

// UploadDocument POST /ai/kb/{id}/documents（multipart file 字段；≤10MB 沿用上传红线）
func (h *AICenterHandler) UploadDocument(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	kbID := chi.URLParam(r, "id")

	r.Body = http.MaxBytesReader(w, r.Body, MaxUploadSize)
	if err := r.ParseMultipartForm(maxFormMemory); err != nil {
		respondError(w, http.StatusBadRequest, "文件过大或表单无效")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "缺少文件字段")
		return
	}
	defer file.Close()
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !service.AISupportedDocExt(ext) {
		respondError(w, http.StatusBadRequest, "仅支持 PDF/DOCX/TXT/MD（.doc 请另存为 .docx）")
		return
	}

	dir := filepath.Join(h.UploadDir, filepath.Clean(tenantID), "ai-kb", filepath.Clean(kbID))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		respondServerError(w, r, err, "准备上传目录失败")
		return
	}
	storedName := uuid.NewString() + ext
	destPath := filepath.Join(dir, storedName)
	dest, err := os.Create(destPath)
	if err != nil {
		respondServerError(w, r, err, "创建文件失败")
		return
	}
	size, err := io.Copy(dest, file)
	dest.Close()
	if err != nil {
		os.Remove(destPath)
		respondServerError(w, r, err, "保存文件失败")
		return
	}

	doc, err := h.Service.RegisterDocument(r.Context(), tenantID, kbID, userID, header.Filename, destPath, size, header.Header.Get("Content-Type"))
	if err != nil {
		os.Remove(destPath)
		aiCenterError(w, r, err, "登记文档失败")
		return
	}
	respondJSON(w, http.StatusCreated, doc)
}

// GetDocument GET /ai/kb/{id}/documents/{docId}（解析状态轮询）
func (h *AICenterHandler) GetDocument(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	doc, err := h.Service.GetDocument(r.Context(), tenantID, chi.URLParam(r, "id"), chi.URLParam(r, "docId"), userID)
	if aiCenterError(w, r, err, "查询文档失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, doc)
}

// DeleteDocument DELETE /ai/kb/{id}/documents/{docId}
func (h *AICenterHandler) DeleteDocument(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	path, err := h.Service.DeleteDocument(r.Context(), tenantID, chi.URLParam(r, "id"), chi.URLParam(r, "docId"), userID)
	if aiCenterError(w, r, err, "删除文档失败"); err != nil {
		return
	}
	if rmErr := os.Remove(path); rmErr != nil {
		slog.Warn("ai doc file cleanup failed", "path", path, "error", rmErr)
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ==================== 协作者 ====================

// ListCollaborators GET /ai/kb/{id}/collaborators
func (h *AICenterHandler) ListCollaborators(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	list, err := h.Service.ListCollaborators(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "查询协作者失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": list})
}

type collaboratorRequest struct {
	UserID string `json:"userId"`
	Role   string `json:"role"`
}

// AddCollaborator POST /ai/kb/{id}/collaborators；UpdateCollaboratorRole PUT 复用（service 幂等 upsert）。
func (h *AICenterHandler) AddCollaborator(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var req collaboratorRequest
	if !decodeBody(w, r, &req) {
		return
	}
	// PUT 语义为「改角色」：目标用户取路径 {userId}；POST 取 body userId（幂等 upsert）
	targetUserID := chi.URLParam(r, "userId")
	if targetUserID == "" {
		targetUserID = req.UserID
	}
	if targetUserID == "" {
		respondError(w, http.StatusBadRequest, "缺少 userId")
		return
	}
	err := h.Service.AddCollaborator(r.Context(), tenantID, chi.URLParam(r, "id"), userID, targetUserID, req.Role)
	if errors.Is(err, service.ErrAIOwnerAsCollaborator) || errors.Is(err, service.ErrAIInvalidCollabRole) {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	if aiCenterError(w, r, err, "添加协作者失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// RemoveCollaborator DELETE /ai/kb/{id}/collaborators/{userId}
func (h *AICenterHandler) RemoveCollaborator(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	err := h.Service.RemoveCollaborator(r.Context(), tenantID, chi.URLParam(r, "id"), userID, chi.URLParam(r, "userId"))
	if aiCenterError(w, r, err, "移除协作者失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ==================== 智能体 ====================

func validateAgentInput(w http.ResponseWriter, in *service.AgentInput) bool {
	if strings.TrimSpace(in.Name) == "" || len([]rune(in.Name)) > 100 {
		respondError(w, http.StatusBadRequest, "名称必填且不超过 100 字")
		return false
	}
	if strings.TrimSpace(in.SystemPrompt) == "" || len([]rune(in.SystemPrompt)) > 4000 {
		respondError(w, http.StatusBadRequest, "提示词必填且不超过 4000 字")
		return false
	}
	if len([]rune(in.Description)) > 500 || len([]rune(in.Greeting)) > 500 {
		respondError(w, http.StatusBadRequest, "描述/欢迎语不超过 500 字")
		return false
	}
	return true
}

// ListAgents GET /ai/agents（我的）
func (h *AICenterHandler) ListAgents(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, err := h.Service.ListMyAgents(r.Context(), tenantID, userID)
	if aiCenterError(w, r, err, "查询智能体失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items})
}

// CreateAgent POST /ai/agents
func (h *AICenterHandler) CreateAgent(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var in service.AgentInput
	if !decodeBody(w, r, &in) {
		return
	}
	if !validateAgentInput(w, &in) {
		return
	}
	a, err := h.Service.CreateAgent(r.Context(), tenantID, userID, in)
	if aiCenterError(w, r, err, "创建智能体失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusCreated, a)
}

// GetAgent GET /ai/agents/{id}
func (h *AICenterHandler) GetAgent(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	a, err := h.Service.GetAgent(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "查询智能体失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, a)
}

// UpdateAgent PUT /ai/agents/{id}
func (h *AICenterHandler) UpdateAgent(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var in service.AgentInput
	if !decodeBody(w, r, &in) {
		return
	}
	if !validateAgentInput(w, &in) {
		return
	}
	err := h.Service.UpdateAgent(r.Context(), tenantID, chi.URLParam(r, "id"), userID, in)
	if aiCenterError(w, r, err, "更新智能体失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// DeleteAgent DELETE /ai/agents/{id}
func (h *AICenterHandler) DeleteAgent(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	err := h.Service.DeleteAgent(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "删除智能体失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// SubmitAgent POST /ai/agents/{id}/submit（返回 warnings：关联私有库提示）
func (h *AICenterHandler) SubmitAgent(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	warnings, err := h.Service.SubmitAgent(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "提交审核失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"status": "ok", "warnings": warnings})
}

// UnpublishAgent POST /ai/agents/{id}/unpublish
func (h *AICenterHandler) UnpublishAgent(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	err := h.Service.UnpublishAgent(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "下架失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ==================== SSE 对话 ====================

type aiChatStreamRequest struct {
	ConversationID string `json:"conversationId"`
	Message        string `json:"message"`
}

// sseEmitter 构造事件发射器：首次发射时提交 SSE 响应头（之前仍可返回 HTTP 错误 JSON）。
func sseEmitter(w http.ResponseWriter) (service.ChatEmit, func() bool, error) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, nil, errors.New("streaming unsupported")
	}
	started := false
	emit := func(event string, payload any) error {
		if !started {
			h := w.Header()
			h.Set("Content-Type", "text/event-stream; charset=utf-8")
			h.Set("Cache-Control", "no-cache")
			h.Set("Connection", "keep-alive")
			h.Set("X-Accel-Buffering", "no") // 禁用反向代理缓冲
			started = true
		}
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data); err != nil {
			return err // 客户端断开 → 中断上游流
		}
		flusher.Flush()
		return nil
	}
	return emit, func() bool { return started }, nil
}

// AgentChat POST /ai/agents/{id}/chat（SSE）
func (h *AICenterHandler) AgentChat(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var req aiChatStreamRequest
	if !decodeBody(w, r, &req) {
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" || len([]rune(req.Message)) > 2000 {
		respondError(w, http.StatusBadRequest, "消息必填且不超过 2000 字")
		return
	}
	emit, started, err := sseEmitter(w)
	if err != nil {
		respondServerError(w, r, err, "当前环境不支持流式输出")
		return
	}
	err = h.Service.AgentChat(r.Context(), tenantID, chi.URLParam(r, "id"), userID, req.ConversationID, req.Message, emit)
	if err != nil && !started() {
		aiCenterError(w, r, err, "对话失败")
		return
	}
	if err != nil {
		slog.Warn("ai agent chat stream aborted", "error", err)
	}
}

// KBAsk POST /ai/kb/{id}/ask（SSE）
func (h *AICenterHandler) KBAsk(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	var req aiChatStreamRequest
	if !decodeBody(w, r, &req) {
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" || len([]rune(req.Message)) > 2000 {
		respondError(w, http.StatusBadRequest, "消息必填且不超过 2000 字")
		return
	}
	emit, started, err := sseEmitter(w)
	if err != nil {
		respondServerError(w, r, err, "当前环境不支持流式输出")
		return
	}
	err = h.Service.KBAsk(r.Context(), tenantID, chi.URLParam(r, "id"), userID, req.Message, emit)
	if err != nil && !started() {
		aiCenterError(w, r, err, "问答失败")
		return
	}
	if err != nil {
		slog.Warn("ai kb ask stream aborted", "error", err)
	}
}

// ==================== 会话 ====================

// ListConversations GET /ai/agents/{id}/conversations
func (h *AICenterHandler) ListConversations(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, err := h.Service.ListConversations(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "查询会话失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items})
}

// GetConversation GET /ai/conversations/{id}
func (h *AICenterHandler) GetConversation(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	cv, msgs, err := h.Service.GetConversationMessages(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "查询会话失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"conversation": cv, "messages": msgs})
}

// DeleteConversation DELETE /ai/conversations/{id}
func (h *AICenterHandler) DeleteConversation(w http.ResponseWriter, r *http.Request) {
	tenantID, userID, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	err := h.Service.DeleteConversation(r.Context(), tenantID, chi.URLParam(r, "id"), userID)
	if aiCenterError(w, r, err, "删除会话失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ==================== 广场与挂接展示 ====================

// SquareKBs GET /ai/square/kbs
func (h *AICenterHandler) SquareKBs(w http.ResponseWriter, r *http.Request) {
	tenantID, _, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	page, pageSize := aiCenterPage(r)
	q := r.URL.Query()
	items, total, err := h.Service.ListSquareKBs(r.Context(), tenantID,
		strings.TrimSpace(q.Get("q")), strings.TrimSpace(q.Get("tag")), q.Get("sort"), page, pageSize)
	if aiCenterError(w, r, err, "查询广场失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

// SquareAgents GET /ai/square/agents
func (h *AICenterHandler) SquareAgents(w http.ResponseWriter, r *http.Request) {
	tenantID, _, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	page, pageSize := aiCenterPage(r)
	q := r.URL.Query()
	items, total, err := h.Service.ListSquareAgents(r.Context(), tenantID,
		strings.TrimSpace(q.Get("q")), q.Get("sort"), page, pageSize)
	if aiCenterError(w, r, err, "查询广场失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

// ListIntegrations GET /ai/integrations?kind=（广场展示，仅 active）
func (h *AICenterHandler) ListIntegrations(w http.ResponseWriter, r *http.Request) {
	tenantID, _, ok := aiCenterUser(r)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, err := h.Service.ListIntegrations(r.Context(), tenantID, r.URL.Query().Get("kind"), true)
	if aiCenterError(w, r, err, "查询应用失败"); err != nil {
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items})
}

package service

import "github.com/zhiyu-saas/backend/internal/store"

// ApprovalService 审批流与流程配置域（审批记录/工作流）业务编排。
type ApprovalService struct {
	*Service
	st *store.Store
}

// NewApprovalService 创建审批服务。
func NewApprovalService(s *Service) *ApprovalService {
	return &ApprovalService{Service: s, st: s.Store()}
}

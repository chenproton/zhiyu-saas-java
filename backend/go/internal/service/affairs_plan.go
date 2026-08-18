package service

import "github.com/zhiyu-saas/backend/internal/store"

// AffairsPlanService 教务计划域（学期/培养方案/教学计划）业务编排。
type AffairsPlanService struct {
	*Service
	st *store.Store
}

// NewAffairsPlanService 创建教务计划服务。
func NewAffairsPlanService(s *Service) *AffairsPlanService {
	return &AffairsPlanService{Service: s, st: s.Store()}
}

package handler

import (
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// 5 类业务批次共用 BatchHandler 模板，差异仅为表/列/状态配置。
// 配置（含 SQL 片段与扫描函数）沉淀在 store 层（store/batch_configs.go），
// 子类型仅作路由类型标识。

type JobBatchHandler struct {
	*BatchHandler
}

func NewJobBatchHandler(svc *service.PositionService) *JobBatchHandler {
	return &JobBatchHandler{
		BatchHandler: NewBatchHandler(svc, store.NewJobBatchTableConfig()),
	}
}

type SceneBatchHandler struct {
	*BatchHandler
}

func NewSceneBatchHandler(svc *service.ScenarioService) *SceneBatchHandler {
	return &SceneBatchHandler{
		BatchHandler: NewBatchHandler(svc, store.NewSceneBatchTableConfig()),
	}
}

type CourseBatchHandler struct {
	*BatchHandler
}

func NewCourseBatchHandler(svc *service.PositionService) *CourseBatchHandler {
	return &CourseBatchHandler{
		BatchHandler: NewBatchHandler(svc, store.NewCourseBatchTableConfig()),
	}
}

type EvaluationBatchHandler struct {
	*BatchHandler
}

func NewEvaluationBatchHandler(svc *service.EvaluationService) *EvaluationBatchHandler {
	return &EvaluationBatchHandler{
		BatchHandler: NewBatchHandler(svc, store.NewEvaluationBatchTableConfig()),
	}
}

type AffairsBatchHandler struct {
	*BatchHandler
}

func NewAffairsBatchHandler(svc *service.PositionService) *AffairsBatchHandler {
	return &AffairsBatchHandler{
		BatchHandler: NewBatchHandler(svc, store.NewAffairsBatchTableConfig()),
	}
}

package router

import (
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func registerEvaluationRoutes(r chi.Router, db *pgxpool.Pool, h *Handlers) {
	registerContentRoutes(r, "/evaluation/question-banks", h.questionBankHandler)

	r.Get("/evaluation/questions", h.questionHandler.List)
	r.Get("/evaluation/questions/{id}", h.questionHandler.Get)
	r.Post("/evaluation/questions", h.questionHandler.Create)
	r.Put("/evaluation/questions/{id}", h.questionHandler.Update)
	r.Delete("/evaluation/questions/{id}", h.questionHandler.Delete)
	r.Post("/evaluation/questions/batch", h.questionHandler.BatchCreate)

	r.Get("/evaluation/random-draw-questions", h.randomDrawQuestionHandler.List)
	r.Get("/evaluation/random-draw-questions/{id}", h.randomDrawQuestionHandler.Get)
	r.Post("/evaluation/random-draw-questions", h.randomDrawQuestionHandler.Create)
	r.Put("/evaluation/random-draw-questions/{id}", h.randomDrawQuestionHandler.Update)
	r.Delete("/evaluation/random-draw-questions/{id}", h.randomDrawQuestionHandler.Delete)

	// 考试只读（List/Get）挂在 jobViewer 角色组（routes.go，含学生），此处仅注册写操作
	registerContentWriteRoutes(r, "/evaluation/exams", "exams", db, h.examHandler)
	r.Post("/evaluation/exams/{id}/questions", h.examHandler.AddQuestion)
	r.Put("/evaluation/exams/{id}/questions/scores", h.examHandler.BulkUpdateScores)
	r.Put("/evaluation/exams/{id}/questions/{questionId}", h.examHandler.UpdateQuestionScore)
	r.Delete("/evaluation/exams/{id}/questions/{questionId}", h.examHandler.RemoveQuestion)

	// 考试安排的 List/Get/Start 挂在 jobViewer 组（routes.go，含学生），此处仅注册管理写操作
	r.Post("/evaluation/exam-usages", h.examUsageHandler.Create)
	r.Put("/evaluation/exam-usages/{id}", h.examUsageHandler.Update)
	r.Delete("/evaluation/exam-usages/{id}", h.examUsageHandler.Delete)
	r.Post("/evaluation/exam-usages/{id}/publish", h.examUsageHandler.Publish)
	r.Post("/evaluation/exam-usages/{id}/finish", h.examUsageHandler.Finish)

	// 考试结果的 List 保留供教师查阅，提交（Create）挂在 jobViewer 组（routes.go，含学生）
	r.Get("/evaluation/exam-results", h.examResultHandler.List)
	r.Get("/evaluation/exam-results/{id}", h.examResultHandler.Get)
	r.Post("/evaluation/exam-results/{id}/grade", h.examResultHandler.Grade)

	// 场景评估结果的学生可读/可提交接口挂在 jobViewer 角色组（routes.go，含学生），
	// 评分（grade/batch-grade）仍限本组业务角色。
	r.Get("/evaluation/results/{id}", h.evaluationResultHandler.Get)
	r.Post("/evaluation/results/{id}/grade", h.evaluationResultHandler.Grade)
	r.Post("/evaluation/results/batch-grade", h.evaluationResultHandler.BatchGrade)

	// 岗位能力汇聚结果 List 挂在 jobViewer 角色组（routes.go，含学生），学生可查看本人结果
	r.Get("/evaluation/job-ability/results/summary", h.jobAbilityResultHandler.Summary)
	r.Get("/evaluation/job-ability/results/{id}", h.jobAbilityResultHandler.Get)
	r.Post("/evaluation/job-ability/aggregate", h.jobAbilityResultHandler.Aggregate)
	r.Get("/evaluation/job-ability/aggregate/status", h.jobAbilityResultHandler.AggregateStatus)

	r.Get("/evaluation/certifications", h.certificationHandler.ListRules)
	r.Get("/evaluation/certifications/positions/{positionId}/model", h.certificationModelHandler.GetModel)
	r.Put("/evaluation/certifications/positions/{positionId}/weights", h.certificationModelHandler.PutWeights)
	r.Put("/evaluation/certifications/positions/{positionId}/points/{abilityPointId}/levels", h.certificationModelHandler.PutPointLevels)
	r.Put("/evaluation/certifications/positions/{positionId}/points/{abilityPointId}/task-weights", h.certificationModelHandler.PutPointTaskWeights)
	r.Get("/evaluation/certifications/{id}", h.certificationHandler.GetRule)
	r.Post("/evaluation/certifications", h.certificationHandler.CreateRule)
	r.Put("/evaluation/certifications/{id}", h.certificationHandler.UpdateRule)
	r.Post("/evaluation/certifications/{id}/status", h.certificationHandler.UpdateRuleStatus)
	r.Delete("/evaluation/certifications/{id}", h.certificationHandler.DeleteRule)
	r.Get("/evaluation/certifications/{id}/items", h.certificationHandler.ConfigItems)
	r.Post("/evaluation/certifications/{id}/items", h.certificationHandler.ConfigItems)
	r.Get("/evaluation/certifications/items/{id}/points", h.certificationHandler.ConfigPoints)
	r.Post("/evaluation/certifications/items/{id}/points", h.certificationHandler.ConfigPoints)
	r.Get("/evaluation/certifications/{id}/full", h.certificationHandler.GetFullRule)
	r.Put("/evaluation/certifications/{id}/full", h.certificationHandler.PutFullRule)
	r.Put("/evaluation/certifications/items/{id}", h.certificationHandler.UpdateItem)
	r.Delete("/evaluation/certifications/items/{id}", h.certificationHandler.DeleteItem)
	r.Put("/evaluation/certifications/points/{id}", h.certificationHandler.UpdatePoint)
	r.Delete("/evaluation/certifications/points/{id}", h.certificationHandler.DeletePoint)
	r.Post("/evaluation/certifications/points/{pointId}/tasks", h.certificationHandler.CreateTask)
	r.Put("/evaluation/certifications/tasks/{id}", h.certificationHandler.UpdateTask)
	r.Delete("/evaluation/certifications/tasks/{id}", h.certificationHandler.DeleteTask)

	r.Post("/evaluation/portraits/generate", h.studentPortraitHandler.Generate)
	r.Get("/evaluation/portraits/archives", h.studentPortraitHandler.ListArchives)
	r.Post("/evaluation/portraits/archives", h.studentPortraitHandler.CreateArchive)
	r.Delete("/evaluation/portraits/archives/{id}", h.studentPortraitHandler.DeleteArchive)

	r.Get("/evaluation/appeals", h.appealHandler.List)
	r.Get("/evaluation/appeals/{id}", h.appealHandler.Get)
	r.Post("/evaluation/appeals", h.appealHandler.Create)
	r.Post("/evaluation/appeals/{id}/process", h.appealHandler.Process)

	registerBatchRoutes(r, "/evaluation/batches", h.evaluationBatchHandler)
}

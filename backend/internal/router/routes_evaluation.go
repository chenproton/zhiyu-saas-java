package router

import "github.com/go-chi/chi/v5"

func registerEvaluationRoutes(r chi.Router, h *Handlers) {
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

	registerContentRoutes(r, "/evaluation/exams", h.examHandler)
	r.Post("/evaluation/exams/{id}/questions", h.examHandler.AddQuestion)
	r.Put("/evaluation/exams/{id}/questions/scores", h.examHandler.BulkUpdateScores)
	r.Put("/evaluation/exams/{id}/questions/{questionId}", h.examHandler.UpdateQuestionScore)
	r.Delete("/evaluation/exams/{id}/questions/{questionId}", h.examHandler.RemoveQuestion)

	r.Get("/evaluation/exam-usages", h.examUsageHandler.List)
	r.Get("/evaluation/exam-usages/{id}", h.examUsageHandler.Get)
	r.Post("/evaluation/exam-usages", h.examUsageHandler.Create)
	r.Put("/evaluation/exam-usages/{id}", h.examUsageHandler.Update)
	r.Delete("/evaluation/exam-usages/{id}", h.examUsageHandler.Delete)
	r.Post("/evaluation/exam-usages/{id}/start", h.examUsageHandler.Start)
	r.Post("/evaluation/exam-usages/{id}/finish", h.examUsageHandler.Finish)

	r.Get("/evaluation/exam-results", h.examResultHandler.List)
	r.Post("/evaluation/exam-results", h.examResultHandler.Create)

	r.Get("/evaluation/results", h.evaluationResultHandler.List)
	r.Post("/evaluation/results", h.evaluationResultHandler.Submit)
	r.Get("/evaluation/results/{id}", h.evaluationResultHandler.Get)
	r.Post("/evaluation/results/{id}/grade", h.evaluationResultHandler.Grade)
	r.Post("/evaluation/results/batch-grade", h.evaluationResultHandler.BatchGrade)

	r.Get("/evaluation/certifications", h.certificationHandler.ListRules)
	r.Get("/evaluation/certifications/{id}", h.certificationHandler.GetRule)
	r.Post("/evaluation/certifications", h.certificationHandler.CreateRule)
	r.Put("/evaluation/certifications/{id}", h.certificationHandler.UpdateRule)
	r.Delete("/evaluation/certifications/{id}", h.certificationHandler.DeleteRule)
	r.Get("/evaluation/certifications/{id}/items", h.certificationHandler.ConfigItems)
	r.Post("/evaluation/certifications/{id}/items", h.certificationHandler.ConfigItems)
	r.Get("/evaluation/certifications/items/{id}/points", h.certificationHandler.ConfigPoints)
	r.Post("/evaluation/certifications/items/{id}/points", h.certificationHandler.ConfigPoints)
	r.Get("/evaluation/certifications/{id}/full", h.certificationHandler.GetFullRule)

	r.Get("/evaluation/graduation/topics", h.graduationHandler.ListTopics)
	r.Get("/evaluation/graduation/topics/{id}", h.graduationHandler.GetTopic)
	r.Post("/evaluation/graduation/topics", h.graduationHandler.CreateTopic)
	r.Put("/evaluation/graduation/topics/{id}", h.graduationHandler.UpdateTopic)
	r.Delete("/evaluation/graduation/topics/{id}", h.graduationHandler.DeleteTopic)
	r.Post("/evaluation/graduation/topics/{id}/apply", h.graduationHandler.ApplyTopic)
	r.Get("/evaluation/graduation/archives", h.graduationHandler.ArchivesCRUD)
	r.Post("/evaluation/graduation/archives", h.graduationHandler.ArchivesCRUD)
	r.Get("/evaluation/graduation/evaluations", h.graduationHandler.EvaluationsCRUD)
	r.Post("/evaluation/graduation/evaluations", h.graduationHandler.EvaluationsCRUD)
	r.Get("/evaluation/graduation/query", h.graduationHandler.QueryResults)

	r.Get("/evaluation/portraits", h.studentPortraitHandler.List)
	r.Get("/evaluation/portraits/{id}", h.studentPortraitHandler.Get)
	r.Post("/evaluation/portraits/generate", h.studentPortraitHandler.Generate)
	r.Get("/evaluation/portraits/archives", h.studentPortraitHandler.ListArchives)
	r.Post("/evaluation/portraits/archives", h.studentPortraitHandler.CreateArchive)

	r.Get("/evaluation/certificates/templates", h.microCertHandler.ListTemplates)
	r.Post("/evaluation/certificates/templates", h.microCertHandler.CreateTemplate)
	r.Get("/evaluation/certificates/templates/{id}", h.microCertHandler.GetTemplate)
	r.Put("/evaluation/certificates/templates/{id}", h.microCertHandler.UpdateTemplate)
	r.Delete("/evaluation/certificates/templates/{id}", h.microCertHandler.DeleteTemplate)
	r.Post("/evaluation/certificates/issue", h.microCertHandler.IssueCerts)
	r.Get("/evaluation/certificates/history", h.microCertHandler.ListHistory)

	r.Get("/evaluation/methods/categories", h.evaluationMethodHandler.ListCategories)
	r.Get("/evaluation/methods", h.evaluationMethodHandler.ListMethods)
	r.Post("/evaluation/methods/{id}/toggle", h.evaluationMethodHandler.Toggle)

	r.Get("/evaluation/appeals", h.appealHandler.List)
	r.Get("/evaluation/appeals/{id}", h.appealHandler.Get)
	r.Post("/evaluation/appeals", h.appealHandler.Create)
	r.Post("/evaluation/appeals/{id}/process", h.appealHandler.Process)

	registerBatchRoutes(r, "/evaluation/batches", h.evaluationBatchHandler)
}

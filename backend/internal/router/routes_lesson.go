package router

import "github.com/go-chi/chi/v5"

func registerLessonRoutes(r chi.Router, h *Handlers) {
	registerContentRoutes(r, "/lesson/courses", h.courseHandler)

	r.Get("/lesson/knowledge-points", h.knowledgePointHandler.List)
	r.Get("/lesson/knowledge-points/{id}", h.knowledgePointHandler.Get)
	r.Post("/lesson/knowledge-points", h.knowledgePointHandler.Create)
	r.Put("/lesson/knowledge-points/{id}", h.knowledgePointHandler.Update)
	r.Delete("/lesson/knowledge-points/{id}", h.knowledgePointHandler.Delete)

	r.Get("/lesson/nodes", h.courseNodeHandler.List)
	r.Get("/lesson/nodes/{id}", h.courseNodeHandler.Get)
	r.Post("/lesson/nodes", h.courseNodeHandler.Create)
	r.Put("/lesson/nodes/{id}", h.courseNodeHandler.Update)
	r.Delete("/lesson/nodes/{id}", h.courseNodeHandler.Delete)
	r.Post("/lesson/nodes/reorder", h.courseNodeHandler.Reorder)

	r.Get("/lesson/quizzes", h.nodeQuizHandler.ListQuizzes)
	r.Post("/lesson/quizzes", h.nodeQuizHandler.CreateQuiz)
	r.Get("/lesson/quizzes/{id}", h.nodeQuizHandler.ListQuestions)
	r.Put("/lesson/quizzes/{id}", h.nodeQuizHandler.UpdateQuiz)
	r.Delete("/lesson/quizzes/{id}", h.nodeQuizHandler.DeleteQuiz)
	r.Post("/lesson/quizzes/{id}/questions", h.nodeQuizHandler.AddQuestion)
	r.Put("/lesson/quizzes/questions/{questionId}", h.nodeQuizHandler.UpdateQuestion)
	r.Delete("/lesson/quizzes/questions/{questionId}", h.nodeQuizHandler.DeleteQuestion)

	r.Get("/lesson/homeworks", h.nodeHomeworkHandler.List)
	r.Get("/lesson/homeworks/{id}", h.nodeHomeworkHandler.Get)
	r.Post("/lesson/homeworks", h.nodeHomeworkHandler.Create)
	r.Put("/lesson/homeworks/{id}", h.nodeHomeworkHandler.Update)
	r.Delete("/lesson/homeworks/{id}", h.nodeHomeworkHandler.Delete)

	r.Get("/lesson/node-resources", h.nodeResourceHandler.ListResources)
	r.Post("/lesson/node-resources/create", h.nodeResourceHandler.Create)
	r.Post("/lesson/node-resources", h.nodeResourceHandler.BindResource)
	r.Delete("/lesson/node-resources/{id}", h.nodeResourceHandler.UnbindResource)

	r.Get("/lesson/course-resources", h.courseResourceHandler.ListResources)
	r.Post("/lesson/course-resources/create", h.courseResourceHandler.Create)
	r.Post("/lesson/course-resources", h.courseResourceHandler.BindResource)
	r.Delete("/lesson/course-resources/{id}", h.courseResourceHandler.UnbindResource)

	r.Get("/lesson/hybrid-modules", h.hybridModuleHandler.ListModules)
	r.Post("/lesson/hybrid-modules", h.hybridModuleHandler.UpsertModule)
	r.Put("/lesson/hybrid-modules/{id}", h.hybridModuleHandler.UpsertModule)
	r.Delete("/lesson/hybrid-modules/{id}", h.hybridModuleHandler.DeleteModule)

	registerBatchRoutes(r, "/lesson/batches", h.courseBatchHandler)

	r.Get("/lesson/behavior-collection/aggregate", h.lessonBehaviorHandler.Aggregate)
	r.Post("/lesson/behavior-collection/records", h.lessonBehaviorHandler.Create)
}

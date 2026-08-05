package router

import "github.com/go-chi/chi/v5"

func registerLessonRoutes(r chi.Router, h *Handlers) {
	registerContentRoutes(r, "/lesson/courses", h.courseHandler)
	r.Post("/lesson/courses/{id}/clone", h.courseCloneHandler.Clone)
	r.Get("/lesson/courses/{id}/assessments", h.courseHandler.Assessments)
	r.Post("/lesson/courses/{id}/homeworks/{homeworkId}/submit", h.courseHandler.SubmitHomework)
	r.Get("/lesson/courses/{id}/homeworks/{homeworkId}/submissions", h.courseHandler.ListHomeworkSubmissions)
	r.Post("/lesson/courses/{id}/homeworks/{homeworkId}/submissions/{submissionId}/grade", h.courseHandler.GradeHomeworkSubmission)

	// 节点作业查询/批改（教师端）
	r.Get("/lesson/nodes/{nodeId}/homeworks/{homeworkId}/submissions", h.courseHandler.ListNodeHomeworkSubmissions)
	r.Post("/lesson/nodes/{nodeId}/homeworks/{homeworkId}/submissions/{submissionId}/grade", h.courseHandler.GradeNodeHomeworkSubmission)

	// 节点测评结果评分（教师端）
	r.Get("/lesson/course-node-evaluation-results", h.nodeEvaluationResultHandler.ListByCourse)
	r.Get("/lesson/node-evaluation-results/{id}", h.nodeEvaluationResultHandler.Get)
	r.Post("/lesson/node-evaluation-results/{id}/grade", h.nodeEvaluationResultHandler.Grade)

	// 知识点只读接口挂在 jobViewer 角色组（routes.go，含学生），供学生场景学习页使用
	r.Post("/lesson/knowledge-points", h.knowledgePointHandler.Create)
	r.Put("/lesson/knowledge-points/{id}", h.knowledgePointHandler.Update)
	r.Delete("/lesson/knowledge-points/{id}", h.knowledgePointHandler.Delete)

	// 节点只读接口（List/Get）已移至 jobViewer 组，供学生体系课学习页使用
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

package router

import (
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func registerLessonRoutes(r chi.Router, db *pgxpool.Pool, h *Handlers) {
	// 写路由只注册写操作（GET List/Get 由跨模块只读组 / lesson 只读面提供）：
	// 此前 registerContentRoutes 同时注册 GET /lesson/courses，chi 同路径后注册顶替先注册，
	// 把宽授权（任一业务落地页菜单）的 List 顶成 lesson 管理菜单窄授权，
	// 导致仅 /job/landing 菜单的角色访问岗位知识图谱 403。
	registerContentWriteRoutes(r, "/lesson/courses", "courses", db, h.courseHandler)
	r.Post("/lesson/courses/{id}/clone", h.courseCloneHandler.Clone)

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
	r.Post("/lesson/hybrid-modules/batch", h.hybridModuleHandler.BatchSave)

	registerBatchRoutes(r, "/lesson/batches", h.courseBatchHandler)

	r.Get("/lesson/behavior-collection/aggregate", h.lessonBehaviorHandler.Aggregate)
	r.Post("/lesson/behavior-collection/records", h.lessonBehaviorHandler.Create)
}

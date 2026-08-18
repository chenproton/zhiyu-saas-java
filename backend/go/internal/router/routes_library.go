package router

import "github.com/go-chi/chi/v5"

func registerLibraryRoutes(r chi.Router, h *Handlers) {
	// 只读接口（List/Stats/Get）由跨模块只读引用组与 library 只读面提供
	// （任一业务管理/落地页菜单可读，scene/lesson 落地页引用资源库）。
	// 管理面只注册写操作，避免 chi 同路径后注册顶替宽授权（曾致
	// lesson/courses 宽授权 List 被管理面顶替 → 岗位知识图谱 403）。
	r.Get("/library/resources/citation-stats", h.resourceLibraryHandler.CitationStats)
	r.Get("/library/resources/uncited", h.resourceLibraryHandler.UncitedList)
	r.Post("/library/resources", h.resourceLibraryHandler.Create)
	r.Post("/library/resources/import/preview", h.resourceLibraryHandler.PreviewImport)
	r.Put("/library/resources/{id}", h.resourceLibraryHandler.Update)
	r.Delete("/library/resources/{id}", h.resourceLibraryHandler.Delete)

	r.Get("/library/on-site-questions", h.onSiteQuestionLibraryHandler.List)
	r.Get("/library/on-site-questions/{id}", h.onSiteQuestionLibraryHandler.Get)
	r.Post("/library/on-site-questions", h.onSiteQuestionLibraryHandler.Create)
	r.Put("/library/on-site-questions/{id}", h.onSiteQuestionLibraryHandler.Update)
	r.Delete("/library/on-site-questions/{id}", h.onSiteQuestionLibraryHandler.Delete)

	r.Get("/library/tags", h.tagHandler.List)
	r.Post("/library/tags", h.tagHandler.Create)
	r.Put("/library/tags/{id}", h.tagHandler.Update)
	r.Delete("/library/tags/{id}", h.tagHandler.Delete)
	r.Post("/library/resource-tags", h.tagHandler.SetBindings)
	// QueryBindings（资源标签批量查询）为库浏览必需，注册在 jobViewer 组（含学生）
}

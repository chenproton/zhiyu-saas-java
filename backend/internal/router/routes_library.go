package router

import "github.com/go-chi/chi/v5"

func registerLibraryRoutes(r chi.Router, h *Handlers) {
	r.Get("/library/resources", h.resourceLibraryHandler.List)
	r.Get("/library/resources/stats", h.resourceLibraryHandler.Stats)
	r.Get("/library/resources/{id}", h.resourceLibraryHandler.Get)
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
	r.Post("/library/resource-tags/query", h.tagHandler.QueryBindings)
}

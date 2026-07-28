package router

import "github.com/go-chi/chi/v5"

func registerJobRoutes(r chi.Router, h *Handlers) {
	registerContentRoutes(r, "/job/positions", h.positionHandler)
	r.Post("/job/positions/{id}/clone", h.positionCloneHandler.Clone)
	r.Put("/job/positions/{id}/save-full", h.positionHandler.SaveFull)
	r.Get("/job/positions/{id}/favorite", h.positionHandler.GetFavorite)
	r.Post("/job/positions/{id}/favorite", h.positionHandler.ToggleFavorite)
	r.Get("/job/positions/favorites", h.positionHandler.ListFavorites)

	r.Get("/job/abilities", h.abilityHandler.List)
	r.Get("/job/abilities/{id}", h.abilityHandler.Get)
	r.Post("/job/abilities", h.abilityHandler.Create)
	r.Put("/job/abilities/{id}", h.abilityHandler.Update)
	r.Delete("/job/abilities/{id}", h.abilityHandler.Delete)

	r.Get("/job/position-abilities", h.positionAbilityHandler.ListBindings)
	r.Post("/job/position-abilities", h.positionAbilityHandler.CreateBinding)
	r.Put("/job/position-abilities/{id}", h.positionAbilityHandler.UpdateBinding)
	r.Delete("/job/position-abilities/{id}", h.positionAbilityHandler.DeleteBinding)

	r.Get("/job/position-responsibilities", h.positionResponsibilityHandler.List)
	r.Get("/job/position-responsibilities/{id}", h.positionResponsibilityHandler.Get)
	r.Post("/job/position-responsibilities", h.positionResponsibilityHandler.Create)
	r.Put("/job/position-responsibilities/{id}", h.positionResponsibilityHandler.Update)
	r.Delete("/job/position-responsibilities/{id}", h.positionResponsibilityHandler.Delete)

	r.Get("/job/position-certificates", h.positionCertificateHandler.List)
	r.Get("/job/position-certificates/{id}", h.positionCertificateHandler.Get)
	r.Post("/job/position-certificates", h.positionCertificateHandler.Create)
	r.Put("/job/position-certificates/{id}", h.positionCertificateHandler.Update)
	r.Delete("/job/position-certificates/{id}", h.positionCertificateHandler.Delete)

	r.Get("/job/certificate-library", h.certificateLibraryHandler.List)
	r.Get("/job/certificate-library/{id}", h.certificateLibraryHandler.Get)
	r.Post("/job/certificate-library", h.certificateLibraryHandler.Create)
	r.Put("/job/certificate-library/{id}", h.certificateLibraryHandler.Update)
	r.Delete("/job/certificate-library/{id}", h.certificateLibraryHandler.Delete)

	r.Get("/job/ability-domains", h.abilityDomainHandler.List)
	r.Post("/job/ability-domains", h.abilityDomainHandler.Create)
	r.Get("/job/ability-domains/{id}", h.abilityDomainHandler.Get)
	r.Put("/job/ability-domains/{id}", h.abilityDomainHandler.Update)
	r.Delete("/job/ability-domains/{id}", h.abilityDomainHandler.Delete)

	registerBatchRoutes(r, "/job/batches", h.jobBatchHandler)

	r.Get("/job/recommendations", h.recommendHandler.List)
	r.Post("/job/recommendations", h.recommendHandler.Create)
	r.Put("/job/recommendations/{id}", h.recommendHandler.Update)
	r.Delete("/job/recommendations/{id}", h.recommendHandler.Delete)

	r.Get("/job/learn-roads", h.learnRoadHandler.List)
	r.Get("/job/learn-roads/{id}", h.learnRoadHandler.Get)
	r.Post("/job/learn-roads", h.learnRoadHandler.Create)
	r.Put("/job/learn-roads/{id}", h.learnRoadHandler.Update)
	r.Delete("/job/learn-roads/{id}", h.learnRoadHandler.Delete)

	r.Get("/job/banners", h.jobBannerHandler.List)
	r.Get("/job/banners/{id}", h.jobBannerHandler.Get)
	r.Post("/job/banners", h.jobBannerHandler.Create)
	r.Put("/job/banners/{id}", h.jobBannerHandler.Update)
	r.Delete("/job/banners/{id}", h.jobBannerHandler.Delete)
}

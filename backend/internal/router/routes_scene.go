package router

import "github.com/go-chi/chi/v5"

func registerSceneRoutes(r chi.Router, h *Handlers) {
	registerContentRoutes(r, "/scene/scenarios", h.scenarioHandler)
	r.Post("/scene/scenarios/{id}/clone", h.scenarioCloneHandler.Clone)

	r.Get("/scene/tasks", h.scenarioTaskHandler.List)
	r.Get("/scene/tasks/{id}", h.scenarioTaskHandler.Get)
	r.Post("/scene/tasks", h.scenarioTaskHandler.Create)
	r.Put("/scene/tasks/{id}", h.scenarioTaskHandler.Update)
	r.Delete("/scene/tasks/{id}", h.scenarioTaskHandler.Delete)
	r.Post("/scene/tasks/reorder", h.scenarioTaskHandler.Reorder)

	r.Get("/scene/tasks/{taskId}/evaluation-methods", h.taskEvaluationHandler.ListMethods)
	r.Put("/scene/tasks/{taskId}/evaluation-methods", h.taskEvaluationHandler.SaveMethods)

	r.Get("/scene/rubric-templates", h.taskEvaluationHandler.ListTemplates)
	r.Post("/scene/rubric-templates", h.taskEvaluationHandler.CreateTemplate)
	r.Get("/scene/rubric-templates/{id}", h.taskEvaluationHandler.GetTemplate)
	r.Put("/scene/rubric-templates/{id}", h.taskEvaluationHandler.UpdateTemplate)
	r.Delete("/scene/rubric-templates/{id}", h.taskEvaluationHandler.DeleteTemplate)

	r.Get("/scene/task-resources", h.taskResourceHandler.ListResources)
	r.Post("/scene/task-resources", h.taskResourceHandler.BindResource)
	r.Post("/scene/task-resources/create", h.taskResourceHandler.Create)
	r.Delete("/scene/task-resources/{id}", h.taskResourceHandler.UnbindResource)

	r.Post("/scene/task-bindings/knowledge", h.taskKnowledgeAbilityHandler.BindKnowledge)
	r.Delete("/scene/task-bindings/knowledge/{id}", h.taskKnowledgeAbilityHandler.UnbindKnowledge)
	r.Post("/scene/task-bindings/ability", h.taskKnowledgeAbilityHandler.BindAbility)
	r.Delete("/scene/task-bindings/ability/{id}", h.taskKnowledgeAbilityHandler.UnbindAbility)

	r.Get("/scene/weights", h.scenarioWeightHandler.ListWeights)
	r.Post("/scene/weights", h.scenarioWeightHandler.UpsertWeight)
	r.Put("/scene/weights/{id}", h.scenarioWeightHandler.UpsertWeight)

	r.Get("/scene/grade-mappings", h.scenarioGradeHandler.ListGradeMappings)
	r.Post("/scene/grade-mappings", h.scenarioGradeHandler.UpsertGradeMapping)
	r.Put("/scene/grade-mappings/{id}", h.scenarioGradeHandler.UpsertGradeMapping)

	registerBatchRoutes(r, "/scene/batches", h.sceneBatchHandler)
}

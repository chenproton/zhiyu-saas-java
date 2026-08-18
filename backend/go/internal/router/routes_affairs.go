package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// registerAffairsRoutes 教务管理服务平台路由（学期/人培方案/教学计划/排课），
// 调用方需已挂载 businessUser 角色组。
// importExportLimiter 与 registerImportExportRoutes 一致（10 次/分钟/用户），
// 仅作用于导入/导出/模板下载类端点；其余端点不挂限流。
func registerAffairsRoutes(r chi.Router, h *Handlers, importExportLimiter func(http.Handler) http.Handler) {
	// 学期
	r.Get("/affairs/terms", h.affairsTermHandler.List)
	r.Post("/affairs/terms", h.affairsTermHandler.Create)
	r.Put("/affairs/terms/{id}", h.affairsTermHandler.Update)
	r.Delete("/affairs/terms/{id}", h.affairsTermHandler.Delete)

	// 人才培养方案（接入内容管理通用架构）
	registerContentRoutes(r, "/affairs/programs", h.trainingProgramHandler)
	r.Get("/affairs/programs/{id}/courses", h.trainingProgramHandler.ListCourses)
	r.Put("/affairs/programs/{id}/courses", h.trainingProgramHandler.PutCourses)
	r.Post("/affairs/programs/{id}/clone", h.trainingProgramHandler.Clone)

	// 批次 / 审批
	registerBatchRoutes(r, "/affairs/batches", h.affairsBatchHandler)
	r.Get("/affairs/workflows", h.workflowHandler.List)
	r.Post("/affairs/workflows", h.workflowHandler.Create)
	r.Get("/affairs/workflows/{id}", h.workflowHandler.Get)
	r.Put("/affairs/workflows/{id}", h.workflowHandler.Update)
	r.Delete("/affairs/workflows/{id}", h.workflowHandler.Delete)

	// 教学计划（接入内容管理通用架构；生成仍走 POST /affairs/teaching-plans）
	registerContentRoutes(r, "/affairs/teaching-plans", h.teachingPlanHandler)
	r.Put("/affairs/teaching-plans/entries/{id}", h.teachingPlanHandler.UpdateEntry)
	r.Delete("/affairs/teaching-plans/entries/{id}", h.teachingPlanHandler.DeleteEntry)
	r.Post("/affairs/teaching-plans/{id}/confirm", h.teachingPlanHandler.Confirm)
	// export 为 Excel 导出（同 registerImportExportRoutes 的 export 类端点），挂导入导出限流
	r.With(importExportLimiter).Get("/affairs/teaching-plans/{id}/export", h.teachingPlanHandler.ExportExcel)

	// 场地 / 节次
	r.Get("/affairs/venues", h.schedulingHandler.ListVenues)
	r.Post("/affairs/venues", h.schedulingHandler.CreateVenue)
	r.Put("/affairs/venues/{id}", h.schedulingHandler.UpdateVenue)
	r.Delete("/affairs/venues/{id}", h.schedulingHandler.DeleteVenue)

	// 节次只读接口挂在 jobViewer 角色组（routes.go，含学生），学生/教师课表渲染共用
	r.Post("/affairs/period-slots", h.schedulingHandler.CreatePeriodSlot)
	// replace 需先于 {id} 注册，避免被当作文档 id 捕获
	r.Put("/affairs/period-slots/replace", h.schedulingHandler.ReplacePeriodSlots)
	r.Put("/affairs/period-slots/{id}", h.schedulingHandler.UpdatePeriodSlot)
	r.Delete("/affairs/period-slots/{id}", h.schedulingHandler.DeletePeriodSlot)

	// 排课
	r.Get("/affairs/schedules", h.schedulingHandler.ListSchedules)
	r.Post("/affairs/schedules", h.schedulingHandler.CreateSchedule)
	r.Post("/affairs/schedules/auto-schedule", h.schedulingHandler.AutoSchedule)
	r.Put("/affairs/schedules/{id}", h.schedulingHandler.UpdateSchedule)
	r.Delete("/affairs/schedules/{id}", h.schedulingHandler.DeleteSchedule)
	r.Post("/affairs/schedules/publish", h.schedulingHandler.PublishSchedules)
	r.Get("/affairs/schedules/timetable", h.schedulingHandler.Timetable)
	// export 为 Excel 导出，挂导入导出限流
	r.With(importExportLimiter).Get("/affairs/schedules/export", h.schedulingHandler.ExportSchedules)

	// 排课 Excel 导入（对齐 registerImportExportRoutes 风格，挂导入导出限流）
	r.With(importExportLimiter).Post("/import/schedules/excel", h.scheduleImportHandler.ImportExcel)
	r.With(importExportLimiter).Post("/import/schedules/preview", h.scheduleImportHandler.PreviewExcel)

	// 方案课程批量导入（excel/preview 为写操作；模板下载与 registerImportExportRoutes
	// 的 templates 类端点一致——整体挂在同一限流组内，保持一致）
	r.With(importExportLimiter).Post("/import/program-courses/excel", h.programCourseImportHandler.ImportExcel)
	r.With(importExportLimiter).Post("/import/program-courses/preview", h.programCourseImportHandler.PreviewExcel)
	r.With(importExportLimiter).Get("/templates/program-courses", h.programCourseImportHandler.ServeTemplate)

	// 教务配置批量导入（模板下载同上一组：与 registerImportExportRoutes 的 templates 类一致挂限流）
	r.With(importExportLimiter).Post("/import/affairs-config/excel", h.affairsConfigImportHandler.ImportExcel)
	r.With(importExportLimiter).Get("/templates/affairs-config", h.affairsConfigImportHandler.ServeTemplate)
}

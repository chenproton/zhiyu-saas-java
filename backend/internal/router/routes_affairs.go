package router

import "github.com/go-chi/chi/v5"

// registerAffairsRoutes 教务管理服务平台路由（学期/人培方案/教学计划/排课），
// 调用方需已挂载 businessUser 角色组。
func registerAffairsRoutes(r chi.Router, h *Handlers) {
	// 学期
	r.Get("/affairs/terms", h.affairsTermHandler.List)
	r.Post("/affairs/terms", h.affairsTermHandler.Create)
	r.Put("/affairs/terms/{id}", h.affairsTermHandler.Update)
	r.Delete("/affairs/terms/{id}", h.affairsTermHandler.Delete)

	// 人才培养方案
	r.Get("/affairs/programs", h.trainingProgramHandler.List)
	r.Post("/affairs/programs", h.trainingProgramHandler.Create)
	r.Get("/affairs/programs/{id}", h.trainingProgramHandler.Get)
	r.Put("/affairs/programs/{id}", h.trainingProgramHandler.Update)
	r.Delete("/affairs/programs/{id}", h.trainingProgramHandler.Delete)
	r.Get("/affairs/programs/{id}/courses", h.trainingProgramHandler.ListCourses)
	r.Put("/affairs/programs/{id}/courses", h.trainingProgramHandler.PutCourses)
	r.Post("/affairs/programs/{id}/publish", h.trainingProgramHandler.Publish)

	// 教学计划
	r.Get("/affairs/teaching-plans", h.teachingPlanHandler.List)
	r.Post("/affairs/teaching-plans", h.teachingPlanHandler.Generate)
	r.Get("/affairs/teaching-plans/{id}", h.teachingPlanHandler.Get)
	r.Put("/affairs/teaching-plans/entries/{id}", h.teachingPlanHandler.UpdateEntry)
	r.Delete("/affairs/teaching-plans/entries/{id}", h.teachingPlanHandler.DeleteEntry)
	r.Post("/affairs/teaching-plans/{id}/confirm", h.teachingPlanHandler.Confirm)

	// 场地 / 节次
	r.Get("/affairs/venues", h.schedulingHandler.ListVenues)
	r.Post("/affairs/venues", h.schedulingHandler.CreateVenue)
	r.Put("/affairs/venues/{id}", h.schedulingHandler.UpdateVenue)
	r.Delete("/affairs/venues/{id}", h.schedulingHandler.DeleteVenue)

	// 节次只读接口挂在 jobViewer 角色组（routes.go，含学生），学生/教师课表渲染共用
	r.Post("/affairs/period-slots", h.schedulingHandler.CreatePeriodSlot)
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
	r.Get("/affairs/schedules/export", h.schedulingHandler.ExportSchedules)

	// 排课 Excel 导入（对齐 registerImportExportRoutes 风格）
	r.Post("/import/schedules/excel", h.scheduleImportHandler.ImportExcel)
	r.Post("/import/schedules/preview", h.scheduleImportHandler.PreviewExcel)
	r.Get("/templates/schedules", h.scheduleImportHandler.ServeTemplate)

	// 方案课程批量导入
	r.Post("/import/program-courses/{id}", h.programCourseImportHandler.ImportExcel)
	r.Get("/templates/program-courses", h.programCourseImportHandler.ServeTemplate)
}

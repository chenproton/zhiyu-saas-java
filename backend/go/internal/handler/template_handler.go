package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type TemplateHandler struct {
	Store *store.Store
}

func (h *TemplateHandler) ServePositionTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	// 字典数据由 generatePositionTemplate 内部按需查询（此处 preload 结果曾被丢弃造成重复查询）
	f := h.generatePositionTemplate(ctx, tenantID)
	writeExcel(w, r, f, "岗位批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeScenarioTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateScenarioTemplate(ctx, tenantID)
	writeExcel(w, r, f, "场景批量导入模板.xlsx")
}

func writeExcel(w http.ResponseWriter, r *http.Request, f *excelize.File, filename string) {
	if f == nil {
		respondServerError(w, r, fmt.Errorf("模板文件为空"), "生成模板失败")
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	if err := f.Write(w); err != nil {
		respondServerError(w, r, err, "写入文件失败")
	}
}

// decodeIDList 解析导出请求体 {ids:[...]}，空/非法时响应 400 并返回 false。
func decodeIDList(w http.ResponseWriter, r *http.Request, missingMsg string) ([]string, bool) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.IDs) == 0 {
		respondError(w, http.StatusBadRequest, missingMsg)
		return nil, false
	}
	return req.IDs, true
}

// newSetCell 返回统一应用数据/换行样式的单元格写入闭包。
func newSetCell(f *excelize.File) func(sheet, cell, val string) {
	dataStyle := makeDataStyle(f)
	wrapAlign := makeWrapAlign(f)
	return func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}
}

func (h *TemplateHandler) generatePositionTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	d := h.Store.DictQuery(ctx, tenantID)
	industries, majors, certs := d.Industries, d.Majors, d.Certs
	abilityPoints := d.AbilityPoints

	s1, _ := f.NewSheet("岗位基本信息")
	f.DeleteSheet("Sheet1")
	f.SetActiveSheet(s1)

	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	// Sheet 1: 岗位基本信息
	headers1 := []string{"岗位名称 *", "岗位简称", "岗位类型", "面向行业", "适用专业", "薪资下限", "薪资上限", "岗位背景介绍", "任职要求", "发展路径", "所需证书", "所属批次"}
	widths1 := []float64{22, 14, 16, 20, 26, 12, 12, 42, 42, 30, 28, 18}
	setA1("岗位基本信息", 12, "填写说明：\n* 必填列。薪资单位为元。\n岗位类型：固定为教学岗位，无需填写\n面向行业：从「行业字典」Sheet 选取，匹配则关联，不匹配则忽略\n适用专业：从「专业字典」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略\n所需证书：从「系统证书库」Sheet 选取，匹配则关联，不匹配则自动新建并关联\n任职要求：多条可用换行（Alt+Enter）分隔\n导入后默认状态为 draft")
	setHdr("岗位基本信息", 2, headers1, widths1)
	f.SetPanes("岗位基本信息", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("岗位基本信息", "A2:L2", []excelize.AutoFilterOptions{})

	// Sheet 2: 工作职责与能力点
	_, _ = f.NewSheet("工作职责与能力点")
	headers2 := []string{"岗位名称 *", "职责名称 *", "能力点名称", "能力属性", "能力领域", "胜任力等级", "胜任标准描述"}
	widths2 := []float64{22, 28, 28, 14, 18, 14, 44}
	setA1("工作职责与能力点", 7, "填写说明：\n一个岗位 = 多行，相同「职责名称」的行属于同一工作职责\n能力属性：知识 / 技能 / 素质\n能力领域：岗位与行业认知 / 专业知识 / 职业素养/价值观 / 专业技能 / 通用能力（也可自定义）\n胜任力等级：了解 / 理解 / 掌握 / 熟练 / 精通\n能力点名称若系统中已存在同名能力点则直接关联，否则自动新建\n岗位名称须与「岗位基本信息」Sheet 中一致，自动匹配")
	setHdr("工作职责与能力点", 2, headers2, widths2)
	f.SetPanes("工作职责与能力点", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("工作职责与能力点", "A2:G2", []excelize.AutoFilterOptions{})

	// Sheet 3: 【参考】系统证书库
	h.addRefSheet(f, "【参考】系统证书库", []string{"证书名称", "相关网址", "证书介绍"}, []float64{38, 48, 60},
		"仅作参考，无需编辑修改。\n岗位基本信息 Sheet「所需证书」与本表名称一致则关联已有，不一致则自动新建并关联。",
		func() [][]string {
			var data [][]string
			for _, c := range certs {
				data = append(data, []string{c[0], c[1], c[2]})
			}
			return data
		}())

	// Sheet 4: 【参考】行业字典
	h.addRefSheet(f, "【参考】行业字典", []string{"行业名称", "行业编码"}, []float64{32, 18},
		"仅作参考，无需编辑修改。\n岗位基本信息 Sheet「面向行业」与本表名称一致则关联已有，不一致则忽略（不新建行业）。",
		func() [][]string {
			var data [][]string
			for _, v := range industries {
				data = append(data, []string{v[0], v[1]})
			}
			return data
		}())

	// Sheet 5: 【参考】专业字典
	h.addRefSheet(f, "【参考】专业字典", []string{"专业名称", "专业编码"}, []float64{32, 18},
		"仅作参考，无需编辑修改。\n岗位基本信息 Sheet「适用专业」与本表名称一致则关联已有，不一致则忽略（不新建专业）。",
		func() [][]string {
			var data [][]string
			for _, v := range majors {
				data = append(data, []string{v[0], v[1]})
			}
			return data
		}())

	// Sheet 6: 【参考】能力点库
	h.addRefSheet(f, "【参考】能力点库", []string{"能力点名称", "能力属性"}, []float64{36, 16},
		"仅作参考，无需编辑修改。\n工作职责与能力点 Sheet「能力点名称」与本表一致则关联已有，不一致则新建。",
		func() [][]string {
			var data [][]string
			for _, v := range abilityPoints {
				cat := v[1]
				data = append(data, []string{v[0], cat})
			}
			return data
		}())

	return f
}

func (h *TemplateHandler) generateScenarioTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	d := h.Store.DictQuery(ctx, tenantID)
	industries, majors, positions := d.Industries, d.Majors, d.Positions
	knowledgePoints, abilityPoints, resources := d.KnowledgePoints, d.AbilityPoints, d.Resources

	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}

	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	// Sheet 1: 场景基本信息
	s1, _ := f.NewSheet("场景基本信息")
	f.DeleteSheet("Sheet1")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers1 := []string{"场景名称 *", "目标岗位", "面向行业", "适用专业", "难度等级", "场景介绍", "所属批次"}
	widths1 := []float64{24, 22, 20, 26, 10, 48, 18}
	setA1("场景基本信息", 7, "填写说明：\n* 必填列。编码由系统自动生成（格式: SC-YYYY-NNNN），无需填写\n目标岗位：从「岗位字典」Sheet 选取，匹配则关联，不匹配则忽略\n面向行业：从「行业字典」Sheet 选取，匹配则关联，不匹配则忽略\n适用专业：从「专业字典」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略\n难度等级：1-5，1 最易，5 最难\n导入后默认状态为 draft")
	setHdr("场景基本信息", 2, headers1, widths1)
	f.SetPanes("场景基本信息", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("场景基本信息", "A2:G2", []excelize.AutoFilterOptions{})

	// Sheet 2: 任务配置
	_, _ = f.NewSheet("任务配置")
	headers2 := []string{"场景名称 *", "任务名称 *", "任务类型", "难度", "预估学时(h)", "背景介绍", "详细说明", "考查知识点", "考查能力点", "任务资源", "测评方式"}
	widths2 := []float64{22, 24, 12, 8, 12, 34, 34, 28, 28, 28, 28}
	setA1("任务配置", 11, "填写说明：\n每个任务一行，相同场景下可有多行任务。\n──── 任务基础信息 ────\n任务名称：必填。编码由系统自动生成\n任务类型：考核 / 训练\n难度：1-5，1 最易，5 最难\n预估学时：数字，单位小时\n──── 任务说明 ────\n背景介绍 / 详细说明：文本，选填\n──── 考查知识点 ────\n从「知识点库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则自动新建并关联\n──── 考查能力点 ────\n从「能力点库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略（不新建能力点）\n──── 任务资源 ────\n从「任务资源库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则自动新建并关联\n──── 任务测评 ────\n从以下7种中任选 0-n 种，多个逗号分隔：\n  题库 / 试卷 / 随堂测 / 现场问答 / 现场评审 / 成果评价 / 作业")
	setHdr("任务配置", 2, headers2, widths2)
	f.SetPanes("任务配置", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("任务配置", "A2:K2", []excelize.AutoFilterOptions{})

	// Reference sheets
	h.addRefSheet(f, "【参考】岗位字典", []string{"岗位名称", "岗位简称"}, []float64{30, 20},
		"仅作参考，无需编辑修改。\n场景基本信息 Sheet「目标岗位」与本表名称一致则关联已有，不一致则忽略（不新建岗位）。",
		func() [][]string {
			var data [][]string
			for _, v := range positions {
				data = append(data, []string{v[0], v[1]})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】行业字典", []string{"行业名称", "行业编码"}, []float64{32, 18},
		"仅作参考，无需编辑修改。\n场景基本信息 Sheet「面向行业」与本表名称一致则关联已有，不一致则忽略（不新建行业）。",
		func() [][]string {
			var data [][]string
			for _, v := range industries {
				data = append(data, []string{v[0], v[1]})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】专业字典", []string{"专业名称", "专业编码"}, []float64{32, 18},
		"仅作参考，无需编辑修改。\n场景基本信息 Sheet「适用专业」与本表名称一致则关联已有，不一致则忽略（不新建专业）。",
		func() [][]string {
			var data [][]string
			for _, v := range majors {
				data = append(data, []string{v[0], v[1]})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】知识点库", []string{"知识点名称"}, []float64{36},
		"仅作参考，无需编辑修改。\n任务配置 Sheet「考查知识点」与本表名称一致则关联已有，不一致则自动新建并关联。",
		func() [][]string {
			var data [][]string
			for _, v := range knowledgePoints {
				data = append(data, []string{v})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】能力点库", []string{"能力点名称", "能力属性"}, []float64{36, 16},
		"仅作参考，无需编辑修改。\n任务配置 Sheet「考查能力点」与本表名称一致则关联已有，不一致则忽略（不新建能力点）。",
		func() [][]string {
			var data [][]string
			for _, v := range abilityPoints {
				cat := v[1]
				data = append(data, []string{v[0], cat})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】任务资源库", []string{"资源名称", "资源类型"}, []float64{42, 16},
		"仅作参考，无需编辑修改。\n任务配置 Sheet「任务资源」与本表名称一致则关联已有，不一致则自动新建并关联。",
		func() [][]string {
			var data [][]string
			for _, v := range resources {
				t := v[1]
				if t == "" {
					t = "文档"
				}
				data = append(data, []string{v[0], t})
			}
			return data
		}())

	return f
}

func (h *TemplateHandler) generateGranularCourseTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()

	d := h.Store.DictQuery(ctx, tenantID)
	majors, knowledgePoints, resources := d.Majors, d.KnowledgePoints, d.Resources
	lessonBatches, _, _ := h.Store.ListBatches(ctx, tenantID)

	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}

	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	// Sheet 1: 课程基本信息
	s1, _ := f.NewSheet("课程基本信息")
	f.DeleteSheet("Sheet1")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers1 := []string{"课程名称 *", "适用专业", "难度", "预计课时", "学习目标", "关联知识点", "课程资源", "所属批次"}
	widths1 := []float64{28, 24, 10, 12, 48, 28, 28, 20}
	setA1("课程基本信息", 8, "填写说明：\n* 必填列。\n适用专业：从「专业字典」Sheet 选取，匹配则关联，不匹配则忽略\n难度：1-5，1 最易，5 最难\n预计课时：数字，单位小时\n学习目标：课程的总体学习要求\n关联知识点：从「知识点库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则自动新建并关联\n课程资源：从「任务资源库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则自动新建为文档类型资源并关联\n所属批次：从「批次字典」Sheet 选取，匹配则关联，不匹配则忽略\n导入后默认状态为 draft")
	setHdr("课程基本信息", 2, headers1, widths1)
	f.SetPanes("课程基本信息", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("课程基本信息", "A2:H2", []excelize.AutoFilterOptions{})

	// Reference sheets
	h.addRefSheet(f, "【参考】专业字典", []string{"专业名称", "专业编码"}, []float64{32, 18},
		"仅作参考，无需编辑修改。\n课程基本信息 Sheet「适用专业」与本表名称一致则关联已有，不一致则忽略（不新建专业）。",
		func() [][]string {
			var data [][]string
			for _, v := range majors {
				data = append(data, []string{v[0], v[1]})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】批次字典", []string{"批次名称"}, []float64{36},
		"仅作参考，无需编辑修改。\n课程基本信息 Sheet「所属批次」与本表名称一致则关联已有，不一致则忽略（不新建批次）。",
		func() [][]string {
			var data [][]string
			for _, v := range lessonBatches {
				data = append(data, []string{v})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】知识点库", []string{"知识点名称"}, []float64{36},
		"仅作参考，无需编辑修改。\n课程基本信息 Sheet「关联知识点」与本表名称一致则关联已有，不一致则自动新建并关联。",
		func() [][]string {
			var data [][]string
			for _, v := range knowledgePoints {
				data = append(data, []string{v})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】任务资源库", []string{"资源名称", "资源类型"}, []float64{42, 16},
		"仅作参考，无需编辑修改。\n课程基本信息 Sheet「课程资源」与本表一致则关联已有，不一致则自动新建为文档类型资源并关联。",
		func() [][]string {
			var data [][]string
			for _, v := range resources {
				t := v[1]
				if t == "" {
					t = "文档"
				}
				data = append(data, []string{v[0], t})
			}
			return data
		}())

	return f
}

func (h *TemplateHandler) ServeGranularCourseTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateGranularCourseTemplate(ctx, tenantID)
	writeExcel(w, r, f, "颗粒课批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeSystemCourseTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateSystemCourseTemplate(ctx, tenantID)
	writeExcel(w, r, f, "体系课批量导入模板.xlsx")
}

func (h *TemplateHandler) generateSystemCourseTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()

	d := h.Store.DictQuery(ctx, tenantID)
	majors, knowledgePoints, abilityPoints := d.Majors, d.KnowledgePoints, d.AbilityPoints
	lessonBatches, _, _ := h.Store.ListBatches(ctx, tenantID)

	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}

	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	// Sheet 1: 课程基本信息
	s1, _ := f.NewSheet("课程基本信息")
	f.DeleteSheet("Sheet1")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers1 := []string{"课程名称 *", "适用专业", "课程简介", "所属批次", "关联能力点"}
	widths1 := []float64{28, 24, 48, 20, 30}
	setA1("课程基本信息", 5, "填写说明：\n* 必填列。\n适用专业：从「专业字典」Sheet 选取，匹配则关联，不匹配则忽略\n所属批次：从「批次字典」Sheet 选取，匹配则关联，不匹配则忽略\n关联能力点：从「能力点库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略（不新建能力点）\n导入后默认状态为 draft")
	setHdr("课程基本信息", 2, headers1, widths1)
	f.SetPanes("课程基本信息", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("课程基本信息", "A2:E2", []excelize.AutoFilterOptions{})

	// Sheet 2: 节点配置
	_, _ = f.NewSheet("节点配置")
	headers2 := []string{"课程名称 *", "节点名称 *", "父节点名称", "节点类型", "排序", "学习目标", "预计课时", "难度", "关联知识点", "课程资源", "测评方式"}
	widths2 := []float64{22, 24, 18, 12, 8, 34, 12, 8, 28, 28, 28}
	setA1("节点配置", 11, "填写说明：\n每个节点一行，相同课程下可有多行节点。\n──── 节点基础信息 ────\n课程名称：须与「课程基本信息」Sheet 中一致\n节点名称：必填。编码由系统自动生成\n父节点名称：填写本课程下已出现的节点名称，为空表示一级节点；同名节点以首次出现者为准\n节点类型：手动编辑（默认）/ 颗粒课\n排序：数字，越小越靠前\n──── 手动编辑节点 ────\n学习目标 / 预计课时 / 难度 / 关联知识点 / 课程资源 均须按本表列填写\n预计课时：数字；难度：1-5，1 最易，5 最难\n──── 颗粒课节点 ────\n节点名称须与系统中已存在的颗粒课名称一致，系统会自动匹配并引用颗粒课内容\n学习目标、预计课时未填写时，自动使用颗粒课自身数据；填写时以 Excel 为准\n关联知识点、课程资源 列可补充本节点独立资源，未填写则为空\n只需填写本节点独立的测评方式\n──── 关联知识点────\n从「知识点库」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则自动新建并关联\n──── 课程资源────\n多个逗号分隔；匹配 /library/resources 公共资源库，不匹配则自动新建为文档类型资源并关联\n──── 测评方式 ────\n从以下 4 种中任选 0-n 种，多个逗号分隔：\n  题库 / 试卷 / 随堂测 / 作业")
	setHdr("节点配置", 2, headers2, widths2)
	f.SetPanes("节点配置", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("节点配置", "A2:K2", []excelize.AutoFilterOptions{})

	// Reference sheets
	h.addRefSheet(f, "【参考】专业字典", []string{"专业名称", "专业编码"}, []float64{32, 18},
		"仅作参考，无需编辑修改。\n课程基本信息 Sheet「适用专业」与本表名称一致则关联已有，不一致则忽略（不新建专业）。",
		func() [][]string {
			var data [][]string
			for _, v := range majors {
				data = append(data, []string{v[0], v[1]})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】批次字典", []string{"批次名称"}, []float64{36},
		"仅作参考，无需编辑修改。\n课程基本信息 Sheet「所属批次」与本表名称一致则关联已有，不一致则忽略（不新建批次）。",
		func() [][]string {
			var data [][]string
			for _, v := range lessonBatches {
				data = append(data, []string{v})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】知识点库", []string{"知识点名称"}, []float64{36},
		"仅作参考，无需编辑修改。\n节点配置 Sheet「关联知识点」与本表名称一致则关联已有，不一致则自动新建并关联。",
		func() [][]string {
			var data [][]string
			for _, v := range knowledgePoints {
				data = append(data, []string{v})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】能力点库", []string{"能力点名称", "能力属性"}, []float64{36, 16},
		"仅作参考，无需编辑修改。\n课程基本信息 Sheet「关联能力点」与本表名称一致则关联已有，不一致则忽略（不新建能力点）。",
		func() [][]string {
			var data [][]string
			for _, v := range abilityPoints {
				cat := v[1]
				data = append(data, []string{v[0], cat})
			}
			return data
		}())

	h.addRefSheet(f, "【参考】测评方式", []string{"测评方式"}, []float64{24},
		"仅作参考，无需编辑修改。\n节点配置 Sheet「测评方式」支持：题库、试卷、随堂测、作业。",
		[][]string{{"题库"}, {"试卷"}, {"随堂测"}, {"作业"}})

	return f
}

func (h *TemplateHandler) addRefSheet(f *excelize.File, name string, headers []string, widths []float64, note string, data [][]string) {
	f.NewSheet(name)
	noteStyle := makeNoteStyle(f)
	hdrStyle := makeHeaderStyle(f)
	dataStyle := makeDataStyle(f)
	wrapAlign := makeWrapAlign(f)

	cols := len(headers)
	start, _ := excelize.CoordinatesToCellName(1, 1)
	end, _ := excelize.CoordinatesToCellName(cols, 1)
	f.MergeCell(name, start, end)
	f.SetCellValue(name, start, note)
	f.SetCellStyle(name, start, end, noteStyle)
	f.SetCellStyle(name, start, end, wrapAlign)
	f.SetRowHeight(name, 1, float64(strings.Count(note, "\n")+2)*16)

	for ci, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue(name, cell, h)
		f.SetCellStyle(name, cell, cell, hdrStyle)
		f.SetColWidth(name, colName(ci+1), colName(ci+1), widths[ci])
	}
	f.SetRowHeight(name, 2, 28)

	for ri, row := range data {
		r := 3 + ri
		for ci, v := range row {
			cell, _ := excelize.CoordinatesToCellName(ci+1, r)
			f.SetCellValue(name, cell, v)
			f.SetCellStyle(name, cell, cell, dataStyle)
			f.SetCellStyle(name, cell, cell, wrapAlign)
		}
		f.SetRowHeight(name, r, 24)
	}

	f.SetPanes(name, &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter(name, fmt.Sprintf("A2:%s%d", colName(cols), 2+len(data)), []excelize.AutoFilterOptions{})
}

func colName(n int) string {
	name, _ := excelize.ColumnNumberToName(n)
	return name
}

func makeHeaderStyle(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "left", Color: "D9D9D9", Style: 1},
			{Type: "right", Color: "D9D9D9", Style: 1},
			{Type: "top", Color: "D9D9D9", Style: 1},
			{Type: "bottom", Color: "D9D9D9", Style: 1},
		},
	})
	return style
}

func makeDataStyle(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "D9D9D9", Style: 1},
			{Type: "right", Color: "D9D9D9", Style: 1},
			{Type: "top", Color: "D9D9D9", Style: 1},
			{Type: "bottom", Color: "D9D9D9", Style: 1},
		},
	})
	return style
}

func makeNoteStyle(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Size: 10, Color: "808080", Italic: true},
	})
	return style
}

func makeWrapAlign(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Vertical: "top", WrapText: true},
	})
	return style
}

func (h *TemplateHandler) ServeQuestionBankTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateQuestionBankTemplate(ctx, tenantID)
	writeExcel(w, r, f, "题库批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeQuestionTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	bankID := chi.URLParam(r, "bankId")
	if bankID == "" {
		respondError(w, http.StatusBadRequest, "缺少题库ID")
		return
	}
	ctx := r.Context()
	f := h.generateQuestionTemplate(ctx, tenantID, bankID)
	writeExcel(w, r, f, "题目批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeExamTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateExamTemplate(ctx, tenantID)
	writeExcel(w, r, f, "试卷批量导入模板.xlsx")
}

func (h *TemplateHandler) generateQuestionBankTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	// Sheet 1: 题库基本信息
	s1, _ := f.NewSheet("题库基本信息")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers1 := []string{"题库名称 *", "题库简介", "所属批次"}
	widths1 := []float64{28, 42, 22}
	setA1("题库基本信息", 3, "填写说明：\n* 必填列。\n所属批次：从「批次参考」Sheet 选取，匹配则关联，不匹配则忽略。\n导入后默认状态为 draft")
	setHdr("题库基本信息", 2, headers1, widths1)
	f.SetPanes("题库基本信息", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("题库基本信息", "A2:C2", []excelize.AutoFilterOptions{})

	// Reference sheets
	_, batches, err := h.Store.ListBatches(ctx, tenantID)
	if err != nil {
		return nil
	}
	h.addRefSheet(f, "【参考】批次", []string{"批次名称"}, []float64{32}, "仅作参考，无需编辑修改。", batches)

	return f
}

func (h *TemplateHandler) generateQuestionTemplate(ctx context.Context, tenantID, bankID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	bankName, _ := h.Store.GetQuestionBankName(ctx, tenantID, bankID)

	// Sheet 1: 题目明细
	s1, _ := f.NewSheet("题目明细")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers1 := []string{"题型 *", "题目内容 *", "选项A", "选项B", "选项C", "选项D", "正确答案 *", "答案解析", "难度", "知识点", "分数", "来源"}
	widths1 := []float64{12, 48, 24, 24, 24, 24, 28, 36, 10, 28, 10, 20}
	setA1("题目明细", 12, fmt.Sprintf("填写说明：\n目标题库：%s\n* 必填列。\n题型：单选题 / 多选题 / 判断题 / 填空题 / 问答题 / 简答题\n单选题/多选题：填写选项A-D，正确答案可填选项文字或A/B/C/D\n判断题：正确答案填 正确/错误 或 true/false\n填空题：题目内容用 {1}、{2} 表示空位，正确答案用逗号分隔多个空位答案\n问答题/简答题：正确答案填写参考要点文本\n难度：简单 / 中等 / 困难\n知识点：多个用逗号分隔，不存在则自动新建\n导入后默认状态为 draft", bankName))
	setHdr("题目明细", 2, headers1, widths1)
	f.SetPanes("题目明细", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("题目明细", "A2:L2", []excelize.AutoFilterOptions{})

	var kps [][]string
	kpNames, err := h.Store.ListKnowledgePointNames(ctx, tenantID)
	if err != nil {
		return nil
	}
	for _, n := range kpNames {
		kps = append(kps, []string{n})
	}
	h.addRefSheet(f, "【参考】知识点", []string{"知识点名称"}, []float64{36}, "仅作参考，无需编辑修改。", kps)

	return f
}

func (h *TemplateHandler) generateExamTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	// Sheet 1: 试卷基本信息
	s1, _ := f.NewSheet("试卷基本信息")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers1 := []string{"试卷名称 *", "试卷简介", "所属批次"}
	widths1 := []float64{28, 42, 22}
	setA1("试卷基本信息", 3, "填写说明：\n* 必填列。\n所属批次：从「批次参考」Sheet 选取，匹配则关联，不匹配则忽略。\n导入后默认状态为 draft")
	setHdr("试卷基本信息", 2, headers1, widths1)
	f.SetPanes("试卷基本信息", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("试卷基本信息", "A2:C2", []excelize.AutoFilterOptions{})

	// Sheet 2: 试卷题目
	_, _ = f.NewSheet("试卷题目")
	headers2 := []string{"试卷名称 *", "题目内容 *", "分数 *"}
	widths2 := []float64{28, 48, 12}
	setA1("试卷题目", 3, "填写说明：\n本表可选。\n试卷名称须与「试卷基本信息」Sheet 中一致。\n题目内容须与当前租户下已存在的题目内容一致，系统会按内容匹配并加入试卷。")
	setHdr("试卷题目", 2, headers2, widths2)
	f.SetPanes("试卷题目", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("试卷题目", "A2:C2", []excelize.AutoFilterOptions{})

	_, batches, err := h.Store.ListBatches(ctx, tenantID)
	if err != nil {
		return nil
	}
	h.addRefSheet(f, "【参考】批次", []string{"批次名称"}, []float64{32}, "仅作参考，无需编辑修改。", batches)

	return f
}

func (h *TemplateHandler) ServeIndustryTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateIndustryTemplate(ctx, tenantID)
	writeExcel(w, r, f, "行业批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeMajorTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateMajorTemplate(ctx, tenantID)
	writeExcel(w, r, f, "专业批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeOrganizationTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateOrganizationTemplate(ctx, tenantID)
	writeExcel(w, r, f, "组织架构批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeStudentTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateStudentTemplate(ctx, tenantID)
	writeExcel(w, r, f, "学生批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeTeacherTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateTeacherTemplate(ctx, tenantID)
	writeExcel(w, r, f, "教师批量导入模板.xlsx")
}

func (h *TemplateHandler) generateIndustryTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("行业列表")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"行业代码 *", "行业名称 *", "上级行业代码", "排序", "是否启用"}
	widths := []float64{18, 28, 18, 10, 12}
	setA1("行业列表", 5, "填写说明：\n* 必填列。\n行业代码：租户内唯一，已存在则更新。\n上级行业代码：填写本 Sheet 中已有的行业代码，或系统中已存在的行业代码；为空表示顶级行业。\n排序：数字，越小越靠前，默认为 0。\n是否启用：true/是/启用 表示启用；false/否/禁用 表示禁用，默认启用。")
	setHdr("行业列表", 2, headers, widths)
	f.SetPanes("行业列表", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("行业列表", "A2:E2", []excelize.AutoFilterOptions{})

	return f
}

func (h *TemplateHandler) generateMajorTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("专业列表")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"专业代码 *", "专业名称 *", "别名", "是否启用"}
	widths := []float64{18, 30, 24, 12}
	setA1("专业列表", 4, "填写说明：\n* 必填列。\n专业代码：租户内唯一，已存在则更新。\n别名：可选简称。\n是否启用：true/是/启用 表示启用；false/否/禁用 表示禁用，默认启用。")
	setHdr("专业列表", 2, headers, widths)
	f.SetPanes("专业列表", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("专业列表", "A2:D2", []excelize.AutoFilterOptions{})

	return f
}

func (h *TemplateHandler) generateOrganizationTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("组织架构")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"组织名称 *", "组织类型 *", "父组织名称", "排序"}
	widths := []float64{30, 20, 30, 10}
	setA1("组织架构", 4, "填写说明：\n* 必填列。\n组织类型：须与「组织类型参考」Sheet 中的类型名称完全一致。\n父组织名称：填写本 Sheet 中已有的组织名称，或系统中已存在的组织名称；为空表示一级节点。\n排序：数字，越小越靠前，默认为 0。\n相同「组织名称+组织类型」的组合视为同一组织，重复导入会更新父组织和排序。")
	setHdr("组织架构", 2, headers, widths)
	f.SetPanes("组织架构", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("组织架构", "A2:D2", []excelize.AutoFilterOptions{})

	var types [][]string
	typeNames, err := h.Store.ListOrgTypeNames(ctx, tenantID)
	if err != nil {
		return nil
	}
	for _, n := range typeNames {
		types = append(types, []string{n})
	}
	h.addRefSheet(f, "【参考】组织类型", []string{"组织类型名称"}, []float64{36}, "仅作参考，无需编辑修改。组织架构 Sheet「组织类型」须与本表名称一致。", types)

	return f
}

func (h *TemplateHandler) generateStudentTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("学生列表")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"登录账号(学号) *", "姓名 *", "密码 *", "班级(组织节点路径) *", "状态"}
	widths := []float64{24, 16, 20, 42, 12}
	setA1("学生列表", 5, "填写说明：\n* 必填列。\n登录账号(学号)：租户内唯一，已存在则跳过。\n密码：长度至少 8 位，且需同时包含字母和数字。\n班级(组织节点路径)：支持多级路径，用于精确定位班级。\n  格式示例：学校-学院-班级 或 学校/学院/班级\n  若系统中该班级名称唯一，也可只写班级名称。\n状态：正常 / 禁用 / 毕业，默认为正常。")
	setHdr("学生列表", 2, headers, widths)
	f.SetPanes("学生列表", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("学生列表", "A2:E2", []excelize.AutoFilterOptions{})

	paths := h.Store.OrgPaths(ctx, tenantID)
	h.addRefSheet(f, "【参考】班级/组织节点路径", []string{"组织节点路径"}, []float64{48}, "仅作参考，无需编辑修改。学生列表 Sheet「班级(组织节点路径)」与本表路径一致则可精确定位。", paths)

	return f
}

func (h *TemplateHandler) generateTeacherTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("教师列表")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"登录账号(工号) *", "姓名 *", "密码 *", "所属组织节点(路径)", "职位(逗号分隔)", "状态"}
	widths := []float64{24, 16, 20, 42, 28, 12}
	setA1("教师列表", 6, "填写说明：\n* 必填列。\n登录账号(工号)：租户内唯一，已存在则跳过。\n密码：长度至少 8 位，且需同时包含字母和数字。\n所属组织节点(路径)：支持多级路径，用于精确定位组织节点。\n  格式示例：学校-学院 或 学校/学院\n  若系统中该组织节点名称唯一，也可只写组织节点名称。\n职位：多个职位用逗号分隔，须与系统中已存在的职位名称一致，不匹配则忽略。\n状态：正常 / 禁用，默认为正常。")
	setHdr("教师列表", 2, headers, widths)
	f.SetPanes("教师列表", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("教师列表", "A2:F2", []excelize.AutoFilterOptions{})

	paths := h.Store.OrgPaths(ctx, tenantID)
	h.addRefSheet(f, "【参考】组织节点路径", []string{"组织节点路径"}, []float64{48}, "仅作参考，无需编辑修改。教师列表 Sheet「所属组织节点(路径)」与本表路径一致则可精确定位。", paths)

	var titles [][]string
	titleNames, err := h.Store.ListStaffTitleNames(ctx, tenantID)
	if err != nil {
		return nil
	}
	for _, n := range titleNames {
		titles = append(titles, []string{n})
	}
	h.addRefSheet(f, "【参考】职位", []string{"职位名称"}, []float64{36}, "仅作参考，无需编辑修改。教师列表 Sheet「职位」与本表名称一致则关联。", titles)

	return f
}

// ===== Alliance Template Handlers =====

func (h *TemplateHandler) ServeProjectTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateProjectTemplate(ctx, tenantID)
	writeExcel(w, r, f, "合作项目批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeAchievementTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateAchievementTemplate(ctx, tenantID)
	writeExcel(w, r, f, "合作成果批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeAgreementTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateAgreementTemplate(ctx, tenantID)
	writeExcel(w, r, f, "合作协议批量导入模板.xlsx")
}

func (h *TemplateHandler) ServePermissionTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generatePermissionTemplate(ctx, tenantID)
	writeExcel(w, r, f, "合作权限批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeBrandTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	brandType := r.URL.Query().Get("brandType")
	f := h.generateBrandTemplate(ctx, tenantID, brandType)
	writeExcel(w, r, f, "品牌内容批量导入模板.xlsx")
}

// ===== Alliance Template Generators =====

func (h *TemplateHandler) generateProjectTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("合作项目")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"项目名称 *", "合作类型", "项目阶段", "预算", "开始日期", "结束日期", "项目描述", "合作企业", "二级学院", "公开显示"}
	widths := []float64{28, 20, 22, 20, 16, 16, 48, 40, 30, 14}
	setA1("合作项目", 10, "填写说明：\n* 必填列。\n合作类型：文本，选填（如：联合研发 / 产教融合 / 人才共育 / 现代学徒制 / 协同创新）\n项目阶段：启动 / 执行中 / 验收 / 关闭（或 initiation / execution / acceptance / closure），默认为 启动\n预算：文本，选填（如：300万）\n开始日期 / 结束日期：格式 YYYY-MM-DD，选填\n项目描述：文本，选填\n合作企业：企业名称，选填，多值用中文分号「；」分隔，需与系统「合作企业」中的企业名称一致（按名称自动关联）\n二级学院：学院名称，选填，多值用中文分号「；」分隔，需与组织架构中的二级学院名称一致\n公开显示：是 / 否（或 true / false），选填，默认为 否")
	setHdr("合作项目", 2, headers, widths)
	f.SetPanes("合作项目", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("合作项目", "A2:J2", []excelize.AutoFilterOptions{})

	return f
}

func (h *TemplateHandler) generateAchievementTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("合作成果")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"成果名称 *", "成果类型", "成果日期", "成果描述", "归属项目", "合作企业", "二级学院", "公开显示"}
	widths := []float64{28, 22, 16, 48, 40, 40, 30, 14}
	setA1("合作成果", 8, "填写说明：\n* 必填列。\n成果类型：岗位成果 / 场景成果 / 课程成果 / 自定义成果（或 job / scene / course / custom），默认为 自定义成果\n成果日期：格式 YYYY-MM-DD，选填\n成果描述：文本，选填\n归属项目：项目名称，选填，多值用中文分号「；」分隔，需与系统「合作项目」中的项目名称一致（按名称自动关联）\n合作企业：企业名称，选填，多值用中文分号「；」分隔，需与系统「合作企业」中的企业名称一致（按名称自动关联）\n二级学院：学院名称，选填，多值用中文分号「；」分隔，需与组织架构中的二级学院名称一致\n公开显示：是 / 否（或 true / false），选填，默认为 否")
	setHdr("合作成果", 2, headers, widths)
	f.SetPanes("合作成果", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("合作成果", "A2:H2", []excelize.AutoFilterOptions{})

	return f
}

func (h *TemplateHandler) generateAgreementTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("合作协议")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"协议名称 *", "协议类型", "协议状态", "开始日期", "结束日期", "内容", "合作企业", "关联项目"}
	widths := []float64{28, 22, 20, 16, 16, 48, 40, 40}
	setA1("合作协议", 8, "填写说明：\n* 必填列。\n协议类型：文本，选填（如：实验室共建 / 实训基地 / 协同创新 / 实践基地）\n协议状态：草稿 / 生效中 / 已失效 / 已续签 / 已终止（或 draft / active / expired / renewed / terminated），默认为 草稿\n开始日期 / 结束日期：格式 YYYY-MM-DD，选填\n内容：文本，选填\n合作企业：企业名称，选填，多值用中文分号「；」分隔，需与系统「合作企业」中的企业名称一致（按名称自动关联）\n关联项目：项目名称，选填，多值用中文分号「；」分隔，需与系统「合作项目」中的项目名称一致（按名称自动关联）\n前台展示跟随关联的合作企业/项目，无独立开关")
	setHdr("合作协议", 2, headers, widths)
	f.SetPanes("合作协议", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("合作协议", "A2:H2", []excelize.AutoFilterOptions{})

	return f
}

func (h *TemplateHandler) generatePermissionTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("合作权限")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"账号名称 *", "账号类型", "是否启用"}
	widths := []float64{28, 22, 14}
	setA1("合作权限", 3, "填写说明：\n* 必填列。\n账号类型：企业账号 / 专家账号（或 enterprise / expert），默认为 企业账号\n是否启用：是 / 否（或 true / false），默认为 是（启用）")
	setHdr("合作权限", 2, headers, widths)
	f.SetPanes("合作权限", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("合作权限", "A2:C2", []excelize.AutoFilterOptions{})

	return f
}

// generateBrandTemplate 品牌导入模板：brandType 为空时输出通用模板（含品牌类型列，向后兼容），
// 传入 brandType 时输出按页面类型化模板（major 类型预填系统全部专业）。
func (h *TemplateHandler) generateBrandTemplate(ctx context.Context, tenantID, brandType string) *excelize.File {
	switch brandType {
	case "talent", "employer", "job", "major", "teacher", "culture":
		return h.generateBrandTypeTemplate(ctx, tenantID, brandType)
	default:
		return h.generateGenericBrandTemplate(ctx, tenantID)
	}
}

// brandTemplateConfig 单类型品牌模板配置（表头/列宽/填写说明）。
type brandTemplateConfig struct {
	headers []string
	widths  []float64
	note    string
}

var brandTypeTemplates = map[string]brandTemplateConfig{
	"talent": {
		headers: []string{"案例名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联专业名称"},
		widths:  []float64{28, 48, 18, 14, 14, 36, 24, 24},
		note:    "填写说明：\n* 必填列。\n案例名称：就业案例名称\n描述：文本，选填\n状态：草稿 / 已发布 / 已归档（或 draft / published / archived），默认为 草稿\n是否公开 / 是否推荐：是 / 否（或 true / false），默认 否\n封面图URL：图片地址，选填\n关联学生名称：学生姓名，选填，需与系统中学生姓名一致（按名称自动关联，填写但未命中该行报错）\n关联专业名称：专业名称，选填，需与系统专业库名称一致（按名称自动关联）",
	},
	"employer": {
		headers: []string{"企业类型 *", "企业名称 *", "是否公开", "是否推荐", "统一社会信用代码", "所属行业", "所在地区", "成立年份", "企业规模（人数）", "关联二级学院", "企业简介", "联系人", "联系电话", "联系邮箱", "详细地址", "企业Logo URL", "企业主页封面 URL", "企业风采照片URL", "企业营业执照URL", "企业知识产权URL", "企业荣誉资质URL"},
		widths:  []float64{18, 30, 14, 14, 26, 20, 16, 14, 16, 28, 48, 16, 18, 24, 28, 32, 32, 32, 32, 32, 32},
		note:    "填写说明：\n* 必填列。\n企业类型：合作企业 / 独立雇主企业（或 enterprise / independent）\n合作企业：只需填写企业名称，需与「合作企业库」中企业名称一致（按名称自动关联，未命中该行报错），其余资料列无需填写\n独立雇主企业：企业名称 + 资料列按需填写，自动创建独立雇主品牌\n是否公开 / 是否推荐：是 / 否（或 true / false），默认 否\n成立年份 / 企业规模：数字\n关联二级学院 / 企业风采 / 证照 / 资质照片URL：多值用中文分号「；」分隔",
	},
	"job": {
		headers: []string{"岗位类型 *", "岗位名称 *", "是否公开", "是否推荐", "薪资下限(K)", "薪资上限(K)", "面向专业", "所属行业", "岗位简介", "任职要求", "职业发展路径", "岗位职责"},
		widths:  []float64{18, 30, 14, 14, 16, 16, 30, 20, 48, 36, 36, 48},
		note:    "填写说明：\n* 必填列。\n岗位类型：教学岗位 / 企业岗位（或 teaching / enterprise）\n教学岗位：只需填写岗位名称，需与「职业岗位库」中教学岗位名称一致（按名称自动关联，未命中该行报错）\n企业岗位：填写岗位名称 + 资料列（薪资/面向专业/简介等），自动创建品牌私有企业岗位\n薪资下限 / 上限：数字（单位 K）\n面向专业 / 任职要求：多值用中文分号「；」分隔，面向专业按名称匹配系统专业库（未命中的名称忽略并提示）\n岗位职责：每行一条「职责名|职责描述」，多条用换行分隔\n是否公开 / 是否推荐：是 / 否（或 true / false），默认 否",
	},
	"major": {
		headers: []string{"专业名称", "专业代码", "是否公开", "是否推荐", "品牌介绍", "封面图URL", "关联岗位品牌名称", "关联合作企业名称", "关联合作成果名称", "关联特色课程名称"},
		widths:  []float64{28, 18, 14, 14, 48, 36, 32, 36, 36, 32},
		note:    "填写说明：\n专业名称 / 专业代码：已预填系统全部专业，请勿修改或新增（以系统专业为基础，不会新增专业）\n是否公开 / 是否推荐：是 / 否（或 true / false），默认 否\n品牌介绍 / 封面图URL：选填\n关联列：多值用中文分号「；」分隔，按名称自动关联，未命中的名称忽略并提示\n关联岗位品牌名称：岗位品牌中的品牌名称\n关联合作企业名称：合作企业库企业名称或独立雇主品牌名称\n关联合作成果名称：合作成果标题\n关联特色课程名称：课程名称\n未填写任何内容的行将跳过，不创建品牌",
	},
	"teacher": {
		headers: []string{"师资类型 *", "关联教师名称", "关联专家名称", "是否公开", "是否推荐", "性别", "年龄", "所在城市", "职称", "职务", "从业年限", "学历", "所属行业", "擅长领域", "个人简介", "工作经历", "头像URL"},
		widths:  []float64{18, 24, 24, 14, 14, 12, 12, 16, 20, 20, 14, 18, 20, 32, 48, 48, 32},
		note:    "填写说明：\n* 必填列。\n师资类型：校本师资 / 企业专家（或 school / expert）\n校本师资：填写「关联教师名称」（系统教师姓名，按名称自动关联，未命中该行报错）+ 资料补充列（性别/职称/简介等），自动创建师资展示资料\n企业专家：只需填写「关联专家名称」（企业专家库姓名，按名称自动关联，未命中该行报错）\n性别：男 / 女\n年龄 / 从业年限：数字\n擅长领域：多值用中文分号「；」分隔\n是否公开 / 是否推荐：是 / 否（或 true / false），默认 否",
	},
	"culture": {
		headers: []string{"名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联专业名称"},
		widths:  []float64{28, 48, 18, 14, 14, 36, 24},
		note:    "填写说明：\n* 必填列。\n名称：品牌名称\n描述：文本，选填\n状态：草稿 / 已发布 / 已归档（或 draft / published / archived），默认为 草稿\n是否公开 / 是否推荐：是 / 否（或 true / false），默认 否\n封面图URL：图片地址，选填\n关联专业名称：专业名称，选填，需与系统专业库名称一致（按名称自动关联）",
	},
}

// generateBrandTypeTemplate 按类型生成品牌模板（major 类型预填系统专业列表）。
func (h *TemplateHandler) generateBrandTypeTemplate(ctx context.Context, tenantID, brandType string) *excelize.File {
	cfg, ok := brandTypeTemplates[brandType]
	if !ok {
		return h.generateGenericBrandTemplate(ctx, tenantID)
	}
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	s1, _ := f.NewSheet("品牌内容")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}
	setA1("品牌内容", len(cfg.headers), cfg.note)
	for ci, hdr := range cfg.headers {
		cell, _ := excelize.CoordinatesToCellName(ci+1, 2)
		f.SetCellValue("品牌内容", cell, hdr)
		f.SetCellStyle("品牌内容", cell, cell, hdrStyle)
		f.SetColWidth("品牌内容", colName(ci+1), colName(ci+1), cfg.widths[ci])
	}
	f.SetRowHeight("品牌内容", 2, 28)
	f.SetPanes("品牌内容", &excelize.Panes{Freeze: true, YSplit: 2})
	lastCol, _ := excelize.CoordinatesToCellName(len(cfg.headers), 2)
	f.AutoFilter("品牌内容", "A2:"+lastCol, []excelize.AutoFilterOptions{})

	// 专业品牌：预填系统全部专业（名称+代码），导入不新增专业
	if brandType == "major" && h.Store != nil {
		majors, err := h.Store.ListAllMajors(ctx, tenantID)
		if err == nil {
			for i, m := range majors {
				row := i + 3
				nameCell, _ := excelize.CoordinatesToCellName(1, row)
				codeCell, _ := excelize.CoordinatesToCellName(2, row)
				f.SetCellValue("品牌内容", nameCell, m.Name)
				f.SetCellValue("品牌内容", codeCell, m.Code)
			}
		}
	}
	return f
}

func (h *TemplateHandler) generateGenericBrandTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	hdrStyle := makeHeaderStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+2)*16)
	}

	s1, _ := f.NewSheet("品牌内容")
	f.SetActiveSheet(s1)
	f.DeleteSheet("Sheet1")
	headers := []string{"品牌类型 *", "名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联企业名称", "关联岗位名称", "关联专业名称", "关联教师名称", "关联专家名称"}
	widths := []float64{22, 30, 48, 18, 14, 14, 36, 24, 32, 28, 24, 24, 24}
	setA1("品牌内容", 13, "填写说明：\n* 必填列。\n品牌类型：人才品牌 / 雇主品牌 / 岗位品牌 / 专业品牌 / 师资品牌 / 文化品牌（或 talent / employer / job / major / teacher / culture）\n名称：品牌名称\n描述：文本，选填\n状态：草稿 / 已发布 / 已归档（或 draft / published / archived），默认为 草稿\n是否公开 / 是否推荐：是 / 否（或 true / false），默认 否\n封面图URL：图片地址，选填\n关联学生 / 企业 / 岗位 / 专业 / 教师 / 专家名称：选填，按名称匹配写入对应关联 ID，需与系统中已有记录名称一致（人才品牌关联学生与专业；雇主品牌关联企业；岗位品牌关联岗位；专业品牌关联专业；师资品牌关联教师与专家；文化品牌关联专业）")
	setHdr("品牌内容", 2, headers, widths)
	f.SetPanes("品牌内容", &excelize.Panes{Freeze: true, YSplit: 2})
	f.AutoFilter("品牌内容", "A2:M2", []excelize.AutoFilterOptions{})

	return f
}

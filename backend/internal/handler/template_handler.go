package handler

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type TemplateHandler struct {
	DB *pgxpool.Pool
}

func (h *TemplateHandler) ServePositionTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	h.queryDicts(ctx, tenantID) // preload dicts
	f := h.generatePositionTemplate(ctx, tenantID)
	writeExcel(w, f, "岗位批量导入模板.xlsx")
}

func (h *TemplateHandler) ServeScenarioTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	f := h.generateScenarioTemplate(ctx, tenantID)
	writeExcel(w, f, "场景批量导入模板.xlsx")
}

func writeExcel(w http.ResponseWriter, f *excelize.File, filename string) {
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	if err := f.Write(w); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to write file")
	}
}

func (h *TemplateHandler) queryDicts(ctx context.Context, tenantID string) (industries [][2]string, majors [][2]string, certs [][3]string, positions [][2]string, knowledgePoints []string, abilityPoints [][2]string, resources [][2]string) {
	rows, _ := h.DB.Query(ctx, `SELECT name, COALESCE(code,'') FROM industries WHERE tenant_id=$1 ORDER BY name`, tenantID)
	for rows.Next() {
		var n, c string
		rows.Scan(&n, &c)
		industries = append(industries, [2]string{n, c})
	}
	rows.Close()

	rows, _ = h.DB.Query(ctx, `SELECT name, COALESCE(code,'') FROM majors WHERE tenant_id=$1 ORDER BY name`, tenantID)
	for rows.Next() {
		var n, c string
		rows.Scan(&n, &c)
		majors = append(majors, [2]string{n, c})
	}
	rows.Close()

	rows, _ = h.DB.Query(ctx, `SELECT name, COALESCE(url,''), COALESCE(description,'') FROM certificate_library WHERE tenant_id=$1 ORDER BY name`, tenantID)
	for rows.Next() {
		var n, u, d string
		rows.Scan(&n, &u, &d)
		certs = append(certs, [3]string{n, u, d})
	}
	rows.Close()

	rows, _ = h.DB.Query(ctx, `SELECT name, COALESCE(short_name,'') FROM career_positions WHERE tenant_id=$1 ORDER BY name`, tenantID)
	for rows.Next() {
		var n, s string
		rows.Scan(&n, &s)
		positions = append(positions, [2]string{n, s})
	}
	rows.Close()

	rows, _ = h.DB.Query(ctx, `SELECT name FROM knowledge_points WHERE tenant_id=$1 ORDER BY name`, tenantID)
	for rows.Next() {
		var n string
		rows.Scan(&n)
		knowledgePoints = append(knowledgePoints, n)
	}
	rows.Close()

	rows, _ = h.DB.Query(ctx, `SELECT name, COALESCE(category::text,'') FROM ability_points WHERE tenant_id=$1 ORDER BY name`, tenantID)
	for rows.Next() {
		var n, c string
		rows.Scan(&n, &c)
		abilityPoints = append(abilityPoints, [2]string{n, c})
	}
	rows.Close()

	rows, _ = h.DB.Query(ctx, `SELECT name, COALESCE(type,'') FROM task_resources WHERE tenant_id=$1 ORDER BY name`, tenantID)
	for rows.Next() {
		var n, t string
		rows.Scan(&n, &t)
		resources = append(resources, [2]string{n, t})
	}
	rows.Close()

	return
}

func (h *TemplateHandler) generatePositionTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	industries, majors, certs, _, _, abilityPoints, _ := h.queryDicts(ctx, tenantID)

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
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+3)*20)
	}

	// Sheet 1: 岗位基本信息
	headers1 := []string{"岗位名称 *", "岗位简称", "岗位类型 *", "面向行业", "适用专业", "薪资下限", "薪资上限", "岗位背景介绍", "任职要求", "发展路径", "所需证书", "所属批次"}
	widths1 := []float64{22, 14, 16, 20, 26, 12, 12, 42, 42, 30, 28, 18}
	setA1("岗位基本信息", 12, "填写说明：\n* 必填列。薪资单位为元。\n岗位类型：企业岗位 / 教学岗位 / 其他\n面向行业：从「行业字典」Sheet 选取，匹配则关联，不匹配则忽略\n适用专业：从「专业字典」Sheet 选取，多个逗号分隔；匹配则关联，不匹配则忽略\n所需证书：从「系统证书库」Sheet 选取，匹配则关联，不匹配则自动新建并关联\n任职要求：多条可用换行（Alt+Enter）分隔\n导入后默认状态为 draft")
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
				if cat == "" {
					cat = "技能"
				}
				data = append(data, []string{v[0], cat})
			}
			return data
		}())

	return f
}

func (h *TemplateHandler) generateScenarioTemplate(ctx context.Context, tenantID string) *excelize.File {
	f := excelize.NewFile()
	industries, majors, _, positions, knowledgePoints, abilityPoints, resources := h.queryDicts(ctx, tenantID)

	hdrStyle := makeHeaderStyle(f)
	dataStyle := makeDataStyle(f)
	noteStyle := makeNoteStyle(f)
	wrapAlign := makeWrapAlign(f)
	_ = hdrStyle
	_ = dataStyle

	setHdr := func(sheet string, row int, headers []string, widths []float64) {
		for ci, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(ci+1, row)
			f.SetCellValue(sheet, cell, h)
			f.SetCellStyle(sheet, cell, cell, hdrStyle)
			f.SetColWidth(sheet, colName(ci+1), colName(ci+1), widths[ci])
		}
		f.SetRowHeight(sheet, row, 28)
	}
	setRows := func(sheet string, startRow int, data [][]string) {
		for ri, row := range data {
			r := startRow + ri
			for ci, v := range row {
				cell, _ := excelize.CoordinatesToCellName(ci+1, r)
				f.SetCellValue(sheet, cell, v)
				f.SetCellStyle(sheet, cell, cell, dataStyle)
				f.SetCellStyle(sheet, cell, cell, wrapAlign)
			}
			f.SetRowHeight(sheet, r, 24)
		}
	}
	_ = setRows

	setA1 := func(sheet string, cols int, text string) {
		start, _ := excelize.CoordinatesToCellName(1, 1)
		end, _ := excelize.CoordinatesToCellName(cols, 1)
		f.MergeCell(sheet, start, end)
		f.SetCellValue(sheet, start, text)
		f.SetCellStyle(sheet, start, end, noteStyle)
		f.SetCellStyle(sheet, start, end, wrapAlign)
		f.SetRowHeight(sheet, 1, float64(strings.Count(text, "\n")+3)*20)
	}

	// Sheet 1: 场景基本信息
	s1, _ := f.NewSheet("场景基本信息")
	f.DeleteSheet("Sheet1")
	f.SetActiveSheet(s1)
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
				if cat == "" {
					cat = "技能"
				}
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
	f.SetRowHeight(name, 1, float64(strings.Count(note, "\n")+3)*20)

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
		Font: &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
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

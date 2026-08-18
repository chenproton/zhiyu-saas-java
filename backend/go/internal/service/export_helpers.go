package service

import "github.com/xuri/excelize/v2"

// NewSetCell 构造按 sheet/单元格写入值的便捷函数（原 handler/template_handler.go 下沉）。
func NewSetCell(f *excelize.File) func(sheet, cell, val string) {
	dataStyle := MakeDataStyle(f)
	wrapAlign := MakeWrapAlign(f)
	return func(sheet, cell, val string) {
		f.SetCellValue(sheet, cell, val)
		f.SetCellStyle(sheet, cell, cell, dataStyle)
		f.SetCellStyle(sheet, cell, cell, wrapAlign)
	}
}

// makeDataStyle 模板/导出共用助手（原 handler/template_handler.go 下沉）。
func MakeDataStyle(f *excelize.File) int {
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

// makeWrapAlign 模板/导出共用助手（原 handler/template_handler.go 下沉）。
func MakeWrapAlign(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Vertical: "top", WrapText: true},
	})
	return style
}

// makeHeaderStyle 模板/导出共用助手（原 handler/template_handler.go 下沉）。
func MakeHeaderStyle(f *excelize.File) int {
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

// makeNoteStyle 模板/导出共用助手（原 handler/template_handler.go 下沉）。
func MakeNoteStyle(f *excelize.File) int {
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Size: 10, Color: "808080", Italic: true},
	})
	return style
}

// colName 模板/导出共用助手（原 handler/template_handler.go 下沉）。
func ColName(n int) string {
	name, _ := excelize.ColumnNumberToName(n)
	return name
}

// DerefInt 空指针回退（原 handler/common.go 下沉）。
func DerefInt(p *int, fallback int) int {
	if p == nil {
		return fallback
	}
	return *p
}

// CountPtr 空指针计数（原 handler/common.go 下沉）。
func CountPtr(v *int) int {
	if v == nil {
		return 0
	}
	return 1
}

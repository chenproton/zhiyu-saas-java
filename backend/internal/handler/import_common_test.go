package handler

import (
	"testing"
)

// TestResourceTypeByExt 验证资源类型推断与前端 resource-type-constants.tsx 的
// resourceTypeExtensionMap 保持一致（kkFileView 支持的全部格式均能正确归类）。
func TestResourceTypeByExt(t *testing.T) {
	cases := map[string]string{
		"方案.pdf":  "document",
		"合同.docx": "document",
		"讲稿.ppt":  "document",
		"图纸.dwg":  "document",
		"模型.stl":  "document",
		"模型.obj":  "document",
		"模型.glb":  "document",
		"源码.go":   "document",
		"网页.html": "document",
		"邮件.eml":  "document",
		"数据.xlsx": "spreadsheet",
		"台账.et":   "spreadsheet",
		"统计.tsv":  "spreadsheet",
		"照片.png":  "image",
		"图标.ico":  "image",
		"矢量.svg":  "image",
		"照片.psd":  "image",
		"录音.mp3":  "audio",
		"语音.m4a":  "audio",
		"视频.mp4":  "video",
		"录像.avi":  "video",
		"录像.mkv":  "video",
		"资料.zip":  "archive",
		"备份.jar":  "archive",
		"打包.tar":  "archive",
		"工具.exe":  "software",
		"安装包.apk": "software",
		"无后缀名称":   "other",
		"怪文件.xyz": "other",
		"工具.EXE":  "software",
		"图纸.DWG":  "document",
	}
	for name, want := range cases {
		if got := resourceTypeByExt(name); got != want {
			t.Errorf("resourceTypeByExt(%q) = %q, want %q", name, got, want)
		}
	}
}

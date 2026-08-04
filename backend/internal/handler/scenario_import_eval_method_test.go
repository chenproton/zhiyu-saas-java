package handler

import "testing"

// TestMapEvalMethod 验证场景导入测评方式名称到 method_key 的映射，含现场问答。
func TestMapEvalMethod(t *testing.T) {
	cases := map[string]string{
		"题库":     "question_bank",
		"试卷":     "paper",
		"随堂测":    "quiz",
		"现场问答":   "random_draw",
		"现场评审":   "review",
		"成果评价":   "outcome",
		"作业":     "homework",
		" 现场问答 ": "random_draw",
		"未知方式":   "",
		"":       "",
	}
	for name, want := range cases {
		if got := mapEvalMethod(name); got != want {
			t.Errorf("mapEvalMethod(%q) = %q, want %q", name, got, want)
		}
	}
}

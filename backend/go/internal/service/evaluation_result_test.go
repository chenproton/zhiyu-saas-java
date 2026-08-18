package service

import (
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
)

func TestIsCorrectJudge(t *testing.T) {
	cases := []struct {
		name    string
		correct []string
		raw     interface{}
		want    bool
	}{
		// 学生端恒提交 "true"/"false"，标准答案各种写法都必须互认
		{"标准答案true-学生true", []string{"true"}, "true", true},
		{"标准答案false-学生false", []string{"false"}, "false", true},
		{"标准答案正确-学生true", []string{"正确"}, "true", true},
		{"标准答案错误-学生false", []string{"错误"}, "false", true},
		{"标准答案对-学生true", []string{"对"}, "true", true},
		{"标准答案错-学生false", []string{"错"}, "false", true},
		{"标准答案T-学生true", []string{"T"}, "true", true},
		{"标准答案F-学生false", []string{"F"}, "false", true},
		{"标准答案1-学生true", []string{"1"}, "true", true},
		{"标准答案0-学生false", []string{"0"}, "false", true},
		{"标准答案是-学生true", []string{"是"}, "true", true},
		{"标准答案否-学生false", []string{"否"}, "false", true},
		// 反向：学生中文、标准答案 true/false（历史兼容）
		{"学生正确-标准答案true", []string{"true"}, "正确", true},
		{"学生错误-标准答案false", []string{"false"}, "错误", true},
		// 带空格容错
		{"标准答案true-学生带空格", []string{"true"}, " true ", true},
		// 判错
		{"答案不一致", []string{"true"}, "false", false},
		{"空答案", []string{}, "true", false},
		{"无法识别的标准答案", []string{"不确定"}, "true", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isCorrect(string(domain.QuestionTypeJudge), c.correct, nil, c.raw); got != c.want {
				t.Fatalf("isCorrect(judge, %v, %v) = %v, want %v", c.correct, c.raw, got, c.want)
			}
		})
	}
}

func TestIsCorrectSingleOptionMapping(t *testing.T) {
	options := []string{"北京", "上海", "广州", "深圳"}
	cases := []struct {
		name    string
		correct []string
		raw     interface{}
		want    bool
	}{
		// 标准答案存字母 A/B，学生提交选项文字
		{"答案A-学生选项文字", []string{"A"}, "北京", true},
		{"答案B-学生选项文字", []string{"B"}, "上海", true},
		{"答案小写a-学生选项文字", []string{"a"}, "北京", true},
		{"答案C-学生选错", []string{"C"}, "北京", false},
		// 标准答案存选项文字（React 编辑器/Excel 导入规范格式）
		{"答案文字-学生文字一致", []string{"北京"}, "北京", true},
		{"答案文字-学生文字不一致", []string{"北京"}, "上海", false},
		// 大小写不敏感（EqualFold）
		{"答案文字大小写", []string{"BeiJing"}, "beijing", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isCorrect(string(domain.QuestionTypeSingle), c.correct, options, c.raw); got != c.want {
				t.Fatalf("isCorrect(single, %v, %v) = %v, want %v", c.correct, c.raw, got, c.want)
			}
		})
	}
}

func TestIsCorrectMultipleOptionMapping(t *testing.T) {
	options := []string{"北京", "上海", "广州", "深圳"}
	cases := []struct {
		name    string
		correct []string
		raw     interface{}
		want    bool
	}{
		{"答案AC-学生选项文字", []string{"A", "C"}, []string{"北京", "广州"}, true},
		{"答案AC-学生乱序", []string{"A", "C"}, []string{"广州", "北京"}, true},
		{"答案AC-学生缺一个", []string{"A", "C"}, []string{"北京"}, false},
		{"答案文字-学生文字", []string{"北京", "广州"}, []string{"北京", "广州"}, true},
		{"答案文字-学生字符串数组混入字母", []string{"北京", "广州"}, []string{"A", "C"}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isCorrect(string(domain.QuestionTypeMultiple), c.correct, options, c.raw); got != c.want {
				t.Fatalf("isCorrect(multiple, %v, %v) = %v, want %v", c.correct, c.raw, got, c.want)
			}
		})
	}
}

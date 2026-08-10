package handler

import (
	"reflect"
	"testing"
)

func TestParseDayOfWeekVariants(t *testing.T) {
	cases := []struct {
		in   string
		want int
	}{
		{"周一", 1}, {"星期一", 1}, {"1", 1},
		{"周二", 2}, {"星期二", 2}, {"2", 2},
		{"周三", 3}, {"星期三", 3}, {"3", 3},
		{"周四", 4}, {"星期四", 4}, {"4", 4},
		{"周五", 5}, {"星期五", 5}, {"5", 5},
		{"周六", 6}, {"星期六", 6}, {"6", 6},
		{"周日", 7}, {"星期日", 7}, {"周天", 7}, {"星期天", 7}, {"7", 7},
		{"", 0}, {"周一 ", 1}, {" 星期一 ", 1}, {"周日晚上", 0}, {"八", 0},
	}
	for _, c := range cases {
		if got := parseDayOfWeek(c.in); got != c.want {
			t.Errorf("parseDayOfWeek(%q) = %d, want %d", c.in, got, c.want)
		}
	}
}

func TestParseWeekMatrix(t *testing.T) {
	matrix := "周一:上午1、上午2\n周二:\n周三:下午3\n周四:\n周五:上午4\n周六:\n周日:"
	slots := parseWeekMatrix(matrix)
	want := []weekSlot{
		{day: 1, periods: []string{"上午第一节课", "上午第二节课"}},
		{day: 3, periods: []string{"下午第三节课"}},
		{day: 5, periods: []string{"上午第四节课"}},
	}
	if !reflect.DeepEqual(slots, want) {
		t.Errorf("parseWeekMatrix() = %+v, want %+v", slots, want)
	}

	if got := parseWeekMatrix(""); len(got) != 0 {
		t.Errorf("parseWeekMatrix(empty) = %+v, want none", got)
	}
	if got := parseWeekMatrix("周一:"); len(got) != 0 {
		t.Errorf("parseWeekMatrix(no periods) = %+v, want none", got)
	}
	if got := parseWeekMatrix("随便写的"); len(got) != 0 {
		t.Errorf("parseWeekMatrix(garbage) = %+v, want none", got)
	}
}

func TestParseWeekMatrixEnglishComma(t *testing.T) {
	slots := parseWeekMatrix("周二:下午1,下午2")
	want := []weekSlot{
		{day: 2, periods: []string{"下午第一节课", "下午第二节课"}},
	}
	if !reflect.DeepEqual(slots, want) {
		t.Errorf("parseWeekMatrix(english comma) = %+v, want %+v", slots, want)
	}
}

func TestNormalizePeriodsKeepsUnknown(t *testing.T) {
	got := normalizePeriods([]string{"上午1", "自定义节次", "晚上2"})
	want := []string{"上午第一节课", "自定义节次", "晚上第二节课"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("normalizePeriods() = %v, want %v", got, want)
	}
}

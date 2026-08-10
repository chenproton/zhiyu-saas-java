package handler

import "testing"

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

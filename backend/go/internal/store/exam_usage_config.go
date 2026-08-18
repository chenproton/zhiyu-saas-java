package store

import "github.com/zhiyu-saas/backend/internal/domain"

// ExtractExamUsageWindow 解析考试安排开放时间窗：仅「定时启用」(activationMode=scheduled) 配置生效，
// 其余模式不设窗口。场景任务与课程节点测评方式共用。
func ExtractExamUsageWindow(resourceConfig domain.JSONMap) (*string, *string) {
	if mode, _ := resourceConfig["activationMode"].(string); mode != "scheduled" {
		return nil, nil
	}
	start, _ := resourceConfig["scheduledTime"].(string)
	end, _ := resourceConfig["scheduledEndTime"].(string)
	if start == "" && end == "" {
		return nil, nil
	}
	var s, e *string
	if start != "" {
		s = &start
	}
	if end != "" {
		e = &end
	}
	return s, e
}

// ExtractExamUsageDuration 解析考试安排时长（分钟）：题库/随堂测取 timeLimit，试卷取 duration，
// 未配置返回 nil（沿用试卷自身时长）。场景任务与课程节点测评方式共用。
func ExtractExamUsageDuration(resourceConfig domain.JSONMap, methodKey string) *int {
	var d float64
	if methodKey == "paper" {
		d, _ = resourceConfig["duration"].(float64)
	} else if t, ok := resourceConfig["timeLimit"].(float64); ok && t > 0 {
		d = t
	} else {
		d, _ = resourceConfig["duration"].(float64)
	}
	if d <= 0 {
		return nil
	}
	v := int(d)
	return &v
}

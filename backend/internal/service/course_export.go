package service

// CourseExportService CourseExportHandler 业务编排下沉（原 course_export_handler.go 内联逻辑）。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// CourseExportService 业务编排服务。
type CourseExportService struct {
	s *Service
}

func NewCourseExportService(s *Service) *CourseExportService {
	return &CourseExportService{s: s}
}

func (s *CourseExportService) FillCoursesData(ctx context.Context, f *excelize.File, tenantID string, courseIDs []string) error {
	setCell := NewSetCell(f)

	type courseRow struct {
		id, name, major, description, batch string
		abilityPointNames                   string
	}
	var courseRows []courseRow
	courseNameMap := make(map[string]string)

	for _, cid := range courseIDs {
		course, err := s.s.Store().Courses().Get(ctx, cid, tenantID)
		if err != nil || course.Type != "system" {
			slog.Warn("导出课程行跳过", "courseId", cid, "error", err)
			continue
		}
		name := course.Name
		desc := ""
		if course.Description != nil {
			desc = *course.Description
		}
		majorID := course.MajorID
		batchID := course.BatchID

		majorName := ""
		if majorID != nil && *majorID != "" {
			majorName, err = s.s.Store().Majors().GetNameByID(ctx, s.s.Store().Q(), *majorID)
			if err != nil {
				majorName = ""
			}
		}

		batchName := ""
		if batchID != nil && *batchID != "" {
			batchName, err = s.s.Store().Batches().GetNameByTable(ctx, s.s.Store().Q(), "lesson_batches", *batchID)
			if err != nil {
				batchName = ""
			}
		}

		abilityPointNames := s.lookupCourseAbilityPointNames(ctx, cid)

		courseRows = append(courseRows, courseRow{cid, name, majorName, desc, batchName, abilityPointNames})
		courseNameMap[cid] = name
	}

	for ri, row := range courseRows {
		r := 3 + ri
		setCell("课程基本信息", fmt.Sprintf("A%d", r), row.name)
		setCell("课程基本信息", fmt.Sprintf("B%d", r), row.major)
		setCell("课程基本信息", fmt.Sprintf("C%d", r), row.description)
		setCell("课程基本信息", fmt.Sprintf("D%d", r), row.batch)
		setCell("课程基本信息", fmt.Sprintf("E%d", r), row.abilityPointNames)
		f.SetRowHeight("课程基本信息", r, 24)
	}

	nodeRow := 3
	for _, cid := range courseIDs {
		courseName := courseNameMap[cid]
		if courseName == "" {
			slog.Warn("导出课程节点跳过：课程信息缺失", "courseId", cid)
			continue
		}

		// 节点ID -> 节点名
		nodeNameByID := make(map[string]string)
		nodeRows, err := s.s.Store().CourseNodes().ListByCourse(ctx, s.s.Store().Q(), tenantID, cid)
		if err != nil {
			slog.Warn("导出课程节点查询失败", "courseId", cid, "error", err)
			continue
		}

		type nodeInfo struct {
			id, name, parentID, refType, teachingGoals string
			sortOrder, duration, difficulty            int
		}
		var nodes []nodeInfo
		for _, n := range nodeRows {
			nodeNameByID[n.ID] = n.Name
			nodes = append(nodes, nodeInfo{n.ID, n.Name, n.ParentID, n.RefType, n.TeachingGoals, n.SortOrder, n.Duration, n.Difficulty})
		}

		for _, n := range nodes {
			parentName := ""
			if n.parentID != "" {
				parentName = nodeNameByID[n.parentID]
			}

			refTypeName := ""
			if n.refType == "original" {
				refTypeName = "颗粒课"
			}

			knowledgeNames := s.lookupNodeKnowledgePointNames(ctx, n.id)
			resourceNames := s.lookupNodeResourceNames(ctx, n.id)
			evalMethods := s.lookupNodeEvalMethods(ctx, tenantID, n.id)

			setCell("节点配置", fmt.Sprintf("A%d", nodeRow), courseName)
			setCell("节点配置", fmt.Sprintf("B%d", nodeRow), n.name)
			setCell("节点配置", fmt.Sprintf("C%d", nodeRow), parentName)
			setCell("节点配置", fmt.Sprintf("D%d", nodeRow), refTypeName)
			setCell("节点配置", fmt.Sprintf("E%d", nodeRow), fmt.Sprintf("%d", n.sortOrder))
			setCell("节点配置", fmt.Sprintf("F%d", nodeRow), n.teachingGoals)
			setCell("节点配置", fmt.Sprintf("G%d", nodeRow), fmt.Sprintf("%d", n.duration))
			setCell("节点配置", fmt.Sprintf("H%d", nodeRow), fmt.Sprintf("%d", n.difficulty))
			setCell("节点配置", fmt.Sprintf("I%d", nodeRow), strings.Join(knowledgeNames, ","))
			setCell("节点配置", fmt.Sprintf("J%d", nodeRow), strings.Join(resourceNames, ","))
			setCell("节点配置", fmt.Sprintf("K%d", nodeRow), strings.Join(evalMethods, ","))
			f.SetRowHeight("节点配置", nodeRow, 24)
			nodeRow++
		}
	}

	return nil
}

func (s *CourseExportService) lookupCourseAbilityPointNames(ctx context.Context, courseID string) string {
	return store.CourseImportCourseAbilityPointNames(ctx, s.s.Store().Q(), courseID)
}

func (s *CourseExportService) lookupNodeKnowledgePointNames(ctx context.Context, nodeID string) []string {
	return s.s.Store().CourseNodes().ListNodeKnowledgePointNames(ctx, s.s.Store().Q(), nodeID)
}

func (s *CourseExportService) lookupNodeResourceNames(ctx context.Context, nodeID string) []string {
	return s.s.Store().CourseNodes().ListNodeResourceNames(ctx, s.s.Store().Q(), nodeID)
}

func (s *CourseExportService) lookupNodeEvalMethods(ctx context.Context, tenantID, nodeID string) []string {
	methods := s.s.Store().CourseNodes().ListNodeEvalMethods(ctx, s.s.Store().Q(), tenantID, nodeID)
	var out []string
	for _, t := range methods {
		if ch := mapCourseEvalMethodToChinese(t); ch != "" {
			out = append(out, ch)
		}
	}
	return out
}

func mapCourseEvalMethodToChinese(mk string) string {
	switch mk {
	case "question_bank":
		return "题库"
	case "paper":
		return "试卷"
	case "quiz":
		return "随堂测"
	default:
		return ""
	}
}

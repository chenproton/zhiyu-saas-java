package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CourseExportHandler struct {
	DB *pgxpool.Pool
}

func (h *CourseExportHandler) ExportExcel(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	ids, ok := decodeIDList(w, r, "缺少课程ID")
	if !ok {
		return
	}

	ctx := r.Context()
	th := &TemplateHandler{DB: h.DB}
	f := th.generateSystemCourseTemplate(ctx, tenantID)

	if err := h.fillCoursesData(ctx, f, tenantID, ids); err != nil {
		respondError(w, http.StatusInternalServerError, "填充export data失败")
		return
	}

	writeExcel(w, f, "体系课导出.xlsx")
}

func (h *CourseExportHandler) fillCoursesData(ctx context.Context, f *excelize.File, tenantID string, courseIDs []string) error {
	setCell := newSetCell(f)

	type courseRow struct {
		id, name, major, description, batch string
		abilityPointNames                   string
	}
	var courseRows []courseRow
	courseNameMap := make(map[string]string)

	for _, cid := range courseIDs {
		var name, desc string
		var majorID, batchID *string
		err := h.DB.QueryRow(ctx, `
			SELECT name, COALESCE(description,''), major_id, batch_id
			FROM courses WHERE id=$1 AND tenant_id=$2 AND type='system'
		`, cid, tenantID).Scan(&name, &desc, &majorID, &batchID)
		if err != nil {
			slog.Warn("导出课程行跳过", "courseId", cid, "error", err)
			continue
		}

		majorName := ""
		if majorID != nil && *majorID != "" {
			h.DB.QueryRow(ctx, `SELECT name FROM majors WHERE id=$1`, *majorID).Scan(&majorName)
		}

		batchName := ""
		if batchID != nil && *batchID != "" {
			h.DB.QueryRow(ctx, `SELECT name FROM lesson_batches WHERE id=$1`, *batchID).Scan(&batchName)
		}

		abilityPointNames := h.lookupCourseAbilityPointNames(ctx, cid)

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
		nodeRows, err := h.DB.Query(ctx, `
			SELECT id, name, parent_id, ref_type, sort_order, COALESCE(teaching_goals,''), duration, difficulty
			FROM system_course_nodes
			WHERE course_id=$1 AND tenant_id=$2
			ORDER BY sort_order, created_at
		`, cid, tenantID)
		if err != nil {
			slog.Warn("导出课程节点查询失败", "courseId", cid, "error", err)
			continue
		}

		type nodeInfo struct {
			id, name, parentID, refType, teachingGoals string
			sortOrder, duration, difficulty            int
		}
		var nodes []nodeInfo
		for nodeRows.Next() {
			var n nodeInfo
			if err := nodeRows.Scan(&n.id, &n.name, &n.parentID, &n.refType, &n.sortOrder, &n.teachingGoals, &n.duration, &n.difficulty); err != nil {
				nodeRows.Close()
				return err
			}
			nodeNameByID[n.id] = n.name
			nodes = append(nodes, n)
		}
		if err := nodeRows.Err(); err != nil {
			nodeRows.Close()
			return err
		}
		nodeRows.Close()

		for _, n := range nodes {
			parentName := ""
			if n.parentID != "" {
				parentName = nodeNameByID[n.parentID]
			}

			refTypeName := ""
			if n.refType == "original" {
				refTypeName = "颗粒课"
			}

			knowledgeNames := h.lookupNodeKnowledgePointNames(ctx, n.id)
			resourceNames := h.lookupNodeResourceNames(ctx, n.id)
			evalMethods := h.lookupNodeEvalMethods(ctx, tenantID, n.id)

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

func (h *CourseExportHandler) lookupCourseAbilityPointNames(ctx context.Context, courseID string) string {
	var abilityPointIDs []string
	err := h.DB.QueryRow(ctx, `
		SELECT ARRAY(SELECT unnest(ability_point_ids)::text)
		FROM courses WHERE id=$1
	`, courseID).Scan(&abilityPointIDs)
	if err != nil || len(abilityPointIDs) == 0 {
		return ""
	}
	var names []string
	for _, id := range abilityPointIDs {
		var n string
		h.DB.QueryRow(ctx, `SELECT name FROM ability_points WHERE id=$1`, id).Scan(&n)
		if n != "" {
			names = append(names, n)
		}
	}
	return strings.Join(names, ",")
}

func (h *CourseExportHandler) lookupNodeKnowledgePointNames(ctx context.Context, nodeID string) []string {
	rows, err := h.DB.Query(ctx, `
		SELECT kp.name FROM knowledge_points kp
		JOIN node_knowledge_point_bindings nb ON nb.knowledge_point_id = kp.id
		WHERE nb.node_id=$1
		ORDER BY kp.name
	`, nodeID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		if n != "" {
			names = append(names, n)
		}
	}
	return names
}

func (h *CourseExportHandler) lookupNodeResourceNames(ctx context.Context, nodeID string) []string {
	rows, err := h.DB.Query(ctx, `
		SELECT r.name FROM resource_library r
		JOIN node_resource_bindings nb ON nb.resource_id = r.id
		WHERE nb.node_id=$1
		ORDER BY r.name
	`, nodeID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		if n != "" {
			names = append(names, n)
		}
	}
	return names
}

func (h *CourseExportHandler) lookupNodeEvalMethods(ctx context.Context, tenantID, nodeID string) []string {
	var methods []string

	rows, err := h.DB.Query(ctx, `
		SELECT type FROM node_quizzes
		WHERE node_id=$1 AND tenant_id=$2
		ORDER BY type
	`, nodeID, tenantID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t string
			rows.Scan(&t)
			if ch := mapCourseEvalMethodToChinese(t); ch != "" {
				methods = append(methods, ch)
			}
		}
	}

	var hasHomework bool
	err = h.DB.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM node_homeworks WHERE node_id=$1 AND tenant_id=$2)
	`, nodeID, tenantID).Scan(&hasHomework)
	if err == nil && hasHomework {
		methods = append(methods, "作业")
	}

	return methods
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

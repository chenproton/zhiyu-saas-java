package service

// ProgramCourseImportService 方案课程导入业务编排：Sheet 解析 + 全量替换事务。
// SQL 唯一所在地仍在 store 包。

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/store"
)

// ProgramCourseImportService 业务编排服务。
type ProgramCourseImportService struct {
	s *Service
}

func NewProgramCourseImportService(s *Service) *ProgramCourseImportService {
	return &ProgramCourseImportService{s: s}
}

const PCImportSheet = "导入"

// PCImportResult 方案课程导入结果。
type PCImportResult struct {
	Created    int
	Duplicates int
	Failed     int
	Errors     []string
}

// PCCourse 解析后的方案课程行。
type PCCourse struct {
	ID         string
	Name       string
	Credits    float64
	Hours      int
	Nature     string
	PositionID *string
	CourseID   *string
}

// ParseCourses 解析「导入」Sheet（关联岗位/体系课二选一，名称需匹配现有数据）。
func (s *ProgramCourseImportService) ParseCourses(ctx context.Context, tenantID string, xlsx *excelize.File) ([]PCCourse, []string) {
	rows, err := xlsx.GetRows(PCImportSheet)
	if err != nil {
		return nil, []string{"请使用名为「导入」的 Sheet"}
	}

	courses := make([]PCCourse, 0)
	errs := make([]string, 0)

	for i, row := range rows {
		if i < 2 {
			continue
		}
		rowNum := i + 1
		positionName := strings.TrimSpace(Col(row, 0))
		courseName := strings.TrimSpace(Col(row, 1))
		creditsStr := strings.TrimSpace(Col(row, 2))
		hoursStr := strings.TrimSpace(Col(row, 3))
		nature := strings.TrimSpace(Col(row, 4))

		if positionName == "" && courseName == "" {
			errs = append(errs, "第"+strconv.Itoa(rowNum)+"行：关联岗位和关联体系课至少填写一项")
			continue
		}
		credits, errC := strconv.ParseFloat(creditsStr, 64)
		hours, errH := strconv.Atoi(hoursStr)
		if creditsStr != "" && errC != nil {
			errs = append(errs, "第"+strconv.Itoa(rowNum)+"行：学分格式无效")
			continue
		}
		if hoursStr != "" && errH != nil {
			errs = append(errs, "第"+strconv.Itoa(rowNum)+"行：学时格式无效")
			continue
		}
		if nature == "" {
			nature = "必修"
		}

		c := PCCourse{ID: uuid.NewString(), Credits: credits, Hours: hours, Nature: nature}

		if positionName != "" {
			if pid, err := store.CourseImportFindCareerPositionIDByName(ctx, s.s.Store().Q(), tenantID, positionName); err == nil {
				c.PositionID = &pid
				c.Name = positionName
			}
		}
		if c.PositionID == nil && courseName != "" {
			if id, n, err := store.CourseImportFindSystemCourseIDAndName(ctx, s.s.Store().Q(), tenantID, courseName); err == nil {
				c.Name = n
				if c.Name == "" {
					c.Name = courseName
				}
				c.CourseID = &id
			}
		}
		// 岗位与课程均未解析成功时计入错误跳过，避免写入空名称关联
		if c.PositionID == nil && c.CourseID == nil {
			errs = append(errs, "第"+strconv.Itoa(rowNum)+"行：岗位/课程名称均未匹配到现有数据")
			continue
		}

		courses = append(courses, c)
	}
	return courses, errs
}

// Replace 全量替换方案课程（事务内清空重写）。
func (s *ProgramCourseImportService) Replace(ctx context.Context, programID string, courses []PCCourse) error {
	items := make([]store.ProgramCourseImportItem, len(courses))
	for i, c := range courses {
		items[i] = store.ProgramCourseImportItem{
			ID: c.ID, Name: c.Name, Credits: int(c.Credits), Hours: int(c.Hours),
			Nature: c.Nature, PositionID: c.PositionID, CourseID: c.CourseID,
		}
	}
	return s.s.WithTx(ctx, func(txStore *store.Store) error {
		return store.ReplaceProgramCourses(ctx, txStore.Q(), programID, items)
	})
}

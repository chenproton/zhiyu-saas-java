package domain

import (
	"encoding/json"
	"time"
)

// ===== 就业服务管理（人才与岗位供需服务大厅） =====
// 数据链：alliance_employment_projects（学校租户）← alliance_employment_jobs.project_id
// 学生按 target_groups 可见性浏览岗位并投递，企业只读查看投递。
// 见 docs/spec/01-prd.md §3.8 L-4、docs/spec/02-api-contract.md §1.9。

// EmploymentProject 就业项目（学校发布，指定参与企业与面向学生群体）
type EmploymentProject struct {
	ID            string  `json:"id"`
	TenantID      string  `json:"tenantId"`
	Name          string  `json:"name"`
	Type          string  `json:"type"` // spring|autumn|directed|order|custom:<文本>
	Organizer     *string `json:"organizer,omitempty"`
	Description   *string `json:"description,omitempty"`
	StartDate     *string `json:"startDate,omitempty"`
	EndDate       *string `json:"endDate,omitempty"`
	PublishStatus string  `json:"publishStatus"` // draft|published
	// EnterpriseIDs 参与企业 partner_enterprises.id 数组（JSON）
	EnterpriseIDs json.RawMessage `json:"enterpriseIds,omitempty"`
	// TargetGroups 面向学生群体条件数组（组内 AND、组间 OR；空数组 = 面向全校）
	TargetGroups json.RawMessage `json:"targetGroups,omitempty"`
	CreatedBy    *string         `json:"createdBy,omitempty"`
	CreatedAt    time.Time       `json:"createdAt"`
	UpdatedAt    time.Time       `json:"updatedAt"`
	// 聚合字段（列表/公开接口填充，不落库）
	JobCount         int `json:"jobCount"`
	ApplicationCount int `json:"applicationCount"`
}

// EmploymentTargetGroup 面向学生群体条件（target_groups 数组元素）
type EmploymentTargetGroup struct {
	OrgNodeID    *string `json:"orgNodeId,omitempty"`
	OrgNodeName  *string `json:"orgNodeName,omitempty"`
	MajorID      *string `json:"majorId,omitempty"`
	MajorName    *string `json:"majorName,omitempty"`
	GraduateYear *int    `json:"graduateYear,omitempty"`
}

// EmploymentJob 企业岗位（企业在就业项目下录入，也允许独立岗位；挂项目后才上大厅）
type EmploymentJob struct {
	ID           string  `json:"id"`
	TenantID     string  `json:"tenantId"`
	EnterpriseID string  `json:"enterpriseId"`
	ProjectID    *string `json:"projectId,omitempty"`
	Title        string  `json:"title"`
	JobType      string  `json:"jobType"` // full-time|part-time|internship|apprentice
	Location     *string `json:"location,omitempty"`
	// SalaryMin/SalaryMax 薪资范围（千元/月）
	SalaryMin        *float64        `json:"salaryMin,omitempty"`
	SalaryMax        *float64        `json:"salaryMax,omitempty"`
	Headcount        *int            `json:"headcount,omitempty"`
	Education        *string         `json:"education,omitempty"`
	SuitableMajors   json.RawMessage `json:"suitableMajors,omitempty"`
	Description      *string         `json:"description,omitempty"`
	Responsibilities *string         `json:"responsibilities,omitempty"`
	Requirements     *string         `json:"requirements,omitempty"`
	ContactPerson    *string         `json:"contactPerson,omitempty"`
	ContactPhone     *string         `json:"contactPhone,omitempty"`
	Deadline         *string         `json:"deadline,omitempty"`
	Status           string          `json:"status"` // draft|published|closed
	CreatedBy        *string         `json:"createdBy,omitempty"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
	// 关联展示字段（JOIN 填充，不落库）
	EnterpriseName   string `json:"enterpriseName,omitempty"`
	ProjectName      string `json:"projectName,omitempty"`
	ApplicationCount int    `json:"applicationCount"`
}

// EmploymentApplication 学生投递（档案快照 + 求职信；本期企业只读）
type EmploymentApplication struct {
	ID           string `json:"id"`
	TenantID     string `json:"tenantId"`
	JobID        string `json:"jobId"`
	EnterpriseID string `json:"enterpriseId"`
	StudentID    string `json:"studentId"`
	// 档案快照（投递时落库）
	StudentName *string   `json:"studentName,omitempty"`
	StudentNo   *string   `json:"studentNo,omitempty"`
	MajorName   *string   `json:"majorName,omitempty"`
	ClassName   *string   `json:"className,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	Email       *string   `json:"email,omitempty"`
	CoverLetter *string   `json:"coverLetter,omitempty"`
	Status      string    `json:"status"` // 本期固定 pending
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	// 关联展示字段（JOIN 填充，不落库）
	JobTitle       string `json:"jobTitle,omitempty"`
	EnterpriseName string `json:"enterpriseName,omitempty"`
	ProjectName    string `json:"projectName,omitempty"`
}

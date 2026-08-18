package domain

// ===== 企业端资源共建（/partner/co-build） =====

// PartnerCoBuildPosition 企业共建岗位列表项：岗位实体 + 所属学校名称
// （schoolTenantId 取内嵌 CareerPosition.TenantID 的 tenantId 字段）。
type PartnerCoBuildPosition struct {
	CareerPosition
	SchoolName string `json:"schoolName"`
}

// PartnerCoBuildScenario 企业共建场景列表项：场景实体 + 所属学校名称。
type PartnerCoBuildScenario struct {
	Scenario
	SchoolName string `json:"schoolName"`
}

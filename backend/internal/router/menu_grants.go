package router

// 菜单驱动的 API 授权声明（ADR-0008）：
// 业务 API 按模块分组挂载 RequireMenu(模块管理菜单)；学生/前台只读 API 挂
// RequireMenu(管理菜单 ∪ landing 菜单)；/alliance/public/* 保持「登录公开」。
// 新增菜单或模块时同步维护下列列表；列表与前端菜单树（buildMenuTree +
// navigation-config）的勾选项保持一致。

// jobManageMenus 产业岗位学习平台管理面菜单（写 API 与列表管理页）。
var jobManageMenus = []string{
	"/job/positions",
	"/job/batches",
	"/job/workflows",
	"/job/approvals",
	"/job/learn-roads",
	"/job/recommend",
	"/job/archive",
}

// sceneManageMenus 实践场景学习平台管理面菜单。
var sceneManageMenus = []string{
	"/scene/",
	"/scene/batches",
	"/scene/workflows",
	"/scene/approvals",
	"/scene/archive",
}

// lessonManageMenus 数字课程服务平台管理面菜单。
var lessonManageMenus = []string{
	"/lesson/admin/system",
	"/lesson/admin/granular",
	"/lesson/admin/hybrid",
	"/lesson/admin/batches",
	"/lesson/admin/workflows",
	"/lesson/admin/approvals",
	"/lesson/admin/archive",
}

// evaluationManageMenus 能力评价与测评资源管理平台管理面菜单。
var evaluationManageMenus = []string{
	"/evaluation/question-banks",
	"/evaluation/exams",
	"/evaluation/exam-usage",
	"/evaluation/batches",
	"/evaluation/workflows",
	"/evaluation/approvals",
	"/evaluation/scene-results",
	"/evaluation/lesson-results",
	"/evaluation/job-ability",
	"/evaluation/job-ability/results",
}

// libraryManageMenus 教学资源共享服务平台管理面菜单。
var libraryManageMenus = []string{
	"/library/knowledge",
	"/library/ability",
	"/library/certificates",
	"/library/questions",
	"/library/my-resources",
	"/library/tags",
	"/library/resources/document",
	"/library/resources/spreadsheet",
	"/library/resources/image",
	"/library/resources/link",
	"/library/resources/audio",
	"/library/resources/video",
	"/library/resources/archive",
	"/library/resources/venue",
	"/library/resources/facility",
	"/library/resources/software",
	"/library/resources/other",
}

// affairsManageMenus 教务管理服务平台管理面菜单。
var affairsManageMenus = []string{
	"/affairs/config",
	"/affairs/org-structure",
	"/affairs/students",
	"/affairs/teachers",
	"/affairs/positions",
	"/affairs/majors",
	"/affairs/relations",
	"/affairs/programs",
	"/affairs/teaching-plans",
	"/affairs/scheduling",
	"/affairs/student-portraits",
	"/affairs/batches",
	"/affairs/workflows",
	"/affairs/approvals",
}

// allianceManageMenus 产教融合与就业服务平台管理面菜单。
var allianceManageMenus = []string{
	"/portal/apps/alliance/school",
	"/portal/apps/alliance/enterprises",
	"/portal/apps/alliance/projects",
	"/portal/apps/alliance/achievements",
	"/portal/apps/alliance/experts",
	"/portal/apps/alliance/agreements",
	"/portal/apps/alliance/permissions",
	"/portal/apps/alliance/dictionaries",
	"/portal/apps/alliance/brands",
	"/portal/apps/alliance/brands/talent",
	"/portal/apps/alliance/brands/employer",
	"/portal/apps/alliance/brands/job",
	"/portal/apps/alliance/brands/major",
	"/portal/apps/alliance/brands/teacher",
	"/portal/apps/alliance/brands/culture",
	"/portal/apps/alliance/employmentproject",
	"/portal/apps/alliance/employmentjob",
}

// alliancePublicMenus 联盟前台只读面菜单（落地页）。
var alliancePublicMenus = []string{"/portal/alliance/landing"}

// workflowMenus 门户级工作流/审批菜单（spec 02 §1.8：school_admin/teacher 可用）。
var workflowMenus = []string{
	"/job/workflows", "/job/approvals",
	"/scene/workflows", "/scene/approvals",
	"/lesson/admin/workflows", "/lesson/admin/approvals",
	"/evaluation/workflows", "/evaluation/approvals",
	"/affairs/workflows", "/affairs/approvals",
}

// systemMenus 系统管理菜单（/portal/apps/system 前缀，RequireSystemPermission
// 的菜单判定部分）。
var systemMenus = []string{
	"/portal/apps/system/tenant",
	"/portal/apps/system/resource/package",
	"/portal/apps/system/resource/codes",
	"/portal/apps/system/resource/majors",
	"/portal/apps/system/resource/industries",
	"/portal/apps/system/org-user/org-structure",
	"/portal/apps/system/org-user/org-types",
	"/portal/apps/system/org-user/accounts",
	"/portal/apps/system/org-user/roles",
	"/portal/apps/system/org-user/teachers",
	"/portal/apps/system/org-user/students",
	"/portal/apps/system/org-user/graduates",
	"/portal/apps/system/org-user/positions",
	"/portal/apps/system/org-user/fields",
	"/portal/apps/system/org-user/relations",
	"/portal/apps/system/logs/login",
	"/portal/apps/system/logs/operation",
}

// aiMenus AI 智能服务平台菜单（前台入口 + 管理）。
var aiMenus = []string{
	"/portal/apps/ai",
	"/portal/apps/ai/landing",
	"/portal/apps/ai/chat",
	"/portal/apps/ai/admin/reviews",
	"/portal/apps/ai/admin/integrations",
}

// workspaceMenus 门户服务台菜单。
var workspaceMenus = []string{"/portal/workspace"}

// allManageMenus 全部业务管理菜单并集（参考数据等跨模块只读接口的授权面）。
func allManageMenus() []string {
	var out []string
	seen := map[string]bool{}
	for _, m := range [][]string{
		jobManageMenus, sceneManageMenus, lessonManageMenus,
		evaluationManageMenus, libraryManageMenus, affairsManageMenus,
		allianceManageMenus, workflowMenus, systemMenus, aiMenus,
	} {
		for _, p := range m {
			if !seen[p] {
				seen[p] = true
				out = append(out, p)
			}
		}
	}
	return out
}

// importExportMenus 导入/导出/模板下载的菜单授权面：任一业务管理菜单即可
// （导入导出按实体对应各模块，handler 内另有模块级校验）。
func importExportMenus() []string {
	var out []string
	for _, m := range [][]string{
		jobManageMenus, sceneManageMenus, lessonManageMenus,
		evaluationManageMenus, libraryManageMenus, affairsManageMenus,
		allianceManageMenus,
	} {
		out = append(out, m...)
	}
	return out
}

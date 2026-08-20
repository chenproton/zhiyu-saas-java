package org.dromara.zhiyu.core.security;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * zhiyu 服务端授权规则表（/api/v1/**），与 Go 端 router/routes*.go 的
 * RequireMenu / RequirePlatform / RequireAnyPlatform / RequireRole(adminOnly) /
 * RequireSystemPermission / RequireUserRead / RequireRoleOrMenu 挂载点逐一等价。
 *
 * <p>规则按「首个命中生效」匹配（method + path 模式），等价于 Go chi 注册序 +
 * 同 method+path 后注册顶替先注册后的<strong>有效授权面</strong>。维护规则：</p>
 * <ul>
 *   <li>Go 侧新增/调整 RequireMenu 挂载时，必须同步本表（对照清单见各类 SECTION 注释，
 *       标注 Go 源文件与行号）；</li>
 *   <li>窄授权规则必须排在同前缀宽授权规则之前（如 citation-stats 管理面规则先于
 *       跨模块只读宽授权规则）；</li>
 *   <li>未命中任何规则的 /api/v1/** 路径按「portal 平台 + 已登录」兜底（等价 Go
 *       门户平台组内无额外授权的登录态接口，如 /ai/chat、/alliance/public/*）。</li>
 * </ul>
 *
 * @author zhiyu
 */
public final class ZhiyuAuthzRules {

    private ZhiyuAuthzRules() {
    }

    // ===== 平台常量（对齐 Go domain.UserPlatform*）=====
    public static final String PLATFORM_PORTAL = "portal";
    public static final String PLATFORM_SAAS = "saas";
    public static final String PLATFORM_PARTNER = "partner";

    // ===== 角色常量（对齐 Go domain.Role*）=====
    public static final String ROLE_PLATFORM_ADMIN = "platform_admin";
    public static final String ROLE_SCHOOL_ADMIN = "school_admin";
    public static final String ROLE_TEACHER = "teacher";
    public static final String ROLE_STUDENT = "student";
    public static final String ROLE_ENTERPRISE_MENTOR = "enterprise_mentor";
    public static final String ROLE_ENTERPRISE_ADMIN = "enterprise_admin";
    public static final String ROLE_ENTERPRISE_MEMBER = "enterprise_member";

    private static final Set<String> PORTAL_ONLY = Set.of(PLATFORM_PORTAL);
    private static final Set<String> SAAS_ONLY = Set.of(PLATFORM_SAAS);
    private static final Set<String> PARTNER_ONLY = Set.of(PLATFORM_PARTNER);
    private static final Set<String> PORTAL_OR_PARTNER = Set.of(PLATFORM_PORTAL, PLATFORM_PARTNER);

    private static final Set<String> GET_ONLY = Set.of("GET");
    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");

    /** 授权判定种类（对应 Go 各中间件）。 */
    public enum Kind {
        /** 已登录即可（Go 平台组内无额外授权的接口） */
        AUTHENTICATED,
        /** 菜单驱动授权（Go RequireMenu）：菜单授权覆盖任一所需菜单路径 */
        MENU,
        /** 系统管理（Go RequireSystemPermission）：系统权限 或 school_admin/platform_admin */
        SYSTEM_PERMISSION,
        /** 用户读取（Go RequireUserRead）：系统权限 或 teacher/school_admin/enterprise_mentor/platform_admin */
        USER_READ,
        /** 角色白名单（Go RequireRole） */
        ROLE,
        /** 角色或只读菜单桥接（Go RequireRoleOrMenu：写操作必须走角色绑定） */
        ROLE_OR_MENU
    }

    /** 单条规则的授权要求。 */
    public record Requirement(Kind kind, Set<String> platforms, List<String> menus, List<String> roles) {
    }

    private record Rule(Set<String> methods, String pattern, Requirement requirement) {
        boolean matches(String method, String path) {
            return (methods == null || methods.contains(method)) && matchPath(pattern, path);
        }
    }

    /** 判定结果。 */
    public enum Outcome {
        ALLOW,
        /** 未登录（对齐 Go 各中间件 claims==nil → 401 {"error":"unauthorized"}） */
        UNAUTHORIZED,
        /** 无权限（对齐 Go 403 {"error":"permission denied"}） */
        FORBIDDEN_PERMISSION,
        /** 跨平台（对齐 Go 403 {"error":"platform mismatch"}） */
        FORBIDDEN_PLATFORM
    }

    // ---------- 规则构造辅助 ----------

    private static Rule rule(Set<String> methods, String pattern, Kind kind, Set<String> platforms,
                             List<String> menus, List<String> roles) {
        return new Rule(methods, pattern, new Requirement(kind, platforms, menus, roles));
    }

    /** portal 平台 + 已登录 */
    private static Rule portalAuth(Set<String> methods, String pattern) {
        return rule(methods, pattern, Kind.AUTHENTICATED, PORTAL_ONLY, null, null);
    }

    /** portal 平台 + 菜单授权 */
    private static Rule portalMenu(Set<String> methods, String pattern, List<String> menus) {
        return rule(methods, pattern, Kind.MENU, PORTAL_ONLY, menus, null);
    }

    /** portal 平台 + 系统管理权限 */
    private static Rule portalSystem(Set<String> methods, String pattern) {
        return rule(methods, pattern, Kind.SYSTEM_PERMISSION, PORTAL_ONLY, null, null);
    }

    // ---------- 规则表（首个命中生效；顺序即语义，调整需对照 Go 注册序）----------

    private static final List<Rule> RULES = buildRules();

    private static List<Rule> buildRules() {
        List<Rule> rules = new ArrayList<>();
        List<String> allManagePlusLandings = ZhiyuMenuCatalog.allManagePlusLandings();
        List<String> importExportMenus = ZhiyuMenuCatalog.importExportMenus();

        // ===== SECTION A：多平台与平台隔离（Go routes.go:84/92/338/352）=====
        // 文件上传/预览/签名 URL：单点注册 + portal/partner 双平台白名单（Go routes.go:83-88）
        rules.add(rule(null, "/api/v1/files/upload", Kind.AUTHENTICATED, PORTAL_OR_PARTNER, null, null));
        rules.add(rule(null, "/api/v1/files/preview", Kind.AUTHENTICATED, PORTAL_OR_PARTNER, null, null));
        rules.add(rule(null, "/api/v1/files/sign-url", Kind.AUTHENTICATED, PORTAL_OR_PARTNER, null, null));
        // SaaS 运营端（Go routes.go:336-348）：/auth/me、/auth/saas/me 任意 saas 登录用户
        rules.add(rule(GET_ONLY, "/api/v1/auth/me", Kind.AUTHENTICATED, SAAS_ONLY, null, null));
        rules.add(rule(GET_ONLY, "/api/v1/auth/saas/me", Kind.AUTHENTICATED, SAAS_ONLY, null, null));
        // 超管控制台：saas 平台 + platform_admin 角色（Go registerSuperAdminRoutes，routes.go:343-347/358-392）
        rules.add(rule(null, "/api/v1/admin/**", Kind.ROLE, SAAS_ONLY, null, List.of(ROLE_PLATFORM_ADMIN)));
        // Partner 企业端自我信息：任意 partner 登录用户（Go routes_partner.go:17）
        rules.add(rule(GET_ONLY, "/api/v1/auth/partner/me", Kind.AUTHENTICATED, PARTNER_ONLY, null, null));

        // ===== SECTION B：Partner 企业端（Go routes_partner.go）=====
        // 专家本人档案 /me：admin+member 均可（Go routes_partner.go:24-25；须先于 /experts/* 管理员规则）
        rules.add(rule(null, "/api/v1/partner/experts/me", Kind.ROLE, PARTNER_ONLY, null,
            List.of(ROLE_ENTERPRISE_ADMIN, ROLE_ENTERPRISE_MEMBER)));
        // adminOnly 组（Go routes_partner.go:95-104，7 个写/管理接口，仅 enterprise_admin）
        rules.add(rule(Set.of("PUT"), "/api/v1/partner/enterprise/profile", Kind.ROLE, PARTNER_ONLY, null,
            List.of(ROLE_ENTERPRISE_ADMIN)));
        rules.add(rule(Set.of("PUT"), "/api/v1/partner/schools/*/status", Kind.ROLE, PARTNER_ONLY, null,
            List.of(ROLE_ENTERPRISE_ADMIN)));
        rules.add(rule(null, "/api/v1/partner/experts", Kind.ROLE, PARTNER_ONLY, null,
            List.of(ROLE_ENTERPRISE_ADMIN)));
        rules.add(rule(null, "/api/v1/partner/experts/*", Kind.ROLE, PARTNER_ONLY, null,
            List.of(ROLE_ENTERPRISE_ADMIN)));
        // partnerUser 组（Go routes_partner.go:20-92）：读 + 个人操作 + 资源共建/就业服务
        rules.add(rule(null, "/api/v1/partner/**", Kind.ROLE, PARTNER_ONLY, null,
            List.of(ROLE_ENTERPRISE_ADMIN, ROLE_ENTERPRISE_MEMBER)));

        // ===== SECTION C：portal 平台「登录即可」接口（无菜单门，Go 注册于门户平台组根部）=====
        // Go routes.go:98-99 /auth/portal/me、/subscriptions
        rules.add(portalAuth(GET_ONLY, "/api/v1/auth/portal/me"));
        rules.add(portalAuth(GET_ONLY, "/api/v1/subscriptions"));
        // Go registerLandingRoutes（routes.go:475-477）
        rules.add(portalAuth(GET_ONLY, "/api/v1/job/landing/target-positions"));
        // Go routes.go:104-107 AI 对话/辅助编写：租户内任意登录用户
        rules.add(portalAuth(Set.of("POST"), "/api/v1/ai/chat"));
        rules.add(portalAuth(Set.of("POST"), "/api/v1/ai/position-assist"));
        rules.add(portalAuth(Set.of("POST"), "/api/v1/ai/scenario-assist"));
        // Go routes.go:112-113 联盟公开前台：登录公开，不受菜单限制（spec 02 §1.9）
        rules.add(portalAuth(null, "/api/v1/alliance/public"));
        rules.add(portalAuth(null, "/api/v1/alliance/public/**"));
        // Go routes.go:326-328 节次定义：登录公开只读（学生/教师课表渲染共用）
        rules.add(portalAuth(GET_ONLY, "/api/v1/affairs/period-slots"));
        // Go routes.go:330-333 本租户详情只读：任何登录用户可读本租户（handler 强制归属）
        rules.add(portalAuth(GET_ONLY, "/api/v1/tenants/*"));
        // Go routes_ai_center.go 用户端：任意登录角色可用（可见性在 service 层判定）
        rules.add(portalAuth(null, "/api/v1/ai/kb"));
        rules.add(portalAuth(null, "/api/v1/ai/kb/**"));
        rules.add(portalAuth(null, "/api/v1/ai/agents"));
        rules.add(portalAuth(null, "/api/v1/ai/agents/**"));
        rules.add(portalAuth(null, "/api/v1/ai/conversations"));
        rules.add(portalAuth(null, "/api/v1/ai/conversations/**"));
        rules.add(portalAuth(null, "/api/v1/ai/yiknow"));
        rules.add(portalAuth(null, "/api/v1/ai/yiknow/**"));
        rules.add(portalAuth(GET_ONLY, "/api/v1/ai/square/kbs"));
        rules.add(portalAuth(GET_ONLY, "/api/v1/ai/square/agents"));
        rules.add(portalAuth(GET_ONLY, "/api/v1/ai/integrations"));

        // ===== SECTION D：AI 管理端（Go routes_ai_center.go:61-71 菜单驱动 RBAC）=====
        rules.add(portalMenu(null, "/api/v1/ai/admin", ZhiyuMenuCatalog.AI_ADMIN_MENUS));
        rules.add(portalMenu(null, "/api/v1/ai/admin/**", ZhiyuMenuCatalog.AI_ADMIN_MENUS));

        // ===== SECTION E：系统管理面（Go RequireSystemPermission，routes.go:190-194 + registerPortalRoutes）=====
        // Go registerPortalRoutes:584-586（GET /tenants/{id} 被后注册覆盖为登录公开，见 SECTION C）
        rules.add(portalSystem(GET_ONLY, "/api/v1/tenants"));
        rules.add(portalSystem(Set.of("PUT"), "/api/v1/tenants/*"));
        // 租户 AI 服务配置与用量（Go registerPortalRoutes:589-592）
        rules.add(portalSystem(null, "/api/v1/ai/config"));
        rules.add(portalSystem(GET_ONLY, "/api/v1/ai/usage"));
        // 租户管理员管理（Go registerPortalRoutes:594-598）
        rules.add(portalSystem(null, "/api/v1/admins"));
        rules.add(portalSystem(null, "/api/v1/admins/**"));
        // 组织/组织类型/专业/行业写操作（Go registerPortalRoutes:600-611/651-657；
        // GET 已被后注册覆盖为 allManageMenus 只读面，见 SECTION G）
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/organizations"));
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/organizations/**"));
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/org-types"));
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/org-types/**"));
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/majors"));
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/majors/**"));
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/industries"));
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/industries/**"));
        // 用户管理写操作（Go registerPortalRoutes:613-622；GET 为 RequireUserRead，见 SECTION F）
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/users"));
        rules.add(portalSystem(WRITE_METHODS, "/api/v1/users/**"));
        // 教职工职称/扩展字段/关系/角色/资源编码/日志（Go registerPortalRoutes:624-666）
        rules.add(portalSystem(null, "/api/v1/staff-titles"));
        rules.add(portalSystem(null, "/api/v1/staff-titles/**"));
        rules.add(portalSystem(null, "/api/v1/user-extension-fields"));
        rules.add(portalSystem(null, "/api/v1/user-extension-fields/**"));
        rules.add(portalSystem(null, "/api/v1/user-relations"));
        rules.add(portalSystem(null, "/api/v1/user-relations/**"));
        rules.add(portalSystem(null, "/api/v1/roles"));
        rules.add(portalSystem(null, "/api/v1/roles/**"));
        rules.add(portalSystem(null, "/api/v1/resource-codes"));
        rules.add(portalSystem(null, "/api/v1/resource-codes/**"));
        rules.add(portalSystem(null, "/api/v1/logs/**"));

        // ===== SECTION F：用户列表/详情读取（Go RequireUserRead，routes.go:196-201）=====
        rules.add(rule(GET_ONLY, "/api/v1/users", Kind.USER_READ, PORTAL_ONLY, null, null));
        rules.add(rule(GET_ONLY, "/api/v1/users/*", Kind.USER_READ, PORTAL_ONLY, null, null));

        // ===== SECTION G：参考数据只读（Go routes.go:236-248 RequireMenu(allManageMenus)）=====
        rules.add(portalMenu(GET_ONLY, "/api/v1/majors", ZhiyuMenuCatalog.allManageMenus()));
        rules.add(portalMenu(GET_ONLY, "/api/v1/majors/*", ZhiyuMenuCatalog.allManageMenus()));
        rules.add(portalMenu(GET_ONLY, "/api/v1/industries", ZhiyuMenuCatalog.allManageMenus()));
        rules.add(portalMenu(GET_ONLY, "/api/v1/industries/*", ZhiyuMenuCatalog.allManageMenus()));
        rules.add(portalMenu(GET_ONLY, "/api/v1/organizations", ZhiyuMenuCatalog.allManageMenus()));
        rules.add(portalMenu(GET_ONLY, "/api/v1/organizations/tree", ZhiyuMenuCatalog.allManageMenus()));
        rules.add(portalMenu(GET_ONLY, "/api/v1/organizations/*", ZhiyuMenuCatalog.allManageMenus()));
        rules.add(portalMenu(GET_ONLY, "/api/v1/org-types", ZhiyuMenuCatalog.allManageMenus()));
        rules.add(portalMenu(GET_ONLY, "/api/v1/org-types/*", ZhiyuMenuCatalog.allManageMenus()));

        // ===== SECTION H：导入/导出/模板（Go routes.go:116-119 + registerImportExportRoutes）=====
        // affairs 专属导入导出注册在 affairs 管理组内（Go routes_affairs.go:66-78），
        // 授权面为教务管理菜单，须先于通用导入导出规则
        rules.add(portalMenu(null, "/api/v1/import/schedules/*", ZhiyuMenuCatalog.AFFAIRS_MANAGE_MENUS));
        rules.add(portalMenu(null, "/api/v1/import/program-courses/*", ZhiyuMenuCatalog.AFFAIRS_MANAGE_MENUS));
        rules.add(portalMenu(GET_ONLY, "/api/v1/templates/program-courses", ZhiyuMenuCatalog.AFFAIRS_MANAGE_MENUS));
        rules.add(portalMenu(null, "/api/v1/import/affairs-config/*", ZhiyuMenuCatalog.AFFAIRS_MANAGE_MENUS));
        rules.add(portalMenu(GET_ONLY, "/api/v1/templates/affairs-config", ZhiyuMenuCatalog.AFFAIRS_MANAGE_MENUS));
        // 通用导入导出：任一业务管理菜单（学生不可访问）
        rules.add(portalMenu(null, "/api/v1/export/**", importExportMenus));
        rules.add(portalMenu(null, "/api/v1/import/**", importExportMenus));
        rules.add(portalMenu(null, "/api/v1/templates/**", importExportMenus));

        // ===== SECTION I：门户级工作流/审批（Go routes.go:121-125 RequireMenu(workflowMenus)）=====
        rules.add(portalMenu(null, "/api/v1/workflows", ZhiyuMenuCatalog.WORKFLOW_MENUS));
        rules.add(portalMenu(null, "/api/v1/workflows/**", ZhiyuMenuCatalog.WORKFLOW_MENUS));
        rules.add(portalMenu(null, "/api/v1/approvals", ZhiyuMenuCatalog.WORKFLOW_MENUS));
        rules.add(portalMenu(null, "/api/v1/approvals/**", ZhiyuMenuCatalog.WORKFLOW_MENUS));

        // ===== SECTION J：服务台/学习社区（Go RequireRoleOrMenu，routes.go:127-147）=====
        // 角色（teacher/student/school_admin）直放行；菜单权限桥接仅限只读方法，
        // 写操作必须走角色绑定（Go rbac.go:56-62 防"有任意菜单即可操作全量写"绕过）
        rules.add(rule(null, "/api/v1/portal/workspace/**", Kind.ROLE_OR_MENU, PORTAL_ONLY, null,
            List.of(ROLE_TEACHER, ROLE_STUDENT, ROLE_SCHOOL_ADMIN)));
        rules.add(rule(null, "/api/v1/portal/community/**", Kind.ROLE_OR_MENU, PORTAL_ONLY, null,
            List.of(ROLE_TEACHER, ROLE_STUDENT, ROLE_SCHOOL_ADMIN)));

        // ===== SECTION K：收藏（Go routes.go:149-160 任一业务管理/落地页菜单）=====
        rules.add(portalMenu(null, "/api/v1/favorites", allManagePlusLandings));
        rules.add(portalMenu(null, "/api/v1/favorites/**", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/positions/favorites", allManagePlusLandings));
        rules.add(portalMenu(null, "/api/v1/job/positions/*/favorite", allManagePlusLandings));

        // ===== SECTION L：模块只读面与管理面（Go routes.go:203-324；窄授权先于宽授权，宽授权先于管理面）=====

        // ---- job 模块 ----
        // 只读面（Go routes.go:255-271：jobManageMenus ∪ /job/landing）
        List<String> jobRead = ZhiyuMenuCatalog.managePlusLanding(ZhiyuMenuCatalog.JOB_MANAGE_MENUS, "/job/landing");
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/public/positions", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/public/positions/*", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/abilities/citation-stats", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/abilities/uncited", jobRead));
        // 跨模块只读引用（Go routes.go:166-188：allManageMenus ∪ 落地页；须先于管理面）
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/abilities", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/abilities/*", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/position-responsibilities", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/position-responsibilities/*", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/position-abilities", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/position-abilities/*", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/ability-domains", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/ability-domains/*", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/position-certificates", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/position-certificates/*", jobRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/job/positions/*/snapshot", jobRead));
        // 管理面（Go routes.go:204-207 RequireMenu(jobManageMenus) + registerJobRoutes）
        rules.add(portalMenu(null, "/api/v1/job/**", ZhiyuMenuCatalog.JOB_MANAGE_MENUS));

        // ---- scene 模块 ----
        List<String> sceneRead = ZhiyuMenuCatalog.managePlusLanding(ZhiyuMenuCatalog.SCENE_MANAGE_MENUS, "/scene/landing");
        rules.add(portalMenu(GET_ONLY, "/api/v1/scene/scenarios", sceneRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/scene/scenarios/**", sceneRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/scene/tasks/*/evaluation-methods", sceneRead));
        // 跨模块只读引用：场景任务列表（Go routes.go:183-184）
        rules.add(portalMenu(GET_ONLY, "/api/v1/scene/tasks", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/scene/tasks/*", allManagePlusLandings));
        rules.add(portalMenu(null, "/api/v1/scene/**", ZhiyuMenuCatalog.SCENE_MANAGE_MENUS));

        // ---- lesson 模块 ----
        List<String> lessonRead = ZhiyuMenuCatalog.managePlusLanding(ZhiyuMenuCatalog.LESSON_MANAGE_MENUS, "/lesson/landing");
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/courses/*/snapshot", lessonRead));
        // 跨模块只读引用：课程/知识点列表（Go routes.go:171-174）
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/courses", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/courses/*", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/knowledge-points/citation-stats", lessonRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/knowledge-points/uncited", lessonRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/knowledge-points", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/knowledge-points/*", allManagePlusLandings));
        // 体系课学习页（Go routes.go:285-295）：节点只读 + 学生提交测评结果
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/nodes", lessonRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/nodes/*", lessonRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/lesson/node-evaluation-results", lessonRead));
        rules.add(portalMenu(Set.of("POST"), "/api/v1/lesson/node-evaluation-results", lessonRead));
        rules.add(portalMenu(null, "/api/v1/lesson/**", ZhiyuMenuCatalog.LESSON_MANAGE_MENUS));

        // ---- evaluation 模块 ----
        List<String> evaluationRead =
            ZhiyuMenuCatalog.managePlusLanding(ZhiyuMenuCatalog.EVALUATION_MANAGE_MENUS, "/evaluation/landing");
        // 只读面（Go routes.go:297-314）：测评结果/考试/画像（学生提交本人结果）
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/results", evaluationRead));
        rules.add(portalMenu(Set.of("POST"), "/api/v1/evaluation/results", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/job-ability/results", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/job-ability/course-scores", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/exams", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/exams/**", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/question-banks/*/snapshot", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/exam-usages", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/exam-usages/*", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/exam-center", evaluationRead));
        rules.add(portalMenu(Set.of("POST"), "/api/v1/evaluation/exam-results", evaluationRead));
        // 画像归档为管理面（Go registerEvaluationRoutes:80-82），须先于画像只读通配
        rules.add(portalMenu(null, "/api/v1/evaluation/portraits/archives", ZhiyuMenuCatalog.EVALUATION_MANAGE_MENUS));
        rules.add(portalMenu(null, "/api/v1/evaluation/portraits/archives/*", ZhiyuMenuCatalog.EVALUATION_MANAGE_MENUS));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/portraits", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/portraits/student-dashboard", evaluationRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/evaluation/portraits/*", evaluationRead));
        rules.add(portalMenu(null, "/api/v1/evaluation/**", ZhiyuMenuCatalog.EVALUATION_MANAGE_MENUS));

        // ---- library 模块 ----
        List<String> libraryRead = ZhiyuMenuCatalog.managePlusLanding(ZhiyuMenuCatalog.LIBRARY_MANAGE_MENUS, "/library/landing");
        // 引用统计仅管理面（Go routes_library.go:10-11），须先于跨模块只读宽授权
        rules.add(portalMenu(GET_ONLY, "/api/v1/library/resources/citation-stats", ZhiyuMenuCatalog.LIBRARY_MANAGE_MENUS));
        rules.add(portalMenu(GET_ONLY, "/api/v1/library/resources/uncited", ZhiyuMenuCatalog.LIBRARY_MANAGE_MENUS));
        // 跨模块只读引用：资源库列表（Go routes.go:179-181）
        rules.add(portalMenu(GET_ONLY, "/api/v1/library/resources", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/library/resources/stats", allManagePlusLandings));
        rules.add(portalMenu(GET_ONLY, "/api/v1/library/resources/*", allManagePlusLandings));
        // 只读面（Go routes.go:316-324）：资源标签批量查询 + 现场问题库浏览
        rules.add(portalMenu(Set.of("POST"), "/api/v1/library/resource-tags/query", libraryRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/library/on-site-questions", libraryRead));
        rules.add(portalMenu(GET_ONLY, "/api/v1/library/on-site-questions/*", libraryRead));
        rules.add(portalMenu(null, "/api/v1/library/**", ZhiyuMenuCatalog.LIBRARY_MANAGE_MENUS));

        // ---- alliance 模块 ----
        // 字典只读为跨模块引用面（Go routes.go:185-187：登录后全局注册字典标签）；
        // 写操作留在联盟管理面（Go routes.go:546-548）
        rules.add(portalMenu(GET_ONLY, "/api/v1/alliance/dictionaries/*", allManagePlusLandings));
        // 管理面（Go routes.go:228-234 RequireMenu(allianceManageMenus) + registerAllianceRoutes；
        // 写操作 handler 层另有 canManageAlliance 纵深防御：写授权面仅联盟管理菜单，
        // 仅勾前台落地页 /portal/alliance/landing 的角色不获联盟 CRUD 写权限）
        rules.add(portalMenu(null, "/api/v1/alliance/**", ZhiyuMenuCatalog.ALLIANCE_MANAGE_MENUS));

        // ---- affairs 模块（Go routes.go:224-227 RequireMenu(affairsManageMenus) + routes_affairs.go 全量写接口）----
        rules.add(portalMenu(null, "/api/v1/affairs/**", ZhiyuMenuCatalog.AFFAIRS_MANAGE_MENUS));

        return List.copyOf(rules);
    }

    /** 兜底要求：portal 平台 + 已登录（等价 Go 门户平台组内无额外授权的登录态接口）。 */
    private static final Requirement DEFAULT =
        new Requirement(Kind.AUTHENTICATED, PORTAL_ONLY, null, null);

    /**
     * 查找指定 method+path 的有效授权要求（首个命中生效；未命中返回兜底要求）。
     */
    public static Requirement decide(String method, String path) {
        for (Rule rule : RULES) {
            if (rule.matches(method, path)) {
                return rule.requirement();
            }
        }
        return DEFAULT;
    }

    /**
     * 按授权要求评估一次请求（对齐 Go 各中间件的判定与响应码）。
     *
     * @param req      授权要求（{@link #decide} 结果）
     * @param method   HTTP 方法
     * @param userId   当前用户 ID（未登录为 null）
     * @param platform 当前平台（portal/saas/partner）
     * @param snapshot 当前用户授权快照
     */
    public static Outcome evaluate(Requirement req, String method, String userId, String platform,
                                   AuthzSnapshot snapshot) {
        if (userId == null || userId.isBlank()) {
            return Outcome.UNAUTHORIZED;
        }
        if (!req.platforms().contains(platform)) {
            return Outcome.FORBIDDEN_PLATFORM;
        }
        return switch (req.kind()) {
            case AUTHENTICATED -> Outcome.ALLOW;
            case MENU -> snapshot.coversAny(req.menus()) ? Outcome.ALLOW : Outcome.FORBIDDEN_PERMISSION;
            case SYSTEM_PERMISSION ->
                snapshot.hasSystemPermission() || snapshot.hasRole(ROLE_SCHOOL_ADMIN)
                    || snapshot.hasRole(ROLE_PLATFORM_ADMIN) ? Outcome.ALLOW : Outcome.FORBIDDEN_PERMISSION;
            case USER_READ ->
                snapshot.hasSystemPermission() || snapshot.hasRole(ROLE_TEACHER)
                    || snapshot.hasRole(ROLE_SCHOOL_ADMIN) || snapshot.hasRole(ROLE_ENTERPRISE_MENTOR)
                    || snapshot.hasRole(ROLE_PLATFORM_ADMIN) ? Outcome.ALLOW : Outcome.FORBIDDEN_PERMISSION;
            case ROLE -> {
                for (String code : req.roles()) {
                    if (snapshot.hasRole(code)) {
                        yield Outcome.ALLOW;
                    }
                }
                yield Outcome.FORBIDDEN_PERMISSION;
            }
            case ROLE_OR_MENU -> {
                for (String code : req.roles()) {
                    if (snapshot.hasRole(code)) {
                        yield Outcome.ALLOW;
                    }
                }
                // 菜单权限放行仅限只读请求（对齐 Go rbac.go:56-62）
                yield isReadOnlyMethod(method) && snapshot.hasAnyMenuPermission()
                    ? Outcome.ALLOW : Outcome.FORBIDDEN_PERMISSION;
            }
        };
    }

    /** 判断 HTTP 方法是否为只读（对齐 Go isReadOnlyMethod）。 */
    public static boolean isReadOnlyMethod(String method) {
        return "GET".equals(method) || "HEAD".equals(method) || "OPTIONS".equals(method);
    }

    /**
     * 路径模式匹配：{@code *} 匹配单段、{@code **} 匹配任意剩余段，其余逐段相等。
     */
    static boolean matchPath(String pattern, String path) {
        String[] p = pattern.split("/");
        String[] s = path.split("/");
        int i = 0;
        int j = 0;
        while (i < p.length) {
            if ("**".equals(p[i])) {
                return true;
            }
            if (j >= s.length) {
                return false;
            }
            if (!"*".equals(p[i]) && !p[i].equals(s[j])) {
                return false;
            }
            i++;
            j++;
        }
        return j == s.length;
    }
}

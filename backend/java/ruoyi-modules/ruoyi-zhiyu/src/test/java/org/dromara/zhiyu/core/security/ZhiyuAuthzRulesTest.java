package org.dromara.zhiyu.core.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.dromara.zhiyu.core.security.ZhiyuAuthzRules.Outcome.ALLOW;
import static org.dromara.zhiyu.core.security.ZhiyuAuthzRules.Outcome.FORBIDDEN_PERMISSION;
import static org.dromara.zhiyu.core.security.ZhiyuAuthzRules.Outcome.FORBIDDEN_PLATFORM;
import static org.dromara.zhiyu.core.security.ZhiyuAuthzRules.Outcome.UNAUTHORIZED;

/**
 * {@link ZhiyuAuthzRules} 授权判定矩阵单测：逐条对齐 Go 端判定矩阵——
 * <ul>
 *   <li>middleware/menu_test.go（RequireMenu 授权矩阵 + 跨模块只读引用回归）；</li>
 *   <li>middleware/platform_test.go（RequirePlatform 平台隔离矩阵）；</li>
 *   <li>middleware/rbac.go（RequireSystemPermission / RequireUserRead / RequireRoleOrMenu）；</li>
 *   <li>router/routes_partner.go:95-104（adminOnly 组）；</li>
 *   <li>handler/ai_center_menu_auth_test.go（AI 管理端菜单驱动授权）。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Tag("local")
@Tag("dev")
@DisplayName("服务端授权规则判定矩阵（对齐 Go routes*.go 挂载点）")
class ZhiyuAuthzRulesTest {

    // ---------- 快照构造辅助 ----------

    private static AuthzSnapshot snapshot(List<String> roleCodes, String... menus) {
        MenuGrant g = new MenuGrant();
        if (menus.length > 0) {
            Map<String, Object> m = new HashMap<>();
            for (String p : menus) {
                m.put(p, true);
            }
            g.merge(Map.of("menus", m));
        }
        return new AuthzSnapshot(roleCodes, g);
    }

    private static AuthzSnapshot adminSnapshot(List<String> roleCodes) {
        MenuGrant g = new MenuGrant();
        g.merge(Map.of("admin", true));
        return new AuthzSnapshot(roleCodes, g);
    }

    private static AuthzSnapshot menusOnly(String... menus) {
        return snapshot(List.of(), menus);
    }

    private static ZhiyuAuthzRules.Outcome eval(String method, String path, String userId, String platform,
                                                AuthzSnapshot snapshot) {
        ZhiyuAuthzRules.Requirement req = ZhiyuAuthzRules.decide(method, path);
        return ZhiyuAuthzRules.evaluate(req, method, userId, platform, snapshot);
    }

    // ---------- 平台隔离（platform_test.go TestRequirePlatform）----------

    @Test
    @DisplayName("匹配平台放行 / 跨平台拒绝（portal/saas 双向）")
    void platformIsolation() {
        AuthzSnapshot snap = menusOnly("/job/positions");
        assertEquals(ALLOW, eval("GET", "/api/v1/job/positions", "u1", "portal", snap));
        assertEquals(FORBIDDEN_PLATFORM, eval("GET", "/api/v1/job/positions", "u1", "saas", snap));
        assertEquals(FORBIDDEN_PLATFORM, eval("GET", "/api/v1/job/positions", "u1", "partner", snap));
        // saas 端接口
        assertEquals(ALLOW, eval("GET", "/api/v1/auth/saas/me", "u2", "saas", AuthzSnapshot.empty()));
        assertEquals(FORBIDDEN_PLATFORM, eval("GET", "/api/v1/auth/saas/me", "u2", "portal", AuthzSnapshot.empty()));
        // partner 端接口
        AuthzSnapshot member = snapshot(List.of("enterprise_member"));
        assertEquals(ALLOW, eval("GET", "/api/v1/partner/schools", "u3", "partner", member));
        assertEquals(FORBIDDEN_PLATFORM, eval("GET", "/api/v1/partner/schools", "u3", "portal", member));
    }

    @Test
    @DisplayName("文件上传/预览/签名 URL：portal+partner 双平台白名单（routes.go:83-88）")
    void filesAnyPlatform() {
        AuthzSnapshot snap = AuthzSnapshot.empty();
        assertEquals(ALLOW, eval("POST", "/api/v1/files/upload", "u", "portal", snap));
        assertEquals(ALLOW, eval("POST", "/api/v1/files/upload", "u", "partner", snap));
        assertEquals(FORBIDDEN_PLATFORM, eval("POST", "/api/v1/files/upload", "u", "saas", snap));
        assertEquals(ALLOW, eval("GET", "/api/v1/files/sign-url", "u", "partner", snap));
    }

    @Test
    @DisplayName("无登录 401（对齐 Go 各中间件 claims==nil）")
    void unauthenticated() {
        assertEquals(UNAUTHORIZED, eval("GET", "/api/v1/alliance/brands", null, "portal", AuthzSnapshot.empty()));
        assertEquals(UNAUTHORIZED, eval("GET", "/api/v1/test", null, null, AuthzSnapshot.empty()));
    }

    // ---------- RequireMenu 授权矩阵（menu_test.go TestRequireMenu_GrantMatrix）----------

    @Test
    @DisplayName("勾选 brands 菜单放行 brands API")
    void grantedBrandsAllows() {
        assertEquals(ALLOW, eval("GET", "/api/v1/alliance/brands", "u1", "portal",
            menusOnly("/portal/apps/alliance/brands")));
    }

    @Test
    @DisplayName("勾选 brands/employer 子菜单放行父 API")
    void grantedChildAllowsParentApi() {
        assertEquals(ALLOW, eval("GET", "/api/v1/alliance/brands", "u2", "portal",
            menusOnly("/portal/apps/alliance/brands/employer")));
    }

    @Test
    @DisplayName("未勾选对应菜单拒绝 403")
    void unrelatedMenuDenied() {
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/alliance/brands", "u3", "portal",
            menusOnly("/job/positions")));
    }

    @Test
    @DisplayName("menus 缺失 fail-closed 拒绝")
    void emptyGrantDenied() {
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/job/positions", "u4", "portal",
            AuthzSnapshot.empty()));
    }

    @Test
    @DisplayName("admin 全量放行")
    void adminAllowsAll() {
        assertEquals(ALLOW, eval("GET", "/api/v1/job/positions", "u5", "portal",
            adminSnapshot(List.of())));
    }

    @Test
    @DisplayName("「无 menus=全量」兜底（menu_test.go TestMenuGrant_FullAccessFallback）")
    void fullAccessFallback() {
        // school_admin 无 menus → 全量放行
        MenuGrant g1 = new MenuGrant();
        ZhiyuAuthzLoader.applyFullAccessFallback(g1, List.of("school_admin"));
        assertTrue(g1.isAdmin());
        // teacher 无 menus → 不兜底
        MenuGrant g2 = new MenuGrant();
        ZhiyuAuthzLoader.applyFullAccessFallback(g2, List.of("teacher"));
        assertFalse(g2.isAdmin());
        // school_admin 显式配置部分菜单 → 按菜单而非全量
        MenuGrant g3 = new MenuGrant();
        g3.merge(Map.of("menus", Map.of("/job/landing", true)));
        ZhiyuAuthzLoader.applyFullAccessFallback(g3, List.of("school_admin"));
        assertFalse(g3.isAdmin());
    }

    // ---------- 跨模块只读引用（menu_test.go TestRequireMenu_CrossModuleReadGrant）----------

    @Test
    @DisplayName("仅勾 /job/landing 可读课程/知识点/能力点/场景任务（岗位知识图谱引用）")
    void jobLandingWideReads() {
        AuthzSnapshot s = menusOnly("/job/landing");
        assertEquals(ALLOW, eval("GET", "/api/v1/lesson/courses", "u", "portal", s));
        assertEquals(ALLOW, eval("GET", "/api/v1/lesson/knowledge-points", "u", "portal", s));
        assertEquals(ALLOW, eval("GET", "/api/v1/job/abilities", "u", "portal", s));
        assertEquals(ALLOW, eval("GET", "/api/v1/scene/tasks", "u", "portal", s));
    }

    @Test
    @DisplayName("仅勾 /scene/landing 可读课程列表与资源库（场景知识图谱/学习页引用）")
    void sceneLandingWideReads() {
        AuthzSnapshot s = menusOnly("/scene/landing");
        assertEquals(ALLOW, eval("GET", "/api/v1/lesson/courses", "u", "portal", s));
        assertEquals(ALLOW, eval("GET", "/api/v1/library/resources", "u", "portal", s));
    }

    @Test
    @DisplayName("仅勾 /library/landing 可读课程列表（资源库关联课程引用）")
    void libraryLandingWideReads() {
        assertEquals(ALLOW, eval("GET", "/api/v1/lesson/courses", "u", "portal",
            menusOnly("/library/landing")));
    }

    @Test
    @DisplayName("仅勾 /evaluation/landing 可读联盟字典（登录后全局注册字典标签）")
    void evaluationLandingReadsAllianceDict() {
        assertEquals(ALLOW, eval("GET", "/api/v1/alliance/dictionaries/project_type", "u", "portal",
            menusOnly("/evaluation/landing")));
    }

    @Test
    @DisplayName("未勾任何业务菜单读跨模块引用拒绝 403（/portal/workspace 不算业务菜单）")
    void workspaceOnlyDeniedWideReads() {
        AuthzSnapshot s = menusOnly("/portal/workspace");
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/alliance/dictionaries/project_type", "u", "portal", s));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/lesson/courses", "u", "portal", s));
    }

    @Test
    @DisplayName("宽只读面不覆盖写操作：/job/landing 用户写课程 403")
    void wideReadDoesNotCoverWrite() {
        AuthzSnapshot s = menusOnly("/job/landing");
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/lesson/courses", "u", "portal", s));
        assertEquals(FORBIDDEN_PERMISSION, eval("PUT", "/api/v1/library/resources/1", "u", "portal", s));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/alliance/dictionaries/project_type", "u", "portal", s));
    }

    // ---------- 窄授权先于宽授权（管理面统计接口不被跨模块宽面覆盖）----------

    @Test
    @DisplayName("资源库引用统计仅 library 管理菜单（窄授权优先于宽只读面）")
    void citationStatsNarrow() {
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/library/resources/citation-stats", "u", "portal",
            menusOnly("/job/landing")));
        assertEquals(ALLOW, eval("GET", "/api/v1/library/resources/citation-stats", "u", "portal",
            menusOnly("/library/knowledge")));
    }

    @Test
    @DisplayName("课程快照为 lesson 只读面：其他落地页不可读")
    void courseSnapshotLessonOnly() {
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/lesson/courses/1/snapshot", "u", "portal",
            menusOnly("/library/landing")));
        assertEquals(ALLOW, eval("GET", "/api/v1/lesson/courses/1/snapshot", "u", "portal",
            menusOnly("/lesson/landing")));
        assertEquals(ALLOW, eval("GET", "/api/v1/lesson/courses/1/snapshot", "u", "portal",
            menusOnly("/lesson/admin/granular")));
    }

    // ---------- 联盟管理面窄授权（routes.go:228-234）----------

    @Test
    @DisplayName("仅勾联盟前台落地页是只读角色：不获联盟管理/写权限")
    void allianceLandingReadonly() {
        AuthzSnapshot s = menusOnly("/portal/alliance/landing");
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/alliance/brands", "u", "portal", s));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/alliance/brands", "u", "portal", s));
        // 联盟公开前台登录公开，不受菜单限制
        assertEquals(ALLOW, eval("GET", "/api/v1/alliance/public/school-info", "u", "portal", AuthzSnapshot.empty()));
        assertEquals(ALLOW, eval("POST", "/api/v1/alliance/public/employment-jobs/1/apply", "u", "portal",
            AuthzSnapshot.empty()));
    }

    @Test
    @DisplayName("联盟管理菜单可管理联盟（写接口放行）")
    void allianceManageAllowsWrites() {
        AuthzSnapshot s = menusOnly("/portal/apps/alliance/brands");
        assertEquals(ALLOW, eval("POST", "/api/v1/alliance/brands", "u", "portal", s));
        assertEquals(ALLOW, eval("PUT", "/api/v1/alliance/school-info", "u", "portal", s));
        assertEquals(ALLOW, eval("DELETE", "/api/v1/alliance/projects/1", "u", "portal", s));
    }

    // ---------- 服务台 RequireRoleOrMenu（rbac.go:42-66）----------

    @Test
    @DisplayName("服务台：teacher/student/school_admin 角色直放行（读写均可）")
    void workspaceRolesAllow() {
        assertEquals(ALLOW, eval("GET", "/api/v1/portal/workspace/dashboard", "u", "portal",
            snapshot(List.of("student"))));
        assertEquals(ALLOW, eval("POST", "/api/v1/portal/workspace/honors", "u", "portal",
            snapshot(List.of("teacher"))));
        assertEquals(ALLOW, eval("POST", "/api/v1/portal/community/topics", "u", "portal",
            snapshot(List.of("school_admin"))));
    }

    @Test
    @DisplayName("服务台：菜单权限桥接仅限只读（写操作必须角色绑定，防授权绕过）")
    void workspaceMenuBridgeReadOnly() {
        AuthzSnapshot s = snapshot(List.of("custom_role"), "/job/positions");
        assertEquals(ALLOW, eval("GET", "/api/v1/portal/workspace/dashboard", "u", "portal", s));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/portal/workspace/honors", "u", "portal", s));
        // 无任何菜单且无角色 → 只读也拒绝
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/portal/workspace/dashboard", "u", "portal",
            snapshot(List.of("enterprise_mentor"))));
    }

    // ---------- 系统管理 RequireSystemPermission（rbac.go:162-177）----------

    @Test
    @DisplayName("系统管理：school_admin/platform_admin 角色兜底放行")
    void systemAdminRoleFallback() {
        assertEquals(ALLOW, eval("GET", "/api/v1/tenants", "u", "portal",
            snapshot(List.of("school_admin"))));
        assertEquals(ALLOW, eval("POST", "/api/v1/users", "u", "portal",
            snapshot(List.of("platform_admin"))));
    }

    @Test
    @DisplayName("系统管理：系统菜单放行；业务菜单永不隐含系统权限")
    void systemMenuGrant() {
        assertEquals(ALLOW, eval("PUT", "/api/v1/tenants/t1", "u", "portal",
            menusOnly("/portal/apps/system/tenant")));
        assertEquals(ALLOW, eval("POST", "/api/v1/users/batch", "u", "portal",
            menusOnly("/portal/apps/system/org-user/accounts")));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/tenants", "u", "portal",
            menusOnly("/job/positions")));
        assertEquals(FORBIDDEN_PERMISSION, eval("PUT", "/api/v1/organizations/o1", "u", "portal",
            menusOnly("/affairs/org-structure")));
        // Go HasSystemPermission：任一 /portal/apps/system 前缀菜单即获系统面访问
        // （RequireSystemPermission 非菜单精确授权），已用 Go 单测实证
        assertEquals(ALLOW, eval("GET", "/api/v1/logs/login", "u", "portal",
            menusOnly("/portal/apps/system/org-user/accounts")));
    }

    @Test
    @DisplayName("本租户详情 GET 登录公开；PUT 仍限系统管理")
    void tenantGetPublicPutSystem() {
        assertEquals(ALLOW, eval("GET", "/api/v1/tenants/t1", "u", "portal",
            snapshot(List.of("student"))));
        assertEquals(FORBIDDEN_PERMISSION, eval("PUT", "/api/v1/tenants/t1", "u", "portal",
            snapshot(List.of("student"))));
    }

    @Test
    @DisplayName("参考数据只读面：任一业务/系统管理菜单可读；写仍限系统管理")
    void referenceDataRead() {
        assertEquals(ALLOW, eval("GET", "/api/v1/organizations/tree", "u", "portal",
            menusOnly("/job/positions")));
        assertEquals(ALLOW, eval("GET", "/api/v1/majors/1", "u", "portal",
            menusOnly("/portal/apps/system/resource/majors")));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/majors", "u", "portal",
            menusOnly("/portal/workspace")));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/majors", "u", "portal",
            menusOnly("/job/positions")));
    }

    // ---------- 用户读 RequireUserRead（rbac.go:183-204）----------

    @Test
    @DisplayName("用户列表读取：业务角色或系统权限；学生拒绝；写仍限系统管理")
    void userRead() {
        assertEquals(ALLOW, eval("GET", "/api/v1/users", "u", "portal", snapshot(List.of("teacher"))));
        assertEquals(ALLOW, eval("GET", "/api/v1/users/u2", "u", "portal",
            snapshot(List.of("enterprise_mentor"))));
        assertEquals(ALLOW, eval("GET", "/api/v1/users", "u", "portal",
            menusOnly("/portal/apps/system/org-user/accounts")));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/users", "u", "portal",
            snapshot(List.of("student"))));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/users/u2/status", "u", "portal",
            snapshot(List.of("teacher"))));
    }

    // ---------- 超管（routes.go:336-348 saas 平台 + platform_admin）----------

    @Test
    @DisplayName("超管控制台：saas 平台 + platform_admin 双重门槛")
    void superAdmin() {
        assertEquals(ALLOW, eval("GET", "/api/v1/admin/tenants", "u", "saas",
            snapshot(List.of("platform_admin"))));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/admin/tenants", "u", "saas",
            snapshot(List.of("school_admin"))));
        assertEquals(FORBIDDEN_PLATFORM, eval("GET", "/api/v1/admin/tenants", "u", "portal",
            snapshot(List.of("platform_admin"))));
    }

    // ---------- partner adminOnly（routes_partner.go:95-104）----------

    @Test
    @DisplayName("partner adminOnly 组：7 个管理接口仅 enterprise_admin")
    void partnerAdminOnly() {
        AuthzSnapshot admin = snapshot(List.of("enterprise_admin"));
        AuthzSnapshot member = snapshot(List.of("enterprise_member"));
        assertEquals(ALLOW, eval("PUT", "/api/v1/partner/enterprise/profile", "u", "partner", admin));
        assertEquals(FORBIDDEN_PERMISSION, eval("PUT", "/api/v1/partner/enterprise/profile", "u", "partner", member));
        assertEquals(ALLOW, eval("PUT", "/api/v1/partner/schools/t1/status", "u", "partner", admin));
        assertEquals(FORBIDDEN_PERMISSION, eval("PUT", "/api/v1/partner/schools/t1/status", "u", "partner", member));
        assertEquals(ALLOW, eval("GET", "/api/v1/partner/experts", "u", "partner", admin));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/partner/experts", "u", "partner", member));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/partner/experts", "u", "partner", member));
        assertEquals(FORBIDDEN_PERMISSION, eval("PUT", "/api/v1/partner/experts/e1", "u", "partner", member));
        assertEquals(FORBIDDEN_PERMISSION, eval("DELETE", "/api/v1/partner/experts/e1", "u", "partner", member));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/partner/experts/e1", "u", "partner", member));
    }

    @Test
    @DisplayName("partner 成员共用接口：admin+member 均可；专家本人档案 /me 不被 adminOnly 拦截")
    void partnerSharedEndpoints() {
        AuthzSnapshot member = snapshot(List.of("enterprise_member"));
        assertEquals(ALLOW, eval("GET", "/api/v1/partner/enterprise/profile", "u", "partner", member));
        assertEquals(ALLOW, eval("GET", "/api/v1/partner/experts/me", "u", "partner", member));
        assertEquals(ALLOW, eval("PUT", "/api/v1/partner/experts/me", "u", "partner", member));
        assertEquals(ALLOW, eval("POST", "/api/v1/partner/employment-jobs", "u", "partner", member));
        assertEquals(ALLOW, eval("POST", "/api/v1/partner/co-build/positions", "u", "partner", member));
        // 无 partner 角色（如 portal 学校账号误持 partner token）→ 拒绝
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/partner/schools", "u", "partner",
            snapshot(List.of("teacher"))));
    }

    // ---------- AI 管理端菜单驱动授权（ai_center_menu_auth_test.go）----------

    @Test
    @DisplayName("AI 管理端：勾选 AI 管理菜单即可审核/挂接，不再限 school_admin 角色")
    void aiAdminMenuDriven() {
        AuthzSnapshot custom = snapshot(List.of("custom_role"),
            "/portal/apps/ai/admin/reviews", "/portal/apps/ai/admin/integrations");
        assertEquals(ALLOW, eval("GET", "/api/v1/ai/admin/reviews", "u", "portal", custom));
        assertEquals(ALLOW, eval("GET", "/api/v1/ai/admin/integrations", "u", "portal", custom));
        assertEquals(ALLOW, eval("POST", "/api/v1/ai/admin/reviews/kb/1/approve", "u", "portal", custom));
        // 未配置其他模块菜单仍拒绝
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/job/positions", "u", "portal", custom));
        // 只勾前台 AI 菜单不获管理权限
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/ai/admin/reviews", "u", "portal",
            menusOnly("/portal/apps/ai/chat")));
        // school_admin 无 menus 兜底全量（admin 视图）
        assertEquals(ALLOW, eval("GET", "/api/v1/ai/admin/reviews", "u", "portal",
            adminSnapshot(List.of("school_admin"))));
    }

    @Test
    @DisplayName("AI 用户端：任意登录角色可用（知识库/智能体/广场/对话）")
    void aiUserSideAuthenticated() {
        AuthzSnapshot noMenus = snapshot(List.of("student"));
        assertEquals(ALLOW, eval("GET", "/api/v1/ai/kb", "u", "portal", noMenus));
        assertEquals(ALLOW, eval("POST", "/api/v1/ai/kb", "u", "portal", noMenus));
        assertEquals(ALLOW, eval("POST", "/api/v1/ai/agents/1/chat", "u", "portal", noMenus));
        assertEquals(ALLOW, eval("GET", "/api/v1/ai/square/kbs", "u", "portal", noMenus));
        assertEquals(ALLOW, eval("GET", "/api/v1/ai/integrations", "u", "portal", noMenus));
        assertEquals(ALLOW, eval("POST", "/api/v1/ai/chat", "u", "portal", noMenus));
        assertEquals(ALLOW, eval("PATCH", "/api/v1/ai/conversations/1", "u", "portal", noMenus));
    }

    // ---------- 导入导出与工作流（routes.go:116-125 / routes_affairs.go:66-78）----------

    @Test
    @DisplayName("通用导入导出：任一业务管理菜单；学生不可访问")
    void importExport() {
        assertEquals(ALLOW, eval("POST", "/api/v1/import/positions/excel", "u", "portal",
            menusOnly("/job/positions")));
        assertEquals(ALLOW, eval("GET", "/api/v1/templates/exams", "u", "portal",
            menusOnly("/evaluation/exams")));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/import/positions/excel", "u", "portal",
            snapshot(List.of("student"))));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/export/positions", "u", "portal",
            menusOnly("/job/landing")));
    }

    @Test
    @DisplayName("affairs 专属导入导出挂教务管理菜单（注册在 affairs 管理组内）")
    void affairsSpecificImport() {
        assertEquals(ALLOW, eval("POST", "/api/v1/import/schedules/excel", "u", "portal",
            menusOnly("/affairs/scheduling")));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/import/schedules/excel", "u", "portal",
            menusOnly("/job/positions")));
        assertEquals(ALLOW, eval("GET", "/api/v1/templates/affairs-config", "u", "portal",
            menusOnly("/affairs/config")));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/templates/program-courses", "u", "portal",
            menusOnly("/lesson/admin/granular")));
    }

    @Test
    @DisplayName("门户工作流/审批：对应模块 workflows/approvals 菜单")
    void workflowMenus() {
        assertEquals(ALLOW, eval("GET", "/api/v1/workflows", "u", "portal", menusOnly("/job/workflows")));
        assertEquals(ALLOW, eval("POST", "/api/v1/approvals/1/review", "u", "portal",
            menusOnly("/affairs/approvals")));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/workflows", "u", "portal",
            menusOnly("/job/positions")));
    }

    // ---------- affairs 域写接口（routes_affairs.go 全量挂载于 affairsManageMenus）----------

    @Test
    @DisplayName("affairs 域：教务管理菜单可写；节次定义 GET 登录公开")
    void affairsDomain() {
        AuthzSnapshot manage = menusOnly("/affairs/teaching-plans");
        assertEquals(ALLOW, eval("POST", "/api/v1/affairs/terms", "u", "portal", manage));
        assertEquals(ALLOW, eval("PUT", "/api/v1/affairs/teaching-plans/entries/1", "u", "portal", manage));
        assertEquals(ALLOW, eval("POST", "/api/v1/affairs/schedules/auto-schedule", "u", "portal", manage));
        assertEquals(ALLOW, eval("GET", "/api/v1/affairs/workflows", "u", "portal", manage));
        AuthzSnapshot student = snapshot(List.of("student"));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/affairs/terms", "u", "portal", student));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/affairs/period-slots", "u", "portal", student));
        assertEquals(ALLOW, eval("GET", "/api/v1/affairs/period-slots", "u", "portal", student));
    }

    // ---------- 收藏与各模块只读面（routes.go:149-160/250-324）----------

    @Test
    @DisplayName("收藏：任一业务管理/落地页菜单")
    void favorites() {
        assertEquals(ALLOW, eval("GET", "/api/v1/favorites", "u", "portal", menusOnly("/job/landing")));
        assertEquals(ALLOW, eval("POST", "/api/v1/job/positions/1/favorite", "u", "portal",
            menusOnly("/scene/landing")));
        assertEquals(ALLOW, eval("GET", "/api/v1/job/positions/favorites", "u", "portal",
            menusOnly("/evaluation/question-banks")));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/favorites", "u", "portal",
            menusOnly("/portal/workspace")));
    }

    @Test
    @DisplayName("evaluation 只读面：学生落地页可读/提交；评分与归档仍限管理面")
    void evaluationReadFace() {
        AuthzSnapshot landing = menusOnly("/evaluation/landing");
        assertEquals(ALLOW, eval("GET", "/api/v1/evaluation/results", "u", "portal", landing));
        assertEquals(ALLOW, eval("POST", "/api/v1/evaluation/results", "u", "portal", landing));
        assertEquals(ALLOW, eval("POST", "/api/v1/evaluation/exam-results", "u", "portal", landing));
        assertEquals(ALLOW, eval("GET", "/api/v1/evaluation/exams", "u", "portal", landing));
        assertEquals(ALLOW, eval("GET", "/api/v1/evaluation/exams/1/snapshot", "u", "portal", landing));
        assertEquals(ALLOW, eval("GET", "/api/v1/evaluation/portraits/student-dashboard", "u", "portal", landing));
        // 管理面收窄项
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/evaluation/results/1", "u", "portal", landing));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/evaluation/results/1/grade", "u", "portal", landing));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/evaluation/exam-results", "u", "portal", landing));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/evaluation/portraits/archives", "u", "portal", landing));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/evaluation/job-ability/results/summary", "u", "portal", landing));
        AuthzSnapshot manage = menusOnly("/evaluation/exams");
        assertEquals(ALLOW, eval("POST", "/api/v1/evaluation/results/1/grade", "u", "portal", manage));
        assertEquals(ALLOW, eval("GET", "/api/v1/evaluation/portraits/archives", "u", "portal", manage));
    }

    @Test
    @DisplayName("job/scene/lesson/library 只读面与管理面分界")
    void moduleReadFaces() {
        AuthzSnapshot jobLanding = menusOnly("/job/landing");
        assertEquals(ALLOW, eval("GET", "/api/v1/job/public/positions", "u", "portal", jobLanding));
        assertEquals(ALLOW, eval("GET", "/api/v1/job/abilities/citation-stats", "u", "portal", jobLanding));
        assertEquals(ALLOW, eval("GET", "/api/v1/job/positions/1/snapshot", "u", "portal", jobLanding));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/job/positions", "u", "portal", jobLanding));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/job/abilities", "u", "portal", jobLanding));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/job/banners", "u", "portal", jobLanding));

        AuthzSnapshot sceneLanding = menusOnly("/scene/landing");
        assertEquals(ALLOW, eval("GET", "/api/v1/scene/scenarios", "u", "portal", sceneLanding));
        assertEquals(ALLOW, eval("GET", "/api/v1/scene/scenarios/1/snapshot", "u", "portal", sceneLanding));
        assertEquals(ALLOW, eval("GET", "/api/v1/scene/tasks/t1/evaluation-methods", "u", "portal", sceneLanding));
        // sceneManageMenus 含 "/scene/"（场景根菜单）：Go Covers 同链匹配使 /scene/landing
        // 覆盖场景管理面（已用 Go 单测实证 Covers("/scene/")=true），写任务同样放行
        assertEquals(ALLOW, eval("POST", "/api/v1/scene/tasks", "u", "portal", sceneLanding));
        assertEquals(ALLOW, eval("GET", "/api/v1/scene/rubric-templates", "u", "portal", sceneLanding));

        AuthzSnapshot lessonLanding = menusOnly("/lesson/landing");
        assertEquals(ALLOW, eval("GET", "/api/v1/lesson/nodes", "u", "portal", lessonLanding));
        assertEquals(ALLOW, eval("POST", "/api/v1/lesson/node-evaluation-results", "u", "portal", lessonLanding));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/lesson/node-evaluation-results/1/grade", "u", "portal",
            lessonLanding));
        assertEquals(FORBIDDEN_PERMISSION, eval("GET", "/api/v1/lesson/quizzes", "u", "portal", lessonLanding));

        AuthzSnapshot libraryLanding = menusOnly("/library/landing");
        assertEquals(ALLOW, eval("POST", "/api/v1/library/resource-tags/query", "u", "portal", libraryLanding));
        assertEquals(ALLOW, eval("GET", "/api/v1/library/on-site-questions", "u", "portal", libraryLanding));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/library/resource-tags", "u", "portal", libraryLanding));
        assertEquals(FORBIDDEN_PERMISSION, eval("POST", "/api/v1/library/resources", "u", "portal", libraryLanding));
    }

    // ---------- 路径匹配器 ----------

    @Test
    @DisplayName("路径模式匹配：* 单段、** 任意尾段、逐段相等")
    void pathMatcher() {
        assertTrue(ZhiyuAuthzRules.matchPath("/api/v1/tenants/*", "/api/v1/tenants/abc"));
        assertFalse(ZhiyuAuthzRules.matchPath("/api/v1/tenants/*", "/api/v1/tenants"));
        assertFalse(ZhiyuAuthzRules.matchPath("/api/v1/tenants/*", "/api/v1/tenants/abc/def"));
        assertTrue(ZhiyuAuthzRules.matchPath("/api/v1/admin/**", "/api/v1/admin/tenants/t1/admins"));
        assertTrue(ZhiyuAuthzRules.matchPath("/api/v1/admin/**", "/api/v1/admin"));
        assertFalse(ZhiyuAuthzRules.matchPath("/api/v1/admin/**", "/api/v1/adminx"));
        assertTrue(ZhiyuAuthzRules.matchPath("/api/v1/job/positions/*/snapshot", "/api/v1/job/positions/1/snapshot"));
        assertFalse(ZhiyuAuthzRules.matchPath("/api/v1/job/positions/*/snapshot", "/api/v1/job/positions/1"));
        assertFalse(ZhiyuAuthzRules.matchPath("/api/v1/partner/experts/*", "/api/v1/partner/experts"));
    }
}
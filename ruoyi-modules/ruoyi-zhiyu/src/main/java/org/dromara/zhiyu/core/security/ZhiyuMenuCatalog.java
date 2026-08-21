package org.dromara.zhiyu.core.security;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 菜单驱动的 API 授权声明（ADR-0008），与 Go backend/go/internal/router/menu_grants.go
 * 逐一等价；新增菜单或模块时两侧同步维护，列表与前端菜单树（buildMenuTree +
 * navigation-config）的勾选项保持一致。
 *
 * <p>业务 API 按模块分组挂载 RequireMenu(模块管理菜单)；学生/前台只读 API 挂
 * RequireMenu(管理菜单 ∪ landing 菜单)；/alliance/public/* 保持「登录公开」。</p>
 *
 * @author zhiyu
 */
public final class ZhiyuMenuCatalog {

    private ZhiyuMenuCatalog() {
    }

    /** 产业岗位学习平台管理面菜单（写 API 与列表管理页） */
    public static final List<String> JOB_MANAGE_MENUS = List.of(
        "/job/positions",
        "/job/batches",
        "/job/workflows",
        "/job/approvals",
        "/job/learn-roads",
        "/job/recommend",
        "/job/archive"
    );

    /** 实践场景学习平台管理面菜单 */
    public static final List<String> SCENE_MANAGE_MENUS = List.of(
        "/scene/",
        "/scene/batches",
        "/scene/workflows",
        "/scene/approvals",
        "/scene/archive"
    );

    /** 数字课程服务平台管理面菜单 */
    public static final List<String> LESSON_MANAGE_MENUS = List.of(
        "/lesson/admin/system",
        "/lesson/admin/granular",
        "/lesson/admin/hybrid",
        "/lesson/admin/batches",
        "/lesson/admin/workflows",
        "/lesson/admin/approvals",
        "/lesson/admin/archive"
    );

    /** 能力评价与测评资源管理平台管理面菜单 */
    public static final List<String> EVALUATION_MANAGE_MENUS = List.of(
        "/evaluation/question-banks",
        "/evaluation/exams",
        "/evaluation/exam-usage",
        "/evaluation/batches",
        "/evaluation/workflows",
        "/evaluation/approvals",
        "/evaluation/scene-results",
        "/evaluation/lesson-results",
        "/evaluation/job-ability",
        "/evaluation/job-ability/results"
    );

    /** 教学资源共享服务平台管理面菜单 */
    public static final List<String> LIBRARY_MANAGE_MENUS = List.of(
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
        "/library/resources/other"
    );

    /** 教务管理服务平台管理面菜单 */
    public static final List<String> AFFAIRS_MANAGE_MENUS = List.of(
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
        "/affairs/approvals"
    );

    /** 产教融合与就业服务平台管理面菜单 */
    public static final List<String> ALLIANCE_MANAGE_MENUS = List.of(
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
        "/portal/apps/alliance/employmentjob"
    );

    /** 联盟前台只读面菜单（落地页） */
    public static final List<String> ALLIANCE_PUBLIC_MENUS = List.of("/portal/alliance/landing");

    /** 门户级工作流/审批菜单（spec 02 §1.8：school_admin/teacher 可用） */
    public static final List<String> WORKFLOW_MENUS = List.of(
        "/job/workflows", "/job/approvals",
        "/scene/workflows", "/scene/approvals",
        "/lesson/admin/workflows", "/lesson/admin/approvals",
        "/evaluation/workflows", "/evaluation/approvals",
        "/affairs/workflows", "/affairs/approvals"
    );

    /** 系统管理菜单（/portal/apps/system 前缀，RequireSystemPermission 的菜单判定部分） */
    public static final List<String> SYSTEM_MENUS = List.of(
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
        "/portal/apps/system/logs/operation"
    );

    /** 门户服务台菜单 */
    public static final List<String> WORKSPACE_MENUS = List.of("/portal/workspace");

    /** 五个业务落地页菜单（只读面宽授权用） */
    public static final List<String> LANDING_MENUS = List.of(
        "/job/landing", "/lesson/landing", "/scene/landing",
        "/evaluation/landing", "/library/landing"
    );

    /** 系统管理菜单前缀（对齐 Go middleware/rbac.go systemMenuPrefix） */
    public static final String SYSTEM_MENU_PREFIX = "/portal/apps/system";

    /** 联盟管理面菜单前缀（canManageAlliance 的 CoversPrefix 参数） */
    public static final String ALLIANCE_MENU_PREFIX = "/portal/apps/alliance";

    /**
     * 全部业务管理菜单并集（参考数据等跨模块只读接口的授权面，对齐 Go allManageMenus()）：
     * job/scene/lesson/evaluation/library/affairs/alliance/workflow/system 去重并集。
     */
    public static List<String> allManageMenus() {
        Set<String> seen = new LinkedHashSet<>();
        for (List<String> group : List.of(
            JOB_MANAGE_MENUS, SCENE_MANAGE_MENUS, LESSON_MANAGE_MENUS,
            EVALUATION_MANAGE_MENUS, LIBRARY_MANAGE_MENUS, AFFAIRS_MANAGE_MENUS,
            ALLIANCE_MANAGE_MENUS, WORKFLOW_MENUS, SYSTEM_MENUS)) {
            seen.addAll(group);
        }
        return new ArrayList<>(seen);
    }

    /**
     * 导入/导出/模板下载的菜单授权面：任一业务管理菜单即可（对齐 Go importExportMenus()）。
     */
    public static List<String> importExportMenus() {
        List<String> out = new ArrayList<>();
        for (List<String> group : List.of(
            JOB_MANAGE_MENUS, SCENE_MANAGE_MENUS, LESSON_MANAGE_MENUS,
            EVALUATION_MANAGE_MENUS, LIBRARY_MANAGE_MENUS, AFFAIRS_MANAGE_MENUS,
            ALLIANCE_MANAGE_MENUS)) {
            out.addAll(group);
        }
        return out;
    }

    /** 模块管理菜单 ∪ 落地页菜单（模块只读面授权，对齐 Go routes.go 各只读面 append） */
    public static List<String> managePlusLanding(List<String> manageMenus, String landingMenu) {
        List<String> out = new ArrayList<>(manageMenus);
        out.add(landingMenu);
        return out;
    }

    /** 全部业务管理菜单 ∪ 五个落地页菜单（跨模块只读引用/收藏授权面） */
    public static List<String> allManagePlusLandings() {
        List<String> out = allManageMenus();
        out.addAll(LANDING_MENUS);
        return out;
    }
}

package org.dromara.zhiyu.core.security;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 操作日志的路径→模块/动作/目标解析（逐项移植 Go internal/middleware/oplog.go 的
 * moduleNames/actionNames/opLogSkips/describeOperation，字段语义完全一致）。
 *
 * @author zhiyu
 */
public final class OperationLogDescriber {

    private static final Pattern UUID_PATTERN =
        Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    /** 表名→模块名映射（与 Go moduleNames 一致） */
    private static final Map<String, String> MODULE_NAMES = Map.ofEntries(
        Map.entry("tenants", "租户管理"),
        Map.entry("organizations", "组织架构"),
        Map.entry("org-types", "组织类型"),
        Map.entry("users", "用户管理"),
        Map.entry("staff-titles", "教职工职称"),
        Map.entry("user-extension-fields", "用户扩展字段"),
        Map.entry("user-relations", "用户关系"),
        Map.entry("roles", "角色权限"),
        Map.entry("majors", "专业管理"),
        Map.entry("industries", "行业管理"),
        Map.entry("resource-codes", "资源代码"),
        Map.entry("subscriptions", "订阅管理"),
        Map.entry("workflows", "工作流"),
        Map.entry("approvals", "审批管理"),
        Map.entry("job", "岗位管理"),
        Map.entry("scene", "场景实训"),
        Map.entry("lesson", "课程教学"),
        Map.entry("evaluation", "考核评价"),
        Map.entry("resources", "资源管理"),
        Map.entry("institutions", "机构管理"),
        Map.entry("orders", "订单管理"),
        Map.entry("withdrawals", "提现管理"),
        Map.entry("banners", "轮播图"),
        Map.entry("files", "文件管理"),
        Map.entry("config", "系统配置"),
        Map.entry("import", "数据导入"),
        Map.entry("export", "数据导出")
    );

    /** 末段路径→动作名映射（与 Go actionNames 一致） */
    private static final Map<String, String> ACTION_NAMES = Map.ofEntries(
        Map.entry("status", "状态变更"),
        Map.entry("review", "审核"),
        Map.entry("publish", "发布"),
        Map.entry("submit", "提交审核"),
        Map.entry("archive", "归档"),
        Map.entry("withdraw", "撤回"),
        Map.entry("invite", "邀请"),
        Map.entry("assign", "分配"),
        Map.entry("reset-password", "重置密码"),
        Map.entry("approve", "审核通过"),
        Map.entry("disable", "禁用"),
        Map.entry("pay", "支付"),
        Map.entry("grade", "评分"),
        Map.entry("batch-grade", "批量评分"),
        Map.entry("toggle", "切换状态"),
        Map.entry("start", "开始"),
        Map.entry("finish", "结束"),
        Map.entry("reorder", "排序"),
        Map.entry("process", "处理"),
        Map.entry("apply", "申请"),
        Map.entry("generate", "生成"),
        Map.entry("issue", "发放"),
        Map.entry("batch", "批量创建"),
        Map.entry("upload", "上传")
    );

    /** 跳过审计的路径片段（与 Go opLogSkips 一致：行为埋点与浏览数不记日志） */
    private static final List<String> SKIPS = List.of("/behavior-collection/", "/view");

    private OperationLogDescriber() {
    }

    /**
     * 操作描述。
     *
     * @param module     模块名（命中映射表为中文，否则为首段路径原文）
     * @param action     动作名（末段命中映射表为中文，否则按 HTTP 方法：创建/更新/删除）
     * @param targetType 目标类型（首个 UUID 段的前一段，无则 null）
     * @param targetId   目标 ID（首个 UUID 段，无则 null）
     */
    public record OpDescription(String module, String action, String targetType, String targetId) {
    }

    /**
     * 是否需要审计：仅写操作（POST/PUT/DELETE）且路径不含跳过片段。
     */
    public static boolean shouldRecord(String method, String path) {
        if (!"POST".equals(method) && !"PUT".equals(method) && !"DELETE".equals(method)) {
            return false;
        }
        for (String skip : SKIPS) {
            if (path.contains(skip)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 解析操作描述（对齐 Go describeOperation）。
     */
    public static OpDescription describe(String method, String path) {
        String trimmed = path.startsWith("/api/v1/") ? path.substring("/api/v1/".length()) : path;
        String[] raw = trimmed.split("/");
        List<String> segments = java.util.Arrays.stream(raw).filter(s -> !s.isEmpty()).toList();
        if (segments.isEmpty()) {
            return new OpDescription(trimmed, methodAction(method), null, null);
        }

        String module = MODULE_NAMES.getOrDefault(segments.get(0), segments.get(0));

        String targetType = null;
        String targetId = null;
        for (int i = 0; i < segments.size(); i++) {
            if (UUID_PATTERN.matcher(segments.get(i)).matches()) {
                targetId = segments.get(i);
                if (i > 0) {
                    targetType = segments.get(i - 1);
                }
                break;
            }
        }

        String last = segments.get(segments.size() - 1);
        String action;
        if (!UUID_PATTERN.matcher(last).matches() && ACTION_NAMES.containsKey(last)) {
            action = ACTION_NAMES.get(last);
        } else {
            action = methodAction(method);
        }
        return new OpDescription(module, action, targetType, targetId);
    }

    /** HTTP 方法→默认动作名（对齐 Go methodAction） */
    static String methodAction(String method) {
        return switch (method) {
            case "POST" -> "创建";
            case "PUT" -> "更新";
            case "DELETE" -> "删除";
            default -> method;
        };
    }
}

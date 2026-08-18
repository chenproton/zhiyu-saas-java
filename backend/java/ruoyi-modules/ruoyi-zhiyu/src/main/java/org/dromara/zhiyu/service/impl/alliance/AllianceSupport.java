package org.dromara.zhiyu.service.impl.alliance;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.alliance.AllianceDtos.RelatedRef;
import org.dromara.zhiyu.domain.dto.alliance.EmploymentDtos.TargetGroup;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 联盟域通用工具（JSON 互转 / 租户校验 / 分页钳制）。
 *
 * @author zhiyu
 */
final class AllianceSupport {

    static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STR_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<Map<String, Object>>> MAP_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<RelatedRef>> REL_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<TargetGroup>> TARGET_GROUP_REF = new TypeReference<>() {
    };

    private AllianceSupport() {
    }

    static String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    static String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    static String currentUserOrNull() {
        return TenantContext.getUserId();
    }

    static void verifyTenantOwnership(String entityTenantId) {
        String tenantId = requireTenant();
        if (entityTenantId != null && !entityTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    static long clampLimit(long limit, long defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }

    static long clampPublicLimit(long limit) {
        if (limit <= 0) {
            return 100;
        }
        return Math.min(limit, 500);
    }

    static long clampOffset(long offset) {
        return Math.max(offset, 0);
    }

    // ---- JSON 转换 ----

    static List<String> strList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = MAPPER.readValue(json, STR_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    static String jsonList(List<String> list) {
        if (list == null) {
            return "[]";
        }
        try {
            return MAPPER.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    static String jsonObject(Object obj) {
        if (obj == null) {
            return "{}";
        }
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }

    static String jsonObjectOrDefault(Object obj, String fallback) {
        if (obj == null) {
            return fallback;
        }
        try {
            return MAPPER.writeValueAsString(obj);
        } catch (Exception e) {
            return fallback;
        }
    }

    static Object parseObject(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, Object.class);
        } catch (Exception e) {
            return null;
        }
    }

    static List<Map<String, Object>> mapList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<Map<String, Object>> v = MAPPER.readValue(json, MAP_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    static List<RelatedRef> relatedRefs(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<RelatedRef> v = MAPPER.readValue(json, REL_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    static List<TargetGroup> targetGroups(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<TargetGroup> v = MAPPER.readValue(json, TARGET_GROUP_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** 转 PG 数组字面量（{a,b}）。 */
    static String toPgArrayLiteral(List<String> list) {
        if (list == null || list.isEmpty()) {
            return "{}";
        }
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            String v = list.get(i) == null ? "" : list.get(i);
            sb.append('"').append(v.replace("\\", "\\\\").replace("\"", "\\\"")).append('"');
        }
        sb.append('}');
        return sb.toString();
    }
}

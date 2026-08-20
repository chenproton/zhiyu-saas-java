package org.dromara.zhiyu.core.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 限流规则匹配单测（规则与 Go routes.go 的 limiter 挂载逐项对应）。
 */
@Tag("local")
class ZhiyuRateLimitRuleTest {

    private static final String UUID = "3f8b2c1a-1234-4abc-8def-0123456789ab";

    private static ZhiyuRateLimitRule.Rule rule(String method, String path) {
        ZhiyuRateLimitRule.Rule r = ZhiyuRateLimitRule.match(method, path);
        assertNotNull(r, method + " " + path + " 应命中限流规则");
        return r;
    }

    @Test
    @DisplayName("登录族接口：login 命名空间 30 次/分 按 IP")
    void loginRules() {
        for (String path : new String[]{"/api/v1/auth/login", "/api/v1/auth/saas/login",
            "/api/v1/auth/portal/login", "/api/v1/auth/partner/login",
            "/api/v1/auth/partner/register", "/api/v1/auth/select-tenant"}) {
            ZhiyuRateLimitRule.Rule r = rule("POST", path);
            assertEquals("login", r.namespace());
            assertEquals(30, r.limit());
            assertFalse(r.byUser());
        }
    }

    @Test
    @DisplayName("验证码/主题色/联盟公开前台：按 IP 限流")
    void publicRules() {
        ZhiyuRateLimitRule.Rule captcha = rule("GET", "/api/v1/auth/captcha");
        assertEquals("captcha", captcha.namespace());
        assertEquals(10, captcha.limit());

        ZhiyuRateLimitRule.Rule theme = rule("GET", "/api/v1/settings/theme");
        assertEquals("theme", theme.namespace());
        assertEquals(120, theme.limit());

        ZhiyuRateLimitRule.Rule pub = rule("GET", "/api/v1/alliance/public/enterprises");
        assertEquals("public-read", pub.namespace());
        assertEquals(120, pub.limit());
        assertFalse(pub.byUser());
    }

    @Test
    @DisplayName("上传：upload 20 次/分 按用户（含知识库文档上传）")
    void uploadRules() {
        ZhiyuRateLimitRule.Rule upload = rule("POST", "/api/v1/files/upload");
        assertEquals("upload", upload.namespace());
        assertEquals(20, upload.limit());
        assertTrue(upload.byUser());

        ZhiyuRateLimitRule.Rule kbDoc = rule("POST", "/api/v1/ai/kb/" + UUID + "/documents");
        assertEquals("upload", kbDoc.namespace());
    }

    @Test
    @DisplayName("AI 调用：ai 20 次/分 按用户")
    void aiRules() {
        for (String path : new String[]{"/api/v1/ai/chat", "/api/v1/ai/position-assist",
            "/api/v1/ai/scenario-assist", "/api/v1/ai/kb/" + UUID + "/ask",
            "/api/v1/ai/agents/" + UUID + "/chat", "/api/v1/ai/agents/" + UUID + "/preview",
            "/api/v1/ai/yiknow/chat"}) {
            ZhiyuRateLimitRule.Rule r = rule("POST", path);
            assertEquals("ai", r.namespace(), path);
            assertEquals(20, r.limit(), path);
            assertTrue(r.byUser(), path);
        }
    }

    @Test
    @DisplayName("导入导出：import-export 10 次/分 按用户")
    void importExportRules() {
        for (String path : new String[]{"/api/v1/import/students/excel", "/api/v1/import/students/preview"}) {
            ZhiyuRateLimitRule.Rule r = rule("POST", path);
            assertEquals("import-export", r.namespace(), path);
            assertEquals(10, r.limit(), path);
            assertTrue(r.byUser(), path);
        }
        ZhiyuRateLimitRule.Rule exp = rule("GET", "/api/v1/export/students");
        assertEquals("import-export", exp.namespace());
        ZhiyuRateLimitRule.Rule tpl = rule("GET", "/api/v1/templates/positions");
        assertEquals("import-export", tpl.namespace());
    }

    @Test
    @DisplayName("密码写操作：password 10 次/分 按用户")
    void passwordRules() {
        String[][] cases = {
            {"POST", "/api/v1/portal/workspace/me/password"},
            {"PUT", "/api/v1/partner/me/password"},
            {"POST", "/api/v1/admins/" + UUID + "/reset-password"},
            {"POST", "/api/v1/users/" + UUID + "/reset-password"},
            {"POST", "/api/v1/admin/tenants/" + UUID + "/admins/" + UUID + "/reset-password"},
            {"POST", "/api/v1/admin/tenants/" + UUID + "/enterprise-admins/" + UUID + "/reset-password"},
        };
        for (String[] c : cases) {
            ZhiyuRateLimitRule.Rule r = rule(c[0], c[1]);
            assertEquals("password", r.namespace(), c[1]);
            assertEquals(10, r.limit(), c[1]);
            assertTrue(r.byUser(), c[1]);
        }
    }

    @Test
    @DisplayName("方法不匹配或未列出的路径不限流（防误伤普通业务接口）")
    void noMatch() {
        assertNull(ZhiyuRateLimitRule.match("GET", "/api/v1/auth/login"));
        assertNull(ZhiyuRateLimitRule.match("POST", "/api/v1/users"));
        assertNull(ZhiyuRateLimitRule.match("GET", "/api/v1/portal/workspace/dashboard"));
        assertNull(ZhiyuRateLimitRule.match("GET", "/api/v1/files/preview"));
        assertNull(ZhiyuRateLimitRule.match(null, "/api/v1/auth/login"));
        assertNull(ZhiyuRateLimitRule.match("POST", null));
    }
}

package org.dromara.zhiyu.core.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 操作日志路径解析单测（对齐 Go oplog.go 的 describeOperation/moduleNames/actionNames 语义）。
 */
@Tag("local")
class OperationLogDescriberTest {

    private static final String UUID = "3f8b2c1a-1234-4abc-8def-0123456789ab";

    @Test
    @DisplayName("集合创建：模块命中中文映射，动作为创建，无目标")
    void createOnCollection() {
        var op = OperationLogDescriber.describe("POST", "/api/v1/users");
        assertEquals("用户管理", op.module());
        assertEquals("创建", op.action());
        assertNull(op.targetType());
        assertNull(op.targetId());
    }

    @Test
    @DisplayName("单资源更新：提取首个 UUID 为 targetId，前一段为 targetType")
    void updateWithTarget() {
        var op = OperationLogDescriber.describe("PUT", "/api/v1/users/" + UUID);
        assertEquals("用户管理", op.module());
        assertEquals("更新", op.action());
        assertEquals("users", op.targetType());
        assertEquals(UUID, op.targetId());
    }

    @Test
    @DisplayName("末段动作词优先于方法默认动作（reset-password → 重置密码）")
    void actionWordPreferred() {
        var op = OperationLogDescriber.describe("POST", "/api/v1/users/" + UUID + "/reset-password");
        assertEquals("重置密码", op.action());
        assertEquals("users", op.targetType());
        assertEquals(UUID, op.targetId());
    }

    @Test
    @DisplayName("末段为 UUID 时回退方法动作（DELETE → 删除）")
    void deleteFallsBackToMethod() {
        var op = OperationLogDescriber.describe("DELETE", "/api/v1/roles/" + UUID);
        assertEquals("角色权限", op.module());
        assertEquals("删除", op.action());
        assertEquals(UUID, op.targetId());
    }

    @Test
    @DisplayName("嵌套资源：模块取首段映射，目标取首个 UUID 前一段")
    void nestedResource() {
        var op = OperationLogDescriber.describe("POST", "/api/v1/lesson/nodes/" + UUID + "/publish");
        assertEquals("课程教学", op.module());
        assertEquals("发布", op.action());
        assertEquals("nodes", op.targetType());
        assertEquals(UUID, op.targetId());
    }

    @Test
    @DisplayName("未映射模块保留原文（对齐 Go：affairs 不在映射表）")
    void unmappedModuleStaysRaw() {
        var op = OperationLogDescriber.describe("POST", "/api/v1/affairs/terms");
        assertEquals("affairs", op.module());
        assertEquals("创建", op.action());
    }

    @Test
    @DisplayName("GET 不审计；行为埋点与浏览数路径跳过")
    void skips() {
        assertFalse(OperationLogDescriber.shouldRecord("GET", "/api/v1/users"));
        assertFalse(OperationLogDescriber.shouldRecord("POST", "/api/v1/lesson/behavior-collection/events"));
        assertFalse(OperationLogDescriber.shouldRecord("POST", "/api/v1/library/resources/" + UUID + "/view"));
        assertTrue(OperationLogDescriber.shouldRecord("POST", "/api/v1/users"));
        assertTrue(OperationLogDescriber.shouldRecord("PUT", "/api/v1/roles/" + UUID));
        assertTrue(OperationLogDescriber.shouldRecord("DELETE", "/api/v1/majors/" + UUID));
    }

    @Test
    @DisplayName("上传动作词（末段 upload → 上传）")
    void uploadAction() {
        var op = OperationLogDescriber.describe("POST", "/api/v1/files/upload");
        assertEquals("文件管理", op.module());
        assertEquals("上传", op.action());
    }
}

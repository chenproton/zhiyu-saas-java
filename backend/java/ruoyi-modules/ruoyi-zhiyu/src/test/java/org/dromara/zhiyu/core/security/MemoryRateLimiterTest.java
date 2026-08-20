package org.dromara.zhiyu.core.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 内存降级限流器单测（对齐 Go memoryLimiter.allow 的固定窗口语义）。
 */
@Tag("local")
class MemoryRateLimiterTest {

    private static final long WINDOW = 60_000;
    private static final long T0 = 1_700_000_000_000L;

    @Test
    @DisplayName("窗口内放行至上限，超限拒绝且剩余额度不为负")
    void allowUpToLimit() {
        MemoryRateLimiter limiter = new MemoryRateLimiter(2, WINDOW);
        var r1 = limiter.allow("k1", T0);
        assertTrue(r1.allowed());
        assertEquals(1, r1.remaining());

        var r2 = limiter.allow("k1", T0 + 1000);
        assertTrue(r2.allowed());
        assertEquals(0, r2.remaining());

        var r3 = limiter.allow("k1", T0 + 2000);
        assertFalse(r3.allowed());
        assertEquals(0, r3.remaining());
        assertEquals((T0 + 2000 + WINDOW) / 1000, r3.resetUnix());
    }

    @Test
    @DisplayName("窗口过期后重置计数重新放行")
    void windowReset() {
        MemoryRateLimiter limiter = new MemoryRateLimiter(1, WINDOW);
        assertTrue(limiter.allow("k1", T0).allowed());
        assertFalse(limiter.allow("k1", T0 + 1000).allowed());
        // 窗口起点 + window 后重置
        assertTrue(limiter.allow("k1", T0 + WINDOW).allowed());
    }

    @Test
    @DisplayName("不同 key 独立计数（namespace+IP/用户隔离，防误伤）")
    void keysAreIndependent() {
        MemoryRateLimiter limiter = new MemoryRateLimiter(1, WINDOW);
        assertTrue(limiter.allow("ip:1.1.1.1", T0).allowed());
        assertTrue(limiter.allow("ip:2.2.2.2", T0).allowed());
        assertFalse(limiter.allow("ip:1.1.1.1", T0).allowed());
    }

    @Test
    @DisplayName("条目超过上限时惰性清理过期窗口，内存有界")
    void boundedMemory() {
        MemoryRateLimiter limiter = new MemoryRateLimiter(1, WINDOW);
        // 灌入超过 4096 条过期 key
        for (int i = 0; i < MemoryRateLimiter.MAX_ENTRIES + 10; i++) {
            limiter.allow("k" + i, T0 - WINDOW - 1);
        }
        // 正常 key 仍放行（清理后重新计数）
        assertTrue(limiter.allow("fresh", T0).allowed());
    }
}

package org.dromara.zhiyu.core.security;

import java.util.HashMap;
import java.util.Map;

/**
 * 内存降级限流器（对齐 Go internal/cache/middleware.go 的 memoryLimiter）。
 *
 * <p>Redis 不可用时的兜底：固定窗口计数，单进程内有效（多副本各实例独立计数，
 * 仅作降级兜底，与 Go 语义一致）。内存有界：条目数超过 4096 时惰性清理窗口已过期的
 * entry，防异常 key 泛洪撑爆内存。</p>
 *
 * @author zhiyu
 */
public class MemoryRateLimiter {

    /** 内存条目上限（对齐 Go：超过后惰性清理过期窗口） */
    static final int MAX_ENTRIES = 4096;

    private final int limit;
    private final long windowMillis;
    private final Map<String, Entry> entries = new HashMap<>();

    public MemoryRateLimiter(int limit, long windowMillis) {
        this.limit = limit;
        this.windowMillis = windowMillis;
    }

    /**
     * 判定结果。
     *
     * @param allowed   是否放行
     * @param remaining 窗口内剩余额度（不小于 0）
     * @param resetUnix 窗口重置时间戳（秒）
     */
    public record Result(boolean allowed, int remaining, long resetUnix) {
    }

    private static class Entry {
        long windowStart;
        int count;
    }

    /**
     * 递增 key 计数并判定是否放行（窗口过期则重置计数与窗口起点，与 Redis 路径语义一致）。
     *
     * @param key       限流 key
     * @param nowMillis 当前时间（毫秒，注入以便测试）
     * @return 判定结果
     */
    public synchronized Result allow(String key, long nowMillis) {
        Entry e = entries.get(key);
        if (e == null || nowMillis - e.windowStart >= windowMillis) {
            e = new Entry();
            e.windowStart = nowMillis;
            entries.put(key, e);
        }
        e.count++;

        if (entries.size() > MAX_ENTRIES) {
            entries.entrySet().removeIf(en -> nowMillis - en.getValue().windowStart >= windowMillis);
        }

        int remaining = Math.max(0, limit - e.count);
        return new Result(e.count <= limit, remaining, (nowMillis + windowMillis) / 1000);
    }
}

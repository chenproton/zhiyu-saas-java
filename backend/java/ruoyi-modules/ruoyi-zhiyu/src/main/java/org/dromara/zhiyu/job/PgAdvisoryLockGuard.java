package org.dromara.zhiyu.job;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * PostgreSQL 会话级 advisory 锁（专用连接持有，对齐 Go scheduler.aggregateAll）。
 *
 * <p>锁由一条从连接池取出的专用 {@link Connection} 持有（会话级，与具体执行汇聚的
 * MyBatis 连接无关），{@link LockHandle#close()} 显式 unlock 并归还连接；
 * 连接意外中断时 PG 也会自动释放会话锁。与 Go 的差异：Go 在同一连接上
 * {@code SET statement_timeout = 0} 并直接执行汇聚；Java 侧汇聚走 MyBatis 连接，
 * 语句超时在各岗位事务内以 {@code SET LOCAL} 解除（见
 * {@code EvaluationJobAbilityServiceImpl.aggregateAllPublished}），故本连接无需 SET/RESET。</p>
 *
 * @author zhiyu
 */
@Slf4j
@Component
public class PgAdvisoryLockGuard {

    private final DataSource dataSource;

    public PgAdvisoryLockGuard(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * 尝试取锁（pg_try_advisory_lock）。
     *
     * @return 取到锁返回句柄；已被其他实例持有返回 {@code null}（调用方应跳过本次执行）
     */
    public LockHandle tryAcquire(long key) throws SQLException {
        Connection conn = dataSource.getConnection();
        try {
            boolean locked;
            try (PreparedStatement ps = conn.prepareStatement("SELECT pg_try_advisory_lock(?)")) {
                ps.setLong(1, key);
                try (ResultSet rs = ps.executeQuery()) {
                    rs.next();
                    locked = rs.getBoolean(1);
                }
            }
            if (!locked) {
                conn.close();
                return null;
            }
            return new LockHandle(conn, key);
        } catch (SQLException | RuntimeException e) {
            try {
                conn.close();
            } catch (SQLException closeErr) {
                log.warn("advisory lock 连接归还失败 key={}", key, closeErr);
            }
            throw e;
        }
    }

    /** 会话锁句柄：close 时先 pg_advisory_unlock（尽力而为）再归还连接。 */
    public static class LockHandle implements AutoCloseable {

        private final Connection conn;
        private final long key;

        private LockHandle(Connection conn, long key) {
            this.conn = conn;
            this.key = key;
        }

        @Override
        public void close() {
            try (Statement st = conn.createStatement()) {
                st.execute("SELECT pg_advisory_unlock(" + key + ")");
            } catch (SQLException e) {
                log.warn("advisory lock 释放失败（连接关闭后 PG 会自动释放）key={}", key, e);
            }
            try {
                conn.close();
            } catch (SQLException e) {
                log.warn("advisory lock 连接归还失败 key={}", key, e);
            }
        }
    }
}

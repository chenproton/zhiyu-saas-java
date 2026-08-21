package org.dromara.zhiyu.core.seed;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 部署初始化种子（等价 Go cmd/seed）：运营方租户 platform + 平台管理员 admin。
 *
 * <p>密码取环境变量 {@code SEED_ADMIN_PASSWORD}（未设置时跳过种子）；
 * 已存在 admin 用户时仅重置密码（支持改密后重跑部署，语义与 Go seed 一致）。
 * 全部 SQL 幂等，重复执行安全。</p>
 *
 * @author zhiyu
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SeedRunner implements ApplicationRunner {

    /** 运营方租户固定 ID（与 Go domain.OperatorTenantID 一致，历史数据依赖，勿改） */
    public static final String OPERATOR_TENANT_ID = "00000000-0000-0000-0000-000000000001";

    private final SeedMapper seedMapper;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void run(ApplicationArguments args) {
        String adminPassword = System.getenv("SEED_ADMIN_PASSWORD");
        if (adminPassword == null || adminPassword.isBlank()) {
            log.info("[seed] SEED_ADMIN_PASSWORD 未设置，跳过种子数据");
            return;
        }
        String hashed = passwordEncoder.encode(adminPassword);
        if (seedMapper.existsAdmin()) {
            seedMapper.updateAdminPassword(hashed);
            log.info("[seed] 数据库已有 admin 用户，已重置密码（密码通过 SEED_ADMIN_PASSWORD 提供）");
            return;
        }
        seedMapper.insertOperatorTenant();
        seedMapper.insertPlatformAdminRole();
        seedMapper.insertAdminUser(hashed);
        seedMapper.insertAdminUserRole();
        seedMapper.refreshRoleCount();
        log.info("[seed] 种子数据初始化完成：运营方租户 platform / 平台管理员 admin（密码通过 SEED_ADMIN_PASSWORD 提供）");
    }
}

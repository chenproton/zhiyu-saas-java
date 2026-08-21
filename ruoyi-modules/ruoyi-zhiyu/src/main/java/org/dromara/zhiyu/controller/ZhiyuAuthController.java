package org.dromara.zhiyu.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.utils.ServletUtils;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.domain.dto.AuthDtos.CaptchaData;
import org.dromara.zhiyu.domain.dto.AuthDtos.LoginRequest;
import org.dromara.zhiyu.domain.dto.AuthDtos.LoginResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.MeResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.PartnerMeResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.PartnerRegisterRequest;
import org.dromara.zhiyu.domain.dto.AuthDtos.SelectTenantRequest;
import org.dromara.zhiyu.service.IAuthService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * zhiyu 认证接口（对齐 Go routes.go 的 /api/v1/auth 路由组，前端契约零改动）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/auth")
public class ZhiyuAuthController {

    private final IAuthService authService;

    /** SaaS 平台登录 */
    @PostMapping("/login")
    public LoginResponse login(@Validated @RequestBody LoginRequest req, HttpServletRequest request) {
        return authService.login(req, "saas", ServletUtils.getClientIP(request));
    }

    /** SaaS 平台登录（显式路径，对齐 Go /auth/saas/login） */
    @PostMapping("/saas/login")
    public LoginResponse saasLogin(@Validated @RequestBody LoginRequest req, HttpServletRequest request) {
        return authService.login(req, "saas", ServletUtils.getClientIP(request));
    }

    /** 门户平台登录 */
    @PostMapping("/portal/login")
    public LoginResponse portalLogin(@Validated @RequestBody LoginRequest req, HttpServletRequest request) {
        return authService.login(req, "portal", ServletUtils.getClientIP(request));
    }

    /** 合作方平台登录 */
    @PostMapping("/partner/login")
    public LoginResponse partnerLogin(@Validated @RequestBody LoginRequest req, HttpServletRequest request) {
        return authService.login(req, "partner", ServletUtils.getClientIP(request));
    }

    /** 选择租户（多租户账号登录后） */
    @PostMapping("/select-tenant")
    public LoginResponse selectTenant(@Validated @RequestBody SelectTenantRequest req) {
        return authService.selectTenant(req);
    }

    /** 当前用户信息 */
    @GetMapping("/me")
    public MeResponse me() {
        return authService.me(TenantContext.getUserId());
    }

    /** 门户平台当前用户信息 */
    @GetMapping("/portal/me")
    public MeResponse portalMe() {
        return authService.me(TenantContext.getUserId());
    }

    /** SaaS 平台当前用户信息 */
    @GetMapping("/saas/me")
    public MeResponse saasMe() {
        return authService.me(TenantContext.getUserId());
    }

    /** 字符验证码（公开） */
    @GetMapping("/captcha")
    public CaptchaData captcha() {
        return authService.captcha();
    }

    /** 企业自助注册（公开） */
    @PostMapping("/partner/register")
    public LoginResponse partnerRegister(@Validated @RequestBody PartnerRegisterRequest req) {
        return authService.partnerRegister(req);
    }

    /** 合作方平台当前用户信息（含企业主体与角色） */
    @GetMapping("/partner/me")
    public PartnerMeResponse partnerMe() {
        return authService.partnerMe(TenantContext.getUserId());
    }
}

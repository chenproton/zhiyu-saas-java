package org.dromara.zhiyu.service;

import org.dromara.zhiyu.domain.dto.AuthDtos.CaptchaData;
import org.dromara.zhiyu.domain.dto.AuthDtos.LoginRequest;
import org.dromara.zhiyu.domain.dto.AuthDtos.LoginResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.MeResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.PartnerMeResponse;
import org.dromara.zhiyu.domain.dto.AuthDtos.PartnerRegisterRequest;
import org.dromara.zhiyu.domain.dto.AuthDtos.SelectTenantRequest;

/**
 * zhiyu 认证服务（Go→Java 迁移：对齐 auth_handler.go 的登录/选租户/Me 语义）。
 *
 * @author zhiyu
 */
public interface IAuthService {

    /**
     * 平台登录（saas/portal/partner 共用流程）。
     *
     * @param req      登录请求
     * @param platform 平台标识（saas/portal/partner）
     * @param clientIp 客户端 IP（由 Controller 从请求提取，用于防爆破失败计数）
     * @return 登录响应（单租户直接签发 token；多租户返回预授权令牌与租户选项）
     */
    LoginResponse login(LoginRequest req, String platform, String clientIp);

    /**
     * 选择租户（消费预授权令牌，签发正式 token）。
     *
     * @param req 选择租户请求
     * @return 登录响应（token + user）
     */
    LoginResponse selectTenant(SelectTenantRequest req);

    /**
     * 查询当前用户完整信息（Me 接口）。
     *
     * @param userId 当前用户 ID
     * @return Me 响应
     */
    MeResponse me(String userId);

    /**
     * 生成字符验证码（答案存 Redis，一次性消费）。
     *
     * @return 验证码响应（captchaId + dataURL 图片）
     */
    CaptchaData captcha();

    /**
     * 企业自助注册（建租户 + 企业主体 + 管理员账号 + 签发 token）。
     *
     * @param req 注册请求
     * @return 登录响应（token + user）
     */
    LoginResponse partnerRegister(PartnerRegisterRequest req);

    /**
     * Partner 端当前用户信息（user + 企业主体 + 角色）。
     *
     * @param userId 当前用户 ID
     * @return Partner me 响应
     */
    PartnerMeResponse partnerMe(String userId);
}

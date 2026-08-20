package org.dromara.zhiyu.core.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * zhiyu 模块 Web MVC 配置：注册服务端授权拦截器（/api/v1/**）。
 *
 * <p>zhiyu 业务接口不走框架 SaInterceptor（security.excludes 已排除 /api/v1/**），
 * 鉴权/授权由 {@link ZhiyuAuthFilter}（登录 + 活跃校验）与
 * {@link ZhiyuAuthzInterceptor}（菜单/平台/角色授权）承担。</p>
 *
 * @author zhiyu
 */
@Configuration
@RequiredArgsConstructor
public class ZhiyuWebConfig implements WebMvcConfigurer {

    private final ZhiyuAuthzInterceptor zhiyuAuthzInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(zhiyuAuthzInterceptor).addPathPatterns("/api/v1/**");
    }
}

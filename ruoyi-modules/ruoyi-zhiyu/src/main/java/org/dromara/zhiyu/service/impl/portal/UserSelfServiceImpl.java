package org.dromara.zhiyu.service.impl.portal;

import cn.dev33.satoken.stp.StpUtil;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.AuthDtos.ZhiyuUserView;
import org.dromara.zhiyu.domain.dto.portal.UserSelfDtos.ChangeMyPasswordRequest;
import org.dromara.zhiyu.domain.dto.portal.UserSelfDtos.UpdateMeRequest;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.service.portal.IUserSelfService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;

/**
 * 个人中心自助修改服务实现（对齐 Go UpdateMe/ChangeMyPassword：密码强度校验 + bcrypt + 租户 SQL 级限定）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class UserSelfServiceImpl implements IUserSelfService {

    private final ZhiyuUserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public ZhiyuUserView updateMe(UpdateMeRequest req) {
        String userId = requireUser();
        if (req.getName() == null || req.getName().isBlank()) {
            throw new ApiException(400, "bad_request", "姓名不能为空");
        }
        ZhiyuUser patch = new ZhiyuUser();
        patch.setName(req.getName());
        userMapper.update(patch, QueryBuilder.lambda(ZhiyuUser.class).eq(ZhiyuUser::getId, userId).build());

        ZhiyuUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new ApiException(500, "server_error", "更新后查询用户失败");
        }
        return toUserView(user);
    }

    @Override
    public String changeMyPassword(ChangeMyPasswordRequest req) {
        String userId = requireUser();
        if (req.getNewPassword() == null || req.getNewPassword().isBlank()) {
            throw new ApiException(400, "bad_request", "密码不能为空");
        }
        if (!isStrongPassword(req.getNewPassword())) {
            throw new ApiException(400, "bad_request", "密码长度至少 8 位，且需同时包含字母和数字");
        }
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        // 对齐 Go ResetPassword：bcrypt + 记录改密时间 + 租户 SQL 级限定
        ZhiyuUser patch = new ZhiyuUser();
        patch.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        patch.setPasswordChangedAt(OffsetDateTime.now());
        userMapper.update(patch,
            QueryBuilder.lambda(ZhiyuUser.class)
                .eq(ZhiyuUser::getId, userId)
                .eq(ZhiyuUser::getTenantId, tenantId)
                .build());
        // 对齐 Go RequireActiveUser：改密后旧 token 立即失效（踢出该用户全部会话）
        StpUtil.kickout(userId);
        return userId;
    }

    /** 密码强度：至少 8 位且同时包含字母和数字（对齐 Go isStrongPassword） */
    private boolean isStrongPassword(String password) {
        if (password.length() < 8) {
            return false;
        }
        boolean hasLetter = false;
        boolean hasDigit = false;
        for (char c : password.toCharArray()) {
            if (Character.isLetter(c)) {
                hasLetter = true;
            } else if (Character.isDigit(c)) {
                hasDigit = true;
            }
        }
        return hasLetter && hasDigit;
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(401, "unauthorized", "未登录或登录已过期");
        }
        return userId;
    }

    private ZhiyuUserView toUserView(ZhiyuUser u) {
        ZhiyuUserView v = new ZhiyuUserView();
        v.setId(u.getId());
        v.setTenantId(u.getTenantId());
        v.setInstitutionId(u.getInstitutionId());
        v.setOrgNodeId(u.getOrgNodeId());
        v.setMajorId(u.getMajorId());
        v.setRole(u.getRole());
        v.setPlatform(u.getPlatform());
        v.setLoginName(u.getLoginName());
        v.setUsername(u.getUsername());
        v.setName(u.getName());
        v.setEmail(u.getEmail());
        v.setPhone(u.getPhone());
        v.setAvatarUrl(u.getAvatarUrl());
        v.setStudentNo(u.getStudentNo());
        v.setWorkId(u.getWorkId());
        v.setIdCard(u.getIdCard());
        v.setStatus(u.getStatus());
        v.setLastLoginAt(u.getLastLoginAt());
        v.setCreatedAt(u.getCreatedAt());
        v.setUpdatedAt(u.getUpdatedAt());
        v.setGraduateYear(u.getGraduateYear());
        return v;
    }
}

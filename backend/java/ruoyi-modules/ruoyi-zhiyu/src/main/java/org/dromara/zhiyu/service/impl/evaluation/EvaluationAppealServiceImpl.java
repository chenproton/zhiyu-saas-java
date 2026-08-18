package org.dromara.zhiyu.service.impl.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.AppealDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateAppealRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ProcessAppealRequest;
import org.dromara.zhiyu.domain.evaluation.EvaluationAppeal;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationAppealMapper;
import org.dromara.zhiyu.service.evaluation.IEvaluationAppealService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 申诉服务实现（对齐 Go appeal_handler.go + store/appeal.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class EvaluationAppealServiceImpl implements IEvaluationAppealService {

    private final EvaluationAppealMapper appealMapper;
    private final ZhiyuUserMapper userMapper;

    @Override
    public ListResponse<AppealDto> list(String type, String status, long limit, long offset) {
        String tenantId = requireTenant();
        requireUser();
        List<EvaluationAppeal> rows = appealMapper.selectAppeals(tenantId, type, status);
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        long total = rows.size();
        int from = (int) Math.min(safeOffset, rows.size());
        int to = (int) Math.min(safeOffset + safeLimit, rows.size());
        List<AppealDto> items = rows.subList(from, to).stream().map(this::toDto).toList();
        return ListResponse.of(items, total);
    }

    @Override
    public AppealDto get(String id) {
        requireTenant();
        requireUser();
        EvaluationAppeal appeal = verifyOwnedAppeal(id);
        return toDto(appeal);
    }

    @Override
    public AppealDto create(CreateAppealRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (isBlank(req.getUserId()) || isBlank(req.getType()) || isBlank(req.getReason())) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        ZhiyuUser user = userMapper.selectById(req.getUserId());
        if (user == null || user.getTenantId() == null || !user.getTenantId().equals(tenantId)) {
            throw new ApiException(404, "not_found", "用户不存在");
        }
        String id = UUID.randomUUID().toString();
        appealMapper.insertAppeal(id, tenantId, req.getUserId(), req.getType(), req.getReason());
        return toDto(appealMapper.selectAppeal(id));
    }

    @Override
    public AppealDto process(String id, ProcessAppealRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (isBlank(req.getStatus())) {
            throw new ApiException(400, "bad_request", "缺少状态");
        }
        if (!"approved".equals(req.getStatus()) && !"rejected".equals(req.getStatus())) {
            throw new ApiException(400, "bad_request", "状态仅支持 approved/rejected");
        }
        if (isStudent()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        verifyOwnedAppeal(id);
        appealMapper.updateStatus(id, tenantId, req.getStatus());
        return toDto(appealMapper.selectAppeal(id));
    }

    private EvaluationAppeal verifyOwnedAppeal(String id) {
        String tenantId = TenantContext.getTenantId();
        String appealTenantId = appealMapper.selectTenantId(id);
        if (appealTenantId == null || !appealTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "申诉不存在");
        }
        EvaluationAppeal appeal = appealMapper.selectAppeal(id);
        if (appeal == null) {
            throw new ApiException(404, "not_found", "申诉不存在");
        }
        return appeal;
    }

    private AppealDto toDto(EvaluationAppeal a) {
        AppealDto dto = new AppealDto();
        dto.setId(a.getId());
        dto.setUserId(a.getUserId());
        dto.setType(a.getType());
        dto.setReason(a.getReason());
        dto.setStatus(a.getStatus());
        dto.setCreatedAt(a.getCreatedAt());
        return dto;
    }

    private boolean isStudent() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return false;
        }
        try {
            ZhiyuUser user = userMapper.selectById(userId);
            return user != null && "student".equals(user.getRole());
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private long clampLimit(long limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }
}

package org.dromara.zhiyu.service.impl.library;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.OnSiteQuestionItemDto;
import org.dromara.zhiyu.domain.dto.library.LibraryDtos.OnSiteQuestionRequest;
import org.dromara.zhiyu.domain.library.LibraryOnSiteQuestion;
import org.dromara.zhiyu.mapper.library.LibraryOnSiteQuestionMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.library.ILibraryOnSiteQuestionService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 现场题库服务实现（对齐 Go on_site_question_library_handler.go + crud.go 语义）。
 *
 * <p>学生角色（roles.code = student，经 user_roles 关联查询）列表/详情不下发
 * 答案与分值（stripAnswerForStudents）；更新为部分更新：null 保留原值，
 * 空数组显式清空。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LibraryOnSiteQuestionServiceImpl implements ILibraryOnSiteQuestionService {

    /** 列表默认页大小（对齐 Go ListConfig.DefaultLimit=50） */
    private static final int DEFAULT_LIMIT = 50;

    private static final String ROLE_STUDENT = "student";

    private final SystemGuard systemGuard;
    private final LibraryOnSiteQuestionMapper questionMapper;

    @Override
    public ListResponse<OnSiteQuestionItemDto> list(String search, int limit, int offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = clampLimit(limit, DEFAULT_LIMIT);
        long safeOffset = Math.max(offset, 0);
        String pattern = toLikePattern(search);

        long total = questionMapper.countQuestionPage(tenantId, pattern);
        List<LibraryOnSiteQuestion> rows = questionMapper.selectQuestionPage(tenantId, pattern,
            (int) safeLimit, (int) safeOffset);
        List<OnSiteQuestionItemDto> items = rows.stream().map(this::toDto).toList();
        if (isStudentUser()) {
            items.forEach(this::stripAnswerForStudent);
        }
        return ListResponse.of(items, total);
    }

    @Override
    public OnSiteQuestionItemDto get(String id) {
        systemGuard.requireUser();
        LibraryOnSiteQuestion item = fetchOwned(id);
        OnSiteQuestionItemDto dto = toDto(item);
        if (isStudentUser()) {
            stripAnswerForStudent(dto);
        }
        return dto;
    }

    @Override
    public OnSiteQuestionItemDto create(OnSiteQuestionRequest req) {
        systemGuard.requireUser();
        if (req.getQuestionText() == null || req.getQuestionText().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();

        String id = UUID.randomUUID().toString();
        questionMapper.insertQuestion(id, tenantId, req.getQuestionText(), req.getAnswer(),
            req.getQuestionType() == null ? "" : req.getQuestionType(),
            req.getScore() == null ? 0.0 : req.getScore(),
            req.getDifficulty(),
            req.getKnowledgePointIds() == null ? List.of() : req.getKnowledgePointIds(),
            req.getTags() == null ? List.of() : req.getTags(),
            userId);
        LibraryOnSiteQuestion created = questionMapper.selectById(id);
        if (created == null) {
            throw new ApiException(500, "internal_error", "创建题目失败");
        }
        return toDto(created);
    }

    @Override
    public OnSiteQuestionItemDto update(String id, OnSiteQuestionRequest req) {
        systemGuard.requireUser();
        LibraryOnSiteQuestion existing = fetchOwned(id);
        // 部分更新：未传字段回填现有值，避免清空（对齐 Go crud UpdateFn）
        String questionText = req.getQuestionText() != null ? req.getQuestionText() : existing.getQuestionText();
        String answer = req.getAnswer() != null ? req.getAnswer() : existing.getAnswer();
        String questionType = req.getQuestionType() != null ? req.getQuestionType() : existing.getQuestionType();
        Double score = req.getScore() != null ? req.getScore() : existing.getScore();
        String difficulty = req.getDifficulty() != null ? req.getDifficulty() : existing.getDifficulty();
        List<String> knowledgePointIds = req.getKnowledgePointIds() != null
            ? req.getKnowledgePointIds() : existing.getKnowledgePointIds();
        List<String> tags = req.getTags() != null ? req.getTags() : existing.getTags();

        questionMapper.updateQuestion(id, questionText, answer, questionType, score, difficulty,
            knowledgePointIds == null ? List.of() : knowledgePointIds, tags == null ? List.of() : tags);
        LibraryOnSiteQuestion updated = questionMapper.selectById(id);
        if (updated == null) {
            throw new ApiException(500, "internal_error", "更新题目失败");
        }
        return toDto(updated);
    }

    @Override
    public String delete(String id) {
        systemGuard.requireUser();
        fetchOwned(id);
        questionMapper.deleteQuestion(id);
        return id;
    }

    // ---------- 组装/工具 ----------

    private LibraryOnSiteQuestion fetchOwned(String id) {
        LibraryOnSiteQuestion item = questionMapper.selectById(id);
        if (item == null) {
            throw new ApiException(404, "not_found", "题目不存在");
        }
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (!tenantId.equals(item.getTenantId())) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
        return item;
    }

    private OnSiteQuestionItemDto toDto(LibraryOnSiteQuestion q) {
        OnSiteQuestionItemDto dto = new OnSiteQuestionItemDto();
        dto.setId(q.getId());
        dto.setTenantId(q.getTenantId());
        dto.setQuestionText(q.getQuestionText());
        dto.setAnswer(q.getAnswer());
        dto.setQuestionType(q.getQuestionType());
        dto.setScore(q.getScore() == null ? 0.0 : q.getScore());
        dto.setDifficulty(q.getDifficulty());
        dto.setKnowledgePointIds(q.getKnowledgePointIds());
        dto.setTags(q.getTags());
        dto.setCreatorId(q.getCreatorId());
        dto.setCreatedAt(q.getCreatedAt());
        dto.setUpdatedAt(q.getUpdatedAt());
        return dto;
    }

    /** 学生视角隐藏答案/分值（对齐 Go stripAnswerForStudents） */
    private void stripAnswerForStudent(OnSiteQuestionItemDto dto) {
        dto.setAnswer(null);
        dto.setScore(0.0);
    }

    /** 当前用户是否为学生角色（对齐 Go claims.RoleCodes 含 student 判定） */
    private boolean isStudentUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return false;
        }
        List<String> roleCodes = questionMapper.selectRoleCodesByUserId(userId);
        return roleCodes != null && roleCodes.contains(ROLE_STUDENT);
    }

    /** 转义 LIKE 通配符并包裹 %pattern%（对齐 Go ListQueryBuilder 转义语义） */
    private String toLikePattern(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        String escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private long clampLimit(int limit, int defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }

}

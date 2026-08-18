package org.dromara.zhiyu.service.impl.evaluation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateStudentArchiveRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.GeneratePortraitRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.PortraitCourseItem;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.PortraitPositionItem;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentAbilityArchiveDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentAbilityPortraitDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentDashboardDto;
import org.dromara.zhiyu.domain.evaluation.EvaluationStudentArchive;
import org.dromara.zhiyu.domain.evaluation.EvaluationStudentPortrait;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationArchiveMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationJobAbilityMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationPortraitMapper;
import org.dromara.zhiyu.service.evaluation.IEvaluationPortraitService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 学生能力画像/档案服务实现（对齐 Go student_portrait_handler.go +
 * service/evaluation_portrait.go + store/student_portraits.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class EvaluationPortraitServiceImpl implements IEvaluationPortraitService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };

    private final EvaluationPortraitMapper portraitMapper;
    private final EvaluationArchiveMapper archiveMapper;
    private final EvaluationJobAbilityMapper jobAbilityMapper;
    private final EvaluationJobAbilityServiceImpl jobAbilityService;
    private final ZhiyuUserMapper userMapper;

    @Override
    public ListResponse<StudentAbilityPortraitDto> listPortraits(String userId, String careerPositionId,
                                                                 long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<EvaluationStudentPortrait> wrapper = QueryBuilder.lambda(EvaluationStudentPortrait.class)
            .eq(EvaluationStudentPortrait::getTenantId, tenantId);
        // 学生仅可查看本人的画像
        if (isStudent()) {
            wrapper.eq(EvaluationStudentPortrait::getUserId, requireUser());
        } else {
            if (userId != null && !userId.isBlank()) {
                wrapper.eq(EvaluationStudentPortrait::getUserId, userId);
            }
        }
        if (careerPositionId != null && !careerPositionId.isBlank()) {
            wrapper.eq(EvaluationStudentPortrait::getCareerPositionId, careerPositionId);
        }
        long total = portraitMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationStudentPortrait::getUpdatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationStudentPortrait> rows = portraitMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toPortraitDto).toList(), total);
    }

    @Override
    public StudentAbilityPortraitDto getPortrait(String id) {
        String tenantId = requireTenant();
        requireUser();
        EvaluationStudentPortrait p = portraitMapper.selectOne(QueryBuilder.lambda(EvaluationStudentPortrait.class)
            .eq(EvaluationStudentPortrait::getId, id)
            .eq(EvaluationStudentPortrait::getTenantId, tenantId).build());
        if (p == null) {
            throw new ApiException(404, "not_found", "学生画像不存在");
        }
        // 学生仅可查看本人的画像
        if (isStudent() && !requireUser().equals(p.getUserId())) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return toPortraitDto(p);
    }

    @Override
    public StudentAbilityPortraitDto generatePortrait(GeneratePortraitRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (req.getUserId() == null || req.getUserId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少岗位ID");
        }
        // 学生本人只能生成自己的画像；请求体中的 userId 必须属于当前租户
        if (isStudent() && !req.getUserId().equals(userId)) {
            throw new ApiException(403, "forbidden", "仅可生成本人的画像");
        }
        if (!portraitMapper.userInTenant(req.getUserId(), tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：用户不属于您的租户");
        }
        // 先对该 (user, careerPosition) 执行岗位能力汇聚，同步生成/更新画像
        try {
            jobAbilityService.aggregatePosition(tenantId, req.getCareerPositionId(), List.of(req.getUserId()));
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "生成画像失败");
        }
        EvaluationStudentPortrait p = portraitMapper.selectOne(QueryBuilder.lambda(EvaluationStudentPortrait.class)
            .eq(EvaluationStudentPortrait::getUserId, req.getUserId())
            .eq(EvaluationStudentPortrait::getCareerPositionId, req.getCareerPositionId()).build());
        if (p == null) {
            // 无结果时返回空画像（对齐 Go 兜底结构）
            StudentAbilityPortraitDto dto = new StudentAbilityPortraitDto();
            dto.setUserId(req.getUserId());
            dto.setCareerPositionId(req.getCareerPositionId());
            dto.setDomainScores(new ArrayList<>());
            dto.setCourseRecords(new ArrayList<>());
            dto.setRecommendPositions(new ArrayList<>());
            return dto;
        }
        return toPortraitDto(p);
    }

    @Override
    public ListResponse<StudentAbilityArchiveDto> listArchives(String userId, String materialType,
                                                               long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<EvaluationStudentArchive> wrapper = QueryBuilder.lambda(EvaluationStudentArchive.class)
            .eq(EvaluationStudentArchive::getTenantId, tenantId);
        if (userId != null && !userId.isBlank()) {
            wrapper.eq(EvaluationStudentArchive::getUserId, userId);
        }
        if (materialType != null && !materialType.isBlank()) {
            wrapper.eq(EvaluationStudentArchive::getMaterialType, materialType);
        }
        long total = archiveMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationStudentArchive::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationStudentArchive> rows = archiveMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toArchiveDto).toList(), total);
    }

    @Override
    public StudentAbilityArchiveDto createArchive(CreateStudentArchiveRequest req) {
        String tenantId = requireTenant();
        requireUser();
        if (req.getUserId() == null || req.getUserId().isEmpty() || req.getMaterialName() == null
            || req.getMaterialName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 归档所属学生必须属于当前租户（防跨租户写他人档案）
        if (!portraitMapper.userInTenant(req.getUserId(), tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：学生不属于您的租户");
        }
        String direction = req.getDirection() == null || req.getDirection().isEmpty() ? "positive" : req.getDirection();
        String id = UUID.randomUUID().toString();
        archiveMapper.insertArchive(id, tenantId, req.getUserId(), emptyToNull(req.getMaterialType()),
            req.getMaterialName(), emptyToNull(req.getIssuingOrg()), parseDate(req.getObtainDate()), direction);
        EvaluationStudentArchive saved = archiveMapper.selectOne(QueryBuilder.lambda(EvaluationStudentArchive.class)
            .eq(EvaluationStudentArchive::getId, id).build());
        return toArchiveDto(saved);
    }

    @Override
    public String deleteArchive(String id) {
        String tenantId = requireTenant();
        requireUser();
        int rows = archiveMapper.delete(QueryBuilder.lambda(EvaluationStudentArchive.class)
            .eq(EvaluationStudentArchive::getId, id)
            .eq(EvaluationStudentArchive::getTenantId, tenantId).build());
        if (rows == 0) {
            throw new ApiException(404, "not_found", "学生档案不存在");
        }
        return id;
    }

    @Override
    public StudentDashboardDto studentDashboard(String userId) {
        String tenantId = requireTenant();
        String currentUser = requireUser();
        String effectiveUserId = userId;
        // 学生仅可查看本人数据
        if (isStudent()) {
            effectiveUserId = currentUser;
        }
        if (effectiveUserId == null || effectiveUserId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        StudentDashboardDto resp = new StudentDashboardDto();
        resp.setPositions(new ArrayList<>());
        resp.setCourses(new ArrayList<>());

        resp.setSceneCount(jobAbilityMapper.countStudentScenes(tenantId, effectiveUserId));

        ZhiyuUser user = userMapper.selectById(effectiveUserId);
        String orgNodeId = user == null ? null : user.getOrgNodeId();
        if (orgNodeId != null && !orgNodeId.isBlank()) {
            for (Map<String, Object> row : jobAbilityMapper.listScenePositions(tenantId, orgNodeId)) {
                PortraitPositionItem item = new PortraitPositionItem();
                item.setPositionId(str(row.get("position_id")));
                item.setPositionName(str(row.get("position_name")));
                resp.getPositions().add(item);
            }
            Map<String, Map<String, Object>> scoreMap = new HashMap<>();
            for (Map<String, Object> row : jobAbilityMapper.listStudentCourseScores(tenantId, effectiveUserId)) {
                scoreMap.put(str(row.get("course_id")), row);
            }
            for (Map<String, Object> course : jobAbilityMapper.listStudentCourses(tenantId, orgNodeId)) {
                PortraitCourseItem item = new PortraitCourseItem();
                String courseId = str(course.get("id"));
                item.setCourseId(courseId);
                item.setCourseName(str(course.get("name")));
                Map<String, Object> sc = scoreMap.get(courseId);
                if (sc != null) {
                    BigDecimal score = decOrNull(sc.get("score"));
                    item.setScore(score == null ? null : score.doubleValue());
                    item.setRank(intOrNull(sc.get("rank")));
                    item.setTotal(intOrNull(sc.get("total")));
                }
                resp.getCourses().add(item);
            }
        }
        return resp;
    }

    // ==================== 组装 ====================

    private StudentAbilityPortraitDto toPortraitDto(EvaluationStudentPortrait p) {
        if (p == null) {
            return null;
        }
        StudentAbilityPortraitDto dto = new StudentAbilityPortraitDto();
        dto.setId(p.getId());
        dto.setUserId(p.getUserId());
        dto.setCareerPositionId(p.getCareerPositionId());
        dto.setOverallGrade(p.getOverallGrade());
        dto.setDomainScores(parseObjectList(p.getDomainScores()));
        dto.setClassRank(p.getClassRank());
        dto.setClassTotal(p.getClassTotal());
        dto.setMajorRank(p.getMajorRank());
        dto.setMajorTotal(p.getMajorTotal());
        dto.setCompletedCourses(p.getCompletedCourses());
        dto.setCompletedScenes(p.getCompletedScenes());
        dto.setTotalCredits(p.getTotalCredits());
        dto.setCourseRecords(parseObjectList(p.getCourseRecords()));
        dto.setGraduationQualified(p.getGraduationQualified());
        dto.setAttendanceRate(p.getAttendanceRate());
        dto.setDiplomaBadge(p.getDiplomaBadge());
        dto.setDualBadge(p.getDualBadge());
        dto.setArchiveCount(p.getArchiveCount());
        dto.setRecommendPositions(parseObjectList(p.getRecommendPositions()));
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    private StudentAbilityArchiveDto toArchiveDto(EvaluationStudentArchive a) {
        if (a == null) {
            return null;
        }
        StudentAbilityArchiveDto dto = new StudentAbilityArchiveDto();
        dto.setId(a.getId());
        dto.setUserId(a.getUserId());
        dto.setMaterialType(a.getMaterialType());
        dto.setMaterialName(a.getMaterialName());
        dto.setIssuingOrg(a.getIssuingOrg());
        dto.setObtainDate(a.getObtainDate() == null ? null : a.getObtainDate().toString());
        dto.setLevel(a.getLevel());
        dto.setAuditStatus(a.getAuditStatus());
        dto.setAuditRemark(a.getAuditRemark());
        dto.setConvertedCredit(a.getConvertedCredit());
        dto.setDirection(a.getDirection());
        dto.setIsEnabled(a.getIsEnabled());
        dto.setCreatedAt(a.getCreatedAt());
        return dto;
    }

    // ==================== 内部 ====================

    private List<Object> parseObjectList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<Object> v = MAPPER.readValue(json, OBJECT_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(s);
        } catch (Exception e) {
            return null;
        }
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

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }

    private Integer intOrNull(Object o) {
        return o == null ? null : ((Number) o).intValue();
    }

    private BigDecimal decOrNull(Object o) {
        return o == null ? null : new BigDecimal(o.toString());
    }
}

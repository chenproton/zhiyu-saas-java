package org.dromara.zhiyu.service.impl.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.affairs.TrainingProgram;
import org.dromara.zhiyu.domain.affairs.TrainingProgramCourse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ProgramCoursePayload;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PutProgramCoursesRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramCourseDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramPayload;
import org.dromara.zhiyu.domain.job.JobBatch;
import org.dromara.zhiyu.domain.portal.PortalCareerPosition;
import org.dromara.zhiyu.domain.lesson.LessonCourse;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.affairs.TrainingProgramCourseMapper;
import org.dromara.zhiyu.mapper.affairs.TrainingProgramMapper;
import org.dromara.zhiyu.mapper.job.JobBatchMapper;
import org.dromara.zhiyu.mapper.portal.PortalCareerPositionMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.affairs.ITrainingProgramService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 人才培养方案服务实现（对齐 Go training_program_handler.go + store/training_programs.go +
 * content_actions.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class TrainingProgramServiceImpl implements ITrainingProgramService {

    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SystemGuard systemGuard;
    private final TrainingProgramMapper programMapper;
    private final TrainingProgramCourseMapper courseMapper;
    private final PortalMajorMapper majorMapper;
    private final ZhiyuUserMapper userMapper;
    private final JobBatchMapper batchMapper;
    private final PortalCareerPositionMapper positionMapper;
    private final LessonCourseMapper portalCourseMapper;

    // ---------- 列表 / 详情 ----------

    @Override
    public ListResponse<TrainingProgramDto> list(String search, String status, String majorId, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = clampLimit(limit);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<TrainingProgram> wrapper = QueryBuilder.lambda(TrainingProgram.class)
            .eq(TrainingProgram::getTenantId, tenantId)
            .eqIfText(TrainingProgram::getStatus, status)
            .eqIfText(TrainingProgram::getMajorId, majorId);
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(TrainingProgram::getName, search).or().like(TrainingProgram::getCode, search));
        }
        long total = programMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(TrainingProgram::getEntryYear).orderByDesc(TrainingProgram::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<TrainingProgram> rows = programMapper.selectList(wrapper.build());
        return ListResponse.of(assembleList(rows), total);
    }

    @Override
    public TrainingProgramDto get(String id) {
        return toDto(fetchOwned(id));
    }

    // ---------- 创建 / 更新 / 删除 ----------

    @Override
    public TrainingProgramDto create(TrainingProgramPayload p) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (p.getName() == null || p.getName().isEmpty() || p.getEntryYear() == null || p.getEntryYear() <= 0) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String code = p.getCode() == null || p.getCode().isEmpty() ? generateUniqueCode(tenantId) : p.getCode();
        TrainingProgram program = new TrainingProgram();
        program.setTenantId(tenantId);
        program.setName(p.getName());
        program.setCode(code);
        program.setMajorId(emptyToNull(p.getMajorId()));
        program.setEntryYear(p.getEntryYear());
        program.setLevel(emptyToNull(p.getLevel()));
        program.setDuration(p.getDuration());
        program.setTotalCredits(p.getTotalCredits() == null ? null : BigDecimal.valueOf(p.getTotalCredits()));
        program.setStatus(ZhiyuStatusConstants.DRAFT);
        program.setDescription(emptyToNull(p.getDescription()));
        program.setBatchId(emptyToNull(p.getBatchId()));
        program.setCreatedBy(userId);
        program.setCollaborators(new ArrayList<>());
        programMapper.insert(program);
        return toDto(fetchOwned(program.getId()));
    }

    @Override
    public TrainingProgramDto update(String id, TrainingProgramPayload p) {
        systemGuard.requireUser();
        TrainingProgram existing = fetchOwned(id);
        if (p.getName() != null && !p.getName().isEmpty()) {
            existing.setName(p.getName());
        }
        if (p.getEntryYear() != null && p.getEntryYear() > 0) {
            existing.setEntryYear(p.getEntryYear());
        }
        if (p.getCode() != null) {
            existing.setCode(emptyToNull(p.getCode()));
        }
        if (p.getMajorId() != null) {
            existing.setMajorId(emptyToNull(p.getMajorId()));
        }
        if (p.getLevel() != null) {
            existing.setLevel(emptyToNull(p.getLevel()));
        }
        if (p.getDuration() != null) {
            existing.setDuration(p.getDuration());
        }
        if (p.getTotalCredits() != null) {
            existing.setTotalCredits(BigDecimal.valueOf(p.getTotalCredits()));
        }
        if (p.getDescription() != null) {
            existing.setDescription(emptyToNull(p.getDescription()));
        }
        if (p.getBatchId() != null) {
            existing.setBatchId(emptyToNull(p.getBatchId()));
        }
        existing.setUpdatedAt(java.time.OffsetDateTime.now());
        programMapper.updateById(existing);
        return toDto(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        systemGuard.requireUser();
        fetchOwned(id);
        programMapper.deleteById(id);
        return id;
    }

    // ---------- 内容动作 ----------

    @Override
    public TrainingProgramDto submit(String id) {
        return transition(id, ZhiyuStatusConstants.PENDING);
    }

    @Override
    public TrainingProgramDto archive(String id) {
        return transition(id, "archived");
    }

    @Override
    public TrainingProgramDto unpublish(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    public TrainingProgramDto withdraw(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    public TrainingProgramDto saveDraft(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    public TrainingProgramDto publish(String id, String status) {
        String to = status == null || status.isEmpty() ? ZhiyuStatusConstants.PUBLISHED : status;
        if (!ZhiyuStatusConstants.DRAFT.equals(to) && !ZhiyuStatusConstants.PUBLISHED.equals(to)) {
            throw new ApiException(400, "bad_request", "状态仅支持 draft/published");
        }
        TrainingProgram existing = fetchOwnedAction(id);
        if (to.equals(existing.getStatus())) {
            return toDto(existing);
        }
        return transition(id, to);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TrainingProgramDto review(String id, ReviewRequest req) {
        systemGuard.requireUser();
        String to;
        if (ZhiyuStatusConstants.APPROVED.equals(req.getStatus())) {
            to = ZhiyuStatusConstants.APPROVED;
        } else if (ZhiyuStatusConstants.REJECTED.equals(req.getStatus())) {
            to = ZhiyuStatusConstants.REJECTED;
        } else {
            throw new ApiException(400, "bad_request", "无效的审核状态");
        }
        TrainingProgram program = fetchOwnedAction(id);
        String tenantId = systemGuard.requireTenant();
        int rows = programMapper.casReview(id, tenantId, to);
        if (rows == 0) {
            throw new ApiException(400, "bad_request", "人培方案不存在或不在待处理状态");
        }
        return toDto(fetchOwnedAction(id));
    }

    @Override
    public TrainingProgramDto invite(String id, InviteRequest req) {
        systemGuard.requireUser();
        fetchOwnedAction(id);
        if (req.getUserId() == null || req.getUserId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        String tenantId = systemGuard.requireTenant();
        ZhiyuUser user = userMapper.selectById(req.getUserId());
        if (user == null || !tenantId.equals(user.getTenantId())) {
            throw new ApiException(400, "bad_request", "用户不存在或不属于本租户");
        }
        programMapper.inviteCollaborator(id, req.getUserId());
        return toDto(fetchOwnedAction(id));
    }

    // ---------- 课程 / 克隆 ----------

    @Override
    public ListResponse<TrainingProgramCourseDto> listCourses(String id) {
        String tenantId = systemGuard.requireTenant();
        fetchOwned(id);
        List<TrainingProgramCourse> rows = courseMapper.selectList(
            QueryBuilder.lambda(TrainingProgramCourse.class)
                .eq(TrainingProgramCourse::getProgramId, id)
                .orderByAsc(TrainingProgramCourse::getSortOrder, TrainingProgramCourse::getId).build());
        return ListResponse.of(assembleCourses(rows), rows.size());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ListResponse<TrainingProgramCourseDto> putCourses(String id, PutProgramCoursesRequest req) {
        systemGuard.requireTenant();
        fetchOwned(id);
        List<ProgramCoursePayload> list = req.getCourses() == null ? List.of() : req.getCourses();

        // 名称回查：按 ID 批量取（避免逐条 N+1）
        Set<String> positionIds = new LinkedHashSet<>();
        Set<String> courseIds = new LinkedHashSet<>();
        for (ProgramCoursePayload c : list) {
            if ((c.getName() == null || c.getName().isEmpty()) && notEmpty(c.getPositionId())) {
                positionIds.add(c.getPositionId());
            }
            if ((c.getName() == null || c.getName().isEmpty()) && notEmpty(c.getCourseId())) {
                courseIds.add(c.getCourseId());
            }
        }
        Map<String, String> positionNames = positionIds.isEmpty() ? Map.of() : nameMap(positionMapper.selectList(
            QueryBuilder.lambda(PortalCareerPosition.class).in(PortalCareerPosition::getId, new ArrayList<>(positionIds)).build()));
        Map<String, String> courseNames = courseIds.isEmpty() ? Map.of() : nameMap(portalCourseMapper.selectList(
            QueryBuilder.lambda(LessonCourse.class).in(LessonCourse::getId, new ArrayList<>(courseIds)).build()));

        courseMapper.deleteByProgram(id);
        int idx = 0;
        for (ProgramCoursePayload c : list) {
            if (!notEmpty(c.getPositionId()) && !notEmpty(c.getCourseId())) {
                throw new ApiException(400, "bad_request", "须至少关联岗位或体系课");
            }
            String name = c.getName();
            if ((name == null || name.isEmpty()) && notEmpty(c.getPositionId())) {
                name = positionNames.getOrDefault(c.getPositionId(), "");
            }
            if ((name == null || name.isEmpty()) && notEmpty(c.getCourseId())) {
                name = courseNames.getOrDefault(c.getCourseId(), "");
            }
            String nature = c.getNature() == null || c.getNature().isEmpty() ? "必修" : c.getNature();
            int semester = c.getSemester() == null || c.getSemester() <= 0 ? 1 : c.getSemester();
            int sortOrder = c.getSortOrder() == null || c.getSortOrder() == 0 ? idx : c.getSortOrder();

            TrainingProgramCourse row = new TrainingProgramCourse();
            row.setProgramId(id);
            row.setName(name);
            row.setCode(emptyToNull(c.getCode()));
            row.setCredits(c.getCredits() == null ? null : BigDecimal.valueOf(c.getCredits()));
            row.setHours(c.getHours());
            row.setSemester(semester);
            row.setNature(nature);
            row.setAssessment(emptyToNull(c.getAssessment()));
            row.setPositionId(emptyToNull(c.getPositionId()));
            row.setCourseId(emptyToNull(c.getCourseId()));
            row.setSortOrder(sortOrder);
            courseMapper.insert(row);
            idx++;
        }
        programMapper.touchUpdatedAt(id);
        return listCourses(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TrainingProgramDto clone(String id, CloneRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        TrainingProgram src = fetchOwned(id);
        String newName = req != null && req.getName() != null && !req.getName().isEmpty()
            ? req.getName() : src.getName() + " (克隆)";
        String newId = UUID.randomUUID().toString();
        TrainingProgram program = new TrainingProgram();
        program.setId(newId);
        program.setTenantId(tenantId);
        program.setName(newName);
        program.setCode(req != null && notEmpty(req.getCode()) ? req.getCode() : src.getCode());
        program.setMajorId(src.getMajorId());
        program.setEntryYear(src.getEntryYear());
        program.setLevel(src.getLevel());
        program.setDuration(src.getDuration());
        program.setTotalCredits(src.getTotalCredits());
        program.setStatus(ZhiyuStatusConstants.DRAFT);
        program.setDescription(src.getDescription());
        program.setCreatedBy(userId);
        program.setCollaborators(new ArrayList<>());
        programMapper.insert(program);
        programMapper.cloneCourses(newId, id);
        return toDto(fetchOwned(newId));
    }

    // ---------- 组装 ----------

    private List<TrainingProgramDto> assembleList(List<TrainingProgram> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> ids = rows.stream().map(TrainingProgram::getId).toList();
        Set<String> majorIds = new LinkedHashSet<>();
        Set<String> creatorIds = new LinkedHashSet<>();
        Set<String> collaboratorIds = new LinkedHashSet<>();
        Set<String> batchIds = new LinkedHashSet<>();
        for (TrainingProgram p : rows) {
            if (p.getMajorId() != null) {
                majorIds.add(p.getMajorId());
            }
            if (p.getCreatedBy() != null) {
                creatorIds.add(p.getCreatedBy());
            }
            if (p.getCollaborators() != null) {
                collaboratorIds.addAll(p.getCollaborators());
            }
            if (p.getBatchId() != null) {
                batchIds.add(p.getBatchId());
            }
        }
        Map<String, String> majorNames = nameMapOrEmpty(majorIds.isEmpty() ? List.of() : majorMapper.selectList(
            QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, new ArrayList<>(majorIds)).build()));
        Map<String, String> userNames = nameMapOrEmpty(collaboratorIds.isEmpty() ? List.of() : userMapper.selectList(
            QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, new ArrayList<>(collaboratorIds)).build()));
        Map<String, String> batchNames = nameMapOrEmpty(batchIds.isEmpty() ? List.of() : batchMapper.selectList(
            QueryBuilder.lambda(JobBatch.class).in(JobBatch::getId, new ArrayList<>(batchIds)).build()));
        Map<String, Long> courseCounts = courseMapper.countByProgramIds(ids).stream()
            .collect(Collectors.toMap(TrainingProgramCourseMapper.ProgramCourseCount::programId,
                TrainingProgramCourseMapper.ProgramCourseCount::cnt));

        List<TrainingProgramDto> items = new ArrayList<>(rows.size());
        for (TrainingProgram p : rows) {
            TrainingProgramDto dto = toDto(p);
            dto.setMajorName(p.getMajorId() == null ? null : majorNames.getOrDefault(p.getMajorId(), ""));
            dto.setCreatedByName(p.getCreatedBy() == null ? null : userNames.get(p.getCreatedBy()));
            dto.setCollaboratorNames(p.getCollaborators() == null ? List.of()
                : p.getCollaborators().stream().map(uid -> userNames.getOrDefault(uid, "")).toList());
            dto.setBatchName(p.getBatchId() == null ? null : batchNames.getOrDefault(p.getBatchId(), ""));
            dto.setCourseCount(courseCounts.getOrDefault(p.getId(), 0L).intValue());
            items.add(dto);
        }
        return items;
    }

    private TrainingProgramDto toDto(TrainingProgram p) {
        TrainingProgramDto dto = new TrainingProgramDto();
        dto.setId(p.getId());
        dto.setName(p.getName());
        dto.setCode(p.getCode());
        dto.setMajorId(p.getMajorId());
        dto.setMajorName(p.getMajorName());
        dto.setEntryYear(p.getEntryYear());
        dto.setLevel(p.getLevel());
        dto.setDuration(p.getDuration());
        dto.setTotalCredits(p.getTotalCredits() == null ? null : p.getTotalCredits().doubleValue());
        dto.setStatus(p.getStatus());
        dto.setDescription(p.getDescription());
        dto.setCourseCount(p.getCourseCount());
        dto.setCreatedBy(p.getCreatedBy());
        dto.setCreatedByName(p.getCreatedByName());
        dto.setCollaborators(p.getCollaborators());
        dto.setCollaboratorNames(p.getCollaboratorNames());
        dto.setBatchId(p.getBatchId());
        dto.setBatchName(p.getBatchName());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    private List<TrainingProgramCourseDto> assembleCourses(List<TrainingProgramCourse> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> positionIds = new LinkedHashSet<>();
        Set<String> courseIds = new LinkedHashSet<>();
        for (TrainingProgramCourse c : rows) {
            if (c.getPositionId() != null) {
                positionIds.add(c.getPositionId());
            }
            if (c.getCourseId() != null) {
                courseIds.add(c.getCourseId());
            }
        }
        Map<String, String> positionNames = nameMapOrEmpty(positionIds.isEmpty() ? List.of() : positionMapper.selectList(
            QueryBuilder.lambda(PortalCareerPosition.class).in(PortalCareerPosition::getId, new ArrayList<>(positionIds)).build()));
        Map<String, String> courseNames = nameMapOrEmpty(courseIds.isEmpty() ? List.of() : portalCourseMapper.selectList(
            QueryBuilder.lambda(LessonCourse.class).in(LessonCourse::getId, new ArrayList<>(courseIds)).build()));

        List<TrainingProgramCourseDto> items = new ArrayList<>(rows.size());
        for (TrainingProgramCourse c : rows) {
            TrainingProgramCourseDto dto = new TrainingProgramCourseDto();
            dto.setId(c.getId());
            dto.setProgramId(c.getProgramId());
            dto.setName(c.getName());
            dto.setCode(c.getCode());
            dto.setCredits(c.getCredits() == null ? null : c.getCredits().doubleValue());
            dto.setHours(c.getHours());
            dto.setSemester(c.getSemester());
            dto.setNature(c.getNature());
            dto.setAssessment(c.getAssessment());
            dto.setPositionId(c.getPositionId());
            dto.setPositionName(c.getPositionId() == null ? null : positionNames.getOrDefault(c.getPositionId(), ""));
            dto.setCourseId(c.getCourseId());
            dto.setCourseName(c.getCourseId() == null ? null : courseNames.getOrDefault(c.getCourseId(), ""));
            dto.setSortOrder(c.getSortOrder());
            items.add(dto);
        }
        return items;
    }

    // ---------- 状态流转 ----------

    private TrainingProgramDto transition(String id, String toStatus) {
        systemGuard.requireUser();
        TrainingProgram program = fetchOwnedAction(id);
        String tenantId = systemGuard.requireTenant();
        String current = program.getStatus();
        if (!ContentActionSupport.canTransition(current, toStatus)) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作（training_program）");
        }
        int rows = programMapper.casTransition(id, tenantId, current, toStatus);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "状态流转失败");
        }
        if (ZhiyuStatusConstants.PENDING.equals(current) && ZhiyuStatusConstants.DRAFT.equals(toStatus)) {
            programMapper.deletePendingApproval(id);
        }
        return toDto(fetchOwnedAction(id));
    }

    // ---------- 工具 ----------

    private TrainingProgram fetchOwned(String id) {
        String tenantId = systemGuard.requireTenant();
        TrainingProgram program = programMapper.selectOne(QueryBuilder.lambda(TrainingProgram.class)
            .eq(TrainingProgram::getId, id).eq(TrainingProgram::getTenantId, tenantId).build());
        if (program == null) {
            throw new ApiException(404, "not_found", "人培方案不存在");
        }
        return program;
    }

    private TrainingProgram fetchOwnedAction(String id) {
        TrainingProgram program = programMapper.selectById(id);
        if (program == null) {
            throw new ApiException(404, "not_found", "人培方案不存在");
        }
        verifyTenantOwnership(program.getTenantId());
        return program;
    }

    private void verifyTenantOwnership(String entityTenantId) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (entityTenantId != null && !entityTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    private Map<String, String> nameMapOrEmpty(List<?> rows) {
        if (rows.isEmpty()) {
            return Map.of();
        }
        return nameMap(rows);
    }

    private Map<String, String> nameMap(List<?> rows) {
        return rows.stream().filter(r -> readField(r, "id") != null && readField(r, "name") != null)
            .collect(Collectors.toMap(r -> readField(r, "id"), r -> readField(r, "name"), (a, b) -> a));
    }

    private String readField(Object row, String field) {
        try {
            var pd = org.springframework.beans.BeanUtils.getPropertyDescriptor(row.getClass(), field);
            if (pd == null || pd.getReadMethod() == null) {
                return null;
            }
            Object v = pd.getReadMethod().invoke(row);
            return v == null ? null : v.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private String generateUniqueCode(String tenantId) {
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder("RP-");
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (programMapper.selectCount(QueryBuilder.lambda(TrainingProgram.class)
                .eq(TrainingProgram::getTenantId, tenantId).eq(TrainingProgram::getCode, code).build()) == 0) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成人培方案编码失败");
    }

    private long clampLimit(long limit) {
        if (limit <= 0) {
            return 50;
        }
        return Math.min(limit, 200);
    }

    private boolean notEmpty(String s) {
        return s != null && !s.isEmpty();
    }

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

}

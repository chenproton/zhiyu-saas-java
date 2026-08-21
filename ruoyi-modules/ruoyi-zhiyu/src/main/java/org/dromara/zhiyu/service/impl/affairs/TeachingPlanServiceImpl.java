package org.dromara.zhiyu.service.impl.affairs;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.affairs.AffairsBatch;
import org.dromara.zhiyu.domain.affairs.TeachingPlan;
import org.dromara.zhiyu.domain.affairs.TeachingPlanEntry;
import org.dromara.zhiyu.domain.affairs.TrainingProgram;
import org.dromara.zhiyu.domain.affairs.TrainingProgramCourse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.affairs.ExcelExport;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.GenerateTeachingPlanRequest;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanDto;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanEntryDto;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.TeachingPlanEntryUpdatePayload;
import org.dromara.zhiyu.domain.dto.affairs.TeachingPlanDtos.UpdateTeachingPlanRequest;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.domain.portal.PortalScenario;
import org.dromara.zhiyu.domain.affairs.Term;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.affairs.AffairsBatchMapper;
import org.dromara.zhiyu.mapper.affairs.TeachingPlanEntryMapper;
import org.dromara.zhiyu.mapper.affairs.TeachingPlanMapper;
import org.dromara.zhiyu.mapper.affairs.TrainingProgramCourseMapper;
import org.dromara.zhiyu.mapper.affairs.TrainingProgramMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.mapper.portal.PortalScenarioMapper;
import org.dromara.zhiyu.mapper.affairs.TermMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.affairs.ITeachingPlanService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 教学计划服务实现（对齐 Go teaching_plan_handler.go + store/teaching_plans.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class TeachingPlanServiceImpl implements ITeachingPlanService {

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final SystemGuard systemGuard;
    private final TeachingPlanMapper planMapper;
    private final TeachingPlanEntryMapper entryMapper;
    private final TrainingProgramMapper programMapper;
    private final TrainingProgramCourseMapper courseMapper;
    private final PortalScenarioMapper scenarioMapper;
    private final PortalMajorMapper majorMapper;
    private final TermMapper termMapper;
    private final AffairsBatchMapper batchMapper;
    private final ZhiyuUserMapper userMapper;

    // ---------- 列表 / 详情 ----------

    @Override
    public ListResponse<TeachingPlanDto> list(String status, String programId, String termId, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = clampLimit(limit);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<TeachingPlan> wrapper = QueryBuilder.lambda(TeachingPlan.class)
            .eq(TeachingPlan::getTenantId, tenantId)
            .eqIfText(TeachingPlan::getStatus, status)
            .eqIfText(TeachingPlan::getProgramId, programId)
            .eqIfText(TeachingPlan::getTermId, termId);
        long total = planMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(TeachingPlan::getGeneratedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<TeachingPlan> rows = planMapper.selectList(wrapper.build());
        return ListResponse.of(assembleList(rows), total);
    }

    @Override
    public TeachingPlanDto get(String id) {
        TeachingPlan plan = fetchOwned(id);
        List<TeachingPlanEntry> entries = entryMapper.selectEntriesByPlan(id, systemGuard.requireTenant());
        return toDto(plan, entries);
    }

    // ---------- 生成 / 更新 / 删除 ----------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanDto create(GenerateTeachingPlanRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getProgramId() == null || req.getProgramId().isEmpty()
            || req.getTermId() == null || req.getTermId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }

        TrainingProgram program = programMapper.selectOne(QueryBuilder.lambda(TrainingProgram.class)
            .eq(TrainingProgram::getId, req.getProgramId()).eq(TrainingProgram::getTenantId, tenantId).build());
        if (program == null) {
            throw new ApiException(404, "not_found", "人培方案不存在");
        }
        Integer weeks = planMapper.termWeeks(req.getTermId(), tenantId);
        if (weeks == null) {
            throw new ApiException(404, "not_found", "学期不存在");
        }
        List<TrainingProgramCourse> courses = courseMapper.selectList(
            QueryBuilder.lambda(TrainingProgramCourse.class)
                .eq(TrainingProgramCourse::getProgramId, req.getProgramId())
                .orderByAsc(TrainingProgramCourse::getSortOrder, TrainingProgramCourse::getId).build());
        if (courses.isEmpty()) {
            throw new ApiException(400, "bad_request", "该人培方案尚未配置课程");
        }

        String existing = planMapper.findExistingPlan(req.getProgramId(), req.getTermId(), tenantId);
        if (existing != null && planMapper.scheduledEntryCount(existing) > 0) {
            throw new ApiException(409, "conflict", "该计划已有排课记录，无法重新生成");
        }

        // 岗位 → 已发布场景
        Map<String, List<PortalScenario>> posScenMap = new java.util.HashMap<>();
        for (TrainingProgramCourse c : courses) {
            if (c.getPositionId() != null && !c.getPositionId().isEmpty()
                && !posScenMap.containsKey(c.getPositionId())) {
                posScenMap.put(c.getPositionId(), scenarioMapper.selectList(
                    QueryBuilder.lambda(PortalScenario.class)
                        .eq(PortalScenario::getCareerPositionId, c.getPositionId())
                        .eq(PortalScenario::getStatus, ZhiyuStatusConstants.PUBLISHED).build()));
            }
        }

        List<String> classNodeIds = new ArrayList<>();
        if (program.getMajorId() != null && !program.getMajorId().isEmpty()) {
            classNodeIds = planMapper.fetchProgramClasses(tenantId, program.getMajorId());
        }

        planMapper.deleteByProgramTerm(req.getProgramId(), req.getTermId(), tenantId);
        TeachingPlan plan = new TeachingPlan();
        plan.setTenantId(tenantId);
        plan.setProgramId(req.getProgramId());
        plan.setTermId(req.getTermId());
        plan.setMajorId(program.getMajorId());
        plan.setEntryYear(program.getEntryYear());
        plan.setStatus(ZhiyuStatusConstants.DRAFT);
        plan.setCreatedBy(userId);
        plan.setCollaborators(new ArrayList<>());
        planMapper.insert(plan);

        for (TrainingProgramCourse c : courses) {
            int weekHours = 0;
            if (c.getHours() != null && c.getHours() > 0 && weeks > 0) {
                weekHours = (c.getHours() + weeks - 1) / weeks;
            }
            if (c.getPositionId() != null && !c.getPositionId().isEmpty()) {
                List<PortalScenario> scenarios = posScenMap.getOrDefault(c.getPositionId(), List.of());
                for (PortalScenario sc : scenarios) {
                    insertEntry(plan.getId(), sc.getName(), sc.getCode(), "scene", c, weekHours, weeks,
                        sc.getId(), classNodeIds);
                }
            } else {
                String entryType = "traditional";
                insertEntry(plan.getId(), c.getName(), c.getCode(), entryType, c, weekHours, weeks, null, classNodeIds);
            }
        }
        return get(plan.getId());
    }

    private void insertEntry(String planId, String name, String code, String type, TrainingProgramCourse c,
                             int weekHours, int weeks, String scenarioId, List<String> classNodeIds) {
        TeachingPlanEntry entry = new TeachingPlanEntry();
        entry.setPlanId(planId);
        entry.setCourseName(name);
        entry.setCourseCode(code);
        entry.setType(type);
        entry.setNature(c.getNature());
        entry.setCredits(c.getCredits());
        entry.setTotalHours(c.getHours());
        entry.setWeekHours(weekHours);
        entry.setStartWeek(1);
        entry.setEndWeek(weeks);
        entry.setWeekPattern("all");
        entry.setScenarioId(scenarioId);
        entry.setCourseId(c.getCourseId());
        entry.setStatus("planned");
        entryMapper.insert(entry);
        for (String cid : classNodeIds) {
            if (cid != null && !cid.isEmpty()) {
                planMapper.insertEntryClass(entry.getId(), cid);
            }
        }
    }

    @Override
    public TeachingPlanDto update(String id, UpdateTeachingPlanRequest req) {
        systemGuard.requireTenant();
        fetchOwned(id);
        String tenantId = systemGuard.requireTenant();
        if (req.getBatchId() != null) {
            String batchId = req.getBatchId().isEmpty() ? null : req.getBatchId();
            planMapper.updateBatch(id, tenantId, batchId);
        }
        if (req.getCollaborators() != null) {
            planMapper.updateCollaborators(id, tenantId, req.getCollaborators());
        }
        return toDto(fetchOwned(id), null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        systemGuard.requireTenant();
        fetchOwned(id);
        planMapper.deleteById(id);
        return id;
    }

    // ---------- 内容动作 ----------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanDto submit(String id) {
        return transition(id, ZhiyuStatusConstants.PENDING);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanDto archive(String id) {
        return transition(id, "archived");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanDto unpublish(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanDto withdraw(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanDto saveDraft(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanDto publish(String id) {
        return transition(id, ZhiyuStatusConstants.PUBLISHED);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanDto review(String id, ReviewRequest req) {
        systemGuard.requireUser();
        String to;
        if (ZhiyuStatusConstants.APPROVED.equals(req.getStatus())) {
            to = ZhiyuStatusConstants.APPROVED;
        } else if (ZhiyuStatusConstants.REJECTED.equals(req.getStatus())) {
            to = ZhiyuStatusConstants.REJECTED;
        } else {
            throw new ApiException(400, "bad_request", "无效的审核状态");
        }
        fetchOwnedAction(id);
        String tenantId = systemGuard.requireTenant();
        int rows = planMapper.casReview(id, tenantId, to);
        if (rows == 0) {
            throw new ApiException(400, "bad_request", "教学计划不存在或不在待处理状态");
        }
        return toDto(fetchOwnedAction(id), null);
    }

    @Override
    public TeachingPlanDto invite(String id, InviteRequest req) {
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
        planMapper.inviteCollaborator(id, req.getUserId());
        return toDto(fetchOwnedAction(id), null);
    }

    @Override
    public TeachingPlanDto confirm(String id) {
        systemGuard.requireTenant();
        fetchOwned(id);
        planMapper.confirmPlan(id, systemGuard.requireTenant());
        return toDto(fetchOwned(id), null);
    }

    // ---------- 条目 ----------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TeachingPlanEntryDto updateEntry(String id, TeachingPlanEntryUpdatePayload req) {
        String tenantId = systemGuard.requireTenant();
        TeachingPlanEntry entry = entryMapper.selectEntryById(id, tenantId);
        if (entry == null) {
            throw new ApiException(404, "not_found", "计划条目不存在");
        }
        if (req.getWeekHours() != null) {
            entry.setWeekHours(req.getWeekHours());
        }
        if (req.getStartWeek() != null) {
            entry.setStartWeek(req.getStartWeek());
        }
        if (req.getEndWeek() != null) {
            entry.setEndWeek(req.getEndWeek());
        }
        if (req.getWeekPattern() != null) {
            if (!"all".equals(req.getWeekPattern()) && !"odd".equals(req.getWeekPattern()) && !"even".equals(req.getWeekPattern())) {
                throw new ApiException(400, "bad_request", "周次模式仅支持 all/odd/even");
            }
            entry.setWeekPattern(req.getWeekPattern());
        }
        if (req.getClassNodeId() != null) {
            entry.setClassNodeId(emptyToNull(req.getClassNodeId()));
        }
        if (req.getTeacherId() != null) {
            entry.setTeacherId(emptyToNull(req.getTeacherId()));
        }
        if (req.getTeacherType() != null) {
            entry.setTeacherType(emptyToNull(req.getTeacherType()));
        }
        if (req.getVenueType() != null) {
            entry.setVenueType(emptyToNull(req.getVenueType()));
        }
        if (req.getStatus() != null) {
            if (!"planned".equals(req.getStatus()) && !"scheduled".equals(req.getStatus())) {
                throw new ApiException(400, "bad_request", "状态仅支持 planned/scheduled");
            }
            entry.setStatus(req.getStatus());
        }
        if (entry.getStartWeek() != null && entry.getEndWeek() != null && entry.getStartWeek() > entry.getEndWeek()) {
            throw new ApiException(400, "bad_request", "起始周不能大于结束周");
        }

        BigDecimal credits = req.getCredits() == null ? null : BigDecimal.valueOf(req.getCredits());
        entryMapper.updateEntry(id, tenantId, entry, credits, req.getTotalHours());
        if (req.getClassNodeIds() != null) {
            planMapper.deleteEntryClasses(id);
            for (String cid : req.getClassNodeIds()) {
                if (cid != null && !cid.isEmpty()) {
                    planMapper.insertEntryClass(id, cid);
                }
            }
        }
        TeachingPlanEntry updated = entryMapper.selectEntryById(id, tenantId);
        if (updated == null) {
            throw new ApiException(500, "internal_error", "更新后查询计划条目失败");
        }
        return toEntryDto(updated);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteEntry(String id) {
        String tenantId = systemGuard.requireTenant();
        if (entryMapper.selectEntryById(id, tenantId) == null) {
            throw new ApiException(404, "not_found", "计划条目不存在");
        }
        entryMapper.deleteEntry(id, tenantId);
        return id;
    }

    // ---------- 导出 ----------

    @Override
    public ExcelExport exportExcel(String id) {
        String tenantId = systemGuard.requireTenant();
        TeachingPlan plan = fetchOwned(id);
        List<TeachingPlanEntry> entries = entryMapper.selectEntriesByPlan(id, tenantId);
        byte[] bytes = buildExcel(plan, entries);
        return new ExcelExport("教学计划_" + (plan.getTermName() == null ? "" : plan.getTermName()) + ".xlsx", bytes);
    }

    private byte[] buildExcel(TeachingPlan plan, List<TeachingPlanEntry> entries) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle header = headerStyle(wb);
            CellStyle data = dataStyle(wb);

            Sheet info = wb.createSheet("计划信息");
            info.setColumnWidth(0, 14 * 256);
            info.setColumnWidth(1, 42 * 256);
            String confirmed = plan.getConfirmedAt() == null ? "-" : plan.getConfirmedAt().format(DT);
            String generated = plan.getGeneratedAt() == null ? "-" : plan.getGeneratedAt().format(DT);
            String[][] rowsInfo = {
                {"人培方案", nz(plan.getProgramName())},
                {"学期", nz(plan.getTermName())},
                {"专业", nz(plan.getMajorName())},
                {"年级", plan.getEntryYear() == null ? "" : plan.getEntryYear() + " 级"},
                {"状态", statusLabel(plan.getStatus())},
                {"条目数", String.valueOf(plan.getEntryCount() == null ? 0 : plan.getEntryCount())},
                {"生成时间", generated},
                {"确认时间", confirmed},
            };
            for (int i = 0; i < rowsInfo.length; i++) {
                Row r = info.createRow(i);
                r.setHeightInPoints(24);
                r.createCell(0).setCellValue(rowsInfo[i][0]);
                r.createCell(1).setCellValue(rowsInfo[i][1]);
                r.getCell(0).setCellStyle(header);
                r.getCell(1).setCellStyle(data);
            }

            Sheet entrySheet = wb.createSheet("教学计划条目");
            String[] headers = {"序号", "课程", "课程编码", "学分", "总学时", "周学时", "起止周", "周次模式", "班级", "教师", "场地类型"};
            int[] widths = {6, 26, 14, 8, 8, 8, 8, 12, 10, 28, 16};
            Row hr = entrySheet.createRow(0);
            hr.setHeightInPoints(28);
            for (int ci = 0; ci < headers.length; ci++) {
                hr.createCell(ci).setCellValue(headers[ci]);
                hr.getCell(ci).setCellStyle(header);
                entrySheet.setColumnWidth(ci, widths[ci] * 256);
            }
            int ri = 1;
            for (TeachingPlanEntry e : entries) {
                Row r = entrySheet.createRow(ri);
                r.setHeightInPoints(24);
                String className = e.getClassName() == null ? "" : e.getClassName();
                if (e.getClassNames() != null && !e.getClassNames().isEmpty()) {
                    className = String.join("、", e.getClassNames());
                }
                Object[] vals = {
                    ri,
                    e.getCourseName(),
                    nz(e.getCourseCode()),
                    e.getCredits() == null ? 0 : e.getCredits(),
                    e.getTotalHours() == null ? 0 : e.getTotalHours(),
                    e.getWeekHours() == null ? 0 : e.getWeekHours(),
                    (e.getStartWeek() == null ? 0 : e.getStartWeek()) + "-" + (e.getEndWeek() == null ? 0 : e.getEndWeek()) + "周",
                    weekPatternLabel(e.getWeekPattern()),
                    className,
                    nz(e.getTeacherName()),
                    nz(e.getVenueType()),
                };
                for (int ci = 0; ci < vals.length; ci++) {
                    r.createCell(ci).setCellValue(String.valueOf(vals[ci]));
                }
                ri++;
            }
            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "导出教学计划失败");
        }
    }

    // ---------- 组装 ----------

    private List<TeachingPlanDto> assembleList(List<TeachingPlan> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> ids = rows.stream().map(TeachingPlan::getId).toList();
        Set<String> programIds = new LinkedHashSet<>();
        Set<String> termIds = new LinkedHashSet<>();
        Set<String> majorIds = new LinkedHashSet<>();
        Set<String> creatorIds = new LinkedHashSet<>();
        Set<String> collaboratorIds = new LinkedHashSet<>();
        Set<String> batchIds = new LinkedHashSet<>();
        for (TeachingPlan p : rows) {
            programIds.add(p.getProgramId());
            termIds.add(p.getTermId());
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
        Map<String, String> programNames = nameMap(programMapper.selectList(
            QueryBuilder.lambda(TrainingProgram.class).in(TrainingProgram::getId, new ArrayList<>(programIds)).build()));
        Map<String, String> termNames = nameMap(termMapper.selectList(
            QueryBuilder.lambda(Term.class).in(Term::getId, new ArrayList<>(termIds)).build()));
        Map<String, String> majorNames = nameMapOrEmpty(majorIds.isEmpty() ? List.of() : majorMapper.selectList(
            QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, new ArrayList<>(majorIds)).build()));
        Map<String, String> userNames = nameMapOrEmpty(collaboratorIds.isEmpty() ? List.of() : userMapper.selectList(
            QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, new ArrayList<>(collaboratorIds)).build()));
        Map<String, String> batchNames = nameMapOrEmpty(batchIds.isEmpty() ? List.of() : batchMapper.selectList(
            QueryBuilder.lambda(AffairsBatch.class).in(AffairsBatch::getId, new ArrayList<>(batchIds)).build()));
        Map<String, Long> entryCounts = entryMapper.countByPlanIds(ids).stream()
            .collect(Collectors.toMap(TeachingPlanEntryMapper.EntryCount::planId, TeachingPlanEntryMapper.EntryCount::cnt));

        List<TeachingPlanDto> items = new ArrayList<>(rows.size());
        for (TeachingPlan p : rows) {
            TeachingPlanDto dto = toDto(p, null);
            dto.setProgramName(programNames.getOrDefault(p.getProgramId(), ""));
            dto.setTermName(termNames.getOrDefault(p.getTermId(), ""));
            dto.setMajorName(p.getMajorId() == null ? null : majorNames.getOrDefault(p.getMajorId(), ""));
            dto.setCreatedByName(p.getCreatedBy() == null ? null : userNames.get(p.getCreatedBy()));
            dto.setCollaboratorNames(p.getCollaborators() == null ? List.of()
                : p.getCollaborators().stream().map(uid -> userNames.getOrDefault(uid, "")).toList());
            dto.setBatchName(p.getBatchId() == null ? null : batchNames.getOrDefault(p.getBatchId(), ""));
            dto.setEntryCount(entryCounts.getOrDefault(p.getId(), 0L).intValue());
            items.add(dto);
        }
        return items;
    }

    private TeachingPlanDto toDto(TeachingPlan p, List<TeachingPlanEntry> entries) {
        TeachingPlanDto dto = new TeachingPlanDto();
        dto.setId(p.getId());
        dto.setProgramId(p.getProgramId());
        dto.setProgramName(p.getProgramName());
        dto.setTermId(p.getTermId());
        dto.setTermName(p.getTermName());
        dto.setMajorId(p.getMajorId());
        dto.setMajorName(p.getMajorName());
        dto.setEntryYear(p.getEntryYear());
        dto.setStatus(p.getStatus());
        dto.setEntryCount(p.getEntryCount());
        dto.setGeneratedAt(p.getGeneratedAt());
        dto.setConfirmedAt(p.getConfirmedAt());
        dto.setCreatedBy(p.getCreatedBy());
        dto.setCreatedByName(p.getCreatedByName());
        dto.setCollaborators(p.getCollaborators());
        dto.setCollaboratorNames(p.getCollaboratorNames());
        dto.setBatchId(p.getBatchId());
        dto.setBatchName(p.getBatchName());
        dto.setUpdatedAt(p.getUpdatedAt());
        if (entries != null) {
            dto.setEntries(entries.stream().map(this::toEntryDto).toList());
        }
        return dto;
    }

    private TeachingPlanEntryDto toEntryDto(TeachingPlanEntry e) {
        TeachingPlanEntryDto dto = new TeachingPlanEntryDto();
        dto.setId(e.getId());
        dto.setPlanId(e.getPlanId());
        dto.setCourseName(e.getCourseName());
        dto.setCourseCode(e.getCourseCode());
        dto.setCourseId(e.getCourseId());
        dto.setType(e.getType());
        dto.setNature(e.getNature());
        dto.setCredits(e.getCredits() == null ? null : e.getCredits().doubleValue());
        dto.setTotalHours(e.getTotalHours());
        dto.setWeekHours(e.getWeekHours());
        dto.setStartWeek(e.getStartWeek());
        dto.setEndWeek(e.getEndWeek());
        dto.setWeekPattern(e.getWeekPattern());
        dto.setClassNodeId(e.getClassNodeId());
        dto.setClassName(e.getClassName());
        dto.setClassNodeIds(e.getClassNodeIds());
        dto.setClassNames(e.getClassNames());
        dto.setTeacherId(e.getTeacherId());
        dto.setTeacherName(e.getTeacherName());
        dto.setTeacherType(e.getTeacherType());
        dto.setVenueType(e.getVenueType());
        dto.setScenarioId(e.getScenarioId());
        dto.setScenarioName(e.getScenarioName());
        dto.setPositionName(e.getPositionName());
        dto.setLinkedCourseName(e.getLinkedCourseName());
        dto.setStatus(e.getStatus());
        return dto;
    }

    // ---------- 状态流转 ----------

    private TeachingPlanDto transition(String id, String toStatus) {
        systemGuard.requireUser();
        TeachingPlan plan = fetchOwnedAction(id);
        String tenantId = systemGuard.requireTenant();
        String current = plan.getStatus();
        if (!ContentActionSupport.canTransition(current, toStatus)) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作（teaching_plan）");
        }
        int rows = planMapper.casTransition(id, tenantId, current, toStatus);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "状态流转失败");
        }
        if (ZhiyuStatusConstants.PENDING.equals(current) && ZhiyuStatusConstants.DRAFT.equals(toStatus)) {
            planMapper.deletePendingApproval(id);
        }
        if (ZhiyuStatusConstants.PUBLISHED.equals(toStatus)) {
            planMapper.markConfirmed(id);
        }
        return toDto(fetchOwnedAction(id), null);
    }

    // ---------- 工具 ----------

    private TeachingPlan fetchOwned(String id) {
        String tenantId = systemGuard.requireTenant();
        TeachingPlan plan = planMapper.selectOne(QueryBuilder.lambda(TeachingPlan.class)
            .eq(TeachingPlan::getId, id).eq(TeachingPlan::getTenantId, tenantId).build());
        if (plan == null) {
            throw new ApiException(404, "not_found", "教学计划不存在");
        }
        return plan;
    }

    private TeachingPlan fetchOwnedAction(String id) {
        TeachingPlan plan = planMapper.selectById(id);
        if (plan == null) {
            throw new ApiException(404, "not_found", "教学计划不存在");
        }
        verifyTenantOwnership(plan.getTenantId());
        return plan;
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
        return rows.isEmpty() ? Map.of() : nameMap(rows);
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

    private CellStyle headerStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    private CellStyle dataStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setAlignment(HorizontalAlignment.LEFT);
        return style;
    }

    private String statusLabel(String s) {
        return switch (s == null ? "" : s) {
            case ZhiyuStatusConstants.DRAFT -> "草稿";
            case ZhiyuStatusConstants.PENDING -> "审批中";
            case ZhiyuStatusConstants.APPROVED -> "已通过";
            case ZhiyuStatusConstants.REJECTED -> "已驳回";
            case ZhiyuStatusConstants.PUBLISHED -> "已发布";
            case "archived" -> "已归档";
            case "planned" -> "待排课";
            case "scheduled" -> "已排课";
            default -> s;
        };
    }

    private String weekPatternLabel(String p) {
        return switch (p == null ? "all" : p) {
            case "odd" -> "单周";
            case "even" -> "双周";
            default -> "每周";
        };
    }

    private String nz(String s) {
        return s == null ? "" : s;
    }

    private long clampLimit(long limit) {
        if (limit <= 0) {
            return 50;
        }
        return Math.min(limit, 200);
    }

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

}

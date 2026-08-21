package org.dromara.zhiyu.service.impl.affairs;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.core.web.ScheduleConflictException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PeriodSlotDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PeriodSlotPayload;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReplacePeriodSlotsRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.VenueDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.VenuePayload;
import org.dromara.zhiyu.domain.dto.affairs.ExcelExport;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.AutoScheduleRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.PublishSchedulesRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.ScheduleConflict;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.ScheduleEntryPayload;
import org.dromara.zhiyu.domain.dto.affairs.AffairsScheduleDtos.TimetableResponse;
import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.ScheduleEntryDto;
import org.dromara.zhiyu.domain.portal.PortalOrganization;
import org.dromara.zhiyu.domain.affairs.PeriodSlot;
import org.dromara.zhiyu.domain.portal.PortalRole;
import org.dromara.zhiyu.domain.lesson.LessonCourse;
import org.dromara.zhiyu.domain.portal.PortalScenario;
import org.dromara.zhiyu.domain.affairs.ScheduleEntry;
import org.dromara.zhiyu.domain.affairs.Term;
import org.dromara.zhiyu.domain.portal.PortalUserRole;
import org.dromara.zhiyu.domain.affairs.Venue;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.affairs.AffairsScheduleMapper;
import org.dromara.zhiyu.mapper.affairs.TeachingPlanEntryMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseMapper;
import org.dromara.zhiyu.mapper.portal.PortalOrganizationMapper;
import org.dromara.zhiyu.mapper.affairs.PeriodSlotMapper;
import org.dromara.zhiyu.mapper.portal.PortalRoleMapper;
import org.dromara.zhiyu.mapper.portal.PortalScenarioMapper;
import org.dromara.zhiyu.mapper.affairs.TermMapper;
import org.dromara.zhiyu.mapper.portal.PortalUserRoleMapper;
import org.dromara.zhiyu.mapper.affairs.VenueMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.affairs.ISchedulingService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 教务排课服务实现（场地/节次/排课；对齐 Go scheduling_handler.go + store/scheduling.go）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class SchedulingServiceImpl implements ISchedulingService {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> STRING_LIST_REF = new TypeReference<>() {
    };
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final SystemGuard systemGuard;
    private final VenueMapper venueMapper;
    private final PeriodSlotMapper periodSlotMapper;
    private final AffairsScheduleMapper scheduleMapper;
    private final LessonCourseMapper courseMapper;
    private final TeachingPlanEntryMapper entryMapper;
    private final PortalOrganizationMapper organizationMapper;
    private final ZhiyuUserMapper userMapper;
    private final PortalScenarioMapper scenarioMapper;
    private final TermMapper termMapper;
    private final PortalRoleMapper roleMapper;
    private final PortalUserRoleMapper userRoleMapper;

    // ===== 场地 =====

    @Override
    public ListResponse<VenueDto> listVenues(String search, String type, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<Venue> wrapper = QueryBuilder.lambda(Venue.class)
            .eq(Venue::getTenantId, tenantId)
            .likeIfText(Venue::getName, search)
            .eqIfText(Venue::getType, type);
        long total = venueMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(Venue::getName)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        return ListResponse.of(venueMapper.selectList(wrapper.build()).stream().map(this::toVenueDto).toList(), total);
    }

    @Override
    public VenueDto getVenue(String id) {
        return toVenueDto(fetchVenue(id));
    }

    @Override
    public VenueDto createVenue(VenuePayload p) {
        String tenantId = systemGuard.requireTenant();
        if (p.getName() == null || p.getName().isEmpty() || p.getType() == null || p.getType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        Venue venue = new Venue();
        venue.setTenantId(tenantId);
        venue.setName(p.getName());
        venue.setType(p.getType());
        venue.setCapacity(p.getCapacity());
        venueMapper.insert(venue);
        return toVenueDto(fetchVenue(venue.getId()));
    }

    @Override
    public VenueDto updateVenue(String id, VenuePayload p) {
        systemGuard.requireTenant();
        Venue venue = fetchVenue(id);
        if (p.getName() == null || p.getName().isEmpty() || p.getType() == null || p.getType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        venue.setName(p.getName());
        venue.setType(p.getType());
        venue.setCapacity(p.getCapacity());
        venueMapper.updateById(venue);
        return toVenueDto(fetchVenue(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteVenue(String id) {
        systemGuard.requireTenant();
        fetchVenue(id);
        venueMapper.deleteById(id);
        return id;
    }

    // ===== 节次 =====

    @Override
    public ListResponse<PeriodSlotDto> listPeriodSlots(long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<PeriodSlot> wrapper = QueryBuilder.lambda(PeriodSlot.class)
            .eq(PeriodSlot::getTenantId, tenantId);
        long total = periodSlotMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(PeriodSlot::getSortOrder)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        return ListResponse.of(periodSlotMapper.selectList(wrapper.build()).stream().map(this::toPeriodSlotDto).toList(), total);
    }

    @Override
    public PeriodSlotDto getPeriodSlot(String id) {
        return toPeriodSlotDto(fetchPeriodSlot(id));
    }

    @Override
    public PeriodSlotDto createPeriodSlot(PeriodSlotPayload p) {
        String tenantId = systemGuard.requireTenant();
        if (p.getName() == null || p.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        PeriodSlot slot = new PeriodSlot();
        slot.setTenantId(tenantId);
        slot.setName(p.getName());
        slot.setSlotType(periodSlotType(p.getType()));
        slot.setSortOrder(p.getSortOrder() == null ? 0 : p.getSortOrder());
        slot.setStartTime(parseTime(p.getStartTime()));
        slot.setEndTime(parseTime(p.getEndTime()));
        periodSlotMapper.insert(slot);
        return toPeriodSlotDto(fetchPeriodSlot(slot.getId()));
    }

    @Override
    public PeriodSlotDto updatePeriodSlot(String id, PeriodSlotPayload p) {
        systemGuard.requireTenant();
        PeriodSlot slot = fetchPeriodSlot(id);
        if (p.getName() == null || p.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        slot.setName(p.getName());
        slot.setSlotType(periodSlotType(p.getType()));
        slot.setSortOrder(p.getSortOrder() == null ? 0 : p.getSortOrder());
        slot.setStartTime(parseTime(p.getStartTime()));
        slot.setEndTime(parseTime(p.getEndTime()));
        periodSlotMapper.updateById(slot);
        return toPeriodSlotDto(fetchPeriodSlot(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deletePeriodSlot(String id) {
        systemGuard.requireTenant();
        fetchPeriodSlot(id);
        periodSlotMapper.deleteById(id);
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ListResponse<PeriodSlotDto> replacePeriodSlots(ReplacePeriodSlotsRequest req) {
        String tenantId = systemGuard.requireTenant();
        List<PeriodSlotPayload> items = req.getItems() == null ? List.of() : req.getItems();
        if (items.isEmpty()) {
            throw new ApiException(400, "bad_request", "节次列表不能为空");
        }
        for (PeriodSlotPayload it : items) {
            if (it.getName() == null || it.getName().isEmpty()) {
                throw new ApiException(400, "bad_request", "节次名称不能为空");
            }
        }
        Map<String, PeriodSlot> existing = periodSlotMapper.selectList(
                QueryBuilder.lambda(PeriodSlot.class).eq(PeriodSlot::getTenantId, tenantId).build())
            .stream().collect(Collectors.toMap(PeriodSlot::getName, s -> s, (a, b) -> a));
        Set<String> kept = new LinkedHashSet<>();
        for (PeriodSlotPayload it : items) {
            kept.add(it.getName());
            if (existing.containsKey(it.getName())) {
                PeriodSlot slot = existing.get(it.getName());
                slot.setSlotType(periodSlotType(it.getType()));
                slot.setSortOrder(it.getSortOrder() == null ? 0 : it.getSortOrder());
                slot.setStartTime(parseTime(it.getStartTime()));
                slot.setEndTime(parseTime(it.getEndTime()));
                periodSlotMapper.updateById(slot);
            } else {
                PeriodSlot slot = new PeriodSlot();
                slot.setTenantId(tenantId);
                slot.setName(it.getName());
                slot.setSlotType(periodSlotType(it.getType()));
                slot.setSortOrder(it.getSortOrder() == null ? 0 : it.getSortOrder());
                slot.setStartTime(parseTime(it.getStartTime()));
                slot.setEndTime(parseTime(it.getEndTime()));
                periodSlotMapper.insert(slot);
            }
        }
        for (PeriodSlot old : existing.values()) {
            if (!kept.contains(old.getName())) {
                periodSlotMapper.deleteById(old.getId());
            }
        }
        List<PeriodSlot> result = periodSlotMapper.selectList(
            QueryBuilder.lambda(PeriodSlot.class).eq(PeriodSlot::getTenantId, tenantId)
                .orderByAsc(PeriodSlot::getSortOrder).build());
        return ListResponse.of(result.stream().map(this::toPeriodSlotDto).toList(), result.size());
    }

    // ===== 排课 =====

    @Override
    public ListResponse<ScheduleEntryDto> listSchedules(String termId, String status, String classNodeId, String teacherId,
                                                        String type, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 200);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<ScheduleEntry> wrapper = QueryBuilder.lambda(ScheduleEntry.class)
            .eq(ScheduleEntry::getTenantId, tenantId)
            .eqIfText(ScheduleEntry::getTermId, termId)
            .eqIfText(ScheduleEntry::getStatus, status)
            .eqIfText(ScheduleEntry::getTeacherId, teacherId)
            .eqIfText(ScheduleEntry::getType, type);
        if (notEmpty(classNodeId)) {
            wrapper.and(w -> w.eq(ScheduleEntry::getClassNodeId, classNodeId)
                .or().apply("JSON_CONTAINS(class_node_ids, JSON_QUOTE({0}), '$')", classNodeId));
        }
        long total = scheduleMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(ScheduleEntry::getDayOfWeek, ScheduleEntry::getStartWeek)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<ScheduleEntry> rows = scheduleMapper.selectList(wrapper.build());
        return ListResponse.of(assembleSchedules(rows), total);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduleEntryDto createSchedule(ScheduleEntryPayload p) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        return doCreate(p, tenantId);
    }

    private ScheduleEntryDto doCreate(ScheduleEntryPayload p, String tenantId) {
        // 教学计划条目归属校验
        if (notEmpty(p.getPlanEntryId())) {
            checkPlanEntryTenant(p.getPlanEntryId(), tenantId);
        }
        // 班级兜底
        if ((p.getClassNodeId() == null || p.getClassNodeId().isEmpty()) && notEmpty(p.getPlanEntryId())) {
            String fb = entryMapper.selectFallbackClassId(p.getPlanEntryId());
            if (fb == null || fb.isEmpty()) {
                throw new ApiException(400, "bad_request", "该教学计划条目尚未设置班级，请先在教学计划中设置班级");
            }
            p.setClassNodeId(fb);
        }
        validateSchedule(p);
        if (fetchTermBrief(p.getTermId(), tenantId) == null) {
            throw new ApiException(404, "not_found", "学期不存在");
        }
        ScheduleEntry entry = buildEntry(tenantId, p, "manual");
        scheduleMapper.advisoryLock(tenantId + ":" + p.getTermId());
        List<ScheduleConflict> conflicts = checkConflicts(tenantId, p.getTermId(), p, null);
        if (!conflicts.isEmpty()) {
            throw new ScheduleConflictException(conflicts);
        }
        scheduleMapper.insert(entry);
        if (notEmpty(entry.getPlanEntryId())) {
            entryMapper.markScheduled(entry.getPlanEntryId());
        }
        return assembleSchedule(fetchSchedule(entry.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduleEntryDto updateSchedule(String id, ScheduleEntryPayload p) {
        String tenantId = systemGuard.requireTenant();
        if (fetchSchedule(id) == null) {
            throw new ApiException(404, "not_found", "排课记录不存在");
        }
        validateSchedule(p);
        ScheduleEntry entry = buildEntry(tenantId, p, "manual");
        entry.setId(id);
        entry.setSource(null);
        entry.setStatus(null);
        entry.setVersion(null);
        entry.setUpdatedAt(OffsetDateTime.now());
        scheduleMapper.advisoryLock(tenantId + ":" + p.getTermId());
        List<ScheduleConflict> conflicts = checkConflicts(tenantId, p.getTermId(), p, id);
        if (!conflicts.isEmpty()) {
            throw new ScheduleConflictException(conflicts);
        }
        scheduleMapper.updateById(entry);
        return assembleSchedule(fetchSchedule(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteSchedule(String id) {
        String tenantId = systemGuard.requireTenant();
        ScheduleEntry entry = fetchSchedule(id);
        if (entry == null) {
            throw new ApiException(404, "not_found", "排课记录不存在");
        }
        scheduleMapper.deleteById(id);
        if (notEmpty(entry.getPlanEntryId())) {
            entryMapper.markPlannedIfNoDraft(entry.getPlanEntryId());
        }
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> publishSchedules(PublishSchedulesRequest req) {
        String tenantId = systemGuard.requireTenant();
        if (req.getTermId() == null || req.getTermId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段 termId");
        }
        if (fetchTermBrief(req.getTermId(), tenantId) == null) {
            throw new ApiException(404, "not_found", "学期不存在");
        }
        int curVersion = scheduleMapper.selectPublishedMaxVersion(tenantId, req.getTermId());
        int newVersion = curVersion + 1;
        scheduleMapper.deletePublished(tenantId, req.getTermId());
        int published = scheduleMapper.publishFromDraft(tenantId, req.getTermId(), newVersion);
        return Map.of(ZhiyuStatusConstants.PUBLISHED, published, "version", newVersion);
    }

    @Override
    public TimetableResponse timetable(String termId, String classNodeId, String teacherId, String status) {
        String tenantId = systemGuard.requireTenant();
        if ((classNodeId == null || classNodeId.isEmpty()) && (teacherId == null || teacherId.isEmpty())) {
            throw new ApiException(400, "bad_request", "缺少 classNodeId 或 teacherId 参数");
        }
        if (termId == null || termId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少 termId 参数");
        }
        if (status == null || status.isEmpty() || !isSchoolAdmin()) {
            status = ZhiyuStatusConstants.PUBLISHED;
        }
        LambdaQueryBuilder<ScheduleEntry> wrapper = QueryBuilder.lambda(ScheduleEntry.class)
            .eq(ScheduleEntry::getTenantId, tenantId)
            .eq(ScheduleEntry::getTermId, termId)
            .eq(ScheduleEntry::getStatus, status);
        if (notEmpty(classNodeId)) {
            wrapper.and(w -> w.eq(ScheduleEntry::getClassNodeId, classNodeId)
                .or().apply("JSON_CONTAINS(class_node_ids, JSON_QUOTE({0}), '$')", classNodeId));
        }
        if (notEmpty(teacherId)) {
            wrapper.eq(ScheduleEntry::getTeacherId, teacherId);
        }
        wrapper.orderByAsc(ScheduleEntry::getDayOfWeek);
        List<ScheduleEntry> rows = scheduleMapper.selectList(wrapper.build());
        List<ScheduleEntryDto> items = assembleSchedules(rows);
        int version = scheduleMapper.timetableVersion(tenantId, termId, status);
        TimetableResponse resp = new TimetableResponse();
        resp.setItems(items);
        resp.setTotal(items.size());
        resp.setVersion(version);
        return resp;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> autoSchedule(AutoScheduleRequest req) {
        String tenantId = systemGuard.requireTenant();
        if (req.getTermId() == null || req.getTermId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段 termId");
        }
        if (fetchTermBrief(req.getTermId(), tenantId) == null) {
            throw new ApiException(404, "not_found", "学期不存在");
        }
        List<String> periodNames = scheduleMapper.selectPeriodSlotNames(tenantId);
        if (periodNames.isEmpty()) {
            throw new ApiException(400, "bad_request", "未配置节次");
        }
        List<AffairsScheduleMapper.VenueBrief> venues = scheduleMapper.selectVenueBriefs(tenantId);
        if (venues.isEmpty()) {
            throw new ApiException(400, "bad_request", "未配置场地");
        }
        List<AffairsScheduleMapper.PendingPlanEntry> pending = scheduleMapper.selectPendingPlanEntries(
            tenantId, req.getTermId(), req.getPlanId());

        scheduleMapper.advisoryLock(tenantId + ":" + req.getTermId());
        List<ScheduleEntry> existing = scheduleMapper.selectList(
            QueryBuilder.lambda(ScheduleEntry.class)
                .eq(ScheduleEntry::getTenantId, tenantId)
                .eq(ScheduleEntry::getTermId, req.getTermId())
                .eq(ScheduleEntry::getStatus, ZhiyuStatusConstants.DRAFT).build());
        Set<String> scheduledNow = existing.stream().map(ScheduleEntry::getPlanEntryId)
            .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        List<AffairsScheduleMapper.PendingPlanEntry> stillPending = pending.stream()
            .filter(e -> !scheduledNow.contains(e.id())).toList();

        int success = 0;
        int failed = 0;
        List<String> failures = new ArrayList<>();
        List<ScheduleEntry> creates = new ArrayList<>();
        for (AffairsScheduleMapper.PendingPlanEntry e : stillPending) {
            List<AffairsScheduleMapper.VenueBrief> candidates = venues;
            if (!e.venueType().isEmpty()) {
                List<AffairsScheduleMapper.VenueBrief> filtered = venues.stream()
                    .filter(v -> e.venueType().equals(v.type())).toList();
                if (!filtered.isEmpty()) {
                    candidates = filtered;
                }
            }
            String entryType = "theory".equals(e.entryType()) || "practice".equals(e.entryType()) ? "traditional" : e.entryType();
            String wp = e.weekPattern() == null || e.weekPattern().isEmpty() ? "all" : e.weekPattern();
            boolean placed = false;
            outer:
            for (int day = 1; day <= 7; day++) {
                for (String periodName : periodNames) {
                    for (AffairsScheduleMapper.VenueBrief venue : candidates) {
                        List<ScheduleEntry> checkSet = new ArrayList<>(existing);
                        checkSet.addAll(creates);
                        ScheduleEntryPayload probe = new ScheduleEntryPayload();
                        probe.setPlanEntryId(e.id());
                        probe.setClassNodeId(e.classNodeId());
                        probe.setTeacherId(emptyToNull(e.teacherId()));
                        probe.setDayOfWeek(day);
                        probe.setPeriods(List.of(periodName));
                        probe.setStartWeek(e.startWeek());
                        probe.setEndWeek(e.endWeek());
                        probe.setWeekPattern(wp);
                        probe.setVenueId(venue.id());
                        if (!checkConflicts(checkSet, probe, null).isEmpty()) {
                            continue;
                        }
                        ScheduleEntry se = new ScheduleEntry();
                        se.setTenantId(tenantId);
                        se.setTermId(req.getTermId());
                        se.setPlanEntryId(e.id());
                        se.setCourseName(e.courseName());
                        se.setCourseCode(emptyToNull(e.courseCode()));
                        se.setCourseId(emptyToNull(e.courseId()));
                        se.setType(entryType);
                        se.setClassNodeId(e.classNodeId());
                        se.setClassNodeIds(List.of(e.classNodeId()));
                        se.setTeacherId(emptyToNull(e.teacherId()));
                        se.setDayOfWeek(day);
                        se.setPeriods(List.of(periodName));
                        se.setStartWeek(e.startWeek());
                        se.setEndWeek(e.endWeek());
                        se.setWeekPattern(wp);
                        se.setVenueId(venue.id());
                        se.setScenarioId(emptyToNull(e.scenarioId()));
                        se.setSource("auto");
                        se.setStatus(ZhiyuStatusConstants.DRAFT);
                        se.setVersion(1);
                        creates.add(se);
                        success++;
                        placed = true;
                        break outer;
                    }
                }
            }
            if (!placed) {
                failed++;
                failures.add(e.courseName() + "：未找到可用时段");
            }
        }
        for (ScheduleEntry se : creates) {
            scheduleMapper.insert(se);
            if (notEmpty(se.getPlanEntryId())) {
                entryMapper.markScheduled(se.getPlanEntryId());
            }
        }
        return Map.of("success", success, "failed", failed, "failures", failures);
    }

    // ---------- 冲突检测 ----------

    private List<ScheduleConflict> checkConflicts(String tenantId, String termId, ScheduleEntryPayload p, String excludeId) {
        List<ScheduleEntry> existing = scheduleMapper.selectList(
            QueryBuilder.lambda(ScheduleEntry.class)
                .eq(ScheduleEntry::getTenantId, tenantId)
                .eq(ScheduleEntry::getTermId, termId)
                .eq(ScheduleEntry::getStatus, ZhiyuStatusConstants.DRAFT).build());
        return checkConflicts(existing, p, excludeId);
    }

    private List<ScheduleConflict> checkConflicts(List<ScheduleEntry> existing, ScheduleEntryPayload p, String excludeId) {
        List<String> reqPeriods = p.getPeriods() == null ? List.of() : p.getPeriods();
        String wp = p.getWeekPattern() == null || p.getWeekPattern().isEmpty() ? "all" : p.getWeekPattern();
        List<String> reqClasses = mergedClasses(p.getClassNodeIds(), p.getClassNodeId());
        Map<String, String> orgNames = orgNameMap(collectOrgIds(existing));
        Map<String, String> userNames = userNameMap(collectUserIds(existing));
        Map<String, String> venueNames = venueNameMap(collectVenueIds(existing));

        List<ScheduleConflict> out = new ArrayList<>();
        for (ScheduleEntry ex : existing) {
            if (excludeId != null && excludeId.equals(ex.getId())) {
                continue;
            }
            if (ex.getDayOfWeek() == null || !ex.getDayOfWeek().equals(p.getDayOfWeek())) {
                continue;
            }
            if (ex.getEndWeek() < p.getStartWeek() || ex.getStartWeek() > p.getEndWeek()) {
                continue;
            }
            String exWp = ex.getWeekPattern() == null || ex.getWeekPattern().isEmpty() ? "all" : ex.getWeekPattern();
            if (!"all".equals(exWp) && !"all".equals(wp) && !exWp.equals(wp)) {
                continue;
            }
            if (!periodsOverlap(ex.getPeriods(), reqPeriods)) {
                continue;
            }
            if (notEmpty(p.getPlanEntryId()) && p.getPlanEntryId().equals(ex.getPlanEntryId())) {
                continue;
            }
            if (notEmpty(p.getTeacherId()) && p.getTeacherId().equals(ex.getTeacherId())) {
                out.add(conflict(ex, "teacher", orgNames, userNames, venueNames));
            }
            List<String> exClasses = mergedClasses(ex.getClassNodeIds(), ex.getClassNodeId());
            if (anyOverlap(exClasses, reqClasses)) {
                out.add(conflict(ex, "class", orgNames, userNames, venueNames));
            }
            if (notEmpty(p.getVenueId()) && p.getVenueId().equals(ex.getVenueId())) {
                out.add(conflict(ex, "venue", orgNames, userNames, venueNames));
            }
        }
        return out;
    }

    private ScheduleConflict conflict(ScheduleEntry ex, String kind, Map<String, String> orgNames,
                                      Map<String, String> userNames, Map<String, String> venueNames) {
        ScheduleConflict c = new ScheduleConflict();
        c.setKind(kind);
        c.setEntryId(ex.getId());
        c.setCourseName(ex.getCourseName());
        c.setClassName(ex.getClassNodeId() == null ? null : orgNames.getOrDefault(ex.getClassNodeId(), ""));
        c.setTeacherName(ex.getTeacherId() == null ? null : userNames.get(ex.getTeacherId()));
        c.setVenueName(ex.getVenueId() == null ? null : venueNames.get(ex.getVenueId()));
        c.setDayOfWeek(ex.getDayOfWeek());
        c.setPeriods(ex.getPeriods());
        c.setStartWeek(ex.getStartWeek());
        c.setEndWeek(ex.getEndWeek());
        c.setWeekPattern(ex.getWeekPattern());
        return c;
    }

    private boolean periodsOverlap(List<String> a, List<String> b) {
        if (a == null || b == null) {
            return false;
        }
        for (String x : a) {
            for (String y : b) {
                if (x != null && x.equals(y)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean anyOverlap(List<String> a, List<String> b) {
        if (a == null || b == null) {
            return false;
        }
        for (String x : a) {
            if (x != null && b.contains(x)) {
                return true;
            }
        }
        return false;
    }

    private List<String> mergedClasses(List<String> classNodeIds, String classNodeId) {
        if (classNodeIds != null && !classNodeIds.isEmpty()) {
            return classNodeIds;
        }
        if (notEmpty(classNodeId)) {
            return List.of(classNodeId);
        }
        return List.of();
    }

    // ---------- 组装 ----------

    private List<ScheduleEntryDto> assembleSchedules(List<ScheduleEntry> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        Map<String, String> orgNames = orgNameMap(collectOrgIds(rows));
        Map<String, String> userNames = userNameMap(collectUserIds(rows));
        Map<String, String> venueNames = venueNameMap(collectVenueIds(rows));
        Map<String, String> scenarioNames = scenarioNameMap(collectScenarioIds(rows));
        List<ScheduleEntryDto> items = new ArrayList<>(rows.size());
        for (ScheduleEntry se : rows) {
            items.add(assembleSchedule(se, orgNames, userNames, venueNames, scenarioNames));
        }
        return items;
    }

    private ScheduleEntryDto assembleSchedule(ScheduleEntry se) {
        Map<String, String> orgNames = orgNameMap(collectOrgIds(List.of(se)));
        Map<String, String> userNames = userNameMap(collectUserIds(List.of(se)));
        Map<String, String> venueNames = venueNameMap(collectVenueIds(List.of(se)));
        Map<String, String> scenarioNames = scenarioNameMap(collectScenarioIds(List.of(se)));
        return assembleSchedule(se, orgNames, userNames, venueNames, scenarioNames);
    }

    private ScheduleEntryDto assembleSchedule(ScheduleEntry se, Map<String, String> orgNames,
                                              Map<String, String> userNames, Map<String, String> venueNames,
                                              Map<String, String> scenarioNames) {
        ScheduleEntryDto dto = new ScheduleEntryDto();
        dto.setId(se.getId());
        dto.setTermId(se.getTermId());
        dto.setPlanEntryId(se.getPlanEntryId());
        dto.setCourseName(se.getCourseName());
        dto.setCourseCode(se.getCourseCode());
        dto.setCourseId(se.getCourseId());
        dto.setType(se.getType());
        dto.setClassNodeId(se.getClassNodeId());
        dto.setClassName(se.getClassNodeId() == null ? null : orgNames.getOrDefault(se.getClassNodeId(), ""));
        dto.setClassNodeIds(se.getClassNodeIds());
        dto.setClassNames(se.getClassNodeIds() == null ? List.of()
            : se.getClassNodeIds().stream().map(id -> orgNames.getOrDefault(id, "")).toList());
        dto.setTeacherId(se.getTeacherId());
        dto.setTeacherName(se.getTeacherId() == null ? null : userNames.get(se.getTeacherId()));
        dto.setDayOfWeek(se.getDayOfWeek());
        dto.setPeriods(se.getPeriods());
        dto.setStartWeek(se.getStartWeek());
        dto.setEndWeek(se.getEndWeek());
        dto.setWeekPattern(se.getWeekPattern());
        dto.setVenueId(se.getVenueId());
        dto.setVenueName(se.getVenueId() == null ? null : venueNames.get(se.getVenueId()));
        dto.setScenarioId(se.getScenarioId());
        dto.setScenarioName(se.getScenarioId() == null ? null : scenarioNames.get(se.getScenarioId()));
        dto.setSource(se.getSource());
        dto.setStatus(se.getStatus());
        dto.setVersion(se.getVersion());
        dto.setResourceVersion(se.getResourceVersion());
        dto.setCreatedAt(se.getCreatedAt());
        dto.setUpdatedAt(se.getUpdatedAt());
        return dto;
    }

    // ---------- Excel 导出 ----------

    @Override
    public ExcelExport exportSchedules(String termId) {
        String tenantId = systemGuard.requireTenant();
        if (termId == null || termId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少 termId 参数");
        }
        Term term = fetchTermBrief(termId, tenantId);
        if (term == null) {
            throw new ApiException(404, "not_found", "学期不存在");
        }
        byte[] bytes = buildScheduleExcel(tenantId, termId, term.getName());
        return new ExcelExport("排课导入_" + term.getName() + ".xlsx", bytes);
    }

    private byte[] buildScheduleExcel(String tenantId, String termId, String termName) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle hdr = headerStyle(wb);
            CellStyle note = noteStyle(wb);
            String[] dayMap = {"周一", "周二", "周三", "周四", "周五", "周六", "周日"};
            Map<Integer, String> weekPatMap = Map.of(1, "全部", 2, "单周", 3, "双周");
            Map<String, String> weekPatName = Map.of("all", "全部", "odd", "单周", "even", "双周");

            Map<String, AffairsScheduleMapper.ScheduledExportMap> schedMap = new java.util.HashMap<>();
            for (AffairsScheduleMapper.ScheduledExportMap m : scheduleMapper.selectScheduledExportMap(tenantId, termId)) {
                if (m.planEntryId() != null) {
                    schedMap.put(m.planEntryId(), m);
                }
            }
            List<AffairsScheduleMapper.PlanEntryBrief> entries = scheduleMapper.selectPlanEntryBriefs(tenantId, termId);

            Sheet main = wb.createSheet("课程列表");
            String[] headers = {"课程名称 *", "类型", "起始周 *", "结束周 *", "周次模式", "星期", "节次", "教师", "场地", "班级"};
            int[] widths = {28, 10, 10, 10, 10, 8, 20, 16, 18, 30};
            Row noteRow = main.createRow(0);
            noteRow.setHeightInPoints(90);
            noteRow.createCell(0).setCellValue("填写说明：\n* 必填列。\n星期：1-7 或 周一~周日。\n节次：填写节次名称（如 上午1-2）。\n教师：姓名或登录账号。\n场地：场地名称。\n班级：班级名称，多个班级用逗号分隔。\n已排课的条目已回填星期/节次/教师/场地/班级，未排的留空待你填写。\n参考「教师名单/场地名单/班级名单/节次表」Sheet 填写。\n导入时将以该表为准，先清空当前学期排课再重新生成。");
            noteRow.getCell(0).setCellStyle(note);
            Row hr = main.createRow(1);
            hr.setHeightInPoints(28);
            for (int ci = 0; ci < headers.length; ci++) {
                hr.createCell(ci).setCellValue(headers[ci]);
                hr.getCell(ci).setCellStyle(hdr);
                main.setColumnWidth(ci, widths[ci] * 256);
            }
            int ri = 2;
            for (AffairsScheduleMapper.PlanEntryBrief e : entries) {
                Row r = main.createRow(ri);
                AffairsScheduleMapper.ScheduledExportMap sd = schedMap.get(e.id());
                String typeLabel = "scene".equals(e.entryType()) ? "场景" : "课程";
                String day = sd != null && sd.day() >= 1 && sd.day() <= 7 ? dayMap[sd.day() - 1] : "";
                String periods = sd == null ? "" : String.join("，", parseStringList(sd.periodsJson()));
                String[] vals = {e.courseName(), typeLabel, String.valueOf(e.startWeek()), String.valueOf(e.endWeek()),
                    weekPatName.getOrDefault(e.weekPattern() == null ? "all" : e.weekPattern(), "全部"),
                    day, periods, sd == null ? "" : sd.teacherName(), sd == null ? "" : sd.venueName(),
                    sd == null ? "" : sd.classNamesText()};
                for (int ci = 0; ci < vals.length; ci++) {
                    r.createCell(ci).setCellValue(vals[ci]);
                }
                ri++;
            }

            addReferenceSheet(wb, hdr, "【参考】教师名单", "教师姓名", scheduleMapper.selectTeacherNames(tenantId), null, null);
            List<AffairsScheduleMapper.VenueBrief> venueBriefs = scheduleMapper.selectVenueBriefs(tenantId);
            addReferenceSheet(wb, hdr, "【参考】场地名单", "场地名称", venueBriefs.stream().map(AffairsScheduleMapper.VenueBrief::name).toList(),
                "类型", venueBriefs.stream().map(AffairsScheduleMapper.VenueBrief::type).toList());
            addReferenceSheet(wb, hdr, "【参考】班级名单", "班级名称", scheduleMapper.selectClassNames(tenantId), null, null);

            List<PeriodSlot> slots = periodSlotMapper.selectList(
                QueryBuilder.lambda(PeriodSlot.class).eq(PeriodSlot::getTenantId, tenantId)
                    .orderByAsc(PeriodSlot::getSortOrder).build());
            Sheet periodSheet = wb.createSheet("【参考】节次表");
            periodSheet.createRow(0).createCell(0).setCellValue("节次名称");
            periodSheet.getRow(0).getCell(0).setCellStyle(hdr);
            periodSheet.getRow(0).createCell(1).setCellValue("开始时间");
            periodSheet.getRow(0).getCell(1).setCellStyle(hdr);
            periodSheet.getRow(0).createCell(2).setCellValue("结束时间");
            periodSheet.getRow(0).getCell(2).setCellStyle(hdr);
            int pi = 1;
            for (PeriodSlot ps : slots) {
                Row r = periodSheet.createRow(pi);
                r.createCell(0).setCellValue(ps.getName() == null ? "" : ps.getName());
                r.createCell(1).setCellValue(ps.getStartTime() == null ? "" : ps.getStartTime().format(TIME_FMT));
                r.createCell(2).setCellValue(ps.getEndTime() == null ? "" : ps.getEndTime().format(TIME_FMT));
                pi++;
            }

            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "导出排课表生成失败");
        }
    }

    private void addReferenceSheet(Workbook wb, CellStyle hdr, String sheetName, String header,
                                   List<String> firstCol, String header2, List<String> secondCol) {
        Sheet sheet = wb.createSheet(sheetName);
        Row hr = sheet.createRow(0);
        hr.createCell(0).setCellValue(header);
        hr.getCell(0).setCellStyle(hdr);
        if (secondCol != null) {
            hr.createCell(1).setCellValue(header2);
            hr.getCell(1).setCellStyle(hdr);
        }
        for (int i = 0; i < firstCol.size(); i++) {
            Row r = sheet.createRow(i + 1);
            r.createCell(0).setCellValue(firstCol.get(i) == null ? "" : firstCol.get(i));
            if (secondCol != null && i < secondCol.size()) {
                r.createCell(1).setCellValue(secondCol.get(i) == null ? "" : secondCol.get(i));
            }
        }
        sheet.setColumnWidth(0, 20 * 256);
        if (secondCol != null) {
            sheet.setColumnWidth(1, 16 * 256);
        }
    }

    // ---------- 名称批量解析 ----------

    private Set<String> collectOrgIds(List<ScheduleEntry> rows) {
        Set<String> ids = new LinkedHashSet<>();
        for (ScheduleEntry se : rows) {
            if (se.getClassNodeId() != null) {
                ids.add(se.getClassNodeId());
            }
            if (se.getClassNodeIds() != null) {
                ids.addAll(se.getClassNodeIds());
            }
        }
        return ids;
    }

    private Set<String> collectUserIds(List<ScheduleEntry> rows) {
        return rows.stream().map(ScheduleEntry::getTeacherId).filter(java.util.Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<String> collectVenueIds(List<ScheduleEntry> rows) {
        return rows.stream().map(ScheduleEntry::getVenueId).filter(java.util.Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<String> collectScenarioIds(List<ScheduleEntry> rows) {
        return rows.stream().map(ScheduleEntry::getScenarioId).filter(java.util.Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Map<String, String> orgNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return organizationMapper.selectList(
                    QueryBuilder.lambda(PortalOrganization.class).in(PortalOrganization::getId, new ArrayList<>(ids)).build())
                .stream().filter(o -> o.getName() != null)
                .collect(Collectors.toMap(PortalOrganization::getId, PortalOrganization::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, String> userNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return userMapper.selectList(
                    QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, new ArrayList<>(ids)).build())
                .stream().filter(u -> u.getName() != null)
                .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, String> venueNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return venueMapper.selectList(
                    QueryBuilder.lambda(Venue.class).in(Venue::getId, new ArrayList<>(ids)).build())
                .stream().filter(v -> v.getName() != null)
                .collect(Collectors.toMap(Venue::getId, Venue::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, String> scenarioNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return scenarioMapper.selectList(
                    QueryBuilder.lambda(PortalScenario.class).in(PortalScenario::getId, new ArrayList<>(ids)).build())
                .stream().filter(s -> s.getName() != null)
                .collect(Collectors.toMap(PortalScenario::getId, PortalScenario::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    // ---------- 工具 ----------

    private ScheduleEntry buildEntry(String tenantId, ScheduleEntryPayload p, String source) {
        String entryType = p.getType() == null || p.getType().isEmpty() ? "traditional" : p.getType();
        String wp = p.getWeekPattern() == null || p.getWeekPattern().isEmpty() ? "all" : p.getWeekPattern();
        String courseId = p.getCourseId();
        if ((courseId == null || courseId.isEmpty()) && notEmpty(p.getCourseCode())) {
            courseId = resolveCourseIdByCode(tenantId, p.getCourseCode());
        }
        if (notEmpty(p.getPlanEntryId())) {
            String planCourseId = entryMapper.selectCourseId(p.getPlanEntryId());
            if (notEmpty(planCourseId)) {
                courseId = planCourseId;
            }
        }
        List<String> classIds = mergedClasses(p.getClassNodeIds(), p.getClassNodeId());
        String primaryClass = p.getClassNodeId();
        if ((primaryClass == null || primaryClass.isEmpty()) && !classIds.isEmpty()) {
            primaryClass = classIds.get(0);
        }
        ScheduleEntry se = new ScheduleEntry();
        se.setTenantId(tenantId);
        se.setTermId(p.getTermId());
        se.setPlanEntryId(emptyToNull(p.getPlanEntryId()));
        se.setCourseName(p.getCourseName());
        se.setCourseCode(emptyToNull(p.getCourseCode()));
        se.setCourseId(emptyToNull(courseId));
        se.setType(entryType);
        se.setClassNodeId(primaryClass);
        se.setClassNodeIds(classIds);
        se.setTeacherId(emptyToNull(p.getTeacherId()));
        se.setDayOfWeek(p.getDayOfWeek());
        se.setPeriods(p.getPeriods());
        se.setStartWeek(p.getStartWeek());
        se.setEndWeek(p.getEndWeek());
        se.setWeekPattern(wp);
        se.setVenueId(emptyToNull(p.getVenueId()));
        se.setScenarioId(emptyToNull(p.getScenarioId()));
        se.setSource(source);
        se.setStatus(ZhiyuStatusConstants.DRAFT);
        se.setVersion(1);
        return se;
    }

    private String resolveCourseIdByCode(String tenantId, String courseCode) {
        if (courseCode == null || courseCode.isEmpty()) {
            return null;
        }
        try {
            LessonCourse c = courseMapper.selectOne(QueryBuilder.lambda(LessonCourse.class)
                .eq(LessonCourse::getTenantId, tenantId).eq(LessonCourse::getCode, courseCode)
                .last("LIMIT 1").build());
            return c == null ? null : c.getId();
        } catch (Exception e) {
            return null;
        }
    }

    private void validateSchedule(ScheduleEntryPayload p) {
        if (p.getTermId() == null || p.getTermId().isEmpty()
            || p.getCourseName() == null || p.getCourseName().isEmpty()
            || p.getClassNodeId() == null || p.getClassNodeId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段（termId/courseName/classNodeId）");
        }
        if (p.getDayOfWeek() == null || p.getDayOfWeek() < 1 || p.getDayOfWeek() > 7) {
            throw new ApiException(400, "bad_request", "星期取值必须为 1-7");
        }
        if (p.getPeriods() == null || p.getPeriods().isEmpty()) {
            throw new ApiException(400, "bad_request", "节次不能为空");
        }
        if (p.getStartWeek() == null || p.getEndWeek() == null || p.getStartWeek() <= 0 || p.getEndWeek() <= 0
            || p.getStartWeek() > p.getEndWeek()) {
            throw new ApiException(400, "bad_request", "周次区间无效");
        }
        if (p.getWeekPattern() != null && !p.getWeekPattern().isEmpty()
            && !"all".equals(p.getWeekPattern()) && !"odd".equals(p.getWeekPattern()) && !"even".equals(p.getWeekPattern())) {
            throw new ApiException(400, "bad_request", "周次模式仅支持 all/odd/even");
        }
    }

    private void checkPlanEntryTenant(String planEntryId, String tenantId) {
        String entryTenant = entryMapper.selectEntryTenant(planEntryId);
        if (entryTenant == null || !entryTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "教学计划条目不存在");
        }
    }

    private Term fetchTermBrief(String id, String tenantId) {
        return termMapper.selectOne(QueryBuilder.lambda(Term.class)
            .eq(Term::getId, id).eq(Term::getTenantId, tenantId).build());
    }

    private ScheduleEntry fetchSchedule(String id) {
        String tenantId = systemGuard.requireTenant();
        return scheduleMapper.selectOne(QueryBuilder.lambda(ScheduleEntry.class)
            .eq(ScheduleEntry::getId, id).eq(ScheduleEntry::getTenantId, tenantId).build());
    }

    private Venue fetchVenue(String id) {
        String tenantId = systemGuard.requireTenant();
        Venue venue = venueMapper.selectOne(QueryBuilder.lambda(Venue.class)
            .eq(Venue::getId, id).eq(Venue::getTenantId, tenantId).build());
        if (venue == null) {
            throw new ApiException(404, "not_found", "场地不存在");
        }
        return venue;
    }

    private PeriodSlot fetchPeriodSlot(String id) {
        String tenantId = systemGuard.requireTenant();
        PeriodSlot slot = periodSlotMapper.selectOne(QueryBuilder.lambda(PeriodSlot.class)
            .eq(PeriodSlot::getId, id).eq(PeriodSlot::getTenantId, tenantId).build());
        if (slot == null) {
            throw new ApiException(404, "not_found", "节次不存在");
        }
        return slot;
    }

    private VenueDto toVenueDto(Venue v) {
        VenueDto dto = new VenueDto();
        dto.setId(v.getId());
        dto.setName(v.getName());
        dto.setType(v.getType());
        dto.setCapacity(v.getCapacity());
        dto.setCreatedAt(v.getCreatedAt());
        return dto;
    }

    private PeriodSlotDto toPeriodSlotDto(PeriodSlot s) {
        PeriodSlotDto dto = new PeriodSlotDto();
        dto.setId(s.getId());
        dto.setName(s.getName());
        dto.setType(s.getSlotType());
        dto.setSortOrder(s.getSortOrder());
        dto.setStartTime(s.getStartTime() == null ? null : s.getStartTime().format(TIME_FMT));
        dto.setEndTime(s.getEndTime() == null ? null : s.getEndTime().format(TIME_FMT));
        return dto;
    }

    private String periodSlotType(String t) {
        return switch (t == null ? "" : t) {
            case "morning_self", "afternoon", "evening", "morning" -> t;
            default -> "morning";
        };
    }

    private LocalTime parseTime(String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return LocalTime.parse(value, TIME_FMT);
        } catch (DateTimeParseException e) {
            throw new ApiException(400, "bad_request", "时间格式应为 HH:mm");
        }
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = MAPPER.readValue(json, STRING_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private boolean isSchoolAdmin() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return false;
        }
        try {
            List<PortalUserRole> userRoles = userRoleMapper.selectList(
                QueryBuilder.lambda(PortalUserRole.class).eq(PortalUserRole::getUserId, userId).build());
            if (userRoles.isEmpty()) {
                return false;
            }
            List<String> roleIds = userRoles.stream().map(PortalUserRole::getRoleId).distinct().toList();
            List<PortalRole> roles = roleMapper.selectList(
                QueryBuilder.lambda(PortalRole.class).in(PortalRole::getId, roleIds).build());
            return roles.stream().anyMatch(r -> "school_admin".equals(r.getCode()));
        } catch (Exception e) {
            return false;
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

    private CellStyle noteStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.TOP);
        style.setWrapText(true);
        return style;
    }

    private boolean notEmpty(String s) {
        return s != null && !s.isEmpty();
    }

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

}

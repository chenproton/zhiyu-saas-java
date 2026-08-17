package org.dromara.zhiyu.service.impl.portal;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.MyScheduleResponse;
import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.ScheduleEntryDto;
import org.dromara.zhiyu.domain.dto.portal.ScheduleDtos.TermDto;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceAnnouncement;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceClassPlan;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceClassSession;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceCourse;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceDashboard;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceExam;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceLearningPath;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspacePersonnelStat;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceResourceGrowth;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceResourceStat;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceSceneTask;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceScheduleEvent;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceStats;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceTeacherCourse;
import org.dromara.zhiyu.domain.dto.portal.WorkspaceDtos.WorkspaceTodo;
import org.dromara.zhiyu.domain.portal.PortalAnnouncement;
import org.dromara.zhiyu.domain.portal.PortalApprovalRecord;
import org.dromara.zhiyu.domain.portal.PortalCareerPosition;
import org.dromara.zhiyu.domain.portal.PortalCourse;
import org.dromara.zhiyu.domain.portal.PortalExam;
import org.dromara.zhiyu.domain.portal.PortalExamResult;
import org.dromara.zhiyu.domain.portal.PortalExamUsage;
import org.dromara.zhiyu.domain.portal.PortalLessonBehavior;
import org.dromara.zhiyu.domain.portal.PortalOrganization;
import org.dromara.zhiyu.domain.portal.PortalPeriodSlot;
import org.dromara.zhiyu.domain.portal.PortalPlatformConfig;
import org.dromara.zhiyu.domain.portal.PortalQuestionBank;
import org.dromara.zhiyu.domain.portal.PortalResourceSnapshot;
import org.dromara.zhiyu.domain.portal.PortalRole;
import org.dromara.zhiyu.domain.portal.PortalScenario;
import org.dromara.zhiyu.domain.portal.PortalScenarioTask;
import org.dromara.zhiyu.domain.portal.PortalScheduleEntry;
import org.dromara.zhiyu.domain.portal.PortalSceneEvalResult;
import org.dromara.zhiyu.domain.portal.PortalTerm;
import org.dromara.zhiyu.domain.portal.PortalUserRole;
import org.dromara.zhiyu.domain.portal.PortalVenue;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.portal.PortalAnnouncementMapper;
import org.dromara.zhiyu.mapper.portal.PortalApprovalRecordMapper;
import org.dromara.zhiyu.mapper.portal.PortalCareerPositionMapper;
import org.dromara.zhiyu.mapper.portal.PortalCourseMapper;
import org.dromara.zhiyu.mapper.portal.PortalExamMapper;
import org.dromara.zhiyu.mapper.portal.PortalExamResultMapper;
import org.dromara.zhiyu.mapper.portal.PortalExamUsageMapper;
import org.dromara.zhiyu.mapper.portal.PortalLessonBehaviorMapper;
import org.dromara.zhiyu.mapper.portal.PortalOrganizationMapper;
import org.dromara.zhiyu.mapper.portal.PortalPeriodSlotMapper;
import org.dromara.zhiyu.mapper.portal.PortalPlatformConfigMapper;
import org.dromara.zhiyu.mapper.portal.PortalQuestionBankMapper;
import org.dromara.zhiyu.mapper.portal.PortalResourceSnapshotMapper;
import org.dromara.zhiyu.mapper.portal.PortalRoleMapper;
import org.dromara.zhiyu.mapper.portal.PortalScenarioMapper;
import org.dromara.zhiyu.mapper.portal.PortalScenarioTaskMapper;
import org.dromara.zhiyu.mapper.portal.PortalScheduleEntryMapper;
import org.dromara.zhiyu.mapper.portal.PortalSceneEvalResultMapper;
import org.dromara.zhiyu.mapper.portal.PortalTermMapper;
import org.dromara.zhiyu.mapper.portal.PortalUserRoleMapper;
import org.dromara.zhiyu.mapper.portal.PortalVenueMapper;
import org.dromara.zhiyu.service.portal.IWorkspaceService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 门户工作台服务实现（对齐 Go portal_handler.go + workspace_stats.go + store/portal.go 语义）。
 *
 * <p>所有查询带租户过滤（Go 版 tenantID 参数语义）；列表为空时按 Go 版返回空数组而非 null；
 * 统计类子查询失败按 Go 版记录日志并返回 0/空，不阻断仪表盘整体返回。</p>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class WorkspaceServiceImpl implements IWorkspaceService {

    /** 手动创建考试安排的目标类型（对齐 Go manualExamUsageTargetTypesSQL） */
    private static final List<String> MANUAL_EXAM_TARGET_TYPES = List.of("class", "major", "department", "public");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final Map<String, String> DAY_NAMES = Map.of(
        "1", "周一", "2", "周二", "3", "周三", "4", "周四", "5", "周五", "6", "周六", "7", "周日");

    private final ZhiyuUserMapper userMapper;
    private final PortalAnnouncementMapper announcementMapper;
    private final PortalApprovalRecordMapper approvalRecordMapper;
    private final PortalCourseMapper courseMapper;
    private final PortalScenarioMapper scenarioMapper;
    private final PortalScenarioTaskMapper scenarioTaskMapper;
    private final PortalExamMapper examMapper;
    private final PortalExamUsageMapper examUsageMapper;
    private final PortalExamResultMapper examResultMapper;
    private final PortalScheduleEntryMapper scheduleEntryMapper;
    private final PortalVenueMapper venueMapper;
    private final PortalTermMapper termMapper;
    private final PortalPeriodSlotMapper periodSlotMapper;
    private final PortalOrganizationMapper organizationMapper;
    private final PortalLessonBehaviorMapper lessonBehaviorMapper;
    private final PortalRoleMapper roleMapper;
    private final PortalUserRoleMapper userRoleMapper;
    private final PortalPlatformConfigMapper platformConfigMapper;
    private final PortalCareerPositionMapper careerPositionMapper;
    private final PortalQuestionBankMapper portalQuestionBankMapper;
    private final PortalResourceSnapshotMapper resourceSnapshotMapper;
    private final PortalSceneEvalResultMapper sceneEvalResultMapper;

    // ---------- 公开端点 ----------

    @Override
    public WorkspaceDashboard dashboard(String role) {
        String userId = requireUserId();
        String tenantId = requireTenantId();
        List<String> roleCodes = listRoleCodes(userId, tenantId);

        // 角色切换校验：只允许切换到用户自己绑定的角色，防止学生带 ?role=school_admin 越权查看管理员视图
        if (!roleCodes.contains(role)) {
            role = roleCodes.isEmpty() ? "student" : roleCodes.get(0);
        }
        boolean isTeacher = "teacher".equals(role) || "school".equals(role) || "school_admin".equals(role);
        boolean isSchoolAdmin = "school_admin".equals(role);

        // 学生角色一次取班级节点，复用给 todos/schedule/exams 三处
        String studentClassNodeId = "student".equals(role) ? userClassNodeId(userId, tenantId) : "";

        WorkspaceDashboard dash = new WorkspaceDashboard();
        dash.setRole(role);
        dash.setAnnouncements(new ArrayList<>());
        dash.setTodos(new ArrayList<>());
        dash.setSchedule(new ArrayList<>());
        dash.setCourses(new ArrayList<>());
        dash.setSceneTasks(new ArrayList<>());
        dash.setExams(new ArrayList<>());
        dash.setLearningPath(new ArrayList<>());
        dash.setTeacherCourses(new ArrayList<>());
        dash.setClassPlans(new ArrayList<>());
        dash.setClassSessions(new ArrayList<>());

        if (isSchoolAdmin) {
            dash.setStats(schoolAdminStats(tenantId));
            dash.setResourceStats(schoolAdminResourceStats(tenantId));
            dash.setPersonnelStats(schoolAdminPersonnelStats(tenantId));
            dash.setResourceGrowth(schoolAdminResourceGrowth(tenantId, 14));
            dash.setTodos(schoolAdminTodos(tenantId));
            dash.setSchedule(new ArrayList<>());
            return dash;
        }

        dash.setAnnouncements(listAnnouncements(role, tenantId));
        dash.setTodos(listTodos(userId, tenantId, role, studentClassNodeId));
        dash.setSchedule(listSchedule(userId, tenantId, role, studentClassNodeId));
        dash.setStats(stats(userId, tenantId, isTeacher));

        if (isTeacher) {
            dash.setTeacherCourses(listTeacherCourses(userId, tenantId));
            ClassPlanBundle bundle = listTeacherClassPlansAndSessions(userId, tenantId);
            dash.setClassPlans(bundle.plans);
            dash.setClassSessions(bundle.sessions);
        } else {
            dash.setCourses(listStudentCourses(userId, tenantId));
            dash.setSceneTasks(listStudentSceneTasks(userId, tenantId));
            dash.setExams(listStudentExams(userId, tenantId, studentClassNodeId));
        }
        return dash;
    }

    @Override
    public MyScheduleResponse mySchedule(String termId) {
        String userId = requireUserId();
        String tenantId = requireTenantId();

        String classNodeId = "";
        String teacherId = "";
        String viewAs = "teacher";
        if (listRoleCodes(userId, tenantId).contains("student")) {
            viewAs = "student";
            ZhiyuUser user = userMapper.selectById(userId);
            if (user != null && user.getOrgNodeId() != null && !user.getOrgNodeId().isBlank()) {
                classNodeId = user.getOrgNodeId();
            }
        } else {
            teacherId = userId;
        }

        if (termId == null || termId.isBlank()) {
            termId = findTermForSchedule(tenantId, userId, classNodeId);
            if (termId == null || termId.isBlank()) {
                throw new ApiException(404, "not_found", "尚未配置学期");
            }
        }
        TermDto term = fetchTermBrief(termId, tenantId);
        if (term == null) {
            throw new ApiException(404, "not_found", "学期不存在");
        }

        List<ScheduleEntryDto> items = new ArrayList<>();
        if (!classNodeId.isEmpty() || !teacherId.isEmpty()) {
            items = listTimetableEntries(tenantId, termId, classNodeId, teacherId, "published");
        }
        MyScheduleResponse resp = new MyScheduleResponse();
        resp.setTerm(term);
        resp.setViewAs(viewAs);
        resp.setItems(items);
        resp.setTotal(items.size());
        return resp;
    }

    // ---------- 仪表盘子查询（对齐 store/portal.go） ----------

    private List<WorkspaceAnnouncement> listAnnouncements(String role, String tenantId) {
        try {
            var wrapper = QueryBuilder.lambda(PortalAnnouncement.class)
                .apply("(array_length(target_roles, 1) IS NULL OR target_roles @> ARRAY[{0}::varchar])", role);
            if (tenantId != null) {
                wrapper.eq(PortalAnnouncement::getTenantId, tenantId);
            }
            wrapper.orderByDesc(PortalAnnouncement::getCreatedAt).last("LIMIT 10");
            List<PortalAnnouncement> rows = announcementMapper.selectList(wrapper.build());
            List<WorkspaceAnnouncement> items = new ArrayList<>();
            for (PortalAnnouncement a : rows) {
                WorkspaceAnnouncement dto = new WorkspaceAnnouncement();
                dto.setId(a.getId());
                dto.setTitle(a.getTitle());
                dto.setType(a.getType());
                dto.setIsNew(a.getIsNew());
                dto.setDate(a.getCreatedAt() == null ? null : a.getCreatedAt().format(DATE_FMT));
                items.add(dto);
            }
            return items;
        } catch (Exception e) {
            log.warn("portal dashboard announcements query failed", e);
            return new ArrayList<>();
        }
    }

    private List<WorkspaceTodo> listTodos(String userId, String tenantId, String role, String classNodeId) {
        List<WorkspaceTodo> todos = new ArrayList<>();
        if ("teacher".equals(role) || "school_admin".equals(role) || "school".equals(role)) {
            int pendingApprovals = pendingApprovalCount(tenantId);
            if (pendingApprovals > 0) {
                todos.add(todo("pending-approvals", "待审批事项", "approve", pendingApprovals, true));
            }
            int draftCourses = draftCourseCount(userId, tenantId);
            if (draftCourses > 0) {
                todos.add(todo("draft-courses", "待提交课程", "review", draftCourses, false));
            }
        } else {
            int upcomingExams = upcomingExamCount(tenantId, classNodeId);
            if (upcomingExams > 0) {
                todos.add(todo("upcoming-exams", "待参加考试", "exam", upcomingExams, false));
            }
        }
        return todos;
    }

    private WorkspaceTodo todo(String id, String title, String type, int count, boolean urgent) {
        WorkspaceTodo t = new WorkspaceTodo();
        t.setId(id);
        t.setTitle(title);
        t.setType(type);
        t.setCount(count);
        t.setUrgent(urgent);
        return t;
    }

    private List<WorkspaceScheduleEvent> listSchedule(String userId, String tenantId, String role, String classNodeId) {
        List<WorkspaceScheduleEvent> events = new ArrayList<>();
        Map<String, String> periodLabel = periodLabelMap(tenantId);
        if ("teacher".equals(role) || "school_admin".equals(role) || "school".equals(role)) {
            List<PortalScheduleEntry> rows = listTeacherSchedules(userId, tenantId);
            for (PortalScheduleEntry se : rows) {
                String eventType = "scene".equals(se.getType()) ? "scene" : "course";
                List<String> periodNames = se.getPeriods() == null ? List.of() : se.getPeriods();
                if (periodNames.isEmpty()) {
                    continue;
                }
                String period = periodNames.get(0);
                period = periodLabel.getOrDefault(period, period);
                WorkspaceScheduleEvent ev = new WorkspaceScheduleEvent();
                ev.setId(se.getId());
                ev.setTitle(se.getCourseName());
                ev.setType(eventType);
                ev.setDayOfWeek(se.getDayOfWeek());
                ev.setPeriod(period);
                ev.setLocation(blankToNull(se.getVenueName()));
                ev.setClassName(blankToNull(joinClassNames(se)));
                ev.setTeacher(blankToNull(se.getTeacherName()));
                ev.setStatus("进行中");
                ev.setScenarioId(se.getScenarioId());
                ev.setCourseId(se.getCourseId());
                events.add(ev);
            }
        } else if ("student".equals(role) && !classNodeId.isEmpty()) {
            List<PortalScheduleEntry> rows = listStudentSchedules(classNodeId, tenantId);
            for (PortalScheduleEntry se : rows) {
                String eventType = "scene".equals(se.getType()) ? "scene" : "course";
                List<String> periodNames = se.getPeriods() == null ? List.of() : se.getPeriods();
                if (periodNames.isEmpty()) {
                    continue;
                }
                String period = periodNames.get(0);
                period = periodLabel.getOrDefault(period, period);
                WorkspaceScheduleEvent ev = new WorkspaceScheduleEvent();
                ev.setId(se.getId());
                ev.setTitle(se.getCourseName());
                ev.setType(eventType);
                ev.setDayOfWeek(se.getDayOfWeek());
                ev.setPeriod(period);
                ev.setLocation(blankToNull(se.getVenueName()));
                ev.setTeacher(blankToNull(se.getTeacherName()));
                ev.setStatus("进行中");
                ev.setScenarioId(se.getScenarioId());
                ev.setCourseId(se.getCourseId());
                ev.setResourceVersion(se.getResourceVersion());
                events.add(ev);
            }
        }
        // 考试事件（全局，学生按班级过滤）
        for (PortalExamUsage e : listExamEvents(tenantId, classNodeId)) {
            int dayOfWeek = 1;
            if (e.getStartTime() != null) {
                dayOfWeek = e.getStartTime().getDayOfWeek().getValue(); // 1-7
            }
            WorkspaceScheduleEvent ev = new WorkspaceScheduleEvent();
            ev.setId(e.getId());
            ev.setTitle(e.getName());
            ev.setType("exam");
            ev.setDayOfWeek(dayOfWeek);
            ev.setPeriod("上午 1");
            ev.setStatus(e.getStatus());
            ev.setResourceVersion(e.getExamVersion());
            events.add(ev);
        }
        return events;
    }

    private WorkspaceStats stats(String userId, String tenantId, boolean isTeacher) {
        WorkspaceStats s = new WorkspaceStats();
        if (isTeacher) {
            int[] counts = teacherStats(userId, tenantId);
            s.setLabel1("授课课程");
            s.setValue1(counts[0]);
            s.setLabel2("学生人数");
            s.setValue2(counts[1]);
        } else {
            int[] counts = studentStats(tenantId);
            s.setLabel1("可选课程");
            s.setValue1(counts[0]);
            s.setLabel2("待考测评");
            s.setValue2(counts[1]);
        }
        return s;
    }

    private WorkspaceStats schoolAdminStats(String tenantId) {
        int courseCount = countCourses(tenantId);
        int pendingApprovalCount = pendingApprovalCount(tenantId);
        WorkspaceStats s = new WorkspaceStats();
        s.setLabel1("课程资源");
        s.setValue1(courseCount);
        s.setLabel2("待审批资源");
        s.setValue2(pendingApprovalCount);
        return s;
    }

    private List<WorkspaceResourceStat> schoolAdminResourceStats(String tenantId) {
        int courseCount = countCourses(tenantId);
        int scenarioCount = countScenarios(tenantId);
        int positionCount = countCareerPositions(tenantId);
        int questionBankCount = countQuestionBanks(tenantId);
        int examCount = countExams(tenantId);
        int examUsageCount = countExamUsages(tenantId);
        List<WorkspaceResourceStat> stats = new ArrayList<>();
        stats.add(resourceStat("产业岗位", positionCount, "briefcase", "/job/positions"));
        stats.add(resourceStat("实践场景", scenarioCount, "layers", "/scene/"));
        stats.add(resourceStat("课程资源", courseCount, "book-open", "/lesson/admin/system"));
        stats.add(resourceStat("题库", questionBankCount, "book-open", "/evaluation/question-banks"));
        stats.add(resourceStat("试卷", examCount, "file-text", "/evaluation/exams"));
        stats.add(resourceStat("考试", examUsageCount, "check-circle", "/evaluation/exam-usage"));
        return stats;
    }

    private WorkspaceResourceStat resourceStat(String label, int value, String icon, String href) {
        WorkspaceResourceStat s = new WorkspaceResourceStat();
        s.setLabel(label);
        s.setValue(value);
        s.setIcon(icon);
        s.setHref(href);
        return s;
    }

    private List<WorkspacePersonnelStat> schoolAdminPersonnelStats(String tenantId) {
        Map<String, Integer> counts = personnelStats(tenantId);
        List<WorkspacePersonnelStat> stats = new ArrayList<>();
        stats.add(personnelStat("学生", counts.getOrDefault("student", 0)));
        stats.add(personnelStat("教职工", counts.getOrDefault("teacher", 0)));
        stats.add(personnelStat("企业导师", counts.getOrDefault("enterprise_mentor", 0)));
        stats.add(personnelStat("学校管理员", counts.getOrDefault("school_admin", 0)));
        return stats;
    }

    private WorkspacePersonnelStat personnelStat(String label, int value) {
        WorkspacePersonnelStat s = new WorkspacePersonnelStat();
        s.setLabel(label);
        s.setValue(value);
        return s;
    }

    private List<WorkspaceTodo> schoolAdminTodos(String tenantId) {
        Map<String, String> typeLabels = new HashMap<>();
        typeLabels.put("course", "待审批课程");
        typeLabels.put("scenario", "待审批场景");
        typeLabels.put("career_position", "待审批岗位");
        typeLabels.put("question_bank", "待审批题库");
        typeLabels.put("exam", "待审批试卷");
        typeLabels.put("training_program", "待审批培养方案");

        List<WorkspaceTodo> todos = new ArrayList<>();
        try {
            var wrapper = QueryBuilder.lambda(PortalApprovalRecord.class)
                .eq(PortalApprovalRecord::getStatus, "pending");
            if (tenantId != null) {
                wrapper.eq(PortalApprovalRecord::getTenantId, tenantId);
            }
            List<PortalApprovalRecord> rows = approvalRecordMapper.selectList(wrapper.build());
            Map<String, Long> grouped = rows.stream().collect(Collectors.groupingBy(PortalApprovalRecord::getTargetType, Collectors.counting()));
            grouped.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .forEach(e -> {
                    String label = typeLabels.getOrDefault(e.getKey(), "待审批" + e.getKey());
                    todos.add(todo("pending-" + e.getKey(), label, "approve", e.getValue().intValue(), true));
                });
        } catch (Exception ex) {
            log.warn("portal dashboard admin todos query failed", ex);
        }
        return todos;
    }

    private List<WorkspaceCourse> listStudentCourses(String userId, String tenantId) {
        double ratio = creditHoursRatio();
        ZhiyuUser student = userMapper.selectById(userId);
        String orgNodeId = student == null ? null : student.getOrgNodeId();

        List<PortalCourse> rows = new ArrayList<>();
        try {
            var wrapper = QueryBuilder.lambda(PortalCourse.class)
                .eq(PortalCourse::getStatus, "published");
            if (tenantId != null) {
                wrapper.eq(PortalCourse::getTenantId, tenantId);
            }
            if (orgNodeId != null && !orgNodeId.isBlank()) {
                wrapper.apply("EXISTS (SELECT 1 FROM schedule_entries se WHERE se.course_id = courses.id AND se.status = 'published'"
                    + " AND (se.class_node_id = {0}::uuid OR {0}::uuid = ANY(se.class_node_ids)))", orgNodeId);
            }
            wrapper.orderByDesc(PortalCourse::getUpdatedAt).last("LIMIT 50");
            rows = courseMapper.selectList(wrapper.build());
        } catch (Exception e) {
            log.warn("portal dashboard student courses query failed", e);
        }

        List<WorkspaceCourse> items = new ArrayList<>();
        List<String> courseIds = new ArrayList<>();
        for (PortalCourse c : rows) {
            courseIds.add(c.getId());
        }
        // 批量：教师名称 + 资源版本（避免 N+1）
        Map<String, String> teacherMap = userNameMap(rows.stream()
            .map(PortalCourse::getTeacherId)
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new)));
        Map<String, String> versionMap = batchResourceVersions("courses", courseIds, orgNodeId);
        for (PortalCourse c : rows) {
            WorkspaceCourse item = new WorkspaceCourse();
            item.setId(c.getId());
            item.setCode(c.getCode());
            item.setName(c.getName());
            item.setType(c.getType());
            item.setTeacher(c.getTeacherId() == null ? "" : teacherMap.getOrDefault(c.getTeacherId(), ""));
            item.setStatus(publishedStatusLabel(c.getStatus()));
            item.setHours(totalHours(c.getOnlineHours(), c.getOfflineHours()));
            item.setCover(coverText(c.getName()));
            item.setResourceVersion(versionMap.getOrDefault(c.getId(), c.getVersion()));
            int hours = item.getHours() == null ? 0 : item.getHours();
            item.setCredit((int) (hours / ratio));
            items.add(item);
        }
        Map<String, Integer> progressMap = batchCourseProgress(courseIds, userId);
        for (WorkspaceCourse item : items) {
            item.setProgress(progressMap.getOrDefault(item.getId(), 0));
        }
        return items;
    }

    private List<WorkspaceSceneTask> listStudentSceneTasks(String userId, String tenantId) {
        ZhiyuUser student = userMapper.selectById(userId);
        String orgNodeId = student == null ? null : student.getOrgNodeId();

        // 学生班级已发布排课的场景（published）
        List<PortalScenario> scenarios = new ArrayList<>();
        try {
            var wrapper = QueryBuilder.lambda(PortalScenario.class)
                .eq(PortalScenario::getStatus, "published");
            if (tenantId != null) {
                wrapper.eq(PortalScenario::getTenantId, tenantId);
            }
            if (orgNodeId != null && !orgNodeId.isBlank()) {
                wrapper.apply("EXISTS (SELECT 1 FROM schedule_entries se WHERE se.scenario_id = scenarios.id AND se.status = 'published'"
                    + " AND se.type = 'scene' AND (se.class_node_id = {0}::uuid OR {0}::uuid = ANY(se.class_node_ids)))", orgNodeId);
            }
            wrapper.orderByDesc(PortalScenario::getUpdatedAt).last("LIMIT 50");
            scenarios = scenarioMapper.selectList(wrapper.build());
        } catch (Exception e) {
            log.warn("portal dashboard scene tasks query failed", e);
        }
        if (scenarios.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> scenarioIds = scenarios.stream().map(PortalScenario::getId).toList();
        Map<String, PortalScenario> scenarioMap = scenarios.stream()
            .collect(Collectors.toMap(PortalScenario::getId, Function.identity()));

        List<PortalScenarioTask> tasks = scenarioTaskMapper.selectList(
            QueryBuilder.lambda(PortalScenarioTask.class)
                .in(PortalScenarioTask::getScenarioId, scenarioIds)
                .build());

        List<WorkspaceSceneTask> items = new ArrayList<>();
        List<String> taskIds = new ArrayList<>();
        Map<String, String> versionMap = batchResourceVersions("scenarios", scenarioIds, orgNodeId);
        for (PortalScenarioTask t : tasks) {
            PortalScenario s = scenarioMap.get(t.getScenarioId());
            WorkspaceSceneTask item = new WorkspaceSceneTask();
            item.setId(t.getId());
            item.setScenarioId(t.getScenarioId());
            item.setSceneName(s == null ? "" : s.getName());
            item.setTaskName(t.getName());
            item.setPosition(s == null ? "" : s.getName());
            item.setAbilityTags(new ArrayList<>());
            item.setDifficulty(difficultyLabel(t.getDifficulty()));
            item.setDeadline("");
            item.setTotalScore(100);
            item.setResourceVersion(versionMap.getOrDefault(t.getScenarioId(), s == null ? null : s.getVersion()));
            items.add(item);
            taskIds.add(t.getId());
        }
        Map<String, String> statusMap = batchSceneTaskStatus(taskIds, userId);
        for (WorkspaceSceneTask item : items) {
            String st = statusMap.get(item.getId());
            if (st == null || st.isEmpty()) {
                st = "未开始";
            }
            item.setStatus(st);
        }
        return items;
    }

    private List<WorkspaceExam> listStudentExams(String userId, String tenantId, String classNodeId) {
        List<PortalExamUsage> usages = new ArrayList<>();
        try {
            syncExamUsageStatus(tenantId);
            var wrapper = QueryBuilder.lambda(PortalExamUsage.class)
                .in(PortalExamUsage::getStatus, "published", "finished")
                .in(PortalExamUsage::getTargetType, MANUAL_EXAM_TARGET_TYPES);
            if (!classNodeId.isEmpty()) {
                wrapper.apply("(target_type != 'class' OR {0}::uuid = ANY(target_ids))", classNodeId);
            } else {
                wrapper.ne(PortalExamUsage::getTargetType, "class");
            }
            if (tenantId != null) {
                wrapper.apply("EXISTS (SELECT 1 FROM users u WHERE u.id = creator_id AND u.tenant_id = {0}::uuid)", tenantId);
            }
            wrapper.last("ORDER BY start_time ASC NULLS LAST LIMIT 50");
            usages = examUsageMapper.selectList(wrapper.build());
        } catch (Exception e) {
            log.warn("portal dashboard student exams query failed", e);
        }
        if (usages.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> usageIds = usages.stream().map(PortalExamUsage::getId).toList();
        List<String> examIds = usages.stream().map(PortalExamUsage::getExamId).filter(java.util.Objects::nonNull).distinct().toList();

        Map<String, PortalExam> examMap = examIds.isEmpty() ? Map.of() : examMapper.selectList(
            QueryBuilder.lambda(PortalExam.class).in(PortalExam::getId, examIds).build())
            .stream().collect(Collectors.toMap(PortalExam::getId, Function.identity()));
        Map<String, PortalExamResult> resultMap = examResultMapper.selectList(
            QueryBuilder.lambda(PortalExamResult.class)
                .in(PortalExamResult::getExamUsageId, usageIds)
                .eq(PortalExamResult::getUserId, userId)
                .build())
            .stream().collect(Collectors.toMap(PortalExamResult::getExamUsageId, Function.identity()));

        List<WorkspaceExam> items = new ArrayList<>();
        for (PortalExamUsage e : usages) {
            WorkspaceExam exam = new WorkspaceExam();
            exam.setId(e.getId());
            exam.setExamId(e.getExamId());
            exam.setName(e.getName());
            exam.setType("在线测评");
            exam.setDuration(e.getDuration() == null ? 0 : e.getDuration());
            PortalExam examRow = e.getExamId() == null ? null : examMap.get(e.getExamId());
            exam.setTotalScore(examRow == null || examRow.getTotalScore() == null ? 0 : examRow.getTotalScore().intValue());
            exam.setStatus(examStatusLabel(e.getStatus()));
            PortalExamResult result = resultMap.get(e.getId());
            if (result != null && result.getScore() != null) {
                exam.setScore(result.getScore().intValue());
            }
            if (e.getStartTime() != null) {
                exam.setStartTime(e.getStartTime().format(DATETIME_FMT));
            }
            if (e.getEndTime() != null) {
                exam.setEndTime(e.getEndTime().format(DATETIME_FMT));
            }
            items.add(exam);
        }
        return items;
    }

    private List<WorkspaceTeacherCourse> listTeacherCourses(String userId, String tenantId) {
        List<PortalCourse> rows = new ArrayList<>();
        try {
            var wrapper = QueryBuilder.lambda(PortalCourse.class)
                .eq(PortalCourse::getStatus, "published")
                .apply("(teacher_id = {0}::uuid OR creator_id = {0}::uuid)", userId);
            if (tenantId != null) {
                wrapper.eq(PortalCourse::getTenantId, tenantId);
            }
            wrapper.orderByDesc(PortalCourse::getUpdatedAt).last("LIMIT 50");
            rows = courseMapper.selectList(wrapper.build());
        } catch (Exception e) {
            log.warn("portal dashboard teacher courses query failed", e);
        }

        List<WorkspaceTeacherCourse> items = new ArrayList<>();
        List<String> courseIds = new ArrayList<>();
        for (PortalCourse c : rows) {
            WorkspaceTeacherCourse item = new WorkspaceTeacherCourse();
            item.setId(c.getId());
            item.setCode(c.getCode());
            item.setName(c.getName());
            item.setType(c.getType());
            item.setClassName(c.getClassName());
            item.setTerm(c.getSemester());
            item.setStatus(publishedStatusLabel(c.getStatus()));
            item.setHours(totalHours(c.getOnlineHours(), c.getOfflineHours()));
            item.setCover(coverText(c.getName()));
            item.setProgress(0);
            items.add(item);
            courseIds.add(c.getId());
        }
        Map<String, Integer> countMap = batchCourseStudentCounts(courseIds);
        for (WorkspaceTeacherCourse item : items) {
            item.setStudents(countMap.getOrDefault(item.getId(), 0));
        }
        return items;
    }

    private ClassPlanBundle listTeacherClassPlansAndSessions(String userId, String tenantId) {
        ClassPlanBundle bundle = new ClassPlanBundle();
        if (tenantId == null) {
            return bundle;
        }
        List<PortalScheduleEntry> rows;
        try {
            rows = scheduleEntryMapper.selectList(
                QueryBuilder.lambda(PortalScheduleEntry.class)
                    .eq(PortalScheduleEntry::getTeacherId, userId)
                    .eq(PortalScheduleEntry::getTenantId, tenantId)
                    .build());
        } catch (Exception e) {
            log.warn("portal dashboard class plans query failed", e);
            return bundle;
        }
        if (rows.isEmpty()) {
            return bundle;
        }
        // 学期按 start_date DESC 排序（对齐 Go ORDER BY t.start_date DESC）
        List<String> termIds = rows.stream().map(PortalScheduleEntry::getTermId).distinct().toList();
        Map<String, PortalTerm> termMap = termMapper.selectList(
            QueryBuilder.lambda(PortalTerm.class).in(PortalTerm::getId, termIds).build())
            .stream().collect(Collectors.toMap(PortalTerm::getId, Function.identity()));
        rows.sort((a, b) -> {
            PortalTerm ta = termMap.get(a.getTermId());
            PortalTerm tb = termMap.get(b.getTermId());
            LocalDate da = ta == null || ta.getStartDate() == null ? LocalDate.MIN : ta.getStartDate();
            LocalDate db = tb == null || tb.getStartDate() == null ? LocalDate.MIN : tb.getStartDate();
            int c = db.compareTo(da);
            if (c != 0) {
                return c;
            }
            int c2 = Integer.compare(nz(a.getDayOfWeek()), nz(b.getDayOfWeek()));
            if (c2 != 0) {
                return c2;
            }
            int c3 = Integer.compare(nz(a.getStartWeek()), nz(b.getStartWeek()));
            if (c3 != 0) {
                return c3;
            }
            return safeCompare(a.getCourseName(), b.getCourseName());
        });

        Map<String, String> periodLabel = periodLabelMap(tenantId);
        // 批量教师/场地名称（避免 N+1）
        Set<String> teacherIds = rows.stream().map(PortalScheduleEntry::getTeacherId)
            .filter(java.util.Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> venueIds = rows.stream().map(PortalScheduleEntry::getVenueId)
            .filter(java.util.Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
        Map<String, String> teacherMap = userNameMap(teacherIds);
        Map<String, String> venueMap = venueNameMap(venueIds);
        // key: planEntryId + course + term
        Map<String, WorkspaceClassPlan> planIndex = new LinkedHashMap<>();
        for (PortalScheduleEntry se : rows) {
            String planEntryId = se.getPlanEntryId() == null || se.getPlanEntryId().isBlank() ? se.getId() : se.getPlanEntryId();
            String termName = termMap.containsKey(se.getTermId()) && termMap.get(se.getTermId()).getName() != null
                ? termMap.get(se.getTermId()).getName() : "";
            String key = planEntryId + "|" + se.getCourseName() + "|" + termName;
            WorkspaceClassPlan plan = planIndex.get(key);
            if (plan == null) {
                plan = new WorkspaceClassPlan();
                plan.setId(planEntryId);
                plan.setName(joinClassNames(se));
                plan.setCourse(se.getCourseName());
                plan.setTerm(termName);
                plan.setStudents(0);
                plan.setTeacher(se.getTeacherId() == null ? "" : teacherMap.getOrDefault(se.getTeacherId(), ""));
                plan.setStatus("published".equals(se.getStatus()) ? "active" : "pending");
                plan.setScenarioId(se.getScenarioId());
                plan.setCourseId(se.getCourseId());
                planIndex.put(key, plan);
                bundle.plans.add(plan);
            }
            String planId = plan.getId();

            List<String> periodNames = se.getPeriods() == null ? List.of() : se.getPeriods();
            if (periodNames.isEmpty()) {
                continue;
            }
            String periodName = periodNames.get(0);
            String label = periodLabel.getOrDefault(periodName, periodName);
            for (int w = nz(se.getStartWeek()); w <= nz(se.getEndWeek()); w++) {
                if ("odd".equals(se.getWeekPattern()) && w % 2 == 0) {
                    continue;
                }
                if ("even".equals(se.getWeekPattern()) && w % 2 != 0) {
                    continue;
                }
                String sessionStatus = "published".equals(se.getStatus()) ? "associated" : "pending";
                String displayPeriod = periodLabel.getOrDefault(label, label);
                WorkspaceClassSession session = new WorkspaceClassSession();
                session.setId(se.getId() + "-w" + w);
                session.setCourseId(planId);
                session.setVenue(se.getVenueId() == null ? "" : venueMap.getOrDefault(se.getVenueId(), ""));
                session.setWeek(w);
                session.setWeekday(DAY_NAMES.getOrDefault(String.valueOf(nz(se.getDayOfWeek())), ""));
                session.setPeriod(displayPeriod);
                session.setStatus(sessionStatus);
                bundle.sessions.add(session);
            }
        }
        return bundle;
    }

    // ---------- 统计子查询（对齐 store/portal.go 各方法） ----------

    private int pendingApprovalCount(String tenantId) {
        var wrapper = QueryBuilder.lambda(PortalApprovalRecord.class).eq(PortalApprovalRecord::getStatus, "pending");
        if (tenantId != null) {
            wrapper.eq(PortalApprovalRecord::getTenantId, tenantId);
        }
        return approvalRecordMapper.selectCount(wrapper.build()).intValue();
    }

    private int draftCourseCount(String userId, String tenantId) {
        var wrapper = QueryBuilder.lambda(PortalCourse.class)
            .eq(PortalCourse::getStatus, "draft")
            .apply("(teacher_id = {0}::uuid OR creator_id = {0}::uuid)", userId);
        if (tenantId != null) {
            wrapper.eq(PortalCourse::getTenantId, tenantId);
        }
        return courseMapper.selectCount(wrapper.build()).intValue();
    }

    private int upcomingExamCount(String tenantId, String classNodeId) {
        var wrapper = QueryBuilder.lambda(PortalExamUsage.class)
            .eq(PortalExamUsage::getStatus, "published")
            .apply("(start_time IS NULL OR start_time >= {0})", OffsetDateTime.now())
            .in(PortalExamUsage::getTargetType, MANUAL_EXAM_TARGET_TYPES);
        if (!classNodeId.isEmpty()) {
            wrapper.apply("(target_type != 'class' OR {0}::uuid = ANY(target_ids))", classNodeId);
        } else {
            wrapper.ne(PortalExamUsage::getTargetType, "class");
        }
        if (tenantId != null) {
            wrapper.apply("EXISTS (SELECT 1 FROM users u WHERE u.id = creator_id AND u.tenant_id = {0}::uuid)", tenantId);
        }
        return examUsageMapper.selectCount(wrapper.build()).intValue();
    }

    private List<PortalScheduleEntry> listTeacherSchedules(String userId, String tenantId) {
        try {
            var wrapper = QueryBuilder.lambda(PortalScheduleEntry.class)
                .eq(PortalScheduleEntry::getStatus, "published")
                .eq(PortalScheduleEntry::getTeacherId, userId);
            if (tenantId != null) {
                wrapper.eq(PortalScheduleEntry::getTenantId, tenantId);
            }
            wrapper.orderByAsc(PortalScheduleEntry::getDayOfWeek).orderByAsc(PortalScheduleEntry::getStartWeek)
                .last("LIMIT 50");
            List<PortalScheduleEntry> rows = scheduleEntryMapper.selectList(wrapper.build());
            attachScheduleNames(rows);
            return rows;
        } catch (Exception e) {
            log.warn("portal dashboard teacher schedules query failed", e);
            return new ArrayList<>();
        }
    }

    private List<PortalScheduleEntry> listStudentSchedules(String classNodeId, String tenantId) {
        try {
            var wrapper = QueryBuilder.lambda(PortalScheduleEntry.class)
                .eq(PortalScheduleEntry::getStatus, "published")
                .apply("(class_node_id = {0}::uuid OR {0}::uuid = ANY(class_node_ids))", classNodeId);
            if (tenantId != null) {
                wrapper.eq(PortalScheduleEntry::getTenantId, tenantId);
            }
            wrapper.orderByAsc(PortalScheduleEntry::getDayOfWeek).orderByAsc(PortalScheduleEntry::getStartWeek)
                .last("LIMIT 50");
            List<PortalScheduleEntry> rows = scheduleEntryMapper.selectList(wrapper.build());
            attachScheduleNames(rows);
            return rows;
        } catch (Exception e) {
            log.warn("portal dashboard student schedules query failed", e);
            return new ArrayList<>();
        }
    }

    /** 批量填充排课关联名称（场地/教师/班级，避免 N+1） */
    private void attachScheduleNames(List<PortalScheduleEntry> rows) {
        if (rows.isEmpty()) {
            return;
        }
        Set<String> venueIds = new LinkedHashSet<>();
        Set<String> teacherIds = new LinkedHashSet<>();
        Set<String> orgIds = new LinkedHashSet<>();
        for (PortalScheduleEntry se : rows) {
            if (se.getVenueId() != null && !se.getVenueId().isBlank()) {
                venueIds.add(se.getVenueId());
            }
            if (se.getTeacherId() != null && !se.getTeacherId().isBlank()) {
                teacherIds.add(se.getTeacherId());
            }
            if (se.getClassNodeId() != null && !se.getClassNodeId().isBlank()) {
                orgIds.add(se.getClassNodeId());
            }
            if (se.getClassNodeIds() != null) {
                orgIds.addAll(se.getClassNodeIds());
            }
        }
        Map<String, String> venueMap = venueNameMap(venueIds);
        Map<String, String> orgMap = orgNameMap(orgIds);
        Map<String, String> teacherMap = userNameMap(teacherIds);
        for (PortalScheduleEntry se : rows) {
            se.setVenueName(se.getVenueId() == null ? "" : venueMap.getOrDefault(se.getVenueId(), ""));
            se.setTeacherName(se.getTeacherId() == null ? "" : teacherMap.getOrDefault(se.getTeacherId(), ""));
            List<String> names = new ArrayList<>();
            if (se.getClassNodeIds() != null) {
                for (String id : se.getClassNodeIds()) {
                    String n = orgMap.get(id);
                    if (n != null && !n.isBlank()) {
                        names.add(n);
                    }
                }
            } else if (se.getClassNodeId() != null && orgMap.containsKey(se.getClassNodeId())) {
                names.add(orgMap.get(se.getClassNodeId()));
            }
            se.setClassNames(names);
        }
    }

    private String joinClassNames(PortalScheduleEntry se) {
        if (se.getClassNames() == null || se.getClassNames().isEmpty()) {
            return "";
        }
        return String.join("、", se.getClassNames());
    }

    private List<PortalExamUsage> listExamEvents(String tenantId, String classNodeId) {
        try {
            syncExamUsageStatus(tenantId);
            var wrapper = QueryBuilder.lambda(PortalExamUsage.class)
                .eq(PortalExamUsage::getStatus, "published")
                .in(PortalExamUsage::getTargetType, MANUAL_EXAM_TARGET_TYPES);
            if (!classNodeId.isEmpty()) {
                wrapper.apply("(target_type != 'class' OR {0}::uuid = ANY(target_ids))", classNodeId);
            } else {
                wrapper.ne(PortalExamUsage::getTargetType, "class");
            }
            if (tenantId != null) {
                wrapper.apply("EXISTS (SELECT 1 FROM users u WHERE u.id = creator_id AND u.tenant_id = {0}::uuid)", tenantId);
            }
            wrapper.last("ORDER BY start_time ASC NULLS LAST LIMIT 20");
            return examUsageMapper.selectList(wrapper.build());
        } catch (Exception e) {
            log.warn("portal dashboard exam events query failed", e);
            return new ArrayList<>();
        }
    }

    /** 定时激活考试状态同步（每分钟每租户限流一次，对齐 Go syncThrottle） */
    private void syncExamUsageStatus(String tenantId) {
        String key = tenantId == null || tenantId.isBlank() ? "all" : tenantId;
        long now = System.currentTimeMillis();
        Long last = SYNC_THROTTLE.get(key);
        if (last != null && now - last < 60_000L) {
            return;
        }
        SYNC_THROTTLE.put(key, now);
        try {
            examUsageMapper.syncScheduledExamUsageStatus(tenantId, OffsetDateTime.now());
        } catch (Exception e) {
            log.warn("auto activate exam usages failed", e);
        }
    }

    private static final java.util.concurrent.ConcurrentHashMap<String, Long> SYNC_THROTTLE = new java.util.concurrent.ConcurrentHashMap<>();

    private int[] teacherStats(String userId, String tenantId) {
        var wrapper = QueryBuilder.lambda(PortalCourse.class)
            .eq(PortalCourse::getStatus, "published")
            .apply("(teacher_id = {0}::uuid OR creator_id = {0}::uuid)", userId);
        if (tenantId != null) {
            wrapper.eq(PortalCourse::getTenantId, tenantId);
        }
        List<PortalCourse> courses = courseMapper.selectList(wrapper.build());
        int courseCount = courses.size();
        int studentCount = 0;
        if (!courses.isEmpty()) {
            List<String> courseIds = courses.stream().map(PortalCourse::getId).toList();
            List<PortalLessonBehavior> behaviors = lessonBehaviorMapper.selectList(
                QueryBuilder.lambda(PortalLessonBehavior.class)
                    .in(PortalLessonBehavior::getCourseId, courseIds)
                    .build());
            studentCount = (int) behaviors.stream().map(PortalLessonBehavior::getStudentUserId).distinct().count();
        }
        return new int[] {courseCount, studentCount};
    }

    private int[] studentStats(String tenantId) {
        var courseWrapper = QueryBuilder.lambda(PortalCourse.class).eq(PortalCourse::getStatus, "published");
        if (tenantId != null) {
            courseWrapper.eq(PortalCourse::getTenantId, tenantId);
        }
        int courseCount = courseMapper.selectCount(courseWrapper.build()).intValue();

        var examWrapper = QueryBuilder.lambda(PortalExamUsage.class).eq(PortalExamUsage::getStatus, "published");
        if (tenantId != null) {
            examWrapper.apply("EXISTS (SELECT 1 FROM users u WHERE u.id = creator_id AND u.tenant_id = {0}::uuid)", tenantId);
        }
        int examCount = examUsageMapper.selectCount(examWrapper.build()).intValue();
        return new int[] {courseCount, examCount};
    }

    private Map<String, Integer> personnelStats(String tenantId) {
        Map<String, Integer> counts = new HashMap<>();
        try {
            var roleWrapper = QueryBuilder.lambda(PortalRole.class)
                .in(PortalRole::getCode, "student", "teacher", "enterprise_mentor", "school_admin");
            if (tenantId != null) {
                roleWrapper.eq(PortalRole::getTenantId, tenantId);
            }
            List<PortalRole> roles = roleMapper.selectList(roleWrapper.build());
            if (roles.isEmpty()) {
                return counts;
            }
            Map<String, String> roleIdToCode = roles.stream()
                .collect(Collectors.toMap(PortalRole::getId, PortalRole::getCode));
            List<String> roleIds = new ArrayList<>(roleIdToCode.keySet());
            List<PortalUserRole> userRoles = userRoleMapper.selectList(
                QueryBuilder.lambda(PortalUserRole.class).in(PortalUserRole::getRoleId, roleIds).build());
            Map<String, Long> roleCounts = userRoles.stream()
                .collect(Collectors.groupingBy(PortalUserRole::getRoleId, Collectors.mapping(PortalUserRole::getUserId, Collectors.toSet())))
                .entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> (long) e.getValue().size()));
            roleCounts.forEach((roleId, cnt) -> counts.put(roleIdToCode.get(roleId), cnt.intValue()));
        } catch (Exception e) {
            log.warn("portal dashboard personnel stats query failed", e);
        }
        return counts;
    }

    private int countCourses(String tenantId) {
        return selectCountTenant(courseMapper, PortalCourse.class, tenantId).intValue();
    }

    private int countScenarios(String tenantId) {
        return selectCountTenant(scenarioMapper, PortalScenario.class, tenantId).intValue();
    }

    private int countCareerPositions(String tenantId) {
        return selectCountTenant(careerPositionMapper, PortalCareerPosition.class, tenantId).intValue();
    }

    private int countQuestionBanks(String tenantId) {
        return selectCountTenant(portalQuestionBankMapper, PortalQuestionBank.class, tenantId).intValue();
    }

    private int countExams(String tenantId) {
        return selectCountTenant(examMapper, PortalExam.class, tenantId).intValue();
    }

    private int countExamUsages(String tenantId) {
        return selectCountTenant(examUsageMapper, PortalExamUsage.class, tenantId).intValue();
    }

    private <T> Long selectCountTenant(com.baomidou.mybatisplus.core.mapper.BaseMapper<T> mapper, Class<T> clazz, String tenantId) {
        var wrapper = QueryBuilder.lambda(clazz);
        wrapper.apply("tenant_id = {0}::uuid", tenantId);
        return mapper.selectCount(wrapper.build());
    }

    private List<WorkspaceResourceGrowth> schoolAdminResourceGrowth(String tenantId, int days) {
        if (days <= 0) {
            days = 14;
        }
        OffsetDateTime now = OffsetDateTime.now();
        List<String> dayKeys = new ArrayList<>();
        Map<String, Integer> dayIndex = new HashMap<>();
        for (int i = days - 1; i >= 0; i--) {
            String key = now.minusDays(i).format(DATE_FMT);
            dayIndex.put(key, dayKeys.size());
            dayKeys.add(key);
        }
        List<WorkspaceResourceGrowth> result = new ArrayList<>(days);
        for (String key : dayKeys) {
            WorkspaceResourceGrowth g = new WorkspaceResourceGrowth();
            g.setDate(key);
            result.add(g);
        }
        String since = now.minusDays(days).format(DATE_FMT);

        countGrowthByDay(tenantId, since, dayIndex, result, (g, v) -> g.setCourses(v),
            () -> courseMapper.selectMaps(growthWrapper(PortalCourse.class, "created_at", tenantId, since)));
        countGrowthByDay(tenantId, since, dayIndex, result, (g, v) -> g.setScenarios(v),
            () -> scenarioMapper.selectMaps(growthWrapper(PortalScenario.class, "created_at", tenantId, since)));
        countGrowthByDay(tenantId, since, dayIndex, result, (g, v) -> g.setCareerPositions(v),
            () -> careerPositionMapper.selectMaps(growthWrapper(PortalCareerPosition.class, "created_at", tenantId, since)));
        countGrowthByDay(tenantId, since, dayIndex, result, (g, v) -> g.setQuestionBanks(v),
            () -> portalQuestionBankMapper.selectMaps(growthWrapper(PortalQuestionBank.class, "created_at", tenantId, since)));
        countGrowthByDay(tenantId, since, dayIndex, result, (g, v) -> g.setExams(v),
            () -> examMapper.selectMaps(growthWrapper(PortalExam.class, "created_at", tenantId, since)));
        countGrowthByDay(tenantId, since, dayIndex, result, (g, v) -> g.setExamUsages(v),
            () -> examUsageMapper.selectMaps(growthWrapper(PortalExamUsage.class, "created_at", tenantId, since)));
        return result;
    }

    private void countGrowthByDay(String tenantId, String since, Map<String, Integer> dayIndex,
                                  List<WorkspaceResourceGrowth> result,
                                  java.util.function.BiConsumer<WorkspaceResourceGrowth, Integer> setter,
                                  java.util.function.Supplier<List<Map<String, Object>>> query) {
        try {
            for (Map<String, Object> m : query.get()) {
                Object day = m.get("day");
                Object cnt = m.get("cnt");
                if (day == null) {
                    continue;
                }
                Integer idx = dayIndex.get(day.toString());
                if (idx != null) {
                    setter.accept(result.get(idx), cnt == null ? 0 : ((Number) cnt).intValue());
                }
            }
        } catch (Exception e) {
            log.warn("portal resource growth query failed", e);
        }
    }

    /** 按天聚合查询构造（TO_CHAR(DATE_TRUNC('day', ...)) + COUNT(*)） */
    private <T> QueryWrapper<T> growthWrapper(Class<T> entityClass, String dateCol, String tenantId, String since) {
        QueryWrapper<T> qw = new QueryWrapper<>();
        qw.select("TO_CHAR(DATE_TRUNC('day', " + dateCol + "), 'YYYY-MM-DD') AS day", "COUNT(*) AS cnt")
            .groupBy("DATE_TRUNC('day', " + dateCol + ")");
        if (tenantId != null) {
            qw.eq("tenant_id", tenantId);
        }
        qw.apply(dateCol + " >= {0}::date", since);
        return qw;
    }

    private Map<String, Integer> batchCourseProgress(List<String> courseIds, String userId) {
        Map<String, Integer> result = new HashMap<>();
        if (courseIds.isEmpty()) {
            return result;
        }
        try {
            List<PortalLessonBehavior> behaviors = lessonBehaviorMapper.selectList(
                QueryBuilder.lambda(PortalLessonBehavior.class)
                    .in(PortalLessonBehavior::getCourseId, courseIds)
                    .eq(PortalLessonBehavior::getStudentUserId, userId)
                    .build());
            Map<String, long[]> agg = new HashMap<>();
            for (PortalLessonBehavior b : behaviors) {
                long[] arr = agg.computeIfAbsent(b.getCourseId(), k -> new long[2]);
                arr[0]++;
                if ("present".equals(b.getAttendance())) {
                    arr[1]++;
                }
            }
            for (Map.Entry<String, long[]> e : agg.entrySet()) {
                long total = e.getValue()[0];
                long present = e.getValue()[1];
                result.put(e.getKey(), total == 0 ? 0 : (int) (present * 100 / total));
            }
        } catch (Exception e) {
            log.warn("portal batch course progress query failed", e);
        }
        return result;
    }

    private Map<String, Integer> batchCourseStudentCounts(List<String> courseIds) {
        Map<String, Integer> result = new HashMap<>();
        if (courseIds.isEmpty()) {
            return result;
        }
        try {
            List<PortalLessonBehavior> behaviors = lessonBehaviorMapper.selectList(
                QueryBuilder.lambda(PortalLessonBehavior.class)
                    .in(PortalLessonBehavior::getCourseId, courseIds)
                    .build());
            Map<String, Set<String>> agg = new HashMap<>();
            for (PortalLessonBehavior b : behaviors) {
                agg.computeIfAbsent(b.getCourseId(), k -> new LinkedHashSet<>()).add(b.getStudentUserId());
            }
            agg.forEach((courseId, set) -> result.put(courseId, set.size()));
        } catch (Exception e) {
            log.warn("portal batch course student counts query failed", e);
        }
        return result;
    }

    private Map<String, String> batchSceneTaskStatus(List<String> taskIds, String userId) {
        Map<String, String> result = new HashMap<>();
        if (taskIds.isEmpty()) {
            return result;
        }
        try {
            // 对齐 Go：DISTINCT ON (task_id) 取最新一条，按 status/score 映射 未开始/已完成/进行中
            List<PortalSceneEvalResult> rows = sceneEvalResultMapper.selectList(
                QueryBuilder.lambda(PortalSceneEvalResult.class)
                    .in(PortalSceneEvalResult::getTaskId, taskIds)
                    .eq(PortalSceneEvalResult::getEvaluateeId, userId)
                    .orderByAsc(PortalSceneEvalResult::getTaskId)
                    .orderByDesc(PortalSceneEvalResult::getCreatedAt)
                    .build());
            Map<String, PortalSceneEvalResult> latest = new LinkedHashMap<>();
            for (PortalSceneEvalResult r : rows) {
                latest.putIfAbsent(r.getTaskId(), r);
            }
            for (PortalSceneEvalResult r : latest.values()) {
                String status = r.getStatus();
                if (status == null || status.isBlank()) {
                    result.put(r.getTaskId(), "未开始");
                } else if ("evaluated".equals(status) || r.getTotalScore() != null) {
                    result.put(r.getTaskId(), "已完成");
                } else {
                    result.put(r.getTaskId(), "进行中");
                }
            }
        } catch (Exception e) {
            log.warn("portal batch scene task status query failed", e);
        }
        return result;
    }

    private double creditHoursRatio() {
        try {
            PortalPlatformConfig cfg = platformConfigMapper.selectOne(
                QueryBuilder.lambda(PortalPlatformConfig.class)
                    .eq(PortalPlatformConfig::getKey, "credit_hours_ratio")
                    .build());
            if (cfg != null && cfg.getValue() != null) {
                double ratio = Double.parseDouble(cfg.getValue());
                if (ratio > 0) {
                    return ratio;
                }
            }
        } catch (Exception e) {
            log.warn("portal credit hours ratio query failed", e);
        }
        return 16;
    }

    private Map<String, String> periodLabelMap(String tenantId) {
        Map<String, String> m = new HashMap<>();
        if (tenantId == null) {
            return m;
        }
        try {
            List<PortalPeriodSlot> rows = periodSlotMapper.selectList(
                QueryBuilder.lambda(PortalPeriodSlot.class)
                    .eq(PortalPeriodSlot::getTenantId, tenantId)
                    .orderByAsc(PortalPeriodSlot::getSortOrder)
                    .build());
            Map<String, String> prefixes = Map.of(
                "morning_self", "早自习",
                "morning", "上午",
                "afternoon", "下午",
                "evening", "晚自习");
            Map<String, Integer> index = new HashMap<>();
            for (PortalPeriodSlot p : rows) {
                String prefix = prefixes.getOrDefault(p.getSlotType(), "上午");
                index.merge(p.getSlotType(), 1, Integer::sum);
                m.put(p.getName(), prefix + " " + index.get(p.getSlotType()));
            }
        } catch (Exception e) {
            log.warn("portal period label map query failed", e);
        }
        return m;
    }

    // ---------- 我的课表子查询（对齐 scheduling_handler.go MySchedule） ----------

    private String findTermForSchedule(String tenantId, String userId, String classNodeId) {
        // 对齐 Go：优先当前学期，其次含本人排课最多的学期，最后按开始日期倒序
        try {
            List<PortalTerm> terms = termMapper.selectList(
                QueryBuilder.lambda(PortalTerm.class).eq(PortalTerm::getTenantId, tenantId).build());
            if (terms.isEmpty()) {
                return null;
            }
            String scopeCond;
            String scopeArg;
            if (!classNodeId.isEmpty()) {
                scopeCond = "(se.class_node_id = {0}::uuid OR {0}::uuid = ANY(se.class_node_ids))";
                scopeArg = classNodeId;
            } else {
                scopeCond = "se.teacher_id = {0}::uuid";
                scopeArg = userId;
            }
            Map<String, Long> scheduleCounts = new HashMap<>();
            for (PortalTerm t : terms) {
                var wrapper = QueryBuilder.lambda(PortalScheduleEntry.class)
                    .eq(PortalScheduleEntry::getTermId, t.getId())
                    .eq(PortalScheduleEntry::getTenantId, tenantId)
                    .apply(scopeCond, scopeArg);
                scheduleCounts.put(t.getId(), scheduleEntryMapper.selectCount(wrapper.build()));
            }
            return terms.stream()
                .sorted((a, b) -> {
                    int c = Boolean.compare(Boolean.TRUE.equals(b.getIsCurrent()), Boolean.TRUE.equals(a.getIsCurrent()));
                    if (c != 0) {
                        return c;
                    }
                    int c2 = Long.compare(scheduleCounts.getOrDefault(b.getId(), 0L), scheduleCounts.getOrDefault(a.getId(), 0L));
                    if (c2 != 0) {
                        return c2;
                    }
                    LocalDate da = a.getStartDate() == null ? LocalDate.MIN : a.getStartDate();
                    LocalDate db = b.getStartDate() == null ? LocalDate.MIN : b.getStartDate();
                    return db.compareTo(da);
                })
                .map(PortalTerm::getId)
                .findFirst()
                .orElse(null);
        } catch (Exception e) {
            log.warn("find term for schedule failed", e);
            return null;
        }
    }

    private TermDto fetchTermBrief(String termId, String tenantId) {
        PortalTerm t = termMapper.selectOne(
            QueryBuilder.lambda(PortalTerm.class)
                .eq(PortalTerm::getId, termId)
                .eq(PortalTerm::getTenantId, tenantId)
                .build());
        if (t == null) {
            return null;
        }
        TermDto dto = new TermDto();
        dto.setId(t.getId());
        dto.setName(t.getName());
        dto.setStartDate(t.getStartDate() == null ? null : t.getStartDate().format(DATE_FMT));
        dto.setEndDate(t.getEndDate() == null ? null : t.getEndDate().format(DATE_FMT));
        dto.setWeeksCount(t.getWeeksCount());
        dto.setIsCurrent(t.getIsCurrent());
        dto.setCreatedAt(t.getCreatedAt());
        return dto;
    }

    private List<ScheduleEntryDto> listTimetableEntries(String tenantId, String termId, String classNodeId, String teacherId, String status) {
        var wrapper = QueryBuilder.lambda(PortalScheduleEntry.class)
            .eq(PortalScheduleEntry::getTenantId, tenantId)
            .eq(PortalScheduleEntry::getTermId, termId);
        if (!classNodeId.isEmpty()) {
            wrapper.apply("({0}::uuid = ANY(class_node_ids) OR class_node_id = {0}::uuid)", classNodeId);
        }
        if (!teacherId.isEmpty()) {
            wrapper.eq(PortalScheduleEntry::getTeacherId, teacherId);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(PortalScheduleEntry::getStatus, status);
        }
        wrapper.orderByAsc(PortalScheduleEntry::getDayOfWeek).orderByAsc(PortalScheduleEntry::getPeriods);
        List<PortalScheduleEntry> rows = scheduleEntryMapper.selectList(wrapper.build());

        // 批量关联名称（教师/场地/班级/场景）
        Set<String> teacherIds = new LinkedHashSet<>();
        Set<String> venueIds = new LinkedHashSet<>();
        Set<String> orgIds = new LinkedHashSet<>();
        Set<String> scenarioIds = new LinkedHashSet<>();
        for (PortalScheduleEntry se : rows) {
            if (se.getTeacherId() != null && !se.getTeacherId().isBlank()) {
                teacherIds.add(se.getTeacherId());
            }
            if (se.getVenueId() != null && !se.getVenueId().isBlank()) {
                venueIds.add(se.getVenueId());
            }
            if (se.getClassNodeId() != null && !se.getClassNodeId().isBlank()) {
                orgIds.add(se.getClassNodeId());
            }
            if (se.getScenarioId() != null && !se.getScenarioId().isBlank()) {
                scenarioIds.add(se.getScenarioId());
            }
        }
        Map<String, String> teacherMap = userNameMap(teacherIds);
        Map<String, String> venueMap = venueNameMap(venueIds);
        Map<String, String> orgMap = orgNameMap(orgIds);
        Map<String, String> scenarioMap = scenarioNameMap(scenarioIds);

        List<ScheduleEntryDto> items = new ArrayList<>();
        for (PortalScheduleEntry se : rows) {
            ScheduleEntryDto dto = new ScheduleEntryDto();
            dto.setId(se.getId());
            dto.setTermId(se.getTermId());
            dto.setPlanEntryId(se.getPlanEntryId());
            dto.setCourseName(se.getCourseName());
            dto.setCourseCode(se.getCourseCode());
            dto.setCourseId(se.getCourseId());
            dto.setType(se.getType());
            dto.setClassNodeId(se.getClassNodeId());
            dto.setClassName(blankToNull(se.getClassNodeId() == null ? null : orgMap.get(se.getClassNodeId())));
            dto.setClassNodeIds(se.getClassNodeIds());
            dto.setClassNames(se.getClassNodeIds() == null ? null
                : se.getClassNodeIds().stream().map(orgMap::get).filter(java.util.Objects::nonNull).toList());
            dto.setTeacherId(se.getTeacherId());
            dto.setTeacherName(blankToNull(se.getTeacherId() == null ? null : teacherMap.getOrDefault(se.getTeacherId(), "")));
            dto.setDayOfWeek(se.getDayOfWeek());
            dto.setPeriods(se.getPeriods());
            dto.setStartWeek(se.getStartWeek());
            dto.setEndWeek(se.getEndWeek());
            dto.setWeekPattern(se.getWeekPattern());
            dto.setVenueId(se.getVenueId());
            dto.setVenueName(blankToNull(se.getVenueId() == null ? null : venueMap.getOrDefault(se.getVenueId(), "")));
            dto.setScenarioId(se.getScenarioId());
            dto.setScenarioName(blankToNull(se.getScenarioId() == null ? null : scenarioMap.getOrDefault(se.getScenarioId(), "")));
            dto.setSource(se.getSource() == null ? "" : se.getSource());
            dto.setStatus(se.getStatus());
            dto.setVersion(se.getVersion());
            dto.setResourceVersion(se.getResourceVersion());
            dto.setCreatedAt(se.getCreatedAt());
            dto.setUpdatedAt(se.getUpdatedAt());
            items.add(dto);
        }
        return items;
    }

    // ---------- 通用助手 ----------

    /** 角色码查询（对齐 Go claims.RoleCodes，Java 端会话未携带，按库查询） */
    private List<String> listRoleCodes(String userId, String tenantId) {
        if (userId == null) {
            return List.of();
        }
        var wrapper = QueryBuilder.lambda(PortalUserRole.class).eq(PortalUserRole::getUserId, userId);
        List<PortalUserRole> userRoles = userRoleMapper.selectList(wrapper.build());
        if (userRoles.isEmpty()) {
            return List.of();
        }
        List<String> roleIds = userRoles.stream().map(PortalUserRole::getRoleId).distinct().toList();
        var roleWrapper = QueryBuilder.lambda(PortalRole.class).in(PortalRole::getId, roleIds);
        if (tenantId != null) {
            roleWrapper.eq(PortalRole::getTenantId, tenantId);
        }
        return roleMapper.selectList(roleWrapper.build()).stream()
            .map(PortalRole::getCode)
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    private String requireUserId() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private String userClassNodeId(String userId, String tenantId) {
        try {
            ZhiyuUser user = userMapper.selectById(userId);
            if (user != null && user.getOrgNodeId() != null && !user.getOrgNodeId().isBlank()) {
                return user.getOrgNodeId();
            }
        } catch (Exception e) {
            log.warn("portal user class node query failed", e);
        }
        return "";
    }

    /** 批量按用户 ID 查姓名 */
    private Map<String, String> userNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return userMapper.selectList(QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, ids).build())
                .stream()
                .filter(u -> u.getName() != null)
                .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName));
        } catch (Exception e) {
            log.warn("batch user name query failed", e);
            return Map.of();
        }
    }

    /** 批量按场地 ID 查名称 */
    private Map<String, String> venueNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return venueMapper.selectList(QueryBuilder.lambda(PortalVenue.class).in(PortalVenue::getId, ids).build())
                .stream()
                .filter(v -> v.getName() != null)
                .collect(Collectors.toMap(PortalVenue::getId, PortalVenue::getName));
        } catch (Exception e) {
            log.warn("batch venue name query failed", e);
            return Map.of();
        }
    }

    /** 批量按组织节点 ID 查名称 */
    private Map<String, String> orgNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return organizationMapper.selectList(QueryBuilder.lambda(PortalOrganization.class).in(PortalOrganization::getId, ids).build())
                .stream()
                .filter(o -> o.getName() != null)
                .collect(Collectors.toMap(PortalOrganization::getId, PortalOrganization::getName));
        } catch (Exception e) {
            log.warn("batch org name query failed", e);
            return Map.of();
        }
    }

    /** 批量按场景 ID 查名称 */
    private Map<String, String> scenarioNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return scenarioMapper.selectList(QueryBuilder.lambda(PortalScenario.class).in(PortalScenario::getId, ids).build())
                .stream()
                .filter(s -> s.getName() != null)
                .collect(Collectors.toMap(PortalScenario::getId, PortalScenario::getName));
        } catch (Exception e) {
            log.warn("batch scenario name query failed", e);
            return Map.of();
        }
    }

    /**
     * 批量解析资源版本（文档 5.3 口径）：学生班级已发布排课（version 最大）的 resource_version →
     * 最新快照 → live version。单次批量查询，避免逐条 N+1。
     */
    private Map<String, String> batchResourceVersions(String resourceType, List<String> resourceIds, String orgNodeId) {
        Map<String, String> result = new HashMap<>();
        if (resourceIds.isEmpty()) {
            return result;
        }
        if (orgNodeId != null && !orgNodeId.isBlank()) {
            try {
                var scheduleWrapper = QueryBuilder.lambda(PortalScheduleEntry.class)
                    .eq(PortalScheduleEntry::getStatus, "published")
                    .apply("(class_node_id = {0}::uuid OR {0}::uuid = ANY(class_node_ids))", orgNodeId);
                if ("scenarios".equals(resourceType)) {
                    scheduleWrapper.eq(PortalScheduleEntry::getType, "scene")
                        .in(PortalScheduleEntry::getScenarioId, resourceIds);
                } else {
                    scheduleWrapper.in(PortalScheduleEntry::getCourseId, resourceIds);
                }
                List<PortalScheduleEntry> schedules = scheduleEntryMapper.selectList(scheduleWrapper.build());
                Map<String, PortalScheduleEntry> bestByResource = new HashMap<>();
                for (PortalScheduleEntry s : schedules) {
                    if (s.getResourceVersion() == null) {
                        continue;
                    }
                    String rid = "scenarios".equals(resourceType) ? s.getScenarioId() : s.getCourseId();
                    PortalScheduleEntry existing = bestByResource.get(rid);
                    if (existing == null || nz(s.getVersion()) > nz(existing.getVersion())) {
                        bestByResource.put(rid, s);
                    }
                }
                bestByResource.forEach((rid, s) -> result.put(rid, s.getResourceVersion()));
            } catch (Exception e) {
                log.warn("batch resource schedule version query failed for " + resourceType, e);
            }
        }
        try {
            var snapshotWrapper = QueryBuilder.lambda(PortalResourceSnapshot.class)
                .eq(PortalResourceSnapshot::getResourceType, resourceType)
                .in(PortalResourceSnapshot::getResourceId, resourceIds)
                .orderByDesc(PortalResourceSnapshot::getCreatedAt)
                .orderByDesc(PortalResourceSnapshot::getId);
            List<PortalResourceSnapshot> snapshots = resourceSnapshotMapper.selectList(snapshotWrapper.build());
            Map<String, PortalResourceSnapshot> latest = new LinkedHashMap<>();
            for (PortalResourceSnapshot s : snapshots) {
                latest.putIfAbsent(s.getResourceId(), s);
            }
            latest.forEach((rid, s) -> result.putIfAbsent(rid, s.getVersion()));
        } catch (Exception e) {
            log.warn("batch resource snapshot version query failed for " + resourceType, e);
        }
        return result;
    }

    private int totalHours(BigDecimal online, BigDecimal offline) {
        double total = 0;
        if (online != null) {
            total += online.doubleValue();
        }
        if (offline != null) {
            total += offline.doubleValue();
        }
        return (int) total;
    }

    private String coverText(String name) {
        if (name == null || name.isEmpty()) {
            return "?";
        }
        return name.substring(0, 1);
    }

    private String publishedStatusLabel(String status) {
        if ("published".equals(status)) {
            return "进行中";
        }
        if ("archived".equals(status)) {
            return "已完成";
        }
        return "未开始";
    }

    private String difficultyLabel(Integer difficulty) {
        int d = difficulty == null ? 0 : difficulty;
        if (d == 1 || d == 2) {
            return "简单";
        }
        if (d == 3) {
            return "中等";
        }
        return "困难";
    }

    private String examStatusLabel(String status) {
        if ("published".equals(status)) {
            return "待考";
        }
        if ("in_progress".equals(status)) {
            return "进行中";
        }
        if ("finished".equals(status)) {
            return "已完成";
        }
        return status;
    }

    private int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private int safeCompare(String a, String b) {
        String x = a == null ? "" : a;
        String y = b == null ? "" : b;
        return x.compareTo(y);
    }

    /** 班级计划+节次组装结果 */
    private static class ClassPlanBundle {
        private final List<WorkspaceClassPlan> plans = new ArrayList<>();
        private final List<WorkspaceClassSession> sessions = new ArrayList<>();
    }
}

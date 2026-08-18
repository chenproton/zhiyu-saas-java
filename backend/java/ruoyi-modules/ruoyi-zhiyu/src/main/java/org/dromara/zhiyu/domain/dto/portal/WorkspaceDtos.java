package org.dromara.zhiyu.domain.dto.portal;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 工作台仪表盘 DTO（对齐 Go portal_handler.go WorkspaceDashboard 及 shared-types portal.ts）。
 *
 * @author zhiyu
 */
public class WorkspaceDtos {

    /** 公告（WorkspaceAnnouncement） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceAnnouncement {
        private String id;
        private String title;
        private String type;
        private Boolean isNew;
        /** 日期（YYYY-MM-DD） */
        private String date;
    }

    /** 待办（WorkspaceTodo） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceTodo {
        private String id;
        private String title;
        private String type;
        private Integer count;
        private Boolean urgent;
        private String deadline;
    }

    /** 日程事件（WorkspaceScheduleEvent） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceScheduleEvent {
        private String id;
        private String title;
        /** course/scene/exam/todo */
        private String type;
        private Integer dayOfWeek;
        private String period;
        private String teacher;
        private String location;
        private String status;
        private String className;
        private String tag;
        private String description;
        private String scenarioId;
        private String courseId;
        private String resourceVersion;
    }

    /** 统计卡片（WorkspaceStats） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceStats {
        private String label1;
        private Integer value1;
        private String label2;
        private Integer value2;
    }

    /** 资源统计（WorkspaceResourceStat） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceResourceStat {
        private String label;
        private Integer value;
        private String icon;
        private String href;
    }

    /** 人员统计（WorkspacePersonnelStat） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspacePersonnelStat {
        private String label;
        private Integer value;
    }

    /** 资源增长趋势（WorkspaceResourceGrowth） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceResourceGrowth {
        private String date;
        private Integer courses = 0;
        private Integer scenarios = 0;
        private Integer careerPositions = 0;
        private Integer questionBanks = 0;
        private Integer exams = 0;
        private Integer examUsages = 0;
    }

    /** 学生课程（WorkspaceCourse） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceCourse {
        private String id;
        private String code;
        private String name;
        private String type;
        private String teacher;
        private Integer credit;
        private Integer hours;
        private Integer progress;
        private String cover;
        /** 进行中/未开始/已完成 */
        private String status;
        private String nextTask;
        private String nextDeadline;
        private String resourceVersion;
    }

    /** 场景任务（WorkspaceSceneTask） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceSceneTask {
        private String id;
        private String scenarioId;
        private String sceneName;
        private String taskName;
        private String position;
        private List<String> abilityTags = new ArrayList<>();
        /** 未开始/进行中/待提交/已批改/已完成 */
        private String status;
        private String deadline;
        private Integer score;
        private Integer totalScore;
        /** 简单/中等/困难 */
        private String difficulty;
        private String resourceVersion;
    }

    /** 考试（WorkspaceExam） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceExam {
        private String id;
        private String examId;
        private String name;
        /** 随堂测/单元测试/在线测评/岗位能力认定 */
        private String type;
        /** 待考/进行中/已完成 */
        private String status;
        private String startTime;
        private String endTime;
        private Integer duration;
        private Integer score;
        private Integer totalScore;
    }

    /** 学习路径（WorkspaceLearningPath） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceLearningPath {
        private String id;
        private String title;
        private String resources;
        private String duration;
    }

    /** 教师课程（WorkspaceTeacherCourse） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceTeacherCourse {
        private String id;
        private String name;
        private String code;
        private String type;
        private String className;
        private String term;
        private Integer students;
        private Integer hours;
        private Integer progress;
        private String cover;
        /** 进行中/未开始/已结课 */
        private String status;
        private String nextTask;
        private String nextDeadline;
    }

    /** 班级计划（WorkspaceClassPlan） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceClassPlan {
        private String id;
        private String name;
        private String course;
        private String term;
        private Integer students;
        private String teacher;
        /** pending/active */
        private String status;
        private String scenarioId;
        private String courseId;
    }

    /** 班级授课节次（WorkspaceClassSession） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceClassSession {
        private String id;
        private String courseId;
        private String venue;
        private Integer week;
        /** 周一~周日 */
        private String weekday;
        private String period;
        /** pending/associated */
        private String status;
    }

    /** 仪表盘聚合响应（WorkspaceDashboard） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkspaceDashboard {
        private String role;
        private List<WorkspaceAnnouncement> announcements = new ArrayList<>();
        private List<WorkspaceTodo> todos = new ArrayList<>();
        private List<WorkspaceScheduleEvent> schedule = new ArrayList<>();
        private WorkspaceStats stats;
        private List<WorkspaceResourceStat> resourceStats;
        private List<WorkspacePersonnelStat> personnelStats;
        private List<WorkspaceResourceGrowth> resourceGrowth;
        private List<WorkspaceCourse> courses = new ArrayList<>();
        private List<WorkspaceSceneTask> sceneTasks = new ArrayList<>();
        private List<WorkspaceExam> exams = new ArrayList<>();
        private List<WorkspaceLearningPath> learningPath = new ArrayList<>();
        private List<WorkspaceTeacherCourse> teacherCourses = new ArrayList<>();
        private List<WorkspaceClassPlan> classPlans = new ArrayList<>();
        private List<WorkspaceClassSession> classSessions = new ArrayList<>();
    }
}

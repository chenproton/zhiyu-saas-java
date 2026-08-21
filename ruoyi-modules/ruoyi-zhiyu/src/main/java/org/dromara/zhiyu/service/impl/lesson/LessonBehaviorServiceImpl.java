package org.dromara.zhiyu.service.impl.lesson;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BehaviorAggregateDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.BehaviorRecordDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateBehaviorRecordRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.DailySignInDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.InteractionItemDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.QuizResultDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.RateItemDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.RushRankDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.SignInSummaryDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.StudentBehaviorRowDto;
import org.dromara.zhiyu.domain.lesson.LessonBehaviorRecord;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.lesson.LessonBehaviorRecordMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.lesson.ILessonBehaviorService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 课堂行为服务实现（对齐 Go lesson_behavior_handler.go + service/lesson_behavior_aggregate.go 语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class LessonBehaviorServiceImpl implements ILessonBehaviorService {

    private final SystemGuard systemGuard;
    private final LessonBehaviorRecordMapper behaviorMapper;
    private final LessonCourseMapper courseMapper;
    private final ZhiyuUserMapper userMapper;

    @Override
    public BehaviorAggregateDto aggregate(String courseId, String startDate, String endDate) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        BehaviorAggregateDto agg = new BehaviorAggregateDto();
        agg.setSignIn(new SignInSummaryDto());
        if (isBlank(courseId)) {
            return agg;
        }
        String courseTenantId = courseMapper.selectTenantId(courseId);
        if (courseTenantId == null || !courseTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "课程不存在");
        }
        List<LessonBehaviorRecord> records = behaviorMapper.selectRecords(tenantId, courseId, startDate, endDate);
        return buildAggregate(records);
    }

    @Override
    public BehaviorRecordDto create(CreateBehaviorRecordRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (isBlank(req.getCourseId()) || isBlank(req.getStudentUserId())) {
            throw new ApiException(400, "bad_request", "缺少课程ID或学生用户ID");
        }
        String courseTenantId = courseMapper.selectTenantId(req.getCourseId());
        if (courseTenantId == null || !courseTenantId.equals(tenantId)) {
            throw new ApiException(404, "not_found", "课程不存在");
        }
        ZhiyuUser student = userMapper.selectById(req.getStudentUserId());
        if (student == null || student.getTenantId() == null || !student.getTenantId().equals(tenantId)) {
            throw new ApiException(404, "not_found", "学生不存在");
        }
        LocalDate recordDate = parseDate(req.getRecordDate());
        behaviorMapper.upsertRecord(tenantId, req.getCourseId(), req.getStudentUserId(), recordDate,
            req.getAttendance(), req.getQuizScore(), nvl(req.getInteractionCount()), nvl(req.getPraiseCount()),
            nvl(req.getRushCorrectCount()), req.getRushAvgTimeSec());
        LessonBehaviorRecord rec = behaviorMapper.selectUpserted(req.getCourseId(), req.getStudentUserId(), recordDate);
        return toRecordDto(rec);
    }

    private BehaviorAggregateDto buildAggregate(List<LessonBehaviorRecord> records) {
        BehaviorAggregateDto agg = new BehaviorAggregateDto();
        agg.setSignIn(new SignInSummaryDto());
        agg.setSignInDaily(new ArrayList<>());
        agg.setQuizResults(new ArrayList<>());
        agg.setRushAnswerRanking(new ArrayList<>());
        agg.setClassInteraction(new ArrayList<>());
        agg.setAttendanceRateData(new ArrayList<>());
        agg.setStudentDetails(new ArrayList<>());
        if (records.isEmpty()) {
            return agg;
        }

        Map<String, DailySignInDto> dailyMap = new LinkedHashMap<>();
        Map<String, StudentAcc> studentMap = new LinkedHashMap<>();
        Map<String, RateAcc> rateMap = new LinkedHashMap<>();
        double totalQuizScore = 0;
        int quizCount = 0;
        int quizPassed = 0;
        int totalInteractions = 0;
        int totalPraise = 0;
        int totalRush = 0;

        for (LessonBehaviorRecord rec : records) {
            String attendance = rec.getAttendance() == null ? "" : rec.getAttendance();
            switch (attendance) {
                case "present" -> agg.getSignIn().setPresent(nvl(agg.getSignIn().getPresent()) + 1);
                case "late" -> agg.getSignIn().setLate(nvl(agg.getSignIn().getLate()) + 1);
                case "absent" -> agg.getSignIn().setAbsent(nvl(agg.getSignIn().getAbsent()) + 1);
                default -> {
                }
            }
            agg.getSignIn().setTotal(nvl(agg.getSignIn().getTotal()) + 1);

            String dateLabel = formatMD(rec.getRecordDate());
            DailySignInDto ds = dailyMap.computeIfAbsent(dateLabel, k -> {
                DailySignInDto d = new DailySignInDto();
                d.setDate(k);
                return d;
            });
            switch (attendance) {
                case "present" -> ds.setPresent(nvl(ds.getPresent()) + 1);
                case "late" -> ds.setLate(nvl(ds.getLate()) + 1);
                case "absent" -> ds.setAbsent(nvl(ds.getAbsent()) + 1);
                default -> {
                }
            }

            if (rec.getQuizScore() != null) {
                totalQuizScore += rec.getQuizScore().doubleValue();
                quizCount++;
                if (rec.getQuizScore().doubleValue() >= 60) {
                    quizPassed++;
                }
            }

            totalInteractions += nvl(rec.getInteractionCount());
            totalPraise += nvl(rec.getPraiseCount());
            totalRush += nvl(rec.getRushCorrectCount());

            StudentAcc acc = studentMap.computeIfAbsent(rec.getStudentUserId(), k -> new StudentAcc(k));
            acc.name = rec.getStudentName() == null ? "" : rec.getStudentName();
            acc.records++;
            if ("present".equals(attendance)) {
                acc.present++;
            }
            if (rec.getQuizScore() != null) {
                acc.quizSum += rec.getQuizScore().doubleValue();
                acc.quizCount++;
            }
            acc.interaction += nvl(rec.getInteractionCount());
            acc.praise += nvl(rec.getPraiseCount());
            acc.rushCorrect += nvl(rec.getRushCorrectCount());
            acc.rushTimeSum += rec.getRushAvgTimeSec() == null ? 0 : rec.getRushAvgTimeSec();
            acc.rushTimeCount += rec.getRushAvgTimeSec() == null ? 0 : 1;

            RateAcc rt = rateMap.computeIfAbsent(dateLabel, k -> {
                RateAcc r = new RateAcc();
                r.name = k;
                return r;
            });
            rt.total++;
            if ("present".equals(attendance)) {
                rt.present++;
            }
        }

        if (agg.getSignIn().getTotal() > 0) {
            agg.getSignIn().setRate((int) (agg.getSignIn().getPresent() * 100.0 / agg.getSignIn().getTotal()));
        }
        agg.setSignInDaily(new ArrayList<>(dailyMap.values()));

        if (quizCount > 0) {
            QuizResultDto qr = new QuizResultDto();
            qr.setId("overall");
            qr.setName("随堂测验");
            qr.setAvgScore((int) (totalQuizScore / quizCount));
            qr.setPassRate((int) (quizPassed * 100.0 / quizCount));
            qr.setCount(quizCount);
            agg.getQuizResults().add(qr);
        }

        List<StudentAcc> rushList = new ArrayList<>(studentMap.values());
        rushList.sort(Comparator.comparingInt((StudentAcc a) -> a.rushCorrect).reversed());
        for (int i = 0; i < rushList.size(); i++) {
            StudentAcc a = rushList.get(i);
            String badge = switch (i) {
                case 0 -> "抢答王";
                case 1 -> "达人";
                case 2 -> "积极";
                default -> "";
            };
            String avgTime = a.rushTimeCount > 0 ? (a.rushTimeSum / a.rushTimeCount) + "s" : "-";
            RushRankDto rank = new RushRankDto();
            rank.setRank(i + 1);
            rank.setName(a.name);
            rank.setCorrectCount(a.rushCorrect);
            rank.setAvgTime(avgTime);
            rank.setBadge(badge);
            agg.getRushAnswerRanking().add(rank);
        }

        InteractionItemDto i1 = new InteractionItemDto();
        i1.setName("课堂互动");
        i1.setActive(totalInteractions);
        i1.setTotal(totalInteractions);
        InteractionItemDto i2 = new InteractionItemDto();
        i2.setName("抢答");
        i2.setActive(totalRush);
        i2.setTotal(totalRush);
        InteractionItemDto i3 = new InteractionItemDto();
        i3.setName("表扬");
        i3.setActive(totalPraise);
        i3.setTotal(totalPraise);
        agg.setClassInteraction(List.of(i1, i2, i3));

        for (RateAcc rt : rateMap.values()) {
            RateItemDto item = new RateItemDto();
            item.setName(rt.name);
            item.setRate(rt.total > 0 ? (int) (rt.present * 100.0 / rt.total) : 0);
            agg.getAttendanceRateData().add(item);
        }

        for (StudentAcc a : studentMap.values()) {
            StudentBehaviorRowDto row = new StudentBehaviorRowDto();
            row.setName(a.name);
            row.setAttendance(a.records > 0 ? (int) (a.present * 100.0 / a.records) : 0);
            row.setQuizAvg(a.quizCount > 0 ? (int) (a.quizSum / a.quizCount) : 0);
            row.setInteraction(a.interaction);
            row.setPraise(a.praise);
            agg.getStudentDetails().add(row);
        }
        return agg;
    }

    private BehaviorRecordDto toRecordDto(LessonBehaviorRecord rec) {
        if (rec == null) {
            return null;
        }
        BehaviorRecordDto dto = new BehaviorRecordDto();
        dto.setId(rec.getId());
        dto.setCourseId(rec.getCourseId());
        dto.setStudentUserId(rec.getStudentUserId());
        dto.setRecordDate(rec.getRecordDate() == null ? null : rec.getRecordDate().toString());
        dto.setAttendance(rec.getAttendance());
        dto.setQuizScore(rec.getQuizScore());
        dto.setInteractionCount(rec.getInteractionCount());
        dto.setPraiseCount(rec.getPraiseCount());
        dto.setRushCorrectCount(rec.getRushCorrectCount());
        dto.setRushAvgTimeSec(rec.getRushAvgTimeSec());
        dto.setCreatedAt(rec.getCreatedAt());
        dto.setUpdatedAt(rec.getUpdatedAt());
        return dto;
    }

    private static final class StudentAcc {
        final String studentUserId;
        String name = "";
        int records;
        int present;
        double quizSum;
        int quizCount;
        int interaction;
        int praise;
        int rushCorrect;
        int rushTimeSum;
        int rushTimeCount;

        StudentAcc(String studentUserId) {
            this.studentUserId = studentUserId;
        }
    }

    private static final class RateAcc {
        String name;
        int total;
        int present;
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(s);
        } catch (Exception e) {
            return LocalDate.now();
        }
    }

    private String formatMD(LocalDate date) {
        return date == null ? "" : date.format(DateTimeFormatter.ofPattern("MM-dd"));
    }

    private int nvl(Integer v) {
        return v == null ? 0 : v;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

}

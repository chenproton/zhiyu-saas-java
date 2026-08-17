package org.dromara.zhiyu.controller.evaluation;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateStudentArchiveRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.GeneratePortraitRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentAbilityArchiveDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentAbilityPortraitDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.StudentDashboardDto;
import org.dromara.zhiyu.service.evaluation.IEvaluationPortraitService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 评价域控制器：学生能力画像/档案（portraits，对齐 Go routes_evaluation.go）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/evaluation/portraits")
public class EvaluationPortraitController {

    private final IEvaluationPortraitService portraitService;

    @GetMapping
    public ListResponse<StudentAbilityPortraitDto> listPortraits(
        @RequestParam(value = "userId", required = false) String userId,
        @RequestParam(value = "careerPositionId", required = false) String careerPositionId,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return portraitService.listPortraits(userId, careerPositionId,
            limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public StudentAbilityPortraitDto getPortrait(@PathVariable String id) {
        return portraitService.getPortrait(id);
    }

    @PostMapping("/generate")
    public StudentAbilityPortraitDto generatePortrait(@RequestBody GeneratePortraitRequest req) {
        return portraitService.generatePortrait(req);
    }

    @GetMapping("/student-dashboard")
    public StudentDashboardDto studentDashboard(@RequestParam(value = "userId", required = false) String userId) {
        return portraitService.studentDashboard(userId);
    }

    @GetMapping("/archives")
    public ListResponse<StudentAbilityArchiveDto> listArchives(
        @RequestParam(value = "userId", required = false) String userId,
        @RequestParam(value = "materialType", required = false) String materialType,
        @RequestParam(value = "limit", required = false) Long limit,
        @RequestParam(value = "offset", required = false) Long offset) {
        return portraitService.listArchives(userId, materialType,
            limit == null ? 0 : limit, offset == null ? 0 : offset);
    }

    @PostMapping("/archives")
    public StudentAbilityArchiveDto createArchive(@RequestBody CreateStudentArchiveRequest req) {
        return portraitService.createArchive(req);
    }

    @DeleteMapping("/archives/{id}")
    public Map<String, String> deleteArchive(@PathVariable String id) {
        return Map.of("id", portraitService.deleteArchive(id));
    }
}

package org.dromara.zhiyu.controller.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.PutProgramCoursesRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.StatusRequest;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramCourseDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TrainingProgramPayload;
import org.dromara.zhiyu.service.affairs.ITrainingProgramService;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 人才培养方案控制器（对齐 Go /affairs/programs 路由组，含内容工作流）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/affairs/programs")
public class TrainingProgramController {

    private final ITrainingProgramService programService;

    @GetMapping
    public ListResponse<TrainingProgramDto> list(@RequestParam(value = "search", required = false) String search,
                                                 @RequestParam(value = "status", required = false) String status,
                                                 @RequestParam(value = "majorId", required = false) String majorId,
                                                 @RequestParam(value = "limit", required = false) Long limit,
                                                 @RequestParam(value = "offset", required = false) Long offset) {
        return programService.list(search, status, majorId, limit == null ? 20 : limit, offset == null ? 0 : offset);
    }

    @GetMapping("/{id}")
    public TrainingProgramDto get(@PathVariable String id) {
        return programService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TrainingProgramDto create(@RequestBody TrainingProgramPayload payload) {
        return programService.create(payload);
    }

    @PutMapping("/{id}")
    public TrainingProgramDto update(@PathVariable String id, @RequestBody TrainingProgramPayload payload) {
        return programService.update(id, payload);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", programService.delete(id));
    }

    @PostMapping("/{id}/submit")
    public TrainingProgramDto submit(@PathVariable String id) {
        return programService.submit(id);
    }

    @PostMapping("/{id}/review")
    public TrainingProgramDto review(@PathVariable String id, @RequestBody ReviewRequest req) {
        return programService.review(id, req);
    }

    @PostMapping("/{id}/publish")
    public TrainingProgramDto publish(@PathVariable String id, @RequestBody(required = false) StatusRequest req) {
        return programService.publish(id, req == null ? null : req.getStatus());
    }

    @PostMapping("/{id}/archive")
    public TrainingProgramDto archive(@PathVariable String id) {
        return programService.archive(id);
    }

    @PostMapping("/{id}/unpublish")
    public TrainingProgramDto unpublish(@PathVariable String id) {
        return programService.unpublish(id);
    }

    @PostMapping("/{id}/withdraw")
    public TrainingProgramDto withdraw(@PathVariable String id) {
        return programService.withdraw(id);
    }

    @PostMapping("/{id}/save-draft")
    public TrainingProgramDto saveDraft(@PathVariable String id) {
        return programService.saveDraft(id);
    }

    @PostMapping("/{id}/invite")
    public TrainingProgramDto invite(@PathVariable String id, @RequestBody InviteRequest req) {
        return programService.invite(id, req);
    }

    @GetMapping("/{id}/courses")
    public ListResponse<TrainingProgramCourseDto> listCourses(@PathVariable String id) {
        return programService.listCourses(id);
    }

    @PutMapping("/{id}/courses")
    public ListResponse<TrainingProgramCourseDto> putCourses(@PathVariable String id,
                                                             @RequestBody PutProgramCoursesRequest req) {
        return programService.putCourses(id, req);
    }

    @PostMapping("/{id}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public TrainingProgramDto clone(@PathVariable String id, @RequestBody(required = false) CloneRequest req) {
        return programService.clone(id, req == null ? new CloneRequest() : req);
    }
}

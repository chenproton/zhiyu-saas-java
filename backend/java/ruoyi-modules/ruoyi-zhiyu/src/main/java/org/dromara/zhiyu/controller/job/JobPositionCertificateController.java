package org.dromara.zhiyu.controller.job;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCertificateDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCertificateRequest;
import org.dromara.zhiyu.service.job.IJobPositionConfigService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 岗位证书控制器（对齐 Go routes_job.go 的 /job/position-certificates 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/job/position-certificates")
public class JobPositionCertificateController {

    private final IJobPositionConfigService positionConfigService;

    /** 岗位证书列表（careerPositionId 必填；空则返回空列表） */
    @GetMapping
    public ListResponse<PositionCertificateDto> list(@RequestParam(value = "careerPositionId", required = false) String careerPositionId,
                                                     @RequestParam(value = "limit", required = false) Long limit,
                                                     @RequestParam(value = "offset", required = false) Long offset) {
        return positionConfigService.listCertificates(careerPositionId,
            limit == null ? 50 : limit, offset == null ? 0 : offset);
    }

    /** 岗位证书详情 */
    @GetMapping("/{id}")
    public PositionCertificateDto get(@PathVariable String id) {
        return positionConfigService.getCertificate(id);
    }

    /** 创建岗位证书（find-or-create 证书库条目） */
    @PostMapping
    public PositionCertificateDto create(@RequestBody PositionCertificateRequest req) {
        return positionConfigService.createCertificate(req);
    }

    /** 更新岗位证书 */
    @PutMapping("/{id}")
    public PositionCertificateDto update(@PathVariable String id, @RequestBody PositionCertificateRequest req) {
        return positionConfigService.updateCertificate(id, req);
    }

    /** 删除岗位证书 */
    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable String id) {
        return Map.of("id", positionConfigService.deleteCertificate(id));
    }
}

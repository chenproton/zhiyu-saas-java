package org.dromara.zhiyu.service.portal;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.portal.HonorDtos.HonorItem;
import org.dromara.zhiyu.domain.dto.portal.HonorDtos.HonorUpsertRequest;

/**
 * 学生荣誉服务（对齐 Go student_honor_handler.go + EvaluationService 荣誉语义）。
 *
 * @author zhiyu
 */
public interface IHonorService {

    /**
     * 查询学生荣誉（学生强制本人，业务用户可按 userId 查看）。
     *
     * @param userId 目标用户 ID（学生角色强制本人）
     * @return 荣誉列表
     */
    ListResponse<HonorItem> list(String userId);

    /**
     * 新增荣誉（仅学生本人）。
     *
     * @param req 荣誉信息
     * @return 新荣誉 ID
     */
    String create(HonorUpsertRequest req);

    /**
     * 更新荣誉（仅本人）。
     *
     * @param id  荣誉 ID
     * @param req 荣誉信息
     * @return 荣誉 ID
     */
    String update(String id, HonorUpsertRequest req);

    /**
     * 删除荣誉（仅本人）。
     *
     * @param id 荣誉 ID
     * @return 荣誉 ID
     */
    String delete(String id);
}

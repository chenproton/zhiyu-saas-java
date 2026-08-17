package org.dromara.zhiyu.service.affairs;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TermDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TermPayload;

/**
 * 学期服务（对齐 Go affairs_term_handler.go + service/term.go + store/terms.go）。
 *
 * @author zhiyu
 */
public interface ITermService {

    ListResponse<TermDto> list(String search, String isCurrent, long limit, long offset);

    TermDto get(String id);

    TermDto create(TermPayload payload);

    TermDto update(String id, TermPayload payload);

    String delete(String id);
}

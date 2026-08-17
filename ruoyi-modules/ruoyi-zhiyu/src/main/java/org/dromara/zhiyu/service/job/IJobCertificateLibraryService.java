package org.dromara.zhiyu.service.job;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CertificateLibraryItemDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CertificateLibraryRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CitationStatsDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.UncitedItemDto;

/**
 * 证书库服务接口（对齐 Go CertificateLibraryHandler）。
 *
 * @author zhiyu
 */
public interface IJobCertificateLibraryService {

    /** 证书库列表（search/creatorId 过滤） */
    ListResponse<CertificateLibraryItemDto> list(String search, String creatorId, long limit, long offset);

    /** 证书库详情 */
    CertificateLibraryItemDto get(String id);

    /** 创建证书库条目 */
    CertificateLibraryItemDto create(CertificateLibraryRequest req);

    /** 更新证书库条目（部分更新兜底） */
    CertificateLibraryItemDto update(String id, CertificateLibraryRequest req);

    /** 删除证书库条目 */
    String delete(String id);

    /** 引用次数分布统计 */
    CitationStatsDto citationStats();

    /** 零引用证书列表（创建时段筛选 + 分页） */
    ListResponse<UncitedItemDto> uncited(String startDate, String endDate, long limit, long offset);
}

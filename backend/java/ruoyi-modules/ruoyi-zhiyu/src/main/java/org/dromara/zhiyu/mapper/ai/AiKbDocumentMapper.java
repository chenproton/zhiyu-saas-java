package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiKbDocument;

/**
 * 知识库文档 Mapper（ai_kb_documents 表）。
 *
 * @author zhiyu
 */
public interface AiKbDocumentMapper extends BaseMapperPlus<AiKbDocument, AiKbDocument> {

    /**
     * 解析流水线收口：parsing → ready/failed（对齐 Go store.FinishDocumentParse，
     * 状态守卫 WHERE status='parsing' 防重入）。
     */
    @Update("UPDATE ai_kb_documents SET status = #{status}, error = #{error},"
        + " chunk_count = #{chunkCount}, char_count = #{charCount}"
        + " WHERE tenant_id = #{tenantId} AND id = #{id} AND status = 'parsing'")
    int finishParse(@Param("tenantId") String tenantId, @Param("id") String id,
                    @Param("status") String status, @Param("error") String error,
                    @Param("chunkCount") int chunkCount, @Param("charCount") int charCount);
}

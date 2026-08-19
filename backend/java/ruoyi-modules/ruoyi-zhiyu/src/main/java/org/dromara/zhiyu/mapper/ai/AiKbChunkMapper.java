package org.dromara.zhiyu.mapper.ai;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.ai.AiKbChunk;

import java.util.List;

/**
 * 知识库文档分块 Mapper（ai_kb_chunks 表）。
 *
 * <p>检索复用 Go 的 pg_trgm 相似度召回（同库共享 pg_trgm 扩展），
 * 可见性过滤在 SQL 层完成（published / owner / 协作者），是检索越权的唯一防线。</p>
 *
 * @author zhiyu
 */
public interface AiKbChunkMapper extends BaseMapperPlus<AiKbChunk, AiKbChunk> {

    /** 批量插入分块（id 由 PG gen_random_uuid 默认值生成） */
    @Insert("<script>INSERT INTO ai_kb_chunks (tenant_id, doc_id, kb_id, seq, content) VALUES "
        + "<foreach collection='chunks' item='c' separator=','>(#{c.tenantId}, #{c.docId}, #{c.kbId}, #{c.seq}, #{c.content})</foreach>"
        + "</script>")
    int insertBatch(@Param("chunks") List<AiKbChunk> chunks);

    /**
     * 在指定知识库集合内按 pg_trgm 相似度召回分块（对齐 Go store.SearchChunks）。
     * 对每个查询子句取相似度，跨子句取最大值排序；只召回请求者可见的库。
     */
    @Select("<script>"
        + "SELECT c.id, c.tenant_id, c.doc_id, c.kb_id, c.seq, c.content, c.created_at, d.name AS doc_name "
        + "FROM ai_kb_chunks c "
        + "JOIN ai_kb_documents d ON d.id = c.doc_id AND d.status = 'ready' "
        + "JOIN ai_knowledge_bases kb ON kb.id = c.kb_id "
        + "WHERE c.tenant_id = #{tenantId} "
        + "AND c.kb_id IN <foreach collection='kbIds' item='kbId' open='(' separator=',' close=')'>#{kbId}</foreach> "
        + "AND (kb.status = 'published' OR kb.owner_id = #{userId} "
        + "     OR EXISTS (SELECT 1 FROM ai_kb_collaborators col WHERE col.kb_id = kb.id AND col.user_id = #{userId})) "
        + "AND greatest(<foreach collection='queries' item='q' separator=','>similarity(c.content, #{q})</foreach>) > 0.05 "
        + "ORDER BY greatest(<foreach collection='queries' item='q' separator=','>similarity(c.content, #{q})</foreach>) DESC "
        + "LIMIT #{limit}"
        + "</script>")
    List<AiKbChunk> searchChunks(@Param("tenantId") String tenantId, @Param("userId") String userId,
                                 @Param("kbIds") List<String> kbIds, @Param("queries") List<String> queries,
                                 @Param("limit") int limit);
}

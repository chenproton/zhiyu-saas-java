package org.dromara.zhiyu.service.importexport;

import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 导入导出服务（对齐 Go 版 import/export/templates 全套端点语义）。
 *
 * @author zhiyu
 */
public interface IImportExportService {

    /**
     * 生成模板（GET /templates/{entity} 与 /templates/question-banks/{bankId}/questions）。
     *
     * @param entity    模板实体名（kebab-case URL 段）
     * @param bankId    题目模板题库 ID（仅 question-banks/{bankId}/questions）
     * @param brandType 品牌类型（仅 alliance-brands，为空输出通用模板）
     * @return Excel 字节流
     */
    byte[] buildTemplate(String entity, String bankId, String brandType);

    /**
     * 导出（POST /export/{entity}/excel 与 /export/question-banks/{bankId}/questions/excel）。
     */
    byte[] exportExcel(String entity, List<String> ids, String bankId);

    /**
     * 通用 CSV 导出（GET /export/{entity}）。
     */
    byte[] exportGeneric(String entity);

    /**
     * Excel 导入（POST /import/{entity}/excel 与 /import/{entity}/preview，含 schedules/affairs-config/program-courses）。
     *
     * @param entity    URL 段实体名
     * @param file      multipart 上传文件
     * @param preview   true=预览（不落库），false=落库
     * @param overwrite 是否覆盖已存在
     * @param rename    重名是否追加随机后缀
     * @param bankId    题目导入题库 ID
     * @param brandType 品牌导入品牌类型
     * @param termId    排课导入目标学期
     * @param programId 方案课程导入方案 ID
     */
    Map<String, Object> importExcel(String entity, MultipartFile file, boolean preview, boolean overwrite,
                                    boolean rename, String bankId, String brandType, String termId, String programId);

    /**
     * 通用 CSV 导入（POST /import/{entity}）。
     */
    Map<String, Object> importGeneric(String entity, MultipartFile file, boolean overwrite, boolean rename);

    /**
     * 预览分发（POST /import/{entity}/preview）：Excel 实体走 Excel 预览，否则走通用 CSV 预览。
     */
    Map<String, Object> preview(String entity, MultipartFile file, boolean overwrite, boolean rename,
                                String bankId, String brandType, String termId, String programId);
}

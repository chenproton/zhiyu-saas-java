package org.dromara.zhiyu.domain.dto.importexport;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * import/export/templates 端点 DTO（对齐 Go 版 service 层导入结果结构与导出请求体）。
 *
 * <p>前端 React 代码不动，响应结构与 Go 版 {@code ImportPreviewResult} /
 * {@code map[string]interface{}} 一一对应。</p>
 *
 * @author zhiyu
 */
public final class ImportExportDtos {

    private ImportExportDtos() {
    }

    /**
     * 单条重复记录预览信息（对齐 Go ImportPreviewItem）。
     */
    public record ImportPreviewItem(int rowNum, String key, String name) implements Serializable {
        @Serial
        private static final long serialVersionUID = 1L;
    }

    /**
     * 导出请求体 {@code {ids: [...]}}（对齐 Go decodeIDList）。
     */
    public record ExportIdsRequest(List<String> ids) implements Serializable {
        @Serial
        private static final long serialVersionUID = 1L;
    }
}

package org.dromara.zhiyu.domain.dto.affairs;

/**
 * Excel 导出结果（文件名 + 字节流）。
 *
 * @author zhiyu
 */
public record ExcelExport(String filename, byte[] content) {
}

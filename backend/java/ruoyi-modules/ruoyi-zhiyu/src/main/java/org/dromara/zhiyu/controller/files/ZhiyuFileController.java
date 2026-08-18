package org.dromara.zhiyu.controller.files;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.domain.dto.files.FileDtos.SignUrlResponse;
import org.dromara.zhiyu.domain.dto.files.FileDtos.UploadResponse;
import org.dromara.zhiyu.service.files.IFileService;
import org.dromara.zhiyu.service.files.IFileService.ResolvedFile;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;

/**
 * zhiyu 文件通道控制器（对齐 Go routes.go 的 /files/upload、/files/preview、/files/sign-url）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/files")
public class ZhiyuFileController {

    private final IFileService fileService;

    /** 文件上传（multipart/form-data，字段 file） */
    @PostMapping("/upload")
    public UploadResponse upload(@RequestParam("file") MultipartFile file) {
        return fileService.upload(file);
    }

    /** 签名 URL（当前租户文件，供 kkFileView 等无登录态抓取） */
    @GetMapping("/sign-url")
    public SignUrlResponse signUrl(@RequestParam("name") String name) {
        return fileService.signUrl(name);
    }

    /** 文件预览（Content-Disposition inline 输出文件流；本租户校验，带签名放行跨租户） */
    @GetMapping("/preview")
    public void preview(@RequestParam("name") String name,
                        @RequestParam(value = "exp", required = false) String exp,
                        @RequestParam(value = "sig", required = false) String sig,
                        HttpServletResponse response) throws IOException {
        ResolvedFile f = fileService.resolvePreview(name, exp, sig);
        response.setContentType(f.contentType());
        response.setHeader("Content-Disposition", "inline; filename=\"" + f.filename() + "\"");
        response.setHeader("X-Content-Type-Options", "nosniff");
        if (f.sandbox()) {
            response.setHeader("Content-Security-Policy", "sandbox");
        }
        try (InputStream in = Files.newInputStream(f.path())) {
            in.transferTo(response.getOutputStream());
        }
    }
}

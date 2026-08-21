---
name: file-oss-management
description: |
  当需要进行文件上传、下载、对象存储管理时自动使用此 Skill。基于 AWS SDK v2 S3 协议统一适配 MinIO / 阿里云 OSS / 腾讯云 COS / 七牛 / 华为 OBS，无独立厂商 SDK。

  触发场景：
  - 上传 / 下载 / 删除文件，接入云存储或自建对象存储
  - 多存储配置切换（sys_oss_config），按 configKey 取客户端
  - 生成预签名 URL（presigned）实现私有桶临时访问

  触发词：文件上传、OSS、对象存储、云存储、MinIO、阿里云OSS、腾讯云COS、七牛、S3、AWS、预签名、presigned、文件下载、SysOss、OssClient、OssFactory、上传
---

# 文件 / 对象存储管理（file-oss-management）

> 适用框架：base-dev-framework6-java
> 核心模块：`ruoyi-common/ruoyi-common-oss`（底层 S3 客户端） + `ruoyi-modules/ruoyi-system`（SysOss 业务）
> 包名根：`org.dromara`，三层结构无 DAO，禁用 `plus.ruoyi`/`com.ruoyi`/`buildQueryWrapper`/`PlusLambdaQuery`/`likeCast`/默认 `TenantEntity`/`is_deleted`。

## 一、概述：统一 S3 协议，无独立厂商 SDK

6.x 的对象存储**彻底改用 AWS SDK for Java 2.x（S3）**，版本由根 `pom.xml` 的 `<aws.sdk.version>2.42.9</aws.sdk.version>` 统一管理。所有云厂商（阿里云 OSS、腾讯云 COS、七牛、华为 OBS、MinIO）都通过 **S3 兼容协议**接入，项目中**不再有任何独立的 MinIO / 阿里云 / 腾讯云 SDK 依赖**。

根 pom 中实际引入的 OSS 相关坐标只有三个（均为 AWS）：

| 坐标 | 作用 |
|------|------|
| `software.amazon.awssdk:s3` | S3 核心客户端 |
| `software.amazon.awssdk:s3-transfer-manager` | 高性能传输管理器（分段上传/下载） |
| `software.amazon.awssdk:netty-nio-client` | 基于 Netty 的异步 NIO HTTP 客户端 |

底层客户端 `DefaultOssClientImpl.doInitialize()` 通过 `endpointOverride(URI)` + `forcePathStyle(...)` 把标准 S3 客户端指向任意厂商端点，从而实现「一套代码、多家存储」。对于 MinIO 这类要求路径风格访问的服务，框架根据 endpoint 是否命中内置云厂商关键字自动推断是否启用路径样式访问。

### 核心类一览（务必核对真实类名/方法名）

| 类型 | 全限定类名 | 角色 |
|------|-----------|------|
| 接口 | `org.dromara.common.oss.client.OssClient` | S3 客户端门面接口，定义 upload/download/delete/presign |
| 抽象实现 | `org.dromara.common.oss.client.AbstractOssClientImpl` | 实现全部业务方法（基于 S3TransferManager / S3Presigner） |
| 默认实现 | `org.dromara.common.oss.client.DefaultOssClientImpl` | 实现 `doInitialize()`，构建 S3AsyncClient / TransferManager / Presigner |
| 工厂 | `org.dromara.common.oss.factory.OssFactory` | 按 `configKey` 缓存并获取客户端（`instance()` / `instance(configKey)` / `remove(configKey)`） |
| 配置 | `org.dromara.common.oss.config.OssClientConfig` | 客户端不可变配置，由 `OssProperties` 构建 |
| 属性 | `org.dromara.common.oss.properties.OssProperties` | 反序列化自 `sys_oss_config` 的 JSON 配置 |
| 异步结果 | `org.dromara.common.oss.model.HandleAsyncResult<T>` | 统一封装异步上传结果与异常（record） |
| 上传结果 | `org.dromara.common.oss.model.PutObjectResult` | record：`url / key / eTag / size` |
| 下载结果 | `org.dromara.common.oss.model.GetObjectResult` | record：`key / eTag / lastModified / size / contentType / ...` |
| 上传选项 | `org.dromara.common.oss.model.Options` | 链式构建 contentType / metadata / md5Digest / transferListeners |
| 异常 | `org.dromara.common.oss.exception.S3StorageException` | 统一存储异常（用 `S3StorageException.form(...)` 构建） |
| 常量 | `org.dromara.common.oss.constant.OssConstant` | `DEFAULT_CONFIG_KEY`、`CLOUD_SERVICE`、内置数据 ID |
| 访问策略 | `org.dromara.common.oss.enums.AccessPolicy` | `PRIVATE(0)` / `PUBLIC_READ_WRITE(1)` / `PUBLIC_READ(2)` |

> 注意：底层方法名是 `bucketUpload` / `bucketDownload` / `bucketDelete` / `bucketPresignGetUrl` / `bucketPresignPutUrl`（显式指定 bucket），以及对应的默认桶简写 `upload` / `download` / `delete` / `presignGetUrl` / `presignPutUrl`。**不要**臆造 `putObject` / `getObject` 这类原生 S3 名字直接当门面方法用。

## 二、多存储配置（sys_oss_config）

### 2.1 两张表

| 表 | 实体 | 说明 |
|----|------|------|
| `sys_oss` | `org.dromara.system.domain.SysOss` | 上传后的**文件记录**：ossId、fileName(对象key)、originalName、url、fileSuffix、service(configKey)、ext1 |
| `sys_oss_config` | `org.dromara.system.domain.SysOssConfig` | **存储桶配置**：每行一套云存储参数，configKey 唯一 |

`OssProperties` 即从 `sys_oss_config` 行的 JSON 反序列化而来，字段为：

```java
// org.dromara.common.oss.properties.OssProperties
private String endpoint;     // 访问站点（如 oss-cn-hangzhou.aliyuncs.com / play.min.io:9000）
private String domainUrl;    // 自定义域名（CDN / 加速域名，预签名时优先用它）
private String prefix;        // 对象 key 前缀（业务隔离目录）
private String accessKey;     // AccessKey
private String secretKey;     // SecretKey
private String bucketName;    // 存储桶名
private String region;        // 区域（默认 us-east-1）
private String isHttps;       // 是否 https：Y=是 N=否（SystemConstants.YES 判断）
private String accessPolicy;  // 桶权限：0=private 1=public(读写) 2=PUBLIC_READ（公有只读）
```

### 2.2 默认配置 key 存在 Redis

`OssFactory.instance()`（无参）会先从 Redis 读默认配置标识：

```java
// org.dromara.common.oss.constant.OssConstant
String DEFAULT_CONFIG_KEY = GlobalConstants.GLOBAL_REDIS_KEY + "sys_oss:default_config";
```

取不到则抛 `S3StorageException.form("文件存储服务类型无法找到!")`。具体某条配置的 JSON 缓存在 `CacheNames.SYS_OSS_CONFIG` 下，key = configKey。切换默认存储 = 改这个 Redis 值（由 `SysOssConfigServiceImpl` 维护，不要手改 Redis）。

### 2.3 路径样式访问推断（MinIO 关键）

`OssClientConfig.resolvePathStyleAccess()` 的逻辑：endpoint **不包含**内置云厂商关键字时启用路径样式访问。内置关键字：

```java
// OssConstant
String[] CLOUD_SERVICE = new String[]{"aliyun", "qcloud", "qiniu", "obs"};
```

即：阿里云/腾讯云/七牛/华为 OBS → 站点风格（`bucket.endpoint`）；**MinIO 等自建服务 → 路径风格（`endpoint/bucket`）**。MinIO 用 HTTPS 时通常要配自定义域名 + 启用路径样式。

## 三、上传 / 下载 / 删除（OssClient 门面方法）

### 3.1 获取客户端

```java
import org.dromara.common.oss.factory.OssFactory;
import org.dromara.common.oss.client.OssClient;

// 用默认存储
OssClient client = OssFactory.instance();
// 用指定 configKey 的存储（例如某条 sys_oss 记录的 service 字段）
OssClient client = OssFactory.instance(sysOss.getService());
```

`OssFactory` 内部用 `ConcurrentHashMap` + `ReentrantLock` 做客户端缓存，并通过 `client.verifyConfig(config)` 比对配置是否变化，变化则关闭旧客户端重建。**业务代码不要自己 new 客户端、不要缓存 OssClient 引用**，每次都走 `OssFactory.instance(...)`。

### 3.2 上传（默认桶）

```java
import org.dromara.common.oss.model.Options;
import org.dromara.common.oss.model.PutObjectResult;

// 对象 key 用框架统一生成：前缀 + yyyy/MM/dd + uuid + 后缀
String pathKey = client.buildPathKey(originalFileName);

// 输入流上传（需传 contentLength）
try (InputStream in = file.getInputStream()) {
    PutObjectResult result = client.upload(
        pathKey, in, file.getSize(),
        Options.builder().setContentType(file.getContentType())
    );
    String url = result.url();   // 访问地址
    String key = result.key();   // 对象 key（= sys_oss.fileName）
    long size = result.size();   // 实际大小
}

// 也支持 File / Path / byte[] / RandomAccessFile / ReadableByteChannel 重载
PutObjectResult r2 = client.upload(pathKey, localFile, Options.builder());
PutObjectResult r3 = client.upload(pathKey, bytes);
```

### 3.3 下载（默认桶，多种目标）

```java
import org.dromara.common.oss.model.GetObjectResult;

// 1) 下载到本地 Path / File / OutputStream / 通道
GetObjectResult meta = client.download(key, localPath);

// 2) 流式转换：自己消费 InputStream，返回任意类型（download 接口用得最多）
byte[] data = client.download(key, (result, inputStream) -> {
    // result 是 GetObjectResult：contentType / size / lastModified / eTag ...
    return IoUtil.readBytes(inputStream);
});
```

`GetObjectResult` 是 record，常用字段：`key()`、`eTag()`、`lastModified()`、`size()`、`contentType()`、`contentDisposition()`、`metadata()`。

### 3.4 删除

```java
boolean ok = client.delete(key);                    // 默认桶
boolean ok2 = client.bucketDelete("other-bucket", key); // 指定桶
```

## 四、预签名 URL（presigned）

私有桶（`AccessPolicy.PRIVATE`）对象不能直接公开访问，需用**临时预签名 URL**。底层由 `S3Presigner` 生成，预签名时端点用 `domainUrl`（自定义域名优先），保证 CDN/加速域名也能签出可用链接。

```java
import java.time.Duration;

// 下载预签名（GET），120 秒有效
String getUrl = client.presignGetUrl(key, Duration.ofSeconds(120));

// 上传预签名（PUT），前端直传场景，可带元数据
String putUrl = client.presignPutUrl(key, Duration.ofMinutes(10), Map.of("x-amz-meta-biz", "avatar"));

// 指定桶版本
String getUrl2 = client.bucketPresignGetUrl("bucket", key, Duration.ofSeconds(300));
```

`SysOssServiceImpl.matchingUrl()` 就是用它把私有桶 URL 替换为 120 秒临时链接：

```java
private SysOssVo matchingUrl(SysOssVo oss) {
    OssClient instance = OssFactory.instance(oss.getService());
    // 仅当桶为 private 时改成临时 URL，时长 120s
    if (instance.verifyConfig(config -> AccessPolicy.PRIVATE.equals(config.accessControlPolicyConfig().accessPolicy()))) {
        oss.setUrl(instance.presignGetUrl(oss.getFileName(), Duration.ofSeconds(120)));
    }
    return oss;
}
```

## 五、SysOss 上传接口完整流程

### 5.1 Controller（`/resource/oss`）

`org.dromara.system.controller.system.SysOssController`（`extends BaseController`），核心端点：

| 方法 | 路径 | 权限注解 | 说明 |
|------|------|---------|------|
| list | `GET /resource/oss/list` | `@SaCheckPermission("system:oss:list")` | 分页查询文件记录 |
| listByIds | `GET /resource/oss/listByIds/{ossIds}` | `system:oss:query` | 按 id 串查 |
| upload | `POST /resource/oss/upload` | `system:oss:upload` | `MultipartFile` 上传，`@Log(...BusinessType.INSERT)` |
| download | `GET /resource/oss/download/{ossId}` | `system:oss:download` | 返回 `ResponseEntity<byte[]>` |
| remove | `DELETE /resource/oss/{ossIds}` | `system:oss:remove` | 删除，`@Log(...BusinessType.DELETE)` |

上传方法签名（注意返回的是内部 record `SysOssUploadVo(url, fileName, ossId)`）：

```java
@PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public R<SysOssUploadVo> upload(@RequestPart("file") MultipartFile file,
                                @RequestParam(value = "ossExt", required = false) String ossExtJson) {
    SysOssVo oss = ossService.upload(file, JsonUtils.parseObject(ossExtJson, SysOssExt.class));
    SysOssUploadVo uploadVo = new SysOssUploadVo(oss.getUrl(), oss.getOriginalName(), oss.getOssId().toString());
    return R.ok(uploadVo);
}
```

### 5.2 Service 实现（`SysOssServiceImpl`）

`upload(MultipartFile, SysOssExt)` 的关键步骤：

1. 校验文件非空，否则 `throw new ServiceException("上传文件不能为空")`。
2. `OssClient instance = OssFactory.instance();` 取默认存储。
3. `String pathKey = instance.buildPathKey(originalFileName);` 生成对象 key。
4. `PutObjectResult result = instance.upload(pathKey, inputStream, file.getSize(), Options.builder().setContentType(...));`。
5. `buildResultEntity(...)`：组装 `SysOss` 实体（`url=result.url()`、`fileName=result.key()`、`service=instance.clientId()`、`ext1=JSON`），`ossMapper.insert(oss)` 落库，`MapstructUtils.convert` 转 VO，再走 `matchingUrl` 处理私有桶临时 URL。

> 关键：`sys_oss.fileName` 存的是**对象 key**（含日期/uuid 路径），`originalName` 才是用户上传的原始文件名；`service` 存的是 configKey（哪套存储）。下载/删除时都靠 `service` 反查出对应 `OssFactory.instance(service)`。

### 5.3 下载实现

`download(Long ossId)` 通过 `OssFactory.instance(sysOss.getService()).download(fileName, (result, inputStream) -> ...)` 流式拉取，构建带 `Content-Disposition`（percentEncode 文件名）的 `ResponseEntity<byte[]>`，`contentType` 来自 `result.contentType()`，解析失败回退 `application/octet-stream`。

## 六、代码示例（≥5）

### 示例 1：业务里上传一个本地文件到默认存储

```java
@Service
@RequiredArgsConstructor
public class AvatarService {
    public String uploadAvatar(File img) {
        OssClient client = OssFactory.instance();
        String key = client.buildPathKey("avatar", img.getName()); // 带业务前缀
        PutObjectResult result = client.upload(key, img,
            Options.builder().setContentType("image/png"));
        return result.url();
    }
}
```

### 示例 2：上传字节数组并附带自定义元数据

```java
byte[] bytes = JsonUtils.toJsonString(report).getBytes(StandardCharsets.UTF_8);
PutObjectResult result = OssFactory.instance().upload(
    "report/2026/result.json",
    bytes,
    Options.builder()
        .setContentType("application/json")
        .addMetadataItem("biz", "daily-report")
);
```

### 示例 3：私有桶生成 5 分钟临时下载链接给前端

```java
public String tempUrl(String configKey, String objectKey) {
    OssClient client = OssFactory.instance(configKey);
    return client.presignGetUrl(objectKey, Duration.ofMinutes(5));
}
```

### 示例 4：前端直传——后端只签 PUT 预签名 URL

```java
public Map<String, String> presignForUpload(String fileName) {
    OssClient client = OssFactory.instance();
    String key = client.buildPathKey(fileName);
    String putUrl = client.presignPutUrl(key, Duration.ofMinutes(10), Collections.emptyMap());
    return Map.of("key", key, "uploadUrl", putUrl);
}
```

### 示例 5：流式下载并直接处理（不落盘）

```java
String content = OssFactory.instance(configKey).download(objectKey, (meta, in) -> {
    // meta 为 GetObjectResult：可读 contentType()/size()/lastModified()
    return IoUtil.read(in, StandardCharsets.UTF_8);
});
```

### 示例 6：删除一组文件（参考 deleteWithValidByIds）

```java
List<SysOss> list = ossMapper.selectByIds(ids);
for (SysOss sysOss : list) {
    // 关键：按各自的 service(configKey) 取对应客户端删除
    OssFactory.instance(sysOss.getService()).delete(sysOss.getFileName());
}
ossMapper.deleteByIds(ids);
```

## 七、常见错误对比（≥3）

### 错误 1：自己 new 客户端 / 缓存 OssClient

```java
// ❌ 错误：绕过工厂，配置变更后不会刷新，且重复创建 Netty 连接池
OssClient client = new DefaultOssClientImpl("k", config);

// ✅ 正确：始终通过工厂获取，工厂负责缓存与配置比对
OssClient client = OssFactory.instance(configKey);
```

### 错误 2：用错误的「桶/key」字段下载或删除

```java
// ❌ 错误：用 originalName（原始文件名）当对象 key
client.delete(sysOss.getOriginalName());

// ✅ 正确：对象 key 是 sys_oss.fileName（含 日期/uuid 路径）
client.delete(sysOss.getFileName());
```

### 错误 3：私有桶直接返回 url 字段给前端

```java
// ❌ 错误：private 桶的固定 url 无法访问（403），且永久暴露
return sysOss.getUrl();

// ✅ 正确：private 桶要签临时 URL（参考 matchingUrl）
if (client.verifyConfig(c -> AccessPolicy.PRIVATE.equals(c.accessControlPolicyConfig().accessPolicy()))) {
    return client.presignGetUrl(sysOss.getFileName(), Duration.ofSeconds(120));
}
return sysOss.getUrl();
```

### 错误 4：误以为需要引入 MinIO / 阿里云 SDK

```xml
<!-- ❌ 错误：6.x 没有也不需要这些依赖 -->
<dependency><groupId>io.minio</groupId><artifactId>minio</artifactId></dependency>
<dependency><groupId>com.aliyun.oss</groupId><artifactId>aliyun-sdk-oss</artifactId></dependency>

<!-- ✅ 正确：只用 AWS SDK v2 S3，统一协议适配所有厂商 -->
<dependency><groupId>software.amazon.awssdk</groupId><artifactId>s3</artifactId></dependency>
```

### 错误 5：包名/分层写错（6.x 铁律）

```java
// ❌ 错误：旧包名、引用旧框架风格
import plus.ruoyi.common.oss.factory.OssFactory;     // 包名错
import com.ruoyi.system.service.ISysOssService;       // 包名错

// ✅ 正确：6.x 一律 org.dromara
import org.dromara.common.oss.factory.OssFactory;
import org.dromara.system.service.ISysOssService;
```

## 八、最佳实践

1. **永远走工厂**：`OssFactory.instance()` / `instance(configKey)`，绝不手动 new 或缓存客户端引用；切换默认存储改 `sys_oss_config` 而非 Redis。
2. **对象 key 用 `buildPathKey`**：自动拼「业务前缀 / yyyy/MM/dd / uuid + 后缀」，避免同名覆盖和热点目录；需要业务隔离时用 `buildPathKey(businessPrefix, fileName)`。
3. **落库三字段对应清楚**：`fileName`=对象 key、`originalName`=原始名、`service`=configKey；下载/删除一律按记录里的 `service` 反查客户端。
4. **私有桶必签临时 URL**：列表/详情返回前用 `verifyConfig` 判断是否 `PRIVATE`，是则 `presignGetUrl`；公共读桶才可直接用固定 url。
5. **上传尽量提供 contentType 与 length**：`Options.setContentType` 影响浏览器预览；输入流上传必须传准确 `contentLength`，否则会被框架临时落盘计算长度，影响性能。
6. **异步异常用 `HandleAsyncResult` 判定**：自定义 `doCustomUpload` 时通过 `result.isFailure()` / `result.getError()` 判断，不要吞异常；统一抛 `S3StorageException`。
7. **大文件交给 TransferManager**：底层 `S3TransferManager` 已处理分段上传/下载，业务侧直接用 `upload(File/Path)` 即可，无需手写分片。
8. **MinIO/自建注意路径样式**：endpoint 不含 `aliyun/qcloud/qiniu/obs` 关键字会自动启用路径样式访问；MinIO 走 HTTPS 时配自定义域名 `domainUrl` 并确认桶 URL 风格正确。
9. **不要在循环里反复 `OssFactory.instance(...)` 后还自己关闭**：客户端由工厂托管生命周期，业务侧不要调用 `client.close()`，关闭交给 `OssFactory.remove(configKey)` 或配置变更时框架自动处理。
10. **权限注解齐全**：自定义文件接口沿用 `@SaCheckPermission("system:oss:xxx")` + `@Log` 审计，保持与 `SysOssController` 一致。

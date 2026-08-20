# 宿主 nginx 现网配置快照（人工维护，deploy.sh 不覆盖）

这些文件**当前只存在于部署机** `/etc/nginx/conf.d/`，deploy.sh 从不生成也不备份它们，
一旦服务器重装或误删就无从恢复（本仓库曾因误删 `java-routing-map.conf` 导致 `nginx -t` 失败、
`systemctl reload nginx` 失败）。此目录是**版本化快照**，用于灾难恢复与变更审查。

| 文件 | 作用 | 关键点 |
|---|---|---|
| `ai-zhiyu-https.conf` | 现网 HTTPS 入口（`https://ai.zhiyu.com.cn`，用户实际访问的入口） | Let's Encrypt 证书路径、`client_max_body_size 200m`、单栈（Java+Vue）全部经 `127.0.0.1:8083` 容器网关 |

> 历史遗留（已随单栈化移除，2026-08-20）：`java-routing-map.conf`（按 Referer 把 `/api/` 分流到
> Go(8084) 或 Java(8083)）在 Go+Java 双栈并存期使用；Go 栈删除后 `/api/` 固定走 8083，map 不再被引用，
> 快照已同步删除。现场升级时请人工确认 `/etc/nginx/conf.d/java-routing-map.conf` 已无 conf 引用后删除。

## 维护约定

1. 改动现网这个文件后，**必须同步更新本目录快照**并提交，否则仓库与现网继续漂移。
2. deploy.sh 只管理 `zhiyu-saas.conf` / `zhiyu-saas-ssl.conf`（由 `deploy/nginx/conf.d/` 模板生成，
   写入前 `cmp` 去重、原子 mv、`nginx -t` 失败自动复位）。本目录文件不参与该流程。

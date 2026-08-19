# 宿主 nginx 现网配置快照（人工维护，deploy.sh 不覆盖）

这两个文件**当前只存在于部署机** `/etc/nginx/conf.d/`，deploy.sh 从不生成也不备份它们，
一旦服务器重装或误删就无从恢复（本仓库曾因误删 `java-routing-map.conf` 导致 `nginx -t` 失败、
`systemctl reload nginx` 失败）。此目录是**版本化快照**，用于灾难恢复与变更审查。

| 文件 | 作用 | 关键点 |
|---|---|---|
| `ai-zhiyu-https.conf` | 现网 HTTPS 入口（`https://ai.zhiyu.com.cn`，用户实际访问的入口） | Let's Encrypt 证书路径、`client_max_body_size 200m`、`/api/` 走 `$java_backend_port` 分流 |
| `java-routing-map.conf` | 按 `Referer` 把共享路径 `/api/` 分流到 Go(8084) 或 Java(8083) 的 `map` | **被 `ai-zhiyu-https.conf:12` 引用**，删除会导致整个 nginx 配置校验失败 |

## 维护约定

1. 改动现网这两个文件后，**必须同步更新本目录快照**并提交，否则仓库与现网继续漂移。
2. deploy.sh 只管理 `zhiyu-saas.conf` / `zhiyu-saas-ssl.conf`（由 `deploy/nginx/conf.d/` 模板生成，
   写入前 `cmp` 去重、原子 mv、`nginx -t` 失败自动复位）。本目录文件不参与该流程。
3. `$java_backend_port` 的 Referer 分流是历史遗留方案：Java 门户已收编到 `/java/api/v1`
   （见 `docs/spec/vue-business-portal.md` §8.1），后续可评估删除该 map 并把 `/api/` 固定回 8084；
   删除前务必先确认没有任何 conf 再引用它（`grep -rn java_backend_port /etc/nginx/`）。

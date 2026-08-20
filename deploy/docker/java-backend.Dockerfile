# zhiyu-saas Java 版后端镜像（Go→Java 迁移，基于 saas-framework6-java-vue）
# 离线构建：基础镜像用本地已有的 ubuntu:24.04，JDK 21 从宿主机 COPY（deploy.sh 准备上下文）
FROM ubuntu:24.04

WORKDIR /app

# 字体渲染库（Hutool 图形验证码 AWT 依赖 libfontmanager/libharfbuzz/libfreetype）
# curl：compose healthcheck 探活用（nginx:alpine 自带 wget，ubuntu 基础镜像需显式装 curl）
RUN apt-get update && apt-get install -y --no-install-recommends \
      fontconfig libharfbuzz0b libfreetype6 curl \
    && rm -rf /var/lib/apt/lists/*

# JDK 21（宿主机 /usr/lib/jvm/java-21-openjdk-amd64 拷贝，glibc 兼容）
COPY jdk/ /usr/lib/jvm/java-21-openjdk-amd64/
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

# 时区
ENV TZ=Asia/Shanghai

COPY ruoyi-admin.jar /app/ruoyi-admin.jar

ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC -Dfile.encoding=UTF-8"

# 非 root 运行，uid 固定为 1000（与上传卷既有文件属主一致，Go 迁移前的历史约定保留）：
# 上传卷 zhiyu-saas_uploads_data 中租户目录为 uid 1000 属主，Java 若以 root 建目录会变成 root:root，
# 后续读写不一致。保持 uid=1000 与存量文件互通。
# 基础镜像（ubuntu:24.04）某些版本已自带 uid 1000 用户（如 ubuntu 用户），
# useradd -u 1000 会报 "UID 1000 is not unique"；用 -o 允许 UID 复用（仍保持 uid=1000 与 Go 侧互通），
# 幂等：用户已存在（含同名/同 uid）则跳过创建。
RUN (id appuser >/dev/null 2>&1 || useradd -o -u 1000 -m -s /usr/sbin/nologin appuser) \
    && mkdir -p /opt/zhiyu-saas/uploads \
    && chown -R appuser:appuser /app /opt/zhiyu-saas/uploads
USER appuser

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/ruoyi-admin.jar --spring.profiles.active=prod"]

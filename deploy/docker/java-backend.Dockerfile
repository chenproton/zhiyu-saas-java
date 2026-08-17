# zhiyu-saas Java 版后端镜像（Go→Java 迁移，基于 saas-framework6-java-vue）
# 离线构建：基础镜像用本地已有的 ubuntu:24.04，JDK 21 从宿主机 COPY（deploy.sh 准备上下文）
FROM ubuntu:24.04

WORKDIR /app

# 字体渲染库（Hutool 图形验证码 AWT 依赖 libfontmanager/libharfbuzz/libfreetype）
RUN apt-get update && apt-get install -y --no-install-recommends \
      fontconfig libharfbuzz0b libfreetype6 \
    && rm -rf /var/lib/apt/lists/*

# JDK 21（宿主机 /usr/lib/jvm/java-21-openjdk-amd64 拷贝，glibc 兼容）
COPY jdk/ /usr/lib/jvm/java-21-openjdk-amd64/
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

# 时区
ENV TZ=Asia/Shanghai

COPY ruoyi-admin.jar /app/ruoyi-admin.jar

ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseG1GC -Dfile.encoding=UTF-8"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/ruoyi-admin.jar --spring.profiles.active=prod"]

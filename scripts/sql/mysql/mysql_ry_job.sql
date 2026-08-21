/*
 SnailJob Database Transfer Tool
 Source Server Type    : MySQL
 Target Server Type    : PostgreSQL
 Date: 2025-06-21 23:23:10
*/


-- sj_namespace
CREATE TABLE sj_namespace
(
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        varchar(64)  NOT NULL,
    unique_id   varchar(64)  NOT NULL,
    description varchar(256) NOT NULL DEFAULT '',
    deleted     smallint     NOT NULL DEFAULT 0,
    create_dt   datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt   datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_namespace_01 ON sj_namespace (name);

-- 列注释: sj_namespace.id = 主键
-- 列注释: sj_namespace.name = 名称
-- 列注释: sj_namespace.unique_id = 唯一id
-- 列注释: sj_namespace.description = 描述
-- 列注释: sj_namespace.deleted = 逻辑删除 1、删除
-- 列注释: sj_namespace.create_dt = 创建时间
-- 列注释: sj_namespace.update_dt = 修改时间
-- 表注释: sj_namespace = 命名空间

INSERT INTO sj_namespace VALUES (1, 'Development', 'dev', '', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO sj_namespace VALUES (2, 'Production', 'prod', '', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- sj_group_config
CREATE TABLE sj_group_config
(
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id      varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name        varchar(64)  NOT NULL DEFAULT '',
    description       varchar(256) NOT NULL DEFAULT '',
    token             varchar(64)  NOT NULL DEFAULT 'SJ_cKqBTPzCsWA3VyuCfFoccmuIEGXjr5KT',
    group_status      smallint     NOT NULL DEFAULT 0,
    version           int          NOT NULL,
    group_partition   int          NOT NULL,
    id_generator_mode smallint     NOT NULL DEFAULT 1,
    init_scene        smallint     NOT NULL DEFAULT 0,
    create_dt         datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt         datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_sj_group_config_01 ON sj_group_config (namespace_id, group_name);

-- 列注释: sj_group_config.id = 主键
-- 列注释: sj_group_config.namespace_id = 命名空间id
-- 列注释: sj_group_config.group_name = 组名称
-- 列注释: sj_group_config.description = 组描述
-- 列注释: sj_group_config.token = token
-- 列注释: sj_group_config.group_status = 组状态 0、未启用 1、启用
-- 列注释: sj_group_config.version = 版本号
-- 列注释: sj_group_config.group_partition = 分区
-- 列注释: sj_group_config.id_generator_mode = 唯一id生成模式 默认号段模式
-- 列注释: sj_group_config.init_scene = 是否初始化场景 0:否 1:是
-- 列注释: sj_group_config.create_dt = 创建时间
-- 列注释: sj_group_config.update_dt = 修改时间
-- 表注释: sj_group_config = 组配置

INSERT INTO sj_group_config VALUES (1, 'dev', 'ruoyi_group', '', 'SJ_cKqBTPzCsWA3VyuCfFoccmuIEGXjr5KT', 1, 1, 0, 1, 1,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO sj_group_config VALUES (2, 'prod', 'ruoyi_group', '', 'SJ_cKqBTPzCsWA3VyuCfFoccmuIEGXjr5KT', 1, 1, 0, 1, 1,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- sj_notify_config
CREATE TABLE sj_notify_config
(
    id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id           varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name             varchar(64)  NOT NULL,
    notify_name            varchar(64)  NOT NULL DEFAULT '',
    system_task_type       smallint     NOT NULL DEFAULT 3,
    notify_status          smallint     NOT NULL DEFAULT 0,
    recipient_ids          varchar(128) NOT NULL,
    notify_threshold       int          NOT NULL DEFAULT 0,
    notify_scene           smallint     NOT NULL DEFAULT 0,
    rate_limiter_status    smallint     NOT NULL DEFAULT 0,
    rate_limiter_threshold int          NOT NULL DEFAULT 0,
    description            varchar(256) NOT NULL DEFAULT '',
    create_dt              datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt              datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_notify_config_01 ON sj_notify_config (namespace_id, group_name);

-- 列注释: sj_notify_config.id = 主键
-- 列注释: sj_notify_config.namespace_id = 命名空间id
-- 列注释: sj_notify_config.group_name = 组名称
-- 列注释: sj_notify_config.notify_name = 通知名称
-- 列注释: sj_notify_config.system_task_type = 任务类型 1. 重试任务 2. 重试回调 3、JOB任务 4、WORKFLOW任务
-- 列注释: sj_notify_config.notify_status = 通知状态 0、未启用 1、启用
-- 列注释: sj_notify_config.recipient_ids = 接收人id列表
-- 列注释: sj_notify_config.notify_threshold = 通知阈值
-- 列注释: sj_notify_config.notify_scene = 通知场景
-- 列注释: sj_notify_config.rate_limiter_status = 限流状态 0、未启用 1、启用
-- 列注释: sj_notify_config.rate_limiter_threshold = 每秒限流阈值
-- 列注释: sj_notify_config.description = 描述
-- 列注释: sj_notify_config.create_dt = 创建时间
-- 列注释: sj_notify_config.update_dt = 修改时间
-- 表注释: sj_notify_config = 通知配置

-- sj_notify_recipient
CREATE TABLE sj_notify_recipient
(
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id     varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    recipient_name   varchar(64)  NOT NULL,
    notify_type      smallint     NOT NULL DEFAULT 0,
    notify_attribute varchar(512) NOT NULL,
    description      varchar(256) NOT NULL DEFAULT '',
    create_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_notify_recipient_01 ON sj_notify_recipient (namespace_id);

-- 列注释: sj_notify_recipient.id = 主键
-- 列注释: sj_notify_recipient.namespace_id = 命名空间id
-- 列注释: sj_notify_recipient.recipient_name = 接收人名称
-- 列注释: sj_notify_recipient.notify_type = 通知类型 1、钉钉 2、邮件 3、企业微信 4 飞书 5 webhook
-- 列注释: sj_notify_recipient.notify_attribute = 配置属性
-- 列注释: sj_notify_recipient.description = 描述
-- 列注释: sj_notify_recipient.create_dt = 创建时间
-- 列注释: sj_notify_recipient.update_dt = 修改时间
-- 表注释: sj_notify_recipient = 告警通知接收人

-- sj_retry_dead_letter
CREATE TABLE sj_retry_dead_letter
(
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id    varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name      varchar(64)  NOT NULL,
    group_id        bigint       NOT NULL,
    scene_name      varchar(64)  NOT NULL,
    scene_id        bigint       NOT NULL,
    idempotent_id   varchar(64)  NOT NULL,
    biz_no          varchar(64)  NOT NULL DEFAULT '',
    executor_name   varchar(512) NOT NULL DEFAULT '',
    serializer_name varchar(32)  NOT NULL DEFAULT 'jackson',
    args_str        text         NOT NULL,
    ext_attrs       text         NOT NULL,
    create_dt       datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_retry_dead_letter_01 ON sj_retry_dead_letter (namespace_id, group_name, scene_name);
CREATE INDEX idx_sj_retry_dead_letter_02 ON sj_retry_dead_letter (idempotent_id);
CREATE INDEX idx_sj_retry_dead_letter_03 ON sj_retry_dead_letter (biz_no);
CREATE INDEX idx_sj_retry_dead_letter_04 ON sj_retry_dead_letter (create_dt);

-- 列注释: sj_retry_dead_letter.id = 主键
-- 列注释: sj_retry_dead_letter.namespace_id = 命名空间id
-- 列注释: sj_retry_dead_letter.group_name = 组名称
-- 列注释: sj_retry_dead_letter.group_id = 组Id
-- 列注释: sj_retry_dead_letter.scene_name = 场景名称
-- 列注释: sj_retry_dead_letter.scene_id = 场景ID
-- 列注释: sj_retry_dead_letter.idempotent_id = 幂等id
-- 列注释: sj_retry_dead_letter.biz_no = 业务编号
-- 列注释: sj_retry_dead_letter.executor_name = 执行器名称
-- 列注释: sj_retry_dead_letter.serializer_name = 执行方法参数序列化器名称
-- 列注释: sj_retry_dead_letter.args_str = 执行方法参数
-- 列注释: sj_retry_dead_letter.ext_attrs = 扩展字段
-- 列注释: sj_retry_dead_letter.create_dt = 创建时间
-- 表注释: sj_retry_dead_letter = 死信队列表

-- sj_retry
CREATE TABLE sj_retry
(
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id    varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name      varchar(64)  NOT NULL,
    group_id        bigint       NOT NULL,
    scene_name      varchar(64)  NOT NULL,
    scene_id        bigint       NOT NULL,
    idempotent_id   varchar(64)  NOT NULL,
    biz_no          varchar(64)  NOT NULL DEFAULT '',
    executor_name   varchar(512) NOT NULL DEFAULT '',
    args_str        text         NOT NULL,
    ext_attrs       text         NOT NULL,
    serializer_name varchar(32)  NOT NULL DEFAULT 'jackson',
    next_trigger_at bigint       NOT NULL,
    retry_count     int          NOT NULL DEFAULT 0,
    retry_status    smallint     NOT NULL DEFAULT 0,
    task_type       smallint     NOT NULL DEFAULT 1,
    bucket_index    int          NOT NULL DEFAULT 0,
    parent_id       bigint       NOT NULL DEFAULT 0,
    deleted         bigint       NOT NULL DEFAULT 0,
    create_dt       datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt       datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_sj_retry_01 ON sj_retry (scene_id, task_type, idempotent_id, deleted);

CREATE INDEX idx_sj_retry_01 ON sj_retry (biz_no);
CREATE INDEX idx_sj_retry_02 ON sj_retry (idempotent_id);
CREATE INDEX idx_sj_retry_03 ON sj_retry (retry_status, bucket_index);
CREATE INDEX idx_sj_retry_04 ON sj_retry (parent_id);
CREATE INDEX idx_sj_retry_05 ON sj_retry (create_dt);

-- 列注释: sj_retry.id = 主键
-- 列注释: sj_retry.namespace_id = 命名空间id
-- 列注释: sj_retry.group_name = 组名称
-- 列注释: sj_retry.group_id = 组Id
-- 列注释: sj_retry.scene_name = 场景名称
-- 列注释: sj_retry.scene_id = 场景ID
-- 列注释: sj_retry.idempotent_id = 幂等id
-- 列注释: sj_retry.biz_no = 业务编号
-- 列注释: sj_retry.executor_name = 执行器名称
-- 列注释: sj_retry.args_str = 执行方法参数
-- 列注释: sj_retry.ext_attrs = 扩展字段
-- 列注释: sj_retry.serializer_name = 执行方法参数序列化器名称
-- 列注释: sj_retry.next_trigger_at = 下次触发时间
-- 列注释: sj_retry.retry_count = 重试次数
-- 列注释: sj_retry.retry_status = 重试状态 0、重试中 1、成功 2、最大重试次数
-- 列注释: sj_retry.task_type = 任务类型 1、重试数据 2、回调数据
-- 列注释: sj_retry.bucket_index = bucket
-- 列注释: sj_retry.parent_id = 父节点id
-- 列注释: sj_retry.deleted = 逻辑删除
-- 列注释: sj_retry.create_dt = 创建时间
-- 列注释: sj_retry.update_dt = 修改时间
-- 表注释: sj_retry = 重试信息表

-- sj_retry_task
CREATE TABLE sj_retry_task
(
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id     varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name       varchar(64)  NOT NULL,
    scene_name       varchar(64)  NOT NULL,
    retry_id         bigint       NOT NULL,
    ext_attrs        text         NOT NULL,
    task_status      smallint     NOT NULL DEFAULT 1,
    task_type        smallint     NOT NULL DEFAULT 1,
    operation_reason smallint     NOT NULL DEFAULT 0,
    client_info      varchar(128) NULL     DEFAULT NULL,
    create_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_retry_task_01 ON sj_retry_task (namespace_id, group_name, scene_name);
CREATE INDEX idx_sj_retry_task_02 ON sj_retry_task (task_status);
CREATE INDEX idx_sj_retry_task_03 ON sj_retry_task (create_dt);
CREATE INDEX idx_sj_retry_task_04 ON sj_retry_task (retry_id);

-- 列注释: sj_retry_task.id = 主键
-- 列注释: sj_retry_task.namespace_id = 命名空间id
-- 列注释: sj_retry_task.group_name = 组名称
-- 列注释: sj_retry_task.scene_name = 场景名称
-- 列注释: sj_retry_task.retry_id = 重试信息Id
-- 列注释: sj_retry_task.ext_attrs = 扩展字段
-- 列注释: sj_retry_task.task_status = 重试状态
-- 列注释: sj_retry_task.task_type = 任务类型 1、重试数据 2、回调数据
-- 列注释: sj_retry_task.operation_reason = 操作原因
-- 列注释: sj_retry_task.client_info = 客户端地址 clientId#ip:port
-- 列注释: sj_retry_task.create_dt = 创建时间
-- 列注释: sj_retry_task.update_dt = 修改时间
-- 表注释: sj_retry_task = 重试任务表

-- sj_retry_task_log_message
CREATE TABLE sj_retry_task_log_message
(
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id  varchar(64) NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name    varchar(64) NOT NULL,
    retry_id      bigint      NOT NULL,
    retry_task_id bigint      NOT NULL,
    message       text        NOT NULL,
    log_num       int         NOT NULL DEFAULT 1,
    real_time     bigint      NOT NULL DEFAULT 0,
    create_dt     datetime   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_retry_task_log_message_01 ON sj_retry_task_log_message (namespace_id, group_name, retry_task_id);
CREATE INDEX idx_sj_retry_task_log_message_02 ON sj_retry_task_log_message (create_dt);

-- 列注释: sj_retry_task_log_message.id = 主键
-- 列注释: sj_retry_task_log_message.namespace_id = 命名空间id
-- 列注释: sj_retry_task_log_message.group_name = 组名称
-- 列注释: sj_retry_task_log_message.retry_id = 重试信息Id
-- 列注释: sj_retry_task_log_message.retry_task_id = 重试任务Id
-- 列注释: sj_retry_task_log_message.message = 异常信息
-- 列注释: sj_retry_task_log_message.log_num = 日志数量
-- 列注释: sj_retry_task_log_message.real_time = 上报时间
-- 列注释: sj_retry_task_log_message.create_dt = 创建时间
-- 表注释: sj_retry_task_log_message = 任务调度日志信息记录表

-- sj_retry_scene_config
CREATE TABLE sj_retry_scene_config
(
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id        varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    scene_name          varchar(64)  NOT NULL,
    group_name          varchar(64)  NOT NULL,
    scene_status        smallint     NOT NULL DEFAULT 0,
    max_retry_count     int          NOT NULL DEFAULT 5,
    back_off            smallint     NOT NULL DEFAULT 1,
    trigger_interval    varchar(16)  NOT NULL DEFAULT '',
    notify_ids          varchar(128) NOT NULL DEFAULT '',
    deadline_request    bigint       NOT NULL DEFAULT 60000,
    executor_timeout    int          NOT NULL DEFAULT 5,
    route_key           smallint     NOT NULL DEFAULT 4,
    block_strategy      smallint     NOT NULL DEFAULT 1,
    cb_status           smallint     NOT NULL DEFAULT 0,
    cb_trigger_type     smallint     NOT NULL DEFAULT 1,
    cb_max_count        int          NOT NULL DEFAULT 16,
    cb_trigger_interval varchar(16)  NOT NULL DEFAULT '',
    owner_id            bigint       NULL     DEFAULT NULL,
    labels              varchar(512) NULL     DEFAULT '',
    description         varchar(256) NOT NULL DEFAULT '',
    create_dt           datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt           datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_sj_retry_scene_config_01 ON sj_retry_scene_config (namespace_id, group_name, scene_name);

-- 列注释: sj_retry_scene_config.id = 主键
-- 列注释: sj_retry_scene_config.namespace_id = 命名空间id
-- 列注释: sj_retry_scene_config.scene_name = 场景名称
-- 列注释: sj_retry_scene_config.group_name = 组名称
-- 列注释: sj_retry_scene_config.scene_status = 组状态 0、未启用 1、启用
-- 列注释: sj_retry_scene_config.max_retry_count = 最大重试次数
-- 列注释: sj_retry_scene_config.back_off = 1、默认等级 2、固定间隔时间 3、CRON 表达式
-- 列注释: sj_retry_scene_config.trigger_interval = 间隔时长
-- 列注释: sj_retry_scene_config.notify_ids = 通知告警场景配置id列表
-- 列注释: sj_retry_scene_config.deadline_request = Deadline Request 调用链超时 单位毫秒
-- 列注释: sj_retry_scene_config.executor_timeout = 任务执行超时时间，单位秒
-- 列注释: sj_retry_scene_config.route_key = 路由策略
-- 列注释: sj_retry_scene_config.block_strategy = 阻塞策略 1、丢弃 2、覆盖 3、并行
-- 列注释: sj_retry_scene_config.cb_status = 回调状态 0、不开启 1、开启
-- 列注释: sj_retry_scene_config.cb_trigger_type = 1、默认等级 2、固定间隔时间 3、CRON 表达式
-- 列注释: sj_retry_scene_config.cb_max_count = 回调的最大执行次数
-- 列注释: sj_retry_scene_config.cb_trigger_interval = 回调的最大执行次数
-- 列注释: sj_retry_scene_config.owner_id = 负责人id
-- 列注释: sj_retry_scene_config.labels = 标签
-- 列注释: sj_retry_scene_config.description = 描述
-- 列注释: sj_retry_scene_config.create_dt = 创建时间
-- 列注释: sj_retry_scene_config.update_dt = 修改时间
-- 表注释: sj_retry_scene_config = 场景配置

-- sj_server_node
CREATE TABLE sj_server_node
(
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name   varchar(64)  NOT NULL,
    host_id      varchar(64)  NOT NULL,
    host_ip      varchar(64)  NOT NULL,
    host_port    int          NOT NULL,
    expire_at    datetime    NOT NULL,
    node_type    smallint     NOT NULL,
    ext_attrs    varchar(256) NULL     DEFAULT '',
    labels       varchar(512) NULL     DEFAULT '',
    create_dt    datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt    datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_sj_server_node_01 ON sj_server_node (host_id, host_ip);

CREATE INDEX idx_sj_server_node_01 ON sj_server_node (namespace_id, group_name);
CREATE INDEX idx_sj_server_node_02 ON sj_server_node (expire_at, node_type);

-- 列注释: sj_server_node.id = 主键
-- 列注释: sj_server_node.namespace_id = 命名空间id
-- 列注释: sj_server_node.group_name = 组名称
-- 列注释: sj_server_node.host_id = 主机id
-- 列注释: sj_server_node.host_ip = 机器ip
-- 列注释: sj_server_node.host_port = 机器端口
-- 列注释: sj_server_node.expire_at = 过期时间
-- 列注释: sj_server_node.node_type = 节点类型 1、客户端 2、是服务端
-- 列注释: sj_server_node.ext_attrs = 扩展字段
-- 列注释: sj_server_node.labels = 标签
-- 列注释: sj_server_node.create_dt = 创建时间
-- 列注释: sj_server_node.update_dt = 修改时间
-- 表注释: sj_server_node = 服务器节点

-- sj_distributed_lock
CREATE TABLE sj_distributed_lock
(
    name       varchar(64)  NOT NULL PRIMARY KEY,
    lock_until datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    locked_at  datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    locked_by  varchar(255) NOT NULL,
    create_dt  datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt  datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 列注释: sj_distributed_lock.name = 锁名称
-- 列注释: sj_distributed_lock.lock_until = 锁定时长
-- 列注释: sj_distributed_lock.locked_at = 锁定时间
-- 列注释: sj_distributed_lock.locked_by = 锁定者
-- 列注释: sj_distributed_lock.create_dt = 创建时间
-- 列注释: sj_distributed_lock.update_dt = 修改时间
-- 表注释: sj_distributed_lock = 锁定表

-- sj_system_user
CREATE TABLE sj_system_user
(
    id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    username  varchar(64)  NOT NULL,
    password  varchar(128) NOT NULL,
    role      smallint     NOT NULL DEFAULT 0,
    create_dt datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 列注释: sj_system_user.id = 主键
-- 列注释: sj_system_user.username = 账号
-- 列注释: sj_system_user.password = 密码
-- 列注释: sj_system_user.role = 角色：1-普通用户、2-管理员
-- 列注释: sj_system_user.create_dt = 创建时间
-- 列注释: sj_system_user.update_dt = 修改时间
-- 表注释: sj_system_user = 系统用户表

INSERT INTO sj_system_user (username, password, role)
VALUES ('admin', '465c194afb65670f38322df087f0a9bb225cc257e43eb4ac5a0c98ef5b3173ac', 2);

-- sj_system_user_permission
CREATE TABLE sj_system_user_permission
(
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_name     varchar(64) NOT NULL,
    namespace_id   varchar(64) NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    system_user_id bigint      NOT NULL,
    create_dt      datetime   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt      datetime   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_sj_system_user_permission_01 ON sj_system_user_permission (namespace_id, group_name, system_user_id);

-- 列注释: sj_system_user_permission.id = 主键
-- 列注释: sj_system_user_permission.group_name = 组名称
-- 列注释: sj_system_user_permission.namespace_id = 命名空间id
-- 列注释: sj_system_user_permission.system_user_id = 系统用户id
-- 列注释: sj_system_user_permission.create_dt = 创建时间
-- 列注释: sj_system_user_permission.update_dt = 修改时间
-- 表注释: sj_system_user_permission = 系统用户权限表

-- sj_job
CREATE TABLE sj_job
(
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id     varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    biz_id           varchar(64)  NOT NULL,
    group_name       varchar(64)  NOT NULL,
    job_name         varchar(64)  NOT NULL,
    args_str         text         NULL     DEFAULT NULL,
    args_type        smallint     NOT NULL DEFAULT 1,
    next_trigger_at  bigint       NOT NULL,
    job_status       smallint     NOT NULL DEFAULT 1,
    task_type        smallint     NOT NULL DEFAULT 1,
    route_key        smallint     NOT NULL DEFAULT 4,
    executor_type    smallint     NOT NULL DEFAULT 1,
    executor_info    varchar(255) NULL     DEFAULT NULL,
    trigger_type     smallint     NOT NULL,
    trigger_interval varchar(255) NOT NULL,
    block_strategy   smallint     NOT NULL DEFAULT 1,
    executor_timeout int          NOT NULL DEFAULT 0,
    max_retry_times  int          NOT NULL DEFAULT 0,
    parallel_num     int          NOT NULL DEFAULT 1,
    retry_interval   int          NOT NULL DEFAULT 0,
    bucket_index     int          NOT NULL DEFAULT 0,
    resident         smallint     NOT NULL DEFAULT 0,
    notify_ids       varchar(128) NOT NULL DEFAULT '',
    owner_id         bigint       NULL     DEFAULT NULL,
    labels           varchar(512) NULL     DEFAULT '',
    description      varchar(256) NOT NULL DEFAULT '',
    ext_attrs        varchar(256) NULL     DEFAULT '',
    deleted          smallint     NOT NULL DEFAULT 0,
    create_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_job_01 ON sj_job (namespace_id, group_name);
CREATE INDEX idx_sj_job_02 ON sj_job (job_status, bucket_index);
CREATE INDEX idx_sj_job_03 ON sj_job (create_dt);
CREATE UNIQUE INDEX uk_sj_job_01 ON sj_job (namespace_id, biz_id);

-- 列注释: sj_job.id = 主键
-- 列注释: sj_job.namespace_id = 命名空间id
-- 列注释: sj_job.biz_id = 业务ID
-- 列注释: sj_job.group_name = 组名称
-- 列注释: sj_job.job_name = 名称
-- 列注释: sj_job.args_str = 执行方法参数
-- 列注释: sj_job.args_type = 参数类型 
-- 列注释: sj_job.next_trigger_at = 下次触发时间
-- 列注释: sj_job.job_status = 任务状态 0、关闭、1、开启
-- 列注释: sj_job.task_type = 任务类型 1、集群 2、广播 3、切片
-- 列注释: sj_job.route_key = 路由策略
-- 列注释: sj_job.executor_type = 执行器类型
-- 列注释: sj_job.executor_info = 执行器名称
-- 列注释: sj_job.trigger_type = 触发类型 1.CRON 表达式 2. 固定时间
-- 列注释: sj_job.trigger_interval = 间隔时长
-- 列注释: sj_job.block_strategy = 阻塞策略 1、丢弃 2、覆盖 3、并行 4、恢复
-- 列注释: sj_job.executor_timeout = 任务执行超时时间，单位秒
-- 列注释: sj_job.max_retry_times = 最大重试次数
-- 列注释: sj_job.parallel_num = 并行数
-- 列注释: sj_job.retry_interval = 重试间隔 ( s)
-- 列注释: sj_job.bucket_index = bucket
-- 列注释: sj_job.resident = 是否是常驻任务
-- 列注释: sj_job.notify_ids = 通知告警场景配置id列表
-- 列注释: sj_job.owner_id = 负责人id
-- 列注释: sj_job.labels = 标签
-- 列注释: sj_job.description = 描述
-- 列注释: sj_job.ext_attrs = 扩展字段
-- 列注释: sj_job.deleted = 逻辑删除 1、删除
-- 列注释: sj_job.create_dt = 创建时间
-- 列注释: sj_job.update_dt = 修改时间
-- 表注释: sj_job = 任务信息

INSERT INTO sj_job VALUES (1, 'dev', 'demo-job', 'ruoyi_group', 'demo-job', null, 1, 1710344035622, 1, 1, 4, 1, 'testJobExecutor', 2, '60', 1, 60, 3, 1, 1, 116, 0, '', 1, '', '', '', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- sj_job_log_message
CREATE TABLE sj_job_log_message
(
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id  varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name    varchar(64)  NOT NULL,
    job_id        bigint       NOT NULL,
    task_batch_id bigint       NOT NULL,
    task_id       bigint       NOT NULL,
    message       text         NOT NULL,
    log_num       int          NOT NULL DEFAULT 1,
    real_time     bigint       NOT NULL DEFAULT 0,
    ext_attrs     varchar(256) NULL     DEFAULT '',
    create_dt     datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_job_log_message_01 ON sj_job_log_message (task_batch_id, task_id);
CREATE INDEX idx_sj_job_log_message_02 ON sj_job_log_message (create_dt);
CREATE INDEX idx_sj_job_log_message_03 ON sj_job_log_message (namespace_id, group_name);

-- 列注释: sj_job_log_message.id = 主键
-- 列注释: sj_job_log_message.namespace_id = 命名空间id
-- 列注释: sj_job_log_message.group_name = 组名称
-- 列注释: sj_job_log_message.job_id = 任务信息id
-- 列注释: sj_job_log_message.task_batch_id = 任务批次id
-- 列注释: sj_job_log_message.task_id = 调度任务id
-- 列注释: sj_job_log_message.message = 调度信息
-- 列注释: sj_job_log_message.log_num = 日志数量
-- 列注释: sj_job_log_message.real_time = 上报时间
-- 列注释: sj_job_log_message.ext_attrs = 扩展字段
-- 列注释: sj_job_log_message.create_dt = 创建时间
-- 表注释: sj_job_log_message = 调度日志

-- sj_job_task
CREATE TABLE sj_job_task
(
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id   varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name     varchar(64)  NOT NULL,
    job_id         bigint       NOT NULL,
    task_batch_id  bigint       NOT NULL,
    parent_id      bigint       NOT NULL DEFAULT 0,
    task_status    smallint     NOT NULL DEFAULT 0,
    retry_count    int          NOT NULL DEFAULT 0,
    mr_stage       smallint     NULL     DEFAULT NULL,
    leaf           smallint     NOT NULL DEFAULT '1',
    task_name      varchar(255) NOT NULL DEFAULT '',
    client_info    varchar(128) NULL     DEFAULT NULL,
    wf_context     text         NULL     DEFAULT NULL,
    result_message text         NOT NULL,
    args_str       text         NULL     DEFAULT NULL,
    args_type      smallint     NOT NULL DEFAULT 1,
    ext_attrs      varchar(256) NULL     DEFAULT '',
    create_dt      datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt      datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_job_task_01 ON sj_job_task (task_batch_id, task_status);
CREATE INDEX idx_sj_job_task_02 ON sj_job_task (create_dt);
CREATE INDEX idx_sj_job_task_03 ON sj_job_task (namespace_id, group_name);

-- 列注释: sj_job_task.id = 主键
-- 列注释: sj_job_task.namespace_id = 命名空间id
-- 列注释: sj_job_task.group_name = 组名称
-- 列注释: sj_job_task.job_id = 任务信息id
-- 列注释: sj_job_task.task_batch_id = 调度任务id
-- 列注释: sj_job_task.parent_id = 父执行器id
-- 列注释: sj_job_task.task_status = 执行的状态 0、失败 1、成功
-- 列注释: sj_job_task.retry_count = 重试次数
-- 列注释: sj_job_task.mr_stage = 动态分片所处阶段 1:map 2:reduce 3:mergeReduce
-- 列注释: sj_job_task.leaf = 叶子节点
-- 列注释: sj_job_task.task_name = 任务名称
-- 列注释: sj_job_task.client_info = 客户端地址 clientId#ip:port
-- 列注释: sj_job_task.wf_context = 工作流全局上下文
-- 列注释: sj_job_task.result_message = 执行结果
-- 列注释: sj_job_task.args_str = 执行方法参数
-- 列注释: sj_job_task.args_type = 参数类型 
-- 列注释: sj_job_task.ext_attrs = 扩展字段
-- 列注释: sj_job_task.create_dt = 创建时间
-- 列注释: sj_job_task.update_dt = 修改时间
-- 表注释: sj_job_task = 任务实例

-- sj_job_task_batch
CREATE TABLE sj_job_task_batch
(
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id            varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name              varchar(64)  NOT NULL,
    job_id                  bigint       NOT NULL,
    workflow_node_id        bigint       NOT NULL DEFAULT 0,
    parent_workflow_node_id bigint       NOT NULL DEFAULT 0,
    workflow_task_batch_id  bigint       NOT NULL DEFAULT 0,
    task_batch_status       smallint     NOT NULL DEFAULT 0,
    operation_reason        smallint     NOT NULL DEFAULT 0,
    execution_at            bigint       NOT NULL DEFAULT 0,
    system_task_type        smallint     NOT NULL DEFAULT 3,
    parent_id               varchar(64)  NOT NULL DEFAULT '',
    ext_attrs               varchar(256) NULL     DEFAULT '',
    deleted                 smallint     NOT NULL DEFAULT 0,
    create_dt               datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt               datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_job_task_batch_01 ON sj_job_task_batch (job_id, task_batch_status);
CREATE INDEX idx_sj_job_task_batch_02 ON sj_job_task_batch (create_dt);
CREATE INDEX idx_sj_job_task_batch_03 ON sj_job_task_batch (namespace_id, group_name);
CREATE INDEX idx_sj_job_task_batch_04 ON sj_job_task_batch (workflow_task_batch_id, workflow_node_id);

-- 列注释: sj_job_task_batch.id = 主键
-- 列注释: sj_job_task_batch.namespace_id = 命名空间id
-- 列注释: sj_job_task_batch.group_name = 组名称
-- 列注释: sj_job_task_batch.job_id = 任务id
-- 列注释: sj_job_task_batch.workflow_node_id = 工作流节点id
-- 列注释: sj_job_task_batch.parent_workflow_node_id = 工作流任务父批次id
-- 列注释: sj_job_task_batch.workflow_task_batch_id = 工作流任务批次id
-- 列注释: sj_job_task_batch.task_batch_status = 任务批次状态 0、失败 1、成功
-- 列注释: sj_job_task_batch.operation_reason = 操作原因
-- 列注释: sj_job_task_batch.execution_at = 任务执行时间
-- 列注释: sj_job_task_batch.system_task_type = 任务类型 3、JOB任务 4、WORKFLOW任务
-- 列注释: sj_job_task_batch.parent_id = 父节点
-- 列注释: sj_job_task_batch.ext_attrs = 扩展字段
-- 列注释: sj_job_task_batch.deleted = 逻辑删除 1、删除
-- 列注释: sj_job_task_batch.create_dt = 创建时间
-- 列注释: sj_job_task_batch.update_dt = 修改时间
-- 表注释: sj_job_task_batch = 任务批次

-- sj_job_summary
CREATE TABLE sj_job_summary
(
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id     varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name       varchar(64)  NOT NULL DEFAULT '',
    business_id      bigint       NOT NULL,
    system_task_type smallint     NOT NULL DEFAULT 3,
    trigger_at       datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success_num      int          NOT NULL DEFAULT 0,
    fail_num         int          NOT NULL DEFAULT 0,
    fail_reason      varchar(512) NOT NULL DEFAULT '',
    stop_num         int          NOT NULL DEFAULT 0,
    stop_reason      varchar(512) NOT NULL DEFAULT '',
    cancel_num       int          NOT NULL DEFAULT 0,
    cancel_reason    varchar(512) NOT NULL DEFAULT '',
    create_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_sj_job_summary_01 ON sj_job_summary (trigger_at, system_task_type, business_id);

CREATE INDEX idx_sj_job_summary_01 ON sj_job_summary (namespace_id, group_name, business_id);

-- 列注释: sj_job_summary.id = 主键
-- 列注释: sj_job_summary.namespace_id = 命名空间id
-- 列注释: sj_job_summary.group_name = 组名称
-- 列注释: sj_job_summary.business_id = 业务id  ( job_id或workflow_id)
-- 列注释: sj_job_summary.system_task_type = 任务类型 3、JOB任务 4、WORKFLOW任务
-- 列注释: sj_job_summary.trigger_at = 统计时间
-- 列注释: sj_job_summary.success_num = 执行成功-日志数量
-- 列注释: sj_job_summary.fail_num = 执行失败-日志数量
-- 列注释: sj_job_summary.fail_reason = 失败原因
-- 列注释: sj_job_summary.stop_num = 执行失败-日志数量
-- 列注释: sj_job_summary.stop_reason = 失败原因
-- 列注释: sj_job_summary.cancel_num = 执行失败-日志数量
-- 列注释: sj_job_summary.cancel_reason = 失败原因
-- 列注释: sj_job_summary.create_dt = 创建时间
-- 列注释: sj_job_summary.update_dt = 修改时间
-- 表注释: sj_job_summary = DashBoard_Job

-- sj_retry_summary
CREATE TABLE sj_retry_summary
(
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id  varchar(64) NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name    varchar(64) NOT NULL DEFAULT '',
    scene_name    varchar(64) NOT NULL DEFAULT '',
    trigger_at    datetime   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    running_num   int         NOT NULL DEFAULT 0,
    finish_num    int         NOT NULL DEFAULT 0,
    max_count_num int         NOT NULL DEFAULT 0,
    suspend_num   int         NOT NULL DEFAULT 0,
    create_dt     datetime   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt     datetime   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_sj_retry_summary_01 ON sj_retry_summary (namespace_id, group_name, scene_name, trigger_at);

CREATE INDEX idx_sj_retry_summary_01 ON sj_retry_summary (trigger_at);

-- 列注释: sj_retry_summary.id = 主键
-- 列注释: sj_retry_summary.namespace_id = 命名空间id
-- 列注释: sj_retry_summary.group_name = 组名称
-- 列注释: sj_retry_summary.scene_name = 场景名称
-- 列注释: sj_retry_summary.trigger_at = 统计时间
-- 列注释: sj_retry_summary.running_num = 重试中-日志数量
-- 列注释: sj_retry_summary.finish_num = 重试完成-日志数量
-- 列注释: sj_retry_summary.max_count_num = 重试到达最大次数-日志数量
-- 列注释: sj_retry_summary.suspend_num = 暂停重试-日志数量
-- 列注释: sj_retry_summary.create_dt = 创建时间
-- 列注释: sj_retry_summary.update_dt = 修改时间
-- 表注释: sj_retry_summary = DashBoard_Retry

-- sj_workflow
CREATE TABLE sj_workflow
(
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    workflow_name    varchar(64)  NOT NULL,
    namespace_id     varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    biz_id           varchar(64)  NOT NULL,
    group_name       varchar(64)  NOT NULL,
    workflow_status  smallint     NOT NULL DEFAULT 1,
    trigger_type     smallint     NOT NULL,
    trigger_interval varchar(255) NOT NULL,
    next_trigger_at  bigint       NOT NULL,
    block_strategy   smallint     NOT NULL DEFAULT 1,
    executor_timeout int          NOT NULL DEFAULT 0,
    description      varchar(256) NOT NULL DEFAULT '',
    flow_info        text         NULL     DEFAULT NULL,
    wf_context       text         NULL     DEFAULT NULL,
    notify_ids       varchar(128) NOT NULL DEFAULT '',
    bucket_index     int          NOT NULL DEFAULT 0,
    version          int          NOT NULL,
    owner_id         bigint       NULL     DEFAULT NULL,
    ext_attrs        varchar(256) NULL     DEFAULT '',
    deleted          smallint     NOT NULL DEFAULT 0,
    create_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt        datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_workflow_01 ON sj_workflow (create_dt);
CREATE INDEX idx_sj_workflow_02 ON sj_workflow (namespace_id, group_name);
CREATE UNIQUE INDEX uk_sj_workflow_01 ON sj_workflow (namespace_id, biz_id);

-- 列注释: sj_workflow.id = 主键
-- 列注释: sj_workflow.workflow_name = 工作流名称
-- 列注释: sj_workflow.namespace_id = 命名空间id
-- 列注释: sj_workflow.biz_id = 业务ID
-- 列注释: sj_workflow.group_name = 组名称
-- 列注释: sj_workflow.workflow_status = 工作流状态 0、关闭、1、开启
-- 列注释: sj_workflow.trigger_type = 触发类型 1.CRON 表达式 2. 固定时间
-- 列注释: sj_workflow.trigger_interval = 间隔时长
-- 列注释: sj_workflow.next_trigger_at = 下次触发时间
-- 列注释: sj_workflow.block_strategy = 阻塞策略 1、丢弃 2、覆盖 3、并行
-- 列注释: sj_workflow.executor_timeout = 任务执行超时时间，单位秒
-- 列注释: sj_workflow.description = 描述
-- 列注释: sj_workflow.flow_info = 流程信息
-- 列注释: sj_workflow.wf_context = 上下文
-- 列注释: sj_workflow.notify_ids = 通知告警场景配置id列表
-- 列注释: sj_workflow.bucket_index = bucket
-- 列注释: sj_workflow.version = 版本号
-- 列注释: sj_workflow.owner_id = 负责人id
-- 列注释: sj_workflow.ext_attrs = 扩展字段
-- 列注释: sj_workflow.deleted = 逻辑删除 1、删除
-- 列注释: sj_workflow.create_dt = 创建时间
-- 列注释: sj_workflow.update_dt = 修改时间
-- 表注释: sj_workflow = 工作流

-- sj_workflow_node
CREATE TABLE sj_workflow_node
(
    id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id         varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    node_name            varchar(64)  NOT NULL,
    group_name           varchar(64)  NOT NULL,
    job_id               bigint       NOT NULL,
    workflow_id          bigint       NOT NULL,
    node_type            smallint     NOT NULL DEFAULT 1,
    expression_type      smallint     NOT NULL DEFAULT 0,
    fail_strategy        smallint     NOT NULL DEFAULT 1,
    workflow_node_status smallint     NOT NULL DEFAULT 1,
    priority_level       int          NOT NULL DEFAULT 1,
    node_info            text         NULL     DEFAULT NULL,
    version              int          NOT NULL,
    ext_attrs            varchar(256) NULL     DEFAULT '',
    deleted              smallint     NOT NULL DEFAULT 0,
    create_dt            datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt            datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_workflow_node_01 ON sj_workflow_node (create_dt);
CREATE INDEX idx_sj_workflow_node_02 ON sj_workflow_node (namespace_id, group_name);

-- 列注释: sj_workflow_node.id = 主键
-- 列注释: sj_workflow_node.namespace_id = 命名空间id
-- 列注释: sj_workflow_node.node_name = 节点名称
-- 列注释: sj_workflow_node.group_name = 组名称
-- 列注释: sj_workflow_node.job_id = 任务信息id
-- 列注释: sj_workflow_node.workflow_id = 工作流ID
-- 列注释: sj_workflow_node.node_type = 1、任务节点 2、条件节点
-- 列注释: sj_workflow_node.expression_type = 1、SpEl、2、Aviator 3、QL
-- 列注释: sj_workflow_node.fail_strategy = 失败策略 1、跳过 2、阻塞
-- 列注释: sj_workflow_node.workflow_node_status = 工作流节点状态 0、关闭、1、开启
-- 列注释: sj_workflow_node.priority_level = 优先级
-- 列注释: sj_workflow_node.node_info = 节点信息 
-- 列注释: sj_workflow_node.version = 版本号
-- 列注释: sj_workflow_node.ext_attrs = 扩展字段
-- 列注释: sj_workflow_node.deleted = 逻辑删除 1、删除
-- 列注释: sj_workflow_node.create_dt = 创建时间
-- 列注释: sj_workflow_node.update_dt = 修改时间
-- 表注释: sj_workflow_node = 工作流节点

-- sj_workflow_task_batch
CREATE TABLE sj_workflow_task_batch
(
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id      varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name        varchar(64)  NOT NULL,
    workflow_id       bigint       NOT NULL,
    task_batch_status smallint     NOT NULL DEFAULT 0,
    operation_reason  smallint     NOT NULL DEFAULT 0,
    flow_info         text         NULL     DEFAULT NULL,
    wf_context        text         NULL     DEFAULT NULL,
    execution_at      bigint       NOT NULL DEFAULT 0,
    ext_attrs         varchar(256) NULL     DEFAULT '',
    version           int          NOT NULL DEFAULT 1,
    deleted           smallint     NOT NULL DEFAULT 0,
    create_dt         datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt         datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_workflow_task_batch_01 ON sj_workflow_task_batch (workflow_id, task_batch_status);
CREATE INDEX idx_sj_workflow_task_batch_02 ON sj_workflow_task_batch (create_dt);
CREATE INDEX idx_sj_workflow_task_batch_03 ON sj_workflow_task_batch (namespace_id, group_name);

-- 列注释: sj_workflow_task_batch.id = 主键
-- 列注释: sj_workflow_task_batch.namespace_id = 命名空间id
-- 列注释: sj_workflow_task_batch.group_name = 组名称
-- 列注释: sj_workflow_task_batch.workflow_id = 工作流任务id
-- 列注释: sj_workflow_task_batch.task_batch_status = 任务批次状态 0、失败 1、成功
-- 列注释: sj_workflow_task_batch.operation_reason = 操作原因
-- 列注释: sj_workflow_task_batch.flow_info = 流程信息
-- 列注释: sj_workflow_task_batch.wf_context = 全局上下文
-- 列注释: sj_workflow_task_batch.execution_at = 任务执行时间
-- 列注释: sj_workflow_task_batch.ext_attrs = 扩展字段
-- 列注释: sj_workflow_task_batch.version = 版本号
-- 列注释: sj_workflow_task_batch.deleted = 逻辑删除 1、删除
-- 列注释: sj_workflow_task_batch.create_dt = 创建时间
-- 列注释: sj_workflow_task_batch.update_dt = 修改时间
-- 表注释: sj_workflow_task_batch = 工作流批次

-- sj_job_executor
CREATE TABLE sj_job_executor
(
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    namespace_id  varchar(64)  NOT NULL DEFAULT '764d604ec6fc45f68cd92514c40e9e1a',
    group_name    varchar(64)  NOT NULL,
    executor_info varchar(256) NOT NULL,
    executor_type varchar(3)   NOT NULL,
    create_dt     datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt     datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sj_job_executor_01 ON sj_job_executor (namespace_id, group_name);
CREATE INDEX idx_sj_job_executor_02 ON sj_job_executor (create_dt);

-- 列注释: sj_job_executor.id = 主键
-- 列注释: sj_job_executor.namespace_id = 命名空间id
-- 列注释: sj_job_executor.group_name = 组名称
-- 列注释: sj_job_executor.executor_info = 任务执行器名称
-- 列注释: sj_job_executor.executor_type = 1:java 2:python 3:go
-- 列注释: sj_job_executor.create_dt = 创建时间
-- 列注释: sj_job_executor.update_dt = 修改时间
-- 表注释: sj_job_executor = 任务执行器信息

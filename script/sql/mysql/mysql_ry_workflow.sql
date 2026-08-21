CREATE TABLE flow_definition
(
    id              BIGINT         NOT NULL,
    flow_code       varchar(40)  NOT NULL,
    flow_name       varchar(100) NOT NULL,
    model_value     varchar(40)  NOT NULL DEFAULT 'CLASSICS',
    category        varchar(100) NULL,
    `version`       varchar(20)  NOT NULL,
    is_publish      SMALLINT         NOT NULL DEFAULT 0,
    form_custom     CHAR(1)    NULL     DEFAULT 'N',
    form_path       varchar(100) NULL,
    activity_status SMALLINT         NOT NULL DEFAULT 1,
    listener_type   varchar(100) NULL,
    listener_path   varchar(400) NULL,
    ext             varchar(500) NULL,
    create_time     datetime    NULL,
    create_by       varchar(64)  NULL     DEFAULT '',
    update_time     datetime    NULL,
    update_by       varchar(64)  NULL     DEFAULT '',
    del_flag        CHAR(1)    NULL     DEFAULT '0',
    tenant_id       varchar(40)  NULL,
    CONSTRAINT flow_definition_pkey PRIMARY KEY (id)
);
-- 表注释: flow_definition = 流程定义表

-- 列注释: flow_definition.id = 主键id
-- 列注释: flow_definition.flow_code = 流程编码
-- 列注释: flow_definition.flow_name = 流程名称
-- 列注释: flow_definition.model_value = 设计器模型（CLASSICS经典模型 MIMIC仿钉钉模型）
-- 列注释: flow_definition.category = 流程类别
-- 列注释: flow_definition.version = 流程版本
-- 列注释: flow_definition.is_publish = 是否发布（0未发布 1已发布 9失效）
-- 列注释: flow_definition.form_custom = 审批表单是否自定义（Y是 N否）
-- 列注释: flow_definition.form_path = 审批表单路径
-- 列注释: flow_definition.activity_status = 流程激活状态（0挂起 1激活）
-- 列注释: flow_definition.listener_type = 监听器类型
-- 列注释: flow_definition.listener_path = 监听器路径
-- 列注释: flow_definition.ext = 扩展字段，预留给业务系统使用
-- 列注释: flow_definition.create_time = 创建时间
-- 列注释: flow_definition.create_by = 创建人
-- 列注释: flow_definition.update_time = 更新时间
-- 列注释: flow_definition.update_by = 更新人
-- 列注释: flow_definition.del_flag = 删除标志
-- 列注释: flow_definition.tenant_id = 租户id

CREATE TABLE flow_node
(
    id              BIGINT          NOT NULL,
    node_type       SMALLINT          NOT NULL,
    definition_id   BIGINT          NOT NULL,
    node_code       varchar(100)  NOT NULL,
    node_name       varchar(100)  NULL,
    permission_flag varchar(200)  NULL,
    node_ratio      varchar(200)  NULL,
    coordinate      varchar(100)  NULL,
    any_node_skip   varchar(100)  NULL,
    listener_type   varchar(100)  NULL,
    listener_path   varchar(400)  NULL,
    form_custom     CHAR(1)     NULL DEFAULT 'N',
    form_path       varchar(100)  NULL,
    `version`       varchar(20)   NOT NULL,
    create_time     datetime    NULL,
    create_by       varchar(64)  NULL DEFAULT '',
    update_time     datetime    NULL,
    update_by       varchar(64)  NULL DEFAULT '',
    ext             text         NULL,
    del_flag        CHAR(1)     NULL DEFAULT '0',
    tenant_id       varchar(40)   NULL,
    CONSTRAINT flow_node_pkey PRIMARY KEY (id)
);
-- 表注释: flow_node = 流程节点表

-- 列注释: flow_node.id = 主键id
-- 列注释: flow_node.node_type = 节点类型（0开始节点 1中间节点 2结束节点 3互斥网关 4并行网关）
-- 列注释: flow_node.definition_id = 流程定义id
-- 列注释: flow_node.node_code = 流程节点编码
-- 列注释: flow_node.node_name = 流程节点名称
-- 列注释: flow_node.permission_flag = 权限标识（权限类型:权限标识，可以多个，用@@隔开)
-- 列注释: flow_node.node_ratio = 流程签署比例值
-- 列注释: flow_node.coordinate = 坐标
-- 列注释: flow_node.any_node_skip = 任意结点跳转
-- 列注释: flow_node.listener_type = 监听器类型
-- 列注释: flow_node.listener_path = 监听器路径
-- 列注释: flow_node.form_custom = 审批表单是否自定义（Y是 N否）
-- 列注释: flow_node.form_path = 审批表单路径
-- 列注释: flow_node.version = 版本
-- 列注释: flow_node.create_time = 创建时间
-- 列注释: flow_node.create_by = 创建人
-- 列注释: flow_node.update_time = 更新时间
-- 列注释: flow_node.update_by = 更新人
-- 列注释: flow_node.ext = 节点扩展属性
-- 列注释: flow_node.del_flag = 删除标志
-- 列注释: flow_node.tenant_id = 租户id


CREATE TABLE flow_skip
(
    id             BIGINT         NOT NULL,
    definition_id  BIGINT         NOT NULL,
    now_node_code  varchar(100) NOT NULL,
    now_node_type  SMALLINT         NULL,
    next_node_code varchar(100) NOT NULL,
    next_node_type SMALLINT         NULL,
    skip_name      varchar(100) NULL,
    skip_type      varchar(40)  NULL,
    skip_condition varchar(200) NULL,
    coordinate     varchar(100) NULL,
    create_time    datetime    NULL,
    create_by      varchar(64)  NULL DEFAULT '',
    update_time    datetime    NULL,
    update_by      varchar(64)  NULL DEFAULT '',
    del_flag       CHAR(1)    NULL DEFAULT '0',
    tenant_id      varchar(40)  NULL,
    CONSTRAINT flow_skip_pkey PRIMARY KEY (id)
);
-- 表注释: flow_skip = 节点跳转关联表

-- 列注释: flow_skip.id = 主键id
-- 列注释: flow_skip.definition_id = 流程定义id
-- 列注释: flow_skip.now_node_code = 当前流程节点的编码
-- 列注释: flow_skip.now_node_type = 当前节点类型（0开始节点 1中间节点 2结束节点 3互斥网关 4并行网关）
-- 列注释: flow_skip.next_node_code = 下一个流程节点的编码
-- 列注释: flow_skip.next_node_type = 下一个节点类型（0开始节点 1中间节点 2结束节点 3互斥网关 4并行网关）
-- 列注释: flow_skip.skip_name = 跳转名称
-- 列注释: flow_skip.skip_type = 跳转类型（PASS审批通过 REJECT退回）
-- 列注释: flow_skip.skip_condition = 跳转条件
-- 列注释: flow_skip.coordinate = 坐标
-- 列注释: flow_skip.create_time = 创建时间
-- 列注释: flow_skip.create_by = 创建人
-- 列注释: flow_skip.update_time = 更新时间
-- 列注释: flow_skip.update_by = 更新人
-- 列注释: flow_skip.del_flag = 删除标志
-- 列注释: flow_skip.tenant_id = 租户id

CREATE TABLE flow_instance
(
    id              BIGINT         NOT NULL,
    definition_id   BIGINT         NOT NULL,
    business_id     varchar(40)  NOT NULL,
    node_type       SMALLINT         NOT NULL,
    node_code       varchar(40)  NOT NULL,
    node_name       varchar(100) NULL,
    variable        text         NULL,
    flow_status     varchar(20)  NOT NULL,
    activity_status SMALLINT         NOT NULL DEFAULT 1,
    def_json        text         NULL,
    create_time     datetime    NULL,
    create_by       varchar(64)  NULL DEFAULT '',
    update_time     datetime    NULL,
    update_by       varchar(64)  NULL DEFAULT '',
    ext             varchar(500) NULL,
    del_flag        CHAR(1)    NULL     DEFAULT '0',
    tenant_id       varchar(40)  NULL,
    CONSTRAINT flow_instance_pkey PRIMARY KEY (id)
);
-- 表注释: flow_instance = 流程实例表

-- 列注释: flow_instance.id = 主键id
-- 列注释: flow_instance.definition_id = 对应flow_definition表的id
-- 列注释: flow_instance.business_id = 业务id
-- 列注释: flow_instance.node_type = 节点类型（0开始节点 1中间节点 2结束节点 3互斥网关 4并行网关）
-- 列注释: flow_instance.node_code = 流程节点编码
-- 列注释: flow_instance.node_name = 流程节点名称
-- 列注释: flow_instance.variable = 任务变量
-- 列注释: flow_instance.flow_status = 流程状态（0待提交 1审批中 2审批通过 4终止 5作废 6撤销 8已完成 9已退回 10失效 11拿回）
-- 列注释: flow_instance.activity_status = 流程激活状态（0挂起 1激活）
-- 列注释: flow_instance.def_json = 流程定义json
-- 列注释: flow_instance.create_time = 创建时间
-- 列注释: flow_instance.create_by = 创建人
-- 列注释: flow_instance.update_time = 更新时间
-- 列注释: flow_instance.update_by = 更新人
-- 列注释: flow_instance.ext = 扩展字段，预留给业务系统使用
-- 列注释: flow_instance.del_flag = 删除标志
-- 列注释: flow_instance.tenant_id = 租户id

CREATE TABLE flow_task
(
    id            BIGINT         NOT NULL,
    definition_id BIGINT         NOT NULL,
    instance_id   BIGINT         NOT NULL,
    node_code     varchar(100) NOT NULL,
    node_name     varchar(100) NULL,
    node_type     SMALLINT         NOT NULL,
    flow_status   varchar(20)  NOT NULL,
    form_custom   CHAR(1)    NULL DEFAULT 'N',
    form_path     varchar(100) NULL,
    create_time   datetime    NULL,
    create_by     varchar(64)  NULL DEFAULT '',
    update_time   datetime    NULL,
    update_by     varchar(64)  NULL DEFAULT '',
    del_flag      CHAR(1)    NULL DEFAULT '0',
    tenant_id     varchar(40)  NULL,
    CONSTRAINT flow_task_pkey PRIMARY KEY (id)
);
-- 表注释: flow_task = 待办任务表

-- 列注释: flow_task.id = 主键id
-- 列注释: flow_task.definition_id = 对应flow_definition表的id
-- 列注释: flow_task.instance_id = 对应flow_instance表的id
-- 列注释: flow_task.node_code = 节点编码
-- 列注释: flow_task.node_name = 节点名称
-- 列注释: flow_task.node_type = 节点类型（0开始节点 1中间节点 2结束节点 3互斥网关 4并行网关）
-- 列注释: flow_task.flow_status = 流程状态（0待提交 1审批中 2审批通过 4终止 5作废 6撤销 8已完成 9已退回 10失效 11拿回）
-- 列注释: flow_task.form_custom = 审批表单是否自定义（Y是 N否）
-- 列注释: flow_task.form_path = 审批表单路径
-- 列注释: flow_task.create_time = 创建时间
-- 列注释: flow_task.create_by = 创建人
-- 列注释: flow_task.update_time = 更新时间
-- 列注释: flow_task.update_by = 更新人
-- 列注释: flow_task.del_flag = 删除标志
-- 列注释: flow_task.tenant_id = 租户id

CREATE TABLE flow_his_task
(
    id               BIGINT         NOT NULL,
    definition_id    BIGINT         NOT NULL,
    instance_id      BIGINT         NOT NULL,
    task_id          BIGINT         NOT NULL,
    node_code        varchar(100) NULL,
    node_name        varchar(100) NULL,
    node_type        SMALLINT         NULL,
    target_node_code varchar(200) NULL,
    target_node_name varchar(200) NULL,
    approver         varchar(40)  NULL,
    cooperate_type   SMALLINT         NOT NULL DEFAULT 0,
    collaborator     varchar(500)  NULL,
    skip_type        varchar(10)  NULL,
    flow_status      varchar(20)  NOT NULL,
    form_custom      CHAR(1)    NULL     DEFAULT 'N',
    form_path        varchar(100) NULL,
    ext              text         NULL,
    message          varchar(500) NULL,
    variable         text         NULL,
    create_time      datetime    NULL,
    update_time      datetime    NULL,
    del_flag         CHAR(1)    NULL     DEFAULT '0',
    tenant_id        varchar(40)  NULL,
    CONSTRAINT flow_his_task_pkey PRIMARY KEY (id)
);
-- 表注释: flow_his_task = 历史任务记录表

-- 列注释: flow_his_task.id = 主键id
-- 列注释: flow_his_task.definition_id = 对应flow_definition表的id
-- 列注释: flow_his_task.instance_id = 对应flow_instance表的id
-- 列注释: flow_his_task.task_id = 对应flow_task表的id
-- 列注释: flow_his_task.node_code = 开始节点编码
-- 列注释: flow_his_task.node_name = 开始节点名称
-- 列注释: flow_his_task.node_type = 开始节点类型（0开始节点 1中间节点 2结束节点 3互斥网关 4并行网关）
-- 列注释: flow_his_task.target_node_code = 目标节点编码
-- 列注释: flow_his_task.target_node_name = 结束节点名称
-- 列注释: flow_his_task.approver = 审批者
-- 列注释: flow_his_task.cooperate_type = 协作方式(1审批 2转办 3委派 4会签 5票签 6加签 7减签)
-- 列注释: flow_his_task.collaborator = 协作人
-- 列注释: flow_his_task.skip_type = 流转类型（PASS通过 REJECT退回 NONE无动作）
-- 列注释: flow_his_task.flow_status = 流程状态（0待提交 1审批中 2审批通过 4终止 5作废 6撤销 8已完成 9已退回 10失效 11拿回）
-- 列注释: flow_his_task.form_custom = 审批表单是否自定义（Y是 N否）
-- 列注释: flow_his_task.form_path = 审批表单路径
-- 列注释: flow_his_task.message = 审批意见
-- 列注释: flow_his_task.variable = 任务变量
-- 列注释: flow_his_task.ext = 扩展字段，预留给业务系统使用
-- 列注释: flow_his_task.create_time = 任务开始时间
-- 列注释: flow_his_task.update_time = 审批完成时间
-- 列注释: flow_his_task.del_flag = 删除标志
-- 列注释: flow_his_task.tenant_id = 租户id

CREATE TABLE flow_user
(
    id           BIGINT        NOT NULL,
    `type`       CHAR(1)   NOT NULL,
    processed_by varchar(80) NULL,
    associated   BIGINT        NOT NULL,
    create_time  datetime   NULL,
    create_by    varchar(64)  NULL     DEFAULT '',
    update_time  datetime   NULL,
    update_by    varchar(64)  NULL DEFAULT '',
    del_flag     CHAR(1)   NULL DEFAULT '0',
    tenant_id    varchar(40) NULL,
    CONSTRAINT flow_user_pk PRIMARY KEY (id)
);
CREATE INDEX user_processed_type ON flow_user (processed_by, type);
CREATE INDEX user_associated_idx ON flow_user (associated);
-- 表注释: flow_user = 流程用户表

-- 列注释: flow_user.id = 主键id
-- 列注释: flow_user.type = 人员类型（1待办任务的审批人权限 2待办任务的转办人权限 3待办任务的委托人权限）
-- 列注释: flow_user.processed_by = 权限人
-- 列注释: flow_user.associated = 任务表id
-- 列注释: flow_user.create_time = 创建时间
-- 列注释: flow_user.create_by = 创建人
-- 列注释: flow_user.update_time = 更新时间
-- 列注释: flow_user.update_by = 更新人
-- 列注释: flow_user.del_flag = 删除标志
-- 列注释: flow_user.tenant_id = 租户id

-- ----------------------------
-- 流程分类表
-- ----------------------------
CREATE TABLE flow_category
(
    category_id   BIGINT         NOT NULL,
    parent_id     BIGINT         DEFAULT 0,
    ancestors     VARCHAR(500) DEFAULT '',
    category_name VARCHAR(30)  NOT NULL,
    order_num     INT          DEFAULT 0,
    del_flag      CHAR         DEFAULT '0',
    create_dept   BIGINT,
    create_by     BIGINT,
    create_time   TIMESTAMP,
    update_by     BIGINT,
    update_time   TIMESTAMP,
    PRIMARY KEY (category_id)
);

-- 表注释: flow_category = 流程分类
-- 列注释: flow_category.category_id = 流程分类ID
-- 列注释: flow_category.parent_id = 父流程分类id
-- 列注释: flow_category.ancestors = 祖级列表
-- 列注释: flow_category.category_name = 流程分类名称
-- 列注释: flow_category.order_num = 显示顺序
-- 列注释: flow_category.del_flag = 删除标志（0代表存在 1代表删除）
-- 列注释: flow_category.create_dept = 创建部门
-- 列注释: flow_category.create_by = 创建者
-- 列注释: flow_category.create_time = 创建时间
-- 列注释: flow_category.update_by = 更新者
-- 列注释: flow_category.update_time = 更新时间

INSERT INTO flow_category VALUES (1762300000000000100, 0, '0', 'OA审批', 0, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000101, 1762300000000000100, '0,1762300000000000100', '假勤管理', 0, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000102, 1762300000000000100, '0,1762300000000000100', '人事管理', 1, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000103, 1762300000000000101, '0,1762300000000000100,1762300000000000101', '请假', 0, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000104, 1762300000000000101, '0,1762300000000000100,1762300000000000101', '出差', 1, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000105, 1762300000000000101, '0,1762300000000000100,1762300000000000101', '加班', 2, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000106, 1762300000000000101, '0,1762300000000000100,1762300000000000101', '换班', 3, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000107, 1762300000000000101, '0,1762300000000000100,1762300000000000101', '外出', 4, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000108, 1762300000000000102, '0,1762300000000000100,1762300000000000102', '转正', 1, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);
INSERT INTO flow_category VALUES (1762300000000000109, 1762300000000000102, '0,1762300000000000100,1762300000000000102', '离职', 2, '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL);

-- ----------------------------
-- 流程spel表达式定义表
-- ----------------------------
CREATE TABLE flow_spel (
    id BIGINT NOT NULL,
    component_name VARCHAR(255),
    method_name VARCHAR(255),
    method_params VARCHAR(255),
    view_spel VARCHAR(255),
    remark VARCHAR(255),
    status CHAR(1) DEFAULT '0',
    del_flag CHAR(1) DEFAULT '0',
    create_dept BIGINT,
    create_by BIGINT,
    create_time TIMESTAMP,
    update_by BIGINT,
    update_time TIMESTAMP,
    PRIMARY KEY (id)
);

-- 表注释: flow_spel = 流程spel表达式定义表
-- 列注释: flow_spel.id = 主键id
-- 列注释: flow_spel.component_name = 组件名称
-- 列注释: flow_spel.method_name = 方法名
-- 列注释: flow_spel.method_params = 参数
-- 列注释: flow_spel.view_spel = 预览spel表达式
-- 列注释: flow_spel.remark = 备注
-- 列注释: flow_spel.status = 状态（0正常 1停用）
-- 列注释: flow_spel.del_flag = 删除标志
-- 列注释: flow_spel.create_dept = 创建部门
-- 列注释: flow_spel.create_by = 创建者
-- 列注释: flow_spel.create_time = 创建时间
-- 列注释: flow_spel.update_by = 更新者
-- 列注释: flow_spel.update_time = 更新时间

INSERT INTO flow_spel VALUES (1762400000000000001, 'spelRuleComponent', 'selectDeptLeaderById', 'initiatorDeptId', '#{@spelRuleComponent.selectDeptLeaderById(#initiatorDeptId)}', '根据部门id获取部门负责人', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP);
INSERT INTO flow_spel VALUES (1762400000000000002, NULL, NULL, 'initiator', '${initiator}', '流程发起人', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP);

-- ----------------------------
-- 流程实例业务扩展表
-- ----------------------------
CREATE TABLE flow_instance_biz_ext (
    id             BIGINT,
    create_dept    BIGINT,
    create_by      BIGINT,
    create_time    TIMESTAMP,
    update_by      BIGINT,
    update_time    TIMESTAMP,
    business_code  VARCHAR(255),
    business_title VARCHAR(1000),
    del_flag       CHAR(1)       DEFAULT '0',
    instance_id    BIGINT,
    business_id    VARCHAR(255),
    PRIMARY KEY (id)
);

-- 表注释: flow_instance_biz_ext = 流程实例业务扩展表
-- 列注释: flow_instance_biz_ext.id = 主键id
-- 列注释: flow_instance_biz_ext.create_dept = 创建部门
-- 列注释: flow_instance_biz_ext.create_by = 创建者
-- 列注释: flow_instance_biz_ext.create_time = 创建时间
-- 列注释: flow_instance_biz_ext.update_by = 更新者
-- 列注释: flow_instance_biz_ext.update_time = 更新时间
-- 列注释: flow_instance_biz_ext.business_code = 业务编码
-- 列注释: flow_instance_biz_ext.business_title = 业务标题
-- 列注释: flow_instance_biz_ext.del_flag = 删除标志（0代表存在 1代表删除）
-- 列注释: flow_instance_biz_ext.instance_id = 流程实例Id
-- 列注释: flow_instance_biz_ext.business_id = 业务Id

-- ----------------------------
-- 请假单信息
-- ----------------------------
CREATE TABLE test_leave
(
    id          BIGINT         NOT NULL,
    apply_code  VARCHAR(50)  NOT NULL,
    leave_type  VARCHAR(255) NOT NULL,
    start_date  TIMESTAMP    NOT NULL,
    end_date    TIMESTAMP    NOT NULL,
    leave_days  SMALLINT          NOT NULL,
    remark      VARCHAR(255),
    status      VARCHAR(255),
    create_dept BIGINT,
    create_by   BIGINT,
    create_time TIMESTAMP,
    update_by   BIGINT,
    update_time TIMESTAMP,
    PRIMARY KEY (id)
);

-- 表注释: test_leave = 请假申请表
-- 列注释: test_leave.id = id
-- 列注释: test_leave.apply_code = 申请编号
-- 列注释: test_leave.leave_type = 请假类型
-- 列注释: test_leave.start_date = 开始时间
-- 列注释: test_leave.end_date = 结束时间
-- 列注释: test_leave.leave_days = 请假天数
-- 列注释: test_leave.remark = 请假原因
-- 列注释: test_leave.status = 状态
-- 列注释: test_leave.create_dept = 创建部门
-- 列注释: test_leave.create_by = 创建者
-- 列注释: test_leave.create_time = 创建时间
-- 列注释: test_leave.update_by = 更新者
-- 列注释: test_leave.update_time = 更新时间

INSERT INTO sys_menu VALUES (1761400000000011616, '工作流', 0, 6, 'workflow', '', '', 'N', 'Y', 'M', '0', '0', '', 'workflow', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011618, '我的任务', 0, 7, 'task', '', '', 'N', 'Y', 'M', '0', '0', '', 'my-task', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011619, '我的待办', 1761400000000011618, 2, 'taskWaiting', 'workflow/task/taskWaiting', '', 'N', 'N', 'C', '0', '0', '', 'waiting', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011632, '我的已办', 1761400000000011618, 3, 'taskFinish', 'workflow/task/taskFinish', '', 'N', 'N', 'C', '0', '0', '', 'finish', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011633, '我的抄送', 1761400000000011618, 4, 'taskCopyList', 'workflow/task/taskCopyList', '', 'N', 'N', 'C', '0', '0', '', 'my-copy', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011620, '流程定义', 1761400000000011616, 3, 'processDefinition', 'workflow/processDefinition/index', '', 'N', 'N', 'C', '0', '0', 'workflow:definition:list', 'process-definition', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011621, '流程实例', 1761400000000011630, 1, 'processInstance', 'workflow/processInstance/index', '', 'N', 'N', 'C', '0', '0', 'workflow:instance:list', 'tree-table', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011622, '流程分类', 1761400000000011616, 1, 'category', 'workflow/category/index', '', 'N', 'Y', 'C', '0', '0', 'workflow:category:list', 'category', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011629, '我发起的', 1761400000000011618, 1, 'myDocument', 'workflow/task/myDocument', '', 'N', 'N', 'C', '0', '0', 'workflow:instance:currentList', 'guide', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011630, '流程监控', 1761400000000011616, 4, 'processMonitor', '', '', 'N', 'Y', 'M', '0', '0', '', 'monitor', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011631, '待办任务', 1761400000000011630, 2, 'allTaskWaiting', 'workflow/task/allTaskWaiting', '', 'N', 'N', 'C', '0', '0', 'workflow:task:list', 'waiting', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011660, '待办任务修改', 1761400000000011631, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:task:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011700, '流程设计', 1761400000000011616, 5, 'design/index', 'workflow/processDefinition/design', '', 'N', 'N', 'C', '1', '0', 'workflow:leave:edit', '#', '/workflow/processDefinition', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011701, '请假申请', 1761400000000011616, 6, 'leaveEdit/index', 'workflow/leave/leaveEdit', '', 'N', 'N', 'C', '1', '0', 'workflow:leave:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

INSERT INTO sys_menu VALUES (1761400000000011623, '流程分类查询', 1761400000000011622, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:category:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011624, '流程分类新增', 1761400000000011622, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:category:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011625, '流程分类修改', 1761400000000011622, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:category:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011626, '流程分类删除', 1761400000000011622, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:category:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011627, '流程分类导出', 1761400000000011622, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:category:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

-- 流程实例管理相关按钮
INSERT INTO sys_menu VALUES (1761400000000011653, '流程实例查询', 1761400000000011621, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:instance:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011654, '流程变量查询', 1761400000000011621, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:instance:variableQuery', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011655, '流程变量修改', 1761400000000011621, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:instance:variable', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011656, '流程实例激活/挂起', 1761400000000011621, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:instance:active', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011657, '流程实例删除', 1761400000000011621, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:instance:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011658, '流程实例作废', 1761400000000011621, 6, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:instance:invalid', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011659, '流程实例撤销', 1761400000000011621, 7, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:instance:cancel', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

-- 流程定义管理相关按钮
INSERT INTO sys_menu VALUES (1761400000000011644, '流程定义查询', 1761400000000011620, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011645, '流程定义新增', 1761400000000011620, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011646, '流程定义修改', 1761400000000011620, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011647, '流程定义删除', 1761400000000011620, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011648, '流程定义导出', 1761400000000011620, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011649, '流程定义导入', 1761400000000011620, 6, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:import', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011650, '流程定义发布/取消发布', 1761400000000011620, 7, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:publish', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011651, '流程定义复制', 1761400000000011620, 8, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:copy', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011652, '流程定义激活/挂起', 1761400000000011620, 9, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:definition:active', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

INSERT INTO sys_menu VALUES (1761400000000011801, '流程表达式', 1761400000000011616, 2, 'spel', 'workflow/spel/index', '', 'N', 'Y', 'C', '0', '0', 'workflow:spel:list', 'input', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP, '流程达式定义菜单');
INSERT INTO sys_menu VALUES (1761400000000011802, '流程spel表达式定义查询', 1761400000000011801, 1, '#', '', NULL, 'N', 'Y', 'F', '0', '0', 'workflow:spel:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011803, '流程spel表达式定义新增', 1761400000000011801, 2, '#', '', NULL, 'N', 'Y', 'F', '0', '0', 'workflow:spel:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011804, '流程spel表达式定义修改', 1761400000000011801, 3, '#', '', NULL, 'N', 'Y', 'F', '0', '0', 'workflow:spel:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011805, '流程spel表达式定义删除', 1761400000000011801, 4, '#', '', NULL, 'N', 'Y', 'F', '0', '0', 'workflow:spel:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011806, '流程spel表达式定义导出', 1761400000000011801, 5, '#', '', NULL, 'N', 'Y', 'F', '0', '0', 'workflow:spel:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

INSERT INTO sys_menu VALUES (1761400000000011638, '请假申请', 1761400000000000005, 1, 'leave', 'workflow/leave/index', '', 'N', 'Y', 'C', '0', '0', 'workflow:leave:list', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '请假申请菜单');
INSERT INTO sys_menu VALUES (1761400000000011639, '请假申请查询', 1761400000000011638, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:leave:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011640, '请假申请新增', 1761400000000011638, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:leave:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011641, '请假申请修改', 1761400000000011638, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:leave:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011642, '请假申请删除', 1761400000000011638, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:leave:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
INSERT INTO sys_menu VALUES (1761400000000011643, '请假申请导出', 1761400000000011638, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'workflow:leave:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

INSERT INTO sys_dict_type VALUES (1761500000000000013, '业务状态', 'wf_business_status', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '业务状态列表');
INSERT INTO sys_dict_type VALUES (1761500000000000014, '表单类型', 'wf_form_type', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '表单类型列表');
INSERT INTO sys_dict_type VALUES (1761500000000000015, '任务状态', 'wf_task_status', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '任务状态');
INSERT INTO sys_dict_data VALUES (1761600000000000039, 1, '已撤销', 'cancel', 'wf_business_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '已撤销');
INSERT INTO sys_dict_data VALUES (1761600000000000040, 2, '草稿', 'draft', 'wf_business_status', '', 'info', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '草稿');
INSERT INTO sys_dict_data VALUES (1761600000000000041, 3, '待审核', 'waiting', 'wf_business_status', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '待审核');
INSERT INTO sys_dict_data VALUES (1761600000000000042, 4, '已完成', 'finish', 'wf_business_status', '', 'success', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '已完成');
INSERT INTO sys_dict_data VALUES (1761600000000000043, 5, '已作废', 'invalid', 'wf_business_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '已作废');
INSERT INTO sys_dict_data VALUES (1761600000000000044, 6, '已退回', 'back', 'wf_business_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '已退回');
INSERT INTO sys_dict_data VALUES (1761600000000000045, 7, '已终止', 'termination', 'wf_business_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '已终止');
INSERT INTO sys_dict_data VALUES (1761600000000000046, 1, '自定义表单', 'static', 'wf_form_type', '', 'success', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '自定义表单');
INSERT INTO sys_dict_data VALUES (1761600000000000047, 2, '动态表单', 'dynamic', 'wf_form_type', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '动态表单');
INSERT INTO sys_dict_data VALUES (1761600000000000048, 1, '撤销', 'cancel', 'wf_task_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '撤销');
INSERT INTO sys_dict_data VALUES (1761600000000000049, 2, '通过', 'pass', 'wf_task_status', '', 'success', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '通过');
INSERT INTO sys_dict_data VALUES (1761600000000000050, 3, '待审核', 'waiting', 'wf_task_status', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '待审核');
INSERT INTO sys_dict_data VALUES (1761600000000000051, 4, '作废', 'invalid', 'wf_task_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '作废');
INSERT INTO sys_dict_data VALUES (1761600000000000052, 5, '退回', 'back', 'wf_task_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '退回');
INSERT INTO sys_dict_data VALUES (1761600000000000053, 6, '终止', 'termination', 'wf_task_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '终止');
INSERT INTO sys_dict_data VALUES (1761600000000000054, 7, '转办', 'transfer', 'wf_task_status', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '转办');
INSERT INTO sys_dict_data VALUES (1761600000000000055, 8, '委托', 'depute', 'wf_task_status', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '委托');
INSERT INTO sys_dict_data VALUES (1761600000000000056, 9, '抄送', 'copy', 'wf_task_status', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '抄送');
INSERT INTO sys_dict_data VALUES (1761600000000000057, 10, '加签', 'sign', 'wf_task_status', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '加签');
INSERT INTO sys_dict_data VALUES (1761600000000000058, 11, '减签', 'sign_off', 'wf_task_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '减签');
INSERT INTO sys_dict_data VALUES (1761600000000000059, 11, '超时', 'timeout', 'wf_task_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '超时');


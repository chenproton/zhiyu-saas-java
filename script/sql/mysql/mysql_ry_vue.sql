-- ----------------------------
-- 第三方平台授权表
-- ----------------------------
create table sys_social
(
    id                 BIGINT             not null,
    user_id            BIGINT             not null,
    auth_id            varchar(255)     not null,
    source             varchar(255)     not null,
    open_id            varchar(255)     default null,
    user_name          varchar(30)      not null,
    nick_name          varchar(30)      default '',
    email              varchar(255)     default '',
    avatar             varchar(500)     default '',
    access_token       varchar(2000)    not null,
    expire_in          BIGINT             default null,
    refresh_token      varchar(2000)    default null,
    access_code        varchar(255)     default null,
    union_id           varchar(255)     default null,
    scope              varchar(255)     default null,
    token_type         varchar(255)     default null,
    id_token           varchar(2000)    default null,
    mac_algorithm      varchar(255)     default null,
    mac_key            varchar(255)     default null,
    code               varchar(255)     default null,
    oauth_token        varchar(255)     default null,
    oauth_token_secret varchar(255)     default null,
    create_dept        BIGINT,
    create_by          BIGINT,
    create_time        datetime,
    update_by          BIGINT,
    update_time        datetime,
    del_flag           char             default '0',
    constraint pk_sys_social primary key (id)
);

-- 表注释: sys_social = 社会化关系表
-- 列注释: sys_social.id = 主键
-- 列注释: sys_social.user_id = 用户ID
-- 列注释: sys_social.auth_id = 平台+平台唯一id
-- 列注释: sys_social.source = 用户来源
-- 列注释: sys_social.open_id = 平台编号唯一id
-- 列注释: sys_social.user_name = 登录账号
-- 列注释: sys_social.nick_name = 用户昵称
-- 列注释: sys_social.email = 用户邮箱
-- 列注释: sys_social.avatar = 头像地址
-- 列注释: sys_social.access_token = 用户的授权令牌
-- 列注释: sys_social.expire_in = 用户的授权令牌的有效期，部分平台可能没有
-- 列注释: sys_social.refresh_token = 刷新令牌，部分平台可能没有
-- 列注释: sys_social.access_code = 平台的授权信息，部分平台可能没有
-- 列注释: sys_social.union_id = 用户的 unionid
-- 列注释: sys_social.scope = 授予的权限，部分平台可能没有
-- 列注释: sys_social.token_type = 个别平台的授权信息，部分平台可能没有
-- 列注释: sys_social.id_token = id token，部分平台可能没有
-- 列注释: sys_social.mac_algorithm = 小米平台用户的附带属性，部分平台可能没有
-- 列注释: sys_social.mac_key = 小米平台用户的附带属性，部分平台可能没有
-- 列注释: sys_social.code = 用户的授权code，部分平台可能没有
-- 列注释: sys_social.oauth_token = Twitter平台用户的附带属性，部分平台可能没有
-- 列注释: sys_social.oauth_token_secret = Twitter平台用户的附带属性，部分平台可能没有
-- 列注释: sys_social.create_dept = 创建部门
-- 列注释: sys_social.create_by = 创建者
-- 列注释: sys_social.create_time = 创建时间
-- 列注释: sys_social.update_by = 更新者
-- 列注释: sys_social.update_time = 更新时间
-- 列注释: sys_social.del_flag = 删除标志（0代表存在 1代表删除）

-- ----------------------------
-- 1、部门表
-- ----------------------------
create table if not exists sys_dept
(
    dept_id     BIGINT,
    parent_id   BIGINT        default 0,
    ancestors   varchar(500)default '',
    dept_name   varchar(30) default '',
    dept_category varchar(100) default null,
    order_num   INT        default 0,
    leader      BIGINT        default null,
    phone       varchar(11) default null,
    email       varchar(50) default null,
    status      char        default '0',
    del_flag    char        default '0',
    create_dept BIGINT,
    create_by   BIGINT,
    create_time datetime,
    update_by   BIGINT,
    update_time datetime,
    constraint sys_dept_pk primary key (dept_id)
);

create index idx_sys_dept_parent_id ON sys_dept (parent_id);

-- 表注释: sys_dept = 部门表
-- 列注释: sys_dept.dept_id = 部门ID
-- 列注释: sys_dept.parent_id = 父部门ID
-- 列注释: sys_dept.ancestors = 祖级列表
-- 列注释: sys_dept.dept_name = 部门名称
-- 列注释: sys_dept.dept_category = 部门类别编码
-- 列注释: sys_dept.order_num = 显示顺序
-- 列注释: sys_dept.leader = 负责人
-- 列注释: sys_dept.phone = 联系电话
-- 列注释: sys_dept.email = 邮箱
-- 列注释: sys_dept.status = 部门状态（0正常 1停用）
-- 列注释: sys_dept.del_flag = 删除标志（0代表存在 1代表删除）
-- 列注释: sys_dept.create_dept = 创建部门
-- 列注释: sys_dept.create_by = 创建者
-- 列注释: sys_dept.create_time = 创建时间
-- 列注释: sys_dept.update_by = 更新者
-- 列注释: sys_dept.update_time = 更新时间

-- ----------------------------
-- 初始化-部门表数据
-- ----------------------------
insert into sys_dept values(1761000000000000100, 0, '0', 'XXX科技', null, 0, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000101, 1761000000000000100, '0,1761000000000000100', '深圳总公司', null, 1, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000102, 1761000000000000100, '0,1761000000000000100', '长沙分公司', null, 2, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000103, 1761000000000000101, '0,1761000000000000100,1761000000000000101', '研发部门', null, 1, 1761100000000000001, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000104, 1761000000000000101, '0,1761000000000000100,1761000000000000101', '市场部门', null, 2, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000105, 1761000000000000101, '0,1761000000000000100,1761000000000000101', '测试部门', null, 3, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000106, 1761000000000000101, '0,1761000000000000100,1761000000000000101', '财务部门', null, 4, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000107, 1761000000000000101, '0,1761000000000000100,1761000000000000101', '运维部门', null, 5, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000108, 1761000000000000102, '0,1761000000000000100,1761000000000000102', '市场部门', null, 1, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);
insert into sys_dept values(1761000000000000109, 1761000000000000102, '0,1761000000000000100,1761000000000000102', '财务部门', null, 2, null, '15888888888', 'xxx@qq.com', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null);

-- ----------------------------
-- 2、用户信息表
-- ----------------------------
create table if not exists sys_user
(
    user_id     BIGINT,
    dept_id     BIGINT,
    user_name   varchar(30)  not null,
    nick_name   varchar(30)  not null,
    user_type   varchar(10)  default 'sys_user',
    email       varchar(50)  default '',
    phone_number varchar(11) default '',
    gender      char         default '0',
    avatar      BIGINT,
    password    varchar(100) default '',
    status      char         default '0',
    del_flag    char         default '0',
    login_ip    varchar(128) default '',
    login_date  datetime,
    create_dept BIGINT,
    create_by   BIGINT,
    create_time datetime,
    update_by   BIGINT,
    update_time datetime,
    remark      varchar(500) default null,
    constraint sys_user_pk primary key (user_id)
);

create index idx_sys_user_dept_id ON sys_user (dept_id);
create index idx_sys_user_create_by ON sys_user (create_by);
create index idx_sys_user_user_name ON sys_user (user_name);
create index idx_sys_user_phone ON sys_user (phone_number);

-- 表注释: sys_user = 用户信息表
-- 列注释: sys_user.user_id = 用户ID
-- 列注释: sys_user.dept_id = 部门ID
-- 列注释: sys_user.user_name = 用户账号
-- 列注释: sys_user.nick_name = 用户昵称
-- 列注释: sys_user.user_type = 用户类型（sys_user系统用户）
-- 列注释: sys_user.email = 用户邮箱
-- 列注释: sys_user.phone_number = 手机号码
-- 列注释: sys_user.gender = 用户性别（0男 1女 2未知）
-- 列注释: sys_user.avatar = 头像地址
-- 列注释: sys_user.password = 密码
-- 列注释: sys_user.status = 账号状态（0正常 1停用）
-- 列注释: sys_user.del_flag = 删除标志（0代表存在 1代表删除）
-- 列注释: sys_user.login_ip = 最后登陆IP
-- 列注释: sys_user.login_date = 最后登陆时间
-- 列注释: sys_user.create_dept = 创建部门
-- 列注释: sys_user.create_by = 创建者
-- 列注释: sys_user.create_time = 创建时间
-- 列注释: sys_user.update_by = 更新者
-- 列注释: sys_user.update_time = 更新时间
-- 列注释: sys_user.remark = 备注

-- ----------------------------

-- 初始化-用户信息表数据
-- ----------------------------
insert into sys_user values(1761100000000000001, 1761000000000000103, 'admin', '疯狂的狮子Li', 'sys_user', 'crazyLionLi@163.com', '15888888888', '1', null, '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '0', '0', '127.0.0.1', CURRENT_TIMESTAMP, 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '管理员');
insert into sys_user VALUES(1761100000000000003, 1761000000000000108, 'test', '本部门及以下 密码666666', 'sys_user', '', '', '0', null, '$2a$10$b8yUzN0C71sbz.PhNOCgJe.Tu1yWC3RNrTyjSQ8p1W0.aaUXUJ.Ne', '0', '0', '127.0.0.1', CURRENT_TIMESTAMP, 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000003, CURRENT_TIMESTAMP, NULL);
insert into sys_user VALUES(1761100000000000004, 1761000000000000102, 'test1', '仅本人 密码666666', 'sys_user', '', '', '0', null, '$2a$10$b8yUzN0C71sbz.PhNOCgJe.Tu1yWC3RNrTyjSQ8p1W0.aaUXUJ.Ne', '0', '0', '127.0.0.1', CURRENT_TIMESTAMP, 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000004, CURRENT_TIMESTAMP, NULL);

-- ----------------------------
-- 3、岗位信息表
-- ----------------------------
create table if not exists sys_post
(
    post_id     BIGINT,
    dept_id     BIGINT,
    post_code   varchar(64) not null,
    post_category   varchar(100) default null,
    post_name   varchar(50) not null,
    post_sort   INT        not null,
    status      char        not null,
    del_flag    char        default '0',
    create_dept BIGINT,
    create_by   BIGINT,
    create_time datetime,
    update_by   BIGINT,
    update_time datetime,
    remark      varchar(500) default null,
    constraint sys_post_pk primary key (post_id)
);

create index idx_sys_post_dept_id ON sys_post (dept_id);

-- 表注释: sys_post = 岗位信息表
-- 列注释: sys_post.post_id = 岗位ID
-- 列注释: sys_post.dept_id = 部门id
-- 列注释: sys_post.post_code = 岗位编码
-- 列注释: sys_post.post_category = 岗位类别编码
-- 列注释: sys_post.post_name = 岗位名称
-- 列注释: sys_post.post_sort = 显示顺序
-- 列注释: sys_post.status = 状态（0正常 1停用）
-- 列注释: sys_post.del_flag = 删除标志（0代表存在 1代表删除）
-- 列注释: sys_post.create_dept = 创建部门
-- 列注释: sys_post.create_by = 创建者
-- 列注释: sys_post.create_time = 创建时间
-- 列注释: sys_post.update_by = 更新者
-- 列注释: sys_post.update_time = 更新时间
-- 列注释: sys_post.remark = 备注

-- ----------------------------
-- 初始化-岗位信息表数据
-- ----------------------------
insert into sys_post values(1761200000000000001, 1761000000000000103, 'ceo', null, '董事长', 1, '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_post values(1761200000000000002, 1761000000000000100, 'se', null, '项目经理', 2, '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_post values(1761200000000000003, 1761000000000000100, 'hr', null, '人力资源', 3, '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_post values(1761200000000000004, 1761000000000000100, 'user', null, '普通员工', 4, '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');

-- ----------------------------
-- 4、角色信息表
-- ----------------------------
create table if not exists sys_role
(
    role_id             BIGINT,
    role_name           varchar(30)  not null,
    role_key            varchar(100) not null,
    role_sort           INT         not null,
    data_scope          char         default '1',
    menu_check_strictly tinyint(1)         default true,
    dept_check_strictly tinyint(1)         default true,
    status              char         not null,
    del_flag            char         default '0',
    create_dept         BIGINT,
    create_by           BIGINT,
    create_time         datetime,
    update_by           BIGINT,
    update_time         datetime,
    remark              varchar(500) default null,
    constraint sys_role_pk primary key (role_id)
);

create index idx_sys_role_create_dept ON sys_role (create_dept);
create index idx_sys_role_create_by ON sys_role (create_by);

-- 表注释: sys_role = 角色信息表
-- 列注释: sys_role.role_id = 角色ID
-- 列注释: sys_role.role_name = 角色名称
-- 列注释: sys_role.role_key = 角色权限字符串
-- 列注释: sys_role.role_sort = 显示顺序
-- 列注释: sys_role.data_scope = 数据范围（1：全部数据权限 2：自定数据权限 3：本部门数据权限 4：本部门及以下数据权限 5：仅本人数据权限 6：部门及以下或本人数据权限）
-- 列注释: sys_role.menu_check_strictly = 菜单树选择项是否关联显示
-- 列注释: sys_role.dept_check_strictly = 部门树选择项是否关联显示
-- 列注释: sys_role.status = 角色状态（0正常 1停用）
-- 列注释: sys_role.del_flag = 删除标志（0代表存在 1代表删除）
-- 列注释: sys_role.create_dept = 创建部门
-- 列注释: sys_role.create_by = 创建者
-- 列注释: sys_role.create_time = 创建时间
-- 列注释: sys_role.update_by = 更新者
-- 列注释: sys_role.update_time = 更新时间
-- 列注释: sys_role.remark = 备注

-- ----------------------------
-- 初始化-角色信息表数据
-- ----------------------------
insert into sys_role values(1761300000000000001, '超级管理员', 'superadmin', 1, '1', '1', '1', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '超级管理员');
insert into sys_role values(1761300000000000003, '本部门及以下', 'test1', 3, '4', '1', '1', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_role values(1761300000000000004, '仅本人', 'test2', 4, '5', '1', '1', '0', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');

-- ----------------------------
-- 5、菜单权限表
-- ----------------------------
create table if not exists sys_menu
(
    menu_id     BIGINT,
    menu_name   varchar(50) not null,
    parent_id   BIGINT         default 0,
    order_num   INT         default 0,
    path        varchar(200) default '',
    component   varchar(255) default null,
    query_param varchar(255) default null,
    is_frame    char         default 'N',
    is_cache    char         default 'Y',
    menu_type   char         default '',
    visible     char         default '0',
    status      char         default '0',
    perms       varchar(100) default null,
    icon        varchar(100) default '#',
    active_menu varchar(255) default '',
    ext         varchar(2000) default '',
    create_dept BIGINT,
    create_by   BIGINT,
    create_time datetime,
    update_by   BIGINT,
    update_time datetime,
    remark      varchar(500) default '',
    constraint sys_menu_pk primary key (menu_id)
);

-- 表注释: sys_menu = 菜单权限表
-- 列注释: sys_menu.menu_id = 菜单ID
-- 列注释: sys_menu.menu_name = 菜单名称
-- 列注释: sys_menu.parent_id = 父菜单ID
-- 列注释: sys_menu.order_num = 显示顺序
-- 列注释: sys_menu.path = 路由地址
-- 列注释: sys_menu.component = 组件路径
-- 列注释: sys_menu.query_param = 路由参数
-- 列注释: sys_menu.is_frame = 是否为外链（Y是 N否）
-- 列注释: sys_menu.is_cache = 是否缓存（Y缓存 N不缓存）
-- 列注释: sys_menu.menu_type = 菜单类型（M目录 C菜单 F按钮）
-- 列注释: sys_menu.visible = 显示状态（0显示 1隐藏）
-- 列注释: sys_menu.status = 菜单状态（0正常 1停用）
-- 列注释: sys_menu.perms = 权限标识
-- 列注释: sys_menu.icon = 菜单图标
-- 列注释: sys_menu.create_dept = 创建部门
-- 列注释: sys_menu.create_by = 创建者
-- 列注释: sys_menu.create_time = 创建时间
-- 列注释: sys_menu.update_by = 更新者
-- 列注释: sys_menu.update_time = 更新时间
-- 列注释: sys_menu.active_menu = 激活菜单路径
-- 列注释: sys_menu.ext = 扩展字段
-- 列注释: sys_menu.remark = 备注

-- ----------------------------
-- 初始化-菜单信息表数据
-- ----------------------------
-- 一级菜单
insert into sys_menu values(1761400000000000001, '系统管理', 0, 1, 'system', null, '', 'N', 'Y', 'M', '0', '0', '', 'system', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '系统管理目录');
insert into sys_menu values(1761400000000000002, '系统监控', 0, 3, 'monitor', null, '', 'N', 'Y', 'M', '0', '0', '', 'monitor', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '系统监控目录');
insert into sys_menu values(1761400000000000003, '系统工具', 0, 4, 'tool', null, '', 'N', 'Y', 'M', '0', '0', '', 'tool', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '系统工具目录');
insert into sys_menu values(1761400000000000005, '测试菜单', 0, 5, 'demo', null, '', 'N', 'Y', 'M', '0', '0', null, 'star', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '测试菜单');
insert into sys_menu values(1761400000000000006, 'AI会话',  0, 8, 'aichat', 'ai/chat/index', '', 'N', 'Y', 'C', '0', '0', '', 'checkbox', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, 'AI聊天菜单');
insert into sys_menu values(1761400000000000004, 'PLUS官网', 0, 9, 'https://gitee.com/dromara/RuoYi-Vue-Plus', null, '', 'Y', 'Y', 'M', '0', '0', '', 'guide', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, 'RuoYi-Vue-Plus官网地址');
-- 二级菜单
insert into sys_menu values(1761400000000000100, '用户管理', 1761400000000000001, 1, 'user', 'system/user/index', '', 'N', 'Y', 'C', '0', '0', 'system:user:list', 'user', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '用户管理菜单');
insert into sys_menu values(1761400000000000101, '角色管理', 1761400000000000001, 2, 'role', 'system/role/index', '', 'N', 'Y', 'C', '0', '0', 'system:role:list', 'peoples', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '角色管理菜单');
insert into sys_menu values(1761400000000000102, '菜单管理', 1761400000000000001, 3, 'menu', 'system/menu/index', '', 'N', 'Y', 'C', '0', '0', 'system:menu:list', 'tree-table', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '菜单管理菜单');
insert into sys_menu values(1761400000000000103, '部门管理', 1761400000000000001, 4, 'dept', 'system/dept/index', '', 'N', 'Y', 'C', '0', '0', 'system:dept:list', 'tree', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '部门管理菜单');
insert into sys_menu values(1761400000000000104, '岗位管理', 1761400000000000001, 5, 'post', 'system/post/index', '', 'N', 'Y', 'C', '0', '0', 'system:post:list', 'post', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '岗位管理菜单');
insert into sys_menu values(1761400000000000105, '字典管理', 1761400000000000001, 6, 'dict', 'system/dict/index', '', 'N', 'Y', 'C', '0', '0', 'system:dict:list', 'dict', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '字典管理菜单');
insert into sys_menu values(1761400000000000106, '参数设置', 1761400000000000001, 7, 'config', 'system/config/index', '', 'N', 'Y', 'C', '0', '0', 'system:config:list', 'edit', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '参数设置菜单');
insert into sys_menu values(1761400000000000107, '通知公告', 1761400000000000001, 8, 'notice', 'system/notice/index', '', 'N', 'Y', 'C', '0', '0', 'system:notice:list', 'message', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '通知公告菜单');
insert into sys_menu values(1761400000000000108, '日志管理', 1761400000000000001, 9, 'log', '', '', 'N', 'Y', 'M', '0', '0', '', 'log', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '日志管理菜单');
insert into sys_menu values(1761400000000000109, '在线用户', 1761400000000000002, 1, 'online', 'monitor/online/index', '', 'N', 'Y', 'C', '0', '0', 'monitor:online:list', 'online', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '在线用户菜单');
insert into sys_menu values(1761400000000000113, '缓存监控', 1761400000000000002, 5, 'cache', 'monitor/cache/index', '', 'N', 'Y', 'C', '0', '0', 'monitor:cache:list', 'redis', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '缓存监控菜单');
insert into sys_menu values(1761400000000000115, '代码生成', 1761400000000000003, 2, 'gen', 'tool/gen/index', '', 'N', 'Y', 'C', '0', '0', 'tool:gen:list', 'code', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '代码生成菜单');
insert into sys_menu values(1761400000000000123, '客户端管理', 1761400000000000001, 11, 'client', 'system/client/index', '', 'N', 'Y', 'C', '0', '0', 'system:client:list', 'international', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '客户端管理菜单');
insert into sys_menu values(1761400000000000116, '修改生成配置', 1761400000000000003, 2, 'gen-edit/index/:tableId', 'tool/gen/editTable', '', 'N', 'N', 'C', '1', '0', 'tool:gen:edit', '#', '/tool/gen', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000000130, '分配用户', 1761400000000000001, 2, 'role-auth/user/:roleId', 'system/role/authUser', '', 'N', 'N', 'C', '1', '0', 'system:role:edit', '#', '/system/role', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000000131, '分配角色', 1761400000000000001, 1, 'user-auth/role/:userId', 'system/user/authRole', '', 'N', 'N', 'C', '1', '0', 'system:user:edit', '#', '/system/user', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000000133, '文件配置管理', 1761400000000000001, 10, 'oss-config/index', 'system/oss/config', '', 'N', 'N', 'C', '1', '0', 'system:ossConfig:list', '#', '/system/oss', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');

-- springboot-admin监控
insert into sys_menu values(1761400000000000117, 'Admin监控', 1761400000000000002, 5, 'Admin', 'monitor/admin/index', '', 'N', 'Y', 'C', '0', '0', 'monitor:admin:list', 'dashboard', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, 'Admin监控菜单');
-- oss菜单
insert into sys_menu values(1761400000000000118, '文件管理', 1761400000000000001, 10, 'oss', 'system/oss/index', '', 'N', 'Y', 'C', '0', '0', 'system:oss:list', 'upload', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '文件管理菜单');
-- snail-job server控制台
insert into sys_menu values(1761400000000000120, '任务调度中心', 1761400000000000002, 6, 'snailjob', 'monitor/snailjob/index', '', 'N', 'Y', 'C', '0', '0', 'monitor:snailjob:list', 'job', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, 'SnailJob控制台菜单');
-- snail-ai server控制台
insert into sys_menu values(1761400000000000121, 'AI控制台', 1761400000000000002, 7, 'snailai', 'monitor/snailai/index', '', 'N', 'Y', 'C', '0', '0', 'monitor:snailai:list', 'checkbox', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, 'AI控制台菜单');

-- 三级菜单
insert into sys_menu values(1761400000000000500, '操作日志', 1761400000000000108, 1, 'operlog', 'monitor/operlog/index', '', 'N', 'Y', 'C', '0', '0', 'monitor:operlog:list', 'form', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '操作日志菜单');
insert into sys_menu values(1761400000000000501, '登录日志', 1761400000000000108, 2, 'logininfo', 'monitor/logininfo/index', '', 'N', 'Y', 'C', '0', '0', 'monitor:logininfo:list', 'logininfo', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '登录日志菜单');
-- 用户管理按钮
insert into sys_menu values(1761400000000001001, '用户查询', 1761400000000000100, 1, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:user:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001002, '用户新增', 1761400000000000100, 2, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:user:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001003, '用户修改', 1761400000000000100, 3, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:user:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001004, '用户删除', 1761400000000000100, 4, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:user:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001005, '用户导出', 1761400000000000100, 5, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:user:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001006, '用户导入', 1761400000000000100, 6, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:user:import', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001007, '重置密码', 1761400000000000100, 7, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:user:resetPwd', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 角色管理按钮
insert into sys_menu values(1761400000000001008, '角色查询', 1761400000000000101, 1, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:role:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001009, '角色新增', 1761400000000000101, 2, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:role:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001010, '角色修改', 1761400000000000101, 3, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:role:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001011, '角色删除', 1761400000000000101, 4, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:role:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001012, '角色导出', 1761400000000000101, 5, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:role:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 菜单管理按钮
insert into sys_menu values(1761400000000001013, '菜单查询', 1761400000000000102, 1, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:menu:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001014, '菜单新增', 1761400000000000102, 2, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:menu:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001015, '菜单修改', 1761400000000000102, 3, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:menu:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001016, '菜单删除', 1761400000000000102, 4, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:menu:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 部门管理按钮
insert into sys_menu values(1761400000000001017, '部门查询', 1761400000000000103, 1, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:dept:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001018, '部门新增', 1761400000000000103, 2, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:dept:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001019, '部门修改', 1761400000000000103, 3, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:dept:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001020, '部门删除', 1761400000000000103, 4, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:dept:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 岗位管理按钮
insert into sys_menu values(1761400000000001021, '岗位查询', 1761400000000000104, 1, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:post:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001022, '岗位新增', 1761400000000000104, 2, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:post:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001023, '岗位修改', 1761400000000000104, 3, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:post:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001024, '岗位删除', 1761400000000000104, 4, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:post:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001025, '岗位导出', 1761400000000000104, 5, '', '', '', 'N', 'Y', 'F', '0', '0', 'system:post:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 字典管理按钮
insert into sys_menu values(1761400000000001026, '字典查询', 1761400000000000105, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:dict:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001027, '字典新增', 1761400000000000105, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:dict:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001028, '字典修改', 1761400000000000105, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:dict:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001029, '字典删除', 1761400000000000105, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:dict:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001030, '字典导出', 1761400000000000105, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:dict:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 参数设置按钮
insert into sys_menu values(1761400000000001031, '参数查询', 1761400000000000106, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:config:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001032, '参数新增', 1761400000000000106, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:config:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001033, '参数修改', 1761400000000000106, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:config:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001034, '参数删除', 1761400000000000106, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:config:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001035, '参数导出', 1761400000000000106, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:config:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 通知公告按钮
insert into sys_menu values(1761400000000001036, '公告查询', 1761400000000000107, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:notice:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001037, '公告新增', 1761400000000000107, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:notice:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001038, '公告修改', 1761400000000000107, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:notice:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001039, '公告删除', 1761400000000000107, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:notice:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 操作日志按钮
insert into sys_menu values(1761400000000001040, '操作查询', 1761400000000000500, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:operlog:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001041, '操作删除', 1761400000000000500, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:operlog:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001042, '日志导出', 1761400000000000500, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:operlog:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 登录日志按钮
insert into sys_menu values(1761400000000001043, '登录查询', 1761400000000000501, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:logininfo:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001044, '登录删除', 1761400000000000501, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:logininfo:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001045, '日志导出', 1761400000000000501, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:logininfo:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001050, '账户解锁', 1761400000000000501, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:logininfo:unlock', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 在线用户按钮
insert into sys_menu values(1761400000000001046, '在线查询', 1761400000000000109, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:online:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001047, '批量强退', 1761400000000000109, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:online:batchLogout', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001048, '单条强退', 1761400000000000109, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'monitor:online:forceLogout', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 代码生成按钮
insert into sys_menu values(1761400000000001055, '生成查询', 1761400000000000115, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'tool:gen:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001056, '生成修改', 1761400000000000115, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'tool:gen:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001057, '生成删除', 1761400000000000115, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'tool:gen:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001058, '导入代码', 1761400000000000115, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'tool:gen:import', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001059, '预览代码', 1761400000000000115, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'tool:gen:preview', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001060, '生成代码', 1761400000000000115, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'tool:gen:code', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- oss相关按钮
insert into sys_menu values(1761400000000001600, '文件查询', 1761400000000000118, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:oss:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001601, '文件上传', 1761400000000000118, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:oss:upload', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001602, '文件下载', 1761400000000000118, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:oss:download', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001603, '文件删除', 1761400000000000118, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:oss:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001620, '配置列表', 1761400000000000118, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:ossConfig:list', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001621, '配置添加', 1761400000000000118, 6, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:ossConfig:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001622, '配置编辑', 1761400000000000118, 6, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:ossConfig:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001623, '配置删除', 1761400000000000118, 6, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:ossConfig:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 客户端管理按钮
insert into sys_menu values(1761400000000001061, '客户端管理查询', 1761400000000000123, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:client:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001062, '客户端管理新增', 1761400000000000123, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:client:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001063, '客户端管理修改', 1761400000000000123, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:client:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001064, '客户端管理删除', 1761400000000000123, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:client:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
insert into sys_menu values(1761400000000001065, '客户端管理导出', 1761400000000000123, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'system:client:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '');
-- 测试菜单
insert into sys_menu values(1761400000000001500, '测试单表', 1761400000000000005, 1, 'demo', 'demo/demo/index', '', 'N', 'Y', 'C', '0', '0', 'demo:demo:list', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '测试单表菜单');
insert into sys_menu values(1761400000000001501, '测试单表查询', 1761400000000001500, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:demo:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001502, '测试单表新增', 1761400000000001500, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:demo:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001503, '测试单表修改', 1761400000000001500, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:demo:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001504, '测试单表删除', 1761400000000001500, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:demo:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001505, '测试单表导出', 1761400000000001500, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:demo:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001506, '测试树表', 1761400000000000005, 1, 'tree', 'demo/tree/index', '', 'N', 'Y', 'C', '0', '0', 'demo:tree:list', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '测试树表菜单');
insert into sys_menu values(1761400000000001507, '测试树表查询', 1761400000000001506, 1, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:tree:query', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001508, '测试树表新增', 1761400000000001506, 2, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:tree:add', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001509, '测试树表修改', 1761400000000001506, 3, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:tree:edit', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001510, '测试树表删除', 1761400000000001506, 4, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:tree:remove', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');
insert into sys_menu values(1761400000000001511, '测试树表导出', 1761400000000001506, 5, '#', '', '', 'N', 'Y', 'F', '0', '0', 'demo:tree:export', '#', '', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, NULL, NULL, '');


-- ----------------------------
-- 6、用户和角色关联表  用户N-1角色
-- ----------------------------
create table if not exists sys_user_role
(
    user_id BIGINT not null,
    role_id BIGINT not null,
    constraint sys_user_role_pk primary key (user_id, role_id)
);

create index idx_sys_user_role_rid ON sys_user_role (role_id);

-- 表注释: sys_user_role = 用户和角色关联表
-- 列注释: sys_user_role.user_id = 用户ID
-- 列注释: sys_user_role.role_id = 角色ID

-- ----------------------------
-- 初始化-用户和角色关联表数据
-- ----------------------------
insert into sys_user_role values (1761100000000000001, 1761300000000000001);
insert into sys_user_role values (1761100000000000003, 1761300000000000003);
insert into sys_user_role values (1761100000000000004, 1761300000000000004);

-- ----------------------------
-- 7、角色和菜单关联表  角色1-N菜单
-- ----------------------------
create table if not exists sys_role_menu
(
    role_id BIGINT not null,
    menu_id BIGINT not null,
    constraint sys_role_menu_pk primary key (role_id, menu_id)
);

-- 表注释: sys_role_menu = 角色和菜单关联表
-- 列注释: sys_role_menu.role_id = 角色ID
-- 列注释: sys_role_menu.menu_id = 菜单ID

-- ----------------------------
-- 初始化-角色和菜单关联表数据
-- ----------------------------
insert into sys_role_menu values (1761300000000000003, 1761400000000000001);
insert into sys_role_menu values (1761300000000000003, 1761400000000000005);
insert into sys_role_menu values (1761300000000000003, 1761400000000000100);
insert into sys_role_menu values (1761300000000000003, 1761400000000000101);
insert into sys_role_menu values (1761300000000000003, 1761400000000000102);
insert into sys_role_menu values (1761300000000000003, 1761400000000000103);
insert into sys_role_menu values (1761300000000000003, 1761400000000000104);
insert into sys_role_menu values (1761300000000000003, 1761400000000000105);
insert into sys_role_menu values (1761300000000000003, 1761400000000000106);
insert into sys_role_menu values (1761300000000000003, 1761400000000000107);
insert into sys_role_menu values (1761300000000000003, 1761400000000000108);
insert into sys_role_menu values (1761300000000000003, 1761400000000000118);
insert into sys_role_menu values (1761300000000000003, 1761400000000000123);
insert into sys_role_menu values (1761300000000000003, 1761400000000000130);
insert into sys_role_menu values (1761300000000000003, 1761400000000000131);
insert into sys_role_menu values (1761300000000000003, 1761400000000000133);
insert into sys_role_menu values (1761300000000000003, 1761400000000000500);
insert into sys_role_menu values (1761300000000000003, 1761400000000000501);
insert into sys_role_menu values (1761300000000000003, 1761400000000001001);
insert into sys_role_menu values (1761300000000000003, 1761400000000001002);
insert into sys_role_menu values (1761300000000000003, 1761400000000001003);
insert into sys_role_menu values (1761300000000000003, 1761400000000001004);
insert into sys_role_menu values (1761300000000000003, 1761400000000001005);
insert into sys_role_menu values (1761300000000000003, 1761400000000001006);
insert into sys_role_menu values (1761300000000000003, 1761400000000001007);
insert into sys_role_menu values (1761300000000000003, 1761400000000001008);
insert into sys_role_menu values (1761300000000000003, 1761400000000001009);
insert into sys_role_menu values (1761300000000000003, 1761400000000001010);
insert into sys_role_menu values (1761300000000000003, 1761400000000001011);
insert into sys_role_menu values (1761300000000000003, 1761400000000001012);
insert into sys_role_menu values (1761300000000000003, 1761400000000001013);
insert into sys_role_menu values (1761300000000000003, 1761400000000001014);
insert into sys_role_menu values (1761300000000000003, 1761400000000001015);
insert into sys_role_menu values (1761300000000000003, 1761400000000001016);
insert into sys_role_menu values (1761300000000000003, 1761400000000001017);
insert into sys_role_menu values (1761300000000000003, 1761400000000001018);
insert into sys_role_menu values (1761300000000000003, 1761400000000001019);
insert into sys_role_menu values (1761300000000000003, 1761400000000001020);
insert into sys_role_menu values (1761300000000000003, 1761400000000001021);
insert into sys_role_menu values (1761300000000000003, 1761400000000001022);
insert into sys_role_menu values (1761300000000000003, 1761400000000001023);
insert into sys_role_menu values (1761300000000000003, 1761400000000001024);
insert into sys_role_menu values (1761300000000000003, 1761400000000001025);
insert into sys_role_menu values (1761300000000000003, 1761400000000001026);
insert into sys_role_menu values (1761300000000000003, 1761400000000001027);
insert into sys_role_menu values (1761300000000000003, 1761400000000001028);
insert into sys_role_menu values (1761300000000000003, 1761400000000001029);
insert into sys_role_menu values (1761300000000000003, 1761400000000001030);
insert into sys_role_menu values (1761300000000000003, 1761400000000001031);
insert into sys_role_menu values (1761300000000000003, 1761400000000001032);
insert into sys_role_menu values (1761300000000000003, 1761400000000001033);
insert into sys_role_menu values (1761300000000000003, 1761400000000001034);
insert into sys_role_menu values (1761300000000000003, 1761400000000001035);
insert into sys_role_menu values (1761300000000000003, 1761400000000001036);
insert into sys_role_menu values (1761300000000000003, 1761400000000001037);
insert into sys_role_menu values (1761300000000000003, 1761400000000001038);
insert into sys_role_menu values (1761300000000000003, 1761400000000001039);
insert into sys_role_menu values (1761300000000000003, 1761400000000001040);
insert into sys_role_menu values (1761300000000000003, 1761400000000001041);
insert into sys_role_menu values (1761300000000000003, 1761400000000001042);
insert into sys_role_menu values (1761300000000000003, 1761400000000001043);
insert into sys_role_menu values (1761300000000000003, 1761400000000001044);
insert into sys_role_menu values (1761300000000000003, 1761400000000001045);
insert into sys_role_menu values (1761300000000000003, 1761400000000001050);
insert into sys_role_menu values (1761300000000000003, 1761400000000001061);
insert into sys_role_menu values (1761300000000000003, 1761400000000001062);
insert into sys_role_menu values (1761300000000000003, 1761400000000001063);
insert into sys_role_menu values (1761300000000000003, 1761400000000001064);
insert into sys_role_menu values (1761300000000000003, 1761400000000001065);
insert into sys_role_menu values (1761300000000000003, 1761400000000001500);
insert into sys_role_menu values (1761300000000000003, 1761400000000001501);
insert into sys_role_menu values (1761300000000000003, 1761400000000001502);
insert into sys_role_menu values (1761300000000000003, 1761400000000001503);
insert into sys_role_menu values (1761300000000000003, 1761400000000001504);
insert into sys_role_menu values (1761300000000000003, 1761400000000001505);
insert into sys_role_menu values (1761300000000000003, 1761400000000001506);
insert into sys_role_menu values (1761300000000000003, 1761400000000001507);
insert into sys_role_menu values (1761300000000000003, 1761400000000001508);
insert into sys_role_menu values (1761300000000000003, 1761400000000001509);
insert into sys_role_menu values (1761300000000000003, 1761400000000001510);
insert into sys_role_menu values (1761300000000000003, 1761400000000001511);
insert into sys_role_menu values (1761300000000000003, 1761400000000001600);
insert into sys_role_menu values (1761300000000000003, 1761400000000001601);
insert into sys_role_menu values (1761300000000000003, 1761400000000001602);
insert into sys_role_menu values (1761300000000000003, 1761400000000001603);
insert into sys_role_menu values (1761300000000000003, 1761400000000001620);
insert into sys_role_menu values (1761300000000000003, 1761400000000001621);
insert into sys_role_menu values (1761300000000000003, 1761400000000001622);
insert into sys_role_menu values (1761300000000000003, 1761400000000001623);
insert into sys_role_menu values (1761300000000000003, 1761400000000011616);
insert into sys_role_menu values (1761300000000000003, 1761400000000011618);
insert into sys_role_menu values (1761300000000000003, 1761400000000011619);
insert into sys_role_menu values (1761300000000000003, 1761400000000011622);
insert into sys_role_menu values (1761300000000000003, 1761400000000011623);
insert into sys_role_menu values (1761300000000000003, 1761400000000011629);
insert into sys_role_menu values (1761300000000000003, 1761400000000011632);
insert into sys_role_menu values (1761300000000000003, 1761400000000011633);
insert into sys_role_menu values (1761300000000000003, 1761400000000011638);
insert into sys_role_menu values (1761300000000000003, 1761400000000011639);
insert into sys_role_menu values (1761300000000000003, 1761400000000011640);
insert into sys_role_menu values (1761300000000000003, 1761400000000011641);
insert into sys_role_menu values (1761300000000000003, 1761400000000011642);
insert into sys_role_menu values (1761300000000000003, 1761400000000011643);
insert into sys_role_menu values (1761300000000000003, 1761400000000011701);
insert into sys_role_menu values (1761300000000000004, 1761400000000000005);
insert into sys_role_menu values (1761300000000000004, 1761400000000001500);
insert into sys_role_menu values (1761300000000000004, 1761400000000001501);
insert into sys_role_menu values (1761300000000000004, 1761400000000001502);
insert into sys_role_menu values (1761300000000000004, 1761400000000001503);
insert into sys_role_menu values (1761300000000000004, 1761400000000001504);
insert into sys_role_menu values (1761300000000000004, 1761400000000001505);
insert into sys_role_menu values (1761300000000000004, 1761400000000001506);
insert into sys_role_menu values (1761300000000000004, 1761400000000001507);
insert into sys_role_menu values (1761300000000000004, 1761400000000001508);
insert into sys_role_menu values (1761300000000000004, 1761400000000001509);
insert into sys_role_menu values (1761300000000000004, 1761400000000001510);
insert into sys_role_menu values (1761300000000000004, 1761400000000001511);

-- ----------------------------
-- 8、角色和部门关联表  角色1-N部门
-- ----------------------------
create table if not exists sys_role_dept
(
    role_id BIGINT not null,
    dept_id BIGINT not null,
    constraint sys_role_dept_pk primary key (role_id, dept_id)
);

-- 表注释: sys_role_dept = 角色和部门关联表
-- 列注释: sys_role_dept.role_id = 角色ID
-- 列注释: sys_role_dept.dept_id = 部门ID


-- ----------------------------
-- 9、用户与岗位关联表  用户1-N岗位
-- ----------------------------
create table if not exists sys_user_post
(
    user_id BIGINT not null,
    post_id BIGINT not null,
    constraint sys_user_post_pk primary key (user_id, post_id)
);

-- 表注释: sys_user_post = 用户与岗位关联表
-- 列注释: sys_user_post.user_id = 用户ID
-- 列注释: sys_user_post.post_id = 岗位ID

-- ----------------------------
-- 初始化-用户与岗位关联表数据
-- ----------------------------
insert into sys_user_post values (1761100000000000001, 1761200000000000001);

-- ----------------------------
-- 10、操作日志记录
-- ----------------------------
create table if not exists sys_oper_log
(
    oper_id        BIGINT,
    title          varchar(50)   default '',
    business_type  INT          default 0,
    method         varchar(100)  default '',
    request_method varchar(10)   default '',
    operator_type  INT          default 0,
    oper_name      varchar(50)   default '',
    user_id        BIGINT,
    dept_id        BIGINT,
    dept_name      varchar(50)   default '',
    client_key     varchar(32)   default '',
    device_type    varchar(32)   default '',
    browser        varchar(50)   default '',
    os             varchar(50)   default '',
    oper_url       varchar(255)  default '',
    oper_ip        varchar(128)  default '',
    oper_location  varchar(255)  default '',
    oper_param     varchar(4000) default '',
    json_result    varchar(4000) default '',
    status         INT          default 0,
    error_msg      varchar(4000) default '',
    oper_time      datetime,
    cost_time      BIGINT          default 0,
    constraint sys_oper_log_pk primary key (oper_id)
);

create index idx_sys_oper_log_bt ON sys_oper_log (business_type);
create index idx_sys_oper_log_uid ON sys_oper_log (user_id);
create index idx_sys_oper_log_s ON sys_oper_log (status);
create index idx_sys_oper_log_ot ON sys_oper_log (oper_time);

-- 表注释: sys_oper_log = 操作日志记录
-- 列注释: sys_oper_log.oper_id = 日志主键
-- 列注释: sys_oper_log.title = 模块标题
-- 列注释: sys_oper_log.business_type = 业务类型（0其它 1新增 2修改 3删除）
-- 列注释: sys_oper_log.method = 方法名称
-- 列注释: sys_oper_log.request_method = 请求方式
-- 列注释: sys_oper_log.operator_type = 操作类别（0其它 1后台用户 2手机端用户）
-- 列注释: sys_oper_log.oper_name = 操作人员
-- 列注释: sys_oper_log.user_id = 操作用户ID
-- 列注释: sys_oper_log.dept_id = 操作部门ID
-- 列注释: sys_oper_log.dept_name = 部门名称
-- 列注释: sys_oper_log.client_key = 客户端
-- 列注释: sys_oper_log.device_type = 设备类型
-- 列注释: sys_oper_log.browser = 浏览器类型
-- 列注释: sys_oper_log.os = 操作系统
-- 列注释: sys_oper_log.oper_url = 请求URL
-- 列注释: sys_oper_log.oper_ip = 主机地址
-- 列注释: sys_oper_log.oper_location = 操作地点
-- 列注释: sys_oper_log.oper_param = 请求参数
-- 列注释: sys_oper_log.json_result = 返回参数
-- 列注释: sys_oper_log.status = 操作状态（0正常 1异常）
-- 列注释: sys_oper_log.error_msg = 错误消息
-- 列注释: sys_oper_log.oper_time = 操作时间
-- 列注释: sys_oper_log.cost_time = 消耗时间

-- ----------------------------
-- 11、字典类型表
-- ----------------------------
create table if not exists sys_dict_type
(
    dict_id     BIGINT,
    dict_name   varchar(100) default '',
    dict_type   varchar(100) default '',
    create_dept BIGINT,
    create_by   BIGINT,
    create_time datetime,
    update_by   BIGINT,
    update_time datetime,
    remark      varchar(500) default null,
    constraint sys_dict_type_pk primary key (dict_id)
);

create unique index sys_dict_type_index1 ON sys_dict_type (dict_type);

-- 表注释: sys_dict_type = 字典类型表
-- 列注释: sys_dict_type.dict_id = 字典主键
-- 列注释: sys_dict_type.dict_name = 字典名称
-- 列注释: sys_dict_type.dict_type = 字典类型
-- 列注释: sys_dict_type.create_dept = 创建部门
-- 列注释: sys_dict_type.create_by = 创建者
-- 列注释: sys_dict_type.create_time = 创建时间
-- 列注释: sys_dict_type.update_by = 更新者
-- 列注释: sys_dict_type.update_time = 更新时间
-- 列注释: sys_dict_type.remark = 备注

insert into sys_dict_type values(1761500000000000001, '用户性别', 'sys_user_gender', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '用户性别列表');
insert into sys_dict_type values(1761500000000000002, '菜单状态', 'sys_show_hide', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '菜单状态列表');
insert into sys_dict_type values(1761500000000000003, '系统开关', 'sys_normal_disable', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '系统开关列表');
insert into sys_dict_type values(1761500000000000006, '系统是否', 'sys_yes_no', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '系统是否列表');
insert into sys_dict_type values(1761500000000000007, '通知类型', 'sys_notice_type', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '通知类型列表');
insert into sys_dict_type values(1761500000000000008, '通知状态', 'sys_notice_status', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '通知状态列表');
insert into sys_dict_type values(1761500000000000009, '操作类型', 'sys_oper_type', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '操作类型列表');
insert into sys_dict_type values(1761500000000000010, '系统状态', 'sys_common_status', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '登录状态列表');
insert into sys_dict_type values(1761500000000000011, '授权类型', 'sys_grant_type', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '认证授权类型');
insert into sys_dict_type values(1761500000000000012, '设备类型', 'sys_device_type', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '客户端设备类型');

-- ----------------------------
-- 12、字典数据表
-- ----------------------------
create table if not exists sys_dict_data
(
    dict_code   BIGINT,
    dict_sort   INT         default 0,
    dict_label  varchar(100) default '',
    dict_value  varchar(100) default '',
    dict_type   varchar(100) default '',
    css_class   varchar(100) default null,
    list_class  varchar(100) default null,
    is_default  char         default 'N',
    create_dept BIGINT,
    create_by   BIGINT,
    create_time datetime,
    update_by   BIGINT,
    update_time datetime,
    remark      varchar(500) default null,
    constraint sys_dict_data_pk primary key (dict_code)
);

create index idx_sys_dict_data_type ON sys_dict_data (dict_type);

-- 表注释: sys_dict_data = 字典数据表
-- 列注释: sys_dict_data.dict_code = 字典编码
-- 列注释: sys_dict_data.dict_sort = 字典排序
-- 列注释: sys_dict_data.dict_label = 字典标签
-- 列注释: sys_dict_data.dict_value = 字典键值
-- 列注释: sys_dict_data.dict_type = 字典类型
-- 列注释: sys_dict_data.css_class = 样式属性（其他样式扩展）
-- 列注释: sys_dict_data.list_class = 表格回显样式
-- 列注释: sys_dict_data.is_default = 是否默认（Y是 N否）
-- 列注释: sys_dict_data.create_dept = 创建部门
-- 列注释: sys_dict_data.create_by = 创建者
-- 列注释: sys_dict_data.create_time = 创建时间
-- 列注释: sys_dict_data.update_by = 更新者
-- 列注释: sys_dict_data.update_time = 更新时间
-- 列注释: sys_dict_data.remark = 备注

insert into sys_dict_data values(1761600000000000001, 1, '男', '0', 'sys_user_gender', '', '', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '性别男');
insert into sys_dict_data values(1761600000000000002, 2, '女', '1', 'sys_user_gender', '', '', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '性别女');
insert into sys_dict_data values(1761600000000000003, 3, '未知', '2', 'sys_user_gender', '', '', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '性别未知');
insert into sys_dict_data values(1761600000000000004, 1, '显示', '0', 'sys_show_hide', '', 'primary', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '显示菜单');
insert into sys_dict_data values(1761600000000000005, 2, '隐藏', '1', 'sys_show_hide', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '隐藏菜单');
insert into sys_dict_data values(1761600000000000006, 1, '正常', '0', 'sys_normal_disable', '', 'primary', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '正常状态');
insert into sys_dict_data values(1761600000000000007, 2, '停用', '1', 'sys_normal_disable', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '停用状态');
insert into sys_dict_data values(1761600000000000012, 1, '是', 'Y', 'sys_yes_no', '', 'primary', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '系统默认是');
insert into sys_dict_data values(1761600000000000013, 2, '否', 'N', 'sys_yes_no', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '系统默认否');
insert into sys_dict_data values(1761600000000000014, 1, '通知', '1', 'sys_notice_type', '', 'warning', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '通知');
insert into sys_dict_data values(1761600000000000015, 2, '公告', '2', 'sys_notice_type', '', 'success', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '公告');
insert into sys_dict_data values(1761600000000000016, 1, '正常', '0', 'sys_notice_status', '', 'primary', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '正常状态');
insert into sys_dict_data values(1761600000000000017, 2, '关闭', '1', 'sys_notice_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '关闭状态');
insert into sys_dict_data values(1761600000000000029, 99, '其他', '0', 'sys_oper_type', '', 'info', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '其他操作');
insert into sys_dict_data values(1761600000000000018, 1, '新增', '1', 'sys_oper_type', '', 'info', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '新增操作');
insert into sys_dict_data values(1761600000000000019, 2, '修改', '2', 'sys_oper_type', '', 'info', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '修改操作');
insert into sys_dict_data values(1761600000000000020, 3, '删除', '3', 'sys_oper_type', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '删除操作');
insert into sys_dict_data values(1761600000000000021, 4, '授权', '4', 'sys_oper_type', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '授权操作');
insert into sys_dict_data values(1761600000000000022, 5, '导出', '5', 'sys_oper_type', '', 'warning', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '导出操作');
insert into sys_dict_data values(1761600000000000023, 6, '导入', '6', 'sys_oper_type', '', 'warning', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '导入操作');
insert into sys_dict_data values(1761600000000000024, 7, '强退', '7', 'sys_oper_type', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '强退操作');
insert into sys_dict_data values(1761600000000000025, 8, '生成代码', '8', 'sys_oper_type', '', 'warning', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '生成操作');
insert into sys_dict_data values(1761600000000000026, 9, '清空数据', '9', 'sys_oper_type', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '清空操作');
insert into sys_dict_data values(1761600000000000027, 1, '成功', '0', 'sys_common_status', '', 'primary', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '正常状态');
insert into sys_dict_data values(1761600000000000028, 2, '失败', '1', 'sys_common_status', '', 'danger', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '停用状态');
insert into sys_dict_data values(1761600000000000030, 0, '密码认证', 'password', 'sys_grant_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '密码认证');
insert into sys_dict_data values(1761600000000000031, 0, '短信认证', 'sms', 'sys_grant_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '短信认证');
insert into sys_dict_data values(1761600000000000032, 0, '邮件认证', 'email', 'sys_grant_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '邮件认证');
insert into sys_dict_data values(1761600000000000033, 0, '小程序认证', 'xcx', 'sys_grant_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '小程序认证');
insert into sys_dict_data values(1761600000000000034, 0, '三方登录认证', 'social', 'sys_grant_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '三方登录认证');
insert into sys_dict_data values(1761600000000000035, 0, 'PC', 'pc', 'sys_device_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, 'PC');
insert into sys_dict_data values(1761600000000000036, 0, '安卓', 'android', 'sys_device_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '安卓');
insert into sys_dict_data values(1761600000000000037, 0, 'iOS', 'ios', 'sys_device_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, 'iOS');
insert into sys_dict_data values(1761600000000000038, 0, '小程序', 'xcx', 'sys_device_type', '', 'default', 'N', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '小程序');


-- ----------------------------
-- 13、参数配置表
-- ----------------------------
create table if not exists sys_config
(
    config_id    BIGINT,
    config_name  varchar(100) default '',
    config_key   varchar(100) default '',
    config_value varchar(500) default '',
    config_type  char         default 'N',
    create_dept  BIGINT,
    create_by    BIGINT,
    create_time  datetime,
    update_by    BIGINT,
    update_time  datetime,
    remark       varchar(500) default null,
    constraint sys_config_pk primary key (config_id)
);

-- 表注释: sys_config = 参数配置表
-- 列注释: sys_config.config_id = 参数主键
-- 列注释: sys_config.config_name = 参数名称
-- 列注释: sys_config.config_key = 参数键名
-- 列注释: sys_config.config_value = 参数键值
-- 列注释: sys_config.config_type = 系统内置（Y是 N否）
-- 列注释: sys_config.create_dept = 创建部门
-- 列注释: sys_config.create_by = 创建者
-- 列注释: sys_config.create_time = 创建时间
-- 列注释: sys_config.update_by = 更新者
-- 列注释: sys_config.update_time = 更新时间
-- 列注释: sys_config.remark = 备注

insert into sys_config values(1761700000000000001, '用户管理-账号初始密码', 'sys.user.initPassword', '123456', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '初始化密码 123456');
insert into sys_config values(1761700000000000002, '账号自助-是否开启用户注册功能', 'sys.account.registerUser', 'false', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '是否开启注册用户功能（true开启，false关闭）');
insert into sys_config values(1761700000000000003, 'OSS预览列表资源开关', 'sys.oss.previewListResource', 'true', 'Y', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, 'true:开启, false:关闭');


-- ----------------------------
-- 14、系统访问记录
-- ----------------------------
create table if not exists sys_login_info
(
    info_id        BIGINT,
    user_name      varchar(50)  default '',
    client_key     varchar(32)  default '',
    device_type    varchar(32)  default '',
    ipaddr         varchar(128) default '',
    login_location varchar(255) default '',
    browser        varchar(50)  default '',
    os             varchar(50)  default '',
    status         char         default '0',
    msg            varchar(255) default '',
    login_time     datetime,
    constraint sys_login_info_pk primary key (info_id)
);

create index idx_sys_login_info_s ON sys_login_info (status);
create index idx_sys_login_info_lt ON sys_login_info (login_time);

-- 表注释: sys_login_info = 系统访问记录
-- 列注释: sys_login_info.info_id = 访问ID
-- 列注释: sys_login_info.user_name = 用户账号
-- 列注释: sys_login_info.client_key = 客户端
-- 列注释: sys_login_info.device_type = 设备类型
-- 列注释: sys_login_info.ipaddr = 登录IP地址
-- 列注释: sys_login_info.login_location = 登录地点
-- 列注释: sys_login_info.browser = 浏览器类型
-- 列注释: sys_login_info.os = 操作系统
-- 列注释: sys_login_info.status = 登录状态（0正常 1异常）
-- 列注释: sys_login_info.msg = 提示消息
-- 列注释: sys_login_info.login_time = 访问时间

-- ----------------------------
-- 17、通知公告表
-- ----------------------------
create table if not exists sys_notice
(
    notice_id      BIGINT,
    notice_title   varchar(50)  not null,
    notice_type    char         not null,
    notice_content text,
    status         char         default '0',
    create_dept    BIGINT,
    create_by      BIGINT,
    create_time    datetime,
    update_by      BIGINT,
    update_time    datetime,
    remark         varchar(255) default null,
    constraint sys_notice_pk primary key (notice_id)
);

-- 表注释: sys_notice = 通知公告表
-- 列注释: sys_notice.notice_id = 公告ID
-- 列注释: sys_notice.notice_title = 公告标题
-- 列注释: sys_notice.notice_type = 公告类型（1通知 2公告）
-- 列注释: sys_notice.notice_content = 公告内容
-- 列注释: sys_notice.status = 公告状态（0正常 1关闭）
-- 列注释: sys_notice.create_dept = 创建部门
-- 列注释: sys_notice.create_by = 创建者
-- 列注释: sys_notice.create_time = 创建时间
-- 列注释: sys_notice.update_by = 更新者
-- 列注释: sys_notice.update_time = 更新时间
-- 列注释: sys_notice.remark = 备注

-- ----------------------------
-- 初始化-公告信息表数据
-- ----------------------------
insert into sys_notice values(1761800000000000001, '温馨提醒：2018-07-01 新版本发布啦', '2', '新版本内容', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '管理员');
insert into sys_notice values(1761800000000000002, '维护通知：2018-07-01 系统凌晨维护', '1', '维护内容', '0', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, null, null, '管理员');


-- ----------------------------
-- 18、消息记录表
-- ----------------------------
create table if not exists sys_message
(
    message_id    BIGINT,
    category      varchar(20)   not null,
    type          varchar(20)   not null,
    source        varchar(20)   not null,
    title         varchar(100)  default '',
    message       varchar(500)  default '',
    content       text,
    data_json     text,
    path          varchar(500)  default null,
    send_user_ids varchar(2000) not null default '0',
    create_dept   BIGINT,
    create_by     BIGINT,
    create_time   datetime,
    update_by     BIGINT,
    update_time   datetime,
    constraint sys_message_pk primary key (message_id)
);

create index idx_sys_message_category_time on sys_message (category, create_time);

-- 表注释: sys_message = 消息记录表
-- 列注释: sys_message.message_id = 消息ID
-- 列注释: sys_message.category = 消息分组(system/notice/workflow)
-- 列注释: sys_message.type = 消息类型
-- 列注释: sys_message.source = 消息来源
-- 列注释: sys_message.title = 标题
-- 列注释: sys_message.message = 摘要消息
-- 列注释: sys_message.content = 详细内容
-- 列注释: sys_message.data_json = 扩展数据JSON
-- 列注释: sys_message.path = 前端跳转路径
-- 列注释: sys_message.send_user_ids = 目标用户ID串，0表示全局
-- 列注释: sys_message.create_dept = 创建部门
-- 列注释: sys_message.create_by = 创建者
-- 列注释: sys_message.create_time = 创建时间
-- 列注释: sys_message.update_by = 更新者
-- 列注释: sys_message.update_time = 更新时间


-- ----------------------------
-- 19、代码生成业务表
-- ----------------------------
create table if not exists gen_table
(
    table_id          BIGINT,
    data_name         varchar(200)  default '',
    table_name        varchar(200)  default '',
    table_comment     varchar(500)  default '',
    class_name        varchar(100)  default '',
    tpl_category      varchar(200)  default 'crud',
    frontend_type     varchar(50)   default 'vue',
    package_name      varchar(100)  default null,
    module_name       varchar(30)   default null,
    business_name     varchar(30)   default null,
    function_name     varchar(50)   default null,
    function_author   varchar(50)   default null,
    gen_type          char          default '0' not null,
    gen_path          varchar(200)  default '/',
    options           varchar(1000) default null,
    create_dept       BIGINT,
    create_by         BIGINT,
    create_time       datetime,
    update_by         BIGINT,
    update_time       datetime,
    remark            varchar(500)  default null,
    constraint gen_table_pk primary key (table_id)
);

-- 表注释: gen_table = 代码生成业务表
-- 列注释: gen_table.table_id = 编号
-- 列注释: gen_table.data_name = 数据源名称
-- 列注释: gen_table.table_name = 表名称
-- 列注释: gen_table.table_comment = 表描述
-- 列注释: gen_table.class_name = 实体类名称
-- 列注释: gen_table.tpl_category = 使用的模板（CRUD单表操作 TREE树表操作）
-- 列注释: gen_table.frontend_type = 前端模板类型，对应 vm 下的模板目录
-- 列注释: gen_table.package_name = 生成包路径
-- 列注释: gen_table.module_name = 生成模块名
-- 列注释: gen_table.business_name = 生成业务名
-- 列注释: gen_table.function_name = 生成功能名
-- 列注释: gen_table.function_author = 生成功能作者
-- 列注释: gen_table.gen_type = 生成代码方式（0zip压缩包 1自定义路径）
-- 列注释: gen_table.gen_path = 生成路径（不填默认项目路径）
-- 列注释: gen_table.options = 其它生成选项
-- 列注释: gen_table.create_dept = 创建部门
-- 列注释: gen_table.create_by = 创建者
-- 列注释: gen_table.create_time = 创建时间
-- 列注释: gen_table.update_by = 更新者
-- 列注释: gen_table.update_time = 更新时间
-- 列注释: gen_table.remark = 备注

-- ----------------------------
-- 20、代码生成业务表字段
-- ----------------------------
create table if not exists gen_table_column
(
    column_id      BIGINT,
    table_id       BIGINT,
    column_name    varchar(200) default null,
    column_comment varchar(500) default null,
    column_type    varchar(100) default null,
    java_type      varchar(500) default null,
    java_field     varchar(200) default null,
    is_pk          char         default null,
    is_increment   char         default null,
    is_required    char         default null,
    is_insert      char         default null,
    is_edit        char         default null,
    is_list        char         default null,
    is_query       char         default null,
    query_type     varchar(200) default 'EQ',
    html_type      varchar(200) default null,
    dict_type      varchar(200) default '',
    sort           INT,
    create_dept    BIGINT,
    create_by      BIGINT,
    create_time    datetime,
    update_by      BIGINT,
    update_time    datetime,
    constraint gen_table_column_pk primary key (column_id)
);

-- 表注释: gen_table_column = 代码生成业务表字段
-- 列注释: gen_table_column.column_id = 编号
-- 列注释: gen_table_column.table_id = 归属表编号
-- 列注释: gen_table_column.column_name = 列名称
-- 列注释: gen_table_column.column_comment = 列描述
-- 列注释: gen_table_column.column_type = 列类型
-- 列注释: gen_table_column.java_type = JAVA类型
-- 列注释: gen_table_column.java_field = JAVA字段名
-- 列注释: gen_table_column.is_pk = 是否主键（1是）
-- 列注释: gen_table_column.is_increment = 是否自增（1是）
-- 列注释: gen_table_column.is_required = 是否必填（1是）
-- 列注释: gen_table_column.is_insert = 是否为插入字段（1是）
-- 列注释: gen_table_column.is_edit = 是否编辑字段（1是）
-- 列注释: gen_table_column.is_list = 是否列表字段（1是）
-- 列注释: gen_table_column.is_query = 是否查询字段（1是）
-- 列注释: gen_table_column.query_type = 查询方式（等于、不等于、大于、小于、范围）
-- 列注释: gen_table_column.html_type = 显示类型（文本框、文本域、下拉框、复选框、单选框、日期控件）
-- 列注释: gen_table_column.dict_type = 字典类型
-- 列注释: gen_table_column.sort = 排序
-- 列注释: gen_table_column.create_dept = 创建部门
-- 列注释: gen_table_column.create_by = 创建者
-- 列注释: gen_table_column.create_time = 创建时间
-- 列注释: gen_table_column.update_by = 更新者
-- 列注释: gen_table_column.update_time = 更新时间

-- ----------------------------
-- OSS对象存储表
-- ----------------------------
create table if not exists sys_oss
(
    oss_id        BIGINT,
    file_name     varchar(255) default '' not null,
    original_name varchar(255) default '' not null,
    file_suffix   varchar(10)  default '' not null,
    url           varchar(500) default '' not null,
    ext1          varchar(500) default '',
    create_dept   BIGINT,
    create_by     BIGINT,
    create_time   datetime,
    update_by     BIGINT,
    update_time   datetime,
    service       varchar(20)  default 'minio',
    constraint sys_oss_pk primary key (oss_id)
);

-- 表注释: sys_oss = OSS对象存储表
-- 列注释: sys_oss.oss_id = 对象存储主键
-- 列注释: sys_oss.file_name = 文件名
-- 列注释: sys_oss.original_name = 原名
-- 列注释: sys_oss.file_suffix = 文件后缀名
-- 列注释: sys_oss.url = URL地址
-- 列注释: sys_oss.ext1 = 扩展字段
-- 列注释: sys_oss.create_by = 上传人
-- 列注释: sys_oss.create_dept = 创建部门
-- 列注释: sys_oss.create_time = 创建时间
-- 列注释: sys_oss.update_by = 更新者
-- 列注释: sys_oss.update_time = 更新时间
-- 列注释: sys_oss.service = 服务商

-- ----------------------------
-- OSS对象存储动态配置表
-- ----------------------------
create table if not exists sys_oss_config
(
    oss_config_id BIGINT,
    config_key    varchar(20)  default '' not null,
    access_key    varchar(255) default '',
    secret_key    varchar(255) default '',
    bucket_name   varchar(255) default '',
    prefix        varchar(255) default '',
    endpoint      varchar(255) default '',
    domain_url    varchar(255) default '',
    is_https      char         default 'N',
    region        varchar(255) default '',
    access_policy char(1)      default '1' not null,
    status        char         default 'N',
    ext1          varchar(255) default '',
    create_dept   BIGINT,
    create_by     BIGINT,
    create_time   datetime,
    update_by     BIGINT,
    update_time   datetime,
    remark        varchar(500) default '',
    constraint sys_oss_config_pk primary key (oss_config_id)
);

-- 表注释: sys_oss_config = 对象存储配置表
-- 列注释: sys_oss_config.oss_config_id = 主键
-- 列注释: sys_oss_config.config_key = 配置key
-- 列注释: sys_oss_config.access_key = accessKey
-- 列注释: sys_oss_config.secret_key = 秘钥
-- 列注释: sys_oss_config.bucket_name = 桶名称
-- 列注释: sys_oss_config.prefix = 前缀
-- 列注释: sys_oss_config.endpoint = 访问站点
-- 列注释: sys_oss_config.domain_url = 自定义域名
-- 列注释: sys_oss_config.is_https = 是否https（Y=是,N=否）
-- 列注释: sys_oss_config.region = 域
-- 列注释: sys_oss_config.access_policy = 桶权限类型(0=private 1=public 2=custom)
-- 列注释: sys_oss_config.status = 是否默认（Y=是,N=否）
-- 列注释: sys_oss_config.ext1 = 扩展字段
-- 列注释: sys_oss_config.create_dept = 创建部门
-- 列注释: sys_oss_config.create_by = 创建者
-- 列注释: sys_oss_config.create_time = 创建时间
-- 列注释: sys_oss_config.update_by = 更新者
-- 列注释: sys_oss_config.update_time = 更新时间
-- 列注释: sys_oss_config.remark = 备注

insert into sys_oss_config values (1761900000000000001, 'minio', 'ruoyi', 'ruoyi123', 'ruoyi', '', '127.0.0.1:9000', '', 'N', '', '1', 'Y', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP, null);
insert into sys_oss_config values (1761900000000000002, 'qiniu', 'XXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXX', 'ruoyi', '', 's3-cn-north-1.qiniucs.com', '', 'N', '', '1', 'N', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP, null);
insert into sys_oss_config values (1761900000000000003, 'aliyun', 'XXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXX', 'ruoyi', '', 'oss-cn-beijing.aliyuncs.com', '', 'N', '', '1', 'N', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP, null);
insert into sys_oss_config values (1761900000000000004, 'qcloud', 'XXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXX', 'ruoyi-1240000000', '', 'cos.ap-beijing.myqcloud.com', '', 'N', 'ap-beijing', '1', 'N', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP, null);
insert into sys_oss_config values (1761900000000000005, 'image', 'ruoyi', 'ruoyi123', 'ruoyi', 'image', '127.0.0.1:9000', '', 'N', '', '1', 'N', '', 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP, NULL);

-- ----------------------------
-- 系统授权表
-- ----------------------------
create table sys_client (
    id                  BIGINT,
    client_id           varchar(64)   default '',
    client_key          varchar(32)   default '',
    client_secret       varchar(255)  default '',
    grant_type          varchar(255)  default '',
    device_type         varchar(32)   default '',
    access_path         varchar(2000) default '',
    ip_whitelist        varchar(1000) default '',
    active_timeout      INT          default 1800,
    timeout             INT          default 604800,
    status              char(1)       default '0',
    del_flag            char(1)       default '0',
    create_dept         BIGINT,
    create_by           BIGINT,
    create_time         datetime,
    update_by           BIGINT,
    update_time         datetime,
    constraint sys_client_pk primary key (id)
);

-- 表注释: sys_client = 系统授权表
-- 列注释: sys_client.id = 主键
-- 列注释: sys_client.client_id = 客户端id
-- 列注释: sys_client.client_key = 客户端key
-- 列注释: sys_client.client_secret = 客户端秘钥
-- 列注释: sys_client.grant_type = 授权类型
-- 列注释: sys_client.device_type = 设备类型
-- 列注释: sys_client.access_path = 允许访问路径
-- 列注释: sys_client.ip_whitelist = IP白名单
-- 列注释: sys_client.active_timeout = token活跃超时时间
-- 列注释: sys_client.timeout = token固定超时
-- 列注释: sys_client.status = 状态（0正常 1停用）
-- 列注释: sys_client.del_flag = 删除标志（0代表存在 1代表删除）
-- 列注释: sys_client.create_dept = 创建部门
-- 列注释: sys_client.create_by = 创建者
-- 列注释: sys_client.create_time = 创建时间
-- 列注释: sys_client.update_by = 更新者
-- 列注释: sys_client.update_time = 更新时间

insert into sys_client values (1762000000000000001, 'e5cd7e4891bf95d1d19206ce24a7b32e', 'pc', 'pc123', 'password,social', 'pc', '', '', 1800, 604800, 0, 0, 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP);
insert into sys_client values (1762000000000000002, '428a8310cd442757ae699df5d894f051', 'app', 'app123', 'password,sms,social', 'android', '/app/**', '', 1800, 604800, 0, 0, 1761000000000000103, 1761100000000000001, CURRENT_TIMESTAMP, 1761100000000000001, CURRENT_TIMESTAMP);

create table if not exists test_demo
(
    id          BIGINT,
    dept_id     BIGINT,
    user_id     BIGINT,
    order_num   INT            default 0,
    test_key    varchar(255),
    value       varchar(255),
    version     INT            default 0,
    create_dept BIGINT,
    create_time datetime,
    create_by   BIGINT,
    update_time datetime,
    update_by   BIGINT,
    del_flag    INT            default 0
);

-- 表注释: test_demo = 测试单表
-- 列注释: test_demo.id = 主键
-- 列注释: test_demo.dept_id = 部门id
-- 列注释: test_demo.user_id = 用户id
-- 列注释: test_demo.order_num = 排序号
-- 列注释: test_demo.test_key = key键
-- 列注释: test_demo.value = 值
-- 列注释: test_demo.version = 版本
-- 列注释: test_demo.create_dept = 创建部门
-- 列注释: test_demo.create_time = 创建时间
-- 列注释: test_demo.create_by = 创建人
-- 列注释: test_demo.update_time = 更新时间
-- 列注释: test_demo.update_by = 更新人
-- 列注释: test_demo.del_flag = 删除标志

create table if not exists test_tree
(
    id          BIGINT,
    parent_id   BIGINT            default 0,
    dept_id     BIGINT,
    user_id     BIGINT,
    tree_name   varchar(255),
    version     INT            default 0,
    create_dept BIGINT,
    create_time datetime,
    create_by   BIGINT,
    update_time datetime,
    update_by   BIGINT,
    del_flag    integer         default 0
);

-- 表注释: test_tree = 测试树表
-- 列注释: test_tree.id = 主键
-- 列注释: test_tree.parent_id = 父id
-- 列注释: test_tree.dept_id = 部门id
-- 列注释: test_tree.user_id = 用户id
-- 列注释: test_tree.tree_name = 值
-- 列注释: test_tree.version = 版本
-- 列注释: test_tree.create_dept = 创建部门
-- 列注释: test_tree.create_time = 创建时间
-- 列注释: test_tree.create_by = 创建人
-- 列注释: test_tree.update_time = 更新时间
-- 列注释: test_tree.update_by = 更新人
-- 列注释: test_tree.del_flag = 删除标志

INSERT INTO test_demo VALUES (1762100000000000001, 1761000000000000102, 1761100000000000004, 1, '测试数据权限', '测试', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000002, 1761000000000000102, 1761100000000000003, 2, '子节点1', '111', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000003, 1761000000000000102, 1761100000000000003, 3, '子节点2', '222', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000004, 1761000000000000108, 1761100000000000004, 4, '测试数据', 'demo', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000005, 1761000000000000108, 1761100000000000003, 13, '子节点11', '1111', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000006, 1761000000000000108, 1761100000000000003, 12, '子节点22', '2222', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000007, 1761000000000000108, 1761100000000000003, 11, '子节点33', '3333', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000008, 1761000000000000108, 1761100000000000003, 10, '子节点44', '4444', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000009, 1761000000000000108, 1761100000000000003, 9, '子节点55', '5555', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000010, 1761000000000000108, 1761100000000000003, 8, '子节点66', '6666', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000011, 1761000000000000108, 1761100000000000003, 7, '子节点77', '7777', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000012, 1761000000000000108, 1761100000000000003, 6, '子节点88', '8888', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_demo VALUES (1762100000000000013, 1761000000000000108, 1761100000000000003, 5, '子节点99', '9999', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);

INSERT INTO test_tree VALUES (1762200000000000001, 0, 1761000000000000102, 1761100000000000004, '测试数据权限', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000002, 1762200000000000001, 1761000000000000102, 1761100000000000003, '子节点1', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000003, 1762200000000000002, 1761000000000000102, 1761100000000000003, '子节点2', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000004, 0, 1761000000000000108, 1761100000000000004, '测试树1', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000005, 1762200000000000004, 1761000000000000108, 1761100000000000003, '子节点11', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000006, 1762200000000000004, 1761000000000000108, 1761100000000000003, '子节点22', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000007, 1762200000000000004, 1761000000000000108, 1761100000000000003, '子节点33', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000008, 1762200000000000005, 1761000000000000108, 1761100000000000003, '子节点44', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000009, 1762200000000000006, 1761000000000000108, 1761100000000000003, '子节点55', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000010, 1762200000000000007, 1761000000000000108, 1761100000000000003, '子节点66', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000011, 1762200000000000007, 1761000000000000108, 1761100000000000003, '子节点77', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000012, 1762200000000000010, 1761000000000000108, 1761100000000000003, '子节点88', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);
INSERT INTO test_tree VALUES (1762200000000000013, 1762200000000000010, 1761000000000000108, 1761100000000000003, '子节点99', 0, 1761000000000000103, CURRENT_TIMESTAMP, 1761100000000000001, NULL, NULL, 0);

-- 字符串自动转时间（PG cast 函数已删除：MySQL 对时间字符串自动转换）



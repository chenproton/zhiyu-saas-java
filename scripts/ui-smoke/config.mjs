/**
 * 配置加载与 CLI 解析。
 * 优先级：CLI 参数 > 配置文件 > 内置默认值。
 */
import { promises as fs } from 'fs'
import path from 'path'

export const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname)
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
// 单栈（Java+Vue）：路由表从 frontend/portal-vue/src/router/index.ts 提取（见 routes.mjs）
export const STATE_DIR = '/tmp/zhiyu-ui-smoke'
export const DEFAULT_REPORT = path.join(STATE_DIR, 'report.json')

const DEFAULTS = {
  baseUrl: 'http://127.0.0.1',
  // 默认只巡检 school 角色（提速）；全角色用 --all-roles 或 --roles school,teacher,student,partner
  roles: ['school'],
  accounts: {
    school: { username: 'school', password: 'school123' },
    teacher: { username: 'teacher', password: 'teacher123' },
    student: { username: 'student', password: 'student123' },
    // partner（企业端）独立认证：账号不存在时按 enterpriseName 自动注册巡检企业后直接登录
    partner: { username: 'smokepartner', password: 'smoke123', enterpriseName: '巡检测试企业' },
  },
  // partner 角色巡检路由：默认空 = 自动枚举 /partner 下页面（排除登录页与重定向根页）
  partnerRoutes: [],
  maxClicks: 100,
  // 默认单路串行：多 worker 并发容易把本地后端压垮（502/崩溃），需要加速时可在配置中加大
  workers: 1,
  report: DEFAULT_REPORT,
  // 默认排除 partner/superadmin 独立门户：portal 角色访问这些应用会清除/覆盖 portal token，导致后续页面被踢到登录页
  excludeRoutes: ['/partner', '/superadmin'],
  dynamicRoutes: {},
  expectedAuthPages: [],
  // 会修改/提交数据的按钮文本（中英双语），默认跳过（防止污染数据）。
  // 「重新生成/AI 生成」触发真实 LLM 调用（按 token 计费），全量巡检必须跳过
  dangerousWords: ['保存', '提交', '删除', '发布', '确认', '确定', '归档', '驳回', '通过', '启用', '停用', '禁用', '冻结', '锁定', '重置密码', '退出', '注销', '登出', '批量', '创建', '新增', '新建', '添加', '完成', '设为', '切换', '重新生成', 'AI 生成'],
  dangerousWordsEn: ['Save', 'Submit', 'Delete', 'Publish', 'Confirm', 'OK', 'Archive', 'Reject', 'Approve', 'Enable', 'Disable', 'Freeze', 'Lock', 'Reset', 'Logout', 'Sign out', 'Batch', 'Create', 'Add', 'Complete', 'Finish', 'Remove', 'Regenerate'],
  // 语言切换按钮文本：点击会改变全局语言，导致危险词失效，必须跳过
  localeSwitchWords: ['中文', 'English', '简体中文', '语言'],
  // 种子数据/已知噪音（正则片段）；静态资源 404 由 response 监听以外的 console 兜底产生，页面可用性另由 pageerror 保障
  noisePatterns: ['example\\.com', 'Failed to load resource: the server responded with a status of 404'],
  // 点击时序（默认值偏保守，全量回归时可在 smoke.config.json 中覆盖）
  clickIntervalMs: 30,
  dialogEscMs: 80,
  settleMs: 200,
  // 列表行内按钮去重：同一按钮类型只保留前 N 行的实例（大表页提速；SMOKE_ 行豁免）
  maxRowClicks: 1,
  // 下拉菜单项点击：点击一项后菜单关闭，重开触发器继续点剩余项的上限
  maxMenuReopens: 3,
  // networkidle 仅在导航后尝试，超时短（带轮询的页面永远到不了 idle）
  navWaitMs: 2500,
  loginTimeoutMs: 20000,
  retryCrashes: 2,
  // 单路由巡检超时（秒）：表格页行按钮多，120s 不够，放宽到 180s
  routeTimeoutSec: 180,
  // 启动前就绪探测：等待 nginx 能正常连到前后端（避免部署刚结束上游还在切换导致 502）
  readyTimeoutSec: 120,
  readyIntervalMs: 1500,
  // 瞬态错误重试：502/503/504 或连接被拒绝时重试整页（区分于崩溃重试）
  retryTransient: 2,
  retryTransientDelayMs: 1200,
  // 无文本/无 aria-label 的图标按钮：默认跳过（宁漏勿删）
  allowIconButtons: false,
  // 动态路由详情页上的 404（实体被删/无权限 id）默认忽略
  dynamicIgnore404: true,
  // 默认进入 CRUD 按钮功能测试；--click-only 退回到旧行为（只点击，不填表单、不点危险按钮）
  clickOnly: false,
  // 原 --test-forms 已合并到默认行为，保留字段仅作配置兼容
  testForms: true,
  cleanup: true,
  maxFormSubmits: 3,
  // CRUD 测试数据行标记
  crudMarker: 'SMOKE_',
  // CRUD 模式下默认跳过的系统高风险页（避免改乱权限/超管导致后续测试失败）
  crudExcludeRoutes: ['/superadmin', '/portal/apps/system/org-user/roles'],
  // 创建/编辑类入口按钮文本（点击后如出现表单则执行表单测试）
  formTriggerWords: ['创建', '新增', '新建', '添加'],
  formTriggerWordsEn: ['Create', 'Add', 'New'],
  // 表单提交按钮文本
  submitWords: ['保存', '提交', '创建', '确定', '确认', '完成'],
  submitWordsEn: ['Save', 'Submit', 'Create', 'OK', 'Confirm', 'Finish'],
  // 动作分类：危险删除类 / 安全导航类（actionType 标注，供报告与后续扩展的动作处理器使用）
  destructiveWords: ['删除', '禁用', '停用', '冻结', '锁定', '归档', '驳回', '退出', '注销', '登出', '重置密码', '批量'],
  destructiveWordsEn: ['Delete', 'Disable', 'Freeze', 'Lock', 'Archive', 'Reject', 'Logout', 'Sign out', 'Reset', 'Batch', 'Remove'],
  // CRUD 动作词表（默认模式下用于识别编辑/删除/启用/禁用按钮）
  editWords: ['编辑', '修改'],
  editWordsEn: ['Edit', 'Modify'],
  deleteWords: ['删除'],
  deleteWordsEn: ['Delete', 'Remove'],
  enableWords: ['启用', '激活'],
  enableWordsEn: ['Enable', 'Activate'],
  disableWords: ['禁用', '停用'],
  disableWordsEn: ['Disable', 'Deactivate'],
  navWords: ['返回', '查看', '详情', '取消', '关闭', '上一页', '下一页', '首页'],
  navWordsEn: ['Back', 'View', 'Detail', 'Cancel', 'Close', 'Prev', 'Next', 'Home'],
  // 按路由覆盖配置（前缀匹配，最长优先）：{ "/scene/scenarios": { "maxFormSubmits": 0, "skipFormFields": ["封面"] } }
  routeOverrides: {},
  // 额外清理映射：[{ list: '/api/v1/x?limit=100', del: '/api/v1/x/{id}', fields: ['name'] }]
  cleanupApis: [],
  // 定时巡检（git-diff 圈定）时组件依赖扫描深度
  depScanDepth: 3,
}

export function buildConfig(args) {
  return { ...DEFAULTS, ...args }
}

export async function loadConfigFile(cfgPath) {
  try {
    const raw = await fs.readFile(cfgPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '--base-url': args.baseUrl = next(); break
      case '--roles': args.roles = next().split(',').map(s => s.trim()); break
      case '--all-roles': args.roles = ['school', 'teacher', 'student', 'partner']; break
      case '--account': {
        // --account school:user:pass 覆盖指定角色账号
        const [role, username, password] = next().split(':')
        args.accounts = { ...DEFAULTS.accounts, [role]: { username, password } }
        break
      }
      case '--max-clicks': args.maxClicks = parseInt(next(), 10); break
      case '--workers': args.workers = parseInt(next(), 10); break
      case '--report': args.report = next(); break
      case '--config': args.configFile = next(); break
      case '--exclude': args.excludeRoutes = next().split(',').map(s => s.trim()); break
      case '--route': args.route = next(); break
      case '--git-diff': args.gitDiff = next() || 'HEAD'; break
      case '--baseline': args.baseline = next(); break
      case '--resume': args.resume = next(); break
      case '--click-dangerous': args.clickDangerous = true; break
      case '--click-only': args.clickOnly = true; break
      case '--test-forms': args.testForms = true; break
      case '--no-cleanup': args.cleanup = false; break
      case '--max-form-submits': args.maxFormSubmits = parseInt(next(), 10); break
      case '--tail-backend': args.tailBackend = true; break
      case '--fail-on-error': args.failOnError = true; break
      case '--headed': args.headed = true; break
      case '--verbose': args.verbose = true; break
      case '--timeout-min': args.timeoutMin = parseInt(next(), 10); break
      case '--ready-timeout': args.readyTimeoutSec = parseInt(next(), 10); break
      case '--retry-transient': args.retryTransient = parseInt(next(), 10); break
      case '--help': case '-h':
        console.log(`知育前端全站点击巡检工具（UI Smoke Test）

用法: node scripts/ui-smoke/ui-smoke.mjs [选项]

  --base-url <url>      目标站点（默认 http://127.0.0.1，必须走 nginx 网关）
  --roles <a,b,c>       角色列表（默认 school；--all-roles 或显式列出跑多角色）
  --all-roles           跑全部角色 school,teacher,student,partner（默认只跑 school）
  --account r:u:p       覆盖指定角色账号，如 --account school:school:newpass
  --max-clicks <n>      每页点击安全阀（默认 100）
  --workers <n>         并发路数（默认 1）
  --config <path>       配置文件（默认 scripts/ui-smoke/smoke.config.json）
  --exclude <sub,a,b>   排除路由子串
  --route <path>        只巡检单个路由
  --git-diff [ref]      只巡检 git 改动涉及的路由（默认对比 HEAD）
  --baseline <file>     与上次报告做回归 diff（新增/已修复/持续）
  --resume <file>       跳过上次报告中已 ok/skip 的路由
  --click-only          只点击页面元素，不测试表单/创建/编辑/删除等 CRUD 按钮（旧默认行为）
  --click-dangerous     允许点击写数据按钮（默认模式下只操作 SMOKE_ 测试数据）
  --test-forms          已合并到默认行为，保留仅作兼容
  --no-cleanup          测试后不清理 SMOKE_ 前缀数据（默认自动清理）
  --max-form-submits <n> 每页表单提交次数上限（默认 3）
  --tail-backend        抓取后端容器日志 error/panic 增量
  --fail-on-error       发现错误退出码 1
  --headed              显示浏览器窗口
  --verbose             连 warning 与噪音一并输出
  --timeout-min <n>     全局看门狗超时（分钟，默认不限）
  --ready-timeout <n>   启动前就绪探测超时（秒，默认 120）
  --retry-transient <n> 单路由瞬态 502/连接错误重试次数（默认 2）
`)
        process.exit(0)
      default:
        console.error(`未知参数: ${a}（--help 查看用法）`); process.exit(2)
    }
  }
  return args
}

export async function resolveConfig(argv) {
  const cli = parseArgs(argv)
  const fileCfg = await loadConfigFile(cli.configFile || path.join(SCRIPT_DIR, 'smoke.config.json'))
  const merged = buildConfig({ ...DEFAULTS, ...fileCfg, ...cli })
  if (merged.gitDiff && merged.route) {
    console.error('--git-diff 与 --route 不能同时使用')
    process.exit(2)
  }
  return merged
}

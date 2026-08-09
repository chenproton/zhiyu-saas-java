/**
 * 配置加载与 CLI 解析。
 * 优先级：CLI 参数 > 配置文件 > 内置默认值。
 */
import { promises as fs } from 'fs'
import path from 'path'

export const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname)
export const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..', '..')
export const APP_DIR = path.join(PROJECT_ROOT, 'apps', 'edu', 'app')
export const STATE_DIR = '/tmp/zhiyu-ui-smoke'
export const DEFAULT_REPORT = path.join(STATE_DIR, 'report.json')

const DEFAULTS = {
  baseUrl: 'http://127.0.0.1',
  roles: ['school', 'teacher', 'student'],
  accounts: {
    school: { username: 'school', password: 'school123' },
    teacher: { username: 'teacher', password: 'teacher123' },
    student: { username: 'student', password: 'student123' },
  },
  maxClicks: 100,
  // 默认单路串行：多 worker 并发容易把本地后端压垮（502/崩溃），需要加速时可在配置中加大
  workers: 1,
  report: DEFAULT_REPORT,
  // 默认排除 partner/superadmin 独立门户：portal 角色访问这些应用会清除/覆盖 portal token，导致后续页面被踢到登录页
  excludeRoutes: ['/partner', '/superadmin'],
  dynamicRoutes: {},
  expectedAuthPages: [],
  // 会修改/提交数据的按钮文本（中英双语），默认跳过（防止污染数据）
  dangerousWords: ['保存', '提交', '删除', '发布', '确认', '确定', '归档', '驳回', '通过', '启用', '停用', '禁用', '冻结', '锁定', '重置密码', '退出', '注销', '登出', '批量', '创建', '新增', '新建', '添加', '完成', '设为', '切换'],
  dangerousWordsEn: ['Save', 'Submit', 'Delete', 'Publish', 'Confirm', 'OK', 'Archive', 'Reject', 'Approve', 'Enable', 'Disable', 'Freeze', 'Lock', 'Reset', 'Logout', 'Sign out', 'Batch', 'Create', 'Add', 'Complete', 'Finish', 'Remove'],
  // 语言切换按钮文本：点击会改变全局语言，导致危险词失效，必须跳过
  localeSwitchWords: ['中文', 'English', '简体中文', '语言'],
  // 种子数据/已知噪音（正则片段）；静态资源 404 由 response 监听以外的 console 兜底产生，页面可用性另由 pageerror 保障
  noisePatterns: ['example\\.com', 'Failed to load resource: the server responded with a status of 404'],
  // 点击时序（默认值偏保守，全量回归时可在 smoke.config.json 中覆盖）
  clickIntervalMs: 60,
  dialogEscMs: 120,
  settleMs: 300,
  // networkidle 仅在导航后尝试，超时短（带轮询的页面永远到不了 idle）
  navWaitMs: 2500,
  loginTimeoutMs: 20000,
  retryCrashes: 2,
  // 单路由巡检超时（秒）：表格页行按钮多，120s 不够，放宽到 180s
  routeTimeoutSec: 180,
  // 无文本/无 aria-label 的图标按钮：默认跳过（宁漏勿删）
  allowIconButtons: false,
  // 动态路由详情页上的 404（实体被删/无权限 id）默认忽略
  dynamicIgnore404: true,
  // 表单自动填充+提交测试（--test-forms 启用）；提交数据统一 SMOKE_ 前缀，结束后自动清理
  testForms: false,
  cleanup: true,
  maxFormSubmits: 3,
  // 创建/编辑类入口按钮文本（点击后如出现表单则执行表单测试）
  formTriggerWords: ['创建', '新增', '新建', '添加'],
  formTriggerWordsEn: ['Create', 'Add', 'New'],
  // 表单提交按钮文本
  submitWords: ['保存', '提交', '创建', '确定', '确认', '完成'],
  submitWordsEn: ['Save', 'Submit', 'Create', 'OK', 'Confirm', 'Finish'],
  // 动作分类：危险删除类 / 安全导航类（actionType 标注，供报告与后续扩展的动作处理器使用）
  destructiveWords: ['删除', '禁用', '停用', '冻结', '锁定', '归档', '驳回', '退出', '注销', '登出', '重置密码', '批量'],
  destructiveWordsEn: ['Delete', 'Disable', 'Freeze', 'Lock', 'Archive', 'Reject', 'Logout', 'Sign out', 'Reset', 'Batch', 'Remove'],
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
      case '--test-forms': args.testForms = true; break
      case '--no-cleanup': args.cleanup = false; break
      case '--max-form-submits': args.maxFormSubmits = parseInt(next(), 10); break
      case '--tail-backend': args.tailBackend = true; break
      case '--fail-on-error': args.failOnError = true; break
      case '--headed': args.headed = true; break
      case '--verbose': args.verbose = true; break
      case '--timeout-min': args.timeoutMin = parseInt(next(), 10); break
      case '--help': case '-h':
        console.log(`知育前端全站点击巡检工具（UI Smoke Test）

用法: node scripts/ui-smoke/ui-smoke.mjs [选项]

  --base-url <url>      目标站点（默认 http://127.0.0.1，必须走 nginx 网关）
  --roles <a,b,c>       角色列表（默认 school,teacher,student）
  --account r:u:p       覆盖指定角色账号，如 --account school:school:newpass
  --max-clicks <n>      每页点击安全阀（默认 100）
  --workers <n>         并发路数（默认 3）
  --config <path>       配置文件（默认 scripts/ui-smoke/smoke.config.json）
  --exclude <sub,a,b>   排除路由子串
  --route <path>        只巡检单个路由
  --git-diff [ref]      只巡检 git 改动涉及的路由（默认对比 HEAD）
  --baseline <file>     与上次报告做回归 diff（新增/已修复/持续）
  --resume <file>       跳过上次报告中已 ok/skip 的路由
  --click-dangerous     允许点击写数据按钮（默认跳过防污染）
  --test-forms          表单自动填充+提交测试（测试租户专用，会真实创建数据）
  --no-cleanup          表单测试后不清理 SMOKE_ 前缀数据（默认自动清理）
  --max-form-submits <n> 每页表单提交次数上限（默认 3）
  --tail-backend        抓取后端容器日志 error/panic 增量
  --fail-on-error       发现错误退出码 1
  --headed              显示浏览器窗口
  --verbose             连 warning 与噪音一并输出
  --timeout-min <n>     全局看门狗超时（分钟，默认不限）
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

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
  workers: 3,
  report: DEFAULT_REPORT,
  excludeRoutes: [],
  dynamicRoutes: {},
  expectedAuthPages: [],
  // 会修改/提交数据的按钮文本（中英双语），默认跳过（防止污染数据）
  dangerousWords: ['保存', '提交', '删除', '发布', '确认', '确定', '归档', '驳回', '通过', '启用', '停用', '禁用', '冻结', '锁定', '重置密码', '退出', '注销', '登出', '批量', '创建', '新增', '新建', '添加', '完成', '返回'],
  dangerousWordsEn: ['Save', 'Submit', 'Delete', 'Publish', 'Confirm', 'OK', 'Archive', 'Reject', 'Approve', 'Enable', 'Disable', 'Freeze', 'Lock', 'Reset', 'Logout', 'Sign out', 'Batch', 'Create', 'Add', 'Complete', 'Finish', 'Remove', 'Back'],
  // 语言切换按钮文本：点击会改变全局语言，导致危险词失效，必须跳过
  localeSwitchWords: ['中文', 'English', '简体中文', '语言'],
  // 种子数据/已知噪音（正则片段）
  noisePatterns: ['example\\.com'],
  // 点击时序
  clickIntervalMs: 200,
  dialogEscMs: 300,
  settleMs: 500,
  navWaitMs: 8000,
  loginTimeoutMs: 20000,
  retryCrashes: 2,
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

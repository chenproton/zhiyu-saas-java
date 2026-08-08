'use client'

import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Briefcase,
  LayoutGrid,
  ChevronDown,
  User,
  Settings,
  LogOut,
  LogIn,
  Check,
  UserCog,
  Languages,
  AArrowDown,
  AArrowUp,
  Type,
  RotateCcw,
  QrCode,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { useFontScale } from '@/hooks/use-font-scale'
import { useI18n, useT } from '@/lib/i18n/locale-provider'
import { MobileAccessDialog } from './mobile-access-dialog'

const navItems = [
  { href: '/portal', label: '门户首页', icon: Home },
  { href: '/portal/workspace', label: '我的服务台', icon: Briefcase },
  { href: '/portal/apps', label: '应用服务中心', icon: LayoutGrid },
]

export function TopNav() {
  const pathname = usePathname()
  const { user, tenant, roles, activeRole, setActiveRole, logout } = useAuth()
  const { level, maxLevel, increase, decrease, reset } = useFontScale()
  const { locale, setLocale } = useI18n()
  const t = useT()
  const isLoggedIn = !!user
  const [currentTime, setCurrentTime] = useState('')
  const [mounted, setMounted] = useState(false)
  const [layoutTick, setLayoutTick] = useState(0)
  const [mobileAccessOpen, setMobileAccessOpen] = useState(false)
  const headerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mounted 标志用于避免 hydration 不一致，需在挂载后置位
    setMounted(true)
    const updateTime = () => {
      if (document.visibilityState !== 'visible') return
      const now = new Date()
      const weekDays =
        locale === 'en'
          ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          : ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const weekDay = weekDays[now.getDay()]
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      setCurrentTime(
        locale === 'en'
          ? `${year}-${month}-${day} ${weekDay} ${hours}:${minutes}:${seconds}`
          : `${year}年${month}月${day}日 ${weekDay} ${hours}:${minutes}:${seconds}`,
      )
    }
    // 仅在页面可见时更新时钟，后台标签页跳过 setState，避免每秒触发整树重渲染
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateTime()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(timer)
    }
  }, [locale])

  // 实测导航栏内容是否溢出（窗口变窄/字号放大导致文字重叠），按优先级依次隐藏文字只保留图标：
  // 时间 → 系统名称 → 三个菜单文字 → 右侧用户信息文字
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header || !mounted) return
    const hideables = Array.from(header.querySelectorAll<HTMLElement>('[data-hide-order]')).sort(
      (a, b) => Number(a.dataset.hideOrder) - Number(b.dataset.hideOrder),
    )
    for (let lv = 0; lv <= hideables.length; lv++) {
      hideables.forEach((el, i) => {
        el.style.display = i < lv ? 'none' : ''
      })
      if (header.scrollWidth <= header.clientWidth + 1) break
    }
  }, [mounted, isLoggedIn, currentTime, level, layoutTick])

  // 导航栏自身尺寸变化（窗口缩放/字号调整/字体加载）时触发重新计算
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const ro = new ResizeObserver(() => setLayoutTick((t) => t + 1))
    ro.observe(header)
    return () => ro.disconnect()
  }, [mounted])

  const isActive = (href: string) => {
    if (href === '/portal') {
      return pathname === '/portal'
    }
    return pathname.startsWith(href)
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <>
      <header
        ref={headerRef}
        className="h-14 bg-white/70 backdrop-blur-xl border-b border-white/20 flex items-center justify-between px-3 md:px-6 shrink-0 fixed top-0 left-0 right-0 z-50 shadow-sm font-sans"
      >
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/portal" className="flex items-center gap-2">
            <Image
              src="/logo.png?v=2"
              alt="知育"
              width={369}
              height={139}
              className="h-8 w-auto object-contain"
            />
            <span
              data-hide-order="2"
              className="hidden sm:inline font-semibold text-foreground text-base whitespace-nowrap"
            >
              {t('场景化数智教学服务平台')}
            </span>
          </Link>

          {isLoggedIn && (
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                const label = t(item.label)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={label}
                    className={`flex items-center gap-1.5 px-3 md:px-4 py-2 text-sm rounded-md transition-colors relative whitespace-nowrap ${
                      active
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5 md:w-4 md:h-4" />
                    <span data-hide-order="3" className="hidden md:inline whitespace-nowrap">
                      {label}
                    </span>
                    {active && (
                      <span className="absolute bottom-0 left-2 right-2 md:left-4 md:right-4 h-0.5 bg-primary rounded-full" />
                    )}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          {mounted && (
            <div
              data-hide-order="1"
              className="hidden md:block text-sm text-muted-foreground whitespace-nowrap"
            >
              {currentTime}
            </div>
          )}

          {isLoggedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2 h-auto py-1.5 hover:bg-muted"
                >
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div data-hide-order="4" className="hidden sm:block text-left">
                    <div className="text-sm text-foreground whitespace-nowrap">{user.name}</div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {tenant?.name || t('租户')} · {activeRole?.name || t('用户')}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {roles && roles.length > 1 && (
                  <>
                    <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                      <UserCog className="w-3.5 h-3.5" />
                      {t('切换角色')}
                    </DropdownMenuLabel>
                    {roles.map((r) => (
                      <DropdownMenuItem
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => {
                          if (r.id !== activeRole?.id) setActiveRole(r.id)
                        }}
                      >
                        <span className="flex-1">{r.name}</span>
                        {r.id === activeRole?.id && <Check className="w-4 h-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/portal/workspace">
                    <User className="w-4 h-4" />
                    {t('个人中心')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portal/workspace?tab=profile">
                    <Settings className="w-4 h-4" />
                    {t('账号设置')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setMobileAccessOpen(true)}>
                  <QrCode className="w-4 h-4" />
                  {t('移动端访问')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-default" onSelect={(e) => e.preventDefault()}>
                  <Languages className="w-4 h-4" />
                  <span className="text-sm whitespace-nowrap">{t('语言')}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 text-sm ${
                      locale === 'zh' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setLocale('zh')}
                  >
                    中文
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 text-sm ${
                      locale === 'en' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setLocale('en')}
                  >
                    English
                  </Button>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-default" onSelect={(e) => e.preventDefault()}>
                  <Type className="w-4 h-4" />
                  <span className="text-sm text-foreground whitespace-nowrap">{t('字号大小')}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-muted"
                    onClick={decrease}
                    disabled={level === 0}
                    aria-label={t('减小字号')}
                  >
                    <AArrowDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-muted"
                    onClick={increase}
                    disabled={level === maxLevel}
                    aria-label={t('增大字号')}
                  >
                    <AArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-muted"
                    onClick={reset}
                    disabled={level === 0}
                    aria-label={t('恢复默认字号')}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  {t('退出登录')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5"
              asChild
            >
              <Link href="/portal/login" title={t('登录')}>
                <LogIn className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">{t('登录')}</span>
              </Link>
            </Button>
          )}
        </div>
      </header>
      <MobileAccessDialog open={mobileAccessOpen} onOpenChange={setMobileAccessOpen} />
    </>
  )
}

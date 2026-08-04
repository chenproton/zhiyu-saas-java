'use client'

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
  AArrowDown,
  AArrowUp,
  Type,
  RotateCcw,
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

const navItems = [
  { href: '/portal', label: '门户首页', icon: Home },
  { href: '/portal/workspace', label: '我的服务台', icon: Briefcase },
  { href: '/portal/apps', label: '应用服务中心', icon: LayoutGrid },
]

export function TopNav() {
  const pathname = usePathname()
  const { user, institution, roles, activeRole, setActiveRole, logout } = useAuth()
  const { level, maxLevel, increase, decrease, reset } = useFontScale()
  const isLoggedIn = !!user

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
      <header className="h-14 bg-white/70 backdrop-blur-xl border-b border-white/20 flex items-center justify-between px-3 md:px-6 shrink-0 fixed top-0 left-0 right-0 z-50 shadow-sm">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/portal" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="知育"
              width={369}
              height={139}
              className="h-8 w-auto object-contain"
            />
          </Link>

          {isLoggedIn && (
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center justify-center px-2.5 py-2 text-sm rounded-md transition-colors relative whitespace-nowrap ${
                      active
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {active && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                    )}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3 md:gap-6">
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
                  <div className="hidden sm:block text-left">
                    <div className="text-sm text-foreground whitespace-nowrap">{user.name}</div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {activeRole?.name || '用户'} · {institution?.name || '组织'}
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
                      切换角色
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
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  个人中心
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  账号设置
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Type className="w-3.5 h-3.5" />
                  字号大小
                </DropdownMenuLabel>
                <div className="flex items-center gap-1 px-2 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted"
                    onClick={decrease}
                    disabled={level === 0}
                    aria-label="减小字号"
                  >
                    <AArrowDown className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 text-center text-sm text-foreground whitespace-nowrap">
                    字号 {level}/{maxLevel}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-muted"
                    onClick={increase}
                    disabled={level === maxLevel}
                    aria-label="增大字号"
                  >
                    <AArrowUp className="w-4 h-4" />
                  </Button>
                </div>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={level === 0}
                  onClick={reset}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  恢复默认字号
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5"
              asChild
            >
              <Link href="/portal/login" title="登录">
                <LogIn className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">登录</span>
              </Link>
            </Button>
          )}
        </div>
      </header>
    </>
  )
}

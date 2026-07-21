"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Briefcase, LayoutGrid, ChevronDown, User, Settings, LogOut, LogIn, Link2, Check, UserCog } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"

const navItems = [
  { href: "/portal", label: "门户首页", icon: Home },
  { href: "/portal/workspace", label: "我的服务台", icon: Briefcase },
  { href: "/portal/apps", label: "应用服务中心", icon: LayoutGrid },
]

export function TopNav() {
  const pathname = usePathname()
  const { user, institution, roles, activeRole, setActiveRole, loading, logout } = useAuth()
  const isLoggedIn = !!user
  const [currentTime, setCurrentTime] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const updateTime = () => {
      const now = new Date()
      const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, "0")
      const day = String(now.getDate()).padStart(2, "0")
      const weekDay = weekDays[now.getDay()]
      const hours = String(now.getHours()).padStart(2, "0")
      const minutes = String(now.getMinutes()).padStart(2, "0")
      const seconds = String(now.getSeconds()).padStart(2, "0")
      setCurrentTime(`${year}年${month}月${day}日 ${weekDay} ${hours}:${minutes}:${seconds}`)
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  const isActive = (href: string) => {
    if (href === "/portal") {
      return pathname === "/portal"
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
            <img src="/logo.png" alt="知育" className="h-8 w-auto object-contain" />
            <span className="hidden sm:inline font-semibold text-foreground text-base whitespace-nowrap">场景化数智教学服务平台</span>
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
                    className={`flex items-center gap-1.5 px-3 md:px-4 py-2 text-sm rounded-md transition-colors relative whitespace-nowrap ${
                      active
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden md:inline whitespace-nowrap">{item.label}</span>
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
            <div className="hidden md:block text-sm text-muted-foreground whitespace-nowrap">
              {currentTime}
            </div>
          )}
          
          {isLoggedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 h-auto py-1.5 hover:bg-muted">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm text-foreground whitespace-nowrap">{user.name}</div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{activeRole?.name || "用户"} · {institution?.name || "组织"}</div>
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
                <DropdownMenuItem asChild>
                  <Link href="/portal/config/links" className="cursor-pointer">
                    <Link2 className="w-4 h-4 mr-2" />
                    平台地址配置
                  </Link>
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

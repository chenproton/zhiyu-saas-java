"use client"

import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

export default function LessonLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()
  const isLanding = pathname.startsWith("/lesson/landing")

  if (isLanding) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    router.replace("/portal/login")
    return null
  }

  return <>{children}</>
}

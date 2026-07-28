"use client"

import { useEffect } from "react"
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

  useEffect(() => {
    if (!loading && !user && !isLanding) {
      router.replace("/portal/login")
    }
  }, [loading, user, isLanding, router])

  if (isLanding) {
    return <>{children}</>
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}

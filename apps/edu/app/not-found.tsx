import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl">404</p>
      <p className="text-sm text-muted-foreground">页面不存在或已被移除</p>
      <Button asChild variant="outline">
        <Link href="/portal/dashboard">返回工作台</Link>
      </Button>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import { portalUserManagementApi } from "@/lib/api"

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export interface ResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
  userName?: string
  onSuccess?: () => void
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword("")
      setConfirmPassword("")
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const validate = (): string | null => {
    if (!password) return "请输入新密码"
    if (!PASSWORD_RULE.test(password)) {
      return "密码长度至少 8 位，且需同时包含字母和数字"
    }
    if (password !== confirmPassword) return "两次输入的密码不一致"
    return null
  }

  const handleSubmit = async () => {
    if (!userId) return
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await portalUserManagementApi.resetPassword(userId, password)
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "重置密码失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
          <DialogDescription>
            正在为 <span className="font-medium">{userName || "该用户"}</span> 设置新密码
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reset-password">新密码</Label>
            <Input
              id="reset-password"
              type="password"
              placeholder="至少 8 位，包含字母和数字"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reset-confirm-password">确认新密码</Label>
            <Input
              id="reset-confirm-password"
              type="password"
              placeholder="再次输入新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !password || !confirmPassword}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认重置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import React from "react"
import { X, ArrowLeft, ArrowRight, Save, Eye, Check, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TopNav } from "@/components/portal/top-nav"

export interface EditorShellProps {
  mode: "fullscreen" | "inline"

  backText: string
  onBack: () => void

  step?: number
  stepLabel?: string

  onSaveDraft?: () => void
  isSaving?: boolean
  saveText?: string
  saveDisabled?: boolean

  onPreview?: () => void

  onPrev?: () => void

  onNext?: () => void
  nextText?: string
  nextDisabled?: boolean

  onSubmit?: () => void
  submitText?: string
  submitDisabled?: boolean

  loadingText?: string

  headerTitle?: React.ReactNode

  title?: string
  subtitle?: string

  contentMaxWidth?: string

  children: React.ReactNode
}

export function EditorShell({
  mode,
  backText,
  onBack,
  step,
  stepLabel,
  onSaveDraft,
  isSaving = false,
  saveText,
  saveDisabled,
  onPreview,
  onPrev,
  onNext,
  nextText = "下一步",
  nextDisabled,
  onSubmit,
  submitText = "提交审批",
  submitDisabled,
  loadingText,
  headerTitle,
  title,
  subtitle,
  contentMaxWidth,
  children,
}: EditorShellProps) {
  const backIcon = mode === "fullscreen" ? <X className="h-4 w-4 mr-2" /> : <ArrowLeft className="h-4 w-4 mr-1" />
  const stickyClass = mode === "fullscreen" ? "sticky top-14 z-10" : "sticky top-0 z-30"
  const mxWidth = contentMaxWidth || (mode === "fullscreen" ? "max-w-full" : "max-w-[1400px]")
  const defaultSaveText = isSaving ? "保存中..." : "保存草稿"

  const headerBar = (
    <div className={`bg-white border-b border-gray-100 ${stickyClass} ${mode === "fullscreen" ? "mt-14" : ""}`}>
      <div className={`${mxWidth} mx-auto px-6 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            {backIcon}
            {backText}
          </Button>
          {headerTitle && (
            <h1 className="text-lg font-semibold text-gray-900">{headerTitle}</h1>
          )}
          {step !== undefined && (
            <>
              <div className="h-5 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  步骤 {step}
                </Badge>
                {stepLabel && (
                  <span className="text-sm font-medium text-gray-800">{stepLabel}</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {loadingText && (
            <span className="text-xs text-muted-foreground flex items-center">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {loadingText}
            </span>
          )}
          {onSaveDraft && (
            <Button variant="outline" size="sm" onClick={onSaveDraft} disabled={isSaving || saveDisabled}>
              <Save className="mr-2 h-4 w-4" />
              {saveText || defaultSaveText}
            </Button>
          )}
          {onPreview && (
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye className="mr-2 h-4 w-4" />
              预览
            </Button>
          )}
          {onPrev && (
            <Button variant="outline" size="sm" onClick={onPrev}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              上一步
            </Button>
          )}
          {onNext && (
            <Button size="sm" onClick={onNext} disabled={nextDisabled}>
              {nextText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {!onNext && onSubmit && (
            <Button size="sm" onClick={onSubmit} disabled={submitDisabled}>
              {mode === "inline" && <Send className="mr-2 h-4 w-4" />}
              {mode === "fullscreen" && <Check className="mr-2 h-4 w-4" />}
              {submitText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  const pageTitle = title ? (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  ) : null

  if (mode === "fullscreen") {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-auto">
        <TopNav />
        {headerBar}
        <div className={`${mxWidth} mx-auto px-6 py-8`}>
          {pageTitle}
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {headerBar}
      <div className={`${mxWidth} mx-auto px-6 py-6`}>
        {pageTitle}
        {children}
      </div>
    </div>
  )
}

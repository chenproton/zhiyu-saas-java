'use client'

// 智能体编辑器（spec docs/spec/ai-service-center.md §7 F5/F6）：
// v2.6 全宽双栏 builder（对齐 zhiyu-ai builder 模式）：左表单分卡片，右栏 sticky 实时试聊。
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, MessageSquare, Send, Undo2 } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { aiCenterAgentApi } from '@/lib/api'
import type { AIAgent, AIAgentInput } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { AgentForm } from '../../components/agent-form'
import { AgentPreviewPanel } from '../../components/agent-preview'
import { AIStatusBadge } from '../../components/ai-status-badge'
import { StudioEditorShell } from '../../../_components/studio-editor-shell'

export default function AgentEditPage() {
  const params = useParams()
  const agentId = String(params.id)
  const t = useT()
  const router = useRouter()
  const { toast } = useToast()

  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [warnings, setWarnings] = useState<string[] | null>(null)
  // 表单实时状态（右栏试聊镜像）
  const [live, setLive] = useState({ prompt: '', name: '', avatar: '' })

  const loadAgent = useCallback(() => {
    aiCenterAgentApi
      .get(agentId)
      .then((data) => {
        setAgent(data)
        setLive({ prompt: data.systemPrompt, name: data.name, avatar: data.avatar })
      })
      .catch((err: unknown) =>
        toast({
          title: t('加载失败'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        }),
      )
      .finally(() => setLoading(false))
  }, [agentId, t, toast])

  useEffect(() => {
    loadAgent()
  }, [loadAgent])

  const handleSave = async (input: AIAgentInput) => {
    await aiCenterAgentApi.update(agentId, input)
    toast({ title: t('保存成功') })
    loadAgent()
  }

  const handleSubmit = async () => {
    if (acting) return
    setActing(true)
    try {
      const res = await aiCenterAgentApi.submit(agentId)
      // 关联私有库等提示：逐条展示 warnings（spec §3.1 AG-2）
      if (res.warnings && res.warnings.length > 0) {
        setWarnings(res.warnings)
      } else {
        toast({ title: t('已提交，等待管理员审核') })
      }
      loadAgent()
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setActing(false)
    }
  }

  const handleUnpublish = async () => {
    if (acting) return
    setActing(true)
    try {
      await aiCenterAgentApi.unpublish(agentId)
      toast({ title: t('已下架') })
      loadAgent()
    } catch (err) {
      toast({
        title: t('操作失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('加载中...')}
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">{t('加载失败')}</div>
    )
  }

  return (
    <StudioEditorShell
      wide
      icon={<span className="text-xl">{agent.avatar}</span>}
      title={agent.name}
      badge={<AIStatusBadge status={agent.status} />}
      actions={
        <>
          {/* 预览对话：创建者任意状态可用（spec AG-1 AC：预览仅创建者可用；后端 AgentChat 放行 owner） */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/portal/apps/ai/agents/${agent.id}`)}
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            {agent.status === 'published' ? t('去对话') : t('预览对话')}
          </Button>
          {(agent.status === 'private' || agent.status === 'rejected') && (
            <Button size="sm" onClick={handleSubmit} disabled={acting}>
              <Send className="w-4 h-4 mr-1" />
              {t('提交审核')}
            </Button>
          )}
          {agent.status === 'published' && (
            <Button size="sm" variant="outline" onClick={handleUnpublish} disabled={acting}>
              <Undo2 className="w-4 h-4 mr-1" />
              {t('下架')}
            </Button>
          )}
        </>
      }
    >
      {agent.status === 'rejected' && agent.reviewComment && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('驳回原因')}：{agent.reviewComment}
        </div>
      )}
      {agent.status === 'pending' && (
        <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          {t('审核中，请等待管理员处理')}
        </div>
      )}

      {/* 双栏 builder：左表单（分卡片），右栏实时试聊（xl 以下堆叠为上下） */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
        <AgentForm
          initial={agent}
          submitLabel={t('保存修改')}
          onSubmit={handleSave}
          onLiveChange={setLive}
        />
        <div className="hidden xl:block">
          <AgentPreviewPanel
            agentId={agent.id}
            systemPrompt={live.prompt}
            avatar={live.avatar}
            name={live.name}
          />
        </div>
      </div>

      {/* 提交审核 warnings（关联私有库对他人不可见，spec §3.1 AG-2） */}
      <Dialog open={!!warnings} onOpenChange={(open) => !open && setWarnings(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('已提交，等待管理员审核')}</DialogTitle>
            <DialogDescription>{t('提交成功，但请注意以下事项')}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {(warnings ?? []).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setWarnings(null)}>{t('确认')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioEditorShell>
  )
}

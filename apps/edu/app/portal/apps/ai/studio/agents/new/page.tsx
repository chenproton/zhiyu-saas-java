'use client'

// 新建智能体（spec docs/spec/ai-service-center.md §7 F5）。
// v2.6：全宽创作页 + 共享编辑器骨架（无侧边栏）；试聊面板需已有 agent，故新建页为单栏。
import { useRouter } from 'next/navigation'
import { Bot } from 'lucide-react'
import { useToast } from '@zhiyu/ui'
import { aiCenterAgentApi } from '@/lib/api'
import type { AIAgentInput } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { AgentForm } from '../../components/agent-form'
import { StudioEditorShell } from '../../../_components/studio-editor-shell'

export default function NewAgentPage() {
  const t = useT()
  const router = useRouter()
  const { toast } = useToast()

  const handleCreate = async (input: AIAgentInput) => {
    const agent = await aiCenterAgentApi.create(input)
    toast({ title: t('创建成功') })
    router.replace(`/portal/apps/ai/studio/agents/${agent.id}`)
  }

  return (
    <StudioEditorShell
      icon={
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="w-4.5 h-4.5 text-primary" />
        </div>
      }
      title={t('新建智能体')}
    >
      <AgentForm submitLabel={t('创建智能体')} onSubmit={handleCreate} />
    </StudioEditorShell>
  )
}

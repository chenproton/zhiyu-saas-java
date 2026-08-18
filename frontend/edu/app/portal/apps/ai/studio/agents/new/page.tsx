'use client'

// 新建智能体（spec docs/spec/ai-service-center.md §7 F5）。
// v2.6.1 双栏 builder（对齐 zhiyu-ai 智能体开发页）：左侧全部表单，右侧预览对话——
// 保存前为占位卡（预览端点需已有 agent）；保存创建成功后自动进入编辑形态，右栏试聊激活。
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, MessageSquare } from 'lucide-react'
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
  const [live, setLive] = useState({ prompt: '', name: '', avatar: '' })

  const handleCreate = async (input: AIAgentInput) => {
    const agent = await aiCenterAgentApi.create(input)
    toast({ title: t('创建成功，现在可以在右侧试聊了') })
    router.replace(`/portal/apps/ai/studio/agents/${agent.id}`)
  }

  return (
    <StudioEditorShell
      wide
      icon={
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-base">
          {live.avatar || <Bot className="w-4 h-4 text-primary" />}
        </div>
      }
      title={live.name.trim() || t('新建智能体')}
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
        <AgentForm submitLabel={t('创建智能体')} onSubmit={handleCreate} onLiveChange={setLive} />
        {/* 保存前占位（与编辑页右栏同尺寸 sticky 面板） */}
        <div className="hidden xl:block">
          <div className="bg-white rounded-2xl border border-dashed border-[#d6d3d1] h-[calc(100vh-8.5rem)] sticky top-[7.5rem] flex flex-col items-center justify-center text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-[#0f172a]">{t('预览对话')}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {t('在左侧填写并保存后，即可在这里用当前配置实时试聊效果')}
            </p>
          </div>
        </div>
      </div>
    </StudioEditorShell>
  )
}

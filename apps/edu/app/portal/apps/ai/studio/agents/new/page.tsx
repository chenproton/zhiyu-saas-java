'use client'

// 新建智能体（spec docs/spec/ai-service-center.md §7 F5）。
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@zhiyu/ui'
import { aiCenterAgentApi } from '@/lib/api'
import type { AIAgentInput } from '@/lib/api'
import { useT } from '@/lib/i18n/locale-provider'
import { AgentForm } from '../../components/agent-form'

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
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/portal/apps/ai/studio')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('返回')}
        </Button>
        <h1 className="text-xl font-semibold">{t('新建智能体')}</h1>
      </div>
      <div className="rounded-lg border border-gray-100 bg-white shadow-sm p-6">
        <AgentForm submitLabel={t('创建智能体')} onSubmit={handleCreate} />
      </div>
    </div>
  )
}

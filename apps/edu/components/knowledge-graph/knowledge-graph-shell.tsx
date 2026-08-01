'use client'

import { useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Network, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GraphNode, GraphEdge } from './types'
import { ChunkErrorBoundary } from '@/components/chunk-error-handler'

const KnowledgeGraphView = dynamic(
  () => import('./knowledge-graph-view').then((mod) => mod.KnowledgeGraphView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
        图谱加载中…
      </div>
    ),
  },
)

const KnowledgeGraphD3View = dynamic(
  () => import('./knowledge-graph-d3-view').then((mod) => mod.KnowledgeGraphD3View),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
        图谱加载中…
      </div>
    ),
  },
)

function ViewToggle({
  mode,
  onChange,
}: {
  mode: 'static' | 'force'
  onChange: (m: 'static' | 'force') => void
}) {
  return (
    <div className="flex items-center rounded-lg border bg-muted/60 p-0.5">
      <button
        onClick={() => onChange('static')}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          mode === 'static'
            ? 'bg-gradient-to-r from-[#5b76e8] to-[#8c6ff0] text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Network className="size-3.5" />
        静态
      </button>
      <button
        onClick={() => onChange('force')}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          mode === 'force'
            ? 'bg-gradient-to-r from-[#5b76e8] to-[#8c6ff0] text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <GitBranch className="size-3.5" />
        力矩
      </button>
    </div>
  )
}

interface KnowledgeGraphShellProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  title: string
  description: string
  nodeLabels?: Record<string, string>
  toolbarSlot?: ReactNode
  className?: string
  emptyView?: ReactNode
}

/** 知识图谱渲染外壳：统一视图切换、动态加载、错误边界 */
export function KnowledgeGraphShell({
  nodes,
  edges,
  title,
  description,
  nodeLabels,
  toolbarSlot,
  className,
  emptyView,
}: KnowledgeGraphShellProps) {
  const [viewMode, setViewMode] = useState<'static' | 'force'>('force')

  if (nodes.length === 0 && emptyView) {
    return <>{emptyView}</>
  }

  const toolbar = toolbarSlot ?? <ViewToggle mode={viewMode} onChange={setViewMode} />
  const sharedProps = {
    nodes,
    edges,
    compact: true,
    className: 'flex-1 min-h-0',
    toolbarSlot: toolbar,
    title,
    description,
    nodeLabels,
  }

  return (
    <div className={cn('flex flex-col', className || 'h-[600px]')}>
      {viewMode === 'static' ? (
        <ChunkErrorBoundary Component={KnowledgeGraphView} componentProps={sharedProps} />
      ) : (
        <ChunkErrorBoundary Component={KnowledgeGraphD3View} componentProps={sharedProps} />
      )}
    </div>
  )
}

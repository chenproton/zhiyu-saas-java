'use client'

import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
  X,
  ArrowDownFromLine,
  ArrowUpFromLine,
  Archive,
  Search,
} from 'lucide-react'
import { PageHeaderCard } from '@/components/shared/page-header-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/auth-provider'
import { useToast, FormDialogFooter } from '@zhiyu/ui'
import { UserSelector } from '@/components/shared/user-selector'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/search-input'
import { ImportConfirmDialog } from '@/components/shared/import-confirm-dialog'
import { ImportWizardDialog } from '@/components/shared/import-wizard-dialog'
import { useImportFlow } from '@/hooks/use-import-flow'
import { majorApi, workflowApi, downloadBlob } from '@/lib/api'
import type { Major, Workflow } from '@/lib/types/backend'
import type { ImportPreviewResult, ListResponse } from '@/lib/api'
import { reportError } from '@/lib/error-handling'
import { useT } from '@/lib/i18n/locale-provider'

// ─── Types ───────────────────────────────────────────────────────────────

export interface ContentListItem {
  id: string
  name: string
  status: string
  batchId?: string
  creatorId?: string
  coCreatorIds?: string[]
  rejectReason?: string
  code?: string
  description?: string
  isDraftPool?: boolean
  questionCount?: number
  totalScore?: number
  creatorName?: string
  collaboratorNames?: string[]
  updatedAt?: string
}

export interface ContentBatch {
  id: string
  name: string
  workflowId?: string
}

export interface ContentApi<T> {
  list: (params?: Record<string, any>) => Promise<ListResponse<T>>
  // create/update 载荷：各域 API 的 TCreate/TUpdate 形态不一（Omit 专用类型），值约束由 createPayload 承担
  create: (req: any) => Promise<T>
  submit: (id: string) => Promise<unknown>
  withdraw: (id: string) => Promise<unknown>
  publish: (id: string) => Promise<unknown>
  unpublish: (id: string) => Promise<unknown>
  archive: (id: string) => Promise<unknown>
  delete: (id: string) => Promise<unknown>
  invite: (id: string, userId: string) => Promise<unknown>
  update: (id: string, req: any) => Promise<T>
  clone?: (id: string, body?: any) => Promise<T>
}

export interface ContentBatchApi<T> {
  list: (params?: Record<string, any>) => Promise<ListResponse<T>>
}

export interface ContentApprovalRecord {
  targetId: string
  history?: { action?: string; status?: string; remark?: string; comment?: string }[]
}

export interface ContentApprovalApi<T extends ContentApprovalRecord = ContentApprovalRecord> {
  list: (params?: Record<string, any>) => Promise<ListResponse<T>>
  create: (req: { targetType: string; targetId: string; workflowId?: string }) => Promise<unknown>
  review: (
    id: string,
    req: { status: 'approved' | 'rejected'; comment?: string; stepIdx?: number },
  ) => Promise<unknown>
}

export interface ContentImportExportApi {
  import: (
    entity: string,
    file: File,
    overwrite?: boolean,
    rename?: boolean,
  ) => Promise<{
    created: number
    failed: number
    skipped?: number
    permissionSkipped?: number
    errors?: string[]
  }>
  importPreview?: (entity: string, file: File) => Promise<ImportPreviewResult>
  export: (entity: string) => Promise<Response>
  importExcel?: (
    entity: string,
    file: File,
    overwrite?: boolean,
    rename?: boolean,
  ) => Promise<{
    created: number
    failed: number
    skipped?: number
    permissionSkipped?: number
    entity: string
    errors?: string[]
  }>
  importExcelPreview?: (entity: string, file: File) => Promise<ImportPreviewResult>
  downloadTemplate?: (entity: 'positions' | 'scenarios' | 'courses') => Promise<Response>
  exportScenariosExcel?: (ids: string[]) => Promise<Response>
  exportPositionsExcel?: (ids: string[]) => Promise<Response>
  exportCoursesExcel?: (ids: string[]) => Promise<Response>
  exportGranularCoursesExcel?: (ids: string[]) => Promise<Response>
  exportQuestionBanksExcel?: (ids: string[]) => Promise<Response>
  exportExamsExcel?: (ids: string[]) => Promise<Response>
}

export interface ContentListPageConfig<
  T extends ContentListItem,
  B extends { id: string } = T,
  Batch = B,
> {
  title: string
  subtitle: string
  entityLabel: string
  addHref: string

  permissionModule: string
  permissionResource: string

  itemApi: ContentApi<B>
  batchApi: ContentBatchApi<Batch>
  approvalApi: ContentApprovalApi
  importExportApi: ContentImportExportApi

  approvalTargetType: string
  importEntityName?: string
  exportEntityName?: string
  importExcelEntity?: string

  statusFilterOptions: { value: string; label: string }[]

  /** 分组状态筛选（与 statusFilterOptions 并存，独立生效且叠加过滤）。
   *  存在时在筛选栏额外渲染一个分组下拉，如教学计划的「未排课/已排课」 */
  groupStatusFilterOptions?: { value: string; label: string; statuses: string[] }[]

  mapItem: (backend: B, currentUserId: string) => T
  mapBatch: (backend: Batch) => ContentBatch
  afterLoad?: (items: T[], batches: ContentBatch[]) => Promise<T[]>

  createPayload: (userId: string, entityLabel: string) => Partial<B>
  createRedirectUrl?: (id: string) => string
  listParams?: Record<string, any>

  coBuilderField?: string

  /** 是否展示克隆能力（行内+批量按钮），默认 true；教学计划等按业务语义禁用的资源可关闭 */
  enableClone?: boolean
  /** 是否展示批量导出按钮，默认 true */
  enableBatchExport?: boolean

  renderList: (props: ListRenderProps<T>) => ReactNode

  onCreate?: () => void

  extraHeaderActions?: ReactNode
  listExtraProps?: Record<string, any>
  children?: ReactNode
}

export interface ListRenderProps<T extends ContentListItem> {
  activeTab: TabType
  items: T[]
  selectedIds: string[]
  onSelectId: (id: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onClone: (item: T) => void
  onDelete: (item: T) => void
  onSubmitApproval: (item: T) => void
  onWithdrawApproval: (item: T) => void
  onViewRejectReason: (item: T) => void
  onPublish: (item: T) => void
  onUnpublish: (item: T) => void
  onArchive: (item: T) => void
  onInviteCoBuild: (item: T) => void
  batchMap: Map<string, string>
  extraProps?: Record<string, any>
}

type TabType = 'my' | 'collab' | 'public' | 'all'
type ViewMode = 'list' | 'group'

// ─── Component ──────────────────────────────────────────────────────────

export function ContentListPage<T extends ContentListItem, B extends { id: string } = T, Batch = B>(
  config: ContentListPageConfig<T, B, Batch>,
) {
  const {
    title,
    subtitle,
    entityLabel,
    addHref,
    permissionModule,
    permissionResource,
    itemApi,
    batchApi,
    approvalApi,
    importExportApi,
    approvalTargetType,
    importEntityName = '',
    exportEntityName = '',
    statusFilterOptions,
    groupStatusFilterOptions,
    mapItem,
    mapBatch,
    createPayload,
    createRedirectUrl,
    listParams,
    renderList,
    extraHeaderActions,
    listExtraProps,
    children,
    afterLoad,
    coBuilderField = 'coCreatorIds',
    importExcelEntity,
    enableClone = true,
    enableBatchExport = true,
  } = config

  const router = useRouter()
  const { hasPermission, user, tenantId, activeRoleCode } = useAuth()
  const currentUserId = user?.id ?? ''
  const { toast } = useToast()
  const t = useT()

  // 学校管理员（含平台管理员）可查看租户内全部用户的资源
  const canViewAll =
    activeRoleCode === 'school_admin' || activeRoleCode === 'platform_admin'

  const [frontItems, setFrontItems] = useState<T[]>([])
  const [batches, setBatches] = useState<ContentBatch[]>([])
  const [majors, setMajors] = useState<Major[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [activeTab, setActiveTab] = useState<TabType>('my')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedGroupStatus, setSelectedGroupStatus] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedBatches, setExpandedBatches] = useState<string[]>([])

  // Dialogs
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isBatchMoveDialogOpen, setIsBatchMoveDialogOpen] = useState(false)
  const [moveTargetBatchId, setMoveTargetBatchId] = useState('')
  const [moveSelectedMajorId, setMoveSelectedMajorId] = useState('all')
  const [batchMoveMode, setBatchMoveMode] = useState<'move' | 'bindThenSubmit'>('move')
  const [batchSubmitEligibleIds, setBatchSubmitEligibleIds] = useState<string[]>([])
  const [batchSubmitTab, setBatchSubmitTab] = useState<'batch' | 'workflow'>('batch')
  const [batchSubmitWorkflowId, setBatchSubmitWorkflowId] = useState('')
  const [isSubmitBatchDialogOpen, setIsSubmitBatchDialogOpen] = useState(false)
  const [submitBatchTarget, setSubmitBatchTarget] = useState<T | null>(null)
  const [submitSelectedBatchId, setSubmitSelectedBatchId] = useState('')
  const [submitSelectedMajorId, setSubmitSelectedMajorId] = useState('all')
  const [submitTab, setSubmitTab] = useState<'batch' | 'workflow'>('batch')
  const [submitWorkflowId, setSubmitWorkflowId] = useState('')
  const [isCloneRenameDialogOpen, setIsCloneRenameDialogOpen] = useState(false)
  const [cloneRenameValue, setCloneRenameValue] = useState('')
  const cloneRenameValueRef = useRef('')
    const cloneTargetRef = useRef<T | null>(null)
  const [isRejectReasonDialogOpen, setIsRejectReasonDialogOpen] = useState(false)
  const [rejectReasonItem, setRejectReasonItem] = useState<T | null>(null)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteTarget, setInviteTarget] = useState<T | null>(null)
  const [inviteSelectedIds, setInviteSelectedIds] = useState<string[]>([])
  const [confirmAction, setConfirmAction] = useState<{
    type: 'archive' | 'delete'
    item: T
  } | null>(null)
  const [confirmPending, setConfirmPending] = useState(false)
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)

  const hasExcel = !!importExcelEntity

  // 回调/mapItem 等由调用方内联传入，引用每次渲染都会变化；
  // 用 ref 持有最新值，避免 loadData 因引用变化被重复触发
  const mapItemRef = useRef(mapItem)
  const mapBatchRef = useRef(mapBatch)
  const afterLoadRef = useRef(afterLoad)
  const listParamsRef = useRef(listParams)
  // 请求序号：reloadKey 连续 bump 时仅应用最新一次加载结果
  const loadSeqRef = useRef(0)
  useEffect(() => {
    mapItemRef.current = mapItem
    mapBatchRef.current = mapBatch
    afterLoadRef.current = afterLoad
    listParamsRef.current = listParams
  })
  // listParams 常由调用方以内联对象传入，引用每次渲染都会变化；
  // 通过 JSON 序列化得到内容 key，相同内容时 key 不变，从而避免不必要的 reload。
  const listParamsKey = useMemo(() => JSON.stringify(listParams || {}), [listParams])
  // 参数内容变化时通过 bump reloadKey 间接触发重新加载
  const prevListParamsKey = useRef(listParamsKey)
  useEffect(() => {
    if (prevListParamsKey.current !== listParamsKey) {
      prevListParamsKey.current = listParamsKey
      setReloadKey((k) => k + 1)
    }
  }, [listParamsKey])

  const {
    fileInputRef,
    importFiles,
    setImportFiles,
    isImporting,
    isDownloading,
    importPreview,
    setImportPreview,
    handleAddFiles,
    handleRemoveFile,
    handleImport,
    executeImport,
    handleDownloadTemplate,
  } = useImportFlow({
    importType: (importExcelEntity || 'positions') as 'positions' | 'scenarios' | 'courses',
    entityLabel,
    templateFileName: `${entityLabel}批量导入模板.xlsx`,
    onSuccess: async () => {
      setIsImportDialogOpen(false)
      setIsImportConfirmOpen(false)
      await refresh()
    },
  })

  // 导入预览数据（来自 use-import-flow）到达时打开确认弹窗，属外部数据驱动的 UI 同步
  useEffect(() => {
    if (importPreview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsImportConfirmOpen(true)
    }
  }, [importPreview])

  const loadData = useCallback(async () => {
    const loadSeq = ++loadSeqRef.current
    setIsLoading(true)
    setLoadError(null)
    try {
      const [itemsResp, batchesResp] = await Promise.all([
        itemApi.list({ limit: 1000, ...(listParamsRef.current || {}) }),
        batchApi.list({ limit: 1000 }),
      ])
      const mappedBatches = batchesResp.items.map(mapBatchRef.current)

      if (tenantId) {
        try {
          const [majorsResp, workflowsResp] = await Promise.all([
            majorApi.list({ tenantId, limit: 1000 }),
            workflowApi.list({ limit: 1000 }),
          ])
          let majorsUpdated: Major[] = []
          let workflowsUpdated: Workflow[] = []
          majorsUpdated = (majorsResp.items as Major[]).filter((m) => m.enabled)
          workflowsUpdated = workflowsResp.items as Workflow[]
          // 仅在最新一次请求中落 state，防止旧响应覆盖新数据
          if (loadSeq === loadSeqRef.current) {
            setMajors(majorsUpdated)
            setWorkflows(workflowsUpdated)
          }
        } catch (err) {
          reportError(err, '加载专业与审批流配置')
        }
      }
      let front = itemsResp.items.map((i) => mapItemRef.current(i, currentUserId))
      if (afterLoadRef.current) front = await afterLoadRef.current(front, mappedBatches)

      const rejectedItems = front.filter((item) => item.status === 'rejected')
      if (rejectedItems.length > 0) {
        try {
          const approvalsResp = await approvalApi.list({
            targetType: approvalTargetType,
            status: 'rejected',
            limit: 1000,
          })
          const reasonMap = new Map<string, string>()
          for (const record of approvalsResp.items) {
            if (reasonMap.has(record.targetId)) continue
            const history = record.history || []
            for (let i = history.length - 1; i >= 0; i--) {
              const h = history[i]
              const action = h.action || h.status
              const remark = h.remark || h.comment
              if (action === 'rejected' && remark) {
                reasonMap.set(record.targetId, remark)
                break
              }
            }
          }
          front = front.map((item) => {
            if (item.status === 'rejected' && reasonMap.has(item.id)) {
              return { ...item, rejectReason: reasonMap.get(item.id) }
            }
            return item
          })
        } catch (err) {
          reportError(err, '加载审批拒绝原因')
        }
      }

      // 仅应用最新一次请求的结果，防止 reloadKey 连续 bump 时旧响应覆盖新数据
      if (loadSeq !== loadSeqRef.current) return
      setBatches(mappedBatches)
      setExpandedBatches(mappedBatches.map((b) => b.id))
      setFrontItems(front)
    } catch (err) {
      if (loadSeq !== loadSeqRef.current) return
      reportError(err, '加载列表数据')
      setLoadError(
        err instanceof Error ? err.message : t('加载{entityLabel}列表失败', { entityLabel }),
      )
    } finally {
      if (loadSeq === loadSeqRef.current) setIsLoading(false)
    }
  }, [tenantId, currentUserId, approvalTargetType, approvalApi, batchApi, itemApi, entityLabel, t])

  useEffect(() => {
    ;(async () => {
      await loadData()
    })()
  }, [loadData, reloadKey])

  // 通过 bump reloadKey 间接触发重新加载，避免事件回调闭包直接引用 loadData
  // （loadData 内部读取 latest-ref，直接引用会形成渲染期 ref 引用链）
  const refresh = async () => {
    setReloadKey((k) => k + 1)
  }

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId],
    )
  }

  const tabFiltered = useMemo(() => {
    switch (activeTab) {
      case 'my':
        return frontItems.filter((i) => i.creatorId === currentUserId)
      case 'collab':
        return frontItems.filter(
          (i) => i.creatorId !== currentUserId && i.coCreatorIds?.includes(currentUserId),
        )
      case 'all':
        return frontItems
      default:
        return frontItems.filter((i) => i.status === 'published')
    }
  }, [frontItems, activeTab, currentUserId])

  const filtered = useMemo(() => {
    let result = tabFiltered
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (selectedBatchId) {
      result = result.filter((i) => i.batchId === selectedBatchId)
    }
    if (selectedStatus) {
      result = result.filter((i) => i.status === selectedStatus)
    } else {
      result = result.filter((i) => i.status !== 'archived')
    }
    if (selectedGroupStatus) {
      const group = groupStatusFilterOptions?.find((o) => o.value === selectedGroupStatus)
      if (group) {
        result = result.filter((i) => group.statuses.includes(i.status))
      }
    }
    return result
  }, [tabFiltered, searchQuery, selectedBatchId, selectedStatus, selectedGroupStatus, groupStatusFilterOptions])

  const stats = useMemo(() => {
    const total = filtered.length
    const draft = filtered.filter((i) => i.status === 'draft').length
    const pending = filtered.filter((i) => i.status === 'pending').length
    const rejected = filtered.filter((i) => i.status === 'rejected').length
    const published = filtered.filter((i) => i.status === 'published').length
    return { total, draft, pending, rejected, published }
  }, [filtered])

  const itemsByBatch = useMemo(() => {
    if (viewMode !== 'group') return null
    const groups: Record<string, T[]> = {}
    filtered.forEach((item) => {
      if (!item.batchId) return
      if (!groups[item.batchId]) groups[item.batchId] = []
      groups[item.batchId].push(item)
    })
    return groups
  }, [filtered, viewMode])

  // 未分类：收纳所有未绑定批次的资源（不限于草稿，否则已发布/审批中等无批次资源会在分组视图丢失）
  const uncategorized = useMemo(() => filtered.filter((i) => !i.batchId), [filtered])

  const batchMap = useMemo(() => {
    const map = new Map<string, string>()
    batches.forEach((b) => map.set(b.id, b.name))
    return map
  }, [batches])

  const moveFilteredBatches = useMemo(() => {
    if (moveSelectedMajorId === 'all') return batches
    return batches.filter((b) => {
      const wf = workflows.find((w) => w.id === b.workflowId)
      return wf && (wf.majorIds || []).includes(moveSelectedMajorId)
    })
  }, [batches, workflows, moveSelectedMajorId])

  const submitFilteredBatches = useMemo(() => {
    if (submitSelectedMajorId === 'all') return batches
    return batches.filter((b) => {
      const wf = workflows.find((w) => w.id === b.workflowId)
      return wf && (wf.majorIds || []).includes(submitSelectedMajorId)
    })
  }, [batches, workflows, submitSelectedMajorId])

  const handleSelectId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((sid) => sid !== id)))
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(filtered.map((i) => i.id))
    else setSelectedIds([])
  }

  const selectedFront = frontItems.filter((i) => selectedIds.includes(i.id))
  const hasSelected = selectedIds.length > 0

  const canBatchSubmit = selectedFront.some((i) => i.status === 'draft' || i.status === 'rejected')
  const canBatchWithdraw = selectedFront.some((i) => i.status === 'pending')
  const canBatchUnpublish = selectedFront.some((i) => i.status === 'published')
  const canBatchPublish = selectedFront.some((i) => i.status === 'approved')
  const canBatchDelete = selectedFront.some(
    (i) => i.status === 'draft' || i.status === 'rejected' || i.status === 'archived',
  )
  const canBatchArchive = selectedFront.some((i) =>
    ['draft', 'rejected', 'approved', 'published'].includes(i.status),
  )

  // ─── Handlers ──────────────────────────────────────────────────────────

  // 批量提交审批使用锁防止重复触发（双击按钮/并发调用），
  // 避免同一岗位被 submit 两次导致第二次返回 400（pending -> pending）
  const batchSubmitLock = useRef(false)

  const doBatchSubmit = async (submitItems: { id: string; batchId: string }[]) => {
    if (batchSubmitLock.current) {
      return
    }
    batchSubmitLock.current = true
    try {
      for (const { id, batchId } of submitItems) {
        const batch = batches.find((b) => b.id === batchId)
        if (!batch) {
          continue
        }
        try {
          await itemApi.submit(id)
          await approvalApi.create({
            targetType: approvalTargetType,
            targetId: id,
            workflowId: batch.workflowId,
          })
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: t('提交审批失败'),
            description: err.message || t('请稍后重试'),
          })
        }
      }
    } finally {
      batchSubmitLock.current = false
    }
  }

  const handleBatchSubmitApproval = async () => {
    const eligibleItems = selectedIds
      .map((id) => {
        const item = frontItems.find((i) => i.id === id)
        return item && (item.status === 'draft' || item.status === 'rejected') ? item : null
      })
      .filter(Boolean) as T[]
    const hasUnbound = eligibleItems.some((item) => !item.batchId)
    if (hasUnbound) {
      setBatchMoveMode('bindThenSubmit')
      setBatchSubmitEligibleIds(eligibleItems.map((item) => item.id))
      setMoveSelectedMajorId('all')
      setMoveTargetBatchId('')
      setBatchSubmitTab('batch')
      setBatchSubmitWorkflowId('')
      setIsBatchMoveDialogOpen(true)
      return
    }
    await doBatchSubmit(eligibleItems.map((item) => ({ id: item.id, batchId: item.batchId! })))
    setSelectedIds([])
    await refresh()
  }

  const handleBatchWithdrawApproval = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && item.status === 'pending') {
        try {
          await itemApi.withdraw(id)
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: t('撤回审批失败'),
            description: err.message || t('请稍后重试'),
          })
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchUnpublish = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && item.status === 'published') {
        try {
          await itemApi.unpublish(id)
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: t('取消发布失败'),
            description: err.message || t('请稍后重试'),
          })
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchPublish = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && item.status === 'approved') {
        try {
          await itemApi.publish(id)
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: t('发布失败'),
            description: err.message || t('请稍后重试'),
          })
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchDelete = async () => {
    for (const id of selectedIds) {
      try {
        await itemApi.delete(id)
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: t('删除失败'),
          description: err.message || t('请稍后重试'),
        })
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleArchive = async (item: T) => {
    setConfirmAction({ type: 'archive', item })
  }

  const handleConfirmAction = async () => {
    if (!confirmAction || confirmPending) return
    const { type, item } = confirmAction
    setConfirmPending(true)
    try {
      if (type === 'archive') {
        await itemApi.archive(item.id)
      } else {
        await itemApi.delete(item.id)
      }
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: type === 'archive' ? t('归档失败') : t('删除失败'),
        description: err.message || t('请稍后重试'),
      })
    } finally {
      setConfirmAction(null)
      setConfirmPending(false)
    }
  }

  const handleBatchArchive = async () => {
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (item && ['draft', 'rejected', 'approved', 'published'].includes(item.status)) {
        try {
          await itemApi.archive(item.id)
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: t('归档失败'),
            description: err.message || t('请稍后重试'),
          })
        }
      }
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchClone = async () => {
    let failed = 0
    for (const id of selectedIds) {
      const item = frontItems.find((i) => i.id === id)
      if (!item) continue
      try {
        if (itemApi.clone) {
          await itemApi.clone(item.id, { name: `${item.name}-copy` })
        } else {
          await itemApi.create({
            ...createPayload(currentUserId, entityLabel),
            name: `${item.name}-copy`,
            batchId: item.batchId,
          })
        }
      } catch (err) {
        failed++
        reportError(err, '批量克隆')
      }
    }
    if (failed > 0) {
      toast({
        variant: 'destructive',
        title: t('批量克隆失败'),
        description: t('{failed} 项克隆失败，请稍后重试', { failed }),
      })
    }
    setSelectedIds([])
    await refresh()
  }

  const handleBatchExport = async () => {
    try {
      const res = await importExportApi.export(exportEntityName)
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition')
      downloadBlob(
        blob,
        disposition?.match(/filename="?([^";]+)"?/)?.[1] || `${exportEntityName}-export.csv`,
      )
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导出失败'),
        description: err.message || t('导出失败'),
      })
    }
    setSelectedIds([])
  }

  const handleBatchMove = () => {
    setBatchMoveMode('move')
    setBatchSubmitEligibleIds([])
    setMoveSelectedMajorId('all')
    setMoveTargetBatchId('')
    setIsBatchMoveDialogOpen(true)
  }

  const handleConfirmMove = async () => {
    if (batchMoveMode === 'bindThenSubmit') {
      if (batchSubmitTab === 'workflow') {
        if (!batchSubmitWorkflowId || batchSubmitLock.current) return
        batchSubmitLock.current = true
        try {
          for (const id of batchSubmitEligibleIds) {
            try {
              await itemApi.submit(id)
              await approvalApi.create({
                targetType: approvalTargetType,
                targetId: id,
                workflowId: batchSubmitWorkflowId,
              })
            } catch (err: any) {
              toast({
                variant: 'destructive',
                title: t('提交审批失败'),
                description: err.message || t('请稍后重试'),
              })
            }
          }
        } finally {
          batchSubmitLock.current = false
        }
        setBatchSubmitEligibleIds([])
        setBatchMoveMode('move')
        setIsBatchMoveDialogOpen(false)
        setBatchSubmitWorkflowId('')
        setSelectedIds([])
        await refresh()
        return
      }
      if (!moveTargetBatchId) return
      const submitItems = batchSubmitEligibleIds
        .map((id) => {
          const item = frontItems.find((i) => i.id === id)
          return { id, batchId: item?.batchId || moveTargetBatchId }
        })
        .filter((it) => it.batchId)
      const unboundIds = submitItems
        .filter((it) => {
          const item = frontItems.find((i) => i.id === it.id)
          return item && !item.batchId
        })
        .map((it) => it.id)
      for (const id of unboundIds) {
        try {
          await itemApi.update(id, { batchId: moveTargetBatchId })
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: t('绑定批次失败'),
            description: err.message || t('请稍后重试'),
          })
        }
      }
      await doBatchSubmit(submitItems)
      setBatchSubmitEligibleIds([])
      setBatchMoveMode('move')
      setIsBatchMoveDialogOpen(false)
      setMoveTargetBatchId('')
      setSelectedIds([])
      await refresh()
      return
    }
    if (!moveTargetBatchId) return
    for (const id of selectedIds) {
      try {
        await itemApi.update(id, { batchId: moveTargetBatchId })
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: t('调整批次失败'),
          description: err.message || t('请稍后重试'),
        })
      }
    }
    setSelectedIds([])
    setIsBatchMoveDialogOpen(false)
    setMoveTargetBatchId('')
    await refresh()
  }

  const handleClone = (item: T) => {
    cloneTargetRef.current = item
    const name = `${item.name} (克隆)`
    cloneRenameValueRef.current = name
    setCloneRenameValue(name)
    setIsCloneRenameDialogOpen(true)
  }

  const handleConfirmClone = async () => {
    const target = cloneTargetRef.current
    if (!target) return
    const name = cloneRenameValueRef.current?.trim()
    if (!name) {
      toast({ variant: 'destructive', title: t('克隆失败'), description: t('请输入克隆名称') })
      return
    }
    try {
      if (itemApi.clone) {
        await itemApi.clone(target.id, { name })
      } else {
        await itemApi.create({
          ...createPayload(currentUserId, entityLabel),
          name,
          batchId: target.batchId,
        })
      }
      setIsCloneRenameDialogOpen(false)
      cloneTargetRef.current = null
      cloneRenameValueRef.current = ''
      setCloneRenameValue('')
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('克隆失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const handleDelete = async (item: T) => {
    setConfirmAction({ type: 'delete', item })
  }

  const handleSubmitApproval = async (item: T) => {
    if (!item.batchId) {
      setSubmitBatchTarget(item)
      setSubmitSelectedMajorId('all')
      setSubmitSelectedBatchId('')
      setSubmitTab('batch')
      setSubmitWorkflowId('')
      setIsSubmitBatchDialogOpen(true)
      return
    }
    const batch = batches.find((b) => b.id === item.batchId)
    if (!batch) {
      toast({
        variant: 'destructive',
        title: t('提示'),
        description: t('该{entityLabel}未关联批次，无法提交审批', { entityLabel }),
      })
      return
    }
    try {
      await itemApi.submit(item.id)
      await approvalApi.create({
        targetType: approvalTargetType,
        targetId: item.id,
        workflowId: batch.workflowId,
      })
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('提交失败'),
        description: err.message || t('提交审批失败，请稍后重试'),
      })
    }
  }

  const handleConfirmSubmitBatch = async () => {
    if (!submitBatchTarget || !submitSelectedBatchId) return
    const batch = batches.find((b) => b.id === submitSelectedBatchId)
    if (!batch) return
    try {
      await itemApi.update(submitBatchTarget.id, { batchId: submitSelectedBatchId })
      await itemApi.submit(submitBatchTarget.id)
      await approvalApi.create({
        targetType: approvalTargetType,
        targetId: submitBatchTarget.id,
        workflowId: batch.workflowId,
      })
      setIsSubmitBatchDialogOpen(false)
      setSubmitBatchTarget(null)
      setSubmitSelectedBatchId('')
      setSubmitSelectedMajorId('all')
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('提交失败'),
        description: err.message || t('提交审批失败，请稍后重试'),
      })
    }
  }

  const handleConfirmSubmitWorkflow = async () => {
    if (!submitBatchTarget || !submitWorkflowId) return
    try {
      await itemApi.submit(submitBatchTarget.id)
      await approvalApi.create({
        targetType: approvalTargetType,
        targetId: submitBatchTarget.id,
        workflowId: submitWorkflowId,
      })
      setIsSubmitBatchDialogOpen(false)
      setSubmitBatchTarget(null)
      setSubmitWorkflowId('')
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('提交失败'),
        description: err.message || t('提交审批失败，请稍后重试'),
      })
    }
  }

  const handleWithdrawApproval = async (item: T) => {
    try {
      await itemApi.withdraw(item.id)
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('撤回审批失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const handlePublish = async (item: T) => {
    try {
      await itemApi.publish(item.id)
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('发布失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const handleUnpublish = async (item: T) => {
    try {
      await itemApi.unpublish(item.id)
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('取消发布失败'),
        description: err.message || t('请稍后重试'),
      })
    }
  }

  const handleInviteCoBuild = (item: T) => {
    setInviteTarget(item)
    setInviteSelectedIds((item.coCreatorIds || []).filter((id) => id !== item.creatorId))
    setIsInviteDialogOpen(true)
  }

  const handleInviteConfirm = async () => {
    if (!inviteTarget) return
    try {
      await itemApi.update(inviteTarget.id, { [coBuilderField]: inviteSelectedIds })
      setIsInviteDialogOpen(false)
      setInviteTarget(null)
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: err.message || t('调整共建人失败，请稍后重试'),
      })
    }
  }

  const handleViewRejectReason = (item: T) => {
    setRejectReasonItem(item)
    setIsRejectReasonDialogOpen(true)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedBatchId(null)
    setSelectedStatus(null)
    setSelectedGroupStatus(null)
  }

  const handleImportFileSelect = (files: FileList | null) => {
    handleAddFiles(files)
  }

  const handleCsvImportClick = async () => {
    if (importFiles.length === 0) return
    setCsvImporting(true)
    try {
      let preview: ImportPreviewResult | null = null
      if (importExportApi.importPreview) {
        preview = await importExportApi.importPreview(importEntityName, importFiles[0])
      }
      if (preview && preview.duplicates > 0) {
        setImportPreview(preview)
        setCsvImporting(false)
        return
      }
      await doCsvImport('skip')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导入失败'),
        description: err.message || t('导入失败'),
      })
      setCsvImporting(false)
    }
  }

  const doCsvImport = async (mode: 'skip' | 'overwrite' | 'new' = 'skip') => {
    if (importFiles.length === 0) return
    setCsvImporting(true)
    try {
      const result = await importExportApi.import(
        importEntityName,
        importFiles[0],
        mode === 'overwrite',
        mode === 'new',
      )
      const skippedMsg =
        result.skipped != null ? t('，跳过 {skipped} 条', { skipped: result.skipped }) : ''
      const permissionMsg =
        result.permissionSkipped && result.permissionSkipped > 0
          ? t('，{count} 个资源非本人创建/未参与共建，已跳过覆盖', {
              count: result.permissionSkipped,
            })
          : ''
      toast({
        title: t('导入完成'),
        description: t('成功 {created} 条，失败 {failed} 条{skippedMsg}{permissionMsg}', {
          created: result.created,
          failed: result.failed,
          skippedMsg,
          permissionMsg,
        }),
      })
      setImportFiles([])
      setImportPreview(null)
      setIsImportDialogOpen(false)
      setIsImportConfirmOpen(false)
      await refresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导入失败'),
        description: err.message || t('导入失败'),
      })
    } finally {
      setCsvImporting(false)
    }
  }

  const doImport = async (mode: 'skip' | 'overwrite' | 'new' = 'skip') => {
    if (hasExcel) {
      await executeImport(mode)
      // useImportFlow.onSuccess 负责关闭弹窗与刷新
    } else {
      await doCsvImport(mode)
    }
  }

  const handleCreate = async () => {
    if (config.onCreate) {
      config.onCreate()
      return
    }
    try {
      const newItem = await itemApi.create(createPayload(currentUserId, entityLabel))
      const url = createRedirectUrl
        ? createRedirectUrl(newItem.id)
        : `${addHref}?id=${newItem.id}&new=true`
      router.push(url)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('创建失败'),
        description: err.message || t('创建失败'),
      })
    }
  }

  const listProps: ListRenderProps<T> = {
    activeTab,
    items: filtered,
    selectedIds,
    onSelectId: handleSelectId,
    onSelectAll: handleSelectAll,
    onClone: handleClone,
    onDelete: handleDelete,
    onSubmitApproval: handleSubmitApproval,
    onWithdrawApproval: handleWithdrawApproval,
    onViewRejectReason: handleViewRejectReason,
    onPublish: handlePublish,
    onUnpublish: handleUnpublish,
    onArchive: handleArchive,
    onInviteCoBuild: handleInviteCoBuild,
    batchMap,
    extraProps: listExtraProps,
  }

  const renderBatchSelector = (
    selectedMajorId: string,
    onMajorChange: (value: string) => void,
    selectedBatchId: string,
    onBatchChange: (id: string) => void,
    filteredBatches: ContentBatch[],
  ) => (
    <div className="space-y-4">
      {majors.length > 0 && (
        <Select value={selectedMajorId} onValueChange={onMajorChange}>
          <SelectTrigger className="h-9 w-full text-sm">
            <SelectValue placeholder={t('全部专业')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('全部专业')}</SelectItem>
            {majors.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[260px] overflow-y-auto">
        {filteredBatches.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 text-center">{t('暂无批次分组')}</div>
        ) : (
          filteredBatches.map((batch) => {
            const selected = selectedBatchId === batch.id
            return (
              <div
                key={batch.id}
                onClick={() => onBatchChange(batch.id)}
                className={cn(
                  'px-4 py-3 cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-slate-50 flex items-center justify-between gap-3',
                  selected && 'bg-primary/5',
                )}
              >
                <div className="min-w-0">
                  <div className={cn('font-medium text-sm', selected && 'text-primary')}>
                    {batch.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">ID: {batch.id.slice(0, 8)}</div>
                </div>
                {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  const renderWorkflowSelector = (value: string, onChange: (id: string) => void) => {
    const activeWorkflows = workflows.filter((w) => w.status === 'active')
    return (
      <div className="space-y-4">
        {activeWorkflows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-sm text-gray-500 text-center">
            {t('暂无启用的审批流程，请先在审批流程管理中启用')}
          </div>
        ) : (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-9 w-full text-sm">
              <SelectValue placeholder={t('选择审批流程')} />
            </SelectTrigger>
            <SelectContent>
              {activeWorkflows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-gray-400">
          {t('选择审批流程后直接提交，无需绑定批次分组；提交后资源仍可在批次分组视图中随时绑定')}
        </p>
      </div>
    )
  }

  const renderSubmitModeTabs = (
    tab: 'batch' | 'workflow',
    onTabChange: (v: 'batch' | 'workflow') => void,
    batchNode: ReactNode,
    workflowNode: ReactNode,
  ) => (
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange(v as 'batch' | 'workflow')}
      className="mt-2"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="batch">{t('按批次分组提交')}</TabsTrigger>
        <TabsTrigger value="workflow">{t('按审批流程提交')}</TabsTrigger>
      </TabsList>
      <TabsContent value="batch" className="mt-4">
        {batchNode}
      </TabsContent>
      <TabsContent value="workflow" className="mt-4">
        {workflowNode}
      </TabsContent>
    </Tabs>
  )

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title={title}
        description={subtitle}
        actions={
          <>
            {extraHeaderActions}
            {(hasExcel || !!importEntityName) && (
              <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {t('批量导入{entityLabel}', { entityLabel })}
              </Button>
            )}
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t('新建{entityLabel}', { entityLabel })}
            </Button>
          </>
        }
        stats={
          activeTab !== 'public'
            ? [
                {
                  label: t('{entityLabel}总数', { entityLabel }),
                  value: stats.total,
                  icon: <SlidersHorizontal className="h-3 w-3 text-primary" />,
                  iconClassName: 'bg-primary/5',
                },
                {
                  label: t('未提交'),
                  value: stats.draft,
                  icon: <RotateCcw className="h-3 w-3 text-gray-500" />,
                  iconClassName: 'bg-gray-50',
                },
                {
                  label: t('审批中'),
                  value: stats.pending,
                  icon: <GitBranch className="h-3 w-3 text-yellow-500" />,
                  iconClassName: 'bg-yellow-50',
                },
                {
                  label: t('已驳回'),
                  value: stats.rejected,
                  icon: <X className="h-3 w-3 text-red-500" />,
                  iconClassName: 'bg-red-50',
                },
                {
                  label: t('已发布'),
                  value: stats.published,
                  icon: <ArrowUpFromLine className="h-3 w-3 text-green-500" />,
                  iconClassName: 'bg-green-50',
                },
              ]
            : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as TabType)
            setSelectedIds([])
            setSelectedBatchId(null)
          }}
        >
          <TabsList
            className={`grid w-full max-w-md ${canViewAll ? 'grid-cols-4' : 'grid-cols-3'}`}
          >
            <TabsTrigger value="my" className="w-full">
              {t('我的{entityLabel}', { entityLabel })}
            </TabsTrigger>
            <TabsTrigger value="collab" className="w-full">
              {t('共建{entityLabel}', { entityLabel })}
            </TabsTrigger>
            <TabsTrigger value="public" className="w-full">
              {t('公共{entityLabel}', { entityLabel })}
            </TabsTrigger>
            {canViewAll && (
              <TabsTrigger value="all" className="w-full">
                {t('全部{entityLabel}', { entityLabel })}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as ViewMode)}
        >
          <ToggleGroupItem value="list" aria-label={t('资源列表')}>
            <List className="h-4 w-4" />
            <span className="ml-1.5">{t('资源列表')}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="group" aria-label={t('批次分组')}>
            <LayoutGrid className="h-4 w-4" />
            <span className="ml-1.5">{t('批次分组')}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                placeholder={t('搜索{entityLabel}名称', { entityLabel })}
                value={searchQuery}
                onChange={setSearchQuery}
                inputClassName="h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedBatchId || '__all__'}
                onValueChange={(v) => setSelectedBatchId(v === '__all__' ? null : v)}
              >
                <SelectTrigger className="h-9 text-sm w-44">
                  <SelectValue placeholder={t('按批次筛选')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('全部批次')}</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      <span className="flex items-center gap-2">
                        {batch.name}
                        <span className="text-xs text-gray-400">({batch.id.slice(0, 8)})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedStatus || '__all__'}
                onValueChange={(v) => setSelectedStatus(v === '__all__' ? null : v)}
              >
                <SelectTrigger className="h-9 text-sm w-36">
                  <SelectValue placeholder={t('按状态筛选')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('全部状态')}</SelectItem>
                  {statusFilterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {groupStatusFilterOptions && groupStatusFilterOptions.length > 0 && (
                <Select
                  value={selectedGroupStatus || '__all__'}
                  onValueChange={(v) => setSelectedGroupStatus(v === '__all__' ? null : v)}
                >
                  <SelectTrigger className="h-9 text-sm w-36">
                    <SelectValue placeholder={t('按排课状态筛选')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t('全部排课状态')}</SelectItem>
                    {groupStatusFilterOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={handleResetFilters}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {t('重置')}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span
              className={cn(
                'text-xs mr-1',
                hasSelected ? 'text-slate-700 font-medium' : 'text-slate-400',
              )}
            >
              {hasSelected
                ? t('已选择 {n} 项：', { n: selectedIds.length })
                : t('请选择{entityLabel}：', { entityLabel })}
            </span>
            {activeTab !== 'public' &&
              hasPermission(permissionModule, permissionResource, 'submit_approval') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!hasSelected || !canBatchSubmit}
                  onClick={handleBatchSubmitApproval}
                >
                  <Send className="mr-1 h-3 w-3" />
                  {t('提交审批')}
                </Button>
              )}
            {activeTab !== 'public' &&
              hasPermission(permissionModule, permissionResource, 'withdraw_approval') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!hasSelected || !canBatchWithdraw}
                  onClick={handleBatchWithdrawApproval}
                >
                  <Undo2 className="mr-1 h-3 w-3" />
                  {t('撤回审批')}
                </Button>
              )}
            {activeTab !== 'public' &&
              hasPermission(permissionModule, permissionResource, 'publish') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!hasSelected || !canBatchPublish}
                  onClick={handleBatchPublish}
                >
                  <ArrowUpFromLine className="mr-1 h-3 w-3" />
                  {t('发布')}
                </Button>
              )}
            {activeTab !== 'public' &&
              hasPermission(permissionModule, permissionResource, 'unpublish') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!hasSelected || !canBatchUnpublish}
                  onClick={handleBatchUnpublish}
                >
                  <ArrowDownFromLine className="mr-1 h-3 w-3" />
                  {t('取消发布')}
                </Button>
              )}
            {activeTab !== 'public' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-primary hover:text-primary"
                disabled={!hasSelected || !canBatchArchive}
                onClick={handleBatchArchive}
              >
                <Archive className="mr-1 h-3 w-3" />
                {t('归档')}
              </Button>
            )}
            {activeTab !== 'public' &&
              hasPermission(permissionModule, permissionResource, 'delete') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!hasSelected || !canBatchDelete}
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t('删除')}
                </Button>
              )}
            {enableClone && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!hasSelected}
                onClick={handleBatchClone}
              >
                <Copy className="mr-1 h-3 w-3" />
                {t('克隆')}
              </Button>
            )}
            {activeTab !== 'public' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!hasSelected}
                onClick={handleBatchMove}
              >
                <FolderKanban className="mr-1 h-3 w-3" />
                {t('调整批次分组')}
              </Button>
            )}
            {enableBatchExport && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!hasSelected}
                onClick={async () => {
                  const exportFn =
                    importExcelEntity === 'scenarios'
                      ? importExportApi.exportScenariosExcel
                      : importExcelEntity === 'positions'
                        ? importExportApi.exportPositionsExcel
                        : importExcelEntity === 'courses'
                          ? importExportApi.exportCoursesExcel
                          : importExcelEntity === 'granular-courses'
                            ? importExportApi.exportGranularCoursesExcel
                            : importExcelEntity === 'question-banks'
                              ? importExportApi.exportQuestionBanksExcel
                              : importExcelEntity === 'exams'
                                ? importExportApi.exportExamsExcel
                                : null
                  if (exportFn) {
                    try {
                      const res = await exportFn(selectedIds)
                      downloadBlob(await res.blob(), `${entityLabel}导出.xlsx`)
                    } catch (err: any) {
                      toast({
                        variant: 'destructive',
                        title: t('导出失败'),
                        description: err.message || t('导出失败'),
                      })
                    }
                  } else {
                    handleBatchExport()
                  }
                }}
              >
                <Download className="mr-1 h-3 w-3" />
                {t('导出')}
              </Button>
            )}
          </div>
        </CardContent>

        {!isLoading && filtered.length > 0 && viewMode !== 'group' && (
          <CardContent className="pt-0">
            {/* eslint-disable-next-line react-hooks/refs */}
            {renderList(listProps)}
          </CardContent>
        )}
      </Card>

      {/* eslint-disable react-hooks/refs */}
      {!isLoading && filtered.length > 0 && viewMode === 'group' && itemsByBatch && (
        <div className="space-y-4">
          {Object.entries(itemsByBatch).map(([batchId, batchItems]) => {
            const batch = batches.find((b) => b.id === batchId)
            if (!batch) return null
            const isExpanded = expandedBatches.includes(batchId)

            return (
              <Collapsible
                key={batchId}
                open={isExpanded}
                onOpenChange={() => toggleBatch(batchId)}
              >
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <CollapsibleTrigger asChild>
                    <div className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-800">{batch.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {t('{n} 个{entityLabel}', { n: batchItems.length, entityLabel })}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0">
                      {renderList({ ...listProps, items: batchItems })}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
          {uncategorized.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">{t('未分类')}</span>
                  <Badge variant="secondary" className="text-xs">
                    {t('{n} 个{entityLabel}', { n: uncategorized.length, entityLabel })}
                  </Badge>
                </div>
              </div>
              <div className="p-4 pt-0">{renderList({ ...listProps, items: uncategorized })}</div>
            </div>
          )}
        </div>
      )}
      {/* eslint-enable react-hooks/refs */}

      {!isLoading && loadError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-white py-20 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <X className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700">
            {t('{entityLabel}加载失败', { entityLabel })}
          </h3>
          <p className="mb-4 text-sm text-slate-500">{loadError}</p>
          <Button size="sm" variant="outline" onClick={() => refresh()}>
            {t('重试')}
          </Button>
        </div>
      )}

      {!isLoading && !loadError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-700">
            {t('暂无{entityLabel}', { entityLabel })}
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            {t('当前筛选条件下没有{entityLabel}数据', { entityLabel })}
          </p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t('新建{entityLabel}', { entityLabel })}
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
          <p className="text-sm text-slate-500">{t('加载中...')}</p>
        </div>
      )}

      {/* Import Dialog */}
      {hasExcel ? (
        <ImportWizardDialog
          open={isImportDialogOpen}
          onOpenChange={(open) => {
            setIsImportDialogOpen(open)
            if (!open) setImportFiles([])
          }}
          title={t('导入{entityLabel}', { entityLabel })}
          guideItems={[
            <>{t('点击下方按钮下载最新的导入模板（含系统字典数据）')}</>,
            <>{t('参照模板中各 Sheet 的填写说明，填入{entityLabel}数据', { entityLabel })}</>,
            <>{t('完成后点击"下一步"上传文件')}</>,
          ]}
          downloadLabel={t('下载{entityLabel}批量导入模板', { entityLabel })}
          onDownload={handleDownloadTemplate}
          uploadHint={t('点击选择已填写的 Excel (.xlsx) 文件')}
          importLabel={(count) => t('开始导入（{count} 个文件）', { count })}
          onImport={handleImport}
          files={importFiles}
          onAddFiles={handleAddFiles}
          onRemoveFile={handleRemoveFile}
          importing={isImporting}
          downloading={isDownloading}
        />
      ) : (
        <Dialog
          open={isImportDialogOpen}
          onOpenChange={(open) => {
            setIsImportDialogOpen(open)
            if (!open) setImportFiles([])
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('导入{entityLabel}', { entityLabel })}</DialogTitle>
              <DialogDescription>
                {t('上传 CSV 文件批量导入{entityLabel}数据', { entityLabel })}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCsvImportClick()
              }}
              className="grid gap-4"
            >
              <div className="py-4 space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  {importFiles.length > 0 ? importFiles[0].name : t('点击选择 CSV 文件')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleImportFileSelect(e.target.files)}
                />
              </div>
            </div>
            <FormDialogFooter
              onCancel={() => {
                setIsImportDialogOpen(false)
                setImportFiles([])
              }}
              confirmText={t('开始导入')}
              cancelText={t('取消')}
              confirmDisabled={importFiles.length === 0}
              loading={csvImporting}
            />
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Import Confirm Dialog */}
      {importPreview && (
        <ImportConfirmDialog
          open={isImportConfirmOpen}
          onOpenChange={setIsImportConfirmOpen}
          entityLabel={entityLabel}
          created={importPreview.created}
          duplicates={importPreview.duplicates}
          failed={importPreview.failed}
          duplicateItems={importPreview.duplicateItems}
          onConfirmOverwrite={() => doImport('overwrite')}
          onConfirmSkip={() => doImport('skip')}
          onConfirmNew={() => doImport('new')}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(open) => !open && setConfirmAction(null)}
          title={confirmAction.type === 'archive' ? t('确认归档') : t('确认删除')}
          description={
            confirmAction.type === 'archive'
              ? t('确定要归档{entityLabel}「{name}」吗？', {
                  entityLabel,
                  name: confirmAction.item.name,
                })
              : t('确定要删除{entityLabel}「{name}」吗？', {
                  entityLabel,
                  name: confirmAction.item.name,
                })
          }
          variant={confirmAction.type === 'delete' ? 'destructive' : 'default'}
          pending={confirmPending}
          onConfirm={handleConfirmAction}
        />
      )}

      {/* Batch Move Dialog */}
      <Dialog open={isBatchMoveDialogOpen} onOpenChange={setIsBatchMoveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {batchMoveMode === 'bindThenSubmit' ? t('提交审批') : t('调整批次分组')}
            </DialogTitle>
            <DialogDescription>
              {batchMoveMode === 'bindThenSubmit'
                ? t(
                    '已选中 {count} 个可提交的{entityLabel}，其中 {unbound} 个未关联批次，请选择批次分组或审批流程后提交审批',
                    {
                      count: batchSubmitEligibleIds.length,
                      entityLabel,
                      unbound: batchSubmitEligibleIds.filter((id) => {
                        const item = frontItems.find((i) => i.id === id)
                        return item && !item.batchId
                      }).length,
                    },
                  )
                : t('将选中的 {count} 个{entityLabel}移动到指定批次', {
                    count: selectedIds.length,
                    entityLabel,
                  })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleConfirmMove()
            }}
            className="grid gap-4"
          >
            <div className="py-4">
              {batchMoveMode === 'bindThenSubmit'
              ? renderSubmitModeTabs(
                  batchSubmitTab,
                  setBatchSubmitTab,
                  renderBatchSelector(
                    moveSelectedMajorId,
                    setMoveSelectedMajorId,
                    moveTargetBatchId,
                    setMoveTargetBatchId,
                    moveFilteredBatches,
                  ),
                  renderWorkflowSelector(batchSubmitWorkflowId, setBatchSubmitWorkflowId),
                )
              : renderBatchSelector(
                  moveSelectedMajorId,
                  setMoveSelectedMajorId,
                  moveTargetBatchId,
                  setMoveTargetBatchId,
                  moveFilteredBatches,
                )}
          </div>
          <FormDialogFooter
            onCancel={() => setIsBatchMoveDialogOpen(false)}
            confirmText={
              batchMoveMode === 'bindThenSubmit' ? t('确认并提交审批') : t('确认移动')
            }
            cancelText={t('取消')}
            confirmDisabled={
              batchMoveMode === 'bindThenSubmit'
                ? batchSubmitTab === 'batch'
                  ? !moveTargetBatchId
                  : !batchSubmitWorkflowId
                : !moveTargetBatchId
            }
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* Submit With Batch Dialog */}
      <Dialog open={isSubmitBatchDialogOpen} onOpenChange={setIsSubmitBatchDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('提交审批')}</DialogTitle>
            <DialogDescription>
              {t('{entityLabel}「{name}」未关联批次分组，请选择批次分组或审批流程后提交审批', {
                entityLabel,
                name: submitBatchTarget?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (submitTab === 'batch') {
                handleConfirmSubmitBatch()
              } else {
                handleConfirmSubmitWorkflow()
              }
            }}
            className="grid gap-4"
          >
            <div className="py-4">
              {renderSubmitModeTabs(
              submitTab,
              setSubmitTab,
              renderBatchSelector(
                submitSelectedMajorId,
                setSubmitSelectedMajorId,
                submitSelectedBatchId,
                setSubmitSelectedBatchId,
                submitFilteredBatches,
              ),
              renderWorkflowSelector(submitWorkflowId, setSubmitWorkflowId),
            )}
          </div>
          <FormDialogFooter
            onCancel={() => setIsSubmitBatchDialogOpen(false)}
            confirmText={t('确认并提交审批')}
            cancelText={t('取消')}
            confirmDisabled={submitTab === 'batch' ? !submitSelectedBatchId : !submitWorkflowId}
          />
          </form>
        </DialogContent>
      </Dialog>

      {/* Clone Rename Dialog */}
      <Dialog open={isCloneRenameDialogOpen} onOpenChange={setIsCloneRenameDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t('克隆{entityLabel}', { entityLabel })}</DialogTitle>
            <DialogDescription>{t('为克隆的{entityLabel}命名', { entityLabel })}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleConfirmClone()
            }}
            className="grid gap-4"
          >
            <div className="py-4">
              <Input
                value={cloneRenameValue}
                onChange={(e) => {
                  setCloneRenameValue(e.target.value)
                  cloneRenameValueRef.current = e.target.value
                }}
                placeholder={t('输入新名称')}
              />
            </div>
            <FormDialogFooter
              onCancel={() => setIsCloneRenameDialogOpen(false)}
              confirmText={t('确认克隆')}
              cancelText={t('取消')}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={isRejectReasonDialogOpen} onOpenChange={setIsRejectReasonDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('驳回原因')}</DialogTitle>
            <DialogDescription>
              {t('{entityLabel}「{name}」的审批被驳回，驳回原因如下：', {
                entityLabel,
                name: rejectReasonItem?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
              {rejectReasonItem?.rejectReason ||
                t('审批人已驳回此{entityLabel}的提交申请，请根据审批意见修改后重新提交。', {
                  entityLabel,
                })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectReasonDialogOpen(false)}>
              {t('关闭')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Co-builders Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('调整共建人')}</DialogTitle>
            <DialogDescription>
              {t('选择参与共建「{name}」的用户', { name: inviteTarget?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleInviteConfirm()
            }}
            className="grid gap-4"
          >
            <div className="py-4">
              <UserSelector
                value={inviteSelectedIds}
                onChange={setInviteSelectedIds}
                multiple
                placeholder={t('点击选择共建人')}
                tenantId={tenantId}
                excludeUserIds={inviteTarget?.creatorId ? [inviteTarget.creatorId] : undefined}
                showEnterpriseExperts
              />
            </div>
            <FormDialogFooter
              onCancel={() => setIsInviteDialogOpen(false)}
              confirmText={t('保存')}
              cancelText={t('取消')}
            />
          </form>
        </DialogContent>
      </Dialog>

      {children}
    </div>
  )
}

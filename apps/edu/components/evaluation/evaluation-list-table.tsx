'use client'

import { useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableRowActions } from '@/components/shared/table-row-actions'
import { StatusActionBar } from '@/components/shared/status-action-bar'
import { cn } from '@/lib/utils'
import type { ContentListItem, ListRenderProps } from '@/components/shared/content-list-page'
import { formatDate } from '@/lib/format-utils'
import type { Status } from '@/lib/types'
import { useT } from '@/lib/i18n/locale-provider'

interface EvaluationListTableProps<
  T extends ContentListItem = ContentListItem,
> extends ListRenderProps<T> {
  type: 'bank' | 'exam'
  onReview?: (id: string, status: 'approved' | 'rejected') => void
}

export function EvaluationListTable<T extends ContentListItem = ContentListItem>(
  props: EvaluationListTableProps<T>,
) {
  const {
    activeTab,
    items,
    selectedIds,
    onSelectId,
    onSelectAll,
    onClone,
    onDelete,
    onSubmitApproval,
    onWithdrawApproval,
    onViewRejectReason,
    onPublish,
    onUnpublish,
    onArchive,
    onInviteCoBuild,
    batchMap,
    type,
    onReview,
  } = props

  const t = useT()
  const router = useRouter()

  const allSelectable = items.filter((b) => !b.isDraftPool)
  const allSelected =
    allSelectable.length > 0 && allSelectable.every((b) => selectedIds.includes(b.id))
  const someSelected = allSelectable.some((b) => selectedIds.includes(b.id)) && !allSelected

  const isBank = type === 'bank'
  const detailHref = (id: string) =>
    isBank ? `/evaluation/question-banks/${id}` : `/evaluation/exams/${id}`

  const handleHeaderCheckbox = (checked: boolean) => {
    if (checked) {
      allSelectable.forEach((b) => onSelectId(b.id, true))
    } else {
      onSelectAll(false)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px] text-center">
            <Checkbox
              checked={someSelected ? 'indeterminate' : allSelected}
              onCheckedChange={(checked) => handleHeaderCheckbox(checked === true)}
              aria-label={t('全选')}
            />
          </TableHead>
          <TableHead className="w-[160px]">{isBank ? t('题库名称') : t('试卷名称')}</TableHead>
          <TableHead className="w-[120px]">{isBank ? t('题库编码') : t('试卷编码')}</TableHead>
          <TableHead className="w-[120px]">{isBank ? t('题库简介') : t('试卷简介')}</TableHead>
          <TableHead className="w-[80px]">{t('题目数量')}</TableHead>
          {!isBank && <TableHead className="w-[80px]">{t('总分')}</TableHead>}
          <TableHead className="w-[120px]">{t('所属批次')}</TableHead>
          <TableHead className="w-[100px]">{t('创建人')}</TableHead>
          <TableHead className="w-[100px]">{t('共建人')}</TableHead>
          <TableHead className="w-[70px]">{t('状态')}</TableHead>
          <TableHead className="w-[100px]">{t('更新时间')}</TableHead>
          <TableHead className="sticky right-0 w-[80px] bg-white text-right">{t('操作')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id)
          const batchName = item.batchId ? batchMap.get(item.batchId) || '-' : '-'
          const isDraftPool = item.isDraftPool === true
          return (
            <TableRow key={item.id} className={cn('group', isSelected && 'bg-primary/5')}>
              <TableCell className="text-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectId(item.id, checked === true)}
                  aria-label={t('选择 {name}', { name: item.name })}
                  disabled={isDraftPool}
                />
              </TableCell>
              <TableCell className="truncate">
                <button
                  className="text-left text-sm font-medium hover:text-primary truncate w-full"
                  onClick={() => router.push(detailHref(item.id))}
                >
                  {item.name}
                  {isDraftPool && (
                    <span className="ml-2 shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 align-middle">
                      {t('草稿库')}
                    </span>
                  )}
                </button>
              </TableCell>
              <TableCell className="truncate">
                <span className="text-sm text-muted-foreground">
                  {item.code || item.id.slice(0, 8)}
                </span>
              </TableCell>
              <TableCell className="truncate max-w-[120px]">
                <span className="text-sm text-muted-foreground truncate block">
                  {item.description || '-'}
                </span>
              </TableCell>
              <TableCell>{t('{n} 题', { n: Number(item.questionCount) })}</TableCell>
              {!isBank && <TableCell>{t('{n} 分', { n: Number(item.totalScore ?? 0) })}</TableCell>}
              <TableCell className="text-sm text-muted-foreground">{batchName}</TableCell>
              <TableCell className="text-sm text-muted-foreground truncate">
                {item.creatorName || item.creatorId || '-'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground truncate">
                {item.collaboratorNames && item.collaboratorNames.length > 0
                  ? item.collaboratorNames.join(', ')
                  : '-'}
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(item.updatedAt)}
              </TableCell>
              <TableRowActions className="sticky right-0 bg-white">
                {isBank && isDraftPool ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => router.push(detailHref(item.id))}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    {t('查看')}
                  </Button>
                ) : (
                  <StatusActionBar
                    status={item.status as Status}
                    isPublicPool={activeTab === 'public'}
                    onView={() => router.push(detailHref(item.id))}
                    onEdit={() => router.push(detailHref(item.id))}
                    onClone={() => onClone(item)}
                    onSubmit={() => onSubmitApproval(item)}
                    onWithdraw={() => onWithdrawApproval(item)}
                    onApprove={onReview ? () => onReview(item.id, 'approved') : undefined}
                    onReject={onReview ? () => onReview(item.id, 'rejected') : undefined}
                    onPublish={() => onPublish(item)}
                    onUnpublish={() => onUnpublish(item)}
                    onArchive={() => onArchive(item)}
                    onDelete={() => onDelete(item)}
                    onInvite={() => onInviteCoBuild(item)}
                    onViewRejectReason={() => onViewRejectReason(item)}
                  />
                )}
              </TableRowActions>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

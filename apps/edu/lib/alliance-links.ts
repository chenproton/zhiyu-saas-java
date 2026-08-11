import { allianceAgreementApi, allianceProjectApi } from '@/lib/api'
import type { AllianceAgreement, AllianceProject } from '@/lib/types'

/**
 * 协议-项目双向关联同步：把协议.project_ids 与各项目的 agreement_ids 对齐。
 * 传入协议的目标项目集，diff 出新增/移除的项目并同步双方字段，
 * 保证项目页与协议页任一侧配置关联后两侧数据一致。
 */
export async function syncAgreementProjectLinks(
  agreementId: string,
  targetProjectIds: string[],
): Promise<void> {
  const agreement: AllianceAgreement = await allianceAgreementApi.get(agreementId)
  const current = agreement.projectIds ?? []
  const added = targetProjectIds.filter((pid) => !current.includes(pid))
  const removed = current.filter((pid) => !targetProjectIds.includes(pid))

  for (const pid of added) {
    const p: AllianceProject = await allianceProjectApi.get(pid)
    await allianceProjectApi.update(pid, {
      ...p,
      agreementIds: [...new Set([...(p.agreementIds ?? []), agreementId])],
    })
  }
  for (const pid of removed) {
    const p: AllianceProject = await allianceProjectApi.get(pid)
    await allianceProjectApi.update(pid, {
      ...p,
      agreementIds: (p.agreementIds ?? []).filter((x) => x !== agreementId),
    })
  }
  if (added.length > 0 || removed.length > 0) {
    await allianceAgreementApi.update(agreementId, {
      ...agreement,
      projectIds: targetProjectIds,
    })
  }
}

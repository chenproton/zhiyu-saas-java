"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { orgApi, orgTypeApi } from "@/lib/api"
import type { Organization, OrgType } from "@/lib/types/backend"

export interface OrgTreeNode extends Organization {
  children?: OrgTreeNode[]
  depth: number
}

export interface UseOrgTreeResult {
  orgs: Organization[]
  orgTree: OrgTreeNode[]
  orgMap: Map<string, Organization>
  orgTypeMap: Map<string, OrgType>
  typeNameMap: Map<string, string>
  loading: boolean
  error?: string
  refetch: () => void
}

function flattenOrgs(nodes: Organization[], depth = 0, result: OrgTreeNode[] = []): OrgTreeNode[] {
  for (const node of nodes) {
    result.push({ ...node, depth, children: node.children as OrgTreeNode[] | undefined })
    if (node.children && node.children.length > 0) {
      flattenOrgs(node.children as OrgTreeNode[], depth + 1, result)
    }
  }
  return result
}

export function useOrgTree(tenantId?: string): UseOrgTreeResult {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [orgTypes, setOrgTypes] = useState<OrgType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [refetchKey, setRefetchKey] = useState(0)

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), [])

  useEffect(() => {
    ;(async () => {
      if (!tenantId) {
        setOrgs([])
        setOrgTypes([])
        return
      }

      let cancelled = false
      setLoading(true)
      setError(undefined)

      try {
        const [treeRes, typesRes] = await Promise.all([
          orgApi.tree({ tenantId }),
          orgTypeApi.list({ tenantId, limit: 1000 }),
        ])
        if (cancelled) return
        setOrgs(treeRes.items)
        setOrgTypes(typesRes.items)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "加载组织架构失败")
      } finally {
        if (!cancelled) setLoading(false)
      }

      return () => {
        cancelled = true
      }
    })()
  }, [tenantId, refetchKey])

  const orgTree = useMemo(() => {
    return flattenOrgs(orgs)
  }, [orgs])

  const orgMap = useMemo(() => {
    const map = new Map<string, Organization>()
    orgTree.forEach((node) => map.set(node.id, node))
    return map
  }, [orgTree])

  const orgTypeMap = useMemo(() => {
    const map = new Map<string, OrgType>()
    orgTypes.forEach((type) => map.set(type.id, type))
    return map
  }, [orgTypes])

  const typeNameMap = useMemo(() => {
    const map = new Map<string, string>()
    orgTypes.forEach((type) => map.set(type.id, type.name))
    return map
  }, [orgTypes])

  return { orgs, orgTree, orgMap, orgTypeMap, typeNameMap, loading, error, refetch }
}

export function findOrgAncestor(
  orgMap: Map<string, Organization>,
  nodeId: string | undefined,
  predicate: (org: Organization) => boolean
): Organization | undefined {
  if (!nodeId) return undefined
  let current = orgMap.get(nodeId)
  while (current) {
    if (predicate(current)) return current
    if (!current.parentId) return undefined
    current = orgMap.get(current.parentId)
  }
  return undefined
}

'use client'

import { useMemo } from 'react'
import { useOrgTree } from './use-org-tree'

export const SECONDARY_COLLEGE_TYPE_NAME = '二级学院'

export function useSecondaryColleges(tenantId?: string) {
  const { orgTree, typeNameMap, loading } = useOrgTree(tenantId)
  const colleges = useMemo(() => {
    const collegeTypeIds = new Set<string>()
    typeNameMap.forEach((name, id) => {
      if (name === SECONDARY_COLLEGE_TYPE_NAME) collegeTypeIds.add(id)
    })
    if (collegeTypeIds.size === 0) return []
    return orgTree
      .filter((node) => collegeTypeIds.has(node.typeId))
      .map((node) => node.name)
  }, [orgTree, typeNameMap])
  return { colleges, loading }
}

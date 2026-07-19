"use client"

import { useCallback, type MutableRefObject } from "react"
import { useRouter } from "next/navigation"

export function useCleanupBack(
  isNew: boolean,
  itemId: string | undefined,
  hasSavedRef: MutableRefObject<boolean>,
  listUrl: string,
  deleteFn: () => Promise<any>
) {
  const router = useRouter()

  return useCallback(async () => {
    if (isNew && itemId && !hasSavedRef.current) {
      try { await deleteFn() } catch {}
    }
    router.push(listUrl)
  }, [isNew, itemId, hasSavedRef, listUrl, deleteFn])
}

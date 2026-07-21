"use client"

import { createContext, useContext } from "react"
import type { CareerPosition, AbilityDomain, AbilityPoint, PositionAbilityBinding } from "@zhiyu/shared-types"

export interface GraphDataContext {
  position?: CareerPosition
  domains?: AbilityDomain[]
  units?: AbilityPoint[]
  bindings?: PositionAbilityBinding[]
}

const GraphDataContext = createContext<GraphDataContext>({})

export function GraphDataProvider({
  value,
  children,
}: {
  value: GraphDataContext
  children: React.ReactNode
}) {
  return <GraphDataContext.Provider value={value}>{children}</GraphDataContext.Provider>
}

export function useGraphData(): GraphDataContext {
  return useContext(GraphDataContext)
}

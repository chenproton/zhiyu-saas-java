"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react"
import type { AnnotationItem } from "./prd-annotations"

interface FloatingAnnotation {
  id: string
  title: string
  content: string
  selector: string // CSS selector or unique identifier
  rect: { x: number; y: number; width: number; height: number }
  pagePath: string
}

interface AnnotationEditContextValue {
  isEditMode: boolean
  toggleEditMode: () => void
  overrides: Record<string, AnnotationItem>
  floatingAnnotations: FloatingAnnotation[]
  saveOverride: (id: string, data: AnnotationItem) => void
  deleteOverride: (id: string) => void
  addFloatingAnnotation: (data: FloatingAnnotation) => void
  deleteFloatingAnnotation: (id: string) => void
  exportOverrides: () => string
  activeAddForm: boolean
  setActiveAddForm: (v: boolean) => void
  pendingElement: HTMLElement | null
  setPendingElement: (el: HTMLElement | null) => void
  annotationsVisible: boolean
  toggleAnnotationsVisible: () => void
}

const STORAGE_KEY = "prd-annotations-overrides"
const FLOATING_KEY = "prd-annotations-floating"

const AnnotationEditContext = createContext<AnnotationEditContextValue | null>(
  null
)

export function AnnotationEditProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, AnnotationItem>>(
    {}
  )
  const [floatingAnnotations, setFloatingAnnotations] = useState<
    FloatingAnnotation[]
  >([])
  const [activeAddForm, setActiveAddForm] = useState(false)
  const [pendingElement, setPendingElement] = useState<HTMLElement | null>(
    null
  )
  const [annotationsVisible, setAnnotationsVisible] = useState(false)

  const toggleAnnotationsVisible = useCallback(() => {
    setAnnotationsVisible((prev) => !prev)
  }, [])

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setOverrides(JSON.parse(saved))
    } catch {
      // ignore
    }
    try {
      const saved = localStorage.getItem(FLOATING_KEY)
      if (saved) setFloatingAnnotations(JSON.parse(saved))
    } catch {
      // ignore
    }
  }, [])

  // Persist overrides
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  }, [overrides])

  // Persist floating annotations
  useEffect(() => {
    localStorage.setItem(FLOATING_KEY, JSON.stringify(floatingAnnotations))
  }, [floatingAnnotations])

  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => !prev)
    setActiveAddForm(false)
    setPendingElement(null)
  }, [])

  const saveOverride = useCallback((id: string, data: AnnotationItem) => {
    setOverrides((prev) => ({ ...prev, [id]: data }))
  }, [])

  const deleteOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const addFloatingAnnotation = useCallback((data: FloatingAnnotation) => {
    setFloatingAnnotations((prev) => [...prev, data])
  }, [])

  const deleteFloatingAnnotation = useCallback((id: string) => {
    setFloatingAnnotations((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const exportOverrides = useCallback(() => {
    const payload = {
      overrides,
      floatingAnnotations,
    }
    return JSON.stringify(payload, null, 2)
  }, [overrides, floatingAnnotations])

  const value = useMemo(
    () => ({
      isEditMode,
      toggleEditMode,
      overrides,
      floatingAnnotations,
      saveOverride,
      deleteOverride,
      addFloatingAnnotation,
      deleteFloatingAnnotation,
      exportOverrides,
      activeAddForm,
      setActiveAddForm,
      pendingElement,
      setPendingElement,
      annotationsVisible,
      toggleAnnotationsVisible,
    }),
    [
      isEditMode,
      overrides,
      floatingAnnotations,
      toggleEditMode,
      saveOverride,
      deleteOverride,
      addFloatingAnnotation,
      deleteFloatingAnnotation,
      exportOverrides,
      activeAddForm,
      pendingElement,
      annotationsVisible,
      toggleAnnotationsVisible,
    ]
  )

  return (
    <AnnotationEditContext.Provider value={value}>
      {children}
    </AnnotationEditContext.Provider>
  )
}

export function useAnnotationEdit() {
  const ctx = useContext(AnnotationEditContext)
  if (!ctx) {
    throw new Error(
      "useAnnotationEdit must be used within AnnotationEditProvider"
    )
  }
  return ctx
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function matchesPath(pathname: string, href?: string, matchers?: string[]) {
  const targets = matchers && matchers.length > 0 ? matchers : href ? [href] : []
  return targets.some((target) => {
    if (target === "/") {
      return pathname === "/"
    }
    if (target.endsWith("$")) {
      return pathname === target.slice(0, -1)
    }
    return pathname === target || pathname.startsWith(`${target}/`)
  })
}

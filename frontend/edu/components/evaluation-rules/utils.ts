export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export function draftSuffix() {
  const d = new Date()
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return `${ds}_${c[Math.floor(Math.random() * 36)]}${c[Math.floor(Math.random() * 36)]}`
}

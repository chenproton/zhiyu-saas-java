export function createTagElement(
  type: "kp" | "ab",
  id: string,
  name: string,
  onRemove: () => void,
  options?: { className?: string; btnClassName?: string }
): HTMLSpanElement | null {
  const span = document.createElement("span")
  span.contentEditable = "false"
  span.dataset.tag = "true"
  span.dataset.type = type
  span.dataset.id = id

  const isKp = type === "kp"
  const spanClass = options?.className ?? (
    isKp
      ? "inline-flex items-center px-1 py-0.5 rounded text-[10px] font-normal bg-blue-50 text-blue-600 border border-blue-200 mx-0.5 align-middle cursor-default"
      : "inline-flex items-center px-1 py-0.5 rounded text-[10px] font-normal bg-amber-50 text-amber-600 border border-amber-200 mx-0.5 align-middle cursor-default"
  )
  const btnClass = options?.btnClassName ?? (
    isKp
      ? "ml-0.5 text-blue-400 hover:text-red-500 leading-none"
      : "ml-0.5 text-amber-400 hover:text-red-500 leading-none"
  )

  span.className = spanClass
  span.textContent = name

  const btn = document.createElement("button")
  btn.className = btnClass
  btn.textContent = "×"
  btn.onclick = (e) => {
    e.stopPropagation()
    span.remove()
    onRemove()
  }

  span.appendChild(btn)
  return span
}

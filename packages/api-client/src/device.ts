const DEVICE_ID_KEY = 'zhiyu-device-id'

/**
 * 获取持久化设备标识：首次调用生成随机 ID 存 localStorage，之后复用。
 * 用于登录时识别"新设备"（后端无信任标记则必须输验证码）。
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

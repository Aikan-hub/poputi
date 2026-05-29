/** VK user IDs, которым показывается вход в админ-панель (в проде / в VK). */
const DEFAULT_ADMIN_VK_IDS: readonly number[] = [1065668928]

function parseAdminVkIdsFromEnv(): number[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_VK_IDS?.trim()
  if (!raw) return [...DEFAULT_ADMIN_VK_IDS]
  return raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((id) => Number.isFinite(id))
}

let cachedAdminVkIds: number[] | null = null

export function getAdminVkIds(): readonly number[] {
  if (!cachedAdminVkIds) {
    cachedAdminVkIds = parseAdminVkIdsFromEnv()
  }
  return cachedAdminVkIds
}

/** В dev по умолчанию админка видна всем (локально без VK). Отключить: NEXT_PUBLIC_DEV_ADMIN=false */
function isDevAdminBypass(): boolean {
  if (process.env.NODE_ENV !== "development") return false
  return process.env.NEXT_PUBLIC_DEV_ADMIN !== "false"
}

export function isAdminVkUser(vkUserId: number | undefined | null): boolean {
  if (isDevAdminBypass()) return true
  if (vkUserId == null) return false
  return getAdminVkIds().includes(vkUserId)
}

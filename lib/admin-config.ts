/** VK user IDs, которым показывается вход в админ-панель внутри приложения. */
export const ADMIN_VK_IDS: readonly number[] = [1065668928]

export function isAdminVkUser(vkUserId: number | undefined | null): boolean {
  if (vkUserId == null) return false
  return ADMIN_VK_IDS.includes(vkUserId)
}

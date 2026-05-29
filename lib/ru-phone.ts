/** Российский мобильный/городской: +7 и ровно 10 цифр после кода страны. */
const NATIONAL_DIGITS = 10

export function extractRuPhoneNationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("8")) digits = digits.slice(1)
  if (digits.startsWith("7")) digits = digits.slice(1)
  return digits.slice(0, NATIONAL_DIGITS)
}

/** Нормализует ввод при наборе: только +7 и до 10 цифр. */
export function formatRuPhoneInput(raw: string): string {
  const national = extractRuPhoneNationalDigits(raw)
  if (national.length === 0) {
    const hint = raw.replace(/[^\d+]/g, "")
    if (hint === "+" || hint === "+7" || hint === "7" || hint === "8") return "+7"
    return ""
  }
  return `+7${national}`
}

/** Пустое значение допустимо (поле необязательное). */
export function isValidRuPhone(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return /^\+7\d{10}$/.test(trimmed)
}

export function ruPhoneValidationMessage(value: string): string | null {
  if (!value.trim()) return null
  if (isValidRuPhone(value)) return null
  return "Укажите номер: +7 и 10 цифр, например +79001234567"
}

/** Для отображения: +7 (900) 123-45-67 */
export function formatRuPhoneDisplay(value: string): string {
  const compact = formatRuPhoneInput(value)
  if (!compact) return ""
  if (compact === "+7") return "+7"
  const national = compact.slice(2)
  if (national.length <= 3) return `+7 ${national}`
  if (national.length <= 6) return `+7 (${national.slice(0, 3)}) ${national.slice(3)}`
  if (national.length <= 8) {
    return `+7 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
  }
  return `+7 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6, 8)}-${national.slice(8, 10)}`
}

export function normalizeStoredRuPhone(value: string | undefined): string {
  if (!value?.trim()) return ""
  return formatRuPhoneInput(value)
}

/** ID страницы оплаты в URL pay.cloudtips.ru/p/{id} */
export const DRIVER_CLOUDTIPS_LAYOUT_ID = "c22f4a0b"

export const DRIVER_ACCESS_AMOUNT = 200

export function driverCloudtipsPayUrl(invoiceId: string): string {
  const base = `https://pay.cloudtips.ru/p/${DRIVER_CLOUDTIPS_LAYOUT_ID}`
  const q = new URLSearchParams({
    amount: String(DRIVER_ACCESS_AMOUNT),
    invoiceid: invoiceId,
  })
  return `${base}?${q.toString()}`
}

import { describe, expect, it } from "vitest"
import { tryCityPickupFallback } from "./city-ride"

type HandlerResult = { data: any[] | null; error: any }
type Handler = () => HandlerResult | Promise<HandlerResult>

function makeSupabaseMock(handlers: Handler[]) {
  return {
    from: (table: string) => {
      expect(table).toBe("rides")
      return {
        update: (_payload: Record<string, unknown>) => {
          const handler = handlers.shift() ?? (() => ({ data: null, error: null }))
          const chain: any = {
            eq: () => chain,
            is: () => chain,
            select: async () => handler(),
          }
          return chain
        },
      }
    },
  } as any
}

describe("tryCityPickupFallback", () => {
  it("succeeds on first attempt", async () => {
    const supabase = makeSupabaseMock([() => ({ data: [{ id: 1 }], error: null })])
    const ok = await tryCityPickupFallback(supabase, 123, "id42")
    expect(ok).toBe(true)
  })

  it("retries without status column when status is missing", async () => {
    const supabase = makeSupabaseMock([
      () => ({ data: null, error: { code: "42703", message: "column status does not exist" } }),
      () => ({ data: [{ id: 2 }], error: null }),
    ])
    const ok = await tryCityPickupFallback(supabase, 123, "id42")
    expect(ok).toBe(true)
  })

  it("falls back to partner is null attempt when other errors happen", async () => {
    const supabase = makeSupabaseMock([
      () => ({ data: null, error: { code: "99999", message: "race" } }),
      () => ({ data: [{ id: 3 }], error: null }),
    ])
    const ok = await tryCityPickupFallback(supabase, 123, "id42")
    expect(ok).toBe(true)
  })

  it("returns false when all attempts fail", async () => {
    const supabase = makeSupabaseMock([
      () => ({ data: null, error: { code: "99999" } }),
      () => ({ data: null, error: { code: "99999" } }),
    ])
    const ok = await tryCityPickupFallback(supabase, 123, "id42")
    expect(ok).toBe(false)
  })
})

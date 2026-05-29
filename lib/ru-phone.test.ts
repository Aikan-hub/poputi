import { describe, expect, it } from "vitest"
import {
  extractRuPhoneNationalDigits,
  formatRuPhoneInput,
  isValidRuPhone,
  normalizeStoredRuPhone,
} from "./ru-phone"

describe("ru-phone", () => {
  it("strips invalid characters and limits length", () => {
    expect(formatRuPhoneInput("+в82321893210930219309123")).toBe("+72321893210")
    expect(formatRuPhoneInput("89001234567")).toBe("+79001234567")
    expect(formatRuPhoneInput("9001234567")).toBe("+79001234567")
  })

  it("validates +7 with 10 digits", () => {
    expect(isValidRuPhone("")).toBe(true)
    expect(isValidRuPhone("+79001234567")).toBe(true)
    expect(isValidRuPhone("+7900123456")).toBe(false)
    expect(isValidRuPhone("+89001234567")).toBe(false)
  })

  it("extracts national digits from 8-prefix", () => {
    expect(extractRuPhoneNationalDigits("8 (900) 123-45-67")).toBe("9001234567")
  })

  it("normalizes stored garbage", () => {
    expect(normalizeStoredRuPhone(" 8 900 123 45 67 ")).toBe("+79001234567")
  })
})

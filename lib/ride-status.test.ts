import { describe, expect, it } from "vitest"
import {
  canDriverComplete,
  canDriverStart,
  canDriverTake,
  canPassengerCancel,
  isActiveStatus,
  normalizeRideStatus,
  statusLabel,
  type RideStatus,
} from "./ride-status"

describe("ride-status helpers", () => {
  const statuses: RideStatus[] = ["searching", "accepted", "in_transit", "completed", "cancelled"]

  it("has labels for all statuses", () => {
    for (const st of statuses) {
      expect(statusLabel[st]).toBeTruthy()
    }
  })

  it("detects active statuses", () => {
    expect(isActiveStatus("searching")).toBe(true)
    expect(isActiveStatus("accepted")).toBe(true)
    expect(isActiveStatus("in_transit")).toBe(true)
    expect(isActiveStatus("completed")).toBe(false)
    expect(isActiveStatus("cancelled")).toBe(false)
  })

  it("passenger can cancel only on searching/accepted", () => {
    expect(canPassengerCancel("searching")).toBe(true)
    expect(canPassengerCancel("accepted")).toBe(true)
    expect(canPassengerCancel("in_transit")).toBe(false)
    expect(canPassengerCancel("completed")).toBe(false)
  })

  it("driver actions require matching status", () => {
    expect(canDriverTake("searching")).toBe(true)
    expect(canDriverTake("accepted")).toBe(false)
    expect(canDriverStart("accepted", true)).toBe(true)
    expect(canDriverStart("accepted", false)).toBe(false)
    expect(canDriverComplete("in_transit", true)).toBe(true)
    expect(canDriverComplete("in_transit", false)).toBe(false)
  })

  it("normalizes legacy statuses", () => {
    expect(normalizeRideStatus("open")).toBe("searching")
    expect(normalizeRideStatus("in_progress")).toBe("accepted")
    expect(normalizeRideStatus(null)).toBe("searching")
    expect(normalizeRideStatus("searching")).toBe("searching")
  })
})

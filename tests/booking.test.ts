import { beforeEach, describe, expect, it, vi } from "vitest";

// The database decides availability and price (tests/database.test.ts). This tests what
// bookSlot adds: input checks, error wording, retries and who gets directions.
const insert = vi.fn();
const rpc = vi.fn();
const preview = { value: false };
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({ getPublicShop: async () => ({ preview: preview.value }) }));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: () => ({ insert }), rpc }),
}));
const { bookSlot } = await import("@/app/booking-actions");

const booking = (extra: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  kind: "shop",
  slot_start: "2026-11-09T08:00:00.000Z",
  service_id: "20000000-0000-4000-8000-000000000001",
  area_id: null,
  visit_id: null,
  total: 8,
  name: "Ali",
  phone: "0123456789",
  address: "",
  note: "",
  ...extra,
});
const fails = (code: string, message: string) => ({ error: { code, message } });

beforeEach(() => {
  preview.value = false;
  insert.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ data: [{ address: "No 1, Jalan Kedai", maps_url: "" }] });
});

describe("bookSlot", () => {
  it("rejects bad input without saving", async () => {
    expect(await bookSlot(booking({ phone: "12" }))).toMatchObject({
      ok: false,
      fields: { phone: "Enter your WhatsApp number, e.g. 0123456789." },
    });
    expect(await bookSlot(booking({ kind: "house_call", area_id: null }))).toMatchObject({
      ok: false,
    });
    expect(await bookSlot(booking({ kind: "university" }))).toMatchObject({ ok: false });
    expect(insert).not.toHaveBeenCalled();
  });
  it("saves a shop visit with the phone normalised and reveals the address", async () => {
    expect(await bookSlot(booking({ address: "ignored" }))).toMatchObject({
      ok: true,
      address: "No 1, Jalan Kedai",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "60123456789", address: null, note: null, total: 8 }),
    );
    expect(rpc).toHaveBeenCalledWith("booking_directions", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    });
  });
  it("never returns directions for a house call", async () => {
    const result = await bookSlot(
      booking({
        kind: "house_call",
        area_id: "30000000-0000-4000-8000-000000000003",
        address: "No. 1, Jalan Bangi",
        total: 35,
      }),
    );
    expect(result).toEqual({ ok: true, message: "You’re booked." });
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ address: "No. 1, Jalan Bangi" }));
  });
  it("requires uni locations to be confirmed with the owner instead of returning stored directions", async () => {
    const uni = booking({ kind: "university", visit_id: "50000000-0000-4000-8000-000000000001" });
    rpc.mockResolvedValue({
      data: [{ address: "Old meeting point", maps_url: "https://maps.app/x" }],
    });
    expect(await bookSlot(uni)).toEqual({ ok: true, message: "You’re booked." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    [
      "23P01",
      "conflicting key value violates exclusion constraint",
      "That time was just booked. Choose another.",
    ],
    ["P0001", "Price changed.", "Prices just changed. Check the new total, then book again."],
    ["P0001", "Choose an available time.", "That time isn’t available. Choose another."],
    [
      "P0001",
      "Choose an available service.",
      "That haircut isn’t available there now. Choose another.",
    ],
    ["08006", "connection lost", "Couldn’t save your booking. Please try again."],
  ])("explains database error %s %s", async (code, message, expected) => {
    insert.mockResolvedValue(fails(code, message));
    expect(await bookSlot(booking())).toEqual({ ok: false, message: expected });
  });
  it("treats a retry of the same booking as success", async () => {
    insert.mockResolvedValue(fails("23505", "Booking already saved."));
    expect(await bookSlot(booking())).toMatchObject({ ok: true });
  });
  it("does nothing in the sample preview", async () => {
    preview.value = true;
    expect(await bookSlot(booking())).toMatchObject({ ok: false });
    expect(insert).not.toHaveBeenCalled();
  });
});

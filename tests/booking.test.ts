import { beforeEach, describe, expect, it, vi } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import { demoHours, demoShop } from "@/lib/demo";
import { getShopToday, shiftDay } from "@/lib/time";

// The database only checks "future, on the half hour"; opening hours are enforced
// here alone. Fake the data layer so this tests bookSlot's own decisions.
const insert = vi.fn();
const rpc = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/data", () => ({
  getPublicShop: async () => ({ shop: demoShop, hours: demoHours, preview: false }),
}));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: () => ({ insert }), rpc }),
}));
const { bookSlot } = await import("@/app/booking-actions");

const tomorrow = shiftDay(getShopToday(demoShop.timezone), 1);
const at = (clock: string) =>
  fromZonedTime(`${tomorrow}T${clock}:00`, demoShop.timezone).toISOString();
const booking = (slot_start: string) => ({
  id: "11111111-1111-4111-8111-111111111111",
  slot_start,
  name: "Ali",
  phone: "0123456789",
  area: "Shop",
  address: "",
  note: "",
});
const conflict = (constraint: string) => ({
  error: {
    code: "23505",
    message: `duplicate key value violates unique constraint "${constraint}"`,
  },
});

beforeEach(() => {
  insert.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ data: [{ address: "No 1, Jalan Kedai", maps_url: "" }] });
});

describe("bookSlot", () => {
  it("rejects times outside the open slots without saving", async () => {
    for (const clock of ["19:00", "03:00", "15:10"]) {
      expect(await bookSlot(booking(at(clock)))).toMatchObject({
        ok: false,
        message: "That time isn’t available. Choose another.",
      });
    }
    expect(insert).not.toHaveBeenCalled();
  });
  it("saves an open slot with the phone normalised and reveals the address", async () => {
    expect(await bookSlot(booking(at("20:00")))).toMatchObject({
      ok: true,
      address: "No 1, Jalan Kedai",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ slot_start: at("20:00"), phone: "60123456789", address: null }),
    );
    // The address comes from the database lookup for this booking, not the page's shop data.
    expect(rpc).toHaveBeenCalledWith("booking_directions", {
      booking_id: "11111111-1111-4111-8111-111111111111",
    });
  });
  it("still confirms the booking if the address lookup fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect(await bookSlot(booking(at("20:00")))).toMatchObject({ ok: true, address: "" });
  });
  it("never returns the shop address for a house call", async () => {
    const result = await bookSlot({
      ...booking(at("20:00")),
      area: "Bangi",
      address: "No. 1, Jalan Bangi",
    });
    expect(result).toEqual({ ok: true, message: "You’re booked." });
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ area: "Bangi", address: "No. 1, Jalan Bangi" }),
    );
  });
  it("reports a slot someone else took", async () => {
    insert.mockResolvedValue(conflict("bookings_slot_start_key"));
    expect(await bookSlot(booking(at("20:00")))).toMatchObject({
      ok: false,
      message: "That time was just booked. Choose another.",
    });
  });
  it("treats a retry of the same booking as success", async () => {
    insert.mockResolvedValue(conflict("bookings_pkey"));
    expect(await bookSlot(booking(at("20:00")))).toMatchObject({ ok: true });
  });
});

import { describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { customerAddresses } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createAddress, deleteAddress, listMyAddresses, setDefaultAddress, toAddressSnapshot } from "./domains/account/service";
import { normalizePhone } from "../shared/validation/phone";
import { addressInputSchema } from "../shared/validation/accountSchemas";

function unauthenticatedContext(): TrpcContext {
  return {
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
    user: null,
  };
}

describe("Sprint 2 customer account foundation", () => {
  it("normalizes Kenyan local and international numbers consistently", () => {
    expect(normalizePhone("0712 345 678", "KE").normalizedPhone).toBe("+254712345678");
    expect(normalizePhone("+254 712 345 678", "KE").normalizedPhone).toBe("+254712345678");
    expect(() => normalizePhone("12345", "KE")).toThrow("valid phone");
  });

  it("rejects client-supplied ownership fields", () => {
    expect(() => addressInputSchema.parse({
      userId: 999,
      recipientName: "A Customer",
      recipientPhone: "+254712345678",
      country: "Kenya",
      county: "Nairobi",
      town: "Nairobi",
      neighborhood: "Westlands",
    })).toThrow();
  });

  it("requires authentication for account procedures", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.account.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates one default, switches defaults transactionally, and promotes a replacement after soft deletion", async () => {
    if (!process.env.DATABASE_URL) return;
    const db = await getDb();
    if (!db) return;
    const userId = 1;
    let firstId: number | undefined;
    let secondId: number | undefined;
    try {
      const first = await createAddress(userId, {
        recipientName: "Sprint Test One", recipientPhone: "0712345678", label: "home", country: "Kenya", county: "Nairobi", town: "Nairobi", neighborhood: "Westlands", isDefault: true,
      });
      firstId = first.id;
      const second = await createAddress(userId, {
        recipientName: "Sprint Test Two", recipientPhone: "0722345678", label: "work", country: "Kenya", county: "Nairobi", town: "Nairobi", neighborhood: "Kilimani", isDefault: true,
      });
      secondId = second.id;
      let active = await listMyAddresses(userId);
      expect(active.filter((address) => address.isDefault === 1)).toHaveLength(1);
      expect(active.find((address) => address.id === secondId)?.isDefault).toBe(1);
      await setDefaultAddress(userId, firstId);
      active = await listMyAddresses(userId);
      expect(active.find((address) => address.id === firstId)?.isDefault).toBe(1);
      expect(active.find((address) => address.id === secondId)?.isDefault).toBe(0);
      await deleteAddress(userId, firstId);
      active = await listMyAddresses(userId);
      expect(active.find((address) => address.id === secondId)?.isDefault).toBe(1);
    } finally {
      const ids = [firstId, secondId].filter((id): id is number => Boolean(id));
      if (ids.length) await db.delete(customerAddresses).where(inArray(customerAddresses.id, ids));
    }
  });

  it("creates an immutable future-order address snapshot", () => {
    const snapshot = toAddressSnapshot({ recipientName: "A Customer", recipientPhone: "+254712345678", country: "Kenya", county: "Nairobi", town: "Nairobi", neighborhood: "Westlands" });
    expect(snapshot.recipientPhone).toBe("+254712345678");
    expect(() => { (snapshot as { town: string }).town = "Mombasa"; }).toThrow();
  });
});

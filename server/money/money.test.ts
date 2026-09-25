import { describe, expect, it } from "vitest";
import { Money } from "../../shared/money/money";

describe("Money", () => {
  it("stores major-unit input as integer minor units", () => {
    expect(Money.fromMajor("1250.50").toJSON()).toEqual({ amountMinor: 125050, currency: "KES" });
  });

  it("performs exact integer arithmetic", () => {
    const total = Money.fromMajor("0.10").add(Money.fromMajor("0.20"));
    expect(total.amountMinor).toBe(30);
    expect(total.format()).toContain("0.30");
  });

  it("rejects floating-point and mixed-currency calculations", () => {
    expect(() => new Money(1.5)).toThrow("safe integer");
    expect(() => Money.fromMajor("1.00").add(Money.fromMajor("1.00", "USD"))).toThrow("different currencies");
  });

  it("supports safe integer multiplication and comparison", () => {
    expect(Money.fromMajor("12.00").multiply(3).amountMinor).toBe(3600);
    expect(Money.fromMajor("12.00").compare(Money.fromMajor("12.01"))).toBe(-1);
  });
});

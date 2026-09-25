import { AppError } from "../errors/appError";

export const DEFAULT_CURRENCY = "KES" as const;
export type CurrencyCode = string;

export type MoneyJson = { amountMinor: number; currency: CurrencyCode };

export class Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;

  constructor(amountMinor: number, currency: CurrencyCode = DEFAULT_CURRENCY) {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Money amount must be a safe integer in minor units." });
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Currency must be a three-letter ISO code." });
    }
    this.amountMinor = amountMinor;
    this.currency = currency;
    Object.freeze(this);
  }

  static zero(currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    return new Money(0, currency);
  }

  static fromMajor(value: string | number, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
    const normalized = typeof value === "number" ? value.toString() : value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Money value must be a non-negative amount with up to two decimals." });
    }
    const [whole, fraction = ""] = normalized.split(".");
    return new Money(Number(whole) * 100 + Number(fraction.padEnd(2, "0")), currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  multiply(factor: number): Money {
    if (!Number.isSafeInteger(factor) || factor < 0) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Money multiplication factor must be a non-negative safe integer." });
    }
    return new Money(this.amountMinor * factor, this.currency);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amountMinor === other.amountMinor) return 0;
    return this.amountMinor < other.amountMinor ? -1 : 1;
  }

  format(locale = "en-KE"): string {
    return new Intl.NumberFormat(locale, { style: "currency", currency: this.currency }).format(this.amountMinor / 100);
  }

  toJSON(): MoneyJson {
    return { amountMinor: this.amountMinor, currency: this.currency };
  }

  private assertSameCurrency(other: Money) {
    if (this.currency !== other.currency) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Cannot combine money values with different currencies." });
    }
  }
}

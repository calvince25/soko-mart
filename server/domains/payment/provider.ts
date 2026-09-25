import { createHash } from "node:crypto";
import { ENV } from "../../config/env";
import { internalError, invalidState } from "../../../shared/errors/appError";

type ProviderStatus = "pending" | "processing" | "successful" | "failed" | "cancelled";

export type PaymentProviderRequest = {
  internalReference: string;
  amountMinor: number;
  currency: string;
  phone: string;
  callbackUrl: string;
  accountReference: string;
  description: string;
};

export type PaymentProviderInitiation = {
  accepted: boolean;
  providerReference: string;
  status: "pending" | "processing";
  message: string;
  rawMetadata?: Record<string, unknown>;
};

export type PaymentProviderCallback = {
  eventId: string;
  providerReference: string;
  status: ProviderStatus;
  amountMinor?: number;
  currency?: string;
  failureCode?: string;
  failureMessage?: string;
  raw: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: "mpesa";
  initiate(request: PaymentProviderRequest): Promise<PaymentProviderInitiation>;
  parseCallback(payload: unknown): PaymentProviderCallback;
  queryStatus(providerReference: string): Promise<ProviderStatus>;
}

function base64Timestamp(date = new Date()) {
  const value = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}`;
  return { value, encoded: Buffer.from(`${ENV.mpesa.shortcode}${ENV.mpesa.passkey}${value}`).toString("base64") };
}

function amountToMajor(amountMinor: number) {
  if (amountMinor % 100 !== 0) throw invalidState("M-Pesa requires an integer KES amount for this payment attempt.");
  return amountMinor / 100;
}

export class MpesaProvider implements PaymentProvider {
  readonly name = "mpesa" as const;

  async initiate(request: PaymentProviderRequest): Promise<PaymentProviderInitiation> {
    const configured = Boolean(ENV.mpesa.consumerKey && ENV.mpesa.consumerSecret && ENV.mpesa.shortcode && ENV.mpesa.passkey && ENV.mpesa.callbackUrl);
    if ((ENV.mpesa.mock || (!configured && !ENV.isProduction)) && !ENV.isProduction) {
      const providerReference = `MOCK-${createHash("sha256").update(request.internalReference).digest("hex").slice(0, 20)}`;
      return { accepted: true, providerReference, status: "pending", message: "Mock STK request accepted.", rawMetadata: { mode: "mock" } };
    }
    if (!ENV.mpesa.consumerKey || !ENV.mpesa.consumerSecret || !ENV.mpesa.shortcode || !ENV.mpesa.passkey || !ENV.mpesa.callbackUrl) {
      throw invalidState("M-Pesa is not configured. Set the server-side MPESA_* configuration before accepting payments.");
    }
    const baseUrl = ENV.mpesa.environment === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
    const basic = Buffer.from(`${ENV.mpesa.consumerKey}:${ENV.mpesa.consumerSecret}`).toString("base64");
    const tokenResponse = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${basic}` } });
    if (!tokenResponse.ok) throw internalError("M-Pesa authentication failed.");
    const token = (await tokenResponse.json() as { access_token?: string }).access_token;
    if (!token) throw internalError("M-Pesa did not return an access token.");
    const timestamp = base64Timestamp();
    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ BusinessShortCode: ENV.mpesa.shortcode, Password: timestamp.encoded, Timestamp: timestamp.value, TransactionType: "CustomerPayBillOnline", Amount: amountToMajor(request.amountMinor), PartyA: request.phone, PartyB: ENV.mpesa.shortcode, PhoneNumber: request.phone, CallBackURL: ENV.mpesa.callbackUrl, AccountReference: request.accountReference, TransactionDesc: request.description }) });
    if (!response.ok) throw internalError("M-Pesa rejected the STK request.");
    const payload = await response.json() as { CheckoutRequestID?: string; ResponseCode?: string; ResponseDescription?: string; CustomerMessage?: string };
    if (payload.ResponseCode !== "0" || !payload.CheckoutRequestID) throw invalidState(payload.ResponseDescription || "M-Pesa could not start the payment request.");
    return { accepted: true, providerReference: payload.CheckoutRequestID, status: "processing", message: payload.CustomerMessage || "M-Pesa payment request sent.", rawMetadata: { responseCode: payload.ResponseCode } };
  }

  parseCallback(payload: unknown): PaymentProviderCallback {
    const body = (payload ?? {}) as any;
    const result = body?.Body?.stkCallback ?? body?.stkCallback ?? body;
    const items = Array.isArray(result?.CallbackMetadata?.Item) ? result.CallbackMetadata.Item : [];
    const value = (name: string) => items.find((item: any) => item.Name === name)?.Value;
    const resultCode = Number(result?.ResultCode ?? body?.ResultCode);
    const status: ProviderStatus = resultCode === 0 ? "successful" : resultCode === 1032 ? "cancelled" : "failed";
    const providerReference = String(result?.CheckoutRequestID ?? body?.CheckoutRequestID ?? "");
    if (!providerReference) throw invalidState("M-Pesa callback is missing its provider reference.");
    return { eventId: `${providerReference}:${String(result?.ResultCode ?? "unknown")}:${String(value("MpesaReceiptNumber") ?? result?.MpesaReceiptNumber ?? "")}`, providerReference, status, amountMinor: value("Amount") === undefined ? undefined : Number(value("Amount")) * 100, currency: "KES", failureCode: status === "successful" ? undefined : String(result?.ResultCode ?? "MPESA_FAILED"), failureMessage: status === "successful" ? undefined : String(result?.ResultDesc ?? "M-Pesa payment failed."), raw: body };
  }

  async queryStatus(_providerReference: string): Promise<ProviderStatus> {
    if (ENV.mpesa.mock && !ENV.isProduction) return "pending";
    throw invalidState("M-Pesa status reconciliation requires the configured query API credentials.");
  }
}

export const mpesaProvider = new MpesaProvider();

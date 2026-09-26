export type RefundRequest = { provider: "mpesa" | "card" | "other"; refundNumber: string; amountMinor: number; currency: string; originalPaymentReference?: string | null };
export type RefundResult = { configured: boolean; status: "processing" | "successful" | "failed"; providerReference?: string; failureReason?: string };
export interface RefundProvider { submit(request: RefundRequest): Promise<RefundResult>; }
class UnconfiguredRefundProvider implements RefundProvider { async submit(): Promise<RefundResult> { return { configured: false, status: "processing", failureReason: "Refund provider credentials are not configured; awaiting provider integration." }; } }
export function getRefundProvider(_provider: RefundRequest["provider"]): RefundProvider { return new UnconfiguredRefundProvider(); }

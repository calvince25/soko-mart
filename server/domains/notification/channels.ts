import type { NotificationChannel } from "./service";

export type ChannelDeliveryRequest = { notificationId: number; recipientUserId: number; title: string; body: string; providerMessageId?: string | null };
export type ChannelDeliveryResult = { result: "sent" | "retryable" | "failed"; provider: string; providerMessageId?: string; providerStatus?: string; failureReason?: string };
export interface NotificationChannelAdapter { channel: NotificationChannel; deliver(request: ChannelDeliveryRequest): Promise<ChannelDeliveryResult>; }

const inAppAdapter: NotificationChannelAdapter = { channel: "in_app", async deliver() { return { result: "sent", provider: "internal", providerStatus: "stored" }; } };
function unconfigured(channel: Exclude<NotificationChannel, "in_app">): NotificationChannelAdapter { return { channel, async deliver() { return { result: "failed", provider: "unconfigured", providerStatus: "not_configured", failureReason: `${channel} provider is not configured.` }; } }; }
const adapters: Record<NotificationChannel, NotificationChannelAdapter> = { in_app: inAppAdapter, email: unconfigured("email"), sms: unconfigured("sms"), whatsapp: unconfigured("whatsapp") };
export function channelAdapter(channel: NotificationChannel) { return adapters[channel]; }

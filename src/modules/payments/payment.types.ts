export type PlanCode = 'ALAAP' | 'JATRA' | 'AALOK' | 'OBHIJAAT';

export type SubscriptionStatus = 'active' | 'expired' | 'paused' | 'cancelled';

export type PaymentStatus = 'initiated' | 'success' | 'failed' | 'refunded';

export type PaymentGateway = 'sslcommerz' | 'stripe' | 'bkash' | 'applepay';

export interface PlanFeatures {
  photos?: number;
  video?: boolean;
  messaging?: boolean | 'unlimited' | MessagingLimits;
  icebreakersPerMonth?: number;
  parentIcebreakers?: number;
  filters?: string[];
  verification?: 'selfie' | 'silver' | 'gold';
  stealth?: boolean;
  boosts?: number;
  spotlight?: number;
  spotlightDays?: number;
  pauseAllowed?: boolean;
  signatureFeed?: boolean;
  founderConsult?: boolean;
  aiIntroductions?: number;
  familyMessaging?: boolean;
  inviteOnly?: boolean;
}

export interface MessagingLimits {
  newChatsPerMonth: number;
  messagesPerChat: number;
}
export interface CheckoutRequest {
  profileId: string;
  planCode: PlanCode;
  gateway: PaymentGateway;
  currency?: string; // Optional override
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  exchangeRate?: number;
  countryCode: string;
}

export type EntitlementAction =
  | 'send_message'
  | 'start_chat'
  | 'upload_photo'
  | 'view_contact'
  | 'enable_stealth'
  | 'use_boost'
  | 'use_spotlight'
  | 'pause_subscription'
  | 'upload_video'
  | 'use_icebreaker'
  | 'use_parent_icebreaker'
  | 'use_filter'
  | 'access_signature_feed'
  | 'use_ai_introduction'
  | 'use_family_messaging'
  | 'manual_profile_rewrite' // New action
  | 'view_obhijaat_profiles' // New action
  | 'attend_founder_events'; // New action

export interface EntitlementContext {
  photoCount?: number;
  chatCount?: number;
  messageCount?: number;
  icebreakerCount?: number;
  parentIcebreakerCount?: number;
  filterName?: string;
  boostCount?: number;
  spotlightCount?: number;
  aiIntroductionCount?: number;
}

export interface CheckoutRequest {
  profileId: string;
  planCode: PlanCode;
  gateway: PaymentGateway;
}

export interface CheckoutResponse {
  paymentId: string;
  paymentUrl: string;
  gateway: PaymentGateway;
}

export interface GatewayPaymentRequest {
  paymentId: string;
  amount: number;
  currency: string;
  profileId: string;
  planCode: string;
  planName: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  currencyInfo?: CurrencyInfo; // Add currency context
}

export interface GatewayPaymentResponse {
  success: boolean;
  paymentUrl?: string;
  gatewayTxnId?: string;
  error?: string;
  rawResponse?: Record<string, any>;
}

export interface GatewayWebhookPayload {
  gatewayTxnId: string;
  status: 'success' | 'failed';
  amount: number;
  currency: string;
  rawPayload: Record<string, any>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  payload?: GatewayWebhookPayload;
  error?: string;
}

export interface PlanResponse {
  id: string;
  code: string;
  name: string;
  price: number;
  durationDays: number;
  isInviteOnly: boolean;
  features: PlanFeatures;
}

export interface SubscriptionResponse {
  id: string;
  profileId: string;
  plan: PlanResponse;
  status: SubscriptionStatus;
  startAt: Date;
  endAt: Date;
  pausedUntil: Date | null;
  createdAt: Date;
}

export interface PaymentResponse {
  id: string;
  subscriptionId: string | null;
  profileId: string;
  gateway: string;
  amount: number;
  currency: string;
  status: string;
  gatewayTxnId: string | null;
  createdAt: Date;
}

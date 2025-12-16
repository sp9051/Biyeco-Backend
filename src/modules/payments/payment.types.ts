export type PlanCode = 'ALAAP' | 'JATRA' | 'AALOK' | 'OBHIJAAT';

export type SubscriptionStatus =
  | 'active'
  | 'expired'
  | 'paused'
  | 'cancelled';

export type PaymentStatus =
  | 'initiated'
  | 'success'
  | 'failed'
  | 'refunded';

export type PaymentGateway =
  | 'sslcommerz'
  | 'stripe'
  | 'bkash'
  | 'applepay';

export interface MessagingLimits {
  newChatsPerMonth: number;
  messagesPerChat: number;
}

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

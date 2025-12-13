import {
  GatewayPaymentRequest,
  GatewayPaymentResponse,
  WebhookVerificationResult,
  GatewayWebhookPayload,
} from '../payment.types.js';
import { logger } from '../../../utils/logger.js';

export class ApplePayGateway {
  private merchantId: string;
  private stripeSecretKey: string;

  constructor() {
    this.merchantId = process.env.APPLEPAY_MERCHANT_ID || '';
    this.stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  }

  async initiatePayment(request: GatewayPaymentRequest): Promise<GatewayPaymentResponse> {
    try {
      logger.info('Apple Pay: Initiating payment', {
        paymentId: request.paymentId,
        amount: request.amount,
      });

      const paymentIntentData = {
        amount: request.amount * 100,
        currency: request.currency.toLowerCase(),
        payment_method_types: ['card'],
        metadata: {
          paymentId: request.paymentId,
          profileId: request.profileId,
          planCode: request.planCode,
          paymentMethod: 'apple_pay',
        },
      };

      const intentId = `pi_applepay_${Date.now()}_${request.paymentId.slice(0, 8)}`;
      const clientSecret = `${intentId}_secret_stub`;

      return {
        success: true,
        paymentUrl: `applepay://pay?client_secret=${clientSecret}`,
        gatewayTxnId: intentId,
        rawResponse: {
          stub: true,
          clientSecret,
          paymentIntentData,
          merchantId: this.merchantId,
        },
      };
    } catch (error) {
      logger.error('Apple Pay: Payment initiation failed', { error, request });
      return {
        success: false,
        error: 'Failed to initiate Apple Pay payment',
        rawResponse: { error: String(error) },
      };
    }
  }

  verifyWebhook(payload: Record<string, any>, signature?: string): WebhookVerificationResult {
    try {
      logger.info('Apple Pay: Verifying webhook', { type: payload.type });

      const paymentIntent = payload.data?.object;

      if (!paymentIntent) {
        return { valid: false, error: 'Invalid payload structure' };
      }

      const isApplePayPayment = paymentIntent.payment_method_types?.includes('card') &&
        paymentIntent.metadata?.paymentMethod === 'apple_pay';

      if (!isApplePayPayment) {
        return { valid: false, error: 'Not an Apple Pay payment' };
      }

      const status = this.mapStatus(payload.type);
      if (!status) {
        return { valid: false, error: 'Unhandled event type' };
      }

      const webhookPayload: GatewayWebhookPayload = {
        gatewayTxnId: paymentIntent.id,
        status,
        amount: (paymentIntent.amount || 0) / 100,
        currency: paymentIntent.currency?.toUpperCase() || 'BDT',
        rawPayload: payload,
      };

      return { valid: true, payload: webhookPayload };
    } catch (error) {
      logger.error('Apple Pay: Webhook verification failed', { error });
      return { valid: false, error: 'Webhook verification failed' };
    }
  }

  async validateMerchant(validationUrl: string): Promise<{ merchantSession: any }> {
    logger.info('Apple Pay: Validating merchant', { validationUrl });

    return {
      merchantSession: {
        epochTimestamp: Date.now(),
        expiresAt: Date.now() + 300000,
        merchantSessionIdentifier: `session_${Date.now()}`,
        nonce: 'stub_nonce',
        merchantIdentifier: this.merchantId,
        domainName: process.env.APP_DOMAIN || 'localhost',
        displayName: 'Biye',
        signature: 'stub_signature',
      },
    };
  }

  private mapStatus(eventType: string): 'success' | 'failed' | null {
    switch (eventType) {
      case 'payment_intent.succeeded':
        return 'success';
      case 'payment_intent.payment_failed':
        return 'failed';
      default:
        return null;
    }
  }
}

export const applepayGateway = new ApplePayGateway();

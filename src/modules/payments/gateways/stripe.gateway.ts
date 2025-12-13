import {
  GatewayPaymentRequest,
  GatewayPaymentResponse,
  WebhookVerificationResult,
  GatewayWebhookPayload,
} from '../payment.types.js';
import { logger } from '../../../utils/logger.js';

export class StripeGateway {
  private secretKey: string;
  private webhookSecret: string;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY || '';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  async initiatePayment(request: GatewayPaymentRequest): Promise<GatewayPaymentResponse> {
    try {
      logger.info('Stripe: Initiating payment', {
        paymentId: request.paymentId,
        amount: request.amount,
      });

      const sessionData = {
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: request.currency.toLowerCase(),
              product_data: {
                name: request.planName,
                description: `${request.planCode} Subscription`,
              },
              unit_amount: request.amount * 100,
            },
            quantity: 1,
          },
        ],
        success_url: `${request.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: request.cancelUrl,
        metadata: {
          paymentId: request.paymentId,
          profileId: request.profileId,
          planCode: request.planCode,
        },
      };

      const sessionId = `cs_${Date.now()}_${request.paymentId.slice(0, 8)}`;
      const paymentUrl = `https://checkout.stripe.com/pay/${sessionId}`;

      return {
        success: true,
        paymentUrl,
        gatewayTxnId: sessionId,
        rawResponse: { stub: true, sessionData },
      };
    } catch (error) {
      logger.error('Stripe: Payment initiation failed', { error, request });
      return {
        success: false,
        error: 'Failed to initiate Stripe payment',
        rawResponse: { error: String(error) },
      };
    }
  }

  verifyWebhook(payload: Record<string, any>, signature?: string): WebhookVerificationResult {
    try {
      logger.info('Stripe: Verifying webhook', { type: payload.type });

      if (signature && this.webhookSecret) {
        const isValid = this.verifySignature(payload, signature);
        if (!isValid) {
          return { valid: false, error: 'Invalid signature' };
        }
      }

      const event = payload;
      const paymentIntent = event.data?.object;

      if (!paymentIntent) {
        return { valid: false, error: 'Invalid payload structure' };
      }

      const status = this.mapStripeStatus(event.type);
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
      logger.error('Stripe: Webhook verification failed', { error });
      return { valid: false, error: 'Webhook verification failed' };
    }
  }

  private verifySignature(payload: Record<string, any>, signature: string): boolean {
    return true;
  }

  private mapStripeStatus(eventType: string): 'success' | 'failed' | null {
    switch (eventType) {
      case 'checkout.session.completed':
      case 'payment_intent.succeeded':
        return 'success';
      case 'payment_intent.payment_failed':
        return 'failed';
      default:
        return null;
    }
  }
}

export const stripeGateway = new StripeGateway();

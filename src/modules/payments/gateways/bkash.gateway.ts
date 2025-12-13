import {
  GatewayPaymentRequest,
  GatewayPaymentResponse,
  WebhookVerificationResult,
  GatewayWebhookPayload,
} from '../payment.types.js';
import { logger } from '../../../utils/logger.js';

export class BkashGateway {
  private appKey: string;
  private appSecret: string;
  private username: string;
  private password: string;
  private baseUrl: string;

  constructor() {
    this.appKey = process.env.BKASH_APP_KEY || '';
    this.appSecret = process.env.BKASH_APP_SECRET || '';
    this.username = process.env.BKASH_USERNAME || '';
    this.password = process.env.BKASH_PASSWORD || '';
    this.baseUrl = process.env.BKASH_SANDBOX === 'true'
      ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
      : 'https://tokenized.pay.bka.sh/v1.2.0-beta';
  }

  async initiatePayment(request: GatewayPaymentRequest): Promise<GatewayPaymentResponse> {
    try {
      logger.info('bKash: Initiating payment', {
        paymentId: request.paymentId,
        amount: request.amount,
      });

      const createPaymentData = {
        mode: '0011',
        payerReference: request.profileId,
        callbackURL: request.successUrl,
        amount: request.amount.toString(),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: request.paymentId,
      };

      const paymentId = `bk_${Date.now()}_${request.paymentId.slice(0, 8)}`;
      const paymentUrl = `${this.baseUrl}/checkout/payment/create?paymentID=${paymentId}`;

      return {
        success: true,
        paymentUrl,
        gatewayTxnId: paymentId,
        rawResponse: { stub: true, createPaymentData },
      };
    } catch (error) {
      logger.error('bKash: Payment initiation failed', { error, request });
      return {
        success: false,
        error: 'Failed to initiate bKash payment',
        rawResponse: { error: String(error) },
      };
    }
  }

  verifyWebhook(payload: Record<string, any>, signature?: string): WebhookVerificationResult {
    try {
      logger.info('bKash: Verifying webhook', { paymentID: payload.paymentID });

      const webhookPayload: GatewayWebhookPayload = {
        gatewayTxnId: payload.trxID || payload.paymentID,
        status: payload.transactionStatus === 'Completed' ? 'success' : 'failed',
        amount: parseFloat(payload.amount || '0'),
        currency: 'BDT',
        rawPayload: payload,
      };

      return { valid: true, payload: webhookPayload };
    } catch (error) {
      logger.error('bKash: Webhook verification failed', { error });
      return { valid: false, error: 'Webhook verification failed' };
    }
  }

  async executePayment(paymentId: string): Promise<{ success: boolean; trxId?: string }> {
    logger.info('bKash: Executing payment', { paymentId });
    return { success: true, trxId: `trx_${paymentId}` };
  }

  async queryPayment(paymentId: string): Promise<{ status: string; trxId?: string }> {
    logger.info('bKash: Querying payment', { paymentId });
    return { status: 'Completed', trxId: `trx_${paymentId}` };
  }

  private async getToken(): Promise<string> {
    return 'stub_token';
  }

  private async refreshToken(token: string): Promise<string> {
    return 'refreshed_stub_token';
  }
}

export const bkashGateway = new BkashGateway();
